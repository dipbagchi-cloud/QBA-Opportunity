"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    IndianRupee,
    Target,
    Activity,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Briefcase,
    Loader2,
    RefreshCw,
    Search,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    Filter,
    X,
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
        managerKpi?: { name: string; totalAssigned: number; responded: number; avgResponseDays: number; wonCount: number; lostCount: number; totalRevenue: number }[];
    };
}

interface Opportunity {
    id: string;
    name: string;
    client: string;
    value: number;
    currency?: string;
    quote?: number | null;
    stage: string;
    currentStage: string;
    probability: number;
    lastActivity: string;
    owner: string;
    salesRepName?: string;
    managerName?: string;
    presalesAssigneeName?: string;
    technology?: string;
    region?: string;
    country?: string;
    expectedCloseDate?: string;
    actualCloseDate?: string;
    createdAt?: string;
    status: string;
    healthScore: number;
    daysInStage: number;
    daysToClose?: number | null;
    isStalled: boolean;
    monthlyRevenue?: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/* Pending Actions panel — searchable / sortable / column-filterable   */
/* ------------------------------------------------------------------ */

type PendingSortKey = 'opportunity' | 'stage' | 'action' | 'owner' | 'due' | 'days' | 'value';

interface PendingRow {
    id: string;
    opportunity: string;
    client: string;
    stage: string;            // display stage
    rawStage: string;         // currentStage for color lookup
    action: string;
    owner: string;            // owner/assignee composite string
    dueTs: number;            // timestamp for sort (MAX if none)
    dueRaw?: string;          // raw expectedCloseDate
    days: number;
    isStalled: boolean;
    value: number;
}

const PENDING_COLUMNS: { key: PendingSortKey; label: string; align?: 'right' }[] = [
    { key: 'opportunity', label: 'Opportunity' },
    { key: 'stage', label: 'Stage' },
    { key: 'action', label: 'Action Needed' },
    { key: 'owner', label: 'Owner / Assignee' },
    { key: 'due', label: 'Due' },
    { key: 'days', label: 'Days' },
    { key: 'value', label: 'Value', align: 'right' },
];

function PendingActionsPanel({
    opportunities,
    userName,
    onOpen,
    fmtCurrency,
}: {
    opportunities: Opportunity[];
    userName: string;
    onOpen: (id: string) => void;
    fmtCurrency: (v: number, opts?: { compact?: boolean; decimals?: number }) => string;
}) {
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<PendingSortKey>('due');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [showFilters, setShowFilters] = useState(false);
    const [colFilters, setColFilters] = useState<Record<string, string>>({});

    const CLOSED = ['Closed Won', 'Closed-Won', 'Closed Lost', 'Proposal Lost', 'Delivered'];
    const actionForStage = (s: string) => {
        if (s === 'Pipeline' || s === 'Discovery') return 'Qualify & assign presales';
        if (s === 'Qualification' || s === 'Presales') return 'Complete presales estimation';
        if (s === 'Proposal' || s === 'Sales') return 'Prepare or send quote';
        if (s === 'Negotiation') return 'Close negotiation';
        return 'Review';
    };
    const ownerFor = (o: Opportunity) => {
        const parts: string[] = [];
        if (o.salesRepName) parts.push(`Sales: ${o.salesRepName}`);
        else if (o.owner) parts.push(`Owner: ${o.owner}`);
        if (o.managerName) parts.push(`Mgr: ${o.managerName}`);
        return parts.join(' · ') || 'Unassigned';
    };
    const fmtDate = (d?: string) => {
        if (!d) return '—';
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return '—';
        return dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' });
    };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueClass = (d?: string) => {
        if (!d) return 'text-slate-500';
        const dt = new Date(d); if (isNaN(dt.getTime())) return 'text-slate-500';
        const diffDays = Math.ceil((dt.getTime() - today.getTime()) / 86400000);
        if (diffDays < 0) return 'text-red-600 font-semibold';
        if (diffDays <= 7) return 'text-amber-600 font-semibold';
        return 'text-slate-600';
    };

    // Build normalized rows
    const rows: PendingRow[] = useMemo(() => {
        return opportunities
            .filter(o => {
                if (CLOSED.includes(o.currentStage)) return false;
                // Only the logged-in user's pending actions — they own it, sell it,
                // manage it, or are the assigned presales estimator.
                return o.owner === userName
                    || o.salesRepName === userName
                    || o.managerName === userName
                    || o.presalesAssigneeName === userName;
            })
            .map(o => ({
                id: o.id,
                opportunity: o.name,
                client: o.client,
                stage: STAGE_DISPLAY[o.currentStage] || o.currentStage,
                rawStage: o.currentStage,
                action: actionForStage(o.currentStage),
                owner: ownerFor(o),
                dueTs: o.expectedCloseDate ? new Date(o.expectedCloseDate).getTime() : Number.MAX_SAFE_INTEGER,
                dueRaw: o.expectedCloseDate,
                days: o.daysInStage ?? 0,
                isStalled: o.isStalled,
                value: Number(o.value) || 0,
            }));
    }, [opportunities, userName]);

    // Global search (across text columns)
    const searched = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(r =>
            r.opportunity.toLowerCase().includes(q) ||
            r.client.toLowerCase().includes(q) ||
            r.stage.toLowerCase().includes(q) ||
            r.action.toLowerCase().includes(q) ||
            r.owner.toLowerCase().includes(q)
        );
    }, [rows, search]);

    // Per-column filters
    const filtered = useMemo(() => {
        const active = Object.entries(colFilters).filter(([, v]) => v.trim());
        if (active.length === 0) return searched;
        return searched.filter(r =>
            active.every(([key, val]) => {
                const fv = val.trim().toLowerCase();
                switch (key as PendingSortKey) {
                    case 'opportunity': return (r.opportunity + ' ' + r.client).toLowerCase().includes(fv);
                    case 'stage': return r.stage.toLowerCase().includes(fv);
                    case 'action': return r.action.toLowerCase().includes(fv);
                    case 'owner': return r.owner.toLowerCase().includes(fv);
                    case 'due': return fmtDate(r.dueRaw).toLowerCase().includes(fv);
                    case 'days': return String(r.days).includes(fv);
                    case 'value': return String(r.value).includes(fv);
                    default: return true;
                }
            })
        );
    }, [searched, colFilters]);

    // Sort
    const sorted = useMemo(() => {
        const dir = sortDir === 'asc' ? 1 : -1;
        return [...filtered].sort((a, b) => {
            let av: string | number;
            let bv: string | number;
            switch (sortKey) {
                case 'due': av = a.dueTs; bv = b.dueTs; break;
                case 'days': av = a.days; bv = b.days; break;
                case 'value': av = a.value; bv = b.value; break;
                case 'opportunity': av = a.opportunity.toLowerCase(); bv = b.opportunity.toLowerCase(); break;
                case 'stage': av = a.stage.toLowerCase(); bv = b.stage.toLowerCase(); break;
                case 'action': av = a.action.toLowerCase(); bv = b.action.toLowerCase(); break;
                case 'owner': av = a.owner.toLowerCase(); bv = b.owner.toLowerCase(); break;
                default: av = 0; bv = 0;
            }
            if (av < bv) return -1 * dir;
            if (av > bv) return 1 * dir;
            return 0;
        });
    }, [filtered, sortKey, sortDir]);

    const toggleSort = (key: PendingSortKey) => {
        if (sortKey === key) {
            setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const activeFilterCount = Object.values(colFilters).filter(v => v.trim()).length;

    return (
        <div className="bg-white rounded-md border border-slate-100 px-2.5 py-1.5">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <h3 className="text-xs font-semibold text-slate-800">
                        Your Pending Actions
                    </h3>
                    <span className="text-[10px] text-slate-400">({sorted.length}{sorted.length !== rows.length ? ` of ${rows.length}` : ''})</span>
                </div>
                <div className="relative ml-auto">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search pending actions…"
                        className="pl-7 pr-6 py-1 text-[11px] border border-slate-200 rounded-md w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
                <button
                    onClick={() => setShowFilters(s => !s)}
                    className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border transition-colors ${showFilters || activeFilterCount > 0 ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                >
                    <Filter className="w-3 h-3" />
                    Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </button>
                {activeFilterCount > 0 && (
                    <button onClick={() => setColFilters({})} className="text-[10px] text-red-500 hover:text-red-700 underline">Clear</button>
                )}
            </div>
            {rows.length === 0 ? (
                <div className="text-[11px] text-slate-400 py-1">No pending actions.</div>
            ) : (
                <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-[10px]">
                        <thead className="text-[9px] text-slate-400 uppercase tracking-wide bg-slate-50 sticky top-0 z-10">
                            <tr>
                                {PENDING_COLUMNS.map(col => (
                                    <th
                                        key={col.key}
                                        onClick={() => toggleSort(col.key)}
                                        className={`px-2 py-1 font-medium cursor-pointer select-none hover:text-slate-600 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                                    >
                                        <span className={`inline-flex items-center gap-0.5 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                                            {col.label}
                                            {sortKey === col.key
                                                ? (sortDir === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)
                                                : <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                            {showFilters && (
                                <tr>
                                    {PENDING_COLUMNS.map(col => (
                                        <th key={col.key} className="px-1 pb-1">
                                            <input
                                                value={colFilters[col.key] || ''}
                                                onChange={e => setColFilters(prev => ({ ...prev, [col.key]: e.target.value }))}
                                                onClick={e => e.stopPropagation()}
                                                placeholder="filter…"
                                                className="w-full px-1.5 py-0.5 text-[9px] font-normal normal-case border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                            />
                                        </th>
                                    ))}
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sorted.map(r => (
                                <tr
                                    key={r.id}
                                    onClick={() => onOpen(r.id)}
                                    className="cursor-pointer hover:bg-slate-50"
                                >
                                    <td className="px-2 py-0.5">
                                        <div className="font-medium text-slate-800 truncate max-w-[180px] leading-tight" title={r.opportunity}>{r.opportunity}</div>
                                        <div className="text-[9px] text-slate-400 truncate max-w-[180px] leading-tight" title={r.client}>{r.client}</div>
                                    </td>
                                    <td className="px-2 py-0.5">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${STAGE_COLORS[r.rawStage] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                            {r.stage}
                                        </span>
                                    </td>
                                    <td className="px-2 py-0.5 text-slate-700">{r.action}</td>
                                    <td className="px-2 py-0.5 text-slate-600 truncate max-w-[160px]" title={r.owner}>{r.owner}</td>
                                    <td className={`px-2 py-0.5 ${dueClass(r.dueRaw)}`}>{fmtDate(r.dueRaw)}</td>
                                    <td className="px-2 py-0.5 text-slate-600 whitespace-nowrap">
                                        {r.days}d
                                        {r.isStalled && <span className="ml-1 text-[9px] text-red-600 font-semibold">STALLED</span>}
                                    </td>
                                    <td className="px-2 py-0.5 text-right text-slate-700 font-medium whitespace-nowrap">{fmtCurrency(r.value)}</td>
                                </tr>
                            ))}
                            {sorted.length === 0 && (
                                <tr>
                                    <td colSpan={PENDING_COLUMNS.length} className="px-2 py-4 text-center text-slate-400 text-[11px]">
                                        No matching pending actions.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default function DashboardPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const { format: fmtCurrency, symbol: cSym, convert: convertCurrency, getRate } = useCurrency();
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [rawOpportunities, setRawOpportunities] = useState<Opportunity[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const PRESALES_SALES_STAGES = ['Qualification', 'Presales', 'Proposal', 'Sales', 'Negotiation'];
    const CLOSED_STAGES_ALL = ['Closed Won', 'Closed-Won', 'Closed Lost', 'Proposal Lost', 'Delivered'];

    const opportunities = useMemo(() => {
        return rawOpportunities.map(o => {
            const cur = o.currency || 'INR';
            // Convert opp-currency amounts to INR base. Prefer the opportunity's
            // stored exchangeRatesSnapshot (the same rates the list view uses)
            // so dashboard and list values reconcile exactly — live rates drift
            // from the snapshot and produce a ~1% mismatch on converted quotes.
            const snapshot = (o as any).metadata?.exchangeRatesSnapshot as Record<string, number> | undefined;
            const snapRate = snapshot?.[cur];
            const liveRate = getRate(cur);
            const rate = (snapRate && snapRate > 0) ? snapRate : liveRate;
            const toBase = (n: number) => (cur === 'INR' || !rate ? Number(n) || 0 : (Number(n) || 0) / rate);
            const rawValueInBase = toBase(Number(o.value) || 0);
            // Backend returns o.quote already converted to the opportunity's currency
            // (see opportunities.controller.ts), so apply the same INR-base conversion
            // we do for o.value — otherwise drill-down treats a GBP quote as if it
            // were INR and shows ~1/rate of the real value.
            const quoteInBase = o.quote != null ? toBase(Number(o.quote)) : null;

            let displayValue = rawValueInBase;
            if (CLOSED_STAGES_ALL.includes(o.currentStage)) {
                // Closed (won/lost/delivered) = realized revenue = committed
                // quote only. An un-quoted closed deal contributes 0, matching
                // the backend Closed Revenue stat (no raw-value fallback).
                displayValue = (quoteInBase != null && quoteInBase > 0) ? quoteInBase : 0;
            } else if (PRESALES_SALES_STAGES.includes(o.currentStage)) {
                // Active deals: projected = quote if present, else estimated value.
                if (quoteInBase != null && quoteInBase > 0) displayValue = quoteInBase;
            }

            const monthlyRevenueInBase = o.monthlyRevenue
                ? Object.fromEntries(
                    Object.entries(o.monthlyRevenue).map(([k, v]) => [k, toBase(Number(v) || 0)])
                )
                : undefined;

            return { ...o, value: displayValue, monthlyRevenue: monthlyRevenueInBase };
        });
    }, [rawOpportunities, getRate]);

    const fetchDashboard = useCallback(async (silent = false) => {
        const headers = getAuthHeaders();
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            // The opportunities API is paginated and capped at 100 rows/page.
            // Every dashboard aggregate (stage tiles, charts, drill-downs,
            // pending actions) runs client-side over this array, so we must
            // load ALL pages — otherwise closed/older deals (beyond the first
            // 100 most-recently-updated) silently vanish from the lists.
            const PAGE = 100;
            const [analyticsRes, firstRes] = await Promise.all([
                fetch(`${API_URL}/api/analytics`, { headers }),
                fetch(`${API_URL}/api/opportunities?limit=${PAGE}&page=1`, { headers }),
            ]);
            if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
            if (firstRes.ok) {
                const firstJson = await firstRes.json();
                if (Array.isArray(firstJson)) {
                    setRawOpportunities(firstJson);
                } else {
                    let all: Opportunity[] = firstJson.data ?? [];
                    const totalPages = Number(firstJson.totalPages) || 1;
                    if (totalPages > 1) {
                        const rest = await Promise.all(
                            Array.from({ length: totalPages - 1 }, (_, i) =>
                                fetch(`${API_URL}/api/opportunities?limit=${PAGE}&page=${i + 2}`, { headers })
                                    .then(r => (r.ok ? r.json() : { data: [] }))
                                    .then(j => (Array.isArray(j) ? j : (j.data ?? [])))
                                    .catch(() => [])
                            )
                        );
                        all = all.concat(...rest);
                    }
                    setRawOpportunities(all);
                }
            }
        } catch (err) {
            console.error("Dashboard fetch error:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboard(false);
    }, [user?.role?.id, fetchDashboard]);

    // Refetch silently when the tab regains focus so insights/charts stay current.
    useEffect(() => {
        const onFocus = () => fetchDashboard(true);
        window.addEventListener('focus', onFocus);
        const onVis = () => { if (document.visibilityState === 'visible') fetchDashboard(true); };
        document.addEventListener('visibilitychange', onVis);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVis);
        };
    }, [fetchDashboard]);

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
        insights.push({ text: `'${d.name}' (${d.client}) is progressing well — ${fmtCurrency(d.value)} at ${d.probability}% probability.`, type: "success" });
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
        insights.push({ text: `Pipeline has ${pipeline.totalOpps} opportunities worth ${fmtCurrency(pipeline.pipelineValue || 0)} total.`, type: "neutral" });
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
    const clientCountData = analytics?.dashboard.countByClient || [];
    // Each value card is summed from the SAME frontend opportunity set its
    // drill-down lists (using per-row display value), so the card total always
    // reconciles with the drill-down detailed listing + monthly breakdown
    // instead of drifting from the backend aggregate (different FX/filter basis).
    const sumValue = (rows: typeof opportunities) => rows.reduce((s, o) => s + (Number(o.value) || 0), 0);
    // Projected Revenue — drill filter: status not won/lost
    const projectedRevenue = sumValue(opportunities.filter(o => o.status !== "won" && o.status !== "lost"));
    // Closed Revenue — drill filter: Project stage or Closed Won
    const closedRevenue = sumValue(opportunities.filter(o => {
        const s = STAGE_DISPLAY[o.currentStage] || o.currentStage;
        return s === 'Project' || o.currentStage === 'Closed Won' || o.currentStage === 'Closed-Won';
    }));
    // Pipeline Value — drill filter: any non-closed stage
    const pipelineValueSum = sumValue(opportunities.filter(o => {
        const s = o.currentStage;
        return s !== 'Closed Won' && s !== 'Closed-Won' && s !== 'Closed Lost' && s !== 'Proposal Lost';
    }));

    // Recompute revenue-by-X charts directly from the opportunities array so the
    // charts match the drill-down table. The /api/analytics revenueByClient and
    // revenueBySalesRep only count Closed Won deals, which made the bar chart
    // disagree with the all-opportunities listing.
    const clientRevenueMap: Record<string, number> = {};
    const salesRepRevenueMap: Record<string, number> = {};
    opportunities.forEach(o => {
        const v = Number(o.value) || 0;
        const c = o.client || 'Unknown';
        clientRevenueMap[c] = (clientRevenueMap[c] || 0) + v;
        const rep = o.salesRepName || o.owner || 'Unassigned';
        salesRepRevenueMap[rep] = (salesRepRevenueMap[rep] || 0) + v;
    });
    const clientRevenueData = Object.entries(clientRevenueMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    const ownerRevenueData = Object.entries(salesRepRevenueMap)
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue);

    // Build tech → project names mapping for tooltip
    const STAGE_GROUP: Record<string, string> = {
        'Discovery': 'Pipeline', 'Pipeline': 'Pipeline', 'Qualification': 'Qualification',
        'Presales': 'Qualification', 'Proposal': 'Proposal', 'Sales': 'Proposal',
        'Negotiation': 'Negotiation', 'Closed Won': 'Closed Won', 'Closed Lost': 'Closed Lost',
        'Proposal Lost': 'Proposal Lost',
    };
    const techProjectsMap: Record<string, string[]> = {};
    const ownerProjectsMap: Record<string, string[]> = {};
    const clientProjectsMap: Record<string, string[]> = {};
    const salesRepProjectsMap: Record<string, string[]> = {};
    const stageProjectsMap: Record<string, string[]> = {};
    opportunities.forEach(opp => {
        // Tech map
        if (opp.technology) {
            opp.technology.split(',').map(t => t.trim()).filter(Boolean).forEach(tech => {
                if (!techProjectsMap[tech]) techProjectsMap[tech] = [];
                if (!techProjectsMap[tech].includes(opp.name)) techProjectsMap[tech].push(opp.name);
            });
        }
        // Owner / Salesperson map
        const ownerKey = opp.owner || 'Unassigned';
        if (!ownerProjectsMap[ownerKey]) ownerProjectsMap[ownerKey] = [];
        if (!ownerProjectsMap[ownerKey].includes(opp.name)) ownerProjectsMap[ownerKey].push(opp.name);
        // Sales rep map
        const repKey = opp.salesRepName || opp.owner || 'Unknown';
        if (!salesRepProjectsMap[repKey]) salesRepProjectsMap[repKey] = [];
        if (!salesRepProjectsMap[repKey].includes(opp.name)) salesRepProjectsMap[repKey].push(opp.name);
        // Client map
        const cKey = opp.client || 'Unknown';
        if (!clientProjectsMap[cKey]) clientProjectsMap[cKey] = [];
        if (!clientProjectsMap[cKey].includes(opp.name)) clientProjectsMap[cKey].push(opp.name);
        // Stage map (grouped)
        const rawStage = opp.currentStage || 'Unknown';
        const groupedStage = STAGE_GROUP[rawStage] || rawStage;
        if (!stageProjectsMap[groupedStage]) stageProjectsMap[groupedStage] = [];
        if (!stageProjectsMap[groupedStage].includes(opp.name)) stageProjectsMap[groupedStage].push(opp.name);
    });

    const CategoryTooltip = ({ active, payload, label, projectsMap, valueLabel }: any) => {
        if (!active || !payload?.length) return null;
        const category = label || payload[0]?.payload?.name;
        const projects: string[] = (projectsMap || {})[category] || [];
        const isCurrency = valueLabel === 'Revenue';
        return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 max-w-[260px]">
                <p className="text-xs font-bold text-slate-800 mb-1">{category}</p>
                {payload.map((entry: any, i: number) => (
                    <p key={i} className="text-xs text-purple-600 font-semibold">
                        {entry.name || entry.dataKey}: {isCurrency ? fmtCurrency(entry.value) : entry.value}
                    </p>
                ))}
                {projects.length > 0 && (
                    <div className="border-t border-slate-100 pt-1.5 mt-1.5">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">Projects</p>
                        {projects.slice(0, 8).map((p: string, i: number) => (
                            <p key={i} className="text-[11px] text-slate-600 truncate">{p}</p>
                        ))}
                        {projects.length > 8 && <p className="text-[10px] text-slate-400">+{projects.length - 8} more</p>}
                    </div>
                )}
            </div>
        );
    };

    // Shorthand tooltip creators
    const TechRevTooltip = (props: any) => <CategoryTooltip {...props} projectsMap={techProjectsMap} valueLabel="Revenue" />;
    const OwnerTooltip = (props: any) => <CategoryTooltip {...props} projectsMap={ownerProjectsMap} valueLabel="Count" />;
    const ClientRevTooltip = (props: any) => <CategoryTooltip {...props} projectsMap={clientProjectsMap} valueLabel="Revenue" />;
    const ClientCountTooltip = (props: any) => <CategoryTooltip {...props} projectsMap={clientProjectsMap} valueLabel="Count" />;
    const SalesRepRevTooltip = (props: any) => <CategoryTooltip {...props} projectsMap={salesRepProjectsMap} valueLabel="Revenue" />;
    const StageTooltip = (props: any) => <CategoryTooltip {...props} projectsMap={stageProjectsMap} valueLabel="Count" />;

    // Custom YAxis tick that truncates long names to a single line
    const TruncatedTick = ({ x, y, payload }: any) => {
        const maxLen = 16;
        const name = payload?.value || '';
        const display = name.length > maxLen ? name.slice(0, maxLen) + '…' : name;
        return (
            <text x={x} y={y} textAnchor="end" fill="#94a3b8" fontSize={8} dominantBaseline="central">
                {display}
            </text>
        );
    };

    const stats = [
        {
            title: "Projected Revenue",
            value: fmtCurrency(projectedRevenue),
            subtitle: `${pipeline?.totalOpps || 0} opportunities`,
            icon: IndianRupee,
            iconBg: "bg-indigo-100",
            iconColor: "text-indigo-600",
        },
        {
            title: "Closed Revenue",
            value: fmtCurrency(closedRevenue),
            subtitle: `${sales?.wonCount || 0} deals won`,
            icon: CheckCircle2,
            iconBg: "bg-emerald-100",
            iconColor: "text-emerald-600",
        },
        {
            title: "Opportunities",
            value: String(opportunities.length),
            subtitle: `${pipeline?.activeProjects || 0} active`,
            icon: Briefcase,
            iconBg: "bg-blue-100",
            iconColor: "text-blue-600",
        },
        {
            title: "Pipeline Value",
            value: fmtCurrency(pipelineValueSum),
            subtitle: `Avg ${fmtCurrency(pipeline?.avgDealValue || 0)} per deal`,
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
            value: (() => {
                // Show fractional days so deals closed within hours don't read
                // as a misleading "0d". e.g. 5h => 0.21d.
                const d = sales?.avgTimeToClose || 0;
                if (d <= 0) return '0d';
                if (d < 1) return `${d.toFixed(2)}d`;
                if (d < 10) return `${d.toFixed(1)}d`;
                return `${d.toFixed(0)}d`;
            })(),
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
                    <YAxis tickFormatter={(v) => fmtCurrency(v)} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [fmtCurrency(v), undefined]} />
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
                    <Tooltip content={<StageTooltip />} />
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
                    <Tooltip content={<OwnerTooltip />} />
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
                    <XAxis type="number" tickFormatter={(v) => fmtCurrency(v)} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} width={100} />
                    <Tooltip content={<TechRevTooltip />} />
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
                    <XAxis type="number" tickFormatter={(v) => fmtCurrency(v)} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} width={120} />
                    <Tooltip content={<ClientRevTooltip />} />
                    <Bar dataKey="value" name="Revenue" fill="#ec4899" radius={[0, 3, 3, 0]} />
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
                    <XAxis type="number" tickFormatter={(v) => fmtCurrency(v)} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} width={120} />
                    <Tooltip content={<SalesRepRevTooltip />} />
                    <Bar dataKey="revenue" name="Revenue" fill="#0ea5e9" radius={[0, 3, 3, 0]} />
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
                    <Tooltip content={<ClientCountTooltip />} />
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
        title: "Manager KPI",
        columns: [
            { key: "name", label: "Manager", format: "text" },
            { key: "totalAssigned", label: "Total Opps", format: "number" },
            { key: "wonCount", label: "Won", format: "number" },
            { key: "lostCount", label: "Lost", format: "number" },
            { key: "totalRevenue", label: "Won Revenue", format: "currency" },
            { key: "avgResponseDays", label: "Avg Days to Close", format: "number" },
        ],
        data: sales?.managerKpi || [],
    };

    // Stage tiles — bucketed counts/values + drill-down to project-level table
    const STAGE_BUCKETS: { label: string; stages: string[]; iconBg: string; iconColor: string; badgeColor: string }[] = [
        { label: 'Pipeline',    stages: ['Discovery', 'Pipeline'],                  iconBg: 'bg-sky-100',     iconColor: 'text-sky-600',     badgeColor: 'bg-sky-50 text-sky-700 border-sky-200' },
        { label: 'Presales',    stages: ['Qualification', 'Presales'],              iconBg: 'bg-amber-100',   iconColor: 'text-amber-600',   badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
        { label: 'Sales',       stages: ['Proposal', 'Sales'],                       iconBg: 'bg-purple-100',  iconColor: 'text-purple-600',  badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
        { label: 'Negotiation', stages: ['Negotiation'],                             iconBg: 'bg-indigo-100',  iconColor: 'text-indigo-600',  badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
        { label: 'Closed Won',  stages: ['Closed Won', 'Closed-Won', 'Delivered'],   iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        { label: 'Closed Lost', stages: ['Closed Lost', 'Proposal Lost'],            iconBg: 'bg-rose-100',    iconColor: 'text-rose-600',    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' },
    ];

    const stageProjectColumns: { key: string; label: string; format?: 'currency' | 'percent' | 'number' | 'text' }[] = [
        { key: 'name',               label: 'Project',         format: 'text' },
        { key: 'client',             label: 'Client',          format: 'text' },
        { key: 'value',              label: 'Value',           format: 'currency' },
        { key: 'currentStage',       label: 'Stage',           format: 'text' },
        { key: 'probability',        label: 'Probability',     format: 'percent' },
        { key: 'tentativeStartDate', label: 'Est. Start',      format: 'text' },
        { key: 'tentativeEndDate',   label: 'Est. End',        format: 'text' },
        { key: 'expectedCloseDate',  label: 'Opportunity Close Date',  format: 'text' },
        { key: 'technology',         label: 'Technology',      format: 'text' },
        { key: 'region',             label: 'Region',          format: 'text' },
        { key: 'owner',              label: 'Owner',           format: 'text' },
        { key: 'salesRepName',       label: 'Sales Rep',       format: 'text' },
        { key: 'managerName',        label: 'Manager',         format: 'text' },
        { key: 'daysInStage',        label: 'Days in Stage',   format: 'number' },
    ];

    const CLOSED_BUCKET_LABELS = ['Closed Won', 'Closed Lost'];
    const stageTiles = STAGE_BUCKETS.map(bucket => {
        const oppsInStage = opportunities.filter(o => bucket.stages.includes((o as any).currentStage));
        const totalValue = oppsInStage.reduce((sum, o) => sum + (Number(o.value) || 0), 0);
        // For closed tiles, surface the date the deal was actually won/lost.
        const columns = CLOSED_BUCKET_LABELS.includes(bucket.label)
            ? [
                ...stageProjectColumns.filter(c => c.key !== 'expectedCloseDate'),
                { key: 'actualCloseDate', label: 'Closed On', format: 'text' as const },
            ]
            : stageProjectColumns;
        const drill: DrillDownConfig = {
            title: `${bucket.label} — Project Details`,
            columns,
            data: oppsInStage,
            dateKey: CLOSED_BUCKET_LABELS.includes(bucket.label) ? 'actualCloseDate' : 'expectedCloseDate',
        };
        return { ...bucket, count: oppsInStage.length, totalValue, drill };
    });

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
                { key: "expectedCloseDate", label: "Opportunity Close Date", format: "text" },
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
                { key: "expectedCloseDate", label: "Opportunity Close Date", format: "text" },
                { key: "actualCloseDate", label: "Actual Close", format: "text" },
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
                { key: "expectedCloseDate", label: "Opportunity Close Date", format: "text" },
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
                { key: "expectedCloseDate", label: "Opportunity Close Date", format: "text" },
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
                { key: "expectedCloseDate", label: "Opportunity Close Date", format: "text" },
                { key: "actualCloseDate", label: "Actual Close", format: "text" },
                { key: "owner", label: "Owner", format: "text" },
                { key: "salesRepName", label: "Sales Rep", format: "text" },
                { key: "technology", label: "Technology", format: "text" },
            ],
            data: opportunities.filter(o => ['Closed Won', 'Closed-Won', 'Closed Lost', 'Proposal Lost'].includes(o.currentStage)),
        },
        { // Avg Close Time
            title: "Deals – Cycle Time (Closed Deals)",
            columns: [
                { key: "name", label: "Opportunity", format: "text" },
                { key: "client", label: "Client", format: "text" },
                { key: "value", label: "Value", format: "currency" },
                { key: "currentStage", label: "Stage", format: "text" },
                { key: "createdAt", label: "Created", format: "text" },
                { key: "actualCloseDate", label: "Closed On", format: "text" },
                { key: "daysToClose", label: "Days to Close", format: "text" },
            ],
            // Avg Close Time is computed only over closed (won/lost) deals, so
            // the drill-down must show only those — not every opportunity.
            // Days to Close is fractional (based on the actual hours between
            // creation and close) so same-day closes don't read as "0".
            data: opportunities
                .filter(o => ['Closed Won', 'Closed-Won', 'Closed Lost', 'Proposal Lost', 'Delivered'].includes(o.currentStage))
                .map(o => {
                    // daysToClose comes from the backend as a fractional number
                    // (full-timestamp precision). Format for display.
                    const d = (o as any).daysToClose;
                    const display = (d == null || isNaN(Number(d)))
                        ? '—'
                        : (Number(d) < 1 ? Number(d).toFixed(2) : Number(d) < 10 ? Number(d).toFixed(1) : Number(d).toFixed(0));
                    return { ...o, daysToClose: display };
                }),
            dateKey: 'actualCloseDate',
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
        <div className="space-y-2 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h1 className="text-sm font-semibold text-slate-900">
                    Dashboard
                    {user?.name && <span className="ml-2 text-[11px] font-normal text-slate-400">Welcome back, {user.name.split(' ')[0]}</span>}
                </h1>
                <button
                    type="button"
                    onClick={() => fetchDashboard(true)}
                    disabled={refreshing}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
                    title="Refresh dashboard data"
                >
                    <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>

            {/* Stats Grid — tight 7-col, each expandable */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
                {stats.map((stat, idx) => (
                    <ExpandableCard key={idx} drillConfig={statDrills[idx]} className="bg-white rounded-md px-2 py-1.5 border border-slate-100 hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-1 mb-0.5">
                            <div className={`p-0.5 rounded ${stat.iconBg}`}>
                                <stat.icon className={`w-2.5 h-2.5 ${stat.iconColor}`} />
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium truncate">{stat.title}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 leading-tight">{stat.value}</p>
                        <p className="text-[10px] text-slate-400 truncate leading-tight">{stat.subtitle}</p>
                    </ExpandableCard>
                ))}
            </div>

            {/* Stage Tiles — click to view project-level details */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
                {stageTiles.map(tile => (
                    <ExpandableCard key={tile.label} drillConfig={tile.drill} className="bg-white rounded-md px-2 py-1.5 border border-slate-100 hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-1 mb-0.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${tile.badgeColor}`}>{tile.label}</span>
                            <span className="text-[10px] text-slate-400 ml-auto">{tile.count}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 leading-tight">{fmtCurrency(tile.totalValue)}</p>
                        <p className="text-[10px] text-slate-400 truncate leading-tight">{tile.count} {tile.count === 1 ? 'opportunity' : 'opportunities'}</p>
                    </ExpandableCard>
                ))}
            </div>

            {/* Pending Actions — only the logged-in user's own open opportunities */}
            {user?.name && (
                <PendingActionsPanel
                    opportunities={opportunities}
                    userName={user.name}
                    onOpen={(id) => router.push(`/dashboard/opportunities/${id}`)}
                    fmtCurrency={fmtCurrency}
                />
            )}

            {/* Row 1: Revenue chart + Stage pie */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-1.5">
                <ExpandableCard drillConfig={revenueDrill} className="lg:col-span-3 bg-white rounded-md border border-slate-100">
                    <div className="flex items-center justify-between px-2.5 pt-1.5 pb-1">
                        <h3 className="font-medium text-xs text-slate-700">Revenue Projection</h3>
                    </div>
                    <div className="px-2.5 pb-2">
                        <div className="h-[160px] w-full">
                            {revenueData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={revenueData} barSize={12} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={(v) => fmtCurrency(v)} width={45} />
                                        <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '6px 10px' }} formatter={(value: number) => [fmtCurrency(value), undefined]} />
                                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} iconType="circle" iconSize={8} />
                                        <Bar dataKey="proposed" name="Proposed" fill="#6366f1" radius={[2, 2, 0, 0]} />
                                        <Bar dataKey="actual" name="Won" fill="#10b981" radius={[2, 2, 0, 0]} />
                                        <Bar dataKey="lost" name="Lost" fill="#ef4444" radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <div className="flex items-center justify-center h-full text-slate-300 text-xs">No data</div>}
                        </div>
                    </div>
                </ExpandableCard>

                <ExpandableCard drillConfig={stageDrill} className="bg-white rounded-md border border-slate-100 px-2.5 py-1.5">
                    <h3 className="font-medium text-xs text-slate-700 mb-0.5">By Stage</h3>
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
                                        <Tooltip content={<StageTooltip />} />
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-1.5">
                <ExpandableCard drillConfig={salespersonDrill} className="bg-white rounded-md border border-slate-100 px-2.5 py-1.5">
                    <h3 className="font-medium text-xs text-slate-700 mb-0.5">Opps by Salesperson</h3>
                    {ownerData.length > 0 ? (
                        <div className="h-[130px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ownerData} layout="vertical" margin={{ left: 0, right: 5 }} barSize={10}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} allowDecimals={false} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={<TruncatedTick />} width={110} interval={0} />
                                    <Tooltip content={<OwnerTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '2px' }} iconSize={8} />
                                    <Bar dataKey="active" name="Active" fill="#6366f1" stackId="a" />
                                    <Bar dataKey="won" name="Won" fill="#10b981" stackId="a" radius={[0, 2, 2, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="flex items-center justify-center h-[130px] text-slate-300 text-xs">No data</div>}
                </ExpandableCard>

                <ExpandableCard drillConfig={techRevDrill} className="bg-white rounded-md border border-slate-100 px-2.5 py-1.5">
                    <h3 className="font-medium text-xs text-slate-700 mb-0.5">Revenue by Tech Stack</h3>
                    {techRevenueData.length > 0 ? (
                        <div className="h-[130px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={techRevenueData.slice(0,6)} layout="vertical" margin={{ left: 0, right: 5 }} barSize={10}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={(v) => fmtCurrency(v)} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} width={65} />
                                    <Tooltip content={<TechRevTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '2px' }} iconSize={8} />
                                    <Bar dataKey="value" name="Revenue" fill="#8b5cf6" radius={[0, 2, 2, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="flex items-center justify-center h-[130px] text-slate-300 text-xs">No data</div>}
                </ExpandableCard>

                <ExpandableCard drillConfig={clientRevDrill} className="bg-white rounded-md border border-slate-100 px-2.5 py-1.5">
                    <h3 className="font-medium text-xs text-slate-700 mb-0.5">Revenue by Client</h3>
                    {clientRevenueData.length > 0 ? (
                        <div className="h-[130px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={clientRevenueData.slice(0,6)} layout="vertical" margin={{ left: 0, right: 5 }} barSize={10}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={(v) => fmtCurrency(v)} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} width={80} />
                                    <Tooltip content={<ClientRevTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '2px' }} iconSize={8} />
                                    <Bar dataKey="value" name="Revenue" fill="#ec4899" radius={[0, 2, 2, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="flex items-center justify-center h-[130px] text-slate-300 text-xs">No data</div>}
                </ExpandableCard>
            </div>

            {/* Row 3: Rev by Sales Rep + Client count */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                <ExpandableCard drillConfig={salesRepRevDrill} className="bg-white rounded-md border border-slate-100 px-2.5 py-1.5">
                    <h3 className="font-medium text-xs text-slate-700 mb-0.5">Revenue by Sales Rep</h3>
                    {ownerRevenueData.length > 0 ? (
                        <div className="h-[120px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ownerRevenueData} layout="vertical" margin={{ left: 0, right: 5 }} barSize={10}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={(v) => fmtCurrency(v)} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={<TruncatedTick />} width={110} interval={0} />
                                    <Tooltip content={<SalesRepRevTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '2px' }} iconSize={8} />
                                    <Bar dataKey="revenue" name="Revenue" fill="#0ea5e9" radius={[0, 2, 2, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="flex items-center justify-center h-[120px] text-slate-300 text-xs">No data</div>}
                </ExpandableCard>

                <ExpandableCard drillConfig={clientCountDrill} className="bg-white rounded-md border border-slate-100 px-2.5 py-1.5">
                    <h3 className="font-medium text-xs text-slate-700 mb-0.5">Opps by Client</h3>
                    {clientCountData.length > 0 ? (
                        <div className="h-[120px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={clientCountData.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 5 }} barSize={10}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} allowDecimals={false} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9 }} width={80} />
                                    <Tooltip content={<ClientCountTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '2px' }} iconSize={8} />
                                    <Bar dataKey="value" name="Count" fill="#f59e0b" radius={[0, 2, 2, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : <div className="flex items-center justify-center h-[120px] text-slate-300 text-xs">No data</div>}
                </ExpandableCard>
            </div>

            {/* Row 4: Recent Opps table + Manager KPI + Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-1.5">
                {/* Recent Opportunities — compact table */}
                <ExpandableCard drillConfig={recentOppsDrill} className="lg:col-span-6 bg-white rounded-md border border-slate-100 px-2.5 py-1.5 overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
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
                                            <td className="py-1.5 text-slate-600">{fmtCurrency(opp.value)}</td>
                                            <td className="py-1.5">
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${STAGE_COLORS[STAGE_DISPLAY[opp.currentStage] || opp.currentStage] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                                                    {STAGE_DISPLAY[opp.currentStage] || opp.currentStage}
                                                </span>
                                            </td>
                                            <td className="py-1.5">
                                                <div className="flex items-center gap-1">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${opp.status === 'healthy' ? 'bg-emerald-500' : opp.status === 'closed' ? 'bg-slate-400' : opp.status === 'at-risk' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                                    <span className="text-slate-500">{opp.status === 'closed' ? 'Closed' : `${opp.healthScore}%`}</span>
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
                <ExpandableCard drillConfig={managerKpiDrill} className="lg:col-span-3 bg-white rounded-md border border-slate-100 px-2.5 py-1.5">
                    <h3 className="font-medium text-xs text-slate-700 mb-1">Manager KPI</h3>
                    {(sales?.managerKpi || []).length > 0 ? (
                        <table className="w-full text-[10px]">
                            <thead>
                                <tr className="border-b border-slate-50 text-left text-slate-400">
                                    <th className="pb-1 font-medium">Manager</th>
                                    <th className="pb-1 font-medium text-center">Opps</th>
                                    <th className="pb-1 font-medium text-center">Won</th>
                                    <th className="pb-1 font-medium text-center">Lost</th>
                                    <th className="pb-1 font-medium text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(sales?.managerKpi || []).map((mgr) => (
                                    <tr key={mgr.name} className="border-b border-slate-50/50 last:border-0">
                                        <td className="py-1.5 font-medium text-slate-700 truncate max-w-[90px]">{mgr.name}</td>
                                        <td className="py-1.5 text-center text-slate-500">{mgr.totalAssigned}</td>
                                        <td className="py-1.5 text-center text-emerald-600 font-semibold">{mgr.wonCount}</td>
                                        <td className="py-1.5 text-center text-red-500 font-semibold">{mgr.lostCount}</td>
                                        <td className="py-1.5 text-right text-slate-600">{fmtCurrency(mgr.totalRevenue || 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <div className="text-center py-3 text-slate-300 text-[10px]">No manager data</div>}
                </ExpandableCard>

                {/* AI Insights + Quick Stats */}
                <ExpandableCard drillConfig={insightsDrill} className="lg:col-span-3 bg-white rounded-md border border-slate-100 px-2.5 py-1.5">
                    <h3 className="font-medium text-xs text-slate-700 mb-1">Insights</h3>
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
