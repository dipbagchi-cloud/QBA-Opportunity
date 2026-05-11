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
    X
} from "lucide-react";
import Link from "next/link";
import { useOpportunityStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { useState, useEffect, useCallback, useMemo } from "react";
import KanbanBoard from "@/components/opportunities/KanbanBoard";
import { useCurrency } from "@/components/providers/currency-provider";
import { ByOwnerBoard } from "./components/ByOwnerBoard";

const STAGE_OPTIONS = [
    "Discovery",
    "Qualification",
    "Proposal",
    "Negotiation",
    "Closed Won",
    "Closed Lost",
    "Proposal Lost",
];

type OpportunityFilters = {
    stages: string[];
    client: string;
    owner: string;
    salesRep: string;
    manager: string;
};

const EMPTY_FILTERS: OpportunityFilters = {
    stages: [],
    client: "",
    owner: "",
    salesRep: "",
    manager: "",
};

export default function OpportunitiesPage() {
    const { opportunities, deleteOpportunity, fetchOpportunities, total, page, totalPages, isLoading } = useOpportunityStore();
    const { user } = useAuthStore();
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const limit = 10;

    const isViewOnly = useCallback((opp: any) => {
        if (!user) return true;
        const role = user.role.name.toLowerCase();
        if (role === 'sales' || role === 'presales') {
            const isOwner = opp.owner === user.name;
            const isAssigned = opp.salesRepName === user.name || opp.managerName === user.name;
            return !isOwner && !isAssigned;
        }
        return false;
    }, [user]);

    const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'by_owner'>('list');
    const { currency: globalCurrency, getSymbol, getRate } = useCurrency();

    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [showFilters, setShowFilters] = useState(false);
    const [appliedFilters, setAppliedFilters] = useState<OpportunityFilters>(EMPTY_FILTERS);
    const [draftFilters, setDraftFilters] = useState<OpportunityFilters>(EMPTY_FILTERS);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (appliedFilters.stages.length) count += 1;
        if (appliedFilters.client.trim()) count += 1;
        if (appliedFilters.owner.trim()) count += 1;
        if (appliedFilters.salesRep.trim()) count += 1;
        if (appliedFilters.manager.trim()) count += 1;
        return count;
    }, [appliedFilters]);

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

    const buildQueryParams = useCallback((pg: number, search: string, filters: OpportunityFilters, fetchMax: boolean) => ({
        page: pg,
        limit: fetchMax ? 500 : limit,
        search,
        stages: filters.stages,
        client: filters.client.trim(),
        owner: filters.owner.trim(),
        salesRep: filters.salesRep.trim(),
        manager: filters.manager.trim(),
    }), [limit]);

    const sortedOpportunities = useMemo(() => {
        if (!sortKey) return opportunities;
        return [...opportunities].sort((a, b) => {
            let av: string | number | null | undefined;
            let bv: string | number | null | undefined;
            switch (sortKey) {
                case 'name': av = a.name; bv = b.name; break;
                case 'stage': av = a.stage; bv = b.stage; break;
                case 'value': av = typeof a.value === 'number' ? a.value : Number(a.value) || 0; bv = typeof b.value === 'number' ? b.value : Number(b.value) || 0; break;
                case 'probability': av = a.probability; bv = b.probability; break;
                case 'salesRep': av = a.salesRepName ?? ''; bv = b.salesRepName ?? ''; break;
                case 'manager': av = a.managerName ?? ''; bv = b.managerName ?? ''; break;
                case 'createdAt': av = a.createdAt ?? ''; bv = b.createdAt ?? ''; break;
                case 'startDate': av = a.tentativeStartDate ?? ''; bv = b.tentativeStartDate ?? ''; break;
                case 'endDate': av = a.tentativeEndDate ?? ''; bv = b.tentativeEndDate ?? ''; break;
                case 'closeDate': av = a.actualCloseDate ?? a.expectedCloseDate ?? ''; bv = b.actualCloseDate ?? b.expectedCloseDate ?? ''; break;
                case 'lastActivity': av = a.lastActivity ?? ''; bv = b.lastActivity ?? ''; break;
                default: return 0;
            }
            if (av == null) av = '';
            if (bv == null) bv = '';
            if (typeof av === 'number' && typeof bv === 'number') {
                return sortDir === 'asc' ? av - bv : bv - av;
            }
            const as = String(av).toLowerCase();
            const bs = String(bv).toLowerCase();
            return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
        });
    }, [opportunities, sortKey, sortDir]);

    const loadPage = useCallback((pg: number, search?: string, filters?: OpportunityFilters) => {
        setCurrentPage(pg);
        fetchOpportunities(buildQueryParams(pg, search ?? searchTerm, filters ?? appliedFilters, viewMode === 'kanban' || viewMode === 'by_owner'));
    }, [fetchOpportunities, searchTerm, appliedFilters, viewMode, buildQueryParams]);

    useEffect(() => {
        loadPage(1, "", EMPTY_FILTERS);
    }, []);

    // Reload all opportunities when switching to kanban mode
    useEffect(() => {
        fetchOpportunities(buildQueryParams(currentPage, searchTerm, appliedFilters, viewMode === 'kanban' || viewMode === 'by_owner'));
    }, [viewMode]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1);
            fetchOpportunities(buildQueryParams(1, searchTerm, appliedFilters, viewMode === 'kanban' || viewMode === 'by_owner'));
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleApplyFilters = () => {
        setAppliedFilters(draftFilters);
        setShowFilters(false);
        setCurrentPage(1);
        fetchOpportunities(buildQueryParams(1, searchTerm, draftFilters, viewMode === 'kanban' || viewMode === 'by_owner'));
    };

    const handleClearFilters = () => {
        setDraftFilters(EMPTY_FILTERS);
        setAppliedFilters(EMPTY_FILTERS);
        setShowFilters(false);
        setCurrentPage(1);
        fetchOpportunities(buildQueryParams(1, searchTerm, EMPTY_FILTERS, viewMode === 'kanban' || viewMode === 'by_owner'));
    };

    const toggleDraftStage = (stage: string) => {
        setDraftFilters((prev) => ({
            ...prev,
            stages: prev.stages.includes(stage)
                ? prev.stages.filter((item) => item !== stage)
                : [...prev.stages, stage],
        }));
    };

    const startRecord = total === 0 ? 0 : (currentPage - 1) * limit + 1;
    const endRecord = Math.min(currentPage * limit, total);

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
                        onClick={() => {
                            setDraftFilters(appliedFilters);
                            setShowFilters((prev) => !prev);
                        }}
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
                    <Link href="/dashboard/opportunities/new">
                        <button className="btn-primary flex items-center gap-1.5">
                            <Plus className="w-4 h-4" />
                            New Opportunity
                        </button>
                    </Link>

                    {showFilters && (
                        <div className="absolute right-0 top-full mt-2 z-30 w-[420px] bg-white border border-slate-200 rounded-xl shadow-xl p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-800">Filter Opportunities</h3>
                                    <p className="text-xs text-slate-500">Filter by one or more columns.</p>
                                </div>
                                <button
                                    onClick={() => setShowFilters(false)}
                                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-2">Stage</label>
                                    <div className="flex flex-wrap gap-2">
                                        {STAGE_OPTIONS.map((stage) => {
                                            const selected = draftFilters.stages.includes(stage);
                                            return (
                                                <button
                                                    key={stage}
                                                    type="button"
                                                    onClick={() => toggleDraftStage(stage)}
                                                    className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                                                        selected
                                                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                                    }`}
                                                >
                                                    {stage}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client</label>
                                        <input
                                            type="text"
                                            value={draftFilters.client}
                                            onChange={(e) => setDraftFilters((prev) => ({ ...prev, client: e.target.value }))}
                                            placeholder="Filter by client"
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Owner</label>
                                        <input
                                            type="text"
                                            value={draftFilters.owner}
                                            onChange={(e) => setDraftFilters((prev) => ({ ...prev, owner: e.target.value }))}
                                            placeholder="Filter by owner"
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Sales Rep</label>
                                        <input
                                            type="text"
                                            value={draftFilters.salesRep}
                                            onChange={(e) => setDraftFilters((prev) => ({ ...prev, salesRep: e.target.value }))}
                                            placeholder="Filter by sales rep"
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Manager</label>
                                        <input
                                            type="text"
                                            value={draftFilters.manager}
                                            onChange={(e) => setDraftFilters((prev) => ({ ...prev, manager: e.target.value }))}
                                            placeholder="Filter by manager"
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={handleClearFilters}
                                    className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApplyFilters}
                                    className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                                >
                                    Apply Filters
                                </button>
                            </div>
                        </div>
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
                    {appliedFilters.stages.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-medium">
                            Stage: {appliedFilters.stages.join(', ')}
                        </span>
                    )}
                    {appliedFilters.client && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium">
                            Client: {appliedFilters.client}
                        </span>
                    )}
                    {appliedFilters.owner && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium">
                            Owner: {appliedFilters.owner}
                        </span>
                    )}
                    {appliedFilters.salesRep && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium">
                            Sales Rep: {appliedFilters.salesRep}
                        </span>
                    )}
                    {appliedFilters.manager && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium">
                            Manager: {appliedFilters.manager}
                        </span>
                    )}
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
                                    {[['name','Opportunity Name'],['stage','Stage'],['value','Estimated value'],['quote','Quote'],['probability','Prob.'],['salesRep','Sales Rep'],['manager','Manager'],['createdAt','Created'],['startDate','Start Date'],['endDate','Est. End'],['closeDate','Close Date'],['lastActivity','Last Activity']].map(([key, label]) => (
                                        <th key={key} className="text-left py-2.5 px-4 font-semibold text-slate-600 text-xs cursor-pointer select-none hover:bg-slate-100" onClick={() => handleSort(key)}>
                                            <span className="flex items-center gap-1">{label}<SortIcon col={key} /></span>
                                        </th>
                                    ))}
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {opportunities.length === 0 ? (
                                    <tr>
                                        <td colSpan={13} className="py-8 text-center text-slate-400 text-sm">
                                            No opportunities found for the current search/filter selection.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedOpportunities.map((opp) => (
                                        <tr key={opp.id} className="hover:bg-slate-50/80 transition-colors group"
                                            title={`${opp.name}\nClient: ${opp.client}\nOwner: ${opp.owner}\nStage: ${opp.stage}\nValue: ${(typeof opp.value === 'number' ? opp.value : Number(opp.value) || 0).toLocaleString()}\nProbability: ${opp.probability}%\nSales Rep: ${opp.salesRepName || 'N/A'}\nManager: ${opp.managerName || 'N/A'}\nHealth: ${opp.healthScore ?? 'N/A'}/100\nStatus: ${opp.status}\nLast Activity: ${opp.lastActivity}\nCreated: ${opp.createdAt || 'N/A'}\nExpected Close: ${opp.expectedCloseDate || 'N/A'}\nStart Date: ${opp.tentativeStartDate || 'N/A'}\nEnd Date: ${opp.tentativeEndDate || 'N/A'}`}
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
                                                        <Link href={`/dashboard/opportunities/${opp.id}`} className="font-semibold text-xs text-slate-800 hover:text-indigo-600 hover:underline">
                                                            {opp.name}
                                                        </Link>
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
                                                    {(opp.status === 'stalled' || opp.detailedStatus === 'On Hold') ? (
                                                        <span className="text-[10px] text-amber-800 font-medium px-1.5 py-0.5 bg-amber-100 rounded-md border border-amber-300">
                                                            On Hold
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
                                                            <Link href={`/dashboard/opportunities/${opp.id}`} className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
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
                        <span className="text-xs text-slate-500">
                            {total === 0 ? 'No opportunities' : `Showing ${startRecord}–${endRecord} of ${total} opportunities`}
                        </span>
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
