/**
 * CR-04 — canonical opportunity probability-of-closure.
 *
 * This is the SINGLE source of truth for probability. It replaces three sources
 * that disagreed:
 *   - the old stage base + an arbitrary "+completeness × 1.5" bonus here, which
 *     produced the reviewed 81% on a Negotiation deal with no proposal sent;
 *   - analytics.controller's separate getStageProbability(); and
 *   - the (unused-for-compute) Stage.probability column.
 *
 * The core fix per CR-04: a premature or optimistic stage selection can no
 * longer manufacture a high probability. A deal sitting in Proposal/Negotiation
 * without a committed quote (i.e. no proposal has actually been sent) is capped,
 * so probability reflects the objective milestone, not the stage label alone.
 *
 * The curve, the cap and the optional qualification factor are data-driven
 * (systemConfig key `probability_model`) so Sales Leadership can tune them
 * without a deploy — the meeting explicitly declined to approve fixed numbers,
 * so these defaults are a proposal for sign-off, not an assumed rule.
 *
 * Pure and framework-free; stage names resolve through the CR-03 stage registry
 * so both vocabularies (Discovery/… and Pipeline/Presales/Sales) are handled.
 */

import { resolveCanonicalStage } from './opportunity-stages';
import { hasCommittedQuote } from './opportunity-hot';

export interface ProbabilityConfig {
  /** Base probability per canonical stage. */
  stageBase: Record<string, number>;
  /** Late-stage deals (Proposal/Negotiation) must have a committed quote. */
  requireQuoteForLateStage: boolean;
  /** Cap applied to a late-stage deal that has no committed quote yet. */
  unquotedLateStageCap: number;
  /** CR-02 tie-in: multiplier applied to a not-yet-Qualified deal past Discovery
   *  (1 = no effect; leadership can set < 1 to dampen unqualified deals). */
  qualificationFactor: number;
}

export const DEFAULT_PROBABILITY_CONFIG: ProbabilityConfig = {
  stageBase: {
    Discovery: 10,
    Qualification: 25,
    Proposal: 50,
    Negotiation: 75,
    'Closed Won': 100,
    'Closed Lost': 0,
  },
  requireQuoteForLateStage: true,
  unquotedLateStageCap: 25,
  qualificationFactor: 1,
};

// Stages whose probability implies a proposal is on the table. Kept here (not in
// config) because it is a structural fact about the model, not a tuning knob.
const LATE_STAGES = new Set<string>(['Proposal', 'Negotiation']);

export interface ProbabilityInput {
  stage?: { name?: string | null } | null;
  currentStage?: string | null;
  presalesData?: unknown;
  isQualified?: boolean | null;
  // Tolerated for backward compatibility with existing callers; ignored.
  salesData?: unknown;
  expectedCloseDate?: Date | string | null;
  description?: string | null;
  tentativeDuration?: number | string | null;
  expectedDayRate?: number | string | null;
}

/** Merge stored config with defaults, tolerating partial/malformed input. */
export function resolveProbabilityConfig(raw: unknown): ProbabilityConfig {
  const v = raw && typeof raw === 'object' ? (raw as any) : {};
  const num = (x: any, d: number): number => {
    const n = Number(x);
    return Number.isFinite(n) ? n : d;
  };
  const d = DEFAULT_PROBABILITY_CONFIG;
  const base: Record<string, number> = { ...d.stageBase };
  if (v.stageBase && typeof v.stageBase === 'object') {
    for (const k of Object.keys(d.stageBase)) base[k] = num(v.stageBase[k], d.stageBase[k]);
  }
  return {
    stageBase: base,
    requireQuoteForLateStage:
      typeof v.requireQuoteForLateStage === 'boolean' ? v.requireQuoteForLateStage : d.requireQuoteForLateStage,
    unquotedLateStageCap: num(v.unquotedLateStageCap, d.unquotedLateStageCap),
    qualificationFactor: num(v.qualificationFactor, d.qualificationFactor),
  };
}

/**
 * Probability-of-closure for one opportunity, 0–100.
 *
 * NOTE: no activity/completeness bonus — the old `+fields × 1.5` term is gone.
 * Probability is the stage base, capped when the late-stage milestone (a
 * committed quote) is missing, and optionally dampened for unqualified deals.
 */
export function calculateOpportunityProbability(
  opp: ProbabilityInput,
  config: ProbabilityConfig = DEFAULT_PROBABILITY_CONFIG,
): number {
  const stage = resolveCanonicalStage(opp.stage?.name || opp.currentStage || 'Discovery');

  // Closed stages are definitive regardless of any other signal.
  if (stage === 'Closed Won') return 100;
  if (stage === 'Closed Lost') return 0;

  let prob = config.stageBase[stage] ?? 10;

  // Maturity guard — the CR-04 fix. A late-stage deal with no committed quote
  // (proposal not actually sent) cannot claim late-stage probability.
  if (config.requireQuoteForLateStage && LATE_STAGES.has(stage) && !hasCommittedQuote(opp.presalesData)) {
    prob = Math.min(prob, config.unquotedLateStageCap);
  }

  // Optional CR-02 tie-in.
  if (config.qualificationFactor !== 1 && stage !== 'Discovery' && opp.isQualified !== true) {
    prob = Math.round(prob * config.qualificationFactor);
  }

  return Math.max(0, Math.min(100, Math.round(prob)));
}
