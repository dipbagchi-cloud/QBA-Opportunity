"use client";

import React, { useEffect, useState } from "react";
import { API_URL, getAuthHeaders } from "@/lib/api";

/**
 * CR-03 full stage machine — the commercial stage path (modern-CRM standard).
 *
 * Shows where the deal is across the six commercial stages using the
 * admin-configured labels (GET /api/stages), so the whole app speaks one
 * vocabulary. The four open stages run left-to-right as a chevron path; the two
 * closed outcomes sit apart because they are outcomes, not steps.
 */

type Stage = {
  name: string; label: string; order: number; probability: number; color: string;
  isClosed: boolean; isWon: boolean; moves: { to: string; kind: string }[];
};

// Resolve legacy / workflow-vocabulary stage strings to the canonical name.
const ALIAS: Record<string, string> = {
  Pipeline: "Discovery", Presales: "Qualification", Sales: "Proposal",
  "Closed-Won": "Closed Won", Delivered: "Closed Won", "Proposal Lost": "Closed Lost",
};
const canonical = (s?: string | null) => (s ? (ALIAS[s] || s) : "");

export function StagePath({ currentStage }: { currentStage: string }) {
  const [stages, setStages] = useState<Stage[]>([]);
  useEffect(() => {
    fetch(`${API_URL}/api/stages`, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setStages(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  if (!stages.length) return null;

  const cur = canonical(currentStage);
  const curStage = stages.find((s) => s.name === cur);
  const curOrder = curStage?.order ?? 0;
  const open = stages.filter((s) => !s.isClosed).sort((a, b) => a.order - b.order);
  const won = stages.find((s) => s.isClosed && s.isWon);
  const lost = stages.find((s) => s.isClosed && !s.isWon);
  const isClosed = curStage?.isClosed ?? false;

  const nameFor = (n: string) => stages.find((s) => s.name === n)?.label || n;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Open stages as a chevron path */}
      <ol className="flex flex-1 min-w-[280px] items-stretch rounded-lg overflow-hidden border border-slate-200">
        {open.map((s, i) => {
          const done = !isClosed && s.order < curOrder;
          const active = !isClosed && s.name === cur;
          let cls = "bg-slate-50 text-slate-400";
          if (done) cls = "bg-emerald-500 text-white";
          if (active) cls = "bg-indigo-900 text-white";
          return (
            <li key={s.name}
              className={`relative flex-1 px-3 py-2 text-xs font-semibold flex items-center justify-center ${cls}`}
              title={`Prob. ${s.probability}%`}>
              {s.label}
              {i < open.length - 1 && (
                <span className={`absolute right-0 top-0 bottom-0 w-[10px] skew-x-12 translate-x-1.5 z-10 ${done ? "bg-emerald-500" : "bg-white border-r border-slate-200"}`} />
              )}
            </li>
          );
        })}
      </ol>
      {/* Closed outcomes, apart */}
      <div className="flex items-center gap-1.5">
        {won && (
          <span className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${cur === won.name ? "bg-green-600 text-white border-green-600" : "bg-white text-green-700 border-green-200"}`}>
            {won.label}
          </span>
        )}
        {lost && (
          <span className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${cur === lost.name ? "bg-red-600 text-white border-red-600" : "bg-white text-red-600 border-red-200"}`}>
            {lost.label}
          </span>
        )}
      </div>
      {/* Next legal moves as a quiet hint */}
      {curStage && curStage.moves.length > 0 && !isClosed && (
        <span className="text-[11px] text-slate-400 w-full md:w-auto">
          Next: {curStage.moves.map((m) => nameFor(m.to)).join(" · ")}
        </span>
      )}
    </div>
  );
}
