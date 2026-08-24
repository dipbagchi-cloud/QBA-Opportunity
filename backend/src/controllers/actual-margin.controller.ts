/**
 * Actual GOM — "Margin & Variance" sub-tab and the portfolio listing.
 *
 * The two sub-tabs that came before this one produce inputs: who is mapped, and
 * what their booked hours cost. Neither ever states the margin, which is the
 * number the tab is named after. This does.
 *
 * The honest-comparison problem
 * -----------------------------
 * The tempting formula is (contracted revenue - actual cost so far) / revenue.
 * On a project that is two months into a nine-month delivery that reads as a
 * spectacular margin, because all of the revenue is counted against a fraction
 * of the cost. It is not a margin, it is an artefact of being early.
 *
 * So nothing here divides full-project revenue by part-project cost. Instead:
 *
 *   - Cost is compared against the estimate MONTH BY MONTH. The presales
 *     estimate stores gomSummary.monthlyData keyed "YYYY-MM", and the timesheet
 *     costing produces monthTotals on exactly the same keys, so the two are
 *     directly comparable without any completion assumption.
 *   - Only months carrying BOTH a plan and bookings are compared. Months with
 *     bookings the plan never budgeted for, and planned months nobody has
 *     started, are reported as themselves rather than folded into a ratio that
 *     they would silently distort.
 *   - A projected full-project GOM is offered, but it is flagged as a
 *     projection and is REFUSED outright when too little comparable time has
 *     accumulated for a burn rate to mean anything. See the materiality gate
 *     below for why guessing there is worse than declining.
 *
 * Currency: every figure is INR base. The rate card is INR, and presalesData
 * carries currency "INR" even on deals whose opportunity currency is EUR, so
 * the two sides are already on the same footing. The frontend converts for
 * display via the currency provider.
 */
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { QPeopleError } from '../lib/qpeople';
import { computeActualCost, NotMappedError } from './actual-cost.controller';

/** How much of a month's hours must be submitted before the variance is firm. */
const SUBMITTED_CONFIDENCE_FLOOR = 0.5;

type MonthlyPlan = { revenue: number; cost: number; gom: number };

/**
 * Contracted value, mirroring getFinalQuoteValue() in the opportunity page so
 * the margin tab and the deal header can never disagree about the revenue.
 */
function contractedRevenueOf(presales: any, opp: { adjustedEstimatedValue: any; value: any }): number {
  if (presales?.finalRevenue != null) return Number(presales.finalRevenue);
  if (presales?.totalRevenue != null) return Number(presales.totalRevenue);
  if (presales?.gomSummary?.totalRevenue != null) return Number(presales.gomSummary.totalRevenue);
  if (Number(opp.adjustedEstimatedValue) > 0) return Number(opp.adjustedEstimatedValue);
  return Number(opp.value) || 0;
}

const r0 = (n: number) => Math.round(n);
const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number, d: number) => (d ? r2((n / d) * 100) : null);

/**
 * Margin for one opportunity. Throws NotMappedError / QPeopleError so the
 * portfolio loop can skip a single bad project rather than fail the page.
 */
