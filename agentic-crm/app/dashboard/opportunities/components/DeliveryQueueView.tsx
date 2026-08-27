"use client";

/**
 * Opportunities → "Won / To Map" view.
 *
 * The handover queue. When a deal is won it has to be tied to the Q-People
 * project people book time against, and its plan rows filled with real people,
 * before any actuals exist for it. Until this view there was nowhere to see
 * which won deals were still waiting — you had to already know a deal existed
 * and open it to find out.
 *
 * Deliberately database-only. Nothing here calls Q-People, so it loads instantly
 * and still works when Q-People is down; telling you a deal has no project code
 * should never depend on an external HR system being awake.
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { API_URL, getAuthHeaders } from "@/lib/api";
import { useCurrency } from "@/components/providers/currency-provider";
import {
    RefreshCw, AlertTriangle, CheckCircle2, CircleDashed, CircleAlert, ArrowRight, Clock,
} from "lucide-react";

type Status = "unmapped" | "plan-incomplete" | "ready";

interface QueueRow {
    opportunityId: string;
    title: string;
    client: string | null;
    owner: string | null;
    value: number | null;
    currency: string;
    wonDate: string | null;
    ageDays: number | null;
    status: Status;
    mapped: boolean;
    project: { id: string; code: string; name: string; mappedBy: string | null; mappedAt: string } | null;
    planRows: number;
    planFilled: number;
}

interface Payload {
    rows: QueueRow[];
    totals: {
        won: number; unmapped: number; planIncomplete: number; ready: number;
        oldestUnmappedDays: number;
    };
}

const STATUS_META: Record<Status, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    "unmapped": {
        label: "Unmapped",
        cls: "bg-red-100 text-red-700 border-red-300",
        Icon: CircleAlert,
    },
    "plan-incomplete": {
        label: "Plan incomplete",
        cls: "bg-amber-100 text-amber-800 border-amber-300",
        Icon: CircleDashed,
    },
    "ready": {
        label: "Ready",
        cls: "bg-emerald-100 text-emerald-700 border-emerald-300",
        Icon: CheckCircle2,
    },
};

function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" });
}

/**
 * `initialFilter` lets the Delivery Margin page embed this as its "Unmapped
 * won deals" sub-tab without duplicating the table — one queue, two doors.
 */
export default function DeliveryQueueView({
    initialFilter = "all",
}: { initialFilter?: Status | "all" } = {}) {
    const { format: fmtCurrency } = useCurrency();
    const [data, setData] = useState<Payload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<Status | "all">(initialFilter);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/qpeople/delivery-queue`, {
                headers: getAuthHeaders(),
            });
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

    if (loading) {
        return (
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-sm text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                Loading won deals…
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-900">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                <div className="text-sm">
                    <p className="font-semibold mb-0.5">Cannot load the delivery queue</p>
                    <p className="text-xs">{error}</p>
                    <button onClick={load} className="mt-2 text-xs font-semibold underline">Retry</button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const rows = filter === "all" ? data.rows : data.rows.filter((r) => r.status === filter);
    const t = data.totals;

    const tile = (key: Status | "all", label: string, count: number, tone: string) => (
        <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-left rounded-lg p-3 border transition-colors ${tone} ${filter === key ? "ring-2 ring-indigo-500/60" : ""}`}
        >
            <p className="text-xs mb-1 opacity-80">{label}</p>
            <p className="font-bold text-lg">{count}</p>
        </button>
    );

    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
            {/* Summary — doubles as the filter control. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {tile("all", "Won deals", t.won, "bg-slate-50 border-slate-200 text-slate-800")}
                {tile("unmapped", "Unmapped", t.unmapped, "bg-red-50 border-red-200 text-red-800")}
                {tile("plan-incomplete", "Plan incomplete", t.planIncomplete, "bg-amber-50 border-amber-200 text-amber-900")}
                {tile("ready", "Ready", t.ready, "bg-emerald-50 border-emerald-200 text-emerald-800")}
            </div>

            {/* Aging is the reason this is a queue and not just a list. */}
            {t.unmapped > 0 && t.oldestUnmappedDays > 0 && (
                <div className="flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0 text-red-600" />
                    <span>
                        <strong>{t.unmapped}</strong> won {t.unmapped === 1 ? "deal has" : "deals have"} no Q-People project
                        mapped — the oldest has been waiting <strong>{t.oldestUnmappedDays} days</strong>. No actual cost or
                        margin exists for {t.unmapped === 1 ? "it" : "them"} until {t.unmapped === 1 ? "it is" : "they are"} mapped.
                    </span>
                </div>
            )}

            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <tr className="text-slate-500 text-xs">
                                <th className="p-3 text-left font-semibold">Deal</th>
                                <th className="p-3 text-left font-semibold">Owner</th>
                                <th className="p-3 text-left font-semibold whitespace-nowrap">Won</th>
                                <th className="p-3 text-right font-semibold">Value</th>
                                <th className="p-3 text-left font-semibold">Q-People project</th>
                                <th className="p-3 text-left font-semibold">Plan</th>
                                <th className="p-3 text-left font-semibold">Status</th>
                                <th className="p-3 text-right font-semibold"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const meta = STATUS_META[r.status];
                                const { Icon } = meta;
                                return (
                                    <tr key={r.opportunityId} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="p-3">
                                            <div className="font-medium text-slate-800">{r.title}</div>
                                            <div className="text-xs text-slate-500">{r.client || "—"}</div>
                                        </td>
                                        <td className="p-3 text-xs text-slate-600">{r.owner || "—"}</td>
                                        <td className="p-3 text-xs text-slate-600 whitespace-nowrap">
                                            {fmtDate(r.wonDate)}
                                            {r.ageDays !== null && (
                                                <div className={`text-[10px] ${r.status !== "ready" && r.ageDays > 30 ? "text-red-600 font-semibold" : "text-slate-400"}`}>
                                                    {r.ageDays}d ago
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 text-right text-xs text-slate-700 whitespace-nowrap">
                                            {r.value === null ? "—" : fmtCurrency(r.value)}
                                        </td>
                                        <td className="p-3 text-xs">
                                            {r.project ? (
                                                <>
                                                    <div className="font-medium text-slate-700">{r.project.code}</div>
                                                    <div className="text-[10px] text-slate-500">{r.project.name}</div>
                                                </>
                                            ) : (
                                                <span className="text-slate-300">not mapped</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-xs whitespace-nowrap">
                                            {r.planRows === 0 ? (
                                                <span className="text-slate-300">—</span>
                                            ) : (
                                                <span className={r.planFilled < r.planRows ? "text-amber-700 font-semibold" : "text-slate-600"}>
                                                    {r.planFilled}/{r.planRows} filled
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.cls}`}>
                                                <Icon className="w-3 h-3" />
                                                {meta.label}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right whitespace-nowrap">
                                            <Link
                                                href={`/dashboard/opportunities/${r.opportunityId}?tab=actual-gom`}
                                                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                                            >
                                                {r.status === "unmapped" ? "Map" : r.status === "plan-incomplete" ? "Finish plan" : "Open"}
                                                <ArrowRight className="w-3 h-3" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-sm text-slate-500">
                                        {filter === "all"
                                            ? "No won deals yet."
                                            : `Nothing in "${STATUS_META[filter as Status].label}".`}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
                A deal is <strong>Ready</strong> once it has a Q-People project mapped and every resource-plan row filled
                with a real person — both are needed before actual cost can be computed. This view reads only QCRM data,
                so it does not depend on Q-People being reachable.
            </p>
        </div>
    );
}
