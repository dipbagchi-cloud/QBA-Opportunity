/**
 * Admin CRUD for skill aliases, plus the suggestion feed that makes the table
 * fillable without anyone hand-diffing two vocabularies.
 *
 * The division of labour is deliberate: the system PROPOSES, a person DECIDES.
 * A similarity pass over the cost card and Q-People produced roughly 50% false
 * positives on real data — "Power Builder" against "Power Automate", "Project
 * System" (the SAP PS module) against "Project Manager" — and a wrong alias is
 * worse than no match, because it silently prices someone at another skill's
 * rate and books their hours to the wrong plan line. So suggestions are ranked
 * and shown with the evidence (how many people carry each tag), and nothing is
 * written until an admin accepts it.
 */
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { getEmployeesResolved, skillKey } from '../lib/qpeople';
import { invalidateSkillAliasCache } from '../lib/skill-aliases';
import { recordAudit } from '../lib/audit';

/** Suggestions below this are noise; above it, still a coin flip — hence review. */
const SUGGEST_FLOOR = 0.45;

function tokens(k: string) {
  return k.split(' ').filter(Boolean);
}

/**
 * Similarity over normalised keys.
 *
 * Short tokens are KEPT: "ui", "ux", "wp" and "bi" carry the meaning in this
 * taxonomy, and dropping them (the obvious first implementation) makes the
 * function blind to exactly the "UI/ UX/ WP" case it exists to catch.
 */
function similarity(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const jaccard = inter / (A.size + B.size - inter);

  // A shared leading run matters more than raw overlap here, because the two
  // vocabularies mostly differ by a long qualifying suffix:
  // "power bi" vs "power bi along with business analysis ...".
  const ta = tokens(a);
  const tb = tokens(b);
  let pre = 0;
  while (pre < ta.length && pre < tb.length && ta[pre] === tb[pre]) pre++;
  const prefix = pre / Math.min(ta.length, tb.length);

  return Math.max(jaccard, prefix * 0.9);
}

