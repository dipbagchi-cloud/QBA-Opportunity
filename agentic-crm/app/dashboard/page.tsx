"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { API_URL, getAuthHeaders } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

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
        revenueByTech: { name: string; value: number }[];
        revenueByClient: { name: string; value: number }[];
        revenueByOwner: { name: string; revenue: number }[];
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
    };
    sales: {
        avgTimeToClose: number;
        wonCount: number;
        lostCount: number;
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
    status: string;
    healthScore: number;
    daysInStage: number;
    isStalled: boolean;
}

export default function DashboardPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const headers = getAuthHeaders();
            try {
                const [analyticsRes, oppsRes] = await Promise.all([
                    fetch(`${API_URL}/api/analytics`, { headers }),
                    fetch(`${API_URL}/api/opportunities`, { headers }),
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
        insights.push({ text: `'${d.name}' (${d.client}) is progressing well — ₹${(d.value / 100000).toFixed(1)}L at ${d.probability}% probability.`, type: "success" });
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
        insights.push({ text: `Pipeline has ${pipeline.totalOpps} opportunities worth ₹${((pipeline.pipelineValue || 0) / 100000).toFixed(1)}L total.`, type: "neutral" });
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
    const ownerData = analytics?.dashboard.countByOwner || [];
    const techRevenueData = analytics?.dashboard.revenueByTech || [];
    const clientRevenueData = analytics?.dashboard.revenueByClient || [];
    const clientCountData = analytics?.dashboard.countByClient || [];
    const ownerRevenueData = analytics?.dashboard.revenueByOwner || [];
    const projectedRevenue = analytics?.dashboard.projectedRevenue || 0;
    const closedRevenue = analytics?.dashboard.closedRevenue || 0;

    const stats = [
        {
            title: "Projected Revenue",
            value: `₹${((projectedRevenue) / 100000).toFixed(1)}L`,
            subtitle: `${pipeline?.totalOpps || 0} opportunities`,
            icon: DollarSign,
            iconBg: "bg-indigo-100",
            iconColor: "text-indigo-600",
        },
        {
            title: "Closed Revenue",
            value: `₹${((closedRevenue) / 100000).toFixed(1)}L`,
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
            value: `₹${((pipeline?.pipelineValue || 0) / 100000).toFixed(1)}L`,
            subtitle: `Avg ₹${((pipeline?.avgDealValue || 0) / 100000).toFixed(1)}L per deal`,
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
    ];

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <div>
                <h1 className="text-xl font-bold mb-0.5 text-slate-900">Dashboard</h1>
                <p className="text-slate-500 text-sm">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Here&apos;s your pipeline overview.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {stats.map((stat, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                                <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                            </div>
                        </div>
                        <h3 className="text-slate-500 text-xs mb-0.5">{stat.title}</h3>
                        <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{stat.subtitle}</p>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Revenue Projection Chart */}
                <div className="lg:col-span-2 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-sm text-slate-800">Revenue Projection</h3>
                    </div>
                    <div className="h-[240px] w-full">
                        {revenueData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: number) => [`₹${(value / 100000).toFixed(1)}L`, undefined]}
                                    />
                                    <Legend />
                                    <Bar dataKey="proposed" name="Proposed" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="actual" name="Won" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="lost" name="Lost" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400 text-sm">No revenue data available</div>
                        )}
                    </div>
                </div>

                {/* Pipeline by Stage - Pie */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-sm text-slate-800">By Stage</h3>
                    </div>
                    {statusData.length > 0 ? (
                        <>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                                            {statusData.map((entry, idx) => (
                                                <Cell key={idx} fill={PIE_COLOR_MAP[entry.name] || PIE_COLORS[idx % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}
                                            formatter={(value: number, name: string) => [value, name]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-2 mt-2">
                                {statusData.map((s, idx) => (
                                    <div key={s.name} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLOR_MAP[s.name] || PIE_COLORS[idx % PIE_COLORS.length] }} />
                                            <span className="text-slate-600">{s.name}</span>
                                        </div>
                                        <span className="font-medium text-slate-800">{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-[200px] text-slate-400 text-sm">No data</div>
                    )}
                </div>
            </div>

            {/* Opportunities by Salesperson */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-sm text-slate-800">Opportunities by Salesperson</h3>
                </div>
                {ownerData.length > 0 ? (
                    <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={ownerData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={110} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                                <Bar dataKey="active" name="Active" fill="#6366f1" radius={[0, 0, 0, 0]} stackId="a" />
                                <Bar dataKey="won" name="Won" fill="#10b981" radius={[0, 4, 4, 0]} stackId="a" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">No salesperson data available</div>
                )}
            </div>

            {/* Row: Revenue by Tech Stack + Revenue by Client + Count by Client */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Proposed Revenue by Tech Stack */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <h3 className="font-semibold text-sm text-slate-800 mb-3">Proposed Revenue by Tech Stack</h3>
                    {techRevenueData.length > 0 ? (
                        <div className="h-[240px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={techRevenueData} layout="vertical" margin={{ left: 10, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} width={80} />
                                    <Tooltip formatter={(v: number) => [`₹${(v/100000).toFixed(1)}L`, 'Revenue']} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                    <Bar dataKey="value" name="Revenue" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="flex items-center justify-center h-[240px] text-slate-400 text-sm">No data</div>}
                </div>

                {/* Proposed Revenue by Client */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <h3 className="font-semibold text-sm text-slate-800 mb-3">Proposed Revenue by Client</h3>
                    {clientRevenueData.length > 0 ? (
                        <div className="h-[240px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={clientRevenueData} layout="vertical" margin={{ left: 10, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} width={100} />
                                    <Tooltip formatter={(v: number) => [`₹${(v/100000).toFixed(1)}L`, 'Revenue']} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                    <Bar dataKey="value" name="Revenue" fill="#ec4899" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="flex items-center justify-center h-[240px] text-slate-400 text-sm">No data</div>}
                </div>

                {/* Opportunity Count by Client */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <h3 className="font-semibold text-sm text-slate-800 mb-3">Opportunity Count by Client</h3>
                    {clientCountData.length > 0 ? (
                        <div className="h-[240px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={clientCountData.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} width={100} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                    <Bar dataKey="value" name="Count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="flex items-center justify-center h-[240px] text-slate-400 text-sm">No data</div>}
                </div>
            </div>

            {/* Proposed Revenue by Sales Rep */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <h3 className="font-semibold text-sm text-slate-800 mb-3">Proposed Revenue by Sales Rep</h3>
                {ownerRevenueData.length > 0 ? (
                    <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={ownerRevenueData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`} />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={110} />
                                <Tooltip formatter={(v: number) => [`₹${(v/100000).toFixed(1)}L`, 'Revenue']} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                <Bar dataKey="revenue" name="Revenue" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : <div className="flex items-center justify-center h-[220px] text-slate-400 text-sm">No data</div>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Recent Opportunities Table */}
                <div className="lg:col-span-2 bg-white rounded-xl p-4 border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-sm text-slate-800">Recent Opportunities</h3>
                        <button
                            onClick={() => router.push('/dashboard/opportunities')}
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                            View All
                        </button>
                    </div>
                    {recentOpps.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                                        <th className="pb-2 pl-3 font-medium">Opportunity</th>
                                        <th className="pb-2 font-medium">Value</th>
                                        <th className="pb-2 font-medium">Stage</th>
                                        <th className="pb-2 font-medium">Health</th>
                                        <th className="pb-2 font-medium">Sales Rep</th>
                                        <th className="pb-2 font-medium">Manager</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    {recentOpps.map((opp) => (
                                        <tr
                                            key={opp.id}
                                            onClick={() => router.push(`/dashboard/opportunities/${opp.id}`)}
                                            className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer"
                                        >
                                            <td className="py-2.5 pl-3">
                                                <div className="font-medium text-slate-900">{opp.name}</div>
                                                <div className="text-[11px] text-slate-400">{opp.client} • {opp.owner}</div>
                                            </td>
                                            <td className="py-2.5 text-slate-600">{'\u20B9'}{(opp.value / 100000).toFixed(1)}L</td>
                                            <td className="py-2.5">
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${STAGE_COLORS[STAGE_DISPLAY[opp.currentStage] || opp.currentStage] || "bg-slate-50 text-slate-700 border-slate-200"}`}>
                                                    {STAGE_DISPLAY[opp.currentStage] || opp.currentStage}
                                                </span>
                                            </td>
                                            <td className="py-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-2 h-2 rounded-full ${opp.status === 'healthy' ? 'bg-emerald-500' : opp.status === 'at-risk' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                                    <span className="text-slate-600">{opp.healthScore}%</span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 text-slate-600">{opp.salesRepName || opp.owner}</td>
                                            <td className="py-2.5 text-slate-600">{opp.managerName || <span className="text-slate-300">—</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-slate-400 text-xs">No opportunities found</div>
                    )}
                </div>

                {/* AI Insights */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-sm text-slate-800">AI Insights</h3>
                    </div>
                    <div className="space-y-2">
                        {insights.map((insight, idx) => (
                            <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                                <div className="flex gap-3">
                                    <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${insight.type === "warning" ? "bg-amber-500" :
                                        insight.type === "success" ? "bg-green-500" : "bg-blue-500"
                                        }`} />
                                    <p className="text-sm text-slate-600 leading-relaxed">{insight.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Stats */}
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-slate-500">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                Stalled Deals
                            </div>
                            <span className="font-semibold text-slate-800">{stalledDeals.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-slate-500">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                Healthy Deals
                            </div>
                            <span className="font-semibold text-slate-800">{healthyDeals.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-slate-500">
                                <Briefcase className="w-4 h-4 text-indigo-500" />
                                In Presales
                            </div>
                            <span className="font-semibold text-slate-800">{presales?.totalPresalesOpps || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
