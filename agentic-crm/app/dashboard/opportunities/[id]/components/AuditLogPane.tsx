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

const actionLabels: Record<string, string> = {
    CREATE: "Created",
    UPDATE: "Updated",
    STAGE_CHANGE: "Stage Changed",
    COMMENT_ADDED: "Comment Added",
    SEND_BACK_REESTIMATE: "Sent for Re-estimate",
    ESTIMATION_SUBMITTED: "Estimation Submitted",
    CONVERT_TO_PROJECT: "Converted to Project",
    MARK_LOST: "Marked as Lost",
    GOM_APPROVED: "GOM Approved",
    GOM_REVOKED: "GOM Approval Revoked",
};

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
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-800">Audit Log</h3>
                </div>
                <button onClick={fetchLogs} className="text-slate-400 hover:text-slate-600">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {logs.length === 0 && !isLoading && (
                    <p className="px-4 py-6 text-center text-xs text-slate-400">No audit log entries</p>
                )}
                {logs.map((entry) => (
                    <div key={entry.id} className="px-4 py-2.5">
                        <button
                            onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                            className="w-full flex items-start gap-2 text-left"
                        >
                            <ChevronRight className={`w-3.5 h-3.5 mt-0.5 text-slate-400 transition-transform ${expanded === entry.id ? "rotate-90" : ""}`} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-700">
                                        {actionLabels[entry.action] || entry.action}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    by {entry.user?.name || "System"}
                                </p>
                            </div>
                        </button>
                        {expanded === entry.id && entry.changes && (
                            <div className="ml-5 mt-1.5 px-3 py-2 bg-slate-50 rounded text-[11px] text-slate-600 break-all">
                                {formatChanges(entry.changes)}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
