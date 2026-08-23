/**
 * Actual GOM — "Actual Booking & Cost" sub-tab.
 *
 * Monthly grid of what each person actually booked on the mapped Q-People
 * project, and what that time cost.
 *
 * Q-People records no money whatsoever — total_costing_amount is 0 on all
 * 100,866 timesheets and Employee.ctc is 0 for all 216 active employees — so
 * every figure here is computed by QCRM:
 *
 *     hours (Q-People)  ->  days = hours / 8
 *     days x dailyCost, where dailyCost comes from the QCRM rate card via
 *     calculateRateCard(), the same function the presales estimate used.
 *
 * Decisions baked in (agreed with the business):
 *   - Only docstatus 1 (submitted) timesheets count.
 *   - A person is priced on THEIR OWN skill + experience band, not the band of
 *     the plan line they fill, so staffing a junior line with a senior shows up
 *     as real extra cost.
 *   - The rate card used is the one that was live in that month, via
 *     rate_card_batches — so a project spanning a rate change is priced correctly.
 *   - dailyCost keeps the rate card's 220-productive-day basis. Someone working
 *     a full ~240-day calendar year therefore costs ~109% of their annual cost,
 *     which is the intended reading: they consumed more than a standard year.
 */
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import {
  fetchTimesheetEntries, getEmployeesResolved, skillKey,
  bandForYears, canonicalBandKey, bandLabel, QPeopleError,
} from '../lib/qpeople';
import { calculateRateCard, BudgetAssumptions } from '../lib/gom-calculator';

const HOURS_PER_DAY = 8;

const DEFAULT_ASSUMPTIONS: BudgetAssumptions = {
  marginPercent: 35,
  deliveryMgmtPercent: 10,
  benchPercent: 20,
  leaveEligibilityPercent: 0,
  annualGrowthBufferPercent: 0,
  averageIncrementPercent: 0,
  workingDaysPerYear: 220,
  bonusPercent: 0,
  indirectCostPercent: 0,
  welfarePerFte: 0,
  trainingPerFte: 0,
};

async function loadAssumptions(): Promise<BudgetAssumptions> {
  const cfg = await prisma.systemConfig.findUnique({ where: { key: 'budget_assumptions' } });
  const v = (cfg?.value as any) || {};
  return { ...DEFAULT_ASSUMPTIONS, ...v };
}

/** Which rate-card batch was live in a given YYYY-MM. */
function batchForMonth(batches: { id: string; label: string; uploadedAt: Date }[], month: string) {
  // End of that month — a card uploaded mid-month governs the rest of it.
  const cutoff = new Date(`${month}-01T00:00:00Z`);
  cutoff.setUTCMonth(cutoff.getUTCMonth() + 1);
  const live = batches.filter((b) => b.uploadedAt < cutoff);
  if (live.length) return { batch: live[live.length - 1], extrapolated: false };
  // Months before any rate card exists fall back to the earliest one, flagged.
  return batches.length ? { batch: batches[0], extrapolated: true } : { batch: null, extrapolated: true };
}

/**
 * GET /api/opportunities/:id/qpeople/actual-cost
 */
