import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

/**
 * CR-08 — structured next action / decision tracking.
 *
 * Each opportunity keeps a list of actions (description, owner, committed due
 * date, status). History is retained: an action is completed, never overwritten.
 * "Overdue" is derived (Open + dueDate in the past), not stored.
 */

function actionView(a: any) {
  const now = Date.now();
  const isOverdue = a.status === 'Open' && a.dueDate ? new Date(a.dueDate).getTime() < now : false;
  return {
    id: a.id,
    description: a.description,
    owner: a.owner || '',
    dueDate: a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 10) : null,
    status: isOverdue ? 'Overdue' : a.status, // display status folds Overdue in
    rawStatus: a.status,
    isOverdue,
    completedAt: a.completedAt ? new Date(a.completedAt).toISOString().slice(0, 10) : null,
    createdAt: new Date(a.createdAt).toISOString(),
    createdById: a.createdById,
  };
}

// GET /api/opportunities/:id/actions — full action history, newest first.
export async function listOpportunityActions(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const actions = await prisma.opportunityAction.findMany({
      where: { opportunityId: id },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(actions.map(actionView));
  } catch (error) {
    console.error('List actions error:', error);
    res.status(500).json({ error: 'Failed to load actions' });
  }
}

// POST /api/opportunities/:id/actions — record a new next action.
export async function createOpportunityAction(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { description, owner, dueDate } = req.body || {};
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'An action description is required.' });
    }
    const opp = await prisma.opportunity.findUnique({ where: { id }, select: { id: true } });
    if (!opp) return res.status(404).json({ error: 'Opportunity not found' });

    const action = await prisma.opportunityAction.create({
      data: {
        description: description.trim(),
        owner: owner ? String(owner).trim() : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        opportunityId: id,
        createdById: req.user!.userId,
      },
    });
    res.status(201).json(actionView(action));
  } catch (error) {
    console.error('Create action error:', error);
    res.status(500).json({ error: 'Failed to create action' });
  }
}

// PATCH /api/opportunities/actions/:actionId — complete/reopen or edit an action.
export async function updateOpportunityAction(req: Request, res: Response) {
  try {
    const { actionId } = req.params;
    const { status, description, owner, dueDate } = req.body || {};
    const existing = await prisma.opportunityAction.findUnique({ where: { id: actionId } });
    if (!existing) return res.status(404).json({ error: 'Action not found' });

    const data: any = {};
    if (description !== undefined) data.description = String(description).trim();
    if (owner !== undefined) data.owner = owner ? String(owner).trim() : null;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (status !== undefined) {
      // Overdue is derived, never stored — only Open/Completed persist.
      const next = status === 'Completed' ? 'Completed' : 'Open';
      data.status = next;
      data.completedAt = next === 'Completed' ? new Date() : null;
    }

    const action = await prisma.opportunityAction.update({ where: { id: actionId }, data });
    res.json(actionView(action));
  } catch (error) {
    console.error('Update action error:', error);
    res.status(500).json({ error: 'Failed to update action' });
  }
}