export async function computeMargin(opportunityId: string, force = false) {
  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      id: true, title: true, currency: true, value: true, adjustedEstimatedValue: true,
      presalesData: true, actualCloseDate: true,
      client: { select: { name: true } },
    },
  });
  if (!opp) throw new NotMappedError();

  const actual = await computeActualCost(opportunityId, force);

  const presales = (opp.presalesData as any) || {};
  const gomSummary = presales.gomSummary || {};
  const plannedMonthly: Record<string, MonthlyPlan> = gomSummary.monthlyData || {};

  const contractedRevenue = contractedRevenueOf(presales, opp);
  const estimatedCost = Number(gomSummary.totalCost) || 0;
  const estimatedGomPercent = gomSummary.gomPercent != null ? r2(Number(gomSummary.gomPercent)) : null;

  // ── Month-by-month, plan against actual ────────────────────────────────
  // Union of both sides: a month the plan never anticipated is exactly the
  // kind of overrun this view exists to surface, so it must not be dropped.
  const monthKeys = [...new Set([...Object.keys(plannedMonthly), ...actual.months])].sort();

  const monthly = monthKeys.map((m) => {
    const plan = plannedMonthly[m];
    const act = actual.monthTotals[m];
    const plannedCost = plan ? r0(Number(plan.cost) || 0) : null;
    const actualCost = act ? act.cost : null;
    const variance = plannedCost !== null && actualCost !== null ? actualCost - plannedCost : null;
    return {
      month: m,
      plannedCost,
      plannedRevenue: plan ? r0(Number(plan.revenue) || 0) : null,
      actualCost,
      actualHours: act ? act.hours : null,
      draftHours: act ? act.draftHours : null,
      variance,
      variancePercent: plannedCost ? pct(variance ?? 0, plannedCost) : null,
      // A month with bookings the plan never budgeted for.
      unplannedMonth: !plan && !!act,
      // A planned month nobody has booked against yet.
      notStarted: !!plan && !act,
    };
  });

  // ── Three different kinds of month, kept apart on purpose ──────────────
  //
  // Summing "plan" across every month that has actuals is the obvious move and
  // it is wrong: a month with bookings but no plan contributes 0 to the planned
  // side, so the variance reads as infinite overspend. Indorama booked June and
  // July against a plan that starts in August, which inflated its variance to
  // +112% on the first cut of this code.
  //
  // Only months present on BOTH sides can be compared like for like. The other
  // two kinds are real signals in their own right, and are reported as
  // themselves rather than being blended into a ratio.
  const overlapMonths = monthly.filter((r) => r.plannedCost !== null && r.actualCost !== null);
  const unplannedMonths = monthly.filter((r) => r.plannedCost === null && r.actualCost !== null);
  const notStartedMonths = monthly.filter((r) => r.plannedCost !== null && r.actualCost === null);

  const plannedOverlap = overlapMonths.reduce((a, r) => a + (r.plannedCost || 0), 0);
  const actualOverlap = overlapMonths.reduce((a, r) => a + (r.actualCost || 0), 0);
  const varianceOverlap = actualOverlap - plannedOverlap;
  const unplannedSpend = unplannedMonths.reduce((a, r) => a + (r.actualCost || 0), 0);
  const notStartedPlan = notStartedMonths.reduce((a, r) => a + (r.plannedCost || 0), 0);
  const actualToDate = actualOverlap + unplannedSpend;

  const burnRatio = plannedOverlap > 0 ? actualOverlap / plannedOverlap : null;

  // ── Projection (explicitly not an actual, and often refused) ───────────
  //
  // Extrapolating a whole project from a sliver of comparable time produces
  // confident nonsense. AM Legal has one overlap month carrying 3,250 against a
  // 301,500 plan — every formula run over that says the project will come in at
  // ~1% of budget and land an 84% margin. The honest answer is that it cannot
  // be projected yet, so this refuses rather than guessing.
  //
  // Materiality gate: enough comparable time must have accumulated for the burn
  // ratio to mean anything.
  const MATERIAL_BURN_SHARE = 0.1;
  const projectionReliable =
    burnRatio !== null
    && overlapMonths.length >= 1
    && actualOverlap >= plannedOverlap * MATERIAL_BURN_SHARE;

  const suppressedReason = burnRatio === null
    ? (unplannedMonths.length
      ? 'all booked time falls outside the planned months, so there is nothing to compare it against'
      : 'no month has both a plan and bookings yet')
    : !projectionReliable
      ? 'too little of the planned work has been booked for a burn rate to mean anything'
      : null;

  // Carry the WHOLE estimate at the observed burn rate, then add spend the plan
  // never accounted for. One clean assumption, and it degrades sensibly instead
  // of collapsing when the planned months happen to have elapsed.
  const projectedTotalCost = projectionReliable
    ? estimatedCost * (burnRatio as number) + unplannedSpend
    : null;
  const projectedGomPercent = projectedTotalCost !== null && contractedRevenue > 0
    ? r2(((contractedRevenue - projectedTotalCost) / contractedRevenue) * 100)
    : null;

  // ── Confidence — what the variance above is actually built on ──────────
  const submittedShare = actual.totals.hours > 0
    ? actual.totals.submittedHours / actual.totals.hours
    : 1;
  const pricedPeople = actual.totals.people - actual.totals.unpricedPeople;

  const caveats: string[] = [];
  if (!estimatedCost) caveats.push('no-estimate');
  if (!Object.keys(plannedMonthly).length) caveats.push('no-monthly-plan');
  if (submittedShare < SUBMITTED_CONFIDENCE_FLOOR) caveats.push('mostly-draft');
  if (actual.totals.unpricedPeople > 0) caveats.push('unpriced-people');
  if (actual.totals.fallbackPricedPeople > 0) caveats.push('fallback-rates');
  if (actual.totals.unplannedPeople > 0) caveats.push('unplanned-people');
  if (unplannedMonths.length) caveats.push('unplanned-months');
  if (!projectionReliable) caveats.push('projection-suppressed');

  return {
    opportunity: {
      id: opp.id,
      title: opp.title,
      client: opp.client?.name || null,
      currency: opp.currency,
      wonDate: opp.actualCloseDate,
    },
    project: actual.project,
    estimate: {
      contractedRevenue: r0(contractedRevenue),
      estimatedCost: r0(estimatedCost),
      estimatedGomValue: r0(contractedRevenue - estimatedCost),
      estimatedGomPercent,
      hasMonthlyPlan: Object.keys(plannedMonthly).length > 0,
    },
    toDate: {
      // Factual, assumption-free: what has actually been spent, and how much of
      // the approved budget that represents.
      actualCost: r0(actualToDate),
      budgetConsumedPercent: pct(actualToDate, estimatedCost),
      hours: actual.totals.hours,
      submittedHours: actual.totals.submittedHours,
      draftHours: actual.totals.draftHours,
    },
    // The only like-for-like comparison: months carrying both a plan and
    // bookings. Everything else is reported beside it, not folded into it.
    overlap: {
      months: overlapMonths.length,
      plannedCost: r0(plannedOverlap),
      actualCost: r0(actualOverlap),
      variance: r0(varianceOverlap),
      variancePercent: pct(varianceOverlap, plannedOverlap),
      burnRatio: burnRatio !== null ? r2(burnRatio) : null,
    },
    // Booked time the estimate never budgeted for — usually work starting
    // before the planned window, which is a schedule problem showing up as a
    // cost problem.
    unplanned: {
      months: unplannedMonths.length,
      actualCost: r0(unplannedSpend),
      monthKeys: unplannedMonths.map((r) => r.month),
    },
    notStarted: {
      months: notStartedMonths.length,
      plannedCost: r0(notStartedPlan),
    },
    projection: {
      projectedTotalCost: projectedTotalCost !== null ? r0(projectedTotalCost) : null,
      projectedGomPercent,
      // The delta the business actually cares about: are we going to land
      // above or below the margin this deal was approved on?
      gomDeltaPoints: projectedGomPercent !== null && estimatedGomPercent !== null
        ? r2(projectedGomPercent - estimatedGomPercent)
        : null,
      reliable: projectionReliable,
      suppressedReason,
      basis: 'the full estimate carried at the burn rate observed in months that have both a plan and bookings, plus spend outside the planned window',
    },
    confidence: {
      submittedSharePercent: r2(submittedShare * 100),
      firm: submittedShare >= SUBMITTED_CONFIDENCE_FLOOR,
      people: actual.totals.people,
      pricedPeople,
      unpricedPeople: actual.totals.unpricedPeople,
      fallbackPricedPeople: actual.totals.fallbackPricedPeople,
      unplannedPeople: actual.totals.unplannedPeople,
    },
    monthly,
    caveats,
  };
}

/**
 * GET /api/opportunities/:id/qpeople/margin
 */
export async function getMargin(req: Request, res: Response) {
  try {
    const data = await computeMargin(req.params.id, req.query.refresh === 'true');
    return res.json(data);
  } catch (err) {
    if (err instanceof NotMappedError) return res.status(409).json({ error: err.message });
    if (err instanceof QPeopleError) {
      console.error('Q-People error:', err.message);
      return res.status(502).json({ error: 'Could not reach Q-People', detail: err.message });
    }
    console.error('Margin error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}
