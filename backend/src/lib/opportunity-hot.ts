/**
 * CR-01 — "Hot Opportunity" classification.
 *
 * The previous rule made a deal Hot whenever it had been *touched* (edited or
 * commented on) within the stale window, so merely saving a record turned it
 * Hot regardless of commercial maturity. This module replaces that with a
 * maturity score built ONLY from commercial signals — deliberately NO
 * `updatedAt` / activity input, so editing a deal can never change its Hot
 * state. That guarantee is the core of the change request.
 *
 * The rule is data-driven (systemConfig key `hot_classification`) so Sales
 * Leadership can tune the weights and threshold without a deploy. `qualified`
 * is a hook reserved for CR-02 (BANT qualification): it contributes nothing
 * until an `isQualified` signal exists on the opportunity, after which Hot
 * consumes qualification with no rework here.
 *
 * Pure and framework-free so it can be unit-tested in isolation, mirroring
 * `opportunity-probability.ts` and `opportunity-access.ts`.
 */

export interface HotWeights {
  /** A committed quote / proposal number exists on the deal. */
  proposalSent: number;
  /** Stage is Proposal / Sales / Negotiation (proposal is on the table). */
  stageProposalPlus: number;
  /** Expected close date falls within the configured horizon. */
  closingSoon: number;
  /** CR-02 hook — deal is BANT-qualified. No effect until the field exists. */
  qualified: number;
}

export interface HotClassificationConfig {
  /** When false, callers fall back to the legacy activity-based rule. */
  enabled: boolean;
  /** hotScore at or above this counts as Hot (0–110 with default weights). */
  threshold: number;
  /** "Closing soon" window in days from today. */
  closingHorizonDays: number;
  /** Suppress Hot for deals manually put On Hold. */
  excludeOnHold: boolean;
  weights: HotWeights;
}

export const DEFAULT_HOT_CONFIG: HotClassificationConfig = {
  enabled: true,
  threshold: 60,
  closingHorizonDays: 90,
  excludeOnHold: true,
  weights: {
    proposalSent: 40,
    stageProposalPlus: 20,
    closingSoon: 20,
    qualified: 30,
  },
};

// Stages that mean "a proposal is on the table". Both the Proposal/Sales and
// the Negotiation synonyms occur in the data (see analytics STAGE_GROUP). The
// committed-quote milestone is the stronger, objective signal; this softer,
// name-based one is deliberately worth less on its own.
const PROPOSAL_PLUS_STAGES = new Set<string>(['Proposal', 'Sales', 'Negotiation']);

// Kept in sync with CLOSED_STAGE_NAMES in the opportunities controller and
// lib/opportunity-access.ts — a closed or archived deal is never Hot.
const CLOSED_STAGE_NAMES = new Set<string>([
  'Closed Won',
  'Closed-Won',
  'Closed Lost',
  'Proposal Lost',
  'Delivered',
]);

const ON_HOLD = 'on hold';

export interface HotInput {
  stage?: { name?: string | null } | null;
  currentStage?: string | null;
  expectedCloseDate?: Date | string | null;
  presalesData?: unknown;
  detailedStatus?: string | null;
  isArchived?: boolean | null;
  /** CR-02 hook. Undefined on every record today. */
  isQualified?: boolean | null;
}

export interface HotResult {
  isHot: boolean;
  hotScore: number;
  /** Which signals fired, for drill-downs / explainability. */
  reasons: string[];
}

/**
 * True when the estimation has produced a committed quote — i.e. a real
 * proposal number exists. Field precedence mirrors `resolveCommittedQuote`
 * in the opportunities controller so the two agree on "a quote exists".
 */
export function hasCommittedQuote(presalesData: unknown): boolean {
  const pd = presalesData as any;
  if (!pd || typeof pd !== 'object') return false;
  const raw = pd.finalRevenue ?? pd.totalRevenue ?? pd?.gomSummary?.totalRevenue ?? null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0;
}

/**
 * Merge a stored systemConfig value with the defaults, tolerating partial or
 * malformed input (a half-filled admin save must never produce NaN weights).
 */
export function resolveHotConfig(raw: unknown): HotClassificationConfig {
  const v = raw && typeof raw === 'object' ? (raw as any) : {};
  const w = v.weights && typeof v.weights === 'object' ? v.weights : {};
  const num = (x: any, d: number): number => {
    const n = Number(x);
    return Number.isFinite(n) ? n : d;
  };
  const d = DEFAULT_HOT_CONFIG;
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : d.enabled,
    threshold: num(v.threshold, d.threshold),
    closingHorizonDays: num(v.closingHorizonDays, d.closingHorizonDays),
    excludeOnHold: typeof v.excludeOnHold === 'boolean' ? v.excludeOnHold : d.excludeOnHold,
    weights: {
      proposalSent: num(w.proposalSent, d.weights.proposalSent),
      stageProposalPlus: num(w.stageProposalPlus, d.weights.stageProposalPlus),
      closingSoon: num(w.closingSoon, d.weights.closingSoon),
      qualified: num(w.qualified, d.weights.qualified),
    },
  };
}

/**
 * Score a single opportunity's commercial maturity and decide whether it is
 * Hot. Note the absence of any activity / recency input — that is intentional
 * and is what CR-01 requires. `enabled` is NOT consulted here: it is a caller
 * concern (the caller falls back to the legacy rule when the flag is off), so
 * `hotScore` and `reasons` remain meaningful for comparison even while off.
 */
export function classifyHot(
  opp: HotInput,
  config: HotClassificationConfig = DEFAULT_HOT_CONFIG,
  now: Date = new Date(),
): HotResult {
  const reasons: string[] = [];
  const w = config.weights;

  const stageName = opp.stage?.name || opp.currentStage || 'Discovery';
  const isClosed = CLOSED_STAGE_NAMES.has(stageName);
  const isArchived = opp.isArchived === true;
  const onHold = (opp.detailedStatus || '').trim().toLowerCase() === ON_HOLD;
  const open = !isClosed && !isArchived;

  let hotScore = 0;
  if (hasCommittedQuote(opp.presalesData)) {
    hotScore += w.proposalSent;
    reasons.push('proposalSent');
  }
  if (PROPOSAL_PLUS_STAGES.has(stageName)) {
    hotScore += w.stageProposalPlus;
    reasons.push('stageProposalPlus');
  }
  if (opp.expectedCloseDate != null) {
    const closeMs = new Date(opp.expectedCloseDate).getTime();
    if (Number.isFinite(closeMs)) {
      const days = (closeMs - now.getTime()) / 86_400_000;
      // Within the horizon and not already overdue. An overdue close date on an
      // open deal is a data-hygiene issue (CR-12), not a heat signal.
      if (days >= 0 && days <= config.closingHorizonDays) {
        hotScore += w.closingSoon;
        reasons.push('closingSoon');
      }
    }
  }
  if (opp.isQualified === true) {
    hotScore += w.qualified;
    reasons.push('qualified');
  }

  let isHot = open && hotScore >= config.threshold;
  if (isHot && config.excludeOnHold && onHold) {
    isHot = false;
    reasons.push('suppressedOnHold');
  }

  return { isHot, hotScore, reasons };
}
