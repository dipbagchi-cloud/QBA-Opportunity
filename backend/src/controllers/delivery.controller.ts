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
 *   margin-portfolio — fans out to Q-People, one costing per mapped deal. Real
 *                      money, real latency. Answers "which engagements are
 *                      losing margin?"
 *
 * Keeping them apart matters: the queue is the screen someone opens twenty
 * times a day, and it would be absurd for it to wait on an external HR system
 * to tell you that a deal has no project code.
 */
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { QPeopleError } from '../lib/qpeople';
import { NotMappedError } from './actual-cost.controller';
import { computeMargin } from './actual-margin.controller';

const WON_STAGE = 'Closed Won';

/**
 * Q-People is a shared external system and the VM has already shown it will
 * OOM-kill chatty processes, so the portfolio never opens more than this many
 * costings at once. Sequential would be safer still but turns a 6-deal page
 * into six round trips of latency.
 */
const PORTFOLIO_CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

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
 * Estimated vs actual margin across every mapped won deal.
 *
 * One deal failing must not take the page with it, so each costing is caught
 * individually and reported as an errored row. That is the difference between
 * "Q-People is slow today" and "the margin page is broken".
 */
export async function getMarginPortfolio(req: Request, res: Response) {
  try {
    const force = req.query.refresh === 'true';
    const deals = await loadWonDeals();
    const mapped = deals.filter((d) => d.qpeopleMapping);

    const results = await mapWithConcurrency(mapped, PORTFOLIO_CONCURRENCY, async (d) => {
      try {
        const m = await computeMargin(d.id, force);
        return {
          opportunityId: d.id,
          title: d.title,
          client: d.client?.name || null,
          owner: d.owner?.name || null,
          project: m.project,
          estimate: m.estimate,
          toDate: m.toDate,
          projection: m.projection,
          confidence: m.confidence,
          caveats: m.caveats,
          error: null as string | null,
        };
      } catch (e: any) {
        return {
          opportunityId: d.id,
          title: d.title,
          client: d.client?.name || null,
          owner: d.owner?.name || null,
          project: d.qpeopleMapping
            ? {
              id: d.qpeopleMapping.qpeopleProjectId,
              code: d.qpeopleMapping.qpeopleProjectCode,
              name: d.qpeopleMapping.qpeopleProjectName,
            }
            : null,
          estimate: null, toDate: null, projection: null, confidence: null, caveats: [],
          error: e instanceof QPeopleError ? `Q-People: ${e.message}`
            : e instanceof NotMappedError ? e.message
              : 'Could not compute margin',
        };
      }
    });

    // Biggest margin erosion first — the reason anyone opens this page. Rows
    // that failed to compute sort last rather than masquerading as healthy.
    const ok = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    ok.sort((a, b) =>
      (a.projection?.gomDeltaPoints ?? Infinity) - (b.projection?.gomDeltaPoints ?? Infinity));

    const withDelta = ok.filter((r) => r.projection?.gomDeltaPoints != null);

    return res.json({
      rows: [...ok, ...failed],
      totals: {
        wonDeals: deals.length,
        mappedDeals: mapped.length,
        unmappedDeals: deals.length - mapped.length,
        computed: ok.length,
        failed: failed.length,
        contractedRevenue: ok.reduce((a, r) => a + (r.estimate?.contractedRevenue || 0), 0),
        estimatedCost: ok.reduce((a, r) => a + (r.estimate?.estimatedCost || 0), 0),
        actualCostToDate: ok.reduce((a, r) => a + (r.toDate?.actualCost || 0), 0),
        // Deals projected to land below the margin they were sold at.
        atRisk: withDelta.filter((r) => (r.projection!.gomDeltaPoints as number) < 0).length,
        // Deals whose numbers are mostly draft time, and so should not be
        // quoted as fact regardless of what the delta says.
        provisional: ok.filter((r) => r.confidence && !r.confidence.firm).length,
      },
    });
  } catch (err) {
    console.error('Margin portfolio error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}
