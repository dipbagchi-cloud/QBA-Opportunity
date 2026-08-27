"use client";

/**
 * Settings → Rate Cards → Skill Aliases.
 *
 * The cost card and Q-People are supposed to share one Skillset GOM taxonomy
 * and do not. Where the difference is only a name, candidate matching finds
 * nobody and the person actually doing the work simultaneously shows as "not in
 * plan". This is where a human reconciles the two vocabularies.
 *
 * Suggestions are ranked and shown WITH their evidence, but nothing is ever
 * written automatically: on real data a similarity pass was wrong about half
 * the time ("Power Builder" against "Power Automate", "Project System" — the
 * SAP PS module — against "Project Manager"), and a wrong alias silently prices
 * someone at another skill's rate. Review is the feature, not friction.
 */

import React, { useState, useEffect, useCallback } from "react";
import { API_URL, getAuthHeaders } from "@/lib/api";
import {
    Link2, Plus, Trash2, RefreshCw, AlertTriangle, Check, X, Lightbulb, Users,
} from "lucide-react";

interface Alias {
    id: string;
    aliasKey: string; canonicalKey: string;
    aliasLabel: string; canonicalLabel: string;
    note: string | null;
    isActive: boolean;
    createdByName: string | null;
    createdAt: string;
}

interface Suggestion {
    aliasKey: string; aliasLabel: string;
    canonicalKey: string; canonicalLabel: string;
    peopleTagged: number; score: number;
}

interface Coverage {
    activeEmployees: number; untaggedEmployees: number;
    qpeopleSkills: number; rateCardSkills: number; rateCardSkillsWithNobody: number;
}

