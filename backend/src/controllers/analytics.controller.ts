import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Helper to calculate revenue based on status logic
function getRevenue(opp: any) {
    const status = opp.detailedStatus || opp.currentStage;

    if (['Pipeline', 'Presales', 'Cancelled', 'Lost', 'On Hold'].includes(opp.currentStage)) {
        const presales = typeof opp.presalesData === 'string' ? JSON.parse(opp.presalesData) : opp.presalesData;
        return presales?.projectedQuote || Number(opp.value) || 0;
    } else {
        const sales = typeof opp.salesData === 'string' ? JSON.parse(opp.salesData) : opp.salesData;
        return sales?.finalQuote || Number(opp.value) || 0;
    }
}

// GET /api/analytics
export async function getAnalytics(req: Request, res: Response) {
    try {
        const opportunities = await prisma.opportunity.findMany({
            include: { client: true, owner: true, type: true }
        });

        // 1. Opportunity Dashboard Data
        const revenueByMonth: any = {};
        const countByStatus: any = {};
        const countByClient: any = {};

        opportunities.forEach(opp => {
            const rev = getRevenue(opp);
            const date = new Date(opp.expectedCloseDate || opp.createdAt);
            const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });

            // Revenue Projection
            if (!revenueByMonth[monthKey]) revenueByMonth[monthKey] = { name: monthKey, proposed: 0, actual: 0 };

            if (opp.currentStage === 'Sales' && (opp.detailedStatus === 'Closed Won' || opp.detailedStatus === 'Moved to Sales')) {
                revenueByMonth[monthKey].actual += rev;
            } else {
                revenueByMonth[monthKey].proposed += rev;
            }

            // Count by Status
            const status = opp.currentStage;
            countByStatus[status] = (countByStatus[status] || 0) + 1;

            // Count by Client
            const clientName = opp.client?.name || 'Unknown';
            countByClient[clientName] = (countByClient[clientName] || 0) + 1;
        });

        const revenueChartData = Object.values(revenueByMonth);
        const statusPieData = Object.keys(countByStatus).map(k => ({ name: k, value: countByStatus[k] }));
        const clientBarData = Object.keys(countByClient).map(k => ({ name: k, value: countByClient[k] }));

        // 4. Pipeline Metrics
        const activeProjects = opportunities.filter(o =>
            !['Cancelled', 'On Hold', 'Moved to Presales'].includes(o.detailedStatus || '') &&
            !['Cancelled', 'On Hold'].includes(o.currentStage)
        ).length;

        const wonCount = opportunities.filter(o => o.detailedStatus === 'Closed Won').length;
        const conversionRate = opportunities.length > 0 ? (wonCount / opportunities.length) * 100 : 0;

        const pipelineValue = opportunities
            .filter(o => o.currentStage !== 'Cancelled')
            .reduce((sum, o) => sum + getRevenue(o), 0);

        const growthRate = opportunities.length > 0 ? pipelineValue / opportunities.length : 0;

        const uniqueClients = new Set(opportunities.map(o => o.clientId)).size;
        const avgDealSize = opportunities.length > 0 ? uniqueClients / opportunities.length : 0;
        const avgDealValue = opportunities.length > 0 ? pipelineValue / opportunities.length : 0;

        // 5. Pre-Sales Metrics
        const presalesOpps = opportunities.filter(o => o.currentStage === 'Presales' || o.presalesData);
        const movedToSales = presalesOpps.filter(o => o.detailedStatus === 'Moved to Sales' || o.currentStage === 'Sales').length;
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

        res.json({
            dashboard: {
                revenueProjection: revenueChartData,
                countByStatus: statusPieData,
                countByClient: clientBarData
            },
            pipeline: {
                activeProjects,
                conversionRate,
                pipelineValue,
                growthRate,
                avgDealValue,
                totalOpps: opportunities.length
            },
            presales: {
                proposalSuccessRate,
                effortPerOpp,
                totalPresalesOpps: presalesOpps.length
            },
            sales: {
                avgTimeToClose,
                wonCount,
                lostCount: opportunities.filter(o => o.currentStage === 'Cancelled' || o.detailedStatus === 'Closed Lost').length
            }
        });

    } catch (error) {
        console.error("BI API Error:", error);
        res.status(500).json({ error: 'Failed to fetch BI data' });
    }
}
