"use client";

/**
 * Delivery Margin — the portfolio view of won business.
 *
 * Per-opportunity, Actual GOM already answers "how is this engagement doing".
 * Nothing answered "which engagements are in trouble", which is the question
 * that actually gets asked, and answering it meant opening deals one at a time.
 *
 * Served from the snapshot table, so it is a single indexed query rather than a
 * fan-out to Q-People. That makes it fast, immune to Q-People being down, and —
 * because snapshots accumulate — able to answer "since when" rather than only
 * "right now".
 *
 * Snapshots are written on demand: "Recompute now" forces a live costing and
 * records one, and an environment with none bootstraps itself on first load.
 * There is deliberately no unattended nightly job unless someone opts in via
 * MARGIN_SNAPSHOT_ENABLED. A deal with no snapshot renders as an errored row
 * rather than being quietly dropped from the totals.
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { API_URL, getAuthHeaders } from "@/lib/api";
import { useCurrency } from "@/components/providers/currency-provider";
import DeliveryQueueView from "../opportunities/components/DeliveryQueueView";
import {
    TrendingDown, TrendingUp, RefreshCw, AlertTriangle, ArrowRight, Minus, ShieldAlert,
} from "lucide-react";

interface Row {
    opportunityId: string;
    title: string;
    client: string | null;
    owner: string | null;
    project: { id: string; code: string; name: string } | null;
    estimate: { contractedRevenue: number; estimatedCost: number; estimatedGomPercent: number | null } | null;
    toDate: { actualCost: number; budgetConsumedPercent: number | null; hours: number } | null;
    projection: {
        projectedGomPercent: number | null; gomDeltaPoints: number | null;
        reliable: boolean; suppressedReason: string | null;
    } | null;
    confidence: { submittedSharePercent: number; firm: boolean } | null;
    caveats: string[];
    asOf: string | null;
    error: string | null;
}

interface Payload {
    rows: Row[];
    source: "snapshot" | "live";
    asOf: string | null;
    totals: {
        wonDeals: number; mappedDeals: number; unmappedDeals: number;
        computed: number; failed: number;
        contractedRevenue: number; estimatedCost: number; actualCostToDate: number;
        atRisk: number; provisional: number;
    };
}

export default function DeliveryMarginPage() {
    const { format: fmtCurrency } = useCurrency();
    const [data, setData] = useState<Payload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Margin only covers deals that HAVE a project mapped. The deals missing
    // from it are the ones most worth chasing, so they get a tab here rather
    // than only a link to another screen.
    const [tab, setTab] = useState<"margin" | "unmapped">("margin");

    const load = useCallback(async (refresh = false) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `${API_URL}/api/opportunities/qpeople/margin-portfolio${refresh ? "?refresh=true" : ""}`,
                { headers: getAuthHeaders() },
            );
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
            setData(body);
        } catch (e: any) {
            setError(e?.message || "Failed to load");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">Delivery Margin</h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Estimated versus actual margin across every won deal mapped to a Q-People project.
                    </p>
                    {/* Provenance matters here: this page normally serves last
                        night's snapshot, and a reader must never mistake it for
                        a live reading. */}
                    {data && (
                        <p className="text-[11px] text-slate-400 mt-1">
                            {data.source === "live"
                                ? "Recomputed live from Q-People just now."
                                : data.asOf
                                    ? `From the snapshot recorded on ${new Date(data.asOf).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}.`
                                    : "From the last recorded snapshot."}
                            {" "}Recompute now re-costs every deal from Q-People — slower, and it records a new snapshot, which is what builds the margin trend.
                        </p>
                    )}
                </div>
                {tab === "margin" && (
                    <button
                        onClick={() => load(true)}
                        disabled={loading}
                        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Recompute now
                    </button>
                )}
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
                <button
                    onClick={() => setTab("margin")}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        tab === "margin" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
                >
                    Margin{data ? ` (${data.totals.mappedDeals})` : ""}
                </button>
                <button
                    onClick={() => setTab("unmapped")}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                        tab === "unmapped" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
                >
                    Unmapped won deals
                    {data && data.totals.unmappedDeals > 0 && (
                        <span className="px-1.5 py-0 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-300">
                            {data.totals.unmappedDeals}
                        </span>
                    )}
                </button>
            </div>

            {tab === "unmapped" && (
                <>
                    <p className="text-xs text-slate-500">
                        Won deals with no Q-People project mapped. They produce no actual cost and no margin, so
                        they are absent from the Margin tab entirely — which is exactly why they are easy to lose.
                        Mapping one brings it into the margin view.
                    </p>
                    <DeliveryQueueView initialFilter="unmapped" />
                </>
            )}

            {tab === "margin" && loading && (
                <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading delivery margin…
                </div>
            )}

            {tab === "margin" && error && !loading && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-900">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                    <div className="text-sm">
                        <p className="font-semibold mb-0.5">Cannot load delivery margin</p>
                        <p className="text-xs">{error}</p>
                        <button onClick={() => load(true)} className="mt-2 text-xs font-semibold underline">Retry</button>
                    </div>
                </div>
            )}

            {tab === "margin" && data && !loading && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Contracted (mapped deals)</p>
                            <p className="font-semibold text-sm text-slate-800">{fmtCurrency(data.totals.contractedRevenue)}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                                {data.totals.mappedDeals} of {data.totals.wonDeals} won deals mapped
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Estimated cost</p>
                            <p className="font-semibold text-sm text-slate-800">{fmtCurrency(data.totals.estimatedCost)}</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Spent to date</p>
                            <p className="font-semibold text-sm text-slate-800">{fmtCurrency(data.totals.actualCostToDate)}</p>
                        </div>
                        <div className={`rounded-lg p-3 border ${data.totals.atRisk > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                            <p className={`text-xs mb-1 ${data.totals.atRisk > 0 ? "text-red-600" : "text-emerald-700"}`}>
                                Projected below approved margin
                            </p>
                            <p className={`font-bold text-lg ${data.totals.atRisk > 0 ? "text-red-800" : "text-emerald-800"}`}>
                                {data.totals.atRisk}
                            </p>
                        </div>
                    </div>

                    {/* The honesty banner. Everything below is built on timesheets
                        that are largely unsubmitted, and that must not be buried. */}
                    {data.totals.provisional > 0 && (
                        <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-900">
                            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                            <span>
                                <strong>{data.totals.provisional}</strong> of {data.totals.computed} costed{" "}
                                {data.totals.provisional === 1 ? "deal is" : "deals are"} built mostly on <strong>draft</strong>{" "}
                                timesheets that nobody has submitted yet. These are working indicators, not reportable results —
                                do not quote them as fact.
                            </span>
                        </div>
                    )}

                    {data.totals.unmappedDeals > 0 && (
                        <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
                            <span>
                                <strong>{data.totals.unmappedDeals}</strong> won{" "}
                                {data.totals.unmappedDeals === 1 ? "deal is" : "deals are"} not mapped to a Q-People project
                                and so {data.totals.unmappedDeals === 1 ? "does" : "do"} not appear in the figures above.{" "}
                                <button
                                    onClick={() => setTab("unmapped")}
                                    className="font-semibold text-indigo-600 hover:underline"
                                >
                                    See which
                                </button>{" "}
                                — mapping one brings it into this view.
                            </span>
                        </div>
                    )}

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[900px]">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="text-slate-500 text-xs">
                                        <th className="p-3 text-left font-semibold">Deal</th>
                                        <th className="p-3 text-left font-semibold">Project</th>
                                        <th className="p-3 text-right font-semibold">Contracted</th>
                                        <th className="p-3 text-right font-semibold">Est GOM</th>
                                        <th className="p-3 text-right font-semibold">Spent</th>
                                        <th className="p-3 text-right font-semibold">Budget used</th>
                                        <th className="p-3 text-right font-semibold">Projected GOM</th>
                                        <th className="p-3 text-right font-semibold">Δ</th>
                                        <th className="p-3 text-left font-semibold">Confidence</th>
                                        <th className="p-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.rows.map((r) => {
                                        const d = r.projection?.gomDeltaPoints ?? null;
                                        const used = r.toDate?.budgetConsumedPercent ?? null;
                                        return (
                                            <tr key={r.opportunityId} className={`border-b border-slate-100 hover:bg-slate-50 ${r.error ? "bg-slate-50/60" : ""}`}>
                                                <td className="p-3">
                                                    <div className="font-medium text-slate-800">{r.title}</div>
                                                    <div className="text-xs text-slate-500">{r.client || "—"}</div>
                                                </td>
                                                <td className="p-3 text-xs text-slate-600">{r.project?.code || "—"}</td>

                                                {r.error ? (
                                                    <td colSpan={7} className="p-3 text-xs text-amber-700">
                                                        <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-amber-600" />
                                                        {r.error}
                                                    </td>
                                                ) : (
                                                    <>
                                                        <td className="p-3 text-right text-xs text-slate-700 whitespace-nowrap">
                                                            {fmtCurrency(r.estimate?.contractedRevenue || 0)}
                                                        </td>
                                                        <td className="p-3 text-right text-xs text-slate-700">
                                                            {r.estimate?.estimatedGomPercent ?? "—"}%
                                                        </td>
                                                        <td className="p-3 text-right text-xs text-slate-700 whitespace-nowrap">
                                                            {fmtCurrency(r.toDate?.actualCost || 0)}
                                                        </td>
                                                        <td className={`p-3 text-right text-xs font-semibold ${used !== null && used > 100 ? "text-red-600" : "text-slate-600"}`}>
                                                            {used === null ? "—" : `${used}%`}
                                                        </td>
                                                        <td className="p-3 text-right text-xs">
                                                            {r.projection?.reliable && r.projection.projectedGomPercent !== null ? (
                                                                <span className={`font-semibold ${(d ?? 0) < 0 ? "text-red-700" : "text-emerald-700"}`}>
                                                                    {r.projection.projectedGomPercent}%
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400" title={r.projection?.suppressedReason || ""}>
                                                                    not yet
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-right text-xs whitespace-nowrap">
                                                            {d === null ? (
                                                                <span className="text-slate-300"><Minus className="w-3 h-3 inline" /></span>
                                                            ) : (
                                                                <span className={`inline-flex items-center gap-0.5 font-bold ${d < 0 ? "text-red-700" : "text-emerald-700"}`}>
                                                                    {d < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                                                    {d > 0 ? "+" : ""}{d} pt
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-xs">
                                                            {r.confidence && (
                                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${r.confidence.firm
                                                                    ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                                                    : "bg-amber-100 text-amber-800 border-amber-300"}`}>
                                                                    {r.confidence.submittedSharePercent}% submitted
                                                                </span>
                                                            )}
                                                        </td>
                                                    </>
                                                )}

                                                <td className="p-3 text-right whitespace-nowrap">
                                                    <Link
                                                        href={`/dashboard/opportunities/${r.opportunityId}?tab=actual-gom`}
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                                                    >
                                                        Open <ArrowRight className="w-3 h-3" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {data.rows.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="p-8 text-center text-sm text-slate-500">
                                                No won deals are mapped to a Q-People project yet, so there is nothing to cost.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-relaxed">
                        Sorted by margin erosion, worst first. <strong>Δ</strong> is projected GOM minus the GOM the deal was
                        approved at. A projection is withheld — shown as &ldquo;not yet&rdquo; — when too little comparable
                        time has been booked for a burn rate to mean anything, rather than printing a confident number off a
                        handful of hours. Every figure is computed by QCRM from Q-People hours priced on the rate card; Q-People
                        holds no cost data of its own.
                    </p>
                </>
            )}
        </div>
    );
}
