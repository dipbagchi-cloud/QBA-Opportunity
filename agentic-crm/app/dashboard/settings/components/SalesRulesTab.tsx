"use client";

import React, { useEffect, useState } from "react";
import { API_URL, getAuthHeaders } from "@/lib/api";
import { Check, AlertCircle, Flame, ClipboardCheck, Percent } from "lucide-react";

// CR-01/02/04 admin configuration — the three data-driven "open item" rules that
// previously had only backend APIs. This screen makes them tunable by Sales
// Leadership without a deploy.

type Status = { type: "success" | "error"; message: string } | null;

function NumberField({ label, value, onChange, desc, min, max, step = 1 }: {
  label: string; value: number; onChange: (n: number) => void; desc?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <div className="grid gap-1">
      <label className="text-xs font-medium text-slate-700">{label}</label>
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {desc && <p className="text-[11px] text-slate-500">{desc}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange, desc }: { label: string; checked: boolean; onChange: (b: boolean) => void; desc?: string }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <span>
        <span className="text-xs font-medium text-slate-700">{label}</span>
        {desc && <p className="text-[11px] text-slate-500">{desc}</p>}
      </span>
    </label>
  );
}

function Card({ icon, title, subtitle, saving, onSave, status, children }: {
  icon: React.ReactNode; title: string; subtitle: string; saving: boolean; onSave: () => void; status: Status; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-indigo-600">{icon}</span>
          <div>
            <h3 className="font-semibold text-sm text-slate-800">{title}</h3>
            <p className="text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>
        <button onClick={onSave} disabled={saving} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      {status && (
        <div className={`flex items-center gap-2 p-2 rounded-md text-xs ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {status.type === "success" ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {status.message}
        </div>
      )}
      {children}
    </div>
  );
}

async function getJson(path: string) {
  const r = await fetch(`${API_URL}${path}`, { headers: getAuthHeaders() });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to load");
  return r.json();
}
async function putJson(path: string, body: any) {
  const r = await fetch(`${API_URL}${path}`, { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to save");
  return r.json();
}

export default function SalesRulesTab() {
  // ── Hot classification ──
  const [hot, setHot] = useState<any>(null);
  const [hotSaving, setHotSaving] = useState(false);
  const [hotStatus, setHotStatus] = useState<Status>(null);
  // ── Qualification framework ──
  const [qual, setQual] = useState<any>(null);
  const [qualSaving, setQualSaving] = useState(false);
  const [qualStatus, setQualStatus] = useState<Status>(null);
  // ── Probability model ──
  const [prob, setProb] = useState<any>(null);
  const [probSaving, setProbSaving] = useState(false);
  const [probStatus, setProbStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [h, q, p] = await Promise.all([
          getJson("/api/admin/hot-classification"),
          getJson("/api/admin/qualification-framework"),
          getJson("/api/admin/probability-model"),
        ]);
        setHot(h);
        setQual(q.config); // GET returns { config, dimensions }
        setProb(p);
      } catch {
        setHotStatus({ type: "error", message: "Failed to load sales rules." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveHot = async () => {
    setHotSaving(true); setHotStatus(null);
    try { setHot(await putJson("/api/admin/hot-classification", hot)); setHotStatus({ type: "success", message: "Hot rule saved." }); }
    catch (e: any) { setHotStatus({ type: "error", message: e.message }); } finally { setHotSaving(false); }
  };
  const saveQual = async () => {
    setQualSaving(true); setQualStatus(null);
    try { setQual(await putJson("/api/admin/qualification-framework", qual)); setQualStatus({ type: "success", message: "Qualification framework saved." }); }
    catch (e: any) { setQualStatus({ type: "error", message: e.message }); } finally { setQualSaving(false); }
  };
  const saveProb = async () => {
    setProbSaving(true); setProbStatus(null);
    try { setProb(await putJson("/api/admin/probability-model", prob)); setProbStatus({ type: "success", message: "Probability model saved." }); }
    catch (e: any) { setProbStatus({ type: "error", message: e.message }); } finally { setProbSaving(false); }
  };

  if (loading) return <div className="p-6 text-center text-slate-500">Loading...</div>;

  const setHotW = (k: string, v: number) => setHot((s: any) => ({ ...s, weights: { ...s.weights, [k]: v } }));
  const setQualW = (k: string, v: number) => setQual((s: any) => ({ ...s, weights: { ...s.weights, [k]: v } }));
  const setProbStage = (k: string, v: number) => setProb((s: any) => ({ ...s, stageBase: { ...s.stageBase, [k]: v } }));

  return (
    <div className="space-y-4 animate-in fade-in">
      <div>
        <h2 className="text-base font-bold text-slate-800">Sales Rules</h2>
        <p className="text-xs text-slate-500 mt-1">Tune the Hot classification, Deal Qualification and Probability rules. Changes take effect immediately — no deploy needed.</p>
      </div>

      {/* Hot classification */}
      {hot && (
        <Card icon={<Flame className="w-4 h-4" />} title="Hot Opportunity Rule"
          subtitle="A deal is Hot when its maturity score reaches the threshold (never from activity/editing)."
          saving={hotSaving} onSave={saveHot} status={hotStatus}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-3">
              <Toggle label="Rule enabled" checked={!!hot.enabled} onChange={(b) => setHot({ ...hot, enabled: b })} desc="Off = fall back to the legacy activity rule." />
              <NumberField label="Hot threshold (score)" value={hot.threshold} onChange={(v) => setHot({ ...hot, threshold: v })} desc="Score at/above this is Hot (default 60)." />
              <NumberField label="Closing horizon (days)" value={hot.closingHorizonDays} onChange={(v) => setHot({ ...hot, closingHorizonDays: v })} desc="'Closing soon' window (default 90)." />
              <Toggle label="Exclude On Hold" checked={!!hot.excludeOnHold} onChange={(b) => setHot({ ...hot, excludeOnHold: b })} />
            </div>
            <div className="space-y-3 md:col-span-2">
              <h4 className="text-xs font-semibold text-slate-600 border-b pb-1">Signal weights (points added to the score)</h4>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Proposal sent (committed quote)" value={hot.weights.proposalSent} onChange={(v) => setHotW("proposalSent", v)} />
                <NumberField label="Stage is Proposal/Negotiation" value={hot.weights.stageProposalPlus} onChange={(v) => setHotW("stageProposalPlus", v)} />
                <NumberField label="Closing within horizon" value={hot.weights.closingSoon} onChange={(v) => setHotW("closingSoon", v)} />
                <NumberField label="Qualified (BANT)" value={hot.weights.qualified} onChange={(v) => setHotW("qualified", v)} />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Qualification framework */}
      {qual && (
        <Card icon={<ClipboardCheck className="w-4 h-4" />} title="Deal Qualification (BANT + Deliverability)"
          subtitle="Weights, pass threshold and the gate that stops unqualified deals progressing."
          saving={qualSaving} onSave={saveQual} status={qualStatus}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-3">
              <Toggle label="Gate enabled" checked={!!qual.enabled} onChange={(b) => setQual({ ...qual, enabled: b })} desc="Enforce qualification before a deal leaves Discovery." />
              <NumberField label="Pass threshold" value={qual.passThreshold} onChange={(v) => setQual({ ...qual, passThreshold: v })} desc="Score at/above this = Qualified (default 7)." />
              <NumberField label="Needs-Review floor" value={qual.needsReviewMin} onChange={(v) => setQual({ ...qual, needsReviewMin: v })} desc="Between this and pass = Needs Review (default 4)." />
              <Toggle label="Deliverability hard-gate" checked={!!qual.deliverabilityGate} onChange={(b) => setQual({ ...qual, deliverabilityGate: b })} desc="Deliverability = Gap forces Not Qualified." />
              <div className="grid gap-1">
                <label className="text-xs font-medium text-slate-700">Gate mode</label>
                <select value={qual.gateMode} onChange={(e) => setQual({ ...qual, gateMode: e.target.value })}
                  className="h-8 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="block">Block (reject the move)</option>
                  <option value="warn">Warn (allow the move)</option>
                </select>
              </div>
            </div>
            <div className="space-y-3 md:col-span-2">
              <h4 className="text-xs font-semibold text-slate-600 border-b pb-1">Dimension weights (each answered 0–2; weight multiplies the answer)</h4>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Budget / Funding" value={qual.weights.budget} onChange={(v) => setQualW("budget", v)} />
                <NumberField label="Authority" value={qual.weights.authority} onChange={(v) => setQualW("authority", v)} />
                <NumberField label="Need" value={qual.weights.need} onChange={(v) => setQualW("need", v)} />
                <NumberField label="Timeline" value={qual.weights.timeline} onChange={(v) => setQualW("timeline", v)} />
                <NumberField label="QBA Deliverability" value={qual.weights.deliverability} onChange={(v) => setQualW("deliverability", v)} />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Probability model */}
      {prob && (
        <Card icon={<Percent className="w-4 h-4" />} title="Probability Model"
          subtitle="Stage base probabilities and the guard that caps premature late-stage deals."
          saving={probSaving} onSave={saveProb} status={probStatus}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-3 md:col-span-2">
              <h4 className="text-xs font-semibold text-slate-600 border-b pb-1">Stage base probability (%)</h4>
              <div className="grid grid-cols-3 gap-3">
                {["Discovery", "Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"].map((s) => (
                  <NumberField key={s} label={s} value={prob.stageBase?.[s] ?? 0} onChange={(v) => setProbStage(s, v)} min={0} max={100} />
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-600 border-b pb-1">Maturity guard</h4>
              <Toggle label="Require quote for late stage" checked={!!prob.requireQuoteForLateStage} onChange={(b) => setProb({ ...prob, requireQuoteForLateStage: b })} desc="Proposal/Negotiation without a sent quote is capped." />
              <NumberField label="Unquoted late-stage cap (%)" value={prob.unquotedLateStageCap} onChange={(v) => setProb({ ...prob, unquotedLateStageCap: v })} min={0} max={100} desc="Default 25." />
              <NumberField label="Qualification factor" value={prob.qualificationFactor} onChange={(v) => setProb({ ...prob, qualificationFactor: v })} step={0.1} desc="Multiplier for not-yet-Qualified deals (1 = no effect)." />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