export async function getActualCost(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const force = req.query.refresh === 'true';

    const mapping = await prisma.qPeopleProjectMapping.findUnique({ where: { opportunityId: id } });
    if (!mapping) return res.status(409).json({ error: 'Map a Q-People project first' });

    const [entries, employees, assumptions, batches, planRows] = await Promise.all([
      fetchTimesheetEntries(mapping.qpeopleProjectId, force),
      getEmployeesResolved(force),
      loadAssumptions(),
      prisma.rateCardBatch.findMany({ orderBy: { uploadedAt: 'asc' } }),
      prisma.actualResourceRow.findMany({ where: { opportunityId: id } }),
    ]);

    const empById = new Map(employees.map((e) => [e.id, e]));
    const plannedEmployeeIds = new Set(planRows.map((r) => r.employeeId).filter(Boolean) as string[]);

    // Rate cards, indexed by batch + normalised skill + canonical band.
    const allRates = await prisma.rateCard.findMany({
      select: { batchId: true, skill: true, experienceBand: true, ctc: true, level: true },
    });
    const rateIndex = new Map<string, { ctc: number; level: string }>();
    for (const r of allRates) {
      const k = `${r.batchId}|${skillKey(r.skill)}|${canonicalBandKey(r.experienceBand)}`;
      if (!rateIndex.has(k)) rateIndex.set(k, { ctc: r.ctc, level: r.level });
    }

    // Day cost is expensive-ish to derive and repeats heavily; memoise per CTC.
    const dayCostCache = new Map<number, number>();
    const dayCostFor = (ctc: number) => {
      if (!dayCostCache.has(ctc)) {
        dayCostCache.set(ctc, calculateRateCard({ annualCtc: ctc, monthsPerYear: 12, ...assumptions }).dailyCost);
      }
      return dayCostCache.get(ctc)!;
    };

    // ── Bucket hours by employee x month ──────────────────────────────────
    const months = new Set<string>();
    const byEmp = new Map<string, { name: string; monthly: Map<string, number> }>();
    for (const e of entries) {
      months.add(e.month);
      const rec = byEmp.get(e.employeeId) || { name: e.employeeName, monthly: new Map<string, number>() };
      rec.monthly.set(e.month, (rec.monthly.get(e.month) || 0) + e.hours);
      byEmp.set(e.employeeId, rec);
    }
    const monthList = [...months].sort();

    // ── Price each person-month ───────────────────────────────────────────
    const warnings = new Set<string>();
    const rows = [...byEmp.entries()].map(([empId, rec]) => {
      const emp = empById.get(empId);
      const bandKey = emp
        ? (bandForYears(emp.experienceYears) ?? canonicalBandKey(emp.experienceBandFallback))
        : null;
      const skill = emp?.skillsetGom || null;
      const noSkill = !skill;
      const noBand = !bandKey;
      if (noSkill) warnings.add('no-skillset');
      if (noBand) warnings.add('no-experience');
      if (emp && emp.department && /uzbek|georgia|indonesia/i.test(emp.department)) warnings.add('location');

      const monthly: Record<string, any> = {};
      let totalHours = 0;
      let totalCost = 0;
      let anyRate = false;

      for (const m of monthList) {
        const hours = rec.monthly.get(m) || 0;
        if (!hours) continue;
        const days = hours / HOURS_PER_DAY;
        const { batch, extrapolated } = batchForMonth(batches, m);
        let ctc: number | null = null;
        let level: string | null = null;
        if (batch && skill && bandKey) {
          const hit = rateIndex.get(`${batch.id}|${skillKey(skill)}|${bandKey}`);
          if (hit) { ctc = hit.ctc; level = hit.level; }
        }
        const dayCost = ctc !== null ? dayCostFor(ctc) : null;
        const cost = dayCost !== null ? days * dayCost : null;
        if (cost !== null) { totalCost += cost; anyRate = true; }
        totalHours += hours;
        monthly[m] = {
          hours: Math.round(hours * 100) / 100,
          days: Math.round(days * 100) / 100,
          cost: cost === null ? null : Math.round(cost),
          rateBatch: batch?.label || null,
          rateExtrapolated: extrapolated,
          level,
        };
      }

      if (!anyRate && totalHours > 0) warnings.add('no-rate');

      return {
        employeeId: empId,
        employeeName: emp?.name || rec.name,
        designation: emp?.designation || null,
        branch: emp?.department || null,
        skill,
        experienceYears: emp?.experienceYears ?? null,
        experienceBandKey: bandKey,
        experienceBandLabel: bandLabel(bandKey),
        inPlan: plannedEmployeeIds.has(empId),
        monthly,
        totalHours: Math.round(totalHours * 100) / 100,
        totalDays: Math.round((totalHours / HOURS_PER_DAY) * 100) / 100,
        totalCost: anyRate ? Math.round(totalCost) : null,
        priced: anyRate,
        unpricedReason: anyRate ? null
          : noSkill ? 'No Skillset GOM recorded for this person'
          : noBand ? 'No experience recorded for this person'
          : 'No rate card entry for this skill and band',
      };
    }).sort((a, b) => b.totalHours - a.totalHours);

    // ── Column totals ─────────────────────────────────────────────────────
    const monthTotals: Record<string, { hours: number; cost: number; priced: boolean }> = {};
    for (const m of monthList) {
      let h = 0; let c = 0; let priced = false;
      for (const r of rows) {
        const cell = r.monthly[m];
        if (!cell) continue;
        h += cell.hours;
        if (cell.cost !== null) { c += cell.cost; priced = true; }
      }
      monthTotals[m] = { hours: Math.round(h * 100) / 100, cost: Math.round(c), priced };
    }

    const grandHours = rows.reduce((a, r) => a + r.totalHours, 0);
    const grandCost = rows.reduce((a, r) => a + (r.totalCost || 0), 0);

    res.json({
      project: {
        id: mapping.qpeopleProjectId,
        code: mapping.qpeopleProjectCode,
        name: mapping.qpeopleProjectName,
      },
      months: monthList,
      rows,
      monthTotals,
      totals: {
        people: rows.length,
        hours: Math.round(grandHours * 100) / 100,
        days: Math.round((grandHours / HOURS_PER_DAY) * 100) / 100,
        cost: Math.round(grandCost),
        unpricedPeople: rows.filter((r) => !r.priced).length,
        unplannedPeople: rows.filter((r) => !r.inPlan).length,
      },
      basis: {
        hoursPerDay: HOURS_PER_DAY,
        workingDaysPerYear: assumptions.workingDaysPerYear,
        timesheetFilter: 'submitted only (docstatus = 1)',
        rateBasis: "each person's own skill + experience band",
        rateCardVersioning: batches.map((b) => ({ label: b.label, from: b.uploadedAt })),
      },
      warnings: [...warnings],
    });
  } catch (err) {
    if (err instanceof QPeopleError) {
      console.error('Q-People error:', err.message);
      return res.status(502).json({ error: 'Could not reach Q-People', detail: err.message });
    }
    console.error('Actual cost error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}
