"use client";

/**
 * Actual GOM → "Actual Booking & Cost" (second sub-tab).
 *
 * Monthly grid: who booked time on the mapped Q-People project, how much, and
 * what it cost. Q-People holds no money at all, so every currency figure is
 * computed by QCRM from hours x the rate card that was live in that month.
 */

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { API_URL, getAuthHeaders } from "@/lib/api";
import { useCurrency } from "@/components/providers/currency-provider";
import {
    Clock, RefreshCw, AlertTriangle, Info, Users, ChevronDown, ChevronRight, Layers,
} from "lucide-react";

interface Cell {
    hours: number;
    submittedHours: number;
    draftHours: number;
    days: number;
    cost: number | null;
    draftCost: number | null;
    rateBatch: string | null;
    rateExtrapolated: boolean;
    rateFallback: boolean;
    rateBandUsed: string | null;
    level: string | null;
}

interface Row {
    employeeId: string;
    employeeName: string;
    designation: string | null;
    branch: string | null;
    skill: string | null;
    experienceYears: number | null;
    experienceBandKey: string | null;
    experienceBandLabel: string | null;
    inPlan: boolean;
    monthly: Record<string, Cell>;
    totalHours: number;
    submittedHours: number;
    draftHours: number;
    totalDays: number;
    totalCost: number | null;
    draftCost: number | null;
    priced: boolean;
    // Priced, but at a band the card covers rather than the person's own.
    rateFallback: boolean;
    rateFallbackNote: string | null;
    unpricedReason: string | null;
}

interface Payload {
    project: { id: string; code: string; name: string };
    months: string[];
    rows: Row[];
    monthTotals: Record<string, { hours: number; draftHours: number; cost: number; draftCost: number; priced: boolean }>;
    totals: {
        people: number; hours: number; submittedHours: number; draftHours: number;
        days: number; cost: number; submittedCost: number; draftCost: number;
        unpricedPeople: number; fallbackPricedPeople: number; unplannedPeople: number;
    };
    basis: {
        hoursPerDay: number;
        workingDaysPerYear: number;
        timesheetFilter: string;
        rateBasis: string;
        rateCardUsed: string | null;
        rateCardRule: string;
        rateCardSource: string;
        rateCardInferred: boolean;
        rateCardExtrapolated: boolean;
        cardSwitchedSinceEstimate: boolean;
        latestRateCard: string | null;
        opportunityCreatedAt: string | null;
        initialSubmissionAt: string | null;
        rateCardVersioning: { label: string; from: string }[];
    };
    atLatestCard: {
        batchLabel: string;
        batchFrom: string;
        cost: number;
        monthTotals: Record<string, { hours: number; draftHours: number; cost: number; draftCost: number; priced: boolean }>;
        byEmployee: Record<string, { totalCost: number | null; monthly: Record<string, number | null> }>;
        delta: number;
        deltaPercent: number | null;
    } | null;
    warnings: string[];
}

const WARNING_TEXT: Record<string, string> = {
    "draft-time": "Some time is still in draft in Q-People and has not been submitted. It is included here and marked, because submission lags by weeks — but it is not yet approved effort.",
    "no-skillset": "Some people have no Skillset GOM recorded, so their time cannot be priced.",
    "no-experience": "Some people have no experience recorded, so their band — and therefore their rate — is unknown.",
    "no-rate": "Some people have no matching rate card entry for their skill and band.",
    "rate-fallback": "The rate card has no row at some people's experience band, so they are priced at the highest band it does cover. Those figures understate senior cost — add the missing bands to the cost card to fix it.",
    "location": "Some people are based where the rate card has no location column (Uzbekistan, Georgia, Indonesia); the India/Kolkata base CTC is used.",
};

