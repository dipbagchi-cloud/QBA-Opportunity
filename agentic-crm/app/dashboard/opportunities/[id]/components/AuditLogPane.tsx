"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_URL, getAuthHeaders } from "@/lib/api";
import { History, RefreshCw, ChevronRight } from "lucide-react";

interface AuditEntry {
    id: string;
    action: string;
    changes: any;
    timestamp: string;
    user: { id: string; name: string; email: string } | null;
}

interface AuditLogPaneProps {
    opportunityId: string;
}

const actionMeta: Record<string, { label: string; color: string }> = {
    CREATE:                  { label: "Created",                  color: "bg-emerald-100 text-emerald-700" },
    UPDATE:                  { label: "Updated",                  color: "bg-blue-100 text-blue-700" },
    STAGE_CHANGE:            { label: "Stage Changed",            color: "bg-indigo-100 text-indigo-700" },
    COMMENT_ADDED:           { label: "Comment Added",            color: "bg-slate-100 text-slate-600" },
    SEND_BACK_REESTIMATE:    { label: "Sent for Re-estimate",     color: "bg-amber-100 text-amber-700" },
    ESTIMATION_SUBMITTED:    { label: "Estimation Submitted",     color: "bg-cyan-100 text-cyan-700" },
    CONVERT_TO_PROJECT:      { label: "Converted to Project",     color: "bg-violet-100 text-violet-700" },
    MARK_LOST:               { label: "Marked as Lost",           color: "bg-red-100 text-red-700" },
    GOM_APPROVED:            { label: "GOM Approved",             color: "bg-green-100 text-green-700" },
    GOM_REVOKED:             { label: "GOM Approval Revoked",     color: "bg-orange-100 text-orange-700" },
    GOM_APPROVAL_REQUESTED:  { label: "GOM Approval Requested",   color: "bg-yellow-100 text-yellow-700" },
    GOM_REJECTED:            { label: "GOM Rejected",             color: "bg-red-100 text-red-700" },
    ON_HOLD:                 { label: "Placed On Hold",           color: "bg-amber-100 text-amber-700" },
    HOLD_REMOVED:            { label: "Hold Removed",             color: "bg-teal-100 text-teal-700" },
    MOVED_TO_PRESALES:       { label: "Moved to Presales",        color: "bg-purple-100 text-purple-700" },
    PROPOSAL_SENT:           { label: "Proposal Sent",            color: "bg-pink-100 text-pink-700" },
    CLOSED_WON:              { label: "Closed Won",               color: "bg-emerald-100 text-emerald-700" },
};

// Parse a stage-change string like "Stage changed from 'A' to 'B'"
function parseStageChange(changes: string): { from: string; to: string } | null {
    const match = changes.match(/Stage changed from '(.+?)' to '(.+?)'/);
    if (match) return { from: match[1], to: match[2] };
    return null;
}

export function AuditLogPane({ opportunityId }: AuditLogPaneProps) {
    const [logs, setLogs] = useState<AuditEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}/audit-log`, {
                headers: getAuthHeaders(),
            });
            if (res.ok) setLogs(await res.json());
        } catch (err) {
            console.error("Failed to load audit log", err);
        } finally {
            setIsLoading(false);
        }
    }, [opportunityId]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const formatChanges = (changes: any): string => {
        if (!changes) return "";
        if (typeof changes === "string") return changes;
        try {
            const obj = typeof changes === "object" ? changes : JSON.parse(changes);
            return Object.entries(obj)
                .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                .join(", ");
        } catch {
            return String(changes);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 min-h-[300px] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-800">Audit Log</h3>
                </div>
                <button onClick={fetchLogs} className="text-slate-400 hover:text-slate-600" title="Refresh">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {logs.length === 0 && !isLoading && (
                    <p className="px-4 py-6 text-center text-xs text-slate-400">No audit log entries</p>
                )}
                {isLoading && logs.length === 0 && (
                    <p className="px-4 py-6 text-center text-xs text-slate-400">Loading…</p>
                )}
                {logs.map((entry) => {
                    const meta = actionMeta[entry.action] || { label: entry.action, color: "bg-slate-100 text-slate-600" };
                    const changesStr = typeof entry.changes === "string" ? entry.changes : formatChanges(entry.changes);
                    const stageChange = entry.action === "STAGE_CHANGE" ? parseStageChange(changesStr) : null;

                    return (
                        <div key={entry.id} className="px-4 py-2.5">
                            <button
                                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                                className="w-full flex items-start gap-2 text-left"
                            >
                                <ChevronRight className={`w-3.5 h-3.5 mt-1 text-slate-400 flex-shrink-0 transition-transform ${expanded === entry.id ? "rotate-90" : ""}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
                                            {meta.label}
                                        </span>
                                        {stageChange && (
                                            <span className="flex items-center gap-1 text-[11px] text-slate-600">
                                                <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-medium">{stageChange.from}</span>
                                                <span className="text-slate-400">→</span>
                                                <span className="px-1.5 py-0.5 bg-indigo-50 rounded text-indigo-600 font-semibold">{stageChange.to}</span>
                                            </span>
                                        )}
                                        <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">
                                            {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        by {entry.user?.name || "System"}
                                    </p>
                                </div>
                            </button>
                            {expanded === entry.id && changesStr && (
                                <div className="ml-5 mt-1.5 px-3 py-2 bg-slate-50 rounded text-[11px] text-slate-600 break-all whitespace-pre-wrap">
                                    {changesStr}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