/** GET /api/admin/skill-aliases */
export async function listSkillAliases(_req: Request, res: Response) {
  try {
    const rows = await prisma.skillAlias.findMany({ orderBy: [{ isActive: 'desc' }, { aliasLabel: 'asc' }] });
    return res.json({ rows });
  } catch (err) {
    console.error('List skill aliases error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}

/**
 * GET /api/admin/skill-aliases/suggestions
 *
 * Cost-card skills nobody is tagged with, each with the closest thing people
 * ARE tagged with. Already-aliased pairs drop out.
 */
export async function getSkillAliasSuggestions(_req: Request, res: Response) {
  try {
    const [employees, cards, existing] = await Promise.all([
      getEmployeesResolved(),
      prisma.rateCard.findMany({ select: { skill: true } }),
      prisma.skillAlias.findMany({ select: { aliasKey: true } }),
    ]);

    const aliased = new Set(existing.map((e) => e.aliasKey));

    const empKeys = new Map<string, { label: string; count: number }>();
    let untagged = 0;
    const active = employees.filter((e) => e.status === 'Active');
    for (const e of active) {
      const k = skillKey(e.skillsetGom);
      if (!k) { untagged++; continue; }
      if (!empKeys.has(k)) empKeys.set(k, { label: e.skillsetGom as string, count: 0 });
      empKeys.get(k)!.count++;
    }

    const cardKeys = new Map<string, string>();
    for (const c of cards) {
      const k = skillKey(c.skill);
      if (k && !cardKeys.has(k)) cardKeys.set(k, c.skill);
    }

    const unmatched = [...cardKeys.keys()].filter((k) => !empKeys.has(k) && !aliased.has(k));

    const suggestions: any[] = [];
    for (const ck of unmatched) {
      let best: { key: string; label: string; count: number; score: number } | null = null;
      for (const [ek, ev] of empKeys) {
        const s = similarity(ck, ek);
        if (s >= SUGGEST_FLOOR && (!best || s > best.score)) {
          best = { key: ek, label: ev.label, count: ev.count, score: s };
        }
      }
      if (best) {
        suggestions.push({
          aliasKey: ck, aliasLabel: cardKeys.get(ck),
          canonicalKey: best.key, canonicalLabel: best.label,
          peopleTagged: best.count, score: Math.round(best.score * 100) / 100,
        });
      }
    }
    suggestions.sort((a, b) => b.score - a.score);

    return res.json({
      suggestions,
      coverage: {
        activeEmployees: active.length,
        untaggedEmployees: untagged,
        qpeopleSkills: empKeys.size,
        rateCardSkills: cardKeys.size,
        rateCardSkillsWithNobody: [...cardKeys.keys()].filter((k) => !empKeys.has(k)).length,
      },
    });
  } catch (err) {
    console.error('Skill alias suggestions error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}

/** POST /api/admin/skill-aliases */
export async function createSkillAlias(req: Request, res: Response) {
  try {
    const { aliasLabel, canonicalLabel, note } = req.body || {};
    if (!aliasLabel || !canonicalLabel) {
      return res.status(400).json({ error: 'Both skills are required' });
    }
    const aliasKey = skillKey(aliasLabel);
    const canonicalKey = skillKey(canonicalLabel);
    if (!aliasKey || !canonicalKey) {
      return res.status(400).json({ error: 'Those skill names normalise to nothing' });
    }
    if (aliasKey === canonicalKey) {
      return res.status(400).json({ error: 'Those two names are already identical once normalised' });
    }

    // Who approved this matters — an alias is a judgement call, not a fact.
    const userId = req.user?.userId ?? null;
    const who = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null)
      : null;

    const row = await prisma.skillAlias.upsert({
      where: { aliasKey_canonicalKey: { aliasKey, canonicalKey } },
      create: {
        aliasKey, canonicalKey,
        aliasLabel: String(aliasLabel).trim(),
        canonicalLabel: String(canonicalLabel).trim(),
        note: note ? String(note).trim() : null,
        createdById: userId,
        createdByName: who?.name ?? req.user?.email ?? null,
      },
      update: { isActive: true, note: note ? String(note).trim() : null },
    });

    invalidateSkillAliasCache();
    await recordAudit({
      req, entity: 'SkillAlias', entityId: row.id, action: 'SKILL_ALIAS_CREATE',
      changes: { alias: row.aliasLabel, canonical: row.canonicalLabel },
    }).catch(() => { /* audit must never block the write */ });

    return res.json(row);
  } catch (err) {
    console.error('Create skill alias error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}

/** PATCH /api/admin/skill-aliases/:id — enable/disable or re-note. */
export async function updateSkillAlias(req: Request, res: Response) {
  try {
    const { isActive, note } = req.body || {};
    const data: any = {};
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (note !== undefined) data.note = note ? String(note).trim() : null;
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update' });

    const row = await prisma.skillAlias.update({ where: { id: req.params.id }, data });
    invalidateSkillAliasCache();
    await recordAudit({
      req, entity: 'SkillAlias', entityId: row.id, action: 'SKILL_ALIAS_UPDATE',
      changes: { alias: row.aliasLabel, canonical: row.canonicalLabel, isActive: row.isActive },
    }).catch(() => { /* ignore */ });
    return res.json(row);
  } catch (err) {
    console.error('Update skill alias error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}

/** DELETE /api/admin/skill-aliases/:id */
export async function deleteSkillAlias(req: Request, res: Response) {
  try {
    const row = await prisma.skillAlias.delete({ where: { id: req.params.id } });
    invalidateSkillAliasCache();
    await recordAudit({
      req, entity: 'SkillAlias', entityId: row.id, action: 'SKILL_ALIAS_DELETE',
      changes: { alias: row.aliasLabel, canonical: row.canonicalLabel },
    }).catch(() => { /* ignore */ });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete skill alias error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}
