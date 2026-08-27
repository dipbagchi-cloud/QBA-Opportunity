"use client";

/**
 * Actual GOM → "Margin & Variance" (third sub-tab).
 *
 * The first two sub-tabs produce inputs — who is mapped, what their hours cost.
 * This one finally states the margin the tab is named after, against the
 * estimate the deal was approved on.
 *
 * The presentation follows the backend's refusal to blend incomparable things:
 * the like-for-like variance, spend outside the planned window, and planned
 * work not yet started are three separate readings, shown separately. When
 * there is too little comparable time to project a landing margin, this says so
 * instead of printing a confident number.
 */

import React, { useState, useEffect, useCallback } from "react";
import { API_URL, getAuthHeaders } from "@/lib/api";
import { useCurrency } from "@/components/providers/currency-provider";
import {
    TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Info, HelpCircle,
} from "lucide-react";

interface MonthRow {
    month: string;
    plannedCost: number | null;
    plannedRevenue: number | null;
    actualCost: number | null;
    actualHours: number | null;
    draftHours: number | null;
    variance: number | null;
    variancePercent: number | null;
    unplannedMonth: boolean;
    notStarted: boolean;
}

interface Payload {
    opportunity: { id: string; title: string; client: string | null; currency: string };
    project: { id: string; code: string; name: string };
    estimate: {
        contractedRevenue: number; estimatedCost: number;
        estimatedGomValue: number; estimatedGomPercent: number | null;
        hasMonthlyPlan: boolean;
    };
    toDate: {
        actualCost: number; budgetConsumedPercent: number | null;
        hours: number; submittedHours: number; draftHours: number;
    };
    overlap: {
        months: number; plannedCost: number; actualCost: number;
        variance: number; variancePercent: number | null; burnRatio: number | null;
    };
    unplanned: { months: number; actualCost: number; monthKeys: string[] };
    notStarted: { months: number; plannedCost: number };
    projection: {
        projectedTotalCost: number | null; projectedGomPercent: number | null;
        gomDeltaPoints: number | null; reliable: boolean;
        suppressedReason: string | null; basis: string;
    };
    confidence: {
        submittedSharePercent: number; firm: boolean; people: number;
        pricedPeople: number; unpricedPeople: number;
        fallbackPricedPeople: number; unplannedPeople: number;
    };
    monthly: MonthRow[];
    caveats: string[];
    history: {
        asOf: string;
        actualCost: number;
        budgetConsumedPercent: number | null;
        projectedGomPercent: number | null;
        gomDeltaPoints: number | null;
        projectionReliable: boolean;
        estimatedGomPercent: number | null;
        hours: number;
    }[];
}

const CAVEAT_TEXT: Record<string, string> = {
    "no-estimate": "This deal has no costed estimate recorded, so there is nothing to measure the actuals against.",
    "no-monthly-plan": "The estimate has no month-by-month breakdown, so cost can only be compared in total, not per month.",
    "mostly-draft": "Most booked time is still in draft in Q-People and has not been submitted. Every figure here should be read as provisional.",
    "unpriced-people": "Some people booking time cannot be priced, so the actual cost — and therefore the overrun — is understated.",
    "fallback-rates": "Some people are priced at a lower experience band than their own because the rate card has no row for theirs. Senior cost is understated.",
    "unplanned-people": "People are booking time who were never on the resource plan.",
    "unplanned-months": "Time has been booked in months the estimate never budgeted for.",
    "projection-suppressed": "There is not yet enough comparable time to project where this deal will land. The figures above are still real; the projection is withheld rather than guessed.",
};

