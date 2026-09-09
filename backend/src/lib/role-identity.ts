/**
 * Canonical role identity.
 *
 * Two RBAC roles were renamed for the unified vocabulary — "Sales" -> "Business
 * Development" and "Presales" -> "Solutions" — but the role name is also used as
 * an IDENTIFIER in dozens of `roleName === 'sales'` style checks across the code,
 * and it rides inside already-issued JWTs. Rather than change every literal (and
 * force every user to re-login), this maps every accepted spelling — the new
 * display name and the legacy one — onto a stable canonical key. Callers keep
 * comparing against the canonical 'sales' / 'presales' keys; only the DISPLAY
 * name in the database changed.
 *
 * Pure and framework-free so it can be unit-tested and shared shape-for-shape
 * with the frontend copy (agentic-crm/lib/roles.ts).
 */

/** Canonical role key -> the current display name shown in the UI. */
export const ROLE_DISPLAY_NAME: Record<string, string> = {
  sales: 'Business Development',
  presales: 'Solutions',
};

/** Every accepted spelling (lower-cased) -> canonical role key. */
const ROLE_ALIASES: Record<string, string> = {
  sales: 'sales',
  'business development': 'sales',
  presales: 'presales',
  solutions: 'presales',
};

/**
 * Resolve any role name (new display name, legacy name, any case) to its stable
 * canonical key. Unknown roles (admin, manager, read-only, …) pass through
 * lower-cased and unchanged.
 */
export function roleKey(name?: string | null): string {
  const raw = (name || '').trim().toLowerCase();
  return ROLE_ALIASES[raw] ?? raw;
}
