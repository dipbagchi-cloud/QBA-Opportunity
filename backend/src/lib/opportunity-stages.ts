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
  { name: 'Discovery',     order: 1, isClosed: false, isWon: false, group: 'Pipeline' },
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
 * The exact stage→display-group map analytics uses today, lifted verbatim so it
 * lives in one place. Keys include the workflow-vocabulary synonyms (Pipeline /
 * Presales / Sales) because analytics currently receives both vocabularies.
 * This is a pure relocation — the object is identical to the inline one it
 * replaces (asserted in the tests).
 */
export const STAGE_DISPLAY_GROUP: Record<string, string> = {
  Discovery: 'Pipeline',
  Pipeline: 'Pipeline',
  Qualification: 'Qualification',
  Presales: 'Qualification',
  Proposal: 'Proposal',
  Sales: 'Proposal',
  Negotiation: 'Negotiation',
  'Closed Won': 'Closed Won',
  'Closed Lost': 'Closed Lost',
};
