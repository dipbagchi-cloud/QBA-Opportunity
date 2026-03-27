import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Stage-to-display mapping for grouping
const STAGE_GROUP: Record<string, string> = {
    'Discovery': 'Pipeline',
    'Pipeline': 'Pipeline',
    'Qualification': 'Qualification',
    'Presales': 'Qualification',
    'Proposal': 'Proposal',
    'Sales': 'Proposal',
    'Negotiation': 'Negotiation',
    'Closed Won': 'Closed Won',
    'Closed Lost': 'Closed Lost',
    'Proposal Lost': 'Proposal Lost',
};

// Dynamic probability based on stage
function getStageProbability(stageName: string): number {
    switch (stageName) {
        case 'Discovery': case 'Pipeline': return 10;
        case 'Qualification': case 'Presales': return 25;
        case 'Proposal': case 'Sales': return 50;
        case 'Negotiation': return 75;
        case 'Closed Won': return 100;
        case 'Closed Lost': return 0;
        case 'Proposal Lost': return 0;
        default: return 10;
    }
}

// Helper to calculate revenue based on status logic
function getRevenue(opp: any) {
    const val = Number(opp.value) || 0;
    const presales = typeof opp.presalesData === 'string' ? JSON.parse(opp.presalesData) : opp.presalesData;
    const sales = typeof opp.salesData === 'string' ? JSON.parse(opp.salesData) : opp.salesData;
    return sales?.finalQuote || presales?.projectedQuote || val;
}

