/**
 * Portfolio-level views of won business.
 *
 * Two endpoints with deliberately different costs:
 *
 *   delivery-queue   — pure QCRM database. Answers "which won deals still need
 *                      to be handed over to delivery?" Touches Q-People not at
 *                      all, so it loads instantly and still works when Q-People
 *                      is down. This is the operational work queue.
 *
 *   margin-portfolio — reads the nightly snapshot table. Answers "which
 *                      engagements are losing margin?" and, because the
 *                      snapshots accumulate, "since when?". Only recomputes
 *                      live when explicitly asked, or to bootstrap an
 *                      environment that has no snapshots yet.
 *
 * Keeping them apart matters: the queue is the screen someone opens twenty
 * times a day, and it would be absurd for it to wait on an external HR system
 * to tell you that a deal has no project code.
 */
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { refreshMarginSnapshots, latestSnapshots } from '../lib/margin-snapshots';

const WON_STAGE = 'Closed Won';

/** Won deals, with how far each one has got through delivery handover. */
async function loadWonDeals() {
  return prisma.opportunity.findMany({
    where: { isArchived: false, stage: { is: { name: WON_STAGE } } },
    select: {
      id: true,
      title: true,
      value: true,
      currency: true,
      actualCloseDate: true,
      updatedAt: true,
      client: { select: { name: true } },
      owner: { select: { name: true, email: true } },
      qpeopleMapping: {
        select: {
          qpeopleProjectId: true,
          qpeopleProjectCode: true,
          qpeopleProjectName: true,
          mappedByName: true,
          createdAt: true,
        },
      },
      actualResources: { select: { employeeId: true } },
    },
    orderBy: { actualCloseDate: 'desc' },
  });
}

/**
 * GET /api/opportunities/qpeople/delivery-queue
 *
 * The handover queue: every won deal and how far it has got towards being
 * measurable. Deliberately database-only — see the note at the top.
 */
