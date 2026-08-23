import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { canonicalBandKey, bandLabel, bandOrder } from '../lib/experience-bands';

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
    // status defaults to 'all' so existing callers behave exactly as before.
    const status = (req.query.status as string || 'all').toLowerCase();
    const batchId = (req.query.batchId as string || '').trim();

    const where: any = {};
    if (status === 'active') where.isActive = true;
    else if (status === 'archived') where.isActive = false;
    if (batchId) where.batchId = batchId;
    if (search) {
        where.OR = [
            { skill: { contains: search, mode: 'insensitive' } },
            { experienceBand: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { role: { contains: search, mode: 'insensitive' } },
        ];
    }

    const [rateCards, total, activeCount, archivedCount] = await Promise.all([
        prisma.rateCard.findMany({
            where,
            orderBy: [{ skill: 'asc' }, { experienceBand: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
            include: { batch: { select: { id: true, label: true, uploadedAt: true, isCurrent: true } } },
        }),
        prisma.rateCard.count({ where }),
        prisma.rateCard.count({ where: { isActive: true } }),
        prisma.rateCard.count({ where: { isActive: false } }),
    ]);

    res.json({
        data: rateCards,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        counts: { active: activeCount, archived: archivedCount, all: activeCount + archivedCount },
    });
}

// GET /api/admin/rate-cards/batches — every cost-card upload, newest first.
export async function listRateCardBatches(req: Request, res: Response) {
    const batches = await prisma.rateCardBatch.findMany({
        orderBy: { uploadedAt: 'desc' },
        include: { _count: { select: { rateCards: true } } },
    });

    // Per-batch active/archived split, so the UI can label a batch as the live
    // card or a superseded one without a query per row.
    const grouped = await prisma.rateCard.groupBy({
        by: ['batchId', 'isActive'],
        _count: { _all: true },
    });
    const split = new Map<string, { active: number; archived: number }>();
    for (const g of grouped) {
        if (!g.batchId) continue;
        const e = split.get(g.batchId) || { active: 0, archived: 0 };
        if (g.isActive) e.active = g._count._all; else e.archived = g._count._all;
        split.set(g.batchId, e);
    }

    const skillCounts = await prisma.rateCard.findMany({
        select: { batchId: true, skill: true },
        distinct: ['batchId', 'skill'],
    });
    const skills = new Map<string, number>();
    for (const s of skillCounts) {
        if (!s.batchId) continue;
        skills.set(s.batchId, (skills.get(s.batchId) || 0) + 1);
    }

    res.json(batches.map((b) => ({
        id: b.id,
        label: b.label,
        sourceFile: b.sourceFile,
        uploadedAt: b.uploadedAt,
        uploadedByName: b.uploadedByName,
        isCurrent: b.isCurrent,
        notes: b.notes,
        rows: b._count.rateCards,
        activeRows: split.get(b.id)?.active || 0,
        archivedRows: split.get(b.id)?.archived || 0,
        distinctSkills: skills.get(b.id) || 0,
    })));
}

/**
 * GET /api/admin/rate-cards/history — how each rate has moved across uploads.
 *
 * Keyed on skill + the CANONICAL experience band, because the bands are spelled
 * differently between generations ("00-02" in the April 2026 card, "0 - 2 Years"
 * in August). Without that normalisation the same rate would appear as two
 * unrelated rows and no change would ever be visible.
 */
export async function getRateCardHistory(req: Request, res: Response) {
    const search = (req.query.search as string || '').trim().toLowerCase();
    const changedOnly = req.query.changedOnly === 'true';

    const [rows, batches] = await Promise.all([
        prisma.rateCard.findMany({
            select: {
                skill: true, experienceBand: true, level: true, ctc: true,
                isActive: true, batchId: true, createdAt: true, code: true,
            },
        }),
        prisma.rateCardBatch.findMany({ orderBy: { uploadedAt: 'asc' } }),
    ]);

    const batchOrder = new Map(batches.map((b, i) => [b.id, i]));
    const byKey = new Map<string, any>();

    for (const r of rows) {
        if (search && !`${r.skill} ${r.experienceBand}`.toLowerCase().includes(search)) continue;
        const bandKey = canonicalBandKey(r.experienceBand);
        const key = `${r.skill.trim().toLowerCase()}|${bandKey ?? r.experienceBand}`;
        const entry = byKey.get(key) || {
            skill: r.skill,
            band: bandLabel(bandKey) || r.experienceBand,
            bandOrder: bandOrder(bandKey),
            points: [] as any[],
        };
        entry.points.push({
            batchId: r.batchId,
            batchLabel: batches.find((b) => b.id === r.batchId)?.label || 'Unbatched',
            uploadedAt: batches.find((b) => b.id === r.batchId)?.uploadedAt || r.createdAt,
            order: r.batchId ? (batchOrder.get(r.batchId) ?? -1) : -1,
            code: r.code,
            level: r.level,
            bandAsWritten: r.experienceBand,
            ctc: r.ctc,
            isActive: r.isActive,
        });
        byKey.set(key, entry);
    }

    const history = [...byKey.values()].map((e) => {
        e.points.sort((a: any, b: any) => a.order - b.order);
        const first = e.points[0];
        const last = e.points[e.points.length - 1];
        const changed = e.points.length > 1 && first.ctc !== last.ctc;
        return {
            ...e,
            versions: e.points.length,
            firstCtc: first.ctc,
            currentCtc: last.ctc,
            delta: e.points.length > 1 ? last.ctc - first.ctc : null,
            deltaPct: e.points.length > 1 && first.ctc
                ? Math.round(((last.ctc - first.ctc) / first.ctc) * 1000) / 10
                : null,
            changed,
        };
    })
    .filter((e) => (changedOnly ? e.changed : true))
    .sort((a, b) => a.skill.localeCompare(b.skill) || a.bandOrder - b.bandOrder);

    res.json({
        history,
        batches: batches.map((b) => ({ id: b.id, label: b.label, uploadedAt: b.uploadedAt, isCurrent: b.isCurrent })),
        totals: {
            tracked: history.length,
            withMultipleVersions: history.filter((h) => h.versions > 1).length,
            changed: history.filter((h) => h.changed).length,
        },
    });
}

// POST /api/admin/rate-cards — create rate card
export async function createRateCard(req: Request, res: Response) {
    const { code, role, skill, experienceBand, masterCtc, mercerCtc, copilot, existingCtc, maxCtc, ctc, ctcHyd, ctcPune, ctcNigeriaLagos, ctcLuxembourg, category } = req.body;
    if (!code || !role || !category) {
        res.status(400).json({ error: 'code, role, and category are required.' });
        return;
    }

    const existing = await prisma.rateCard.findUnique({ where: { code } });
    if (existing) {
        res.status(409).json({ error: `Rate card with code "${code}" already exists.` });
        return;
    }

    const rateCard = await (prisma.rateCard as any).create({
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
            ctcHyd: ctcHyd != null ? Number(ctcHyd) : 0,
            ctcPune: ctcPune != null ? Number(ctcPune) : 0,
            ctcNigeriaLagos: ctcNigeriaLagos != null ? Number(ctcNigeriaLagos) : 0,
            ctcLuxembourg: ctcLuxembourg != null ? Number(ctcLuxembourg) : 0,
            category,
        },
    });
    res.status(201).json(rateCard);
}

// PATCH /api/admin/rate-cards/:id — update rate card
export async function updateRateCard(req: Request, res: Response) {
    const { id } = req.params;
    const { code, role, skill, experienceBand, masterCtc, mercerCtc, copilot, existingCtc, maxCtc, ctc, ctcHyd, ctcPune, ctcNigeriaLagos, ctcLuxembourg, category, isActive } = req.body;

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

    const rateCard = await (prisma.rateCard as any).update({
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
            ...(ctcHyd !== undefined && { ctcHyd: Number(ctcHyd) }),
            ...(ctcPune !== undefined && { ctcPune: Number(ctcPune) }),
            ...(ctcNigeriaLagos !== undefined && { ctcNigeriaLagos: Number(ctcNigeriaLagos) }),
            ...(ctcLuxembourg !== undefined && { ctcLuxembourg: Number(ctcLuxembourg) }),
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
