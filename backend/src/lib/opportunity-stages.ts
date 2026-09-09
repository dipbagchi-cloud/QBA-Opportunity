/**
 * CR-03 Phase 1 — canonical opportunity-stage registry (single source of truth).
 *
 * The app currently runs TWO overlapping stage vocabularies: the commercial
 * stage (Discovery / Qualification / Proposal / Negotiation / Closed Won /
 * Closed Lost — the `Stage` table and the Kanban) and an internal workflow-step
 * vocabulary (Pipeline / Presales / Sales / SOW) that leaks into `currentStage`
 * and analytics grouping. That duplication is the confusion CR-03 targets.
 *
 * This module introduces one place that knows the canonical stages, their order,
 * their closed/won semantics, and how every alternate token maps onto them. It
 * is deliberately BEHAVIOUR-NEUTRAL for Phase 1: it reproduces the mappings that
 * already exist in scattered literals; it does not change any of them. Later
 * phases route consumers through it and then collapse the second vocabulary.
 *
 * Pure and framework-free so it can be unit-tested in isolation.
 */

export interface StageMeta {
  /** Canonical commercial stage name. */
  name: string;
  /** 1-based ordering used by the Kanban and progression checks. */
  order: number;
  isClosed: boolean;
  isWon: boolean;
  /** Display/grouping bucket (see STAGE_DISPLAY_GROUP). */
  group: string;
}

export const CANONICAL_STAGES: StageMeta[] = [
  { name: 'Discovery',     order: 1, isClosed: false, isWon: false, group: 'Discovery' },
  { name: 'Qualification', order: 2, isClosed: false, isWon: false, group: 'Qualification' },
  { name: 'Proposal',      order: 3, isClosed: false, isWon: false, group: 'Proposal' },
  { name: 'Negotiation',   order: 4, isClosed: false, isWon: false, group: 'Negotiation' },
  { name: 'Closed Won',    order: 5, isClosed: true,  isWon: true,  group: 'Closed Won' },
  { name: 'Closed Lost',   order: 6, isClosed: true,  isWon: false, group: 'Closed Lost' },
];

export const CANONICAL_STAGE_NAMES: string[] = CANONICAL_STAGES.map((s) => s.name);

/**
 * Alternate tokens that resolve onto a canonical stage. This captures both the
 * internal workflow vocabulary (Pipeline/Presales/Sales) and the closed-state
 * variants seen across the code (Closed-Won, Delivered, Proposal Lost).
 *
 * NOTE: this is a NEW resolver not yet consumed by behaviour-sensitive code, so
 * it can be complete without changing anything. Existing closed-stage sets in
 * the controller / access layer are intentionally NOT rewired here — they even
 * disagree with each other (opportunities.controller omits 'Proposal Lost';
 * opportunity-access includes it), and reconciling them is a later, deliberate
 * phase, not a silent Phase-1 side effect.
 */
export const STAGE_ALIASES: Record<string, string> = {
  Pipeline: 'Discovery',
  Presales: 'Qualification',
  Sales: 'Proposal',
  'Closed-Won': 'Closed Won',
  Delivered: 'Closed Won',
  'Proposal Lost': 'Closed Lost',
};

const META_BY_NAME: Record<string, StageMeta> = Object.fromEntries(
  CANONICAL_STAGES.map((s) => [s.name, s]),
);

/**
 * The single closed-stage NAME set (canonical + aliases). Reconciles the drift
 * where the controller / opportunity-access carried 4 names (no 'Proposal Lost')
 * while opportunity-hot / analytics carried 5 — everyone now imports this. Any
 * name whose canonical stage is closed is included, so legacy variants are
 * treated as closed rather than leaking back into the open pipeline.
 */
export const CLOSED_STAGE_NAMES: string[] = [
  ...CANONICAL_STAGES.filter((s) => s.isClosed).map((s) => s.name),
  ...Object.keys(STAGE_ALIASES).filter((k) => META_BY_NAME[STAGE_ALIASES[k]]?.isClosed === true),
];

/** Resolve any known token to its canonical stage name; unknown input passes through. */
export function resolveCanonicalStage(name?: string | null): string {
  const raw = (name || '').trim();
  if (!raw) return '';
  if (META_BY_NAME[raw]) return raw;
  return STAGE_ALIASES[raw] || raw;
}

/** Canonical stage metadata for a name or alias, or undefined if unknown. */
export function getStageMeta(name?: string | null): StageMeta | undefined {
  return META_BY_NAME[resolveCanonicalStage(name)];
}

