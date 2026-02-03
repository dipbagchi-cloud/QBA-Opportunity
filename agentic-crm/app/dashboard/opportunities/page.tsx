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
    Edit
} from "lucide-react";
import Link from "next/link";
import { useOpportunityStore } from "@/lib/store";
import { useState, useEffect } from "react";

export default function OpportunitiesPage() {
    const { opportunities, deleteOpportunity, fetchOpportunities } = useOpportunityStore();
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    useEffect(() => {
        fetchOpportunities();
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 min-h-screen pb-20">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                        Opportunities
                    </h1>
                    <p className="text-slate-500 mt-1">Manage your pipeline and track deal progress.</p>
                </div>
                <div className="flex gap-3">
                    <button className="btn-ghost bg-white border border-slate-200 text-slate-600 flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Filter
                    </button>
                    <Link href="/dashboard/opportunities/new">
                        <button className="btn-primary flex items-center gap-2">
                            <Plus className="w-5 h-5" />
                            New Opportunity
                        </button>
                    </Link>
                </div>
            </div>

            {/* Kanban / Pipeline View Selection */}
            <div className="flex items-center gap-4 border-b border-slate-200 pb-1">
                <button className="px-4 py-2 text-indigo-600 font-medium border-b-2 border-indigo-600 transition-colors">List View</button>
                <button className="px-4 py-2 text-slate-500 hover:text-indigo-600 font-medium transition-colors">Kanban Board</button>
                <button className="px-4 py-2 text-slate-500 hover:text-indigo-600 font-medium transition-colors">By Owner</button>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search opportunities by name, client, or owner..."
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm"
                />
            </div>

            {/* Opportunities Table Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-visible">
                <div className="overflow-visible">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 text-sm">Opportunity Name</th>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 text-sm">Stage</th>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 text-sm">Value</th>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 text-sm">Probability</th>
                                <th className="text-left py-4 px-6 font-semibold text-slate-600 text-sm">Last Activity</th>
                                <th className="w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {opportunities.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-400">
                                        No opportunities found. Click "New Opportunity" to add one.
                                    </td>
                                </tr>
                            ) : (
                                opportunities.map((opp) => (
                                    <tr key={opp.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${opp.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                <div>
                                                    <Link href={`/dashboard/opportunities/${opp.id}`} className="font-semibold text-slate-800 hover:text-indigo-600 hover:underline">
                                                        {opp.name}
                                                    </Link>
                                                    <div className="text-xs text-slate-500">{opp.client} • {opp.owner}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                                        ${opp.stage === 'Negotiation' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    opp.stage === 'Commit' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        'bg-slate-100 text-slate-700 border-slate-200'}
                                     `}>
                                                {opp.stage}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="font-medium text-slate-700">
                                                ${typeof opp.value === 'number' ? opp.value.toLocaleString() : opp.value}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-500 rounded-full"
                                                        style={{ width: `${opp.probability}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-medium text-slate-600">{opp.probability}%</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-slate-500">
                                            {opp.lastActivity}
                                        </td>
                                        <td className="py-4 px-6 relative">
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
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <span className="text-sm text-slate-500">Showing {opportunities.length} opportunities</span>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50">Previous</button>
                        <button className="px-3 py-1 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
