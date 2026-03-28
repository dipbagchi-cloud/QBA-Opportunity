"use client";

import { useState, useCallback, useEffect, useMemo, ReactNode } from "react";
import { X, Download, Maximize2, Table2, BarChart3, Search, ChevronLeft, ChevronRight, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useCurrency } from "@/components/providers/currency-provider";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface DrillColumn {
    key: string;
    label: string;
    format?: "currency" | "percent" | "number" | "text";
}

export interface DrillDownConfig {
    title: string;
    columns: DrillColumn[];
    data: Record<string, any>[];
    /** Optional: render a full-size chart inside the modal */
    chart?: ReactNode;
}

/* ------------------------------------------------------------------ */
/* CSV helper                                                          */
/* ------------------------------------------------------------------ */

function formatCell(value: any, format?: string, currencyFormat?: (v: number, opts?: any) => string): string {
    if (value == null) return "";
    if (format === "currency") {
        if (currencyFormat) return currencyFormat(Number(value), { compact: true });
        return `₹${(Number(value) / 100000).toFixed(2)}L`;
    }
    if (format === "percent") return `${Number(value).toFixed(1)}%`;
    if (format === "number") return String(Number(value));
    return String(value);
}

function downloadCSV(columns: DrillColumn[], data: Record<string, any>[], title: string, currencyFormat?: (v: number, opts?: any) => string) {
    const header = ["Sl No", ...columns.map(c => c.label)].join(",");
    const rows = data.map((row, idx) =>
        [String(idx + 1), ...columns.map(c => {
            const raw = formatCell(row[c.key], c.format, currencyFormat);
            return raw.includes(",") || raw.includes('"') ? `"${raw.replace(/"/g, '""')}"` : raw;
        })].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const PAGE_SIZES = [10, 25, 50, 100];

/* ------------------------------------------------------------------ */
/* Modal component                                                     */
/* ------------------------------------------------------------------ */

export function DrillDownModal({ config, onClose }: { config: DrillDownConfig; onClose: () => void }) {
    const [view, setView] = useState<"chart" | "table">(config.chart ? "chart" : "table");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [filterCol, setFilterCol] = useState<string | null>(null);
    const [filterVal, setFilterVal] = useState("");
    const [showFilter, setShowFilter] = useState(false);

    // Currency context for formatting
    let currencyFormat: ((v: number, opts?: any) => string) | undefined;
    try { const c = useCurrency(); currencyFormat = c.format; } catch { /* outside provider, use default */ }

    // Search & filter
    const filteredData = useMemo(() => {
        let d = config.data;
        // Global search across all columns
        if (search.trim()) {
            const q = search.toLowerCase();
            d = d.filter(row => config.columns.some(col => String(row[col.key] ?? "").toLowerCase().includes(q)));
        }
        // Column filter
        if (filterCol && filterVal.trim()) {
            const fv = filterVal.toLowerCase();
            d = d.filter(row => String(row[filterCol] ?? "").toLowerCase().includes(fv));
        }
        return d;
    }, [config.data, config.columns, search, filterCol, filterVal]);

    // Sort
    const sortedData = useMemo(() => {
        if (!sortKey) return filteredData;
        const col = config.columns.find(c => c.key === sortKey);
        return [...filteredData].sort((a, b) => {
            let va = a[sortKey], vb = b[sortKey];
            if (col?.format === "currency" || col?.format === "number" || col?.format === "percent") {
                va = Number(va) || 0;
                vb = Number(vb) || 0;
            } else {
                va = String(va ?? "").toLowerCase();
                vb = String(vb ?? "").toLowerCase();
            }
            if (va < vb) return sortDir === "asc" ? -1 : 1;
            if (va > vb) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
    }, [filteredData, sortKey, sortDir, config.columns]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
    const pagedData = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [sortedData, page, pageSize]);

    // Reset page when search/filter changes
    useEffect(() => { setPage(1); }, [search, filterCol, filterVal, pageSize]);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    const handleDownload = useCallback(() => {
        downloadCSV(config.columns, sortedData, config.title, currencyFormat);
    }, [config, sortedData, currencyFormat]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-[95vw] max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-sm font-semibold text-slate-800">{config.title}</h2>
                    <div className="flex items-center gap-1.5">
                        {config.chart && (
                            <div className="flex bg-slate-100 rounded-md p-0.5">
                                <button
                                    onClick={() => setView("chart")}
                                    className={`p-1.5 rounded transition-colors ${view === "chart" ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
                                    title="Chart view"
                                >
                                    <BarChart3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => setView("table")}
                                    className={`p-1.5 rounded transition-colors ${view === "table" ? "bg-white shadow-sm text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
                                    title="Table view"
                                >
                                    <Table2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                            title="Download CSV"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export
                        </button>
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Search & Filter Bar (shown in table view) */}
                {view === "table" && (
                    <div className="px-5 py-2 border-b border-slate-100 flex items-center gap-2 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search all columns..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilter(!showFilter)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border transition-colors ${showFilter || filterVal ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                        >
                            <Filter className="w-3 h-3" />
                            Filter
                        </button>
                        {showFilter && (
                            <>
                                <select
                                    value={filterCol || ""}
                                    onChange={e => { setFilterCol(e.target.value || null); setFilterVal(""); }}
                                    className="px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                >
                                    <option value="">Column...</option>
                                    {config.columns.map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
                                </select>
                                {filterCol && (
                                    <input
                                        value={filterVal}
                                        onChange={e => setFilterVal(e.target.value)}
                                        placeholder={`Filter ${config.columns.find(c => c.key === filterCol)?.label}...`}
                                        className="px-2 py-1.5 text-xs border border-slate-200 rounded-md flex-1 min-w-[120px] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                )}
                                {(filterCol || filterVal) && (
                                    <button onClick={() => { setFilterCol(null); setFilterVal(""); }} className="text-xs text-red-500 hover:text-red-700">Clear</button>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-auto p-5">
                    {view === "chart" && config.chart ? (
                        <div className="h-[400px] w-full">{config.chart}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 text-left">
                                        <th className="pb-2 px-3 font-semibold text-slate-500 whitespace-nowrap w-12">Sl No</th>
                                        {config.columns.map(col => (
                                            <th
                                                key={col.key}
                                                className="pb-2 px-3 font-semibold text-slate-500 whitespace-nowrap cursor-pointer hover:text-slate-700 select-none"
                                                onClick={() => handleSort(col.key)}
                                            >
                                                <span className="inline-flex items-center gap-1">
                                                    {col.label}
                                                    {sortKey === col.key ? (
                                                        sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                    ) : (
                                                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                                                    )}
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedData.map((row, idx) => (
                                        <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                            <td className="py-2 px-3 text-slate-400 font-mono">{(page - 1) * pageSize + idx + 1}</td>
                                            {config.columns.map(col => (
                                                <td key={col.key} className="py-2 px-3 text-slate-700 whitespace-nowrap">
                                                    {formatCell(row[col.key], col.format, currencyFormat)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    {pagedData.length === 0 && (
                                        <tr>
                                            <td colSpan={config.columns.length + 1} className="py-8 text-center text-slate-400">
                                                {search || filterVal ? "No matching results" : "No data available"}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer with pagination */}
                <div className="px-5 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[10px] text-slate-400">
                    <div className="flex items-center gap-2">
                        <span>{sortedData.length} row{sortedData.length !== 1 ? "s" : ""}{filteredData.length < config.data.length ? ` (filtered from ${config.data.length})` : ""}</span>
                        <span className="text-slate-300">|</span>
                        <select
                            value={pageSize}
                            onChange={e => setPageSize(Number(e.target.value))}
                            className="px-1 py-0.5 border border-slate-200 rounded text-[10px] bg-white"
                        >
                            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}/page</option>)}
                        </select>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2 text-slate-600 font-medium">{page} / {totalPages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                    <span>Click Export to download as CSV</span>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Wrapper: makes any card expandable on click                         */
/* ------------------------------------------------------------------ */

export function ExpandableCard({
    children,
    drillConfig,
    className = "",
}: {
    children: ReactNode;
    drillConfig: DrillDownConfig;
    className?: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <div
                className={`relative group cursor-pointer ${className}`}
                onClick={() => setOpen(true)}
            >
                {children}
                {/* Expand icon overlay */}
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white/90 rounded shadow-sm border border-slate-100">
                    <Maximize2 className="w-3 h-3 text-slate-400" />
                </div>
            </div>
            {open && <DrillDownModal config={drillConfig} onClose={() => setOpen(false)} />}
        </>
    );
}
