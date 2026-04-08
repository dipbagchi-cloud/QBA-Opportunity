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
    ArrowDown
} from "lucide-react";
import Link from "next/link";
import { useOpportunityStore } from "@/lib/store";
import { useState, useEffect, useCallback, useMemo } from "react";
import KanbanBoard from "@/components/opportunities/KanbanBoard";
import { useCurrency } from "@/components/providers/currency-provider";

export default function OpportunitiesPage() {
    const { opportunities, deleteOpportunity, fetchOpportunities, total, page, totalPages, isLoading } = useOpportunityStore();
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const limit = 10;

    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
    const { format: fmtCurrency } = useCurrency();

    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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

    const loadPage = useCallback((pg: number, search?: string) => {
        setCurrentPage(pg);
        fetchOpportunities({ page: pg, limit, search: search ?? searchTerm });
    }, [fetchOpportunities, searchTerm, limit]);

    useEffect(() => {
        loadPage(1, "");
    }, []);

    // Reload all opportunities when switching to kanban mode
    useEffect(() => {
        if (viewMode === 'kanban') {
            fetchOpportunities({ page: 1, limit: 100, search: searchTerm });
        } else {
            fetchOpportunities({ page: currentPage, limit, search: searchTerm });
        }
    }, [viewMode]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1);
            fetchOpportunities({ page: 1, limit: viewMode === 'kanban' ? 100 : limit, search: searchTerm });
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const startRecord = total === 0 ? 0 : (currentPage - 1) * limit + 1;
    const endRecord = Math.min(currentPage * limit, total);

    return (
        <div className="space-y-4 animate-in fade-in duration-500 min-h-screen pb-8">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                        Opportunities
                    </h1>
                    <p className="text-slate-500 text-sm mt-0.5">Manage your pipeline and track deal progress.</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn-ghost bg-white border border-slate-200 text-slate-600 flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5" />
                        Filter
                    </button>
                    <Link href="/dashboard/opportunities/new">
                        <button className="btn-primary flex items-center gap-1.5">
                            <Plus className="w-4 h-4" />
                            New Opportunity
                        </button>
                    </Link>
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
                <button className="px-3 py-1.5 text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors border-b-2 border-transparent">By Owner</button>
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

            {/* Opportunities View */}
            {viewMode === 'list' ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
                    <div className="overflow-visible">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    {[['name','Opportunity Name'],['stage','Stage'],['value','Value'],['probability','Prob.'],['salesRep','Sales Rep'],['manager','Manager'],['createdAt','Created'],['startDate','Start Date'],['endDate','Est. End'],['closeDate','Close Date'],['lastActivity','Last Activity']].map(([key, label]) => (
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
                                        <td colSpan={8} className="py-8 text-center text-slate-400 text-sm">
                                            No opportunities found. Click "New Opportunity" to add one.
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
                                                        <Link href={`/dashboard/opportunities/${opp.id}`} className="font-semibold text-sm text-slate-800 hover:text-indigo-600 hover:underline">
                                                            {opp.name}
                                                        </Link>
                                                        <div className="text-xs text-slate-500">{opp.client} • {opp.owner}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
                                            ${opp.stage === 'Negotiation' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                        opp.stage === 'Closed Won' || opp.stage === 'Commit' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        opp.stage === 'Closed Lost' ? 'bg-red-50 text-red-700 border-red-200' :
                                                        opp.stage === 'Proposal Lost' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                        opp.stage === 'Proposal' ? 'bg-pink-50 text-pink-700 border-pink-200' :
                                                            'bg-slate-100 text-slate-700 border-slate-200'}
                                         `}>
                                                    {opp.stage}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <span className="font-medium text-sm text-slate-700">
                                                    {fmtCurrency(typeof opp.value === 'number' ? opp.value : Number(opp.value) || 0)}
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
                                                    <span className="text-xs font-medium text-slate-600">{opp.probability}%</span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4 text-xs text-slate-600">
                                                {opp.salesRepName || <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-xs text-slate-600">
                                                {opp.managerName || <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                                                {opp.createdAt
                                                    ? <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" />{opp.createdAt}</span>
                                                    : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                                                {opp.tentativeStartDate
                                                    ? <span className="flex items-center gap-1 text-indigo-600"><CalendarClock className="w-3 h-3" />{opp.tentativeStartDate}</span>
                                                    : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                                                {opp.actualCloseDate
                                                    ? <span className="flex items-center gap-1 text-purple-600 font-medium"><CalendarClock className="w-3 h-3" />{opp.actualCloseDate}</span>
                                                    : opp.tentativeEndDate
                                                        ? <span className="flex items-center gap-1 text-slate-500"><CalendarClock className="w-3 h-3 text-slate-400" />Est. {opp.tentativeEndDate}</span>
                                                        : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                                                {opp.actualCloseDate
                                                    ? <span className="flex items-center gap-1 text-emerald-600 font-medium"><CalendarCheck className="w-3 h-3" />{opp.actualCloseDate}</span>
                                                    : opp.expectedCloseDate
                                                        ? <span className="flex items-center gap-1 text-amber-600"><CalendarCheck className="w-3 h-3" />{opp.expectedCloseDate}</span>
                                                        : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="py-2.5 px-4 text-xs text-slate-500">
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
                                                                <Edit className="w-4 h-4" />
                                                                Edit Details
                                                            </Link>
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
            ) : (
                <KanbanBoard />
            )}
        </div>
    );
}
