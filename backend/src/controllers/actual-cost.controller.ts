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
import { getSkillAliasMap } from '../lib/skill-aliases';
import { bandOrder, type ExperienceBandKey } from '../lib/experience-bands';

const HOURS_PER_DAY = 8;

/** How the pricing card was chosen, in words the tab can print verbatim. */
const CARD_SOURCE_TEXT: Record<CardSource, string> = {
  'stamped-at-submission': 'the rate card recorded against this estimate when it was first submitted to Sales',
  'submission-date': 'the rate card live when this estimate was first submitted to Sales',
  'created-date': 'the rate card live when this opportunity was created \u2014 no submission was recorded for it, so this is inferred',
  'none': 'no rate card could be determined',
};

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

/**
 * Which rate-card batch prices this opportunity.
 *
 * The card the deal was SOLD on — not the one live when the time happened to be
 * booked. Cost used to be priced per booking month, which quietly broke the
 * comparison the Actual GOM tab exists for: a deal sold in June against the
 * April card but delivered through August, after a new card landed on the 13th,
 * had its August hours priced at rates nobody had ever quoted it, so the
 * resulting "overrun" was partly just the rate change.
 *
 * "Sold on" means the card live at INITIAL SUBMISSION — when presales first sent
 * the estimate to sales. A re-estimate does not re-open that baseline.
 *
 * Three sources, in descending authority, because the earlier ones did not exist
 * for historic deals:
 *
 *   1. presalesData.rateCardBatchId — stamped at first submission. Exact, and
 *      immune to the card list changing afterwards. Every deal submitted from
 *      now on has this.
 *   2. The earliest StageHistory entry for the Proposal stage — the real
 *      submission date. Only usable where stage history was recorded; on this
 *      database it starts 2026-08-13, so most existing deals have none.
 *   3. opportunity.createdAt — an inference, and flagged as one. A deal created
 *      in June and submitted in September is priced on June's card, which may be
 *      wrong; nothing recorded at the time can settle it.
 */
type CardSource = 'stamped-at-submission' | 'submission-date' | 'created-date' | 'none';

