"use client";

import React, { useCallback, useEffect, useState } from "react";
import { API_URL, getAuthHeaders } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// CR-10: dedicated RFP tracking view.
const RFP_STATUSES = ["Identified", "In Progress", "Ready to Submit", "Submitted", "Won", "Lost", "No-Bid"];

const deadlineBadge = (s: string) =>
  s === "Overdue" ? "bg-red-100 text-red-700 border-red-200"
  : s === "Due Soon" ? "bg-amber-100 text-amber-800 border-amber-300"
  : s === "On Track" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
  : s === "Closed" ? "bg-slate-200 text-slate-600 border-slate-300"
  : "bg-slate-100 text-slate-400 border-slate-200";

const EMPTY = { reference: "", customer: "", owner: "", status: "Identified", receivedDate: "", submissionDueDate: "", internalTargetDate: "", clarificationDate: "", notes: "" };

export default function RfpPage() {
  const { toast } = useToast();
  const [rfps, setRfps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rfps${activeOnly ? "?active=true" : ""}`, { headers: getAuthHeaders() });
      if (res.ok) setRfps(await res.json());
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [activeOnly]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.reference.trim() || !form.customer.trim()) { toast({ title: "Missing", description: "Reference and customer are required." }); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/rfps`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(form) });
      if (res.ok) { setForm({ ...EMPTY }); setShowForm(false); await load(); toast({ title: "RFP created" }); }
      else { const e = await res.json().catch(() => ({})); toast({ title: "Error", description: e.error || "Failed to create RFP." }); }
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      await fetch(`${API_URL}/api/rfps/${id}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify({ status }) });
      await load();
    } catch (e) { console.error(e); }
  };

  const overdue = rfps.filter(r => r.deadlineStatus === "Overdue").length;
  const dueSoon = rfps.filter(r => r.deadlineStatus === "Due Soon").length;
  const stale = rfps.filter(r => r.stale).length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">RFP Tracking</h1>
          <p className="text-sm text-slate-500">Submission deadlines, ownership and readiness for active bids.</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md text-sm hover:bg-indigo-700">{showForm ? "Close" : "New RFP"}</button>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm"><span className="font-bold text-red-700">{overdue}</span> <span className="text-red-600">overdue</span></div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm"><span className="font-bold text-amber-700">{dueSoon}</span> <span className="text-amber-700">due within 7 days</span></div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm"><span className="font-bold text-slate-700">{stale}</span> <span className="text-slate-500">needing an update</span></div>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} /> Active only
        </label>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {([["reference", "Reference *"], ["customer", "Customer *"], ["owner", "Owner"]] as const).map(([k, label]) => (
            <div key={k}><label className="block text-[10px] uppercase font-semibold text-slate-500 mb-1">{label}</label>
              <input value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" /></div>
          ))}
          <div><label className="block text-[10px] uppercase font-semibold text-slate-500 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
              {RFP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select></div>
          {([["receivedDate", "Received"], ["submissionDueDate", "Submission Due"], ["internalTargetDate", "Internal Target"], ["clarificationDate", "Pre-bid / Clarification"]] as const).map(([k, label]) => (
            <div key={k}><label className="block text-[10px] uppercase font-semibold text-slate-500 mb-1">{label}</label>
              <input type="date" value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" /></div>
          ))}
          <div className="col-span-2 md:col-span-3 flex justify-end">
            <button onClick={create} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50">{saving ? "Saving…" : "Create RFP"}</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
            <tr><th className="px-4 py-2">Reference</th><th className="px-4 py-2">Customer</th><th className="px-4 py-2">Owner</th><th className="px-4 py-2">Due</th><th className="px-4 py-2">Deadline</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Opps</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
            ) : rfps.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">No RFPs</td></tr>
            ) : rfps.map(r => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">{r.reference}{r.stale && <span className="ml-2 text-[10px] text-amber-600 font-semibold">NEEDS UPDATE</span>}</td>
                <td className="px-4 py-2 text-slate-600">{r.customer}</td>
                <td className="px-4 py-2 text-slate-600">{r.owner || "—"}</td>
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{r.submissionDueDate || "—"}{r.daysToDue != null && r.deadlineStatus !== "Closed" && <span className="text-slate-400"> ({r.daysToDue}d)</span>}</td>
                <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${deadlineBadge(r.deadlineStatus)}`}>{r.deadlineStatus}</span></td>
                <td className="px-4 py-2">
                  <select value={r.status} onChange={e => setStatus(r.id, e.target.value)} className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white">
                    {RFP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2 text-slate-600">{r.opportunities?.length || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
