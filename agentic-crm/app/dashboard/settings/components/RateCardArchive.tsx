"use client";

/**
 * Rate Cards → Archive sub-tab.
 *
 * Two views over the same versioned data:
 *   "By upload"    — every cost-card upload, and the retired rates in each.
 *   "Rate history" — per skill + experience band, how the rate moved between
 *                    uploads, with the delta.
 *
 * The history view keys on the CANONICAL band, because the bands are spelled
 * differently between generations ("00-02" in the April 2026 card, "0 - 2 Years"
 * in August). Matching on the raw string would show two unrelated rows and no
 * change would ever be visible.
 */

import React, { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useCurrency } from "@/components/providers/currency-provider";
import { Archive, History, Search, RefreshCw, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";

interface Batch {
    id: string;
    label: string;
    sourceFile: string | null;
    uploadedAt: string;
    uploadedByName: string | null;
    isCurrent: boolean;
    notes: string | null;
    rows: number;
    activeRows: number;
    archivedRows: number;
    distinctSkills: number;
}

interface HistoryPoint {
    batchId: string | null;
    batchLabel: string;
    uploadedAt: string;
    code: string;
    level: string;
    bandAsWritten: string;
    ctc: number;
    isActive: boolean;
}

interface HistoryRow {
    skill: string;
    band: string;
    versions: number;
    firstCtc: number;
    currentCtc: number;
    delta: number | null;
    deltaPct: number | null;
    changed: boolean;
    points: HistoryPoint[];
}

export default function RateCardArchive() {
    const { format: fmtCurrency } = useCurrency();
    const [view, setView] = useState<"uploads" | "history">("uploads");

    const [batches, setBatches] = useState<Batch[]>([]);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [batchRows, setBatchRows] = useState<Record<string, any[]>>({});
    const [loadingRows, setLoadingRows] = useState<string | null>(null);

    const [history, setHistory] = useState<HistoryRow[]>([]);
    const [histTotals, setHistTotals] = useState<any>(null);
    const [changedOnly, setChangedOnly] = useState(false);
    const [search, setSearch] = useState("");
    const [openRow, setOpenRow] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadBatches = useCallback(async () => {
        try {
            setBatches(await apiClient<Batch[]>("/api/admin/rate-cards/batches"));
        } catch {
            setError("Could not load rate card versions.");
        }
    }, []);

    const loadHistory = useCallback(async () => {
        try {
            const qp = new URLSearchParams();
            if (search) qp.set("search", search);
            if (changedOnly) qp.set("changedOnly", "true");
            const res = await apiClient<any>(`/api/admin/rate-cards/history?${qp}`);
            setHistory(res.history || []);
            setHistTotals(res.totals || null);
        } catch {
            setError("Could not load rate history.");
        }
    }, [search, changedOnly]);

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError(null);
            await loadBatches();
            setLoading(false);
        })();
    }, [loadBatches]);

    useEffect(() => {
        if (view !== "history") return;
        const t = setTimeout(loadHistory, 350);
        return () => clearTimeout(t);
    }, [view, loadHistory]);

    async function toggleBatch(b: Batch) {
        if (expanded === b.id) { setExpanded(null); return; }
        setExpanded(b.id);
        if (batchRows[b.id]) return;
        setLoadingRows(b.id);
        try {
            const res = await apiClient<any>(
                `/api/admin/rate-cards?batchId=${encodeURIComponent(b.id)}&status=archived&limit=200`);
            setBatchRows((p) => ({ ...p, [b.id]: res.data || [] }));
        } catch {
            setBatchRows((p) => ({ ...p, [b.id]: [] }));
        } finally {
            setLoadingRows(null);
        }
    }

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                Loading rate card history…
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4" /> {error}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-bold text-slate-900">Archived Rate Cards</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Superseded rates, kept for history. These are not used for pricing —
                        estimation and GOM only ever read the current card.
                    </p>
                </div>
                <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                    <button
                        onClick={() => setView("uploads")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            view === "uploads" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
                    >
                        <Archive className="w-3.5 h-3.5" /> By upload
                    </button>
                    <button
                        onClick={() => setView("history")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            view === "history" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
                    >
                        <History className="w-3.5 h-3.5" /> Rate history
                    </button>
                </div>
            </div>

            {/* ── BY UPLOAD ───────────────────────────────────────────────── */}
            {view === "uploads" && (
                <div className="space-y-2">
                    {batches.length === 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
                            No rate card versions recorded yet.
                        </div>
                    )}
                    {batches.map((b) => (
                        <div key={b.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <button
                                onClick={() => toggleBatch(b)}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {expanded === b.id
                                        ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                        : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm text-slate-800">{b.label}</span>
                                            {b.isCurrent
                                                ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300">CURRENT</span>
                                                : <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-300">SUPERSEDED</span>}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                                            {b.rows} rates · {b.distinctSkills} skills
                                            {b.activeRows > 0 && ` · ${b.activeRows} active`}
                                            {b.archivedRows > 0 && ` · ${b.archivedRows} archived`}
                                            {b.uploadedByName && ` · by ${b.uploadedByName}`}
                                            {b.sourceFile && ` · ${b.sourceFile}`}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs text-slate-400 flex-shrink-0 ml-3">
                                    {new Date(b.uploadedAt).toLocaleDateString()}
                                </span>
                            </button>

                            {expanded === b.id && (
                                <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                                    {b.archivedRows === 0 ? (
                                        <p className="text-xs text-slate-500">
                                            Nothing archived in this upload — all {b.activeRows} of its rates are still live.
                                        </p>
                                    ) : loadingRows === b.id ? (
                                        <p className="text-xs text-slate-500">Loading rates…</p>
                                    ) : (
                                        <div className="overflow-x-auto max-h-80 overflow-y-auto">
                                            <table className="w-full text-xs min-w-[640px]">
                                                <thead className="sticky top-0 bg-slate-50">
                                                    <tr className="text-left text-slate-500 border-b border-slate-200">
                                                        <th className="p-2 font-semibold">Code</th>
                                                        <th className="p-2 font-semibold">Skill</th>
                                                        <th className="p-2 font-semibold">Band</th>
                                                        <th className="p-2 font-semibold">Level</th>
                                                        <th className="p-2 font-semibold text-right">CTC</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(batchRows[b.id] || []).map((r: any) => (
                                                        <tr key={r.id} className="border-b border-slate-100">
                                                            <td className="p-2 font-mono text-[11px] text-slate-500">{r.code}</td>
                                                            <td className="p-2 text-slate-800">{r.skill}</td>
                                                            <td className="p-2 text-slate-600">{r.experienceBand}</td>
                                                            <td className="p-2 text-slate-600">{r.level || "—"}</td>
                                                            <td className="p-2 text-right text-slate-800">{fmtCurrency(r.ctc)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {(batchRows[b.id] || []).length >= 200 && (
                                                <p className="text-[11px] text-slate-400 mt-2">
                                                    Showing the first 200 rates of this upload.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── RATE HISTORY ────────────────────────────────────────────── */}
            {view === "history" && (
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[220px]">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search skill or band…"
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-600">
                            <input type="checkbox" checked={changedOnly} onChange={(e) => setChangedOnly(e.target.checked)} />
                            Only rates that changed
                        </label>
                        {histTotals && (
                            <span className="text-xs text-slate-500">
                                {histTotals.tracked} tracked · {histTotals.withMultipleVersions} in more than one upload · {histTotals.changed} changed
                            </span>
                        )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs min-w-[760px]">
                                <thead>
                                    <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
                                        <th className="p-2.5 font-semibold">Skill</th>
                                        <th className="p-2.5 font-semibold">Band</th>
                                        <th className="p-2.5 font-semibold text-center">Versions</th>
                                        <th className="p-2.5 font-semibold text-right">First</th>
                                        <th className="p-2.5 font-semibold text-right">Current</th>
                                        <th className="p-2.5 font-semibold text-right">Change</th>
                                        <th className="p-2.5 w-8" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.length === 0 && (
                                        <tr><td colSpan={7} className="p-6 text-center text-slate-500">
                                            {changedOnly ? "No rate has changed between uploads." : "No history to show."}
                                        </td></tr>
                                    )}
                                    {history.map((h) => {
                                        const key = `${h.skill}|${h.band}`;
                                        const up = (h.delta ?? 0) > 0;
                                        return (
                                            <React.Fragment key={key}>
                                                <tr
                                                    className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${h.changed ? "bg-amber-50/40" : ""}`}
                                                    onClick={() => setOpenRow(openRow === key ? null : key)}
                                                >
                                                    <td className="p-2.5 text-slate-800">{h.skill}</td>
                                                    <td className="p-2.5 text-slate-600">{h.band}</td>
                                                    <td className="p-2.5 text-center text-slate-600">{h.versions}</td>
                                                    <td className="p-2.5 text-right text-slate-600">
                                                        {h.versions > 1 ? fmtCurrency(h.firstCtc) : "—"}
                                                    </td>
                                                    <td className="p-2.5 text-right font-medium text-slate-800">{fmtCurrency(h.currentCtc)}</td>
                                                    <td className={`p-2.5 text-right font-medium ${h.delta === null ? "text-slate-400" : up ? "text-emerald-700" : "text-red-600"}`}>
                                                        {h.delta === null
                                                            ? "single version"
                                                            : `${up ? "+" : ""}${fmtCurrency(h.delta)} (${up ? "+" : ""}${h.deltaPct}%)`}
                                                    </td>
                                                    <td className="p-2.5 text-slate-400">
                                                        {openRow === key ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                    </td>
                                                </tr>
                                                {openRow === key && (
                                                    <tr className="bg-slate-50/70">
                                                        <td colSpan={7} className="px-6 py-3">
                                                            <table className="w-full text-[11px]">
                                                                <thead>
                                                                    <tr className="text-left text-slate-500">
                                                                        <th className="py-1 font-semibold">Upload</th>
                                                                        <th className="py-1 font-semibold">Band as written</th>
                                                                        <th className="py-1 font-semibold">Level</th>
                                                                        <th className="py-1 font-semibold">Code</th>
                                                                        <th className="py-1 font-semibold text-right">CTC</th>
                                                                        <th className="py-1 font-semibold text-center">State</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {h.points.map((p, i) => (
                                                                        <tr key={`${p.batchId}-${i}`} className="border-t border-slate-200">
                                                                            <td className="py-1 text-slate-700">{p.batchLabel}</td>
                                                                            <td className="py-1 text-slate-600 font-mono">{p.bandAsWritten}</td>
                                                                            <td className="py-1 text-slate-600">{p.level || "—"}</td>
                                                                            <td className="py-1 text-slate-500 font-mono">{p.code}</td>
                                                                            <td className="py-1 text-right text-slate-800">{fmtCurrency(p.ctc)}</td>
                                                                            <td className="py-1 text-center">
                                                                                {p.isActive
                                                                                    ? <span className="text-emerald-700 font-semibold">live</span>
                                                                                    : <span className="text-slate-400">archived</span>}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
