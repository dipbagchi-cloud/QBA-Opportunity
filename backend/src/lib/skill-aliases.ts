/**
 * Skill aliases — reconciling two vocabularies that were meant to be one.
 *
 * The cost card and Q-People both claim to speak "Skillset GOM" and do not:
 * 126 distinct skills on the card, 27 in Q-People, 103 card skills that nobody
 * is tagged with. Where the difference is only a name — "UI/ UX/ WP" on the
 * card, "UI/UX development" in Q-People — exact-match candidate lookup finds
 * nobody, and the person actually doing the work simultaneously shows up as
 * "not in plan". One naming split, two wrong answers.
 *
 * This resolves both sides to a shared canonical key before they are compared.
 *
 * Why a table and not a similarity function
 * -----------------------------------------
 * Because similarity is wrong about half the time on this data. A scan of the
 * two vocabularies proposed "Power Builder" ~ "Power Automate", "Tableau ..." ~
 * "Power BI ...", and "Project System" — the SAP PS module — ~ "Project
 * Manager". Accepting those would price people at another skill's rate and
 * attribute their hours to the wrong plan line, which is worse than showing no
 * match at all. So every alias is a row somebody approved.
 */
import { prisma } from './prisma';
import { skillKey } from './qpeople';

/** Aliases change about as often as the cost card does. */
const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; map: Map<string, string> } | null = null;

/**
 * Build key -> canonical-key.
 *
 * Chains are followed (a->b, b->c leaves a and b both pointing at c) so an
 * alias added later against an existing alias still lands on one group, and a
 * cycle introduced by mistake terminates rather than hanging.
 */
async function build(): Promise<Map<string, string>> {
  const rows = await prisma.skillAlias
    .findMany({ where: { isActive: true }, select: { aliasKey: true, canonicalKey: true } })
    .catch(() => [] as { aliasKey: string; canonicalKey: string }[]);

  const direct = new Map<string, string>();
  for (const r of rows) {
    const a = r.aliasKey.trim();
    const c = r.canonicalKey.trim();
    if (!a || !c || a === c) continue;
    if (!direct.has(a)) direct.set(a, c);
  }

  const resolved = new Map<string, string>();
  for (const start of direct.keys()) {
    let cur = start;
    const seen = new Set<string>([cur]);
    while (direct.has(cur)) {
      const next = direct.get(cur)!;
      if (seen.has(next)) break;   // cycle — stop where we are
      cur = next;
      seen.add(cur);
    }
    resolved.set(start, cur);
  }
  return resolved;
}

export async function getSkillAliasMap(force = false): Promise<Map<string, string>> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const map = await build();
  cache = { at: Date.now(), map };
  return map;
}

/** Drop the cache after an edit so Settings changes take effect immediately. */
export function invalidateSkillAliasCache() {
  cache = null;
}

/**
 * Normalise a skill AND collapse it onto its alias group.
 *
 * Callers that compare two skills must both go through this, or the comparison
 * is only as good as the raw strings — which is the bug this exists to fix.
 */
export function canonicalSkillKey(
  value: string | null | undefined,
  aliases: Map<string, string>,
): string {
  const k = skillKey(value);
  if (!k) return '';
  return aliases.get(k) || k;
}