function monthLabel(m: string) {
    const [y, mo] = m.split("-");
    return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(mo) - 1]} ${y.slice(2)}`;
}

export default function ActualBookingCostTab({ opportunityId }: { opportunityId: string }) {
    const { format: fmtCurrency } = useCurrency();
    const [data, setData] = useState<Payload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Months start expanded — the per-person split is the point of the table,
    // not something to go hunting for.
    const [closedMonths, setClosedMonths] = useState<Set<string>>(new Set());

    const load = useCallback(async (refresh = false) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `${API_URL}/api/opportunities/${opportunityId}/qpeople/actual-cost${refresh ? "?refresh=true" : ""}`,
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

    const grand = useMemo(() => data?.totals, [data]);
    // Hours and cost are now columns rather than a toggle, and the second cost
    // card only earns its columns when one actually exists.
    const dual = !!data?.atLatestCard;

    if (loading) {
        return (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                Reading timesheets from Q-People…
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-900">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                <div className="text-sm">
                    <p className="font-semibold mb-0.5">Cannot show actual booking</p>
                    <p className="text-xs">{error}</p>
                    <button onClick={() => load(true)} className="mt-2 text-xs font-semibold underline">Retry</button>
                </div>
            </div>
        );
    }

    if (!data || !data.months.length) {
        return (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
                <Clock className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No timesheets booked against this project</p>
                <p className="text-xs text-slate-500 mt-1">
                    Nothing has been logged in Q-People for this project yet — draft or submitted.
                    Only cancelled timesheets are ignored.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-600" />
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Actual Booking &amp; Cost</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {data.project.code} — {data.project.name}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => load(true)} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                            <RefreshCw className="w-3.5 h-3.5" /> Refresh
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">People booked</p>
                        <p className="font-semibold text-sm text-slate-800">{grand?.people}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Hours</p>
                        <p className="font-semibold text-sm text-slate-800">{grand?.hours.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Days @ {data.basis.hoursPerDay}h</p>
                        <p className="font-semibold text-sm text-slate-800">{grand?.days.toLocaleString()}</p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                        <p className="text-xs text-indigo-600 mb-1">Actual cost</p>
                        <p className="font-semibold text-sm text-indigo-800">{fmtCurrency(grand?.cost || 0)}</p>
                        {!!grand?.draftCost && (
                            <p className="text-[10px] text-indigo-600/80 mt-0.5">
                                incl. {fmtCurrency(grand.draftCost)} not yet submitted
                            </p>
                        )}
                    </div>
                </div>

                {/* Submission state — this is the difference between a firm number
                    and a provisional one, so it is stated rather than implied. */}
                {!!grand?.draftHours && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
                        <span className="px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-300">
                            {grand.submittedHours.toLocaleString()} h submitted · {fmtCurrency(grand.submittedCost)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-300">
                            {grand.draftHours.toLocaleString()} h still draft · {fmtCurrency(grand.draftCost)}
                        </span>
                        <span className="text-slate-500">
                            {Math.round((grand.draftHours / (grand.hours || 1)) * 100)}% of this project&apos;s time
                            is not yet submitted in Q-People
                        </span>
                    </div>
                )}

                {(grand?.unpricedPeople || grand?.unplannedPeople) ? (
                    <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
                        {!!grand?.unpricedPeople && (
                            <span className="px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-300">
                                {grand.unpricedPeople} unpriced — cost understated
                            </span>
                        )}
                        {!!grand?.fallbackPricedPeople && (
                            <span className="px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-300">
                                {grand.fallbackPricedPeople} priced at a lower band — approximate
                            </span>
                        )}
                        {!!grand?.unplannedPeople && (
                            <span className="px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-300">
                                {grand.unplannedPeople} not on the plan
                            </span>
                        )}
                    </div>
                ) : null}
            </div>

            {/* ── Two cards, one set of hours ───────────────────────────────
                Only shown when a cost card landed after this deal was sold.
                The two answer different questions and are labelled as such:
                the left is the baseline every variance is measured against,
                the right is what the same work costs at today's rates. */}
            {data.atLatestCard && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                    <div className="flex items-center gap-2 mb-1">
                        <Layers className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-sm font-bold text-slate-800">A new cost card landed mid-delivery</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-4 max-w-3xl">
                        The same {data.totals.hours.toLocaleString()} booked hours, priced both ways.
                        These are not a before and after — they are two different questions.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                            <p className="text-xs text-indigo-700 mb-1 font-semibold">Cost When Sold</p>
                            <p className="font-bold text-lg text-indigo-900">{fmtCurrency(data.totals.cost)}</p>
                            <p className="text-[10px] text-indigo-700/80 mt-1">{data.basis.rateCardUsed}</p>
                            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                                The baseline. Every margin and variance figure on this deal is measured
                                against this, because it is the rate the work was quoted at.
                            </p>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                            <p className="text-xs text-slate-600 mb-1 font-semibold">At today&apos;s card</p>
                            <p className="font-bold text-lg text-slate-800">{fmtCurrency(data.atLatestCard.cost)}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{data.atLatestCard.batchLabel}</p>
                            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                                What this same effort would cost at current rates. Relevant to what the
                                remaining work will cost, and to any re-pricing conversation.
                            </p>
                        </div>

                        <div className={`rounded-lg p-3 border ${data.atLatestCard.delta > 0
                            ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                            <p className={`text-xs mb-1 font-semibold ${data.atLatestCard.delta > 0 ? "text-red-700" : "text-emerald-700"}`}>
                                Difference
                            </p>
                            <p className={`font-bold text-lg ${data.atLatestCard.delta > 0 ? "text-red-800" : "text-emerald-800"}`}>
                                {data.atLatestCard.delta > 0 ? "+" : ""}{fmtCurrency(data.atLatestCard.delta)}
                            </p>
                            {data.atLatestCard.deltaPercent !== null && (
                                <p className={`text-[10px] mt-1 font-semibold ${data.atLatestCard.delta > 0 ? "text-red-700" : "text-emerald-700"}`}>
                                    {data.atLatestCard.deltaPercent > 0 ? "+" : ""}{data.atLatestCard.deltaPercent}% on the new card
                                </p>
                            )}
                            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                                Rate movement alone. None of this is delivery performance \u2014 the hours are identical.
                            </p>
                        </div>
                    </div>

                </div>
            )}

            {/* Warnings */}
            {data.warnings.length > 0 && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-900">
                    <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                    <ul className="text-xs leading-relaxed list-disc pl-4 space-y-0.5">
                        {data.warnings.map((w) => <li key={w}>{WARNING_TEXT[w] || w}</li>)}
                    </ul>
                </div>
            )}

            {/* ── Month, then the people inside it ──────────────────────────
                Grouped this way round on purpose. The question the two cost
                cards raise is "where is the difference coming from", and the
                answer is a month first (when the new card started applying)
                and a person second (who inside that month is expensive). A
                person-first table forced the reader to hold three monthly
                figures per person in their head to see it. */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-slate-500" />
                    <h4 className="text-sm font-bold text-slate-800">
                        Cost by month and person{dual ? " — on both cost cards" : ""}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                        {data.months.length} month{data.months.length === 1 ? "" : "s"} ·{" "}
                        {data.rows.length} {data.rows.length === 1 ? "person" : "people"} · click a month to collapse it
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="text-xs w-full min-w-[720px]">
                        <thead>
                            <tr className="text-slate-500 border-b border-slate-200">
                                <th className="p-2 text-left font-semibold min-w-[260px]">Month / person</th>
                                <th className="p-2 text-right font-semibold">Hours</th>
                                <th className="p-2 text-right font-semibold">{dual ? "Cost When Sold" : "Cost"}</th>
                                {dual && <th className="p-2 text-right font-semibold">At today&apos;s card</th>}
                                {dual && <th className="p-2 text-right font-semibold">Difference</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {data.months.map((m) => {
                                const t = data.monthTotals[m];
                                const at = data.atLatestCard?.monthTotals?.[m];
                                const md = at ? at.cost - t.cost : null;
                                const collapsed = closedMonths.has(m);
                                // Only the people who actually booked in this month.
                                const people = data.rows.filter((r) => r.monthly[m]);

                                return (
                                    <React.Fragment key={m}>
                                        <tr
                                            className="border-b border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100"
                                            onClick={() => setClosedMonths((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(m)) next.delete(m); else next.add(m);
                                                return next;
                                            })}
                                        >
                                            <td className="p-2 font-bold text-slate-800">
                                                <span className="inline-flex items-center gap-1.5">
                                                    {collapsed ? <ChevronRight className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                                                    {monthLabel(m)}
                                                    <span className="font-normal text-[10px] text-slate-400">
                                                        {people.length} {people.length === 1 ? "person" : "people"}
                                                    </span>
                                                </span>
                                            </td>
                                            <td className="p-2 text-right font-bold text-slate-800">{t.hours.toLocaleString()}</td>
                                            <td className="p-2 text-right font-bold text-slate-900">{fmtCurrency(t.cost)}</td>
                                            {dual && <td className="p-2 text-right font-bold text-slate-800">{fmtCurrency(at?.cost ?? 0)}</td>}
                                            {dual && (
                                                <td className={`p-2 text-right font-bold ${md === null ? "text-slate-300" : md > 0 ? "text-red-600" : md < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                                                    {md === null ? "–" : <>{md > 0 ? "+" : ""}{fmtCurrency(md)}</>}
                                                </td>
                                            )}
                                        </tr>

                                        {!collapsed && people.map((r) => {
                                            const c = r.monthly[m];
                                            const am = data.atLatestCard?.byEmployee?.[r.employeeId]?.monthly?.[m] ?? null;
                                            const pd = (c.cost !== null && am !== null) ? am - c.cost : null;
                                            return (
                                                <tr key={m + r.employeeId} className={`border-b border-slate-100 hover:bg-slate-50 ${!r.priced ? "bg-amber-50/40" : ""}`}>
                                                    <td className="p-2 pl-8">
                                                        <div className="text-slate-800 flex items-center gap-1.5 flex-wrap">
                                                            {r.employeeName}
                                                            {!r.inPlan && (
                                                                <span className="px-1.5 py-0 rounded-full text-[9px] font-semibold border bg-red-100 text-red-700 border-red-300">
                                                                    not in plan
                                                                </span>
                                                            )}
                                                            {r.rateFallback && (
                                                                <span
                                                                    className="px-1.5 py-0 rounded-full text-[9px] font-semibold border bg-amber-100 text-amber-800 border-amber-300"
                                                                    title={r.rateFallbackNote || ""}
                                                                >
                                                                    approx. rate
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500">
                                                            {r.skill || <span className="italic">no skillset</span>}
                                                            {r.experienceBandLabel ? ` · ${r.experienceBandLabel}` : ""}
                                                            {c.rateBandUsed && c.rateBandUsed !== r.experienceBandKey
                                                                ? ` · priced at ${c.rateBandUsed}`
                                                                : ""}
                                                        </div>
                                                    </td>
                                                    <td className="p-2 text-right whitespace-nowrap text-slate-700">
                                                        <span
                                                            className={c.draftHours > 0 ? "border-b border-dotted border-amber-500" : ""}
                                                            title={c.draftHours > 0 ? `${c.submittedHours}h submitted, ${c.draftHours}h still draft` : undefined}
                                                        >
                                                            {c.hours.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 text-right whitespace-nowrap text-slate-700">
                                                        {c.cost === null
                                                            ? <span className="text-amber-600" title={r.unpricedReason || ""}>n/a</span>
                                                            : fmtCurrency(c.cost)}
                                                    </td>
                                                    {dual && (
                                                        <td className="p-2 text-right whitespace-nowrap text-slate-700">
                                                            {am === null ? <span className="text-slate-300">–</span> : fmtCurrency(am)}
                                                        </td>
                                                    )}
                                                    {dual && (
                                                        <td className={`p-2 text-right whitespace-nowrap font-semibold ${pd === null ? "text-slate-300" : pd > 0 ? "text-red-600" : pd < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                                                            {pd === null ? "–" : <>{pd > 0 ? "+" : ""}{fmtCurrency(pd)}</>}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}

                            <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                                <td className="p-2 text-slate-800">
                                    Total
                                    <span className="ml-2 font-normal text-[10px] text-slate-500">
                                        {data.totals.people} {data.totals.people === 1 ? "person" : "people"} across {data.months.length} month{data.months.length === 1 ? "" : "s"}
                                    </span>
                                </td>
                                <td className="p-2 text-right text-slate-900">{data.totals.hours.toLocaleString()}</td>
                                <td className="p-2 text-right text-slate-900">{fmtCurrency(data.totals.cost)}</td>
                                {dual && <td className="p-2 text-right text-slate-900">{fmtCurrency(data.atLatestCard!.cost)}</td>}
                                {dual && (
                                    <td className={`p-2 text-right ${data.atLatestCard!.delta > 0 ? "text-red-700" : "text-emerald-700"}`}>
                                        {data.atLatestCard!.delta > 0 ? "+" : ""}{fmtCurrency(data.atLatestCard!.delta)}
                                    </td>
                                )}
                            </tr>
                        </tbody>
                    </table>
                </div>

                <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                    Q-People records no cost data, so every figure here is computed by QCRM:
                    hours ÷ {data.basis.hoursPerDay} = days, priced on{" "}
                    <strong>{data.basis.rateCardUsed || "no rate card"}</strong> — {data.basis.rateCardRule}
                    {data.basis.rateCardInferred && (
                        <span className="text-amber-700 font-semibold"> (inferred, not recorded)</span>
                    )} —
                    on each person&apos;s own skill and experience band, using
                    the {data.basis.workingDaysPerYear}-productive-day basis the estimate used.
                    Every month is priced on that same card, so a card issued mid-delivery does not
                    silently re-price work that was quoted against the old one.
                    Timesheets: {data.basis.timesheetFilter}.
                </p>
            </div>
        </div>
    );
}
