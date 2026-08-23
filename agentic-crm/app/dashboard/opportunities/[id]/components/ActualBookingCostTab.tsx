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
    Clock, RefreshCw, AlertTriangle, Info, Users, ChevronDown, ChevronRight,
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
    level: string | null;
}

interface Row {
    employeeId: string;
    employeeName: string;
    designation: string | null;
    branch: string | null;
    skill: string | null;
    experienceYears: number | null;
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
        unpricedPeople: number; unplannedPeople: number;
    };
    basis: {
        hoursPerDay: number;
        workingDaysPerYear: number;
        timesheetFilter: string;
        rateBasis: string;
        rateCardVersioning: { label: string; from: string }[];
    };
    warnings: string[];
}

const WARNING_TEXT: Record<string, string> = {
    "draft-time": "Some time is still in draft in Q-People and has not been submitted. It is included here and marked, because submission lags by weeks — but it is not yet approved effort.",
    "no-skillset": "Some people have no Skillset GOM recorded, so their time cannot be priced.",
    "no-experience": "Some people have no experience recorded, so their band — and therefore their rate — is unknown.",
    "no-rate": "Some people have no matching rate card entry for their skill and band.",
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
    const [show, setShow] = useState<"cost" | "hours">("cost");
    const [openRow, setOpenRow] = useState<string | null>(null);

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
                        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                            <button
                                onClick={() => setShow("cost")}
                                className={`px-3 py-1 rounded-md text-xs font-medium ${show === "cost" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"}`}
                            >Cost</button>
                            <button
                                onClick={() => setShow("hours")}
                                className={`px-3 py-1 rounded-md text-xs font-medium ${show === "hours" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"}`}
                            >Hours</button>
                        </div>
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
                        {!!grand?.unplannedPeople && (
                            <span className="px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-300">
                                {grand.unplannedPeople} not on the plan
                            </span>
                        )}
                    </div>
                ) : null}
            </div>

            {/* Warnings */}
            {data.warnings.length > 0 && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-900">
                    <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                    <ul className="text-xs leading-relaxed list-disc pl-4 space-y-0.5">
                        {data.warnings.map((w) => <li key={w}>{WARNING_TEXT[w] || w}</li>)}
                    </ul>
                </div>
            )}

            {/* Monthly grid */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-slate-500" />
                    <h4 className="text-sm font-bold text-slate-800">
                        Monthly {show === "cost" ? "cost" : "hours"} by person
                    </h4>
                    <span className="text-[11px] text-slate-400">
                        {data.months.length} month{data.months.length === 1 ? "" : "s"} with bookings
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="text-xs" style={{ minWidth: 640 + data.months.length * 92 }}>
                        <thead>
                            <tr className="text-slate-500 border-b border-slate-200">
                                <th className="p-2 text-left font-semibold sticky left-0 bg-white z-10 min-w-[230px]">Person</th>
                                {data.months.map((m) => (
                                    <th key={m} className="p-2 text-right font-semibold whitespace-nowrap min-w-[88px]">{monthLabel(m)}</th>
                                ))}
                                <th className="p-2 text-right font-semibold whitespace-nowrap border-l border-slate-200 min-w-[96px]">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.map((r) => {
                                const open = openRow === r.employeeId;
                                return (
                                    <React.Fragment key={r.employeeId}>
                                        <tr
                                            className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${!r.priced ? "bg-amber-50/40" : ""}`}
                                            onClick={() => setOpenRow(open ? null : r.employeeId)}
                                        >
                                            <td className="p-2 sticky left-0 bg-inherit z-10">
                                                <div className="flex items-start gap-1.5">
                                                    {open ? <ChevronDown className="w-3 h-3 mt-0.5 text-slate-400" /> : <ChevronRight className="w-3 h-3 mt-0.5 text-slate-400" />}
                                                    <div>
                                                        <div className="text-slate-800 font-medium flex items-center gap-1.5">
                                                            {r.employeeName}
                                                            {!r.inPlan && (
                                                                <span className="px-1.5 py-0 rounded-full text-[9px] font-semibold border bg-red-100 text-red-700 border-red-300">
                                                                    not in plan
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500">
                                                            {r.skill || <span className="italic">no skillset</span>}
                                                            {r.experienceBandLabel ? ` · ${r.experienceBandLabel}` : ""}
                                                            {r.branch ? ` · ${r.branch}` : ""}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            {data.months.map((m) => {
                                                const c = r.monthly[m];
                                                return (
                                                    <td key={m} className="p-2 text-right whitespace-nowrap text-slate-700">
                                                        {!c ? <span className="text-slate-300">–</span> : (
                                                            <span
                                                                className={c.draftHours > 0 ? "border-b border-dotted border-amber-500" : ""}
                                                                title={c.draftHours > 0
                                                                    ? `${c.submittedHours}h submitted, ${c.draftHours}h still draft`
                                                                    : undefined}
                                                            >
                                                                {show === "hours" ? c.hours
                                                                    : c.cost === null ? <span className="text-amber-600" title={r.unpricedReason || ""}>n/a</span>
                                                                        : fmtCurrency(c.cost)}
                                                            </span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="p-2 text-right font-semibold whitespace-nowrap border-l border-slate-200 text-slate-900">
                                                {show === "hours" ? r.totalHours
                                                    : r.totalCost === null ? <span className="text-amber-600">n/a</span> : fmtCurrency(r.totalCost)}
                                            </td>
                                        </tr>
                                        {open && (
                                            <tr className="bg-slate-50/70">
                                                <td colSpan={data.months.length + 2} className="px-6 py-2 text-[11px] text-slate-600">
                                                    {r.designation && <>Designation: <strong>{r.designation}</strong> · </>}
                                                    {r.experienceYears !== null && <>Experience: <strong>{r.experienceYears}y</strong> · </>}
                                                    Days booked: <strong>{r.totalDays}</strong>
                                                    {!r.priced && <> · <span className="text-amber-700 font-semibold">Not priced — {r.unpricedReason}</span></>}
                                                    {r.priced && (() => {
                                                        const used = [...new Set(Object.values(r.monthly).map((c) => c.rateBatch).filter(Boolean))];
                                                        const extra = Object.values(r.monthly).some((c) => c.rateExtrapolated);
                                                        return <> · Rate card: <strong>{used.join(", ")}</strong>
                                                            {extra && <span className="text-amber-700"> (some months predate any rate card — earliest used)</span>}</>;
                                                    })()}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                                <td className="p-2 sticky left-0 bg-slate-50 z-10 text-slate-800">Total</td>
                                {data.months.map((m) => {
                                    const t = data.monthTotals[m];
                                    return (
                                        <td key={m} className="p-2 text-right whitespace-nowrap text-slate-900">
                                            {show === "hours" ? t.hours : fmtCurrency(t.cost)}
                                        </td>
                                    );
                                })}
                                <td className="p-2 text-right whitespace-nowrap border-l border-slate-200 text-slate-900">
                                    {show === "hours" ? grand?.hours : fmtCurrency(grand?.cost || 0)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                    Q-People records no cost data, so every figure here is computed by QCRM:
                    hours ÷ {data.basis.hoursPerDay} = days, priced at the rate card live in that month
                    ({data.basis.rateCardVersioning.map((b) => b.label).join(" → ")}), on
                    each person&apos;s own skill and experience band, using
                    the {data.basis.workingDaysPerYear}-productive-day basis the estimate used.
                    Timesheets: {data.basis.timesheetFilter}.
                </p>
            </div>
        </div>
    );
}
