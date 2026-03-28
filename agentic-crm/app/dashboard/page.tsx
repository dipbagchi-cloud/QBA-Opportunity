"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    DollarSign,
    Target,
    Activity,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Briefcase,
    Loader2,
} from "lucide-react";
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { API_URL, getAuthHeaders } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useCurrency } from "@/components/providers/currency-provider";
import { ExpandableCard, DrillDownConfig } from "@/components/ui/drill-down-modal";

const STAGE_COLORS: Record<string, string> = {
    Pipeline: "bg-blue-50 text-blue-700 border-blue-200",
    Presales: "bg-amber-50 text-amber-700 border-amber-200",
    Sales: "bg-purple-50 text-purple-700 border-purple-200",
    Qualification: "bg-amber-50 text-amber-700 border-amber-200",
    Proposal: "bg-purple-50 text-purple-700 border-purple-200",
    Negotiation: "bg-indigo-50 text-indigo-700 border-indigo-200",
    "Closed Won": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Closed-Won": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Closed Lost": "bg-red-50 text-red-700 border-red-200",
    "Proposal Lost": "bg-rose-50 text-rose-700 border-rose-200",
    Delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Discovery: "bg-sky-50 text-sky-700 border-sky-200",
    Project: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const STAGE_DISPLAY: Record<string, string> = {
    Pipeline: "Pipeline",
    Qualification: "Presales",
    Presales: "Presales",
    Proposal: "Sales",
    Sales: "Sales",
    Negotiation: "Sales",
    "Closed Won": "Project",
    "Closed-Won": "Project",
    "Closed Lost": "Lost",
    "Proposal Lost": "Proposal Lost",
    Delivered: "Project",
    Discovery: "Pipeline",
};

// Consistent colors for pie chart stages
const PIE_COLOR_MAP: Record<string, string> = {
    Pipeline: "#6366f1",
    Qualification: "#f59e0b",
    Proposal: "#10b981",
    Negotiation: "#8b5cf6",
    "Closed Won": "#ef4444",
    "Closed Lost": "#94a3b8",
    "Proposal Lost": "#e11d48",
};
const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#94a3b8", "#06b6d4", "#ec4899"];

interface Analytics {
    dashboard: {
        revenueProjection: { name: string; proposed: number; actual: number; lost: number }[];
        countByStatus: { name: string; value: number }[];
        countByClient: { name: string; value: number }[];
        countByOwner: { name: string; total: number; active: number; won: number }[];
        countBySalesRep?: { name: string; total: number; active: number; won: number }[];
        revenueByTech: { name: string; value: number }[];
        revenueByClient: { name: string; value: number }[];
        revenueByOwner: { name: string; revenue: number }[];
        revenueBySalesRep?: { name: string; revenue: number }[];
        projectedRevenue: number;
        closedRevenue: number;
    };
    pipeline: {
        activeProjects: number;
        conversionRate: number;
        pipelineValue: number;
        avgDealValue: number;
        totalOpps: number;
    };
    presales: {
        proposalSuccessRate: number;
        totalPresalesOpps: number;
        totalReEstimateCount?: number;
        oppsWithReEstimates?: number;
        avgReEstimateIterations?: number;
    };
    sales: {
        avgTimeToClose: number;
        wonCount: number;
        lostCount: number;
        managerKpi?: { name: string; totalAssigned: number; responded: number; avgResponseDays: number }[];
    };
}

interface Opportunity {
    id: string;
    name: string;
    client: string;
    value: number;
    stage: string;
    currentStage: string;
    probability: number;
    lastActivity: string;
    owner: string;
    salesRepName?: string;
    managerName?: string;
    technology?: string;
    region?: string;
    expectedCloseDate?: string;
    status: string;
    healthScore: number;
    daysInStage: number;
    isStalled: boolean;
}

export default function DashboardPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const { format: fmtCurrency, symbol: cSym, convert: convertCurrency } = useCurrency();
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        const fetchData = async () => {
            const headers = getAuthHeaders();
            try {
                const [analyticsRes, oppsRes] = await Promise.all([
                    fetch(`${API_URL}/api/analytics`, { headers }),
                    fetch(`${API_URL}/api/opportunities?limit=100`, { headers }),
                ]);
                if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
                if (oppsRes.ok) {
                    const oppsJson = await oppsRes.json();
                    // API now returns paginated { data, total, ... } — extract the array
                    setOpportunities(Array.isArray(oppsJson) ? oppsJson : (oppsJson.data ?? []));
                }
            } catch (err) {
                console.error("Dashboard fetch error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    const pipeline = analytics?.pipeline;
    const sales = analytics?.sales;
    const presales = analytics?.presales;

    const stalledDeals = opportunities.filter(o => o.isStalled);
    const criticalDeals = opportunities.filter(o => o.status === "critical");
    const healthyDeals = opportunities.filter(o => o.status === "healthy");
    const atRiskDeals = opportunities.filter(o => o.status === "at-risk");

    const insights: { text: string; type: "warning" | "success" | "neutral" }[] = [];

    // Stalled deal warnings
    stalledDeals.slice(0, 2).forEach(d => {
        insights.push({ text: `'${d.name}' (${d.client}) has been idle for ${d.daysInStage} days. Consider following up.`, type: "warning" });
    });

    // High-value deals progressing well
    const highValueHealthy = healthyDeals.filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    highValueHealthy.slice(0, 1).forEach(d => {
        insights.push({ text: `'${d.name}' (${d.client}) is progressing well — ${fmtCurrency(d.value, { compact: true })} at ${d.probability}% probability.`, type: "success" });
    });

    // Critical deals needing attention
    criticalDeals.slice(0, 2).forEach(d => {
        insights.push({ text: `'${d.name}' needs attention — health score is ${d.healthScore}%. Last activity: ${d.lastActivity}.`, type: "warning" });
    });

    // At-risk deals
    if (atRiskDeals.length > 0 && insights.length < 5) {
        insights.push({ text: `${atRiskDeals.length} deal${atRiskDeals.length > 1 ? 's are' : ' is'} at risk. Review pipeline to prevent slippage.`, type: "warning" });
    }

    // Summary insights
    if (pipeline && pipeline.totalOpps > 0 && insights.length < 5) {
        insights.push({ text: `Pipeline has ${pipeline.totalOpps} opportunities worth ${fmtCurrency(pipeline.pipelineValue || 0, { compact: true })} total.`, type: "neutral" });
    }

    if (sales && sales.wonCount > 0 && insights.length < 5) {
        insights.push({ text: `${sales.wonCount} deal${sales.wonCount > 1 ? 's' : ''} won with ${(pipeline?.conversionRate || 0).toFixed(1)}% conversion rate.`, type: "success" });
    }

    if (insights.length === 0) {
        insights.push({ text: "All opportunities are on track. No immediate actions required.", type: "neutral" });
    }

    const recentOpps = opportunities.slice(0, 8);
    const statusData = analytics?.dashboard.countByStatus || [];
    const revenueData = analytics?.dashboard.revenueProjection || [];
    const ownerData = analytics?.dashboard.countBySalesRep || analytics?.dashboard.countByOwner || [];
    const techRevenueData = analytics?.dashboard.revenueByTech || [];
    const clientRevenueData = analytics?.dashboard.revenueByClient || [];
    const clientCountData = analytics?.dashboard.countByClient || [];
    const ownerRevenueData = analytics?.dashboard.revenueBySalesRep || analytics?.dashboard.revenueByOwner || [];
    const projectedRevenue = analytics?.dashboard.projectedRevenue || 0;
    const closedRevenue = analytics?.dashboard.closedRevenue || 0;

    const stats = [
        {
            title: "Projected Revenue",
            value: fmtCurrency(projectedRevenue, { compact: true }),
            subtitle: `${pipeline?.totalOpps || 0} opportunities`,
            icon: DollarSign,
            iconBg: "bg-indigo-100",
            iconColor: "text-indigo-600",
        },
        {
            title: "Closed Revenue",
            value: fmtCurrency(closedRevenue, { compact: true }),
            subtitle: `${sales?.wonCount || 0} deals won`,
            icon: CheckCircle2,
            iconBg: "bg-emerald-100",
            iconColor: "text-emerald-600",
        },
        {
            title: "Opportunities",
            value: String(pipeline?.totalOpps || 0),
            subtitle: `${pipeline?.activeProjects || 0} active`,
            icon: Briefcase,
            iconBg: "bg-blue-100",
            iconColor: "text-blue-600",
        },
        {
            title: "Pipeline Value",
            value: fmtCurrency(pipeline?.pipelineValue || 0, { compact: true }),
            subtitle: `Avg ${fmtCurrency(pipeline?.avgDealValue || 0, { compact: true })} per deal`,
            icon: Target,
            iconBg: "bg-amber-100",
            iconColor: "text-amber-600",
        },
        {
            title: "Win Rate",
            value: `${(pipeline?.conversionRate || 0).toFixed(1)}%`,
            subtitle: `${sales?.wonCount || 0} won / ${sales?.lostCount || 0} lost`,
            icon: Activity,
            iconBg: "bg-purple-100",
            iconColor: "text-purple-600",
        },
        {
            title: "Avg. Close Time",
            value: `${(sales?.avgTimeToClose || 0).toFixed(0)}d`,
            subtitle: `Presales success ${(presales?.proposalSuccessRate || 0).toFixed(0)}%`,
            icon: Clock,
            iconBg: "bg-rose-100",
            iconColor: "text-rose-600",
        },
        {
            title: "Re-estimate Iterations",
            value: String(presales?.totalReEstimateCount || 0),
            subtitle: `${presales?.oppsWithReEstimates || 0} opps, avg ${(presales?.avgReEstimateIterations || 0).toFixed(1)} rounds`,
            icon: AlertTriangle,
            iconBg: "bg-orange-100",
            iconColor: "text-orange-600",
        },
    ];

    /* ── Drill-down configs for each visual ────────────────────────── */

    const revenueDrill: DrillDownConfig = {
        title: "Revenue Projection – All Opportunities",
        columns: [
            { key: "name", label: "Opportunity", format: "text" },
            { key: "client", label: "Client", format: "text" },
            { key: "value", label: "Value", format: "currency" },
            { key: "currentStage", label: "Stage", format: "text" },
            { key: "probability", label: "Probability", format: "percent" },
            { key: "expectedCloseDate", label: "Expected Close", format: "text" },
            { key: "owner", label: "Owner", format: "text" },
            { key: "salesRepName", label: "Sales Rep", format: "text" },
        ],
        data: opportunities,
        chart: (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => fmtCurrency(v, { compact: true })} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [fmtCurrency(v, { compact: true }), undefined]} />
                    <Legend />
                    <Bar dataKey="proposed" name="Proposed" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="actual" name="Won" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="lost" name="Lost" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        ),
    };

    const stageDrill: DrillDownConfig = {
        title: "Opportunities by Stage",
        columns: [
            { key: "name", label: "Opportunity", format: "text" },
            { key: "client", label: "Client", format: "text" },
            { key: "currentStage", label: "Stage", format: "text" },
            { key: "value", label: "Value", format: "currency" },
            { key: "owner", label: "Owner", format: "text" },
            { key: "salesRepName", label: "Sales Rep", format: "text" },
            { key: "healthScore", label: "Health %", format: "number" },
        ],
        data: [...opportunities].sort((a, b) => {
            const order = ['Pipeline', 'Discovery', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed-Won', 'Closed Lost', 'Proposal Lost'];
            return (order.indexOf(a.currentStage) - order.indexOf(b.currentStage));
        }),
        chart: (
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={80} outerRadius={150} dataKey="value" paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                        {statusData.map((entry, idx) => (
                            <Cell key={idx} fill={PIE_COLOR_MAP[entry.name] || PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        ),
    };

    const salespersonDrill: DrillDownConfig = {
        title: "Opportunities by Salesperson",
        columns: [
            { key: "name", label: "Opportunity", format: "text" },
            { key: "client", label: "Client", format: "text" },
            { key: "value", label: "Value", format: "currency" },
            { key: "currentStage", label: "Stage", format: "text" },
            { key: "owner", label: "Owner", format: "text" },
            { key: "salesRepName", label: "Sales Rep", format: "text" },
            { key: "probability", label: "Probability", format: "percent" },
        ],
        data: opportunities,
        chart: (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ownerData} layout="vertical" margin={{ left: 10, right: 20 }} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} width={120} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="active" name="Active" fill="#6366f1" stackId="a" />
                    <Bar dataKey="won" name="Won" fill="#10b981" stackId="a" radius={[0, 3, 3, 0]} />
                </BarChart>
            </ResponsiveContainer>
        ),
    };

    const techRevDrill: DrillDownConfig = {
        title: "Revenue by Tech Stack",
        columns: [
            { key: "name", label: "Opportunity", format: "text" },
            { key: "client", label: "Client", format: "text" },
            { key: "technology", label: "Technology", format: "text" },
            { key: "value", label: "Value", format: "currency" },
            { key: "currentStage", label: "Stage", format: "text" },
            { key: "owner", label: "Owner", format: "text" },
        ],
        data: opportunities.filter(o => o.technology),
        chart: (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={techRevenueData} layout="vertical" margin={{ left: 10, right: 20 }} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={(v) => fmtCurrency(v, { compact: true })} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} width={100} />
                    <Tooltip formatter={(v: number) => [fmtCurrency(v, { compact: true }), 'Revenue']} />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 3, 3, 0]} />
                </BarChart>
            </ResponsiveContainer>
        ),
    };

    const clientRevDrill: DrillDownConfig = {
        title: "Revenue by Client",
        columns: [
            { key: "name", label: "Opportunity", format: "text" },
            { key: "client", label: "Client", format: "text" },
            { key: "value", label: "Value", format: "currency" },
            { key: "currentStage", label: "Stage", format: "text" },
            { key: "owner", label: "Owner", format: "text" },
            { key: "salesRepName", label: "Sales Rep", format: "text" },
        ],
        data: [...opportunities].sort((a, b) => a.client.localeCompare(b.client)),
        chart: (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientRevenueData} layout="vertical" margin={{ left: 10, right: 20 }} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={(v) => fmtCurrency(v, { compact: true })} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} width={120} />
                    <Tooltip formatter={(v: number) => [fmtCurrency(v, { compact: true }), 'Revenue']} />
                    <Bar dataKey="value" fill="#ec4899" radius={[0, 3, 3, 0]} />
                </BarChart>
            </ResponsiveContainer>
        ),
    };

    const salesRepRevDrill: DrillDownConfig = {
        title: "Revenue by Sales Rep",
        columns: [
            { key: "name", label: "Opportunity", format: "text" },
            { key: "client", label: "Client", format: "text" },
            { key: "value", label: "Value", format: "currency" },
            { key: "currentStage", label: "Stage", format: "text" },
            { key: "salesRepName", label: "Sales Rep", format: "text" },
            { key: "probability", label: "Probability", format: "percent" },
        ],
        data: opportunities,
        chart: (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ownerRevenueData} layout="vertical" margin={{ left: 10, right: 20 }} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={(v) => fmtCurrency(v, { compact: true })} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} width={120} />
                    <Tooltip formatter={(v: number) => [fmtCurrency(v, { compact: true }), 'Revenue']} />
                    <Bar dataKey="revenue" fill="#0ea5e9" radius={[0, 3, 3, 0]} />
                </BarChart>
            </ResponsiveContainer>
        ),
    };

    const clientCountDrill: DrillDownConfig = {
        title: "Opportunities by Client",
        columns: [
            { key: "name", label: "Opportunity", format: "text" },
            { key: "client", label: "Client", format: "text" },
            { key: "value", label: "Value", format: "currency" },
            { key: "currentStage", label: "Stage", format: "text" },
            { key: "owner", label: "Owner", format: "text" },
            { key: "healthScore", label: "Health %", format: "number" },
        ],
        data: [...opportunities].sort((a, b) => a.client.localeCompare(b.client)),
        chart: (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientCountData} layout="vertical" margin={{ left: 10, right: 20 }} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="value" name="Count" fill="#f59e0b" radius={[0, 3, 3, 0]} />
                </BarChart>
            </ResponsiveContainer>
        ),
    };

    const recentOppsDrill: DrillDownConfig = {
        title: "Recent Opportunities",
        columns: [
            { key: "name", label: "Opportunity", format: "text" },
            { key: "client", label: "Client", format: "text" },
            { key: "value", label: "Value", format: "currency" },
            { key: "currentStage", label: "Stage", format: "text" },
            { key: "healthScore", label: "Health %", format: "number" },
            { key: "owner", label: "Owner", format: "text" },
            { key: "salesRepName", label: "Sales Rep", format: "text" },
            { key: "managerName", label: "Manager", format: "text" },
            { key: "daysInStage", label: "Days in Stage", format: "number" },
        ],
        data: opportunities,
    };

    const managerKpiDrill: DrillDownConfig = {
        title: "Manager Response KPI",
        columns: [
            { key: "name", label: "Manager", format: "text" },
            { key: "totalAssigned", label: "Assigned", format: "number" },
            { key: "responded", label: "Acted On", format: "number" },
            { key: "avgResponseDays", label: "Avg Response Days", format: "number" },
        ],
        data: sales?.managerKpi || [],
    };

    const insightsDrill: DrillDownConfig = {
        title: "Pipeline Insights & Deal Health",
        columns: [
            { key: "name", label: "Opportunity", format: "text" },
            { key: "client", label: "Client", format: "text" },
            { key: "value", label: "Value", format: "currency" },
            { key: "status", label: "Health Status", format: "text" },
            { key: "healthScore", label: "Health %", format: "number" },
            { key: "daysInStage", label: "Days in Stage", format: "number" },
            { key: "currentStage", label: "Stage", format: "text" },
            { key: "isStalled", label: "Stalled", format: "text" },
        ],
        data: opportunities.map(o => ({ ...o, isStalled: o.isStalled ? "Yes" : "No" })),
    };

    // Build stat drill-downs
    const statDrills: DrillDownConfig[] = [
        { // Projected Revenue
            title: "Projected Revenue – Active Opportunities",
            columns: [
                { key: "name", label: "Opportunity", format: "text" },
                { key: "client", label: "Client", format: "text" },
                { key: "value", label: "Value", format: "currency" },
                { key: "currentStage", label: "Stage", format: "text" },
                { key: "probability", label: "Probability", format: "percent" },
                { key: "expectedCloseDate", label: "Expected Close", format: "text" },
                { key: "owner", label: "Owner", format: "text" },
                { key: "salesRepName", label: "Sales Rep", format: "text" },
            ],
            data: opportunities.filter(o => o.status !== "won" && o.status !== "lost"),
        },
        { // Closed Revenue
            title: "Closed Revenue – Won Deals",
            columns: [
                { key: "name", label: "Opportunity", format: "text" },
                { key: "client", label: "Client", format: "text" },
                { key: "value", label: "Value", format: "currency" },
                { key: "currentStage", label: "Stage", format: "text" },
                { key: "owner", label: "Owner", format: "text" },
                { key: "salesRepName", label: "Sales Rep", format: "text" },
                { key: "technology", label: "Technology", format: "text" },
            ],
            data: opportunities.filter(o => {
                const s = STAGE_DISPLAY[o.currentStage] || o.currentStage;
                return s === 'Project' || o.currentStage === 'Closed Won' || o.currentStage === 'Closed-Won';
            }),
        },
        { // Opportunities
            title: "All Opportunities",
            columns: [
                { key: "name", label: "Opportunity", format: "text" },
                { key: "client", label: "Client", format: "text" },
                { key: "value", label: "Value", format: "currency" },
                { key: "currentStage", label: "Stage", format: "text" },
                { key: "status", label: "Health", format: "text" },
                { key: "owner", label: "Owner", format: "text" },
                { key: "salesRepName", label: "Sales Rep", format: "text" },
                { key: "technology", label: "Technology", format: "text" },
                { key: "region", label: "Region", format: "text" },
            ],
            data: opportunities,
        },
        { // Pipeline Value
            title: "Pipeline Value – Active Deals",
            columns: [
                { key: "name", label: "Opportunity", format: "text" },
                { key: "client", label: "Client", format: "text" },
                { key: "value", label: "Value", format: "currency" },
                { key: "currentStage", label: "Stage", format: "text" },
                { key: "probability", label: "Probability", format: "percent" },
                { key: "owner", label: "Owner", format: "text" },
                { key: "expectedCloseDate", label: "Expected Close", format: "text" },
            ],
            data: opportunities.filter(o => {
                const s = o.currentStage;
                return s !== 'Closed Won' && s !== 'Closed-Won' && s !== 'Closed Lost' && s !== 'Proposal Lost';
            }),
        },
        { // Win Rate
            title: "Win/Loss Analysis",
            columns: [
                { key: "name", label: "Opportunity", format: "text" },
                { key: "client", label: "Client", format: "text" },
                { key: "value", label: "Value", format: "currency" },
                { key: "currentStage", label: "Stage", format: "text" },
                { key: "owner", label: "Owner", format: "text" },
                { key: "salesRepName", label: "Sales Rep", format: "text" },
                { key: "technology", label: "Technology", format: "text" },
            ],
            data: opportunities.filter(o => ['Closed Won', 'Closed-Won', 'Closed Lost', 'Proposal Lost'].includes(o.currentStage)),
        },
        { // Avg Close Time
            title: "Deals – Cycle Time",
            columns: [
                { key: "name", label: "Opportunity", format: "text" },
                { key: "client", label: "Client", format: "text" },
                { key: "value", label: "Value", format: "currency" },
                { key: "currentStage", label: "Stage", format: "text" },
                { key: "daysInStage", label: "Days in Stage", format: "number" },
                { key: "lastActivity", label: "Last Activity", format: "text" },
                { key: "status", label: "Health", format: "text" },
            ],
            data: opportunities,
        },
        { // Re-estimate Iterations
            title: "Re-estimation Details",
            columns: [
                { key: "name", label: "Opportunity", format: "text" },
                { key: "client", label: "Client", format: "text" },
                { key: "value", label: "Value", format: "currency" },
                { key: "currentStage", label: "Stage", format: "text" },
                { key: "owner", label: "Owner", format: "text" },
            ],
            data: opportunities,
        },
    ];

    return (
        <div className="space-y-3 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-base font-semibold text-slate-900">Dashboard</h1>
                    <p className="text-slate-400 text-xs">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Click any card to expand &amp; download.</p>
                </div>
            </div>

            {/* Stats Grid — tight 7-col, each expandable */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {stats.map((stat, idx) => (
                    <ExpandableCard key={idx} drillConfig={statDrills[idx]} className="bg-white rounded-lg px-3 py-2.5 border border-slate-100 hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className={`p-1 rounded ${stat.iconBg}`}>
                                <stat.icon className={`w-3 h-3 ${stat.iconColor}`} />
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium truncate">{stat.title}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 leading-tight">{stat.value}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{stat.subtitle}</p>
                    </ExpandableCard>
                ))}
            </div>

            {/* Row 1: Revenue chart + Stage pie */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
                <ExpandableCard drillConfig={revenueDrill} className="lg:col-span-3 bg-white rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between px-3 py-2">
                        <h3 className="font-medium text-xs text-slate-700">Revenue Projection</h3>
                    </div>
                    <div className="px-3 pb-3">
                        <div className="h-[160px] w-full">
                            {revenueData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={revenueData} barSize={12}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={(v) => fmtCurrency(v, { compact: true })} width={45} />
                                        <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '6px 10px' }} formatter={(value: number) => [fmtCurrency(value, { compact: true }), undefined]} />
                                        <Bar dataKey="proposed" name="Proposed" fill="#6366f1" radius={[2, 2, 0, 0]} />
                                        <Bar dataKey="actual" name="Won" fill="#10b981" radius={[2, 2, 0, 0]} />
                                        <Bar dataKey="lost" name="Lost" fill="#ef4444" radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <div className="flex items-center justify-center h-full text-slate-300 text-xs">No data</div>}
                        </div>
                    </div>
                </ExpandableCard>

                <ExpandableCard drillConfig={stageDrill} className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                    <h3 className="font-medium text-xs text-slate-700 mb-1">By Stage</h3>
                    {statusData.length > 0 ? (
                        <>
                            <div className="h-[100px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={28} outerRadius={45} dataKey="value" paddingAngle={2} strokeWidth={0}>
                                            {statusData.map((entry, idx) => (
                                                <Cell key={idx} fill={PIE_COLOR_MAP[entry.name] || PIE_COLORS[idx % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '4px 8px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-0.5 mt-1">
                                {statusData.map((s, idx) => (
                                    <div key={s.name} className="flex items-center justify-between text-[10px]">
                                        <div className="flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PIE_COLOR_MAP[s.name] || PIE_COLORS[idx % PIE_COLORS.length] }} />
                                            <span className="text-slate-500">{s.name}</span>
                                        </div>
                                        <span className="font-medium text-slate-700">{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : <div className="flex items-center justify-center h-[100px] text-slate-300 text-xs">No data</div>}
                </ExpandableCard>
            </div>

            {/* Row 2: Salesperson bar + Tech revenue + Client revenue */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                <ExpandableCard drillConfig={salespersonDrill} className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                    <h3 className="font-medium text-xs text-slate-700 mb-1">Opps by Salesperson</h3>
                    {ownerData.length > 0 ? (
                        <div className="h-[130px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ownerData} layout="vertical" margin={{ left: 0, right: 5 }} barSize={10}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} allowDecimals={false} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} width={80} />
                                    <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '4px 8px' }} />
                                    <Bar dataKey="active" name="Active" fill="#6366f1" stackId="a" />
                                    <Bar dataKey="won" name="Won" fill="#10b981" stackId="a" radius={[0, 2, 2, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="flex items-center justify-center h-[130px] text-slate-300 text-xs">No data</div>}
                </ExpandableCard>

                <ExpandableCard drillConfig={techRevDrill} className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                    <h3 className="font-medium text-xs text-slate-700 mb-1">Revenue by Tech Stack</h3>
                    {techRevenueData.length > 0 ? (
                        <div className="h-[130px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={techRevenueData.slice(0,6)} layout="vertical" margin={{ left: 0, right: 5 }} barSize={10}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={(v) => fmtCurrency(v, { compact: true })} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} width={65} />
                                    <Tooltip formatter={(v: number) => [fmtCurrency(v, { compact: true }), 'Revenue']} contentStyle={{ fontSize: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '4px 8px' }} />
                                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 2, 2, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="flex items-center justify-center h-[130px] text-slate-300 text-xs">No data</div>}
                </ExpandableCard>

                <ExpandableCard drillConfig={clientRevDrill} className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                    <h3 className="font-medium text-xs text-slate-700 mb-1">Revenue by Client</h3>
                    {clientRevenueData.length > 0 ? (
                        <div className="h-[130px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={clientRevenueData.slice(0,6)} layout="vertical" margin={{ left: 0, right: 5 }} barSize={10}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={(v) => fmtCurrency(v, { compact: true })} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} width={80} />
                                    <Tooltip formatter={(v: number) => [fmtCurrency(v, { compact: true }), 'Revenue']} contentStyle={{ fontSize: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '4px 8px' }} />
                                    <Bar dataKey="value" fill="#ec4899" radius={[0, 2, 2, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="flex items-center justify-center h-[130px] text-slate-300 text-xs">No data</div>}
                </ExpandableCard>
            </div>

            {/* Row 3: Rev by Sales Rep + Client count */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <ExpandableCard drillConfig={salesRepRevDrill} className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                    <h3 className="font-medium text-xs text-slate-700 mb-1">Revenue by Sales Rep</h3>
                    {ownerRevenueData.length > 0 ? (
                        <div className="h-[120px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ownerRevenueData} layout="vertical" margin={{ left: 0, right: 5 }} barSize={10}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={(v) => fmtCurrency(v, { compact: true })} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} width={80} />
                                    <Tooltip formatter={(v: number) => [fmtCurrency(v, { compact: true }), 'Revenue']} contentStyle={{ fontSize: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '4px 8px' }} />
                                    <Bar dataKey="revenue" fill="#0ea5e9" radius={[0, 2, 2, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="flex items-center justify-center h-[120px] text-slate-300 text-xs">No data</div>}
                </ExpandableCard>

                <ExpandableCard drillConfig={clientCountDrill} className="bg-white rounded-lg border border-slate-100 px-3 py-2">
                    <h3 className="font-medium text-xs text-slate-700 mb-1">Opps by Client</h3>
                    {clientCountData.length > 0 ? (
                        <div className="h-[120px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={clientCountData.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 5 }} barSize={10}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} allowDecimals={false} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} width={80} />
                                    <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '4px 8px' }} />
                                    <Bar dataKey="value" name="Count" fill="#f59e0b" radius={[0, 2, 2, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="flex items-center justify-center h-[120px] text-slate-300 text-xs">No data</div>}
                </ExpandableCard>
            </div>

            {/* Row 4: Recent Opps table + Manager KPI + Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                {/* Recent Opportunities — compact table */}
                <ExpandableCard drillConfig={recentOppsDrill} className="lg:col-span-6 bg-white rounded-lg border border-slate-100 px-3 py-2 overflow-hidden">
                    <div className="flex justify-between items-center mb-1.5">
                        <h3 className="font-medium text-xs text-slate-700">Recent Opportunities</h3>
                        <button onClick={(e) => { e.stopPropagation(); router.push('/dashboard/opportunities'); }} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium">View All</button>
                    </div>
                    {recentOpps.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-50 text-left text-[10px] text-slate-400">
                                        <th className="pb-1 pl-1 font-medium">Opportunity</th>
                                        <th className="pb-1 font-medium">Value</th>
                                        <th className="pb-1 font-medium">Stage</th>
                                        <th className="pb-1 font-medium">Health</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[10px]">
                                    {recentOpps.slice(0, 6).map((opp) => (
                                        <tr key={opp.id} className="border-b border-slate-50/50 last:border-0 hover:bg-slate-50 transition-colors">
                                            <td className="py-1.5 pl-1">
                                                <div className="font-medium text-slate-800 truncate max-w-[140px]">{opp.name}</div>
                                                <div className="text-[9px] text-slate-400 truncate max-w-[140px]">{opp.client}</div>
                                            </td>
                                            <td className="py-1.5 text-slate-600">{fmtCurrency(opp.value, { compact: true })}</td>
                                            <td className="py-1.5">
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${STAGE_COLORS[STAGE_DISPLAY[opp.currentStage] || opp.currentStage] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                                                    {STAGE_DISPLAY[opp.currentStage] || opp.currentStage}
                                                </span>
                                            </td>
                                            <td className="py-1.5">
                                                <div className="flex items-center gap-1">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${opp.status === 'healthy' ? 'bg-emerald-500' : opp.status === 'at-risk' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                                    <span className="text-slate-500">{opp.healthScore}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <div className="text-center py-3 text-slate-300 text-[10px]">No opportunities</div>}
                </ExpandableCard>

                {/* Manager KPI */}
                <ExpandableCard drillConfig={managerKpiDrill} className="lg:col-span-3 bg-white rounded-lg border border-slate-100 px-3 py-2">
                    <h3 className="font-medium text-xs text-slate-700 mb-1.5">Manager KPI</h3>
                    {(sales?.managerKpi || []).length > 0 ? (
                        <table className="w-full text-[10px]">
                            <thead>
                                <tr className="border-b border-slate-50 text-left text-slate-400">
                                    <th className="pb-1 font-medium">Manager</th>
                                    <th className="pb-1 font-medium text-center">Assigned</th>
                                    <th className="pb-1 font-medium text-center">Acted</th>
                                    <th className="pb-1 font-medium text-center">Avg Days</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(sales?.managerKpi || []).map((mgr) => (
                                    <tr key={mgr.name} className="border-b border-slate-50/50 last:border-0">
                                        <td className="py-1.5 font-medium text-slate-700 truncate max-w-[90px]">{mgr.name}</td>
                                        <td className="py-1.5 text-center text-slate-500">{mgr.totalAssigned}</td>
                                        <td className="py-1.5 text-center text-slate-500">{mgr.responded}</td>
                                        <td className="py-1.5 text-center text-slate-500">{mgr.avgResponseDays}d</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <div className="text-center py-3 text-slate-300 text-[10px]">No manager data</div>}
                </ExpandableCard>

                {/* AI Insights + Quick Stats */}
                <ExpandableCard drillConfig={insightsDrill} className="lg:col-span-3 bg-white rounded-lg border border-slate-100 px-3 py-2">
                    <h3 className="font-medium text-xs text-slate-700 mb-1.5">Insights</h3>
                    <div className="space-y-1">
                        {insights.slice(0, 4).map((insight, idx) => (
                            <div key={idx} className="flex gap-1.5 py-1 border-b border-slate-50/50 last:border-0">
                                <div className={`w-1 h-1 rounded-full mt-1.5 flex-shrink-0 ${insight.type === "warning" ? "bg-amber-400" : insight.type === "success" ? "bg-green-400" : "bg-blue-400"}`} />
                                <p className="text-[10px] text-slate-500 leading-relaxed">{insight.text}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5 text-amber-400" />Stalled</span>
                            <span className="font-semibold text-slate-700">{stalledDeals.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />Healthy</span>
                            <span className="font-semibold text-slate-700">{healthyDeals.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 flex items-center gap-1"><Briefcase className="w-2.5 h-2.5 text-indigo-400" />Presales</span>
                            <span className="font-semibold text-slate-700">{presales?.totalPresalesOpps || 0}</span>
                        </div>
                    </div>
                </ExpandableCard>
            </div>
        </div>
    );
}
