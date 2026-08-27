"use client";

/**
 * Actual GOM → "Project / Resource Mapping" (first sub-tab).
 *
 * Two steps, in order:
 *   1. Map the won deal to the Q-People project people book timesheets against.
 *      The list is fetched live from Q-People and excludes any project already
 *      claimed by another opportunity.
 *   2. Work the delivery resource plan — seeded from the presales Resource
 *      Assignment — and pick Q-People people for each line.
 *
 * Row colour follows origin, which the server derives (never the client):
 *   green  MATCHED — unchanged from the presales estimate
 *   yellow CHANGED — a presales line whose skill / band / role was edited
 *   red    NEW     — a resource type that was never estimated
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL, getAuthHeaders } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
    Link2, Unlink, RefreshCw, Plus, Trash2, AlertTriangle,
    Check, Users, Search, Info, UserCheck,
} from "lucide-react";

// QCRM rate cards carry two spellings of the same bands; the compact form is what
// resource rows actually store, so offer that and tolerate the verbose form.
const EXPERIENCE_BANDS = ["00-02", "02-04", "04-06", "06-08", "08-12", "12-15", ">15"];

interface QProject {
    id: string;
    code: string;
    name: string;
    customer: string | null;
    projectType: string | null;
    status: string | null;
    isActive: boolean;
}

interface CommitmentProject {
    projectId: string | null;
    projectName: string | null;
    percent: number;
    bookedHours: number;
    allowedHours: number;
}

interface Candidate {
    employeeId: string;
    employeeName: string;
    designation: string | null;
    department: string | null;
    grade: string | null;
    experienceYears: number | null;
    experienceKnown: boolean;
    experienceMatches: boolean;
    // Fractional years placed on the shared band ladder: 4.17 -> "4 - 6 Years"
    experienceBandKey: string | null;
    experienceBandLabel: string | null;
    // Q-People's total_allocation is 100 for anyone allocated at all, so it is
    // NOT spare capacity. What is meaningful is how thinly someone is spread.
    projectCount: number;
    commitmentMonth: string | null;
    commitmentProjects: CommitmentProject[];
}

interface PlanRow {
    id: string;
    sourceRowId: string | null;
    origin: "MATCHED" | "CHANGED" | "NEW";
    skill: string | null;
    experienceBand: string | null;
    projectRole: string | null;
    quantity: number;
    originalSkill: string | null;
    originalExperienceBand: string | null;
    originalProjectRole: string | null;
    employeeId: string | null;
    employeeName: string | null;
    candidates?: Candidate[];
}

interface Coverage {
    activeEmployees: number;
    taggedWithSkillset: number;
    withExperience: number;
    ready: boolean;
}

type FindingStatus = "MATCHED" | "SKILL_MISMATCH" | "UNPLANNED" | "NOT_ALLOCATED";

interface Finding {
    employeeId: string;
    employeeName: string;
    qpeopleSkill: string | null;
    designation: string | null;
    allocationPercent: number;
    bookedHours: number;
    allowedHours: number;
    months: string[];
    plannedSkill: string | null;
    plannedBand: string | null;
    status: FindingStatus;
    detail: string | null;
}

interface Reconciliation {
    projectId: string;
    period: number | null;
    findings: Finding[];
    unfilledPlanLines: { rowId: string; skill: string | null; experienceBand: string | null; projectRole: string | null; quantity: number }[];
    totals: {
        allocatedInQPeople: number;
        matched: number;
        skillMismatch: number;
        unplanned: number;
        notAllocated: number;
        unfilledPlanLines: number;
    };
}

const FINDING_STYLE: Record<FindingStatus, { row: string; badge: string; label: string }> = {
    MATCHED: {
        row: "border-l-4 border-emerald-500 bg-emerald-50/40",
        badge: "bg-emerald-100 text-emerald-700 border-emerald-300",
        label: "Matched",
    },
    SKILL_MISMATCH: {
        row: "border-l-4 border-amber-400 bg-amber-50/50",
        badge: "bg-amber-100 text-amber-800 border-amber-300",
        label: "Skill mismatch",
    },
    UNPLANNED: {
        row: "border-l-4 border-red-500 bg-red-50/40",
        badge: "bg-red-100 text-red-700 border-red-300",
        label: "Not in plan",
    },
    NOT_ALLOCATED: {
        row: "border-l-4 border-orange-400 bg-orange-50/40",
        badge: "bg-orange-100 text-orange-800 border-orange-300",
        label: "Not allocated",
    },
};

const ORIGIN_STYLE: Record<string, { row: string; badge: string; label: string }> = {
    MATCHED: {
        row: "border-l-4 border-emerald-500 bg-emerald-50/40",
        badge: "bg-emerald-100 text-emerald-700 border-emerald-300",
        label: "Matched",
    },
    CHANGED: {
        row: "border-l-4 border-amber-400 bg-amber-50/50",
        badge: "bg-amber-100 text-amber-800 border-amber-300",
        label: "Changed",
    },
    NEW: {
        row: "border-l-4 border-red-500 bg-red-50/40",
        badge: "bg-red-100 text-red-700 border-red-300",
        label: "New",
    },
};

export default function ProjectResourceMappingTab({
    opportunityId,
    canEdit,
}: {
    opportunityId: string;
    canEdit: boolean;
}) {
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [projects, setProjects] = useState<QProject[]>([]);
    const [projectTotals, setProjectTotals] = useState<{ inQPeople: number; selectable: number; alreadyMapped: number } | null>(null);
    const [mapping, setMapping] = useState<any>(null);
    const [projectSearch, setProjectSearch] = useState("");
    const [chosenProject, setChosenProject] = useState<string>("");

    const [rows, setRows] = useState<PlanRow[]>([]);
    const [coverage, setCoverage] = useState<Coverage | null>(null);
    // Null until a Q-People project is mapped — there is nothing to reconcile against.
    const [recon, setRecon] = useState<Reconciliation | null>(null);
    const [showMatched, setShowMatched] = useState(false);
    const [skillsets, setSkillsets] = useState<string[]>([]);
    // Same admin-managed lookup the presales Resource Assignment uses, so the
    // delivery plan speaks the same vocabulary as the estimate it came from.
    const [projectRoles, setProjectRoles] = useState<string[]>([]);
    const [dirty, setDirty] = useState(false);

    const base = `${API_URL}/api/opportunities/${opportunityId}/qpeople`;

    const load = useCallback(async (refresh = false) => {
        setLoading(true);
        setError(null);
        try {
            const qs = refresh ? "?refresh=true" : "";
            const [projRes, mapRes, planRes, skillRes, roleRes] = await Promise.all([
                fetch(`${base}/projects${qs}`, { headers: getAuthHeaders() }),
                fetch(`${base}/mapping`, { headers: getAuthHeaders() }),
                fetch(`${base}/resource-plan${qs}`, { headers: getAuthHeaders() }),
                fetch(`${API_URL}/api/opportunities/qpeople/skillsets`, { headers: getAuthHeaders() }),
                fetch(`${API_URL}/api/master/project-roles`, { headers: getAuthHeaders() }),
            ]);

            if (!projRes.ok) {
                const b = await projRes.json().catch(() => ({}));
                throw new Error(b.detail || b.error || `Could not load Q-People projects (${projRes.status})`);
            }
            const projJson = await projRes.json();
            setProjects(projJson.projects || []);
            setProjectTotals(projJson.totals || null);

            const map = mapRes.ok ? await mapRes.json() : null;
            setMapping(map);
            setChosenProject(map?.qpeopleProjectId || "");

            if (planRes.ok) {
                const planJson = await planRes.json();
                setRows(planJson.rows || []);
                setCoverage(planJson.coverage || null);
                setRecon(planJson.reconciliation || null);
            }
            if (skillRes.ok) setSkillsets(await skillRes.json());
            if (roleRes.ok) {
                const roles = await roleRes.json();
                setProjectRoles(
                    (Array.isArray(roles) ? roles : [])
                        .map((r: any) => (typeof r === "string" ? r : r?.name))
                        .filter(Boolean),
                );
            }
            setDirty(false);
        } catch (e: any) {
            setError(e?.message || "Failed to load");
        } finally {
            setLoading(false);
        }
    }, [base]);

    useEffect(() => { load(); }, [load]);

    const visibleProjects = useMemo(() => {
        const q = projectSearch.trim().toLowerCase();
        if (!q) return projects;
        return projects.filter((p) =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            (p.customer || "").toLowerCase().includes(q));
    }, [projects, projectSearch]);

    async function saveMapping() {
        if (!chosenProject) return;
        setSaving(true);
        try {
            const res = await fetch(`${base}/mapping`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({ qpeopleProjectId: chosenProject }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `Save failed (${res.status})`);
            setMapping(body);
            toast({ title: "Mapped", description: `Linked to ${body.qpeopleProjectCode} — ${body.qpeopleProjectName}` });
            load();
        } catch (e: any) {
            toast({ title: "Could not map project", description: e?.message });
        } finally {
            setSaving(false);
        }
    }

    async function removeMapping() {
        setSaving(true);
        try {
            const res = await fetch(`${base}/mapping`, { method: "DELETE", headers: getAuthHeaders() });
            if (!res.ok) {
                const b = await res.json().catch(() => ({}));
                throw new Error(b.error || `Failed (${res.status})`);
            }
            setMapping(null);
            setChosenProject("");
            toast({ title: "Mapping removed" });
            load();
        } catch (e: any) {
            toast({ title: "Could not remove mapping", description: e?.message });
        } finally {
            setSaving(false);
        }
    }

    async function savePlan() {
        setSaving(true);
        try {
            const res = await fetch(`${base}/resource-plan`, {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    rows: rows.map((r) => ({
                        sourceRowId: r.sourceRowId,
                        skill: r.skill,
                        experienceBand: r.experienceBand,
                        projectRole: r.projectRole,
                        quantity: r.quantity,
                        originalSkill: r.originalSkill,
                        originalExperienceBand: r.originalExperienceBand,
                        originalProjectRole: r.originalProjectRole,
                        employeeId: r.employeeId,
                        employeeName: r.employeeName,
                    })),
                }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `Save failed (${res.status})`);
            toast({ title: "Resource plan saved" });
            load();
        } catch (e: any) {
            toast({ title: "Could not save plan", description: e?.message });
        } finally {
            setSaving(false);
        }
    }

    function patchRow(id: string, patch: Partial<PlanRow>) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
        setDirty(true);
    }

    function addRow() {
        setRows((prev) => [...prev, {
            id: `new-${Date.now()}-${prev.length}`,
            sourceRowId: null,
            origin: "NEW",
            skill: "",
            experienceBand: "",
            projectRole: "",
            quantity: 1,
            originalSkill: null,
            originalExperienceBand: null,
            originalProjectRole: null,
            employeeId: null,
            employeeName: null,
            candidates: [],
        }]);
        setDirty(true);
    }

    function removeRow(id: string) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        setDirty(true);
    }

    /** Mirrors the server rule so the colour updates as you type. */
    function liveOrigin(r: PlanRow): "MATCHED" | "CHANGED" | "NEW" {
        if (!r.sourceRowId) return "NEW";
        const changed =
            (r.skill || null) !== (r.originalSkill || null) ||
            (r.experienceBand || null) !== (r.originalExperienceBand || null) ||
            (r.projectRole || null) !== (r.originalProjectRole || null);
        return changed ? "CHANGED" : "MATCHED";
    }

    const counts = useMemo(() => {
        const c = { MATCHED: 0, CHANGED: 0, NEW: 0 };
        rows.forEach((r) => { c[liveOrigin(r)] += 1; });
        return c;
    }, [rows]);

    if (loading) {
        return (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                Loading Q-People data…
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold">Q-People unavailable</p>
                        <p className="text-xs mt-0.5">{error}</p>
                        <button onClick={() => load(true)} className="mt-2 text-xs font-semibold underline">Retry</button>
                    </div>
                </div>
            )}

            {/* ── STEP 1 — project mapping ─────────────────────────────────── */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-base font-bold text-slate-900">Q-People Project</h3>
                    </div>
                    <button
                        onClick={() => load(true)}
                        className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                        title="Re-fetch from Q-People"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                    The project people book their timesheets against. Projects already mapped to
                    another opportunity are not listed.
                </p>

                {mapping ? (
                    <div className="flex items-center justify-between gap-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                <span className="font-semibold text-sm text-emerald-900 truncate">
                                    {mapping.qpeopleProjectCode} — {mapping.qpeopleProjectName}
                                </span>
                            </div>
                            <p className="text-xs text-emerald-700 mt-1 ml-6">
                                {mapping.qpeopleProjectId}
                                {mapping.qpeopleCustomer ? ` · ${mapping.qpeopleCustomer}` : ""}
                                {mapping.mappedByName ? ` · mapped by ${mapping.mappedByName}` : ""}
                            </p>
                        </div>
                        {canEdit && (
                            <button
                                onClick={removeMapping}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50 flex-shrink-0"
                            >
                                <Unlink className="w-3.5 h-3.5" /> Unmap
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={projectSearch}
                                onChange={(e) => setProjectSearch(e.target.value)}
                                placeholder="Search by code, project name or customer…"
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                disabled={!canEdit}
                            />
                        </div>
                        {/* The placeholder option is load-bearing. Without an option
                            whose value is "", a controlled select holding "" matches
                            nothing, so the browser silently selects the FIRST option
                            instead. The row then looks picked while React state is
                            still empty — leaving Map project disabled — and clicking
                            that already-highlighted row fires no change event, so it
                            can never recover. */}
                        <select
                            value={chosenProject}
                            onChange={(e) => setChosenProject(e.target.value)}
                            disabled={!canEdit}
                            size={Math.min(8, Math.max(3, visibleProjects.length + 1))}
                            className="w-full text-sm border border-slate-300 rounded-md p-1 focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="">
                                {visibleProjects.length === 0
                                    ? "No matching projects"
                                    : `— select a project (${visibleProjects.length}) —`}
                            </option>
                            {visibleProjects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.code} — {p.name}{p.customer ? ` · ${p.customer}` : ""}
                                </option>
                            ))}
                        </select>
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-slate-500">
                                {projectTotals && (
                                    <>
                                        {projectTotals.selectable} selectable of {projectTotals.inQPeople} in Q-People
                                        {projectTotals.alreadyMapped > 0 && ` · ${projectTotals.alreadyMapped} already mapped elsewhere`}
                                    </>
                                )}
                            </p>
                            {canEdit && (
                                <button
                                    onClick={saveMapping}
                                    disabled={!chosenProject || saving}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {saving ? "Mapping…" : "Map project"}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Coverage warning ─────────────────────────────────────────── */}
            {coverage && !coverage.ready && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4 text-amber-900">
                    <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                    <div className="text-xs leading-relaxed">
                        <p className="text-sm font-semibold mb-1">No employees can be matched yet</p>
                        Matching joins the resource line&apos;s skill to the employee&apos;s{" "}
                        <span className="font-mono">Skillset GOM</span> in Q-People. That field is
                        currently set for <strong>{coverage.taggedWithSkillset} of {coverage.activeEmployees}</strong>{" "}
                        active employees, so candidate lists will stay empty until HR populates it.
                        Overall experience is recorded for {coverage.withExperience} of {coverage.activeEmployees}.
                    </div>
                </div>
            )}

            {/* ── STEP 2 — resource plan ───────────────────────────────────── */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-base font-bold text-slate-900">Resource Mapping</h3>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                        <span className="px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-300">
                            {counts.MATCHED} matched
                        </span>
                        <span className="px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-300">
                            {counts.CHANGED} changed
                        </span>
                        <span className="px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-300">
                            {counts.NEW} new
                        </span>
                    </div>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                    Seeded from the presales Resource Assignment. Edit a line to mark it changed, or
                    add a resource type that was never estimated.
                </p>

                {rows.length === 0 ? (
                    <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center text-sm text-slate-500">
                        No resources on this opportunity&apos;s Resource Assignment.
                        {canEdit && " Add the first one below."}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[900px]">
                            <thead>
                                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                                    <th className="p-2 font-semibold">Status</th>
                                    <th className="p-2 font-semibold">Skill (Skillset GOM)</th>
                                    <th className="p-2 font-semibold">Experience</th>
                                    <th className="p-2 font-semibold">Project Role</th>
                                    <th className="p-2 font-semibold w-16">Qty</th>
                                    <th className="p-2 font-semibold">Q-People candidate</th>
                                    {canEdit && <th className="p-2 w-10" />}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => {
                                    const origin = liveOrigin(r);
                                    const style = ORIGIN_STYLE[origin];
                                    const cands = r.candidates || [];
                                    return (
                                        <tr key={r.id} className={`${style.row} border-b border-slate-100 align-top`}>
                                            <td className="p-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${style.badge}`}>
                                                    {style.label}
                                                </span>
                                                {origin === "CHANGED" && r.originalSkill && r.originalSkill !== r.skill && (
                                                    <p className="text-[10px] text-amber-700 mt-1">was: {r.originalSkill}</p>
                                                )}
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    list="qp-skillsets"
                                                    value={r.skill || ""}
                                                    onChange={(e) => patchRow(r.id, { skill: e.target.value })}
                                                    disabled={!canEdit}
                                                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white disabled:bg-slate-50"
                                                    placeholder="Skill"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <select
                                                    value={r.experienceBand || ""}
                                                    onChange={(e) => patchRow(r.id, { experienceBand: e.target.value })}
                                                    disabled={!canEdit}
                                                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white disabled:bg-slate-50"
                                                >
                                                    <option value="">—</option>
                                                    {EXPERIENCE_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                                                    {r.experienceBand && !EXPERIENCE_BANDS.includes(r.experienceBand) && (
                                                        <option value={r.experienceBand}>{r.experienceBand}</option>
                                                    )}
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                {/* Admin-managed lookup, not free text — same list the presales
                                                    Resource Assignment uses. A role seeded from the estimate that
                                                    is no longer in the lookup is kept as an extra option so
                                                    editing another column cannot silently blank it. */}
                                                <select
                                                    value={r.projectRole || ""}
                                                    onChange={(e) => patchRow(r.id, { projectRole: e.target.value })}
                                                    disabled={!canEdit}
                                                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white disabled:bg-slate-50"
                                                >
                                                    <option value="">— select role —</option>
                                                    {projectRoles.map((role) => (
                                                        <option key={role} value={role}>{role}</option>
                                                    ))}
                                                    {r.projectRole && !projectRoles.includes(r.projectRole) && (
                                                        <option value={r.projectRole}>
                                                            {r.projectRole} (not in lookup)
                                                        </option>
                                                    )}
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={r.quantity}
                                                    onChange={(e) => patchRow(r.id, { quantity: Number(e.target.value) || 1 })}
                                                    disabled={!canEdit}
                                                    className="w-14 px-2 py-1 text-xs border border-slate-300 rounded bg-white disabled:bg-slate-50"
                                                />
                                            </td>
                                            <td className="p-2">
                                                {cands.length === 0 ? (
                                                    /* Naming the failing side matters. The old wording —
                                                       "no match for this skill / band" — sent people
                                                       hunting through experience bands, but the band
                                                       NEVER excludes anyone: it only flags and sorts,
                                                       which is why other rows read "band mismatch" and
                                                       still offer a person. An empty list is always a
                                                       skill-level miss. */
                                                    <span
                                                        className="text-[11px] text-amber-700 italic"
                                                        title={coverage && !coverage.ready
                                                            ? "Nobody in Q-People has a Skillset GOM tag yet, so no row can be matched."
                                                            : `No active Q-People employee is tagged with "${r.skill || "this skill"}". The experience band is not the problem — a band mismatch would still list the person, flagged. If Q-People uses a different name for this same skill, add the pair under Settings → Rate Cards → Skill Aliases.`}
                                                    >
                                                        {coverage && !coverage.ready
                                                            ? "no tagged employees in Q-People"
                                                            : "no one in Q-People is tagged with this skill"}
                                                    </span>
                                                ) : (
                                                    <select
                                                        value={r.employeeId || ""}
                                                        onChange={(e) => {
                                                            const c = cands.find((x) => x.employeeId === e.target.value);
                                                            patchRow(r.id, {
                                                                employeeId: c?.employeeId || null,
                                                                employeeName: c?.employeeName || null,
                                                            });
                                                        }}
                                                        disabled={!canEdit}
                                                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white disabled:bg-slate-50"
                                                    >
                                                        <option value="">— select ({cands.length} available)</option>
                                                        {cands.map((c) => (
                                                            <option key={c.employeeId} value={c.employeeId}>
                                                                {c.employeeName}
                                                                {/* Show the band the person falls in, not just raw years —
                                                                    4.17y on its own does not read as "4 - 6 Years". */}
                                                                {c.experienceBandLabel
                                                                    ? ` · ${c.experienceBandLabel}${c.experienceKnown && c.experienceYears !== null ? ` (${c.experienceYears}y)` : ""}`
                                                                    : " · exp n/a"}
                                                                {c.projectCount > 0
                                                                    ? ` · on ${c.projectCount} project${c.projectCount === 1 ? "" : "s"}`
                                                                    : " · unallocated"}
                                                                {c.experienceMatches ? "" : " · band mismatch"}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                                {/* Current commitment for the person picked — the split
                                                    across projects, which is what Q-People actually knows. */}
                                                {(() => {
                                                    const picked = cands.find((c) => c.employeeId === r.employeeId);
                                                    if (!picked) return null;
                                                    if (!picked.commitmentProjects.length) {
                                                        return (
                                                            <p className="text-[10px] text-slate-500 mt-1">
                                                                No allocation recorded in Q-People
                                                            </p>
                                                        );
                                                    }
                                                    return (
                                                        <div className="text-[10px] text-slate-600 mt-1 leading-snug">
                                                            <span className="text-slate-400">
                                                                Committed ({picked.commitmentMonth}):
                                                            </span>{" "}
                                                            {picked.commitmentProjects.slice(0, 3).map((p, i) => (
                                                                <span key={`${p.projectId}-${i}`}>
                                                                    {i > 0 && ", "}
                                                                    {p.percent}% {p.projectName || p.projectId}
                                                                </span>
                                                            ))}
                                                            {picked.commitmentProjects.length > 3 &&
                                                                ` +${picked.commitmentProjects.length - 3} more`}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            {canEdit && (
                                                <td className="p-2">
                                                    <button
                                                        onClick={() => removeRow(r.id)}
                                                        className="text-slate-400 hover:text-red-600"
                                                        title="Remove line"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <datalist id="qp-skillsets">
                            {skillsets.map((s) => <option key={s} value={s} />)}
                        </datalist>
                    </div>
                )}

                {canEdit && (
                    <div className="flex items-center justify-between mt-4">
                        <button
                            onClick={addRow}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50"
                        >
                            <Plus className="w-3.5 h-3.5" /> Add resource type
                        </button>
                        <button
                            onClick={savePlan}
                            disabled={saving || !dirty}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {saving ? "Saving…" : dirty ? "Save resource plan" : "Saved"}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Reconciliation against Q-People's actual allocation ─────── */}
            {recon && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                    <div className="flex items-start justify-between mb-1 gap-4">
                        <div className="flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-base font-bold text-slate-900">Allocated in Q-People</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] justify-end">
                            <span className="px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-300">
                                {recon.totals.matched} matched
                            </span>
                            <span className="px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-300">
                                {recon.totals.skillMismatch} skill mismatch
                            </span>
                            <span className="px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-300">
                                {recon.totals.unplanned} not in plan
                            </span>
                            <span className="px-2 py-0.5 rounded-full border bg-orange-100 text-orange-800 border-orange-300">
                                {recon.totals.notAllocated} not allocated
                            </span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                        Who Q-People actually has booked on this project{recon.period ? ` (${recon.period})` : ""},
                        checked against the plan above. {recon.totals.allocatedInQPeople} allocated in Q-People.
                    </p>

                    {recon.findings.length === 0 ? (
                        <div className="border border-dashed border-slate-300 rounded-lg p-6 text-center text-sm text-slate-500">
                            Q-People has nobody allocated to this project yet.
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[860px]">
                                    <thead>
                                        <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                                            <th className="p-2 font-semibold">Status</th>
                                            <th className="p-2 font-semibold">Person</th>
                                            <th className="p-2 font-semibold">Q-People skill</th>
                                            <th className="p-2 font-semibold">Planned as</th>
                                            <th className="p-2 font-semibold text-right">Alloc %</th>
                                            <th className="p-2 font-semibold text-right">Booked / allowed hrs</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recon.findings
                                            .filter((f) => showMatched || f.status !== "MATCHED")
                                            .map((f) => {
                                                const st = FINDING_STYLE[f.status];
                                                return (
                                                    <tr key={`${f.employeeId}-${f.status}`} className={`${st.row} border-b border-slate-100 align-top`}>
                                                        <td className="p-2">
                                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${st.badge}`}>
                                                                {st.label}
                                                            </span>
                                                        </td>
                                                        <td className="p-2">
                                                            <div className="text-slate-800">{f.employeeName}</div>
                                                            {f.designation && <div className="text-[10px] text-slate-500">{f.designation}</div>}
                                                            {f.detail && <div className="text-[10px] text-slate-600 mt-0.5 max-w-md">{f.detail}</div>}
                                                        </td>
                                                        <td className="p-2 text-xs text-slate-700">{f.qpeopleSkill || <span className="text-slate-400 italic">not set</span>}</td>
                                                        <td className="p-2 text-xs text-slate-700">
                                                            {f.plannedSkill || <span className="text-slate-400 italic">—</span>}
                                                            {f.plannedBand && <span className="text-slate-400"> · {f.plannedBand}</span>}
                                                        </td>
                                                        <td className="p-2 text-xs text-right text-slate-700">{f.allocationPercent || 0}%</td>
                                                        <td className="p-2 text-xs text-right text-slate-700">
                                                            {Math.round(f.bookedHours)} / {Math.round(f.allowedHours)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>

                            {recon.totals.matched > 0 && (
                                <button
                                    onClick={() => setShowMatched((v) => !v)}
                                    className="mt-3 text-xs font-semibold text-indigo-600 hover:underline"
                                >
                                    {showMatched ? "Hide" : "Show"} {recon.totals.matched} matched
                                </button>
                            )}
                        </>
                    )}

                    {recon.unfilledPlanLines.length > 0 && (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                            <p className="text-xs font-semibold text-slate-700 mb-1.5">
                                {recon.unfilledPlanLines.length} plan line{recon.unfilledPlanLines.length === 1 ? "" : "s"} with nobody named
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {recon.unfilledPlanLines.map((u) => (
                                    <span key={u.rowId} className="px-2 py-0.5 rounded border border-slate-300 bg-white text-[11px] text-slate-600">
                                        {u.skill || "—"}{u.experienceBand ? ` · ${u.experienceBand}` : ""}{u.quantity > 1 ? ` ×${u.quantity}` : ""}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
