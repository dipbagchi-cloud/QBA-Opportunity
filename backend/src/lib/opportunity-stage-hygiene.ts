/**
 * CR-12 — Stage Transition / Data-Hygiene Guardrails (the "stale stage" prompt).
 *
 * The pipeline review found opportunities whose CRM stage lagged their actual
 * commercial progress — the flagged example was a deal where a proposal had
 * already been shared while the CRM still showed Qualification. The CR-03
 * transition GATES stop a record jumping FORWARD without its prerequisites; this
 * module covers the opposite hygiene problem: a record that has quietly earned a
 * later stage (a commercial milestone occurred) but was never moved on.
 *
 * It is a soft signal, never a block — acceptance criterion 4 requires that
 * authorised users can still correct legitimate exceptions, so the UI PROMPTS
 * ("this deal looks further along than its stage") and the real move still runs
 * through the CR-03 guards. Pure and framework-free so it can be unit-tested.
 *
 * The milestone that marks a deal as "past Discovery/Qualification" is the
 * existence of an estimation artefact — a committed quote (the GOM produced a
 * real number) or an attached Statement of Work. Both live in Proposal or later,
 * so either one appearing while the deal is still before Proposal is the stale
 * signal. A deal already in Proposal or beyond is never flagged: attaching a SOW
 * there is the expected pre-Negotiation step, not a hygiene problem.
 */

import { resolveCanonicalStage, getStageMeta, stageOrder } from './opportunity-stages';
import { hasCommittedQuote } from './opportunity-hot';

export interface StageHygieneInput {
  /** Current stage name or alias. */
  stageName?: string | null;
  /** The deal's presalesData blob (source of the committed-quote signal). */
  presalesData?: unknown;
  /** Whether a current (non-archived) SOW document is attached. */
  hasCurrentSow?: boolean;
}

export interface StageHygieneResult {
  /** True when the stage lags a commercial milestone that has already occurred. */
  stale: boolean;
  /** Which milestone triggered it (for analytics / testing). */
  milestone?: 'committed_quote' | 'sow_attached';
  /** The canonical stage the deal should be advanced to (at least). */
  suggestedStage?: string;
  /** Human-readable explanation for the prompt. */
  reason?: string;
}

/**
 * Assess whether a deal's stage is stale relative to its commercial milestones.
 * Behaviour-neutral for closed deals and for deals already at/after Proposal.
 */
export function assessStageHygiene(input: StageHygieneInput): StageHygieneResult {
  const stage = resolveCanonicalStage(input.stageName);
  const meta = getStageMeta(stage);
  // Unknown or closed stages are never "stale" — a closed deal is finished, and
  // an unresolvable stage is not something to nag about.
  if (!meta || meta.isClosed) return { stale: false };

  // Estimation (and everything it produces) belongs in Proposal or later. A deal
  // that has already reached Proposal is legitimately holding these artefacts.
  const proposalOrder = stageOrder('Proposal') ?? 3;
  if (meta.order >= proposalOrder) return { stale: false };

  const hasSow = input.hasCurrentSow === true;
  const hasQuote = hasCommittedQuote(input.presalesData);
  if (!hasSow && !hasQuote) return { stale: false };

  // Prefer the strongest, most concrete artefact in the message.
  const milestone: StageHygieneResult['milestone'] = hasSow ? 'sow_attached' : 'committed_quote';
  const what = hasSow
    ? 'a Statement of Work is already attached'
    : 'a committed quote/estimate already exists';
  return {
    stale: true,
    milestone,
    suggestedStage: 'Proposal',
    reason: `This deal is still in ${stage}, but ${what} — a commercial milestone that belongs in Proposal or later. Update the stage so the pipeline reflects real progress.`,
  };
}