// GET /api/analytics
export async function getAnalytics(req: Request, res: Response) {
    try {
        const opportunities = await prisma.opportunity.findMany({
            include: { client: true, owner: true, type: true, stage: true }
        });

        // 1. Opportunity Dashboard Data
        const revenueByMonth: any = {};
        const countByStatus: any = {};
        const countByClient: any = {};
        const countByOwner: any = {};
        const revenueByTech: any = {};
        const revenueByClient: any = {};
        const revenueByOwner: any = {};

        opportunities.forEach(opp => {
            const rev = getRevenue(opp);
            const date = new Date(opp.expectedCloseDate || opp.createdAt);
            const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
            const stageName = opp.stage?.name || opp.currentStage || 'Pipeline';
            const groupName = STAGE_GROUP[stageName] || stageName;

            // Revenue Projection
            if (!revenueByMonth[monthKey]) revenueByMonth[monthKey] = { name: monthKey, proposed: 0, actual: 0, lost: 0 };

            if (stageName === 'Closed Won') {
                revenueByMonth[monthKey].actual += rev;
            } else if (stageName === 'Closed Lost' || stageName === 'Proposal Lost') {
                revenueByMonth[monthKey].lost += rev;
            } else {
                revenueByMonth[monthKey].proposed += rev;
            }

            // Count by Stage (grouped)
            countByStatus[groupName] = (countByStatus[groupName] || 0) + 1;

            // Count by Client
            const clientName = opp.client?.name || 'Unknown';
            countByClient[clientName] = (countByClient[clientName] || 0) + 1;

            // Count by Owner (Salesperson)
            const ownerName = opp.owner?.name || 'Unassigned';
            if (!countByOwner[ownerName]) {
                countByOwner[ownerName] = { name: ownerName, total: 0, active: 0, won: 0 };
            }
            countByOwner[ownerName].total += 1;
            if (stageName === 'Closed Won') countByOwner[ownerName].won += 1;
            else if (stageName !== 'Closed Lost' && stageName !== 'Proposal Lost') countByOwner[ownerName].active += 1;

            // Revenue by Technology (Tech Stack)
            const tech = opp.technology || 'unknown';
            revenueByTech[tech] = (revenueByTech[tech] || 0) + rev;

            // Revenue by Client
            revenueByClient[clientName] = (revenueByClient[clientName] || 0) + rev;

            // Revenue by Owner (Sales Rep)
            if (!revenueByOwner[ownerName]) {
                revenueByOwner[ownerName] = { name: ownerName, revenue: 0 };
            }
            revenueByOwner[ownerName].revenue += rev;
        });

        const revenueChartData = Object.values(revenueByMonth);
        const statusPieData = Object.keys(countByStatus).map(k => ({ name: k, value: countByStatus[k] }));
        const clientBarData = Object.keys(countByClient).map(k => ({ name: k, value: countByClient[k] }));
        const ownerBarData = Object.values(countByOwner) as { name: string; total: number; active: number; won: number }[];
        const techRevenueData = Object.keys(revenueByTech).map(k => ({ name: k, value: revenueByTech[k] })).sort((a, b) => b.value - a.value);
        const clientRevenueData = Object.keys(revenueByClient).map(k => ({ name: k, value: revenueByClient[k] })).sort((a, b) => b.value - a.value).slice(0, 10);
        const ownerRevenueData = (Object.values(revenueByOwner) as { name: string; revenue: number }[]).sort((a, b) => b.revenue - a.revenue);

        // 4. Pipeline Metrics
        const activeOpps = opportunities.filter(o => {
            const sn = o.stage?.name || o.currentStage;
            return sn !== 'Closed Won' && sn !== 'Closed Lost' && sn !== 'Proposal Lost';
        });

        const wonOpps = opportunities.filter(o => {
            const sn = o.stage?.name || o.currentStage;
            return sn === 'Closed Won';
        });
        const lostOpps = opportunities.filter(o => {
            const sn = o.stage?.name || o.currentStage;
            return sn === 'Closed Lost' || sn === 'Proposal Lost';
        });
        const closedOpps = wonOpps.length + lostOpps.length;
        const conversionRate = closedOpps > 0 ? (wonOpps.length / closedOpps) * 100 : 0;

        const pipelineValue = activeOpps.reduce((sum, o) => sum + getRevenue(o), 0);
        const avgDealValue = activeOpps.length > 0 ? pipelineValue / activeOpps.length : 0;

        // Weighted pipeline value (probability × value)
        const weightedPipeline = activeOpps.reduce((sum, o) => {
            const prob = getStageProbability(o.stage?.name || o.currentStage || 'Pipeline');
            return sum + (getRevenue(o) * prob / 100);
        }, 0);

        // 5. Pre-Sales Metrics
        const presalesOpps = opportunities.filter(o => {
            const sn = o.stage?.name || o.currentStage;
            return sn === 'Qualification' || sn === 'Presales' || sn === 'Proposal' || sn === 'Sales' || sn === 'Negotiation' || sn === 'Closed Won';
        });
        const movedToSales = presalesOpps.filter(o => {
            const sn = o.stage?.name || o.currentStage;
            return sn === 'Proposal' || sn === 'Sales' || sn === 'Negotiation' || sn === 'Closed Won';
        }).length;
        const proposalSuccessRate = presalesOpps.length > 0 ? (movedToSales / presalesOpps.length) * 100 : 0;

        // Effort per Opportunity
        let totalEffortCost = 0;
        presalesOpps.forEach(o => {
            const pData = typeof o.presalesData === 'string' ? JSON.parse(o.presalesData) : o.presalesData;
            if (pData?.estimatedCost) totalEffortCost += pData.estimatedCost;
        });
        const effortPerOpp = presalesOpps.length > 0 ? totalEffortCost / presalesOpps.length : 0;

        // 6. Sales Conversion
        let totalDays = 0;
        let closedCount = 0;
        opportunities.forEach(o => {
            if (o.actualCloseDate && o.createdAt) {
                const diff = new Date(o.actualCloseDate).getTime() - new Date(o.createdAt).getTime();
                totalDays += diff / (1000 * 3600 * 24);
                closedCount++;
            }
        });
        const avgTimeToClose = closedCount > 0 ? totalDays / closedCount : 0;

        // Total revenue computations
        const projectedRevenue = activeOpps.reduce((sum, o) => sum + getRevenue(o), 0);
        const closedRevenue = wonOpps.reduce((sum, o) => sum + getRevenue(o), 0);

        res.json({
            dashboard: {
                revenueProjection: revenueChartData,
                countByStatus: statusPieData,
                countByClient: clientBarData,
                countByOwner: ownerBarData,
                revenueByTech: techRevenueData,
                revenueByClient: clientRevenueData,
                revenueByOwner: ownerRevenueData,
                projectedRevenue,
                closedRevenue,
            },
            pipeline: {
                activeProjects: activeOpps.length,
                conversionRate,
                pipelineValue,
                weightedPipeline,
                avgDealValue,
                totalOpps: opportunities.length
            },
            presales: {
                proposalSuccessRate,
                totalPresalesOpps: presalesOpps.length
            },
            sales: {
                avgTimeToClose,
                wonCount: wonOpps.length,
                lostCount: lostOpps.length
            }
        });

    } catch (error) {
        console.error("BI API Error:", error);
        res.status(500).json({ error: 'Failed to fetch BI data' });
    }
}
