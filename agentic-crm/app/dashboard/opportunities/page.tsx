"use client";

import { motion } from "framer-motion";
import {
    Plus,
    Search,
    Filter,
    MoreVertical,
    ArrowRight,
    Clock,
    CheckCircle2,
    AlertCircle,
    Trash2,
    Edit,
    ChevronLeft,
    ChevronRight,
    Calendar,
    CalendarCheck,
    CalendarClock,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    X,
    Users,
    DollarSign,
    Target,
    Info,
    Paperclip,
} from "lucide-react";
import Link from "next/link";
import { useOpportunityStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { API_URL, getAuthHeaders } from "@/lib/api";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import KanbanBoard from "@/components/opportunities/KanbanBoard";
import { useCurrency } from "@/components/providers/currency-provider";
import { ByOwnerBoard } from "./components/ByOwnerBoard";

// Column model for the list. `serverSort` columns are sorted in the DB (so the
// whole filtered dataset is ordered, not just the current page); `clientSort`
// columns are computed values sorted on the loaded page. `filter` columns get
// an inline per-column filter input (Pending Actions–style) that maps to a
// case-insensitive "contains" query param resolved server-side.
type ListColumn = {
    key: string;
    label: string;
    sort?: 'server' | 'client' | null;
    filter?: boolean;
};

const LIST_COLUMNS: ListColumn[] = [
    { key: 'name', label: 'Opportunity Name', sort: 'server', filter: true },
    { key: 'stage', label: 'Stage', sort: 'server', filter: true },
    { key: 'value', label: 'Estimated value', sort: 'server' },
    { key: 'quote', label: 'Quote' },
    { key: 'probability', label: 'Prob.', sort: 'client' },
    { key: 'salesRep', label: 'Sales Rep', sort: 'server', filter: true },
    { key: 'manager', label: 'Manager', sort: 'server', filter: true },
    { key: 'department', label: 'Department', sort: 'server', filter: true },
    { key: 'technology', label: 'Technology', sort: 'server', filter: true },
    { key: 'createdAt', label: 'Created', sort: 'server' },
    { key: 'startDate', label: 'Start Date', sort: 'server' },
    { key: 'endDate', label: 'Est. End', sort: 'server' },
    { key: 'closeDate', label: 'Close Date', sort: 'server' },
    { key: 'lastActivity', label: 'Last Activity', sort: 'client' },
];

// Columns whose sort is resolved in the DB (sent to the backend).
const SERVER_SORT_KEYS = LIST_COLUMNS.filter(c => c.sort === 'server').map(c => c.key);
// Columns with an inline server-side filter input.
const FILTER_KEYS = LIST_COLUMNS.filter(c => c.filter).map(c => c.key);

type ColFilters = Record<string, string>;
const EMPTY_FILTERS: ColFilters = {};

export default function OpportunitiesPage() {
    const { opportunities, deleteOpportunity, fetchOpportunities, total, page, totalPages, isLoading } = useOpportunityStore();
    const { hasPermission } = useAuthStore();
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const PAGE_SIZE_OPTIONS: { label: string; value: number }[] = [
        { label: '10', value: 10 },
        { label: '25', value: 25 },
        { label: '50', value: 50 },
        { label: '100', value: 100 },
        { label: 'ALL', value: 0 },
    ];

    const isViewOnly = useCallback((opp: any) => opp.access?.canEdit === false, []);
    const canCreateOpportunity = hasPermission("pipeline:write");

    const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'by_owner'>('list');
    const { currency: globalCurrency, getSymbol, getRate } = useCurrency();

    // Attachment popover state
    type AttachItem = { id: string; originalName: string; category: string };
    const [attachPopup, setAttachPopup] = useState<{ oppId: string; items: AttachItem[] } | null>(null);
    const attachPopupRef = useRef<HTMLDivElement>(null);

    const openAttachPopup = useCallback(async (oppId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (attachPopup?.oppId === oppId) { setAttachPopup(null); return; }
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${oppId}/attachments`, { headers: getAuthHeaders() });
            const data = await res.json();
            setAttachPopup({ oppId, items: Array.isArray(data) ? data : [] });
        } catch {
            setAttachPopup({ oppId, items: [] });
        }
    }, [attachPopup]);

    // Close popup on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (attachPopupRef.current && !attachPopupRef.current.contains(e.target as Node)) {
                setAttachPopup(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [showFilters, setShowFilters] = useState(false);
    // One case-insensitive "contains" value per filterable column. Empty/absent
    // = no filter. Mirrors the dashboard "Your Pending Actions" panel, but the
    // matching happens server-side so it covers the whole paginated dataset.
    const [colFilters, setColFilters] = useState<ColFilters>(EMPTY_FILTERS);
    // Distinct values per filterable column for the type-ahead dropdowns.
    const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>({});

    useEffect(() => {
        fetch(`${API_URL}/api/opportunities/filter-options`, { headers: getAuthHeaders() })
            .then((r) => (r.ok ? r.json() : {}))
            .then((data: any) => setFilterOptions(data && typeof data === 'object' ? data : {}))
            .catch(() => { /* suggestions are best-effort; filtering still works via free text */ });
    }, []);

    const activeFilterCount = useMemo(
        () => FILTER_KEYS.reduce((n, k) => n + ((colFilters[k] || '').trim() ? 1 : 0), 0),
        [colFilters]
    );

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const SortIcon = ({ col }: { col: string }) => {
        if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
        return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />;
    };

    const buildQueryParams = useCallback((pg: number, search: string, filters: ColFilters, fetchMax: boolean, lim?: number) => {
        const params: any = {
            page: pg,
            limit: fetchMax ? 500 : (lim !== undefined ? (lim === 0 ? 500 : lim) : (limit === 0 ? 500 : limit)),
            search,
        };
        FILTER_KEYS.forEach((k) => {
            const v = (filters[k] || '').trim();
            if (v) params[k] = v;
        });
        if (sortKey && SERVER_SORT_KEYS.includes(sortKey)) {
            params.sortKey = sortKey;
            params.sortDir = sortDir;
        }
        return params;
    }, [limit, sortKey, sortDir]);

    // Server resolves filters + DB-backed sorts; only computed columns
    // (probability, last activity) are ordered client-side on the loaded page.
    const CLIENT_SORT_KEYS = ['probability', 'lastActivity'];
    const sortedOpportunities = useMemo(() => {
        if (!sortKey || !CLIENT_SORT_KEYS.includes(sortKey)) return opportunities;
        return [...opportunities].sort((a, b) => {
            const av = sortKey === 'probability' ? (a.probability ?? 0) : (a.daysInStage ?? 0);
            const bv = sortKey === 'probability' ? (b.probability ?? 0) : (b.daysInStage ?? 0);
            return sortDir === 'asc' ? av - bv : bv - av;
        });
    }, [opportunities, sortKey, sortDir]);

    const loadPage = useCallback((pg: number, search?: string, filters?: ColFilters, lim?: number) => {
        setCurrentPage(pg);
        fetchOpportunities(buildQueryParams(pg, search ?? searchTerm, filters ?? colFilters, viewMode === 'kanban' || viewMode === 'by_owner', lim));
    }, [fetchOpportunities, searchTerm, colFilters, viewMode, buildQueryParams]);

    useEffect(() => {
        loadPage(1, "", EMPTY_FILTERS);
    }, []);

    // Reload all opportunities when switching to kanban mode
    useEffect(() => {
        fetchOpportunities(buildQueryParams(currentPage, searchTerm, colFilters, viewMode === 'kanban' || viewMode === 'by_owner'));
    }, [viewMode]);

    // Debounced refetch whenever the global search, any column filter, or the
    // server-side sort changes. Skips the first render (initial load above).
    const didMount = useRef(false);
    useEffect(() => {
        if (!didMount.current) { didMount.current = true; return; }
        const timer = setTimeout(() => {
            setCurrentPage(1);
            fetchOpportunities(buildQueryParams(1, searchTerm, colFilters, viewMode === 'kanban' || viewMode === 'by_owner'));
        }, 350);
        return () => clearTimeout(timer);
    }, [searchTerm, colFilters, sortKey, sortDir]);

    const setColFilter = (key: string, val: string) =>
        setColFilters((prev) => ({ ...prev, [key]: val }));

    const handleClearFilters = () => {
        setColFilters(EMPTY_FILTERS);
        setShowFilters(false);
        setCurrentPage(1);
        fetchOpportunities(buildQueryParams(1, searchTerm, EMPTY_FILTERS, viewMode === 'kanban' || viewMode === 'by_owner'));
    };

    const effectiveLimit = limit === 0 ? total : limit;
    const startRecord = total === 0 ? 0 : (currentPage - 1) * effectiveLimit + 1;
    const endRecord = Math.min(currentPage * effectiveLimit, total);

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] animate-in fade-in duration-500 overflow-hidden">
            <div className="flex-none space-y-4 pb-4">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                        Opportunities
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">Manage your pipeline and track deal progress.</p>
                </div>
                <div className="flex gap-2 relative">
                    <button
                        onClick={() => setShowFilters((prev) => !prev)}
                        className={`btn-ghost bg-white border text-slate-600 flex items-center gap-1.5 ${showFilters || activeFilterCount > 0 ? 'border-indigo-300 text-indigo-600' : 'border-slate-200'}`}
                    >
                        <Filter className="w-3.5 h-3.5" />
                        Filter
                        {activeFilterCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                    {canCreateOpportunity && (
                        <Link href="/dashboard/opportunities/new">
                            <button className="btn-primary flex items-center gap-1.5">
                                <Plus className="w-4 h-4" />
                                New Opportunity
                            </button>
                        </Link>
                    )}
                </div>
            </div>

            {/* Kanban / Pipeline View Selection */}
            <div className="flex items-center gap-3 border-b border-slate-200 pb-1">
                <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${viewMode === 'list'
                        ? 'text-indigo-600 border-indigo-600'
                        : 'text-slate-500 border-transparent hover:text-indigo-600'}`}
                >
                    List View
                </button>
                <button
                    onClick={() => setViewMode('kanban')}
                    className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${viewMode === 'kanban'
                        ? 'text-indigo-600 border-indigo-600'
                        : 'text-slate-500 border-transparent hover:text-indigo-600'}`}
                >
                    Kanban Board
                </button>
                <button
                    onClick={() => setViewMode('by_owner')}
                    className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${viewMode === 'by_owner'
                        ? 'text-indigo-600 border-indigo-600'
                        : 'text-slate-500 border-transparent hover:text-indigo-600'}`}
                >
                    By Owner
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search opportunities by name, client, or owner..."
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2">
                    {LIST_COLUMNS.filter(c => c.filter && (colFilters[c.key] || '').trim()).map(c => (
                        <span key={c.key} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium">
                            {c.label}: {colFilters[c.key].trim()}
                        </span>
                    ))}
                    <button
                        onClick={handleClearFilters}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-medium hover:bg-red-100"
                    >
                        <X className="w-3 h-3" />
                        Clear all
                    </button>
                </div>
            )}
            </div>

            {/* Opportunities View */}
            {viewMode === 'list' ? (
                <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
                    <div className="flex-1 overflow-auto">
                        <table className="w-full relative">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                                <tr>
                                    {LIST_COLUMNS.map((col) => (
                                        <th
                                            key={col.key}
                                            className={`text-left py-2.5 px-4 font-semibold text-slate-600 text-xs select-none ${col.sort ? 'cursor-pointer hover:bg-slate-100' : ''}`}
                                            onClick={col.sort ? () => handleSort(col.key) : undefined}
                                        >
                                            <span className="flex items-center gap-1">{col.label}{col.sort && <SortIcon col={col.key} />}</span>
                                        </th>
                                    ))}
                                    <th className="w-10"></th>
                                </tr>
                                {showFilters && (
                                    <tr className="bg-white">
                                        {LIST_COLUMNS.map((col) => (
                                            <th key={col.key} className="px-3 pb-2 pt-1 align-top">
                                                {col.filter ? (
                                                    <>
                                                        <input
                                                            list={`opp-filter-${col.key}`}
                                                            autoComplete="off"
                                                            value={colFilters[col.key] || ''}
                                                            onChange={(e) => setColFilter(col.key, e.target.value)}
                                                            placeholder="filter…"
                                                            className="w-full min-w-[90px] px-2 py-1 text-[11px] font-normal border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                                        />
                                                        <datalist id={`opp-filter-${col.key}`}>
                                                            {(filterOptions[col.key] || []).map((o) => (
                                                                <option key={o} value={o} />
                                                            ))}
                                                        </datalist>
                                                    </>
                                                ) : null}
                                            </th>
                                        ))}
                                        <th className="w-10"></th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {opportunities.length === 0 ? (
                                    <tr>
                                        <td colSpan={LIST_COLUMNS.length + 1} className="py-8 text-center text-slate-400 text-sm">
                                            No opportunities found for the current search/filter selection.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedOpportunities.map((opp) => (
                                        <tr key={opp.id} className="hover:bg-slate-50/80 transition-colors group"
                                        title={(() => {
                                            const oppCurr = (opp as any).currency || globalCurrency;
                                            const oppCurrSym = getSymbol(oppCurr);
                                            const globalSym = getSymbol(globalCurrency);
                                            const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                                            const rates = (opp as any).metadata?.exchangeRatesSnapshot;
                                            const toGlobal = (v: number) => {
                                                if (oppCurr === globalCurrency) return v;
                                                if (rates && rates[oppCurr] && rates[globalCurrency]) return (v * rates[globalCurrency]) / rates[oppCurr];
                                                const rOpp = getRate(oppCurr), rGlob = getRate(globalCurrency);
                                                if (rOpp && rGlob) return (v * rGlob) / rOpp;
                                                return v;
                                            };
                                            const valNum = typeof opp.value === 'number' ? opp.value : Number(opp.value) || 0;
                                            const quoteNum = (opp as any).quote != null ? Number((opp as any).quote) : null;
                                            const valDisplay = oppCurr === globalCurrency
                                                ? `${globalSym}${fmt(valNum)}`
                                                : `${globalSym}${fmt(toGlobal(valNum))} (${oppCurrSym}${fmt(valNum)})`;
                                            const quoteDisplay = quoteNum == null
                                                ? 'N/A'
                                                : oppCurr === globalCurrency
                                                    ? `${globalSym}${fmt(quoteNum)}`
                                                    : `${globalSym}${fmt(toGlobal(quoteNum))} (${oppCurrSym}${fmt(quoteNum)})`;
                                            return `${opp.name}\nClient: ${opp.client}\nOwner: ${opp.owner}\nStage: ${opp.stage}\nEstimated Value: ${valDisplay}\nQuote: ${quoteDisplay}\nProbability: ${opp.probability}%\nSales Rep: ${opp.salesRepName || 'N/A'}\nManager: ${opp.managerName || 'N/A'}\nHealth: ${opp.healthScore ?? 'N/A'}/100\nStatus: ${opp.status}\nLast Activity: ${opp.lastActivity}\nCreated: ${opp.createdAt || 'N/A'}\nExpected Close: ${opp.expectedCloseDate || 'N/A'}\nStart Date: ${opp.tentativeStartDate || 'N/A'}\nEnd Date: ${opp.tentativeEndDate || 'N/A'}`;
                                        })()}
                                        >
                                            <td className="py-2.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className={`w-2 h-2 rounded-full ${opp.status === 'healthy' ? 'bg-emerald-500' :
                                                            opp.status === 'at-risk' ? 'bg-amber-500' : 'bg-red-500'
                                                            }`}
                                                        title={`Status: ${opp.status} (Health: ${opp.healthScore}/100)`}
                                                    />
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Link href={`/dashboard/opportunities/${opp.id}`} className="font-semibold text-xs text-slate-800 hover:text-indigo-600 hover:underline">
                                                                {opp.name}
                                                            </Link>
                                                            {(opp as any).attachmentCount > 0 && (
                                                                <div className="relative">
                                                                    <button
                                                                        onClick={(e) => openAttachPopup(opp.id, e)}
                                                                        className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 transition-colors"
                                                                        title={`${(opp as any).attachmentCount} attachment(s)`}
                                                                    >
                                                                        <Paperclip className="w-2.5 h-2.5" />
                                                                        <span className="text-[10px] font-medium">{(opp as any).attachmentCount}</span>
                                                                    </button>
                                                                    {attachPopup?.oppId === opp.id && (
                                                                        <div
                                                                            ref={attachPopupRef}
                                                                            className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[220px] max-w-[320px] py-1"
                                                                        >
                                                                            {attachPopup.items.length === 0 ? (
                                                                                <p className="px-3 py-2 text-xs text-slate-400">No attachments found</p>
                                                                            ) : attachPopup.items.map(att => (
                                                                                <a
                                                                                    key={att.id}
                                                                                    href={`${API_URL}/api/opportunities/${opp.id}/attachments/${att.id}/download`}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 truncate"
                                                                                    onClick={() => setAttachPopup(null)}
                                                                                >
                                                                                    <Paperclip className="w-3 h-3 shrink-0 text-slate-400" />
                                                                                    <span className="truncate">{att.originalName}</span>
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500">{opp.client} • {opp.owner}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                                                        opp.stage === 'Negotiation' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                        opp.stage === 'Closed Won' || opp.stage === 'Commit' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        opp.stage === 'Closed Lost' ? 'bg-red-50 text-red-700 border-red-200' :
                                                        opp.stage === 'Proposal Lost' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                        opp.stage === 'Proposal' ? 'bg-pink-50 text-pink-700 border-pink-200' :
                                                        'bg-slate-100 text-slate-700 border-slate-200'
                                                    }`}>
                                                        {opp.stage}
                                                    </span>
                                                    {opp.detailedStatus === 'On Hold' ? (
                                                        <span className="text-[10px] text-amber-800 font-medium px-1.5 py-0.5 bg-amber-100 rounded-md border border-amber-300">
                                                            On Hold
                                                        </span>
                                                    ) : opp.status === 'stalled' ? (
                                                        <span className="text-[10px] text-orange-800 font-medium px-1.5 py-0.5 bg-orange-100 rounded-md border border-orange-300">
                                                            Stalled
                                                        </span>
                                                    ) : opp.detailedStatus && !['Lost', 'Won', 'Open'].includes(opp.detailedStatus) ? (
                                                        <span className="text-[10px] text-slate-500 font-medium px-1 bg-slate-100 rounded border border-slate-200">
                                                            {opp.detailedStatus}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <span className="font-medium text-xs text-slate-700">
                                                    {(() => {
                                                        const val = typeof opp.value === 'number' ? opp.value : Number(opp.value) || 0;
                                                        const oppCurr = (opp as any).currency || 'USD';
                                                        if (oppCurr === globalCurrency) {
                                                            return `${getSymbol(globalCurrency)}${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
                                                        }
                                                        
                                                        const rates = (opp as any).metadata?.exchangeRatesSnapshot;
                                                        if (rates && rates[oppCurr] && rates[globalCurrency]) {
                                                            const converted = (val * rates[globalCurrency]) / rates[oppCurr];
                                                            return (
                                                                <>
                                                                    {getSymbol(globalCurrency)}{converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                                    <span className="text-[11px] text-slate-500 ml-1 font-normal">
                                                                        ({getSymbol(oppCurr)}{val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })})
                                                                    </span>
                                                                </>
                                                            );
                                                        }
                                                        
                                                        const convertedLive = (val * getRate(globalCurrency)) / getRate(oppCurr);
                                                        return (
                                                            <>
                                                                {getSymbol(globalCurrency)}{convertedLive.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                                <span className="text-[11px] text-slate-500 ml-1 font-normal">
                                                                    ({getSymbol(oppCurr)}{val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })})
                                                                </span>
                                                            </>
                                                        );
                                                    })()}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <span className="font-medium text-xs text-slate-700">
                                                    {(opp as any).quote != null ? (
                                                        <>
                                                            {getSymbol(globalCurrency)}
                                                            {(() => {
                                                                const val = Number((opp as any).quote);
                                                                const oppCurr = (opp as any).currency || 'USD';
                                                                if (oppCurr === globalCurrency) {
                                                                    return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                                                                }
                                                                const rates = (opp as any).metadata?.exchangeRatesSnapshot;
                                                                if (rates && rates[oppCurr] && rates[globalCurrency]) {
                                                                    return ((val * rates[globalCurrency]) / rates[oppCurr]).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                                                                }
                                                                return ((val * getRate(globalCurrency)) / getRate(oppCurr)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                                                            })()}
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-300">—</span>
                                                    )}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-indigo-500 rounded-full"
                                                            style={{ width: `${opp.probability}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[11px] font-medium text-slate-600">{opp.probability}%</span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4 text-[11px] text-slate-600">
                                                {opp.salesRepName || <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-[11px] text-slate-600">
                                                {opp.managerName || <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-[11px] text-slate-600">
                                                {opp.department || <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-[11px] text-slate-600 max-w-[180px]">
                                                {opp.technology
                                                    ? <span className="block truncate" title={opp.technology}>{opp.technology}</span>
                                                    : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                                                {opp.createdAt
                                                    ? <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" />{opp.createdAt}</span>
                                                    : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-[11px] whitespace-nowrap">
                                                {opp.tentativeStartDate
                                                    ? <span className="flex items-center gap-1 text-indigo-600"><CalendarClock className="w-3 h-3" />{opp.tentativeStartDate}</span>
                                                    : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-[11px] whitespace-nowrap">
                                                {opp.actualCloseDate
                                                    ? <span className="flex items-center gap-1 text-purple-600 font-medium"><CalendarClock className="w-3 h-3" />{opp.actualCloseDate}</span>
                                                    : opp.tentativeEndDate
                                                        ? <span className="flex items-center gap-1 text-slate-500"><CalendarClock className="w-3 h-3 text-slate-400" />Est. {opp.tentativeEndDate}</span>
                                                        : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-[11px] whitespace-nowrap">
                                                {opp.actualCloseDate
                                                    ? <span className="flex items-center gap-1 text-emerald-600 font-medium"><CalendarCheck className="w-3 h-3" />{opp.actualCloseDate}</span>
                                                    : opp.expectedCloseDate
                                                        ? <span className="flex items-center gap-1 text-amber-600"><CalendarCheck className="w-3 h-3" />{opp.expectedCloseDate}</span>
                                                        : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-[11px] text-slate-500">
                                                {opp.lastActivity}
                                            </td>
                                            <td className="py-2.5 px-4 relative">
                                                <button
                                                    onClick={() => setActiveMenu(activeMenu === opp.id ? null : opp.id)}
                                                    className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>

                                                {/* Simple Dropdown Menu */}
                                                {activeMenu === opp.id && (
                                                    <>
                                                        <div
                                                            className="fixed inset-0 z-10"
                                                            onClick={() => setActiveMenu(null)}
                                                        />
                                                        <div className="absolute right-8 top-8 z-20 w-48 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                            <Link
                                                                href={`/dashboard/opportunities/${opp.id}`}
                                                                title={opp.access?.viewOnlyReason || undefined}
                                                                className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                                                            >
                                                                {isViewOnly(opp) ? <Info className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                                                                {isViewOnly(opp) ? "View Details" : "Edit Details"}
                                                            </Link>
                                                            {!isViewOnly(opp) && (
                                                                <button
                                                                    onClick={() => {
                                                                        deleteOpportunity(opp.id);
                                                                        setActiveMenu(null);
                                                                    }}
                                                                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                    Delete Opportunity
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination / Footer */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200">
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500">
                                {total === 0 ? 'No opportunities' : `Showing ${startRecord}–${endRecord} of ${total} opportunities`}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-400">Rows:</span>
                                <select
                                    value={limit}
                                    onChange={(e) => {
                                        const newLim = Number(e.target.value);
                                        setLimit(newLim);
                                        setCurrentPage(1);
                                        fetchOpportunities(buildQueryParams(1, searchTerm, colFilters, false, newLim));
                                    }}
                                    className="px-2 py-0.5 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                >
                                    {PAGE_SIZE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    disabled={currentPage <= 1}
                                    onClick={() => loadPage(currentPage - 1)}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Previous
                                </button>
                                <span className="text-sm text-slate-600 font-medium px-2">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    disabled={currentPage >= totalPages}
                                    onClick={() => loadPage(currentPage + 1)}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Next <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : viewMode === 'kanban' ? (
                <KanbanBoard />
            ) : (
                <ByOwnerBoard opportunities={sortedOpportunities} globalCurrency={globalCurrency} />
            )}
        </div>
    );
}