export default function SkillAliasesPanel() {
    const [rows, setRows] = useState<Alias[]>([]);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [coverage, setCoverage] = useState<Coverage | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({ aliasLabel: "", canonicalLabel: "", note: "" });

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [a, s] = await Promise.all([
                fetch(`${API_URL}/api/admin/skill-aliases`, { headers: getAuthHeaders() }).then((r) => r.json()),
                fetch(`${API_URL}/api/admin/skill-aliases/suggestions`, { headers: getAuthHeaders() }).then((r) => r.json()),
            ]);
            setRows(a.rows || []);
            setSuggestions(s.suggestions || []);
            setCoverage(s.coverage || null);
        } catch (e: any) {
            setError(e?.message || "Failed to load");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function create(aliasLabel: string, canonicalLabel: string, note?: string) {
        setBusy(aliasLabel + canonicalLabel);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/admin/skill-aliases`, {
                method: "POST",
                headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({ aliasLabel, canonicalLabel, note }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
            setAdding(false);
            setForm({ aliasLabel: "", canonicalLabel: "", note: "" });
            await load();
        } catch (e: any) {
            setError(e?.message || "Could not save");
        } finally {
            setBusy(null);
        }
    }

    async function toggle(row: Alias) {
        setBusy(row.id);
        try {
            await fetch(`${API_URL}/api/admin/skill-aliases/${row.id}`, {
                method: "PATCH",
                headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !row.isActive }),
            });
            await load();
        } finally { setBusy(null); }
    }

    async function remove(row: Alias) {
        setBusy(row.id);
        try {
            await fetch(`${API_URL}/api/admin/skill-aliases/${row.id}`, {
                method: "DELETE", headers: getAuthHeaders(),
            });
            await load();
        } finally { setBusy(null); }
    }

    if (loading) {
        return (
            <div className="text-center py-12 text-slate-400 text-sm">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                Loading skill aliases…
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-indigo-600" /> Skill Aliases
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
                        Two names for one skill. The cost card and Q-People are meant to share one Skillset GOM
                        taxonomy but don&apos;t — where they differ only in wording, a plan row finds nobody and the
                        person doing the work shows as &ldquo;not in plan&rdquo;. Pairing them here fixes both.
                    </p>
                </div>
                <button
                    onClick={() => setAdding((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 whitespace-nowrap"
                >
                    <Plus className="w-3.5 h-3.5" /> Add alias
                </button>
            </div>

            {/* Coverage — the alias table cannot fix an untagged workforce, and
                pretending otherwise would send people down the wrong path. */}
            {coverage && (
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        <Users className="w-3 h-3 inline mr-1" />
                        {coverage.activeEmployees} active people · {coverage.qpeopleSkills} skills in use
                    </span>
                    <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {coverage.rateCardSkills} skills on the cost card ·{" "}
                        <strong>{coverage.rateCardSkillsWithNobody}</strong> with nobody tagged
                    </span>
                    {coverage.untaggedEmployees > 0 && (
                        <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-300">
                            <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-600" />
                            <strong>{coverage.untaggedEmployees}</strong> active people have no skill tag at all —
                            aliases cannot help those; they need tagging in Q-People
                        </span>
                    )}
                </div>
            )}

            {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg p-3 text-xs text-red-800">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                    {error}
                </div>
            )}

            {adding && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-slate-800">New alias</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-600 mb-1 block">Cost-card skill</label>
                            <input
                                value={form.aliasLabel}
                                onChange={(e) => setForm({ ...form, aliasLabel: e.target.value })}
                                placeholder="UI/ UX/ WP"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-600 mb-1 block">Q-People skill (the same thing)</label>
                            <input
                                value={form.canonicalLabel}
                                onChange={(e) => setForm({ ...form, canonicalLabel: e.target.value })}
                                placeholder="UI/UX development"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-600 mb-1 block">Why (optional, but future-you will want it)</label>
                        <input
                            value={form.note}
                            onChange={(e) => setForm({ ...form, note: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => create(form.aliasLabel, form.canonicalLabel, form.note)}
                            disabled={!form.aliasLabel || !form.canonicalLabel || !!busy}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium disabled:opacity-50"
                        >Save alias</button>
                        <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs">Cancel</button>
                    </div>
                </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        Suggested pairs ({suggestions.length})
                    </h4>
                    <p className="text-[11px] text-slate-500 mb-3 max-w-3xl">
                        Cost-card skills nobody is tagged with, next to the closest thing people <em>are</em> tagged
                        with. <strong>These are guesses and roughly half are wrong</strong> — the same scan proposed
                        &ldquo;Power Builder&rdquo; for &ldquo;Power Automate&rdquo;, and &ldquo;Project System&rdquo;
                        (the SAP module) for &ldquo;Project Manager&rdquo;. Accept only what you know to be the same
                        discipline; a wrong alias prices people at another skill&apos;s rate.
                    </p>
                    <div className="space-y-1.5">
                        {suggestions.map((s) => (
                            <div key={s.aliasKey} className="flex items-center gap-3 text-xs p-2 rounded-md border border-slate-200 hover:bg-slate-50">
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${s.score >= 0.7
                                    ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                    : "bg-amber-100 text-amber-800 border-amber-300"}`}>
                                    {Math.round(s.score * 100)}%
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="font-medium text-slate-800">{s.aliasLabel}</span>
                                    <span className="text-slate-400 mx-1.5">→</span>
                                    <span className="text-slate-700">{s.canonicalLabel}</span>
                                    <span className="text-slate-400 ml-1.5">({s.peopleTagged} {s.peopleTagged === 1 ? "person" : "people"})</span>
                                </span>
                                <button
                                    onClick={() => create(s.aliasLabel, s.canonicalLabel, `Accepted from suggestion (${Math.round(s.score * 100)}% similar)`)}
                                    disabled={!!busy}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                                >
                                    <Check className="w-3 h-3" /> Accept
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Existing aliases */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                            <th className="p-3 text-left font-semibold">Cost-card skill</th>
                            <th className="p-3 text-left font-semibold">Q-People skill</th>
                            <th className="p-3 text-left font-semibold">Why / who</th>
                            <th className="p-3 text-left font-semibold">Active</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id} className={`border-b border-slate-100 ${r.isActive ? "" : "opacity-50"}`}>
                                <td className="p-3 font-medium text-slate-800">{r.aliasLabel}</td>
                                <td className="p-3 text-slate-700">{r.canonicalLabel}</td>
                                <td className="p-3 text-slate-500">
                                    {r.note || <span className="italic text-slate-300">—</span>}
                                    {r.createdByName && <div className="text-[10px] text-slate-400 mt-0.5">by {r.createdByName}</div>}
                                </td>
                                <td className="p-3">
                                    <button
                                        onClick={() => toggle(r)}
                                        disabled={busy === r.id}
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${r.isActive
                                            ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                            : "bg-slate-100 text-slate-500 border-slate-300"}`}
                                    >
                                        {r.isActive ? "Active" : "Off"}
                                    </button>
                                </td>
                                <td className="p-3 text-right">
                                    <button
                                        onClick={() => remove(r)}
                                        disabled={busy === r.id}
                                        className="text-slate-400 hover:text-red-600"
                                        title="Delete alias"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">
                                No aliases yet. Accept a suggestion above, or add one manually.
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
                Aliases apply in both directions and everywhere skills are compared — candidate matching on the
                Actual GOM resource plan, and the rate lookup that prices booked hours. Turning one off reverts
                to exact-name matching for that pair. Changes take effect within five minutes, or immediately on
                the next Refresh.
            </p>
        </div>
    );
}