export async function getDeliveryQueue(_req: Request, res: Response) {
  try {
    const deals = await loadWonDeals();

    const rows = deals.map((d) => {
      const planRows = d.actualResources.length;
      const planFilled = d.actualResources.filter((r) => r.employeeId).length;
      const mapped = !!d.qpeopleMapping;

      // Three states, because mapping the project is only half the job — a
      // mapped deal whose plan rows have nobody in them still produces no
      // usable actuals, and a two-state flag would call that "done".
      const status: 'unmapped' | 'plan-incomplete' | 'ready' =
        !mapped ? 'unmapped'
          : (planRows === 0 || planFilled < planRows) ? 'plan-incomplete'
            : 'ready';

      const wonAt = d.actualCloseDate;
      const ageDays = wonAt
        ? Math.max(0, Math.floor((Date.now() - new Date(wonAt).getTime()) / 86400000))
        : null;

      return {
        opportunityId: d.id,
        title: d.title,
        client: d.client?.name || null,
        owner: d.owner?.name || null,
        value: d.value ? Number(d.value) : null,
        currency: d.currency,
        wonDate: wonAt,
        // Aging is the whole point of a queue: a deal won in June with no
        // project code is a worse problem than one won last week.
        ageDays,
        status,
        mapped,
        project: d.qpeopleMapping
          ? {
            id: d.qpeopleMapping.qpeopleProjectId,
            code: d.qpeopleMapping.qpeopleProjectCode,
            name: d.qpeopleMapping.qpeopleProjectName,
            mappedBy: d.qpeopleMapping.mappedByName,
            mappedAt: d.qpeopleMapping.createdAt,
          }
          : null,
        planRows,
        planFilled,
      };
    });

    // Worst first: unmapped before incomplete before ready, then oldest first
    // within each group.
    const rank = { unmapped: 0, 'plan-incomplete': 1, ready: 2 } as const;
    rows.sort((a, b) =>
      rank[a.status] - rank[b.status] || (b.ageDays ?? -1) - (a.ageDays ?? -1));

    return res.json({
      rows,
      totals: {
        won: rows.length,
        unmapped: rows.filter((r) => r.status === 'unmapped').length,
        planIncomplete: rows.filter((r) => r.status === 'plan-incomplete').length,
        ready: rows.filter((r) => r.status === 'ready').length,
        oldestUnmappedDays: rows
          .filter((r) => r.status === 'unmapped')
          .reduce((a, r) => Math.max(a, r.ageDays ?? 0), 0),
      },
    });
  } catch (err) {
    console.error('Delivery queue error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}

/**
 * GET /api/opportunities/qpeople/margin-portfolio
 *
 * Reads the nightly snapshots by default, so the page is a single indexed query
 * rather than a fan-out to Q-People. Two escape hatches:
 *
 *   ?refresh=true  recompute every deal live and persist today's snapshot.
 *                  Slow and externally dependent — the explicit "I want it
 *                  current" button, not the default.
 *   bootstrap      if no snapshots exist at all (fresh environment, or before
 *                  the first nightly run) it computes once rather than showing
 *                  an empty page and looking broken.
 */
export async function getMarginPortfolio(req: Request, res: Response) {
  try {
    const wantLive = req.query.refresh === 'true';
    const deals = await loadWonDeals();
    const mapped = deals.filter((d) => d.qpeopleMapping);

    let snaps = await latestSnapshots();
    let ranLive = false;
    let runFailures: { opportunityId: string; error: string }[] = [];

    // Bootstrap covers the gap between deploying this and the first 02:30 run.
    if (wantLive || snaps.size === 0) {
      const run = await refreshMarginSnapshots();
      runFailures = run.failed;
      ranLive = true;
      snaps = await latestSnapshots();
    }

    const rows = mapped.map((d) => {
      const s = snaps.get(d.id);
      const project = d.qpeopleMapping
        ? {
          id: d.qpeopleMapping.qpeopleProjectId,
          code: d.qpeopleMapping.qpeopleProjectCode,
          name: d.qpeopleMapping.qpeopleProjectName,
        }
        : null;

      if (!s) {
        const why = runFailures.find((f) => f.opportunityId === d.id);
        return {
          opportunityId: d.id, title: d.title, client: d.client?.name || null,
          owner: d.owner?.name || null, project,
          estimate: null, toDate: null, projection: null, confidence: null,
          caveats: [], asOf: null,
          error: why ? why.error : 'No snapshot yet for this deal',
        };
      }

      return {
        opportunityId: d.id,
        title: d.title,
        client: d.client?.name || null,
        owner: d.owner?.name || null,
        project,
        estimate: {
          contractedRevenue: s.contractedRevenue,
          estimatedCost: s.estimatedCost,
          estimatedGomPercent: s.estimatedGomPercent,
        },
        toDate: {
          actualCost: s.actualCost,
          budgetConsumedPercent: s.budgetConsumedPercent,
          hours: s.hours,
        },
        projection: {
          projectedGomPercent: s.projectedGomPercent,
          gomDeltaPoints: s.gomDeltaPoints,
          reliable: s.projectionReliable,
          suppressedReason: s.projectionReliable
            ? null
            : 'too little comparable time booked to project a landing margin',
        },
        confidence: {
          submittedSharePercent: s.submittedSharePercent,
          firm: s.firm,
        },
        caveats: s.caveats ? s.caveats.split(',').filter(Boolean) : [],
        asOf: s.asOf,
        error: null as string | null,
      };
    });

    // Biggest margin erosion first — the reason anyone opens this page. Rows
    // with no snapshot sort last rather than masquerading as healthy.
    const ok = rows.filter((r) => !r.error);
    const failed = rows.filter((r) => r.error);
    ok.sort((a, b) =>
      (a.projection?.gomDeltaPoints ?? Infinity) - (b.projection?.gomDeltaPoints ?? Infinity));

    const withDelta = ok.filter((r) => r.projection?.gomDeltaPoints != null);
    const newest = ok.reduce<Date | null>(
      (a, r) => (r.asOf && (!a || r.asOf > a) ? r.asOf : a), null);

    return res.json({
      rows: [...ok, ...failed],
      source: ranLive ? 'live' : 'snapshot',
      asOf: newest,
      totals: {
        wonDeals: deals.length,
        mappedDeals: mapped.length,
        unmappedDeals: deals.length - mapped.length,
        computed: ok.length,
        failed: failed.length,
        contractedRevenue: ok.reduce((a, r) => a + (r.estimate?.contractedRevenue || 0), 0),
        estimatedCost: ok.reduce((a, r) => a + (r.estimate?.estimatedCost || 0), 0),
        actualCostToDate: ok.reduce((a, r) => a + (r.toDate?.actualCost || 0), 0),
        atRisk: withDelta.filter((r) => (r.projection!.gomDeltaPoints as number) < 0).length,
        provisional: ok.filter((r) => r.confidence && !r.confidence.firm).length,
      },
    });
  } catch (err) {
    console.error('Margin portfolio error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}
