/**
 * Canonical role identity (frontend mirror of backend/src/lib/role-identity.ts).
 *
 * "Sales" -> "Business Development" and "Presales" -> "Solutions" were renamed for
 * the unified vocabulary, but the role name is still used as an identifier in
 * `activeRoleName === 'sales'` style checks and rides inside issued tokens. This
 * maps every accepted spelling (new display name or legacy) onto a stable
 * canonical key so those checks keep working without a forced re-login.
 */

/** Canonical role key -> the current display name shown in the UI. */
export const ROLE_DISPLAY_NAME: Record<string, string> = {
  sales: 'Business Development',
  presales: 'Solutions',
};

const ROLE_ALIASES: Record<string, string> = {
  sales: 'sales',
  'business development': 'sales',
  presales: 'presales',
  solutions: 'presales',
};

/** Resolve any role name (new, legacy, any case) to its canonical key. */
export function roleKey(name?: string | null): string {
  const raw = (name || '').trim().toLowerCase();
  return ROLE_ALIASES[raw] ?? raw;
}

/** Display name for a role, mapping the canonical key to its current label. */
export function roleDisplayName(name?: string | null): string {
  const raw = (name || '').trim();
  return ROLE_DISPLAY_NAME[roleKey(raw)] ?? raw;
}
