import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// GET /api/public/stats — unauthenticated landing page stats
export async function getPublicStats(req: Request, res: Response) {
    try {
        const opportunities = await prisma.opportunity.findMany({
            include: { stage: true, client: true },
        });

        const totalOpportunities = opportunities.length;
        const uniqueClients = new Set(opportunities.map(o => o.clientId)).size;

        const wonOpps = opportunities.filter(o => {
            const sn = o.stage?.name || o.currentStage;
            return sn === 'Closed Won';
        });
        const lostOpps = opportunities.filter(o => {
            const sn = o.stage?.name || o.currentStage;
            return sn === 'Closed Lost' || sn === 'Proposal Lost';
        });
        const closedCount = wonOpps.length + lostOpps.length;
        const winRate = closedCount > 0 ? Math.round((wonOpps.length / closedCount) * 100) : 0;

        const totalPipelineValue = opportunities.reduce((sum, o) => sum + (Number(o.value) || 0), 0);

        const totalUsers = await prisma.user.count();

        res.json({
            totalOpportunities,
            uniqueClients,
            winRate,
            totalPipelineValue,
            totalUsers,
            closedWon: wonOpps.length,
        });
    } catch (error) {
        console.error('Public stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
}
