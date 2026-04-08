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

            // Revenue by Technology (Tech Stack) — split comma-separated into individual techs
            // Count all deals for pipeline revenue visibility
            const techStr = opp.technology || 'unknown';
            const techs = techStr.split(',').map((t: string) => t.trim()).filter(Boolean);
            for (const t of techs.length > 0 ? techs : ['unknown']) {
                revenueByTech[t] = (revenueByTech[t] || 0) + rev;
            }

            // Revenue by Client — only Closed Won deals
            if (stageName === 'Closed Won') {
                revenueByClient[clientName] = (revenueByClient[clientName] || 0) + rev;
            }

            // Revenue by Owner (Sales Rep) — only Closed Won deals
            if (stageName === 'Closed Won') {
                if (!revenueByOwner[ownerName]) {
                    revenueByOwner[ownerName] = { name: ownerName, revenue: 0 };
                }
                revenueByOwner[ownerName].revenue += rev;
            }

            // Count & Revenue by Sales Rep Name (explicit salesRepName field)
            const salesRepName = opp.salesRepName || ownerName;
            if (!countBySalesRep[salesRepName]) {
                countBySalesRep[salesRepName] = { name: salesRepName, total: 0, active: 0, won: 0 };
            }
            countBySalesRep[salesRepName].total += 1;
            if (stageName === 'Closed Won') countBySalesRep[salesRepName].won += 1;
            else if (stageName !== 'Closed Lost' && stageName !== 'Proposal Lost') countBySalesRep[salesRepName].active += 1;

            // Revenue by Sales Rep — only Closed Won deals
            if (stageName === 'Closed Won') {
                if (!revenueBySalesRep[salesRepName]) {
                    revenueBySalesRep[salesRepName] = { name: salesRepName, revenue: 0 };
                }
                revenueBySalesRep[salesRepName].revenue += rev;
            }
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
        const lostRevenue = lostOpps.reduce((sum, o) => sum + getRevenue(o), 0);
        const wonRevenue = closedRevenue;
        const totalOpportunities = opportunities.length;
        const winRate = closedOpps > 0 ? (wonOpps.length / closedOpps) * 100 : 0;
        const avgDealSize = totalOpportunities > 0 ? (projectedRevenue + closedRevenue) / totalOpportunities : 0;

        // Stage distribution with stage/count format (for mobile analytics)
        const stageDistribution = statusPieData.map(s => ({ stage: s.name, name: s.name, count: s.value, value: s.value }));

        // Revenue by technology with technology/revenue format
        const revenueByTechnology = techRevenueData.map(t => ({ technology: t.name, name: t.name, revenue: t.value, value: t.value }));

        // Revenue by client with client/revenue format
        const revenueByClientFull = clientRevenueData.map(c => ({ client: c.name, name: c.name, revenue: c.value, value: c.value }));

        // Pipeline stages breakdown
        const pipelineStages: Record<string, { stage: string; count: number; value: number }> = {};
        activeOpps.forEach(o => {
            const stageName = o.stage?.name || o.currentStage || 'Pipeline';
            if (!pipelineStages[stageName]) pipelineStages[stageName] = { stage: stageName, count: 0, value: 0 };
            pipelineStages[stageName].count += 1;
            pipelineStages[stageName].value += getRevenue(o);
        });
        const stageBreakdown = Object.values(pipelineStages).map(s => ({ stage: s.stage, name: s.stage, count: s.count, value: s.value }));

        // Pipeline by region
        const regionMap: Record<string, { name: string; count: number; value: number }> = {};
        activeOpps.forEach(o => {
            const region = o.region || 'Unknown';
            if (!regionMap[region]) regionMap[region] = { name: region, count: 0, value: 0 };
            regionMap[region].count += 1;
            regionMap[region].value += getRevenue(o);
        });
        const byRegion = Object.values(regionMap);

        // Pipeline by sales owner
        const salesOwnerMap: Record<string, { name: string; count: number; value: number }> = {};
        activeOpps.forEach(o => {
            const owner = o.salesRepName || o.owner?.name || 'Unassigned';
            if (!salesOwnerMap[owner]) salesOwnerMap[owner] = { name: owner, count: 0, value: 0 };
            salesOwnerMap[owner].count += 1;
            salesOwnerMap[owner].value += getRevenue(o);
        });
        const bySalesOwner = Object.values(salesOwnerMap);

        // Sales by sales owner (won/lost)
        const salesByOwner: Record<string, { name: string; wonRevenue: number; wonCount: number; lostCount: number }> = {};
        [...wonOpps, ...lostOpps].forEach(o => {
            const owner = o.salesRepName || o.owner?.name || 'Unassigned';
            if (!salesByOwner[owner]) salesByOwner[owner] = { name: owner, wonRevenue: 0, wonCount: 0, lostCount: 0 };
            const sn = o.stage?.name || o.currentStage;
            if (sn === 'Closed Won') { salesByOwner[owner].wonRevenue += getRevenue(o); salesByOwner[owner].wonCount += 1; }
            else { salesByOwner[owner].lostCount += 1; }
        });
        const salesBySalesOwner = Object.values(salesByOwner);

        // Loss reasons
        const lossReasonMap: Record<string, number> = {};
        lostOpps.forEach(o => {
            const reason = (o as any).lossReason || 'Unspecified';
            lossReasonMap[reason] = (lossReasonMap[reason] || 0) + 1;
        });
        const lossReasons = Object.entries(lossReasonMap).map(([reason, count]) => ({ reason, name: reason, count }));

        // Conversion funnel
        const pipelineCount = opportunities.length;
        const presalesCount = presalesOpps.length;
        const salesPhaseCount = opportunities.filter(o => {
            const sn = o.stage?.name || o.currentStage;
            return sn === 'Negotiation' || sn === 'Closed Won' || sn === 'Closed Lost' || sn === 'Proposal Lost';
        }).length;
        const pipelineToPresales = pipelineCount > 0 ? (presalesCount / pipelineCount) * 100 : 0;
        const presalesToSales = presalesCount > 0 ? (salesPhaseCount / presalesCount) * 100 : 0;
        const salesToWon = salesPhaseCount > 0 ? (wonOpps.length / salesPhaseCount) * 100 : 0;
        const overallConversion = pipelineCount > 0 ? (wonOpps.length / pipelineCount) * 100 : 0;

        // GOM metrics for presales
        let gomApprovedCount = 0;
        let gomPendingCount = 0;
        let totalGomPercent = 0;
        let gomEligibleCount = 0;
        presalesOpps.forEach(o => {
            if ((o as any).gomApproved) gomApprovedCount++;
            else gomPendingCount++;
            const pData = typeof o.presalesData === 'string' ? JSON.parse(o.presalesData) : o.presalesData;
            if (pData?.gomPercent != null) { totalGomPercent += Number(pData.gomPercent) || 0; gomEligibleCount++; }
        });
        const avgGomPercent = gomEligibleCount > 0 ? totalGomPercent / gomEligibleCount : 0;

        // Re-estimate iterations KPI
        const totalReEstimateCount = opportunities.reduce((sum, o) => sum + ((o as any).reEstimateCount || 0), 0);
        const oppsWithReEstimates = opportunities.filter(o => ((o as any).reEstimateCount || 0) > 0).length;
        const avgReEstimateIterations = oppsWithReEstimates > 0 ? totalReEstimateCount / oppsWithReEstimates : 0;

        // Manager response KPI: count of opportunities per manager, won/lost, revenue
        const managerStats: Record<string, { name: string; totalAssigned: number; wonCount: number; lostCount: number; totalRevenue: number; totalDays: number; closedCount: number }> = {};
        opportunities.forEach(o => {
            const mgr = (o as any).managerName;
            if (!mgr) return;
            if (!managerStats[mgr]) managerStats[mgr] = { name: mgr, totalAssigned: 0, wonCount: 0, lostCount: 0, totalRevenue: 0, totalDays: 0, closedCount: 0 };
            managerStats[mgr].totalAssigned += 1;
            const sn = o.stage?.name || o.currentStage || '';
            if (sn === 'Closed Won') {
                managerStats[mgr].wonCount += 1;
                managerStats[mgr].totalRevenue += getRevenue(o);
            } else if (sn === 'Closed Lost' || sn === 'Proposal Lost') {
                managerStats[mgr].lostCount += 1;
            }
            // Avg days to close for won deals
            if (sn === 'Closed Won' && o.actualCloseDate && o.createdAt) {
                const days = Math.max(0, Math.floor((new Date(o.actualCloseDate).getTime() - new Date(o.createdAt).getTime()) / (1000 * 3600 * 24)));
                managerStats[mgr].totalDays += days;
                managerStats[mgr].closedCount += 1;
            }
        });
        const managerKpiData = Object.values(managerStats).map(m => ({
            name: m.name,
            totalAssigned: m.totalAssigned,
            responded: m.wonCount,
            avgResponseDays: m.closedCount > 0 ? Math.round(m.totalDays / m.closedCount) : 0,
            wonCount: m.wonCount,
            lostCount: m.lostCount,
            totalRevenue: m.totalRevenue,
        }));

        res.json({
            dashboard: {
                revenueProjection: revenueChartData,
                countByStatus: statusPieData,
                countByClient: clientBarData,
                countByOwner: ownerBarData,
                revenueByTech: techRevenueData,
                revenueByClient: revenueByClientFull,
                revenueByOwner: ownerRevenueData,
                countBySalesRep: salesRepBarData,
                revenueBySalesRep: salesRepRevenueData,
                projectedRevenue,
                closedRevenue,
                // Additional fields for mobile analytics
                totalOpportunities,
                pipelineValue,
                winRate,
                avgDealSize,
                avgCloseDays: Math.round(avgTimeToClose),
                stageDistribution,
                revenueByTechnology,
                wonCount: wonOpps.length,
                lostCount: lostOpps.length,
                activeCount: activeOpps.length,
            },
            pipeline: {
                activeProjects: activeOpps.length,
                conversionRate,
                pipelineValue,
                weightedPipeline,
                avgDealValue,
                totalOpps: opportunities.length,
                // Additional fields for mobile analytics
                totalValue: pipelineValue,
                totalCount: activeOpps.length,
                avgProbability: activeOpps.length > 0 ? activeOpps.reduce((sum, o) => sum + getStageProbability(o.stage?.name || o.currentStage || 'Pipeline'), 0) / activeOpps.length : 0,
                weightedValue: weightedPipeline,
                stageBreakdown,
                stages: stageBreakdown,
                byRegion,
                bySalesOwner,
                byOwner: bySalesOwner,
            },
            presales: {
                proposalSuccessRate,
                totalPresalesOpps: presalesOpps.length,
                totalReEstimateCount,
                oppsWithReEstimates,
                avgReEstimateIterations,
                effortPerOpp,
                // Additional fields for mobile analytics
                successRate: proposalSuccessRate,
                reEstimateCount: totalReEstimateCount,
                totalCount: presalesOpps.length,
                avgGomPercent,
                avgReEstimates: avgReEstimateIterations,
                managerKpis: managerKpiData.map(m => ({
                    name: m.name,
                    managerName: m.name,
                    total: m.totalAssigned,
                    count: m.totalAssigned,
                    won: m.responded,
                    lost: m.totalAssigned - m.responded,
                    avgDays: m.avgResponseDays,
                    avgResponseDays: m.avgResponseDays,
                })),
                managers: managerKpiData,
                gomApprovedCount,
                gomPendingCount,
                targetGomPercent: 25,
            },
            sales: {
                avgTimeToClose,
                wonCount: wonOpps.length,
                lostCount: lostOpps.length,
                managerKpi: managerKpiData,
                // Additional fields for mobile analytics
                winRate,
                avgCloseDays: Math.round(avgTimeToClose),
                wonRevenue,
                lostRevenue,
                lossReasons,
                pipelineToPresales,
                presalesToSales,
                salesToWon,
                overallConversion,
                bySalesOwner: salesBySalesOwner,
            }
        });

    } catch (error) {
        console.error("BI API Error:", error);
        res.status(500).json({ error: 'Failed to fetch BI data' });
    }
}
