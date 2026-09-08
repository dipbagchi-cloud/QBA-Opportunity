/**
 * CR-07 — opportunity lifecycle status, independent of the commercial stage.
 *
 * The review found On Hold, future requirements, Lost and to-be-archived deals
 * tangled together (all leaning on `detailedStatus`, which also carries workflow
 * states like "Sent for Re-estimate"). This module gives a clean, separate
 * lifecycle axis: Active / On Hold / Future-Deferred / Won / Lost / Archived.
 *
 * Won, Lost and Archived are FACTS derived from the stage (via the CR-03
 * registry) and the archived flag — they can't be set by hand. On Hold and
 * Future/Deferred are governance choices, persisted in `lifecycleStatus` as a
 * manual override. When no override is set, the status derives from the record.
 *
 * Pure and framework-free so it can be unit-tested in isolation.
 */

import { getStageMeta } from './opportunity-stages';

export type LifecycleStatus =
  | 'Active'
  | 'On Hold'
  | 'Future/Deferred'
  | 'Won'
  | 'Lost'
  | 'Archived';

export const LIFECYCLE_STATUSES: LifecycleStatus[] = [
  'Active', 'On Hold', 'Future/Deferred', 'Won', 'Lost', 'Archived',
];

/** The only values a user may persist to `lifecycleStatus` — the derived facts
 *  (Won/Lost/Archived) are never stored by hand. 'Active' clears the override. */
export const MANUAL_LIFECYCLE_OVERRIDES: LifecycleStatus[] = ['Active', 'On Hold', 'Future/Deferred'];

export interface LifecycleInput {
  stage?: { name?: string | null } | null;
  currentStage?: string | null;
  isArchived?: boolean | null;
  detailedStatus?: string | null;
  /** Governance override: 'On Hold' | 'Future/Deferred' | 'Active' | null. */
  lifecycleStatus?: string | null;
}

/** The single source of truth for a deal's lifecycle status. */
export function deriveLifecycleStatus(opp: LifecycleInput): LifecycleStatus {
  // Facts first — these outrank any stored override.
  if (opp.isArchived === true) return 'Archived';
  const meta = getStageMeta(opp.stage?.name || opp.currentStage);
  if (meta?.isClosed) return meta.isWon ? 'Won' : 'Lost';

  // Governance overrides for open deals.
  const manual = (opp.lifecycleStatus || '').trim();
  if (manual === 'Future/Deferred') return 'Future/Deferred';
  if (manual === 'On Hold' || (opp.detailedStatus || '').trim() === 'On Hold') return 'On Hold';

  return 'Active';
}

/**
 * Whether a deal belongs in the active/potential pipeline. Lost, Won, Archived
 * and Future/Deferred are excluded (Future is retained but is not a current
 * pursuit); On Hold stays in — it is a paused pursuit, not a dead one.
 */
export function isActivePipeline(opp: LifecycleInput): boolean {
  const s = deriveLifecycleStatus(opp);
  return s === 'Active' || s === 'On Hold';
}

/** Validate + normalize a user-supplied override; returns null to clear it. */
export function normalizeLifecycleOverride(value: unknown): string | null {
  const v = String(value ?? '').trim();
  if (!v || v === 'Active') return null; // 'Active' means "no override"
  return (MANUAL_LIFECYCLE_OVERRIDES as string[]).includes(v) ? v : null;
}
