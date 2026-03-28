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
        const countBySalesRep: any = {};
        const revenueBySalesRep: any = {};

        const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        opportunities.forEach(opp => {
            const rev = getRevenue(opp);
            const stageName = opp.stage?.name || opp.currentStage || 'Pipeline';
            const groupName = STAGE_GROUP[stageName] || stageName;

            // --- Revenue Projection: use estimation monthly breakdown when available ---
            const presales = typeof opp.presalesData === 'string' ? JSON.parse(opp.presalesData) : opp.presalesData;
            const resourceRows: any[] = presales?.resources || [];
            const estYear = presales?.selectedYear || new Date(opp.createdAt).getFullYear();
            let hasMonthlyData = false;

            if (resourceRows.length > 0) {
                // Compute revenue per month from estimation resources
                // Use dailyCost × (1 + markupPercent/100) for correct revenue
                // (stored dailyRate may be stale if markup was changed after resource was added)
                const markupPct = Number(presales?.markupPercent) || 0;
                const monthlyRevMap: Record<string, number> = {};
                for (const r of resourceRows) {
                    const efforts: Record<string, number> = r.monthlyEfforts || {};
                    const dailyCost = Number(r.dailyCost) || 0;
                    const dailyRate = dailyCost > 0
                        ? dailyCost * (1 + markupPct / 100)
                        : Number(r.dailyRate) || 0;
                    for (const [monthName, days] of Object.entries(efforts)) {
                        const d = Number(days) || 0;
                        if (d <= 0 || dailyRate <= 0) continue;
                        const mi = MONTH_NAMES.indexOf(monthName);
                        if (mi === -1) continue;
                        const key = `${MONTH_NAMES[mi]} ${estYear}`;
                        monthlyRevMap[key] = (monthlyRevMap[key] || 0) + d * dailyRate;
                        hasMonthlyData = true;
                    }
                }
                // Distribute into revenueByMonth buckets
                for (const [monthKey, monthRev] of Object.entries(monthlyRevMap)) {
                    if (!revenueByMonth[monthKey]) revenueByMonth[monthKey] = { name: monthKey, proposed: 0, actual: 0, lost: 0 };
                    if (stageName === 'Closed Won') revenueByMonth[monthKey].actual += monthRev;
                    else if (stageName === 'Closed Lost' || stageName === 'Proposal Lost') revenueByMonth[monthKey].lost += monthRev;
                    else revenueByMonth[monthKey].proposed += monthRev;
                }
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

            // Count & Revenue by Sales Rep Name (explicit salesRepName field)
            const salesRepName = opp.salesRepName || ownerName;
            if (!countBySalesRep[salesRepName]) {
                countBySalesRep[salesRepName] = { name: salesRepName, total: 0, active: 0, won: 0 };
            }
            countBySalesRep[salesRepName].total += 1;
            if (stageName === 'Closed Won') countBySalesRep[salesRepName].won += 1;
            else if (stageName !== 'Closed Lost' && stageName !== 'Proposal Lost') countBySalesRep[salesRepName].active += 1;

            if (!revenueBySalesRep[salesRepName]) {
                revenueBySalesRep[salesRepName] = { name: salesRepName, revenue: 0 };
            }
            revenueBySalesRep[salesRepName].revenue += rev;
        });

        // Sort revenue chart data chronologically
        const revenueChartData = Object.values(revenueByMonth).sort((a: any, b: any) => {
            const parse = (name: string) => {
                const [m, y] = name.split(' ');
                return new Date(`${m} 1, ${y}`).getTime();
            };
            return parse(a.name) - parse(b.name);
        });
        const statusPieData = Object.keys(countByStatus).map(k => ({ name: k, value: countByStatus[k] }));
        const clientBarData = Object.keys(countByClient).map(k => ({ name: k, value: countByClient[k] }));
        const ownerBarData = Object.values(countByOwner) as { name: string; total: number; active: number; won: number }[];
        const techRevenueData = Object.keys(revenueByTech).map(k => ({ name: k, value: revenueByTech[k] })).sort((a, b) => b.value - a.value);
        const clientRevenueData = Object.keys(revenueByClient).map(k => ({ name: k, value: revenueByClient[k] })).sort((a, b) => b.value - a.value).slice(0, 10);
        const ownerRevenueData = (Object.values(revenueByOwner) as { name: string; revenue: number }[]).sort((a, b) => b.revenue - a.revenue);
        const salesRepBarData = Object.values(countBySalesRep) as { name: string; total: number; active: number; won: number }[];
        const salesRepRevenueData = (Object.values(revenueBySalesRep) as { name: string; revenue: number }[]).sort((a, b) => b.revenue - a.revenue);

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

        // Re-estimate iterations KPI
        const totalReEstimateCount = opportunities.reduce((sum, o) => sum + ((o as any).reEstimateCount || 0), 0);
        const oppsWithReEstimates = opportunities.filter(o => ((o as any).reEstimateCount || 0) > 0).length;
        const avgReEstimateIterations = oppsWithReEstimates > 0 ? totalReEstimateCount / oppsWithReEstimates : 0;

        // Manager response KPI: count of opportunities assigned to each manager, avg lifecycle days
        const managerStats: Record<string, { name: string; totalAssigned: number; responded: number; totalDays: number; respondedWithDays: number }> = {};
        opportunities.forEach(o => {
            const mgr = (o as any).managerName;
            if (!mgr) return;
            if (!managerStats[mgr]) managerStats[mgr] = { name: mgr, totalAssigned: 0, responded: 0, totalDays: 0, respondedWithDays: 0 };
            managerStats[mgr].totalAssigned += 1;
            // Count as responded if past Qualification stage
            const sn = o.stage?.name || o.currentStage || '';
            const hasResponded = ['Proposal', 'Sales', 'Negotiation', 'Closed Won', 'Closed Lost', 'Proposal Lost'].includes(sn);
            if (hasResponded) {
                managerStats[mgr].responded += 1;
                // Use stage transition time: if opportunity has moved beyond Qualification, 
                // estimate response time from createdAt to updatedAt (best proxy without audit log query)
                if (o.updatedAt && o.createdAt) {
                    const days = Math.max(0, (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / (1000 * 3600 * 24));
                    managerStats[mgr].totalDays += days;
                    managerStats[mgr].respondedWithDays += 1;
                }
            }
        });
        const managerKpiData = Object.values(managerStats).map(m => ({
            name: m.name,
            totalAssigned: m.totalAssigned,
            responded: m.responded,
            avgResponseDays: m.respondedWithDays > 0 ? Math.round(m.totalDays / m.respondedWithDays) : 0,
        }));

        res.json({
            dashboard: {
                revenueProjection: revenueChartData,
                countByStatus: statusPieData,
                countByClient: clientBarData,
                countByOwner: ownerBarData,
                revenueByTech: techRevenueData,
                revenueByClient: clientRevenueData,
                revenueByOwner: ownerRevenueData,
                countBySalesRep: salesRepBarData,
                revenueBySalesRep: salesRepRevenueData,
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
                totalPresalesOpps: presalesOpps.length,
                totalReEstimateCount,
                oppsWithReEstimates,
                avgReEstimateIterations,
                effortPerOpp,
            },
            sales: {
                avgTimeToClose,
                wonCount: wonOpps.length,
                lostCount: lostOpps.length,
                managerKpi: managerKpiData,
            }
        });

    } catch (error) {
        console.error("BI API Error:", error);
        res.status(500).json({ error: 'Failed to fetch BI data' });
    }
}