function monthLabel(m: string) {
    const [y, mo] = m.split("-");
    return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(mo) - 1]} ${y.slice(2)}`;
}

/** Over budget is bad, under is good — but only colour it when it is real. */
function varianceTone(v: number | null) {
    if (v === null || v === 0) return "text-slate-500";
    return v > 0 ? "text-red-600" : "text-emerald-600";
}

export default function MarginVarianceTab({ opportunityId }: { opportunityId: string }) {
    const { format: fmtCurrency } = useCurrency();
    const [data, setData] = useState<Payload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (refresh = false) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `${API_URL}/api/opportunities/${opportunityId}/qpeople/margin${refresh ? "?refresh=true" : ""}`,
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
    }, [opportunityId]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                Comparing actuals against the approved estimate…
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-900">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                <div className="text-sm">
                    <p className="font-semibold mb-0.5">Cannot show margin</p>
                    <p className="text-xs">{error}</p>
                    <button onClick={() => load(true)} className="mt-2 text-xs font-semibold underline">Retry</button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { estimate, toDate, overlap, unplanned, notStarted, projection, confidence } = data;
    const delta = projection.gomDeltaPoints;
    const trend = data.history || [];

    return (
        <div className="space-y-4">
            {/* ── Headline: approved margin vs where it is heading ─────────── */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-indigo-600" />
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Margin &amp; Variance</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {data.project.code} — measured against the approved estimate
                            </p>
                        </div>
                    </div>
                    <button onClick={() => load(true)} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Contracted value</p>
                        <p className="font-semibold text-sm text-slate-800">{fmtCurrency(estimate.contractedRevenue)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Estimated cost</p>
                        <p className="font-semibold text-sm text-slate-800">{fmtCurrency(estimate.estimatedCost)}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            approved at <strong>{estimate.estimatedGomPercent ?? "—"}%</strong> GOM
                        </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Spent so far</p>
                        <p className="font-semibold text-sm text-slate-800">{fmtCurrency(toDate.actualCost)}</p>
                        <p className={`text-[10px] mt-0.5 ${(toDate.budgetConsumedPercent ?? 0) > 100 ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                            {toDate.budgetConsumedPercent ?? "—"}% of the budget · {toDate.hours.toLocaleString()} h
                        </p>
                    </div>

                    {/* The number the whole tab exists for — or an honest refusal. */}
                    {projection.reliable && projection.projectedGomPercent !== null ? (
                        <div className={`rounded-lg p-3 border ${(delta ?? 0) < 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                            <p className={`text-xs mb-1 ${(delta ?? 0) < 0 ? "text-red-600" : "text-emerald-700"}`}>Projected GOM</p>
                            <p className={`font-semibold text-sm ${(delta ?? 0) < 0 ? "text-red-800" : "text-emerald-800"}`}>
                                {projection.projectedGomPercent}%
                            </p>
                            {delta !== null && (
                                <p className={`text-[10px] mt-0.5 flex items-center gap-0.5 font-semibold ${(delta) < 0 ? "text-red-600" : "text-emerald-700"}`}>
                                    {delta < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                    {delta > 0 ? "+" : ""}{delta} pts vs approved
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="bg-slate-100 rounded-lg p-3 border border-slate-300">
                            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                                <HelpCircle className="w-3 h-3" /> Projected GOM
                            </p>
                            <p className="font-semibold text-sm text-slate-500">Not yet</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                                {projection.suppressedReason}
                            </p>
                        </div>
                    )}
                </div>

                {/* Provisional-data banner. Every figure above is only as firm as
                    the timesheets underneath it. */}
                {!confidence.firm && (
                    <div className="mt-3 flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
                        Only <strong>{confidence.submittedSharePercent}%</strong> of the booked time is submitted in Q-People —
                        treat these figures as provisional, not as a reportable result.
                    </div>
                )}
            </div>

            {/* ── The three readings, kept apart ───────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                    <p className="text-xs font-bold text-slate-700 mb-1">Like-for-like variance</p>
                    <p className="text-[10px] text-slate-500 mb-2">
                        {overlap.months} month{overlap.months === 1 ? "" : "s"} carrying both a plan and bookings — the only
                        directly comparable figure.
                    </p>
                    {overlap.months === 0 ? (
                        <p className="text-sm text-slate-400">Nothing comparable yet</p>
                    ) : (
                        <>
                            <p className={`font-bold text-lg ${varianceTone(overlap.variance)}`}>
                                {overlap.variance > 0 ? "+" : ""}{fmtCurrency(overlap.variance)}
                            </p>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                                {fmtCurrency(overlap.actualCost)} spent against {fmtCurrency(overlap.plannedCost)} planned
                                {overlap.variancePercent !== null && (
                                    <> · <strong className={varianceTone(overlap.variance)}>
                                        {overlap.variancePercent > 0 ? "+" : ""}{overlap.variancePercent}%
                                    </strong></>
                                )}
                            </p>
                            {overlap.burnRatio !== null && (
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Burning <strong>{overlap.burnRatio}×</strong> the planned rate
                                </p>
                            )}
                        </>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                    <p className="text-xs font-bold text-slate-700 mb-1">Spend outside the plan</p>
                    <p className="text-[10px] text-slate-500 mb-2">
                        Time booked in months the estimate never budgeted for.
                    </p>
                    {unplanned.months === 0 ? (
                        <p className="text-sm text-emerald-600 font-semibold">None</p>
                    ) : (
                        <>
                            <p className="font-bold text-lg text-red-600">{fmtCurrency(unplanned.actualCost)}</p>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                                across {unplanned.months} month{unplanned.months === 1 ? "" : "s"} —{" "}
                                {unplanned.monthKeys.map(monthLabel).join(", ")}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1">
                                Usually work starting before the planned window: a schedule slip showing up as cost.
                            </p>
                        </>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                    <p className="text-xs font-bold text-slate-700 mb-1">Planned, not started</p>
                    <p className="text-[10px] text-slate-500 mb-2">
                        Budgeted months with no bookings against them yet.
                    </p>
                    {notStarted.months === 0 ? (
                        <p className="text-sm text-slate-400">None — the plan is fully under way</p>
                    ) : (
                        <>
                            <p className="font-bold text-lg text-slate-700">{fmtCurrency(notStarted.plannedCost)}</p>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                                still to come, across {notStarted.months} month{notStarted.months === 1 ? "" : "s"}
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* ── Caveats ──────────────────────────────────────────────────── */}
            {data.caveats.length > 0 && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-900">
                    <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                    <ul className="text-xs leading-relaxed list-disc pl-4 space-y-0.5">
                        {data.caveats.map((c) => <li key={c}>{CAVEAT_TEXT[c] || c}</li>)}
                    </ul>
                </div>
            )}

            {/* ── Erosion trend ────────────────────────────────────────────
                The reason snapshots exist. A single reading tells you where a
                deal is; only a series tells you which way it is moving. */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                <h4 className="text-sm font-bold text-slate-800 mb-1">Margin over time</h4>
                {trend.length < 2 ? (
                    <p className="text-xs text-slate-500">
                        {trend.length === 0
                            ? "No snapshots recorded yet. One is written each time someone recomputes the Delivery Margin page, and the trend appears here once there are at least two."
                            : `One snapshot so far (${new Date(trend[0].asOf).toLocaleDateString()}). The trend appears once a second has been recorded.`}
                    </p>
                ) : (
                    <>
                        <p className="text-xs text-slate-500 mb-3">
                            Projected GOM at each recorded snapshot, against the {estimate.estimatedGomPercent ?? "—"}% this
                            deal was approved at.
                        </p>
                        <div className="overflow-x-auto">
                            <div className="flex items-end gap-1 min-w-max h-24">
                                {trend.map((h) => {
                                    const v = h.projectedGomPercent;
                                    const approved = h.estimatedGomPercent ?? 0;
                                    // Bars are drawn on a 0..100 scale clamped at
                                    // both ends; a negative projected margin is
                                    // real and is drawn as a zero-height red stub
                                    // rather than being dropped.
                                    const height = v === null ? 0 : Math.max(2, Math.min(100, v));
                                    const below = v !== null && v < approved;
                                    return (
                                        <div key={h.asOf} className="flex flex-col items-center gap-1" title={
                                            v === null
                                                ? `${new Date(h.asOf).toLocaleDateString()} — not projectable`
                                                : `${new Date(h.asOf).toLocaleDateString()} — ${v}% projected vs ${approved}% approved`
                                        }>
                                            <div
                                                className={`w-4 rounded-t ${v === null ? "bg-slate-200" : below ? "bg-red-400" : "bg-emerald-400"}`}
                                                style={{ height: `${height}%` }}
                                            />
                                            <span className="text-[8px] text-slate-400 whitespace-nowrap">
                                                {new Date(h.asOf).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        {(() => {
                            const first = trend.find((h) => h.projectedGomPercent !== null);
                            const last = [...trend].reverse().find((h) => h.projectedGomPercent !== null);
                            if (!first || !last || first === last) return null;
                            const move = (last.projectedGomPercent as number) - (first.projectedGomPercent as number);
                            return (
                                <p className={`text-xs mt-3 font-semibold ${move < 0 ? "text-red-700" : "text-emerald-700"}`}>
                                    {move < 0 ? "Slid" : "Improved"} {Math.abs(Math.round(move * 10) / 10)} points since{" "}
                                    {new Date(first.asOf).toLocaleDateString(undefined, { day: "numeric", month: "short" })}.
                                </p>
                            );
                        })()}
                    </>
                )}
            </div>

            {/* ── Month by month ───────────────────────────────────────────── */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                <h4 className="text-sm font-bold text-slate-800 mb-3">Planned vs actual cost, by month</h4>
                <div className="overflow-x-auto">
                    <table className="text-xs w-full min-w-[560px]">
                        <thead>
                            <tr className="text-slate-500 border-b border-slate-200">
                                <th className="p-2 text-left font-semibold">Month</th>
                                <th className="p-2 text-right font-semibold">Planned</th>
                                <th className="p-2 text-right font-semibold">Actual</th>
                                <th className="p-2 text-right font-semibold">Variance</th>
                                <th className="p-2 text-right font-semibold">Hours</th>
                                <th className="p-2 text-left font-semibold pl-3">&nbsp;</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.monthly.map((r) => (
                                <tr key={r.month} className={`border-b border-slate-100 ${r.unplannedMonth ? "bg-red-50/40" : ""}`}>
                                    <td className="p-2 font-medium text-slate-800">{monthLabel(r.month)}</td>
                                    <td className="p-2 text-right text-slate-700">
                                        {r.plannedCost === null ? <span className="text-slate-300">–</span> : fmtCurrency(r.plannedCost)}
                                    </td>
                                    <td className="p-2 text-right text-slate-700">
                                        {r.actualCost === null ? <span className="text-slate-300">–</span> : fmtCurrency(r.actualCost)}
                                    </td>
                                    <td className={`p-2 text-right font-semibold ${varianceTone(r.variance)}`}>
                                        {r.variance === null ? <span className="text-slate-300">–</span>
                                            : <>{r.variance > 0 ? "+" : ""}{fmtCurrency(r.variance)}</>}
                                    </td>
                                    <td className="p-2 text-right text-slate-600">
                                        {r.actualHours === null ? <span className="text-slate-300">–</span> : r.actualHours.toLocaleString()}
                                    </td>
                                    <td className="p-2 pl-3 whitespace-nowrap">
                                        {r.unplannedMonth && (
                                            <span className="px-1.5 py-0 rounded-full text-[9px] font-semibold border bg-red-100 text-red-700 border-red-300">
                                                not in plan
                                            </span>
                                        )}
                                        {r.notStarted && (
                                            <span className="px-1.5 py-0 rounded-full text-[9px] font-semibold border bg-slate-100 text-slate-500 border-slate-300">
                                                not started
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                    Planned figures come from the approved presales estimate&apos;s monthly GOM breakdown; actuals are
                    Q-People hours priced on the rate card this deal was estimated against — the one live when the
                    opportunity was created, applied to every month, so a later card cannot re-price work that was
                    quoted on the old one. Only months appearing on both sides feed
                    the variance above. The projection, when shown, carries {projection.basis}.
                </p>
            </div>
        </div>
    );
}
