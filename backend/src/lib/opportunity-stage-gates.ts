/**
 * CR-03 Phase 3 — objective stage entry gates.
 *
 * "A record cannot legitimately appear in a later commercial stage when
 * prerequisite milestones have not occurred." This module formalises the
 * milestone that can be checked synchronously from the record: a deal may only
 * enter Negotiation once a proposal has actually been sent — i.e. a committed
 * quote exists. That closes the reviewed "Negotiation with no proposal" hole at
 * the stage level (CR-04 already fixed the probability symptom), regardless of
 * whether the move came from the Kanban or the detail page.
 *
 * The SOW / GOM-approval requirements for entering Proposal stay in the
 * controller (they need async DB lookups); this lib covers the pure checks and
 * is the single, testable definition of the entry milestones.
 *
 * Stage names resolve through the CR-03 registry so both vocabularies are
 * handled.
 */

import { resolveCanonicalStage } from './opportunity-stages';
import { hasCommittedQuote } from './opportunity-hot';

export interface StageEntryInput {
  presalesData?: unknown;
}

export interface StageEntryResult {
  allowed: boolean;
  reason?: string;
}

export function checkStageEntry(targetStage: string, opp: StageEntryInput): StageEntryResult {
  const stage = resolveCanonicalStage(targetStage);

  if (stage === 'Negotiation') {
    if (!hasCommittedQuote(opp.presalesData)) {
      return {
        allowed: false,
        reason: 'Cannot move to Negotiation: no proposal has been sent yet. Complete the GOM Calculator / quote and move through Proposal first.',
      };
    }
  }

  return { allowed: true };
}
