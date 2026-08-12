"use client";

import { useState, useCallback, useEffect, useMemo, ReactNode } from "react";
import { X, Download, Maximize2, Search, ChevronLeft, ChevronRight, Filter, ArrowUpDown, ArrowUp, ArrowDown, Calendar } from "lucide-react";
import {
    Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    ComposedChart, Line,
} from "recharts";
import { useCurrency } from "@/components/providers/currency-provider";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";

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
        if (currencyFormat) return currencyFormat(Number(value));
        const n = Number(value);
        return `₹${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

    // Every attribute filter is multi-select: pick several values in a column
    // and they OR together, while separate columns AND against each other —
    // the same semantics as the Opportunities list filters.
    //
    // One config table drives the state, the option lists, the matching and the
    // rendering, so the fourteen filters cannot drift apart from one another
    // and adding another one is a single entry.
    const [filters, setFilters] = useState<Record<string, string[]>>({});
    // Date range filter (Opportunity Close Date) — a range, not a value list.
    const [dateFromFilter, setDateFromFilter] = useState("");
    const [dateToFilter, setDateToFilter] = useState("");

    // Currency context for formatting
    let currencyFormat: ((v: number, opts?: any) => string) | undefined;
    try { const c = useCurrency(); currencyFormat = c.format; } catch { /* outside provider, use default */ }

    const dateKey = config.dateKey || "expectedCloseDate";
    const valueKey = config.valueKey || "value";

    // Resolve a usable date for a row: try the configured dateKey, then
    // common fallbacks ("actualCloseDate" for closed deals, then "createdAt").
    // This lets every opportunity-driven tile render a monthly distribution
    // without each caller having to override dateKey.
    const resolveRowDate = useCallback((row: Record<string, any>): Date | null => {
        const candidates = [dateKey, "actualCloseDate", "expectedCloseDate", "createdAt"];
        const seen = new Set<string>();
        for (const key of candidates) {
            if (!key || seen.has(key)) continue;
            seen.add(key);
            const raw = row[key];
            if (!raw) continue;
            const d = new Date(raw);
            if (!isNaN(d.getTime())) return d;
        }
        return null;
    }, [dateKey]);

    /**
     * The filter catalogue. Each entry knows how to pull its value(s) out of a
     * row, which drives the option list, the matching and the rendering alike.
     * `multi` marks columns that hold several values in one cell (a CSV), where
     * a row matches if ANY of its values is picked.
     */
    const FILTER_DEFS: { key: string; label: string; short: string; get: (r: Record<string, any>) => string[] }[] = useMemo(() => {
        const one = (v: unknown) => (v == null || v === "" ? [] : [String(v)]);
        const csv = (v: unknown) =>
            v == null ? [] : String(v).split(",").map(s => s.trim()).filter(Boolean);
        return [
            { key: "owner", label: "Owner", short: "Owner", get: r => one(r.owner) },
            { key: "salesRep", label: "Sales Rep", short: "Sales", get: r => one(r.salesRepName) },
            { key: "presales", label: "Presales", short: "Presales", get: r => csv(r.presalesAssigneeName) },
            { key: "client", label: "Client", short: "Client", get: r => one(r.client) },
            { key: "country", label: "Country", short: "Country", get: r => one(r.country) },
            { key: "region", label: "Region", short: "Region", get: r => one(r.region) },
            { key: "practice", label: "Practice", short: "Practice", get: r => one(r.practice) },
            // Rows carry the raw stage on currentStage; some callers set only stage.
            { key: "stage", label: "Stage", short: "Stage", get: r => one(r.currentStage ?? r.stage) },
            { key: "technology", label: "Technology", short: "Tech", get: r => csv(r.technology) },
            { key: "projectType", label: "Project Type", short: "Project", get: r => one(r.projectType) },
            { key: "fundingType", label: "Funding Type", short: "Funding", get: r => one(r.fundingType) },
            { key: "pricingModel", label: "Pricing Model", short: "Pricing", get: r => one(r.pricingModel) },
            { key: "department", label: "Department", short: "Dept", get: r => one(r.department) },
            { key: "status", label: "Status", short: "Status", get: r => one(r.status) },
        ];
    }, []);

    // Distinct values per filter, from the unfiltered data so the choices stay
    // stable as selections are made.
    const filterOptions = useMemo(() => {
        const out: Record<string, string[]> = {};
        for (const def of FILTER_DEFS) {
            const s = new Set<string>();
            config.data.forEach(r => def.get(r).forEach(v => s.add(v)));
            out[def.key] = Array.from(s).sort((a, b) => a.localeCompare(b));
        }
        return out;
    }, [config.data, FILTER_DEFS]);

    const activeFilterCount = useMemo(
        () => FILTER_DEFS.reduce((n, d) => n + (filters[d.key]?.length || 0), 0),
        [filters, FILTER_DEFS]
    );

    const hasRoleFilters = FILTER_DEFS.some(d => (filterOptions[d.key] || []).length > 0);

    // Apply attribute + date filters first — used by every section below.
    const roleFiltered = useMemo(() => {
        const active = FILTER_DEFS
            .map(d => ({ def: d, picked: filters[d.key] || [] }))
            .filter(x => x.picked.length > 0);
        if (active.length === 0 && !dateFromFilter && !dateToFilter) return config.data;

        const from = dateFromFilter ? new Date(dateFromFilter).getTime() : null;
        const to = dateToFilter ? new Date(dateToFilter + "T23:59:59").getTime() : null;

        return config.data.filter(r => {
            // Values OR within a filter; filters AND against each other.
            for (const { def, picked } of active) {
                const values = def.get(r);
                if (!values.some(v => picked.includes(v))) return false;
            }
            if (from != null || to != null) {
                const raw = r.expectedCloseDate || r.actualCloseDate || r.createdAt;
                if (!raw) return false;
                const t = new Date(raw).getTime();
                if (isNaN(t)) return false;
                if (from != null && t < from) return false;
                if (to != null && t > to) return false;
            }
            return true;
        });
    }, [config.data, FILTER_DEFS, filters, dateFromFilter, dateToFilter]);

    // Monthly buckets — adaptive 12-month window.
    //
    // EVERY row contributes so the monthly breakdown total reconciles with the
    // detailed-listing total:
    //   - rows with a GOM `monthlyRevenue` map ({ "YYYY-MM": revenue }) are
    //     split across those months;
    //   - rows WITHOUT GOM monthly data (e.g. a closed deal that never had a
    //     GOM sheet) contribute their full row value in the month of their
    //     resolved date (expectedCloseDate / actualCloseDate / createdAt).
    // Previously the GOM path silently dropped rows lacking monthlyRevenue,
    // making the monthly total fall short by exactly those rows' values.
    const monthlyData = useMemo(() => {
        // 1. Build per-row contributions: [{ monthKey, value, rowIdx }]
        const contributions: { monthKey: string; value: number; rowIdx: number }[] = [];
        roleFiltered.forEach((r, rowIdx) => {
            const rowVal = Number((r as any)[valueKey]) || 0;
            const mr = (r as any).monthlyRevenue as Record<string, number> | undefined;
            const positive = mr ? Object.entries(mr).filter(([, v]) => Number(v) > 0) : [];
            if (positive.length > 0) {
                // Distribute the row's DISPLAY value across its GOM months using the
                // GOM monthly shape, so each row contributes EXACTLY its listed value.
                // (Raw GOM monthly figures can sum to a different number than the
                // adjusted quote the row actually shows, which made the monthly total
                // drift from the detailed listing.)
                const gomSum = positive.reduce((s, [, v]) => s + Number(v), 0);
                positive.forEach(([k, v]) =>
                    contributions.push({ monthKey: k, value: gomSum > 0 ? rowVal * (Number(v) / gomSum) : 0, rowIdx })
                );
            } else {
                const d = resolveRowDate(r);
                if (d) {
                    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    contributions.push({ monthKey: k, value: rowVal, rowIdx });
                }
            }
        });

        if (contributions.length === 0) {
            return [] as { key: string; label: string; count: number; value: number }[];
        }

        // 2. Adaptive 12-month window covering the contribution months.
        const now = new Date(); now.setDate(1); now.setHours(0, 0, 0, 0);
        let windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthKeys = Array.from(new Set(contributions.map(c => c.monthKey))).sort();
        const [minY, minM] = monthKeys[0].split("-").map(Number);
        const [maxY, maxM] = monthKeys[monthKeys.length - 1].split("-").map(Number);
        const minDate = new Date(minY, minM - 1, 1);
        const maxDate = new Date(maxY, maxM - 1, 1);
        const elevenAhead = new Date(now.getFullYear(), now.getMonth() + 11, 1);
        if (maxDate < now) {
            windowStart = new Date(maxDate.getFullYear(), maxDate.getMonth() - 11, 1);
        } else if (minDate > elevenAhead) {
            windowStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        } else if (minDate > now) {
            windowStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        }

        const buckets: { key: string; label: string; count: number; value: number }[] = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(windowStart.getFullYear(), windowStart.getMonth() + i, 1);
            buckets.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
                label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
                count: 0,
                value: 0,
            });
        }
        const idx = new Map(buckets.map((b, i) => [b.key, i]));

        // 3. Distribute contributions; count each deal once per bucket it touches.
        //    Contributions outside the 12-month window are clamped to the nearest
        //    edge bucket so the monthly total still reconciles with the detailed
        //    listing (rather than being silently dropped).
        const bucketRows: Set<number>[] = buckets.map(() => new Set<number>());
        const firstKey = buckets[0].key;
        contributions.forEach(c => {
            let i = idx.get(c.monthKey);
            if (i == null) i = c.monthKey < firstKey ? 0 : buckets.length - 1;
            buckets[i].value += c.value;
            bucketRows[i].add(c.rowIdx);
        });
        buckets.forEach((b, i) => { b.count = bucketRows[i].size; });
        return buckets;
    }, [roleFiltered, valueKey, resolveRowDate]);

    const monthlyTotals = useMemo(() => {
        return monthlyData.reduce((acc, b) => ({ count: acc.count + b.count, value: acc.value + b.value }), { count: 0, value: 0 });
    }, [monthlyData]);

    // Show monthly section if rows have GOM monthly revenue OR any usable date
    const hasAnyDates = useMemo(() => {
        const hasGom = roleFiltered.some(r => {
            const mr = (r as any).monthlyRevenue as Record<string, number> | undefined;
            return mr && Object.values(mr).some(v => Number(v) > 0);
        });
        if (hasGom) return true;
        return roleFiltered.some(r => resolveRowDate(r) != null);
    }, [roleFiltered, resolveRowDate]);

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
    useEffect(() => { setPage(1); }, [search, filterCol, filterVal, pageSize, filters, dateFromFilter, dateToFilter]);

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

                {/* Attribute filter bar — every filter is multi-select */}
                {hasRoleFilters && (
                    <div className="px-5 py-2 border-b border-slate-100 bg-white flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mr-1">Filter by</span>
                        {FILTER_DEFS.map(def => {
                            const options = filterOptions[def.key] || [];
                            if (options.length === 0) return null;
                            const picked = filters[def.key] || [];
                            return (
                                <MultiSelectFilter
                                    key={def.key}
                                    values={picked}
                                    onChange={vals => setFilters(prev => ({ ...prev, [def.key]: vals }))}
                                    options={options}
                                    placeholder={`${def.label}: All`}
                                    triggerClassName={`flex items-center justify-between gap-1 min-w-[104px] max-w-[190px] px-2 py-1 text-xs border rounded-md bg-white text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${picked.length ? "border-indigo-300" : "border-slate-200"}`}
                                />
                            );
                        })}
                        <span className="text-[10px] text-slate-400 ml-1">Close date:</span>
                        <input
                            type="date"
                            value={dateFromFilter}
                            onChange={e => setDateFromFilter(e.target.value)}
                            className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            title="From"
                        />
                        <span className="text-[10px] text-slate-400">to</span>
                        <input
                            type="date"
                            value={dateToFilter}
                            onChange={e => setDateToFilter(e.target.value)}
                            className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            title="To"
                        />
                        {(activeFilterCount > 0 || dateFromFilter || dateToFilter) && (
                            <button
                                onClick={() => { setFilters({}); setDateFromFilter(""); setDateToFilter(""); }}
                                className="text-[10px] text-red-500 hover:text-red-700 underline"
                            >
                                Clear all{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
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
                    {hasAnyDates && (
                        <section className="bg-white border border-slate-200 rounded-lg p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                <h3 className="text-xs font-semibold text-slate-800">
                                    Monthly Distribution — {monthlyData[0]?.label} to {monthlyData[11]?.label}
                                </h3>
                                <span className="ml-auto text-[10px] text-slate-400">
                                    {monthlyTotals.count} deals · {formatCell(monthlyTotals.value, "currency", currencyFormat)} in window
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
                    {hasAnyDates && (
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
                                                {search || filterVal || activeFilterCount > 0 || dateFromFilter || dateToFilter ? "No matching results" : "No data available"}
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
