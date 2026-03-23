import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// GET /api/rate-cards — list active rate cards (all authenticated users)
export async function listRateCards(req: Request, res: Response) {
    const rateCards = await prisma.rateCard.findMany({
        where: { isActive: true },
        orderBy: [{ skill: 'asc' }, { experienceBand: 'asc' }],
    });
    res.json(rateCards);
}

// GET /api/admin/rate-cards — list ALL rate cards including inactive (admin)
export async function listAllRateCards(req: Request, res: Response) {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string || '').trim();

    const where: any = {};
    if (search) {
        where.OR = [
            { skill: { contains: search, mode: 'insensitive' } },
            { experienceBand: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { role: { contains: search, mode: 'insensitive' } },
        ];
    }

    const [rateCards, total] = await Promise.all([
        prisma.rateCard.findMany({
            where,
            orderBy: [{ skill: 'asc' }, { experienceBand: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.rateCard.count({ where }),
    ]);

    res.json({
        data: rateCards,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    });
}

// POST /api/admin/rate-cards — create rate card
export async function createRateCard(req: Request, res: Response) {
    const { code, role, skill, experienceBand, masterCtc, mercerCtc, copilot, existingCtc, maxCtc, ctc, category } = req.body;
    if (!code || !role || !category) {
        res.status(400).json({ error: 'code, role, and category are required.' });
        return;
    }

    const existing = await prisma.rateCard.findUnique({ where: { code } });
    if (existing) {
        res.status(409).json({ error: `Rate card with code "${code}" already exists.` });
        return;
    }

    const rateCard = await prisma.rateCard.create({
        data: {
            code,
            role,
            skill: skill || role,
            experienceBand: experienceBand || '',
            masterCtc: masterCtc != null ? Number(masterCtc) : 0,
            mercerCtc: mercerCtc != null ? Number(mercerCtc) : 0,
            copilot: copilot != null ? Number(copilot) : 0,
            existingCtc: existingCtc != null ? Number(existingCtc) : 0,
            maxCtc: maxCtc != null ? Number(maxCtc) : 0,
            ctc: ctc != null ? Number(ctc) : 0,
            category,
        },
    });
    res.status(201).json(rateCard);
}

// PATCH /api/admin/rate-cards/:id — update rate card
export async function updateRateCard(req: Request, res: Response) {
    const { id } = req.params;
    const { code, role, skill, experienceBand, masterCtc, mercerCtc, copilot, existingCtc, maxCtc, ctc, category, isActive } = req.body;

    const existing = await prisma.rateCard.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: 'Rate card not found.' });
        return;
    }

    // If code is changing, check uniqueness
    if (code && code !== existing.code) {
        const dup = await prisma.rateCard.findUnique({ where: { code } });
        if (dup) {
            res.status(409).json({ error: `Code "${code}" is already in use.` });
            return;
        }
    }

    const rateCard = await prisma.rateCard.update({
        where: { id },
        data: {
            ...(code !== undefined && { code }),
            ...(role !== undefined && { role }),
            ...(skill !== undefined && { skill }),
            ...(experienceBand !== undefined && { experienceBand }),
            ...(masterCtc !== undefined && { masterCtc: Number(masterCtc) }),
            ...(mercerCtc !== undefined && { mercerCtc: Number(mercerCtc) }),
            ...(copilot !== undefined && { copilot: Number(copilot) }),
            ...(existingCtc !== undefined && { existingCtc: Number(existingCtc) }),
            ...(maxCtc !== undefined && { maxCtc: Number(maxCtc) }),
            ...(ctc !== undefined && { ctc: Number(ctc) }),
            ...(category !== undefined && { category }),
            ...(isActive !== undefined && { isActive }),
        },
    });
    res.json(rateCard);
}

// DELETE /api/admin/rate-cards/:id — delete rate card
export async function deleteRateCard(req: Request, res: Response) {
    const { id } = req.params;

    const existing = await prisma.rateCard.findUnique({ where: { id } });
    if (!existing) {
        res.status(404).json({ error: 'Rate card not found.' });
        return;
    }

    await prisma.rateCard.delete({ where: { id } });
    res.json({ message: 'Rate card deleted.' });
}