export function stageOrder(name?: string | null): number | undefined {
  return getStageMeta(name)?.order;
}

/**
 * The stage→display-group map analytics uses to bucket deals. CR-03 unified the
 * vocabulary, so every stage now groups under its own canonical name; the retired
 * workflow synonyms (Pipeline / Presales / Sales) still appear as KEYS so legacy
 * rows fall into the right bucket, but no group is labelled with the old words.
 */
export const STAGE_DISPLAY_GROUP: Record<string, string> = {
  Discovery: 'Discovery',
  Pipeline: 'Discovery',
  Qualification: 'Qualification',
  Presales: 'Qualification',
  Proposal: 'Proposal',
  Sales: 'Proposal',
  Negotiation: 'Negotiation',
  'Closed Won': 'Closed Won',
  'Closed Lost': 'Closed Lost',
};

/**
 * CR-03 (full stage machine) — the legal moves, declared once, in code.
 *
 * Structure (which moves are legal) lives here so the server is the authority
 * and a client cannot post an arbitrary jump; the WORDS shown for each stage are
 * configuration (Stage.label). Modelled on the arQuon rebuild's state machine:
 *  - Closed Lost is reachable from any open stage.
 *  - Proposal is reachable only from Qualification (the estimation/offer gate).
 *  - Send-back from Proposal or Negotiation to Qualification is the re-estimate
 *    path.
 *  - Closed Won is reached from Negotiation (a deliberate close, not a skip).
 */
const TRANSITIONS: Record<string, string[]> = {
  Discovery: ['Qualification', 'Closed Lost'],
  Qualification: ['Discovery', 'Proposal', 'Closed Lost'],
  Proposal: ['Qualification', 'Negotiation', 'Closed Lost'],
  // Send-back from Negotiation goes to Proposal — re-estimation happens in the
  // Proposal stage (where the offer/SOW is built), matching the sales flow.
  Negotiation: ['Proposal', 'Closed Won', 'Closed Lost'],
  'Closed Won': [],
  'Closed Lost': [],
};

/**
 * The forward chain of OPEN stages, in order. Qualification is a checkpoint on
 * the way to Proposal (the estimation/offer stage), so a single "advance" from
 * Discovery may pass through it. A forward move is any move up this chain.
 */
export const FORWARD_CHAIN = ['Discovery', 'Qualification', 'Proposal', 'Negotiation'];

/**
 * The stages a forward move must traverse (intermediate checkpoints + target),
 * e.g. Discovery -> Proposal returns ['Qualification', 'Proposal']. Empty when
 * `to` is not strictly forward of `from` on the chain (a lateral/backward/closed
 * move, which goes through TRANSITIONS instead).
 */
export function stagePath(from?: string | null, to?: string | null): string[] {
  const f = FORWARD_CHAIN.indexOf(resolveCanonicalStage(from));
  const t = FORWARD_CHAIN.indexOf(resolveCanonicalStage(to));
  if (f === -1 || t === -1 || t <= f) return [];
  return FORWARD_CHAIN.slice(f + 1, t + 1);
}

/** A forward advance up the chain (possibly across a checkpoint). */
export function isForwardChainMove(from?: string | null, to?: string | null): boolean {
  return stagePath(from, to).length > 0;
}

/** Legal destination stages from a given stage (canonical). Unknown → none. */
export function allowedTransitions(from?: string | null): string[] {
  return TRANSITIONS[resolveCanonicalStage(from)] ?? [];
}

/** True if moving from -> to is a legal transition (both resolved canonically). */
export function isLegalTransition(from?: string | null, to?: string | null): boolean {
  return allowedTransitions(from).includes(resolveCanonicalStage(to));
}

export type StageMoveKind = 'forward' | 'back' | 'lose' | 'win';

export interface StageMove {
  to: string;         // canonical target stage
  kind: StageMoveKind;
}

/**
 * The legal moves from a stage, tagged by the kind of act they are — advancing,
 * sending back for re-estimation, closing won, or closing lost — which a plain
 * dropdown flattens. Derived from TRANSITIONS so buttons can never offer a move
 * the server refuses.
 */
export function stageMoves(from?: string | null): StageMove[] {
  const fromOrder = getStageMeta(from)?.order ?? 0;
  return allowedTransitions(from).map((to): StageMove => {
    if (to === 'Closed Lost') return { to, kind: 'lose' };
    if (to === 'Closed Won') return { to, kind: 'win' };
    const toOrder = META_BY_NAME[to]?.order ?? 0;
    return { to, kind: toOrder < fromOrder ? 'back' : 'forward' };
  });
}