function batchForOpportunity(
  batches: { id: string; label: string; uploadedAt: Date }[],
  opts: { stampedBatchId?: string | null; submittedAt?: Date | null; createdAt?: Date | null },
): { batch: { id: string; label: string; uploadedAt: Date } | null; extrapolated: boolean; source: CardSource } {
  if (!batches.length) return { batch: null, extrapolated: true, source: 'none' };

  // 1. Exact, recorded at the moment it mattered.
  if (opts.stampedBatchId) {
    const hit = batches.find((b) => b.id === opts.stampedBatchId);
    if (hit) return { batch: hit, extrapolated: false, source: 'stamped-at-submission' };
    // Stamped against a batch that has since been deleted — fall through rather
    // than pricing on a card that no longer exists.
  }

  // 2/3. Whichever date we have; the source is reported so the UI can say how
  // confident this is rather than presenting an inference as a fact.
  const anchor = opts.submittedAt || opts.createdAt || null;
  const source: CardSource = opts.submittedAt ? 'submission-date' : 'created-date';
  if (!anchor) return { batch: batches[batches.length - 1], extrapolated: true, source: 'none' };

  const live = batches.filter((b) => b.uploadedAt <= anchor);
  if (live.length) return { batch: live[live.length - 1], extrapolated: false, source };
  // Submitted before any card existed: use the earliest, flagged.
  return { batch: batches[0], extrapolated: true, source };
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

    const [entries, employees, assumptions, batches, planRows, opp, firstSubmission, aliases] = await Promise.all([
      fetchTimesheetEntries(mapping.qpeopleProjectId, force),
      getEmployeesResolved(force),
      loadAssumptions(),
      prisma.rateCardBatch.findMany({ orderBy: { uploadedAt: 'asc' } }),
      prisma.actualResourceRow.findMany({ where: { opportunityId: id } }),
      prisma.opportunity.findUnique({
        where: { id },
        select: { createdAt: true, presalesData: true },
      }),
      // Earliest move into Proposal = initial submission. Empty for deals that
      // predate stage-history recording, which is why the fallback chain exists.
      prisma.stageHistory.findFirst({
        where: { opportunityId: id, stage: { is: { name: 'Proposal' } } },
        orderBy: { enteredAt: 'asc' },
        select: { enteredAt: true },
      }).catch(() => null),
      getSkillAliasMap(force),
    ]);

    // One card for the whole engagement — the one it was sold against.
    const stampedBatchId = ((opp?.presalesData as any) || {}).rateCardBatchId ?? null;
    const { batch: oppBatch, extrapolated: oppExtrapolated, source: cardSource } =
      batchForOpportunity(batches, {
        stampedBatchId,
        submittedAt: firstSubmission?.enteredAt ?? null,
        createdAt: opp?.createdAt ?? null,
      });

    const empById = new Map(employees.map((e) => [e.id, e]));
    const plannedEmployeeIds = new Set(planRows.map((r) => r.employeeId).filter(Boolean) as string[]);

    // Rate cards, indexed by batch + normalised skill + canonical band.
    const allRates = await prisma.rateCard.findMany({
      select: { batchId: true, skill: true, experienceBand: true, ctc: true, level: true },
    });
    // Skills are collapsed onto their alias group on BOTH sides, so someone
    // tagged "UI/UX development" still prices against the card's "UI/ UX/ WP".
    const canonSkill = (v: string | null | undefined) => {
      const k = skillKey(v);
      return k ? (aliases.get(k) || k) : '';
    };
    const rateIndex = new Map<string, { ctc: number; level: string }>();
    // Also keep every band priced for a skill, ordered by seniority, so a band
    // the card does not cover can fall back to the nearest one it does.
    const bandsBySkill = new Map<string, { band: string; order: number; ctc: number; level: string; canonical: boolean }[]>();

    // When several card skills alias onto one key, the row belonging to the
    // CANONICAL skill wins.
    //
    // Without this the index simply kept whichever row it happened to read
    // first, so an alias could silently re-price people. Aliasing "Cloud
    // Security" and "Cloud (Azure" onto "Cloud Architect (AWS, Azure, GCP)"
    // collapsed three skills onto one key, and a Cloud Architect at band 4-6
    // was priced from the 9,16,812 "Cloud (Azure" row instead of the
    // 40,00,000 one — a 4x understatement produced by a Settings change, with
    // nothing on screen to show it had happened.
    //
    // An alias should let a person be FOUND under another name, never quietly
    // change what that name costs.
    const fromCanonicalSkill = new Set<string>();
    for (const r of allRates) {
      const band = canonicalBandKey(r.experienceBand);
      if (!band) continue;
      const own = skillKey(r.skill);
      const canon = canonSkill(r.skill);
      const isCanonical = own === canon;

      const k = `${r.batchId}|${canon}|${band}`;
      if (!rateIndex.has(k) || (isCanonical && !fromCanonicalSkill.has(k))) {
        rateIndex.set(k, { ctc: r.ctc, level: r.level });
        if (isCanonical) fromCanonicalSkill.add(k);
      }

      const sk = `${r.batchId}|${canon}`;
      const arr = bandsBySkill.get(sk) || [];
      const existing = arr.find((x) => x.band === band);
      if (!existing) {
        arr.push({ band, order: bandOrder(band), ctc: r.ctc, level: r.level, canonical: isCanonical });
        bandsBySkill.set(sk, arr);
      } else if (isCanonical && !existing.canonical) {
        // Same reasoning as above, applied to the fallback ladder.
        existing.ctc = r.ctc;
        existing.level = r.level;
        existing.canonical = true;
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
      const exact = rateIndex.get(`${batchId}|${canonSkill(skill)}|${wantBand}`);
      if (exact) return { ...exact, bandUsed: wantBand, fallback: false };
      const list = bandsBySkill.get(`${batchId}|${canonSkill(skill)}`);
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
        const batch = oppBatch;
        const extrapolated = oppExtrapolated;
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
        // The card this engagement is priced on, and why that one.
        rateCardUsed: oppBatch?.label || null,
        rateCardRule: CARD_SOURCE_TEXT[cardSource],
        rateCardSource: cardSource,
        // An inferred card is not the same claim as a recorded one, and the UI
        // must be able to tell them apart.
        rateCardInferred: cardSource === 'created-date' || cardSource === 'none',
        rateCardExtrapolated: oppExtrapolated,
        opportunityCreatedAt: opp?.createdAt ?? null,
        initialSubmissionAt: firstSubmission?.enteredAt
          ?? ((opp?.presalesData as any) || {}).initialSubmissionAt
          ?? null,
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
