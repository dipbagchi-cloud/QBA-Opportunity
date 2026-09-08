import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

/**
 * CR-10 — dedicated RFP tracking, and CR-11 — the parent-child link to
 * opportunities. RFPs have hard submission dates, so the derived deadline
 * status (Overdue / Due Soon / On Track) and a "needs update" staleness flag
 * are the point of the feature.
 */

export const RFP_STATUSES = ['Identified', 'In Progress', 'Ready to Submit', 'Submitted', 'Won', 'Lost', 'No-Bid'];
const CLOSED_RFP_STATUSES = new Set(['Submitted', 'Won', 'Lost', 'No-Bid']);
const DUE_SOON_DAYS = 7;
const STALE_DAYS = 7;

function rfpView(r: any) {
  const now = Date.now();
  const due = r.submissionDueDate ? new Date(r.submissionDueDate).getTime() : null;
  const daysToDue = due != null ? Math.ceil((due - now) / 86_400_000) : null;
  const isClosed = CLOSED_RFP_STATUSES.has(r.status);
  let deadlineStatus: 'Overdue' | 'Due Soon' | 'On Track' | 'No Date' | 'Closed';
  if (isClosed) deadlineStatus = 'Closed';
  else if (daysToDue == null) deadlineStatus = 'No Date';
  else if (daysToDue < 0) deadlineStatus = 'Overdue';
  else if (daysToDue <= DUE_SOON_DAYS) deadlineStatus = 'Due Soon';
  else deadlineStatus = 'On Track';
  // "Records lacking required progress updates" — open RFP untouched for a week.
  const stale = !isClosed && (now - new Date(r.updatedAt).getTime()) > STALE_DAYS * 86_400_000;
  const iso = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  return {
    id: r.id,
    reference: r.reference,
    customer: r.customer,
    owner: r.owner || '',
    status: r.status,
    receivedDate: iso(r.receivedDate),
    submissionDueDate: iso(r.submissionDueDate),
    internalTargetDate: iso(r.internalTargetDate),
    clarificationDate: iso(r.clarificationDate),
    preBidDate: iso(r.preBidDate),
    notes: r.notes || '',
    isArchived: r.isArchived === true,
    daysToDue,
    deadlineStatus,
    stale,
    updatedAt: new Date(r.updatedAt).toISOString(),
    opportunities: (r.opportunities || []).map((o: any) => ({
      id: o.id, title: o.title, stage: o.stage?.name || o.currentStage, value: o.value != null ? Number(o.value) : null,
    })),
  };
}

// GET /api/rfps?active=true — list RFPs (active view excludes closed/archived).
export async function listRfps(req: Request, res: Response) {
  try {
    const activeOnly = String(req.query.active || '') === 'true';
    const where: any = {};
    if (activeOnly) {
      where.isArchived = false;
      where.status = { notIn: Array.from(CLOSED_RFP_STATUSES) };
    }
    const rfps = await prisma.rfp.findMany({
      where,
      orderBy: [{ submissionDueDate: 'asc' }, { createdAt: 'desc' }],
      include: { opportunities: { select: { id: true, title: true, value: true, currentStage: true, stage: { select: { name: true } } } } },
    });
    res.json(rfps.map(rfpView));
  } catch (error) {
    console.error('List RFPs error:', error);
    res.status(500).json({ error: 'Failed to load RFPs' });
  }
}

// GET /api/rfps/:id
export async function getRfp(req: Request, res: Response) {
  try {
    const rfp = await prisma.rfp.findUnique({
      where: { id: req.params.id },
      include: { opportunities: { select: { id: true, title: true, value: true, currentStage: true, stage: { select: { name: true } } } } },
    });
    if (!rfp) return res.status(404).json({ error: 'RFP not found' });
    res.json(rfpView(rfp));
  } catch (error) {
    console.error('Get RFP error:', error);
    res.status(500).json({ error: 'Failed to load RFP' });
  }
}

const parseDate = (v: any) => (v ? new Date(v) : null);

// POST /api/rfps
export async function createRfp(req: Request, res: Response) {
  try {
    const b = req.body || {};
    if (!b.reference || !String(b.reference).trim()) return res.status(400).json({ error: 'RFP reference is required.' });
    if (!b.customer || !String(b.customer).trim()) return res.status(400).json({ error: 'Customer is required.' });
    const rfp = await prisma.rfp.create({
      data: {
        reference: String(b.reference).trim(),
        customer: String(b.customer).trim(),
        owner: b.owner ? String(b.owner).trim() : null,
        status: RFP_STATUSES.includes(b.status) ? b.status : 'Identified',
        receivedDate: parseDate(b.receivedDate),
        submissionDueDate: parseDate(b.submissionDueDate),
        internalTargetDate: parseDate(b.internalTargetDate),
        clarificationDate: parseDate(b.clarificationDate),
        preBidDate: parseDate(b.preBidDate),
        notes: b.notes ? String(b.notes) : null,
        createdById: req.user!.userId,
      },
      include: { opportunities: { select: { id: true, title: true, value: true, currentStage: true, stage: { select: { name: true } } } } },
    });
    res.status(201).json(rfpView(rfp));
  } catch (error) {
    console.error('Create RFP error:', error);
    res.status(500).json({ error: 'Failed to create RFP' });
  }
}

// PATCH /api/rfps/:id
export async function updateRfp(req: Request, res: Response) {
  try {
    const b = req.body || {};
    const existing = await prisma.rfp.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'RFP not found' });
    const data: any = {};
    if (b.reference !== undefined) data.reference = String(b.reference).trim();
    if (b.customer !== undefined) data.customer = String(b.customer).trim();
    if (b.owner !== undefined) data.owner = b.owner ? String(b.owner).trim() : null;
    if (b.status !== undefined && RFP_STATUSES.includes(b.status)) data.status = b.status;
    if (b.notes !== undefined) data.notes = b.notes ? String(b.notes) : null;
    if (b.isArchived !== undefined) data.isArchived = !!b.isArchived;
    for (const f of ['receivedDate', 'submissionDueDate', 'internalTargetDate', 'clarificationDate', 'preBidDate']) {
      if (b[f] !== undefined) data[f] = parseDate(b[f]);
    }
    const rfp = await prisma.rfp.update({
      where: { id: req.params.id }, data,
      include: { opportunities: { select: { id: true, title: true, value: true, currentStage: true, stage: { select: { name: true } } } } },
    });
    res.json(rfpView(rfp));
  } catch (error) {
    console.error('Update RFP error:', error);
    res.status(500).json({ error: 'Failed to update RFP' });
  }
}
