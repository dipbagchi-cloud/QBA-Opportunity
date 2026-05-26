"use client";

import { useState, useCallback, useEffect, useMemo, ReactNode } from "react";
import { X, Download, Maximize2, Search, ChevronLeft, ChevronRight, Filter, ArrowUpDown, ArrowUp, ArrowDown, Calendar } from "lucide-react";
import {
    Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    ComposedChart, Line,
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
    /** Field used to bucket rows for the monthly distribution. Defaults to "expectedCloseDate". */
    dateKey?: string;
    /** Field summed per month for the value bar. Defaults to "value". */
    valueKey?: string;
}

/* ------------------------------------------------------------------ */
/* CSV helper                                                          */
/* ------------------------------------------------------------------ */

function formatCell(value: any, format?: string, currencyFormat?: (v: number, opts?: any) => string): string {
    if (value == null) return "";
    if (format === "currency") {
        if (currencyFormat) return currencyFormat(Number(value), { compact: true });
        const n = Number(value);
        const abs = Math.abs(n);
        if (abs >= 1_000_000_000) return `₹${(n / 1_000_000_000).toFixed(2)}B`;
        if (abs >= 1_000_000)     return `₹${(n / 1_000_000).toFixed(2)}M`;
        if (abs >= 1_000)         return `₹${(n / 1_000).toFixed(2)}K`;
        return `₹${n.toFixed(2)}`;
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
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [filterCol, setFilterCol] = useState<string | null>(null);
    const [filterVal, setFilterVal] = useState("");
    const [showFilter, setShowFilter] = useState(false);

    // Role filters (apply to monthly chart, monthly list, and detail list)
    const [ownerFilter, setOwnerFilter] = useState("");
    const [salesRepFilter, setSalesRepFilter] = useState("");
    const [presalesFilter, setPresalesFilter] = useState("");

    // Currency context for formatting
    let currencyFormat: ((v: number, opts?: any) => string) | undefined;
    try { const c = useCurrency(); currencyFormat = c.format; } catch { /* outside provider, use default */ }

    const dateKey = config.dateKey || "expectedCloseDate";
    const valueKey = config.valueKey || "value";

    // Unique values for role filter dropdowns
    const uniqueOwners = useMemo(() => {
        const s = new Set<string>();
        config.data.forEach(r => { const v = r.owner; if (v) s.add(String(v)); });
        return Array.from(s).sort();
    }, [config.data]);

    const uniqueSalesReps = useMemo(() => {
        const s = new Set<string>();
        config.data.forEach(r => { const v = r.salesRepName; if (v) s.add(String(v)); });
        return Array.from(s).sort();
    }, [config.data]);

    const uniquePresales = useMemo(() => {
        const s = new Set<string>();
        config.data.forEach(r => {
            const v = r.presalesAssigneeName;
            if (v) String(v).split(",").map(p => p.trim()).filter(Boolean).forEach(p => s.add(p));
        });
        return Array.from(s).sort();
    }, [config.data]);

    const hasRoleFilters = uniqueOwners.length > 0 || uniqueSalesReps.length > 0 || uniquePresales.length > 0;

    // Apply role filters first — used by every section below
    const roleFiltered = useMemo(() => {
        if (!ownerFilter && !salesRepFilter && !presalesFilter) return config.data;
        return config.data.filter(r => {
            if (ownerFilter && r.owner !== ownerFilter) return false;
            if (salesRepFilter && r.salesRepName !== salesRepFilter) return false;
            if (presalesFilter) {
                const names = String(r.presalesAssigneeName || "").split(",").map(p => p.trim()).filter(Boolean);
                if (!names.includes(presalesFilter)) return false;
            }
            return true;
        });
    }, [config.data, ownerFilter, salesRepFilter, presalesFilter]);

    // Monthly buckets — next 12 months from current month
    const monthlyData = useMemo(() => {
        const now = new Date(); now.setDate(1); now.setHours(0, 0, 0, 0);
        const buckets: { key: string; label: string; count: number; value: number }[] = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            buckets.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
                label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
                count: 0,
                value: 0,
            });
        }
        const idx = new Map(buckets.map((b, i) => [b.key, i]));
        roleFiltered.forEach(r => {
            const raw = r[dateKey];
            if (!raw) return;
            const d = new Date(raw);
            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const i = idx.get(key);
            if (i != null) {
                buckets[i].count += 1;
                buckets[i].value += Number(r[valueKey]) || 0;
            }
        });
        return buckets;
    }, [roleFiltered, dateKey, valueKey]);

    const monthlyTotals = useMemo(() => {
        return monthlyData.reduce((acc, b) => ({ count: acc.count + b.count, value: acc.value + b.value }), { count: 0, value: 0 });
    }, [monthlyData]);

    const hasMonthlyData = monthlyTotals.count > 0;

    // Search & filter — operates on roleFiltered so detail list reflects role filters
    const filteredData = useMemo(() => {
        let d = roleFiltered;
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
    }, [roleFiltered, config.columns, search, filterCol, filterVal]);

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
    useEffect(() => { setPage(1); }, [search, filterCol, filterVal, pageSize, ownerFilter, salesRepFilter, presalesFilter]);

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
            <div className="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-[95vw] max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-sm font-semibold text-slate-800">{config.title}</h2>
                    <div className="flex items-center gap-1.5">
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

                {/* Role filter bar — Owner / Sales Rep / Presales */}
                {hasRoleFilters && (
                    <div className="px-5 py-2 border-b border-slate-100 bg-white flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mr-1">Filter by</span>
                        {uniqueOwners.length > 0 && (
                            <select
                                value={ownerFilter}
                                onChange={e => setOwnerFilter(e.target.value)}
                                className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            >
                                <option value="">Owner: All</option>
                                {uniqueOwners.map(o => <option key={o} value={o}>Owner: {o}</option>)}
                            </select>
                        )}
                        {uniqueSalesReps.length > 0 && (
                            <select
                                value={salesRepFilter}
                                onChange={e => setSalesRepFilter(e.target.value)}
                                className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            >
                                <option value="">Sales Rep: All</option>
                                {uniqueSalesReps.map(s => <option key={s} value={s}>Sales: {s}</option>)}
                            </select>
                        )}
                        {uniquePresales.length > 0 && (
                            <select
                                value={presalesFilter}
                                onChange={e => setPresalesFilter(e.target.value)}
                                className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            >
                                <option value="">Presales: All</option>
                                {uniquePresales.map(p => <option key={p} value={p}>Presales: {p}</option>)}
                            </select>
                        )}
                        {(ownerFilter || salesRepFilter || presalesFilter) && (
                            <button
                                onClick={() => { setOwnerFilter(""); setSalesRepFilter(""); setPresalesFilter(""); }}
                                className="text-[10px] text-red-500 hover:text-red-700 underline"
                            >
                                Clear all
                            </button>
                        )}
                        <span className="ml-auto text-[10px] text-slate-400">
                            {roleFiltered.length} of {config.data.length} rows
                        </span>
                    </div>
                )}

                {/* Body — Monthly visual + Monthly breakdown + Detail list */}
                <div className="flex-1 overflow-auto px-5 py-3 space-y-4">
                    {/* Section 1: Monthly Distribution Visual */}
                    {hasMonthlyData && (
                        <section className="bg-white border border-slate-200 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                <h3 className="text-xs font-semibold text-slate-800">Monthly Distribution — Next 12 Months</h3>
                                <span className="ml-auto text-[10px] text-slate-400">
                                    {monthlyTotals.count} deals · {formatCell(monthlyTotals.value, "currency", currencyFormat)} projected
                                </span>
                            </div>
                            <div className="h-[220px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={monthlyData} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <YAxis
                                            yAxisId="left"
                                            tick={{ fill: "#94a3b8", fontSize: 10 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={v => formatCell(v, "currency", currencyFormat)}
                                            width={55}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            tick={{ fill: "#94a3b8", fontSize: 10 }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={28}
                                            allowDecimals={false}
                                        />
                                        <Tooltip
                                            contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "6px 10px" }}
                                            formatter={(value: number, name: string) => {
                                                if (name === "Total Value") return [formatCell(value, "currency", currencyFormat), name];
                                                return [value, name];
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: "10px" }} iconSize={8} />
                                        <Bar yAxisId="left" dataKey="value" name="Total Value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                        <Line yAxisId="right" type="monotone" dataKey="count" name="Deal Count" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </section>
                    )}

                    {/* Section 2: Monthly Breakdown List */}
                    {hasMonthlyData && (
                        <section className="bg-white border border-slate-200 rounded-lg p-3">
                            <h3 className="text-xs font-semibold text-slate-800 mb-2">Monthly Breakdown</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400">
                                            <th className="text-left py-1.5 px-3 font-semibold">Month</th>
                                            <th className="text-right py-1.5 px-3 font-semibold">Deal Count</th>
                                            <th className="text-right py-1.5 px-3 font-semibold">Total Value</th>
                                            <th className="text-right py-1.5 px-3 font-semibold">Avg Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {monthlyData.map(m => (
                                            <tr key={m.key} className={`border-b border-slate-50 last:border-0 ${m.count === 0 ? "text-slate-300" : "text-slate-700 hover:bg-slate-50/50"}`}>
                                                <td className="py-1.5 px-3 font-medium">{m.label}</td>
                                                <td className="py-1.5 px-3 text-right">{m.count}</td>
                                                <td className="py-1.5 px-3 text-right">{m.value > 0 ? formatCell(m.value, "currency", currencyFormat) : "—"}</td>
                                                <td className="py-1.5 px-3 text-right">{m.count > 0 ? formatCell(m.value / m.count, "currency", currencyFormat) : "—"}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-50 font-semibold text-slate-800 text-[11px]">
                                            <td className="py-1.5 px-3">Total (12 mo)</td>
                                            <td className="py-1.5 px-3 text-right">{monthlyTotals.count}</td>
                                            <td className="py-1.5 px-3 text-right">{formatCell(monthlyTotals.value, "currency", currencyFormat)}</td>
                                            <td className="py-1.5 px-3 text-right">{monthlyTotals.count > 0 ? formatCell(monthlyTotals.value / monthlyTotals.count, "currency", currencyFormat) : "—"}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {/* Optional: caller-supplied custom chart */}
                    {config.chart && (
                        <section className="bg-white border border-slate-200 rounded-lg p-3">
                            <div className="h-[320px] w-full">{config.chart}</div>
                        </section>
                    )}

                    {/* Section 3: Detailed Listing */}
                    <section className="bg-white border border-slate-200 rounded-lg">
                        <div className="px-3 pt-3 pb-2 flex items-center gap-2 flex-wrap">
                            <h3 className="text-xs font-semibold text-slate-800">Detailed Listing</h3>
                            <div className="relative flex-1 min-w-[200px] ml-2">
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
                                Column Filter
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
                        <div className="overflow-x-auto px-3 pb-3">
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
                                                {search || filterVal || ownerFilter || salesRepFilter || presalesFilter ? "No matching results" : "No data available"}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
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
                    <span className="text-slate-400">Use filters above to refine all sections</span>
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
