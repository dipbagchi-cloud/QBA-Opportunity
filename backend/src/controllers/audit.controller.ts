import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// GET /api/admin/audit-logs
export async function listAuditLogs(req: Request, res: Response) {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
        const entity = (req.query.entity as string || '').trim();
        const entityId = (req.query.entityId as string || '').trim();
        const action = (req.query.action as string || '').trim();
        const userId = (req.query.userId as string || '').trim();
        const from = req.query.from as string;
        const to = req.query.to as string;
        const search = (req.query.search as string || '').trim();

        const where: any = {};

        if (entity) where.entity = entity;
        if (entityId) where.entityId = entityId;
        if (action) where.action = { contains: action, mode: 'insensitive' };
        if (userId) where.userId = userId;

        if (from || to) {
            where.timestamp = {};
            if (from) where.timestamp.gte = new Date(from);
            if (to) where.timestamp.lte = new Date(to);
        }

        if (search) {
            where.OR = [
                { action: { contains: search, mode: 'insensitive' } },
                { entity: { contains: search, mode: 'insensitive' } },
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, email: true } },
                },
                orderBy: { timestamp: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.auditLog.count({ where }),
        ]);

        res.json({
            data: logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Audit Log Error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
}

// GET /api/admin/audit-logs/entities  (distinct entity names for filter dropdown)
export async function listAuditEntities(req: Request, res: Response) {
    try {
        const entities = await prisma.auditLog.findMany({
            distinct: ['entity'],
            select: { entity: true },
            orderBy: { entity: 'asc' },
        });
        res.json(entities.map(e => e.entity));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch entities' });
    }
}

// GET /api/admin/audit-logs/actions  (distinct action names for filter dropdown)
export async function listAuditActions(req: Request, res: Response) {
    try {
        const actions = await prisma.auditLog.findMany({
            distinct: ['action'],
            select: { action: true },
            orderBy: { action: 'asc' },
        });
        res.json(actions.map(a => a.action));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch actions' });
    }
}
