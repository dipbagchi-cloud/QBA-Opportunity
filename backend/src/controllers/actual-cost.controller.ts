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
import { bandOrder, type ExperienceBandKey } from '../lib/experience-bands';

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

/** Thrown when an opportunity has no Q-People project mapped yet. */
export class NotMappedError extends Error {
  constructor() {
    super('Map a Q-People project first');
    this.name = 'NotMappedError';
  }
}

export type ActualCostPayload = Awaited<ReturnType<typeof computeActualCost>>;

/**
 * The costing engine, shared by three callers: the Actual Booking & Cost tab,
 * the Margin & Variance sub-tab, and the portfolio listing.
 *
 * It throws (NotMappedError / QPeopleError) rather than writing a response, so
 * the portfolio loop can catch a single failing project and carry on instead of
 * losing the whole page to one Q-People timeout.
 */
export async function computeActualCost(id: string, force = false) {
    const mapping = await prisma.qPeopleProjectMapping.findUnique({ where: { opportunityId: id } });
    if (!mapping) throw new NotMappedError();

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
    // Also keep every band priced for a skill, ordered by seniority, so a band
    // the card does not cover can fall back to the nearest one it does.
    const bandsBySkill = new Map<string, { band: string; order: number; ctc: number; level: string }[]>();
    for (const r of allRates) {
      const band = canonicalBandKey(r.experienceBand);
      if (!band) continue;
      const k = `${r.batchId}|${skillKey(r.skill)}|${band}`;
      if (!rateIndex.has(k)) rateIndex.set(k, { ctc: r.ctc, level: r.level });
      const sk = `${r.batchId}|${skillKey(r.skill)}`;
      const arr = bandsBySkill.get(sk) || [];
      if (!arr.some((x) => x.band === band)) {
        arr.push({ band, order: bandOrder(band), ctc: r.ctc, level: r.level });
        bandsBySkill.set(sk, arr);
      }
    }
    for (const arr of bandsBySkill.values()) arr.sort((a, b) => a.order - b.order);

    /**
     * Rate for a skill at a band, falling back when the card does not price
     * that seniority.
     *
     * 14 skills in the current card have no 15+ row — including several
     * inherently senior ones (Delivery Lead/Head and both Project Manager
     * skills stop at 3 bands) — so a strict lookup leaves real, expensive
     * people costing nothing, which understates the project far more than an
     * approximate rate does. We take the highest band priced at or below the
     * person's, and flag the row so the approximation is never invisible.
     */
    function lookupRate(batchId: string, skill: string, wantBand: ExperienceBandKey) {
      const exact = rateIndex.get(`${batchId}|${skillKey(skill)}|${wantBand}`);
      if (exact) return { ...exact, bandUsed: wantBand, fallback: false };
      const list = bandsBySkill.get(`${batchId}|${skillKey(skill)}`);
      if (!list?.length) return null;
      const want = bandOrder(wantBand);
      const atOrBelow = list.filter((x) => x.order <= want);
      // Prefer the most senior band the card actually prices; if the person is
      // more junior than anything priced, use the lowest available instead.
      const pick = atOrBelow.length ? atOrBelow[atOrBelow.length - 1] : list[0];
      return { ctc: pick.ctc, level: pick.level, bandUsed: pick.band, fallback: true };
    }

    // Day cost is expensive-ish to derive and repeats heavily; memoise per CTC.
    const dayCostCache = new Map<number, number>();
    const dayCostFor = (ctc: number) => {
      if (!dayCostCache.has(ctc)) {
        dayCostCache.set(ctc, calculateRateCard({ annualCtc: ctc, monthsPerYear: 12, ...assumptions }).dailyCost);
      }
      return dayCostCache.get(ctc)!;
    };

    // ── Bucket hours by employee x month, keeping submitted and draft apart ──
    // Draft hours are included because submission lags heavily (63% of the
    // current month is unsubmitted), but they are tracked separately so the UI
    // can show a firm figure and a provisional one rather than blending them.
    type Bucket = { submitted: number; draft: number };
    const months = new Set<string>();
    const byEmp = new Map<string, { name: string; monthly: Map<string, Bucket> }>();
    for (const e of entries) {
      months.add(e.month);
      const rec = byEmp.get(e.employeeId) || { name: e.employeeName, monthly: new Map<string, Bucket>() };
      const b = rec.monthly.get(e.month) || { submitted: 0, draft: 0 };
      if (e.submitted) b.submitted += e.hours; else b.draft += e.hours;
      rec.monthly.set(e.month, b);
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
      let draftHours = 0;
      let totalCost = 0;
      let draftCost = 0;
      let anyRate = false;
      let fellBack = false;

      for (const m of monthList) {
        const b = rec.monthly.get(m);
        if (!b) continue;
        const hours = b.submitted + b.draft;
        if (!hours) continue;
        const days = hours / HOURS_PER_DAY;
        const { batch, extrapolated } = batchForMonth(batches, m);
        let ctc: number | null = null;
        let level: string | null = null;
        let bandUsed: string | null = null;
        let rateFallback = false;
        if (batch && skill && bandKey) {
          const hit = lookupRate(batch.id, skill, bandKey);
          if (hit) {
            ctc = hit.ctc; level = hit.level; bandUsed = hit.bandUsed; rateFallback = hit.fallback;
            if (hit.fallback) fellBack = true;
          }
        }
        const dayCost = ctc !== null ? dayCostFor(ctc) : null;
        const cost = dayCost !== null ? days * dayCost : null;
        const dCost = dayCost !== null ? (b.draft / HOURS_PER_DAY) * dayCost : null;
        if (cost !== null) { totalCost += cost; draftCost += dCost || 0; anyRate = true; }
        totalHours += hours;
        draftHours += b.draft;
        monthly[m] = {
          hours: Math.round(hours * 100) / 100,
          submittedHours: Math.round(b.submitted * 100) / 100,
          draftHours: Math.round(b.draft * 100) / 100,
          days: Math.round(days * 100) / 100,
          cost: cost === null ? null : Math.round(cost),
          draftCost: dCost === null ? null : Math.round(dCost),
          rateBatch: batch?.label || null,
          rateExtrapolated: extrapolated,
          rateFallback,
          rateBandUsed: bandUsed,
          level,
        };
      }

      if (!anyRate && totalHours > 0) warnings.add('no-rate');
      if (draftHours > 0) warnings.add('draft-time');
      if (fellBack) warnings.add('rate-fallback');

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
        submittedHours: Math.round((totalHours - draftHours) * 100) / 100,
        draftHours: Math.round(draftHours * 100) / 100,
        totalDays: Math.round((totalHours / HOURS_PER_DAY) * 100) / 100,
        totalCost: anyRate ? Math.round(totalCost) : null,
        draftCost: anyRate ? Math.round(draftCost) : null,
        priced: anyRate,
        // True when the card had no row at this person's band and a lower one
        // was used — the figure is approximate and understates seniority.
        rateFallback: fellBack,
        rateFallbackNote: fellBack
          ? `Rate card has no "${bandLabel(bandKey) || bandKey}" row for ${skill}; priced at the highest band it does cover`
          : null,
        unpricedReason: anyRate ? null
          : noSkill ? 'No Skillset GOM recorded for this person'
          : noBand ? 'No experience recorded for this person'
          : 'No rate card entry for this skill and band',
      };
    }).sort((a, b) => b.totalHours - a.totalHours);

    // ── Column totals ─────────────────────────────────────────────────────
    const monthTotals: Record<string, { hours: number; draftHours: number; cost: number; draftCost: number; priced: boolean }> = {};
    for (const m of monthList) {
      let h = 0; let dh = 0; let c = 0; let dc = 0; let priced = false;
      for (const r of rows) {
        const cell = r.monthly[m];
        if (!cell) continue;
        h += cell.hours;
        dh += cell.draftHours;
        if (cell.cost !== null) { c += cell.cost; dc += cell.draftCost || 0; priced = true; }
      }
      monthTotals[m] = {
        hours: Math.round(h * 100) / 100,
        draftHours: Math.round(dh * 100) / 100,
        cost: Math.round(c),
        draftCost: Math.round(dc),
        priced,
      };
    }

    const grandHours = rows.reduce((a, r) => a + r.totalHours, 0);
    const grandDraftHours = rows.reduce((a, r) => a + r.draftHours, 0);
    const grandCost = rows.reduce((a, r) => a + (r.totalCost || 0), 0);
    const grandDraftCost = rows.reduce((a, r) => a + (r.draftCost || 0), 0);

    return {
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
        submittedHours: Math.round((grandHours - grandDraftHours) * 100) / 100,
        draftHours: Math.round(grandDraftHours * 100) / 100,
        days: Math.round((grandHours / HOURS_PER_DAY) * 100) / 100,
        cost: Math.round(grandCost),
        submittedCost: Math.round(grandCost - grandDraftCost),
        draftCost: Math.round(grandDraftCost),
        unpricedPeople: rows.filter((r) => !r.priced).length,
        fallbackPricedPeople: rows.filter((r) => r.rateFallback).length,
        unplannedPeople: rows.filter((r) => !r.inPlan).length,
      },
      basis: {
        hoursPerDay: HOURS_PER_DAY,
        workingDaysPerYear: assumptions.workingDaysPerYear,
        timesheetFilter: 'submitted and draft, reported separately (cancelled excluded)',
        rateBasis: "each person's own skill + experience band",
        rateCardVersioning: batches.map((b) => ({ label: b.label, from: b.uploadedAt })),
      },
      warnings: [...warnings],
    };
}

/**
 * GET /api/opportunities/:id/qpeople/actual-cost
 */
export async function getActualCost(req: Request, res: Response) {
  try {
    const data = await computeActualCost(req.params.id, req.query.refresh === 'true');
    return res.json(data);
  } catch (err) {
    if (err instanceof NotMappedError) return res.status(409).json({ error: err.message });
    if (err instanceof QPeopleError) {
      console.error('Q-People error:', err.message);
      return res.status(502).json({ error: 'Could not reach Q-People', detail: err.message });
    }
    console.error('Actual cost error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}
