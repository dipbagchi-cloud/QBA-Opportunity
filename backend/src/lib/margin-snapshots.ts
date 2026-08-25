/**
 * Nightly delivery-margin snapshots.
 *
 * Why this exists
 * ---------------
 * The portfolio view originally recomputed every mapped project from Q-People
 * on each page load. Two problems with that, one immediate and one structural:
 *
 *   - Cost. Each deal is a Q-People timesheet fetch plus a full costing. At the
 *     five mapped deals we have today that is tolerable; at fifty it is a page
 *     that takes half a minute and dies entirely if any one project times out,
 *     against an HR system that already OOM-kills chatty clients on this VM.
 *
 *   - It can only ever answer "what is true right now". Margin EROSION — "this
 *     deal has slid from 34% to 22% over four months" — is the question that
 *     actually gets asked in a review, and answering it needs history that
 *     nobody was keeping. Every day that passes without snapshots is a day of
 *     trend data permanently lost.
 *
 * So a job writes one row per mapped won deal per day, and the portfolio reads
 * those. The per-deal tab still computes live on demand, because there you are
 * looking at one project and want it current.
 */
import { prisma } from './prisma';
import { computeMargin } from '../controllers/actual-margin.controller';

/** Same cap as the portfolio fan-out: be a polite client of Q-People. */
const SNAPSHOT_CONCURRENCY = 2;

/** Date-only key so a re-run on the same day overwrites rather than piling up. */
export function snapshotDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export type SnapshotRunResult = {
  asOf: Date;
  attempted: number;
  written: number;
  failed: { opportunityId: string; error: string }[];
};

/**
 * Recompute and store today's margin for every won deal that has a Q-People
 * project mapped.
 *
 * Failures are per-deal: one project that Q-People will not serve must not cost
 * us the other forty-nine snapshots, and a missing row is far better than a
 * wrong one, so nothing is written for a deal that could not be computed.
 */
export async function refreshMarginSnapshots(asOf = snapshotDay()): Promise<SnapshotRunResult> {
  const deals = await prisma.opportunity.findMany({
    where: {
      isArchived: false,
      stage: { is: { name: 'Closed Won' } },
      qpeopleMapping: { isNot: null },
    },
    select: { id: true },
  });

  const result: SnapshotRunResult = { asOf, attempted: deals.length, written: 0, failed: [] };

  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= deals.length) return;
      const { id } = deals[i];
      try {
        // force=true: a nightly snapshot must not be served from the 10-minute
        // request cache left over from someone browsing earlier.
        const m = await computeMargin(id, true);
        await prisma.actualGomSnapshot.upsert({
          where: { opportunityId_asOf: { opportunityId: id, asOf } },
          create: { opportunityId: id, asOf, ...snapshotFields(m) },
          update: { ...snapshotFields(m), computedAt: new Date() },
        });
        result.written++;
      } catch (err: any) {
        result.failed.push({ opportunityId: id, error: err?.message || String(err) });
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(SNAPSHOT_CONCURRENCY, deals.length) }, worker),
  );

  return result;
}

function snapshotFields(m: Awaited<ReturnType<typeof computeMargin>>) {
  return {
    contractedRevenue: m.estimate.contractedRevenue,
    estimatedCost: m.estimate.estimatedCost,
    estimatedGomPercent: m.estimate.estimatedGomPercent,

    actualCost: m.toDate.actualCost,
    budgetConsumedPercent: m.toDate.budgetConsumedPercent,
    hours: m.toDate.hours,
    submittedHours: m.toDate.submittedHours,
    draftHours: m.toDate.draftHours,

    overlapMonths: m.overlap.months,
    overlapPlannedCost: m.overlap.plannedCost,
    overlapActualCost: m.overlap.actualCost,
    burnRatio: m.overlap.burnRatio,
    unplannedSpend: m.unplanned.actualCost,

    projectedTotalCost: m.projection.projectedTotalCost,
    projectedGomPercent: m.projection.projectedGomPercent,
    gomDeltaPoints: m.projection.gomDeltaPoints,
    projectionReliable: m.projection.reliable,

    submittedSharePercent: m.confidence.submittedSharePercent,
    firm: m.confidence.firm,
    unpricedPeople: m.confidence.unpricedPeople,
    fallbackPricedPeople: m.confidence.fallbackPricedPeople,
    unplannedPeople: m.confidence.unplannedPeople,

    caveats: m.caveats.join(','),
  };
}

/** The most recent snapshot for each mapped deal, for the portfolio listing. */
export async function latestSnapshots() {
  const rows = await prisma.actualGomSnapshot.findMany({
    orderBy: [{ opportunityId: 'asc' }, { asOf: 'desc' }],
  });
  const byOpp = new Map<string, typeof rows[number]>();
  for (const r of rows) if (!byOpp.has(r.opportunityId)) byOpp.set(r.opportunityId, r);
  return byOpp;
}

/** Snapshot history for one deal, oldest first — the erosion curve. */
export async function snapshotHistory(opportunityId: string, limit = 90) {
  const rows = await prisma.actualGomSnapshot.findMany({
    where: { opportunityId },
    orderBy: { asOf: 'desc' },
    take: limit,
    select: {
      asOf: true, actualCost: true, budgetConsumedPercent: true,
      projectedGomPercent: true, gomDeltaPoints: true, projectionReliable: true,
      estimatedGomPercent: true, hours: true, submittedSharePercent: true,
    },
  });
  return rows.reverse();
}
