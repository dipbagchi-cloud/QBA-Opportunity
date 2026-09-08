"use client";

import React, { useEffect, useState } from "react";
import { API_URL, getAuthHeaders } from "@/lib/api";
import { Check, AlertCircle, GitBranch } from "lucide-react";

// CR-03 full stage machine — admin stage configuration.
// The stage STRUCTURE (order, closed/won, legal moves) is fixed in code; here an
// admin edits the WORDS (label), the probability and the colour.

type Stage = {
  name: string; label: string; order: number; probability: number; color: string;
  isClosed: boolean; isWon: boolean; moves: { to: string; kind: string }[];
};
type Status = { type: "success" | "error"; message: string } | null;

const kindLabel: Record<string, string> = { forward: "advance", back: "send back (re-estimate)", win: "close won", lose: "close lost" };

export default function StagesTab() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const load = async () => {
    try {
      const r = await fetch(`${API_URL}/api/stages`, { headers: getAuthHeaders() });
      if (r.ok) setStages(await r.json());
    } catch { setStatus({ type: "error", message: "Failed to load stages." }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const edit = (name: string, patch: Partial<Stage>) =>
    setStages((s) => s.map((x) => (x.name === name ? { ...x, ...patch } : x)));

  const save = async (st: Stage) => {
    setSavingName(st.name); setStatus(null);
    try {
      const r = await fetch(`${API_URL}/api/admin/stages/${encodeURIComponent(st.name)}`, {
        method: "PATCH", headers: getAuthHeaders(),
        body: JSON.stringify({ label: st.label, probability: st.probability, color: st.color }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to save");
      setStatus({ type: "success", message: `Saved "${st.label}".` });
    } catch (e: any) { setStatus({ type: "error", message: e.message }); }
    finally { setSavingName(null); }
  };

  if (loading) return <div className="p-6 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-indigo-600" />
        <div>
          <h2 className="text-base font-bold text-slate-800">Stages</h2>
          <p className="text-xs text-slate-500 mt-0.5">Rename the words shown for each stage and set its probability &amp; colour. The stages themselves and their legal transitions are fixed by the workflow.</p>
        </div>
      </div>

      {status && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {status.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{status.message}
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left w-8">#</th>
              <th className="px-3 py-2 text-left">Identity</th>
              <th className="px-3 py-2 text-left">Display label</th>
              <th className="px-3 py-2 text-left w-24">Probability %</th>
              <th className="px-3 py-2 text-left w-20">Colour</th>
              <th className="px-3 py-2 text-left">Legal moves from here</th>
              <th className="px-3 py-2 text-right w-20"></th>
            </tr>
          </thead>
          <tbody>
            {stages.map((st) => (
              <tr key={st.name} className="border-b border-slate-100">
                <td className="px-3 py-2 text-slate-400">{st.order}</td>
                <td className="px-3 py-2">
                  <span className="text-xs font-mono text-slate-500">{st.name}</span>
                  {st.isClosed && <span className="ml-1 text-[10px] text-slate-400">({st.isWon ? "won" : "closed"})</span>}
                </td>
                <td className="px-3 py-2">
                  <input value={st.label} onChange={(e) => edit(st.name, { label: e.target.value })}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </td>
                <td className="px-3 py-2">
                  <input type="number" min={0} max={100} value={st.probability}
                    onChange={(e) => edit(st.name, { probability: Number(e.target.value) })}
                    className="w-20 px-2 py-1 border border-slate-200 rounded text-sm" />
                </td>
                <td className="px-3 py-2">
                  <input type="color" value={st.color} onChange={(e) => edit(st.name, { color: e.target.value })}
                    className="h-7 w-10 border border-slate-200 rounded cursor-pointer" />
                </td>
                <td className="px-3 py-2 text-[11px] text-slate-500">
                  {st.moves.length === 0 ? <span className="italic text-slate-400">terminal</span>
                    : st.moves.map((m) => `${m.to} (${kindLabel[m.kind] || m.kind})`).join(", ")}
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => save(st)} disabled={savingName === st.name}
                    className="px-3 py-1 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
                    {savingName === st.name ? "..." : "Save"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">Note: the internal identity (left column) never changes, so renaming the label is safe — existing records and reports keep working.</p>
    </div>
  );
}
