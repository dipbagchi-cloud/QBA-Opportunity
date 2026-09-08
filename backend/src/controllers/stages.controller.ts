import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { stageMoves, CANONICAL_STAGE_NAMES } from '../lib/opportunity-stages';

/**
 * CR-03 full stage machine — stage configuration.
 *
 * The stage STRUCTURE (which stages, their order, which are closed/won, and the
 * legal moves) is code (lib/opportunity-stages.ts). The WORDS are configuration:
 * an admin may relabel a stage and change its probability/colour, and the label
 * drives the UI while `name` stays the stable identity.
 */

function stageView(s: any) {
  return {
    name: s.name,                 // stable identity
    label: s.label || s.name,     // editable display word
    order: s.order,
    probability: s.probability,
    color: s.color,
    isClosed: s.isClosed,
    isWon: s.isWon,
    moves: stageMoves(s.name),    // legal moves from here (kind-tagged)
  };
}

// GET /api/stages — the configured stage model + legal moves (any authenticated user).
export async function getStages(_req: Request, res: Response) {
  try {
    const stages = await prisma.stage.findMany({ orderBy: { order: 'asc' } });
    res.json(stages.map(stageView));
  } catch (error) {
    console.error('Get stages error:', error);
    res.status(500).json({ error: 'Failed to load stages' });
  }
}

// PATCH /api/admin/stages/:name — relabel / retune a stage (settings:manage).
export async function updateStage(req: Request, res: Response) {
  try {
    const { name } = req.params;
    if (!CANONICAL_STAGE_NAMES.includes(name)) {
      return res.status(400).json({ error: 'Unknown stage.' });
    }
    const b = req.body || {};
    const data: any = {};
    if (b.label !== undefined) data.label = b.label ? String(b.label).trim() : null;
    if (b.probability !== undefined) {
      const p = Number(b.probability);
      if (Number.isFinite(p) && p >= 0 && p <= 100) data.probability = Math.round(p);
    }
    if (b.color !== undefined && typeof b.color === 'string') data.color = b.color;

    const stage = await prisma.stage.update({ where: { name }, data });

    await prisma.auditLog.create({
      data: { entity: 'Stage', entityId: stage.id, action: 'UPDATE_STAGE', userId: req.user!.userId, changes: data },
    });
    res.json(stageView(stage));
  } catch (error) {
    console.error('Update stage error:', error);
    res.status(500).json({ error: 'Failed to update stage' });
  }
}
