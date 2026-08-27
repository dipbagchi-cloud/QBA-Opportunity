"use client";

/**
 * "Start over" for one deal's Actual GOM.
 *
 * Drops the stored snapshots, the resource plan, and the Q-People project
 * mapping. The deal falls back to Unmapped and produces no actuals until
 * someone maps it again.
 *
 * Snapshots regenerate on their own; the resource plan and the mapping do not —
 * both were picked by hand and have to be picked again. So this asks twice, and
 * the second ask states the actual counts rather than a generic warning: a
 * reset that costs you a project code is a different decision from one that
 * costs you four hand-matched people, and only the numbers distinguish them.
 */

import React, { useState, useCallback } from "react";
import { API_URL, getAuthHeaders } from "@/lib/api";
import { RotateCcw, AlertTriangle, X, Loader2 } from "lucide-react";

interface Preview {
    mapping: { code: string; name: string; id: string } | null;
    planRows: number;
    planFilled: number;
    snapshots: number;
    anythingToReset: boolean;
}

export default function ResetActualGom({
    opportunityId,
    onReset,
}: {
    opportunityId: string;
    onReset?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const start = useCallback(async () => {
        setOpen(true);
        setLoading(true);
        setError(null);
        setDone(null);
        try {
            const res = await fetch(
                `${API_URL}/api/opportunities/${opportunityId}/qpeople/actual-gom/reset-preview`,
                { headers: getAuthHeaders() },
            );
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
            setPreview(body);
        } catch (e: any) {
            setError(e?.message || "Could not read the current state");
        } finally {
            setLoading(false);
        }
    }, [opportunityId]);

    async function confirm() {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}/qpeople/actual-gom`, {
                method: "DELETE",
                headers: getAuthHeaders(),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
            setDone("Actual GOM reset. This deal is unmapped again.");
            setPreview(null);
            onReset?.();
        } catch (e: any) {
            setError(e?.message || "Could not reset");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="relative">
            <button
                onClick={open ? () => setOpen(false) : start}
                className="text-[11px] text-slate-400 hover:text-red-600 flex items-center gap-1 transition-colors"
                title="Clear this deal's Actual GOM and start again"
            >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Actual GOM
            </button>

            {open && (
                <div className="absolute right-0 top-6 z-30 w-[26rem] bg-white rounded-lg shadow-lg border border-red-300 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <h4 className="text-sm font-bold text-slate-900">Reset Actual GOM?</h4>
                        </div>
                        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {loading && (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking what exists…
                        </p>
                    )}

                    {error && (
                        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-md p-2 mb-2">
                            {error}
                        </div>
                    )}

                    {done && (
                        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md p-2">
                            {done}
                        </div>
                    )}

                    {preview && !done && (
                        <>
                            {!preview.anythingToReset ? (
                                <p className="text-xs text-slate-500">
                                    There is nothing to reset — this deal has no Actual GOM data yet.
                                </p>
                            ) : (
                                <>
                                    <p className="text-xs text-slate-600 mb-2">This will permanently delete:</p>
                                    <ul className="text-xs text-slate-700 space-y-1 mb-3 list-disc pl-4">
                                        <li>
                                            {preview.mapping ? (
                                                <>the Q-People project mapping —{" "}
                                                    <strong>{preview.mapping.code}</strong>{" "}
                                                    <span className="text-slate-500">({preview.mapping.name})</span>
                                                </>
                                            ) : (
                                                <span className="text-slate-400">no project mapping</span>
                                            )}
                                        </li>
                                        <li>
                                            {preview.planRows > 0 ? (
                                                <>
                                                    <strong>{preview.planRows}</strong> resource-plan{" "}
                                                    {preview.planRows === 1 ? "row" : "rows"}
                                                    {preview.planFilled > 0 && (
                                                        <>, of which <strong>{preview.planFilled}</strong> {preview.planFilled === 1 ? "has" : "have"} a
                                                            person hand-picked against {preview.planFilled === 1 ? "it" : "them"}</>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-slate-400">no resource-plan rows</span>
                                            )}
                                        </li>
                                        <li>
                                            {preview.snapshots > 0 ? (
                                                <>
                                                    <strong>{preview.snapshots}</strong> stored margin{" "}
                                                    {preview.snapshots === 1 ? "snapshot" : "snapshots"}{" "}
                                                    <span className="text-slate-500">(these would rebuild on their own)</span>
                                                </>
                                            ) : (
                                                <span className="text-slate-400">no stored snapshots</span>
                                            )}
                                        </li>
                                    </ul>

                                    <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                                        The deal returns to <strong>Unmapped</strong> and shows no actual cost or margin
                                        until it is mapped again. Timesheets in Q-People are untouched — this only
                                        deletes QCRM&apos;s own record. <strong>It cannot be undone from the app.</strong>
                                    </p>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={confirm}
                                            disabled={busy}
                                            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                                            {busy ? "Resetting…" : "Yes, delete and reset"}
                                        </button>
                                        <button
                                            onClick={() => setOpen(false)}
                                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium hover:bg-slate-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
