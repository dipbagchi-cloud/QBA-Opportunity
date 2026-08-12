"use client";

import { Fragment } from "react";
import { Check, XCircle } from "lucide-react";

/**
 * Horizontal stage timeline for the opportunity detail page.
 *
 * The nodes are the real stages from the `stages` table, in `order`:
 * Discovery → Qualification → Proposal → Negotiation → Closed Won. Stages the
 * deal has reached (the current one and everything before it) are green;
 * stages still ahead are grey.
 *
 * The three closed stages are mutually exclusive terminals, so only one is
 * ever drawn: a live deal shows Closed Won as its (grey) end node, while a
 * lost deal replaces that node with a red Closed Lost / Proposal Lost. A deal
 * lost early also collapses the stages it never reached, so the timeline is
 * an honest record of where it actually stopped.
 */

// Happy path, matching Stage.order 1–5 in the database.
const HAPPY_PATH = ['Discovery', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won'] as const;

// The timeline names the real stages from the `stages` table and nothing else.
// It used to relabel Qualification as "Presales", borrowing the wording of the
// workflow tabs — but Presales is a phase of work, not a stage a deal can be
// in, so the timeline disagreed with the Stage column and the stage filter.
// This map only normalises legacy/alias values onto their canonical stage.
const DISPLAY_LABEL: Record<string, string> = {
    Discovery: 'Discovery',
    Pipeline: 'Discovery',
    Qualification: 'Qualification',
    Presales: 'Qualification',
    Proposal: 'Proposal',
    Sales: 'Proposal',
    Negotiation: 'Negotiation',
    'Closed Won': 'Closed Won',
    'Closed-Won': 'Closed Won',
    Delivered: 'Closed Won',
    'Closed Lost': 'Closed Lost',
    'Proposal Lost': 'Proposal Lost',
};

const LOST_STAGES = ['Closed Lost', 'Proposal Lost'];

// Map whatever the record carries onto a happy-path index.
const HAPPY_PATH_INDEX: Record<string, number> = {
    Discovery: 0, Pipeline: 0,
    Qualification: 1, Presales: 1,
    Proposal: 2, Sales: 2,
    Negotiation: 3,
    'Closed Won': 4, 'Closed-Won': 4, Delivered: 4,
};

export type StageHistoryEntry = {
    id?: string;
    enteredAt?: string;
    exitedAt?: string | null;
    stage?: { name?: string | null; order?: number | null } | null;
};

type NodeState = 'done' | 'current' | 'future' | 'lost';

const fmtDate = (raw?: string | null) => {
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' });
};

// Consecutive transitions often land on the same day, so the tooltip carries
// the time to tell them apart.
const fmtDateTime = (raw?: string | null) => {
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
};

export function StageTimeline({
    currentStageName,
    stageHistory = [],
    createdAt,
}: {
    currentStageName: string;
    stageHistory?: StageHistoryEntry[];
    createdAt?: string;
}) {
    const stage = (currentStageName || '').trim();
    const isLost = LOST_STAGES.includes(stage);

    // First time each stage was entered, so a deal sent back for re-estimation
    // keeps the date it originally reached that stage.
    const enteredAtByStage: Record<string, string> = {};
    stageHistory.forEach(h => {
        const name = h.stage?.name?.trim();
        if (!name || !h.enteredAt) return;
        if (!enteredAtByStage[name] || new Date(h.enteredAt) < new Date(enteredAtByStage[name])) {
            enteredAtByStage[name] = h.enteredAt;
        }
    });
    // Discovery is where every deal starts, so fall back to the creation date
    // for records that predate stage history being written.
    if (!enteredAtByStage['Discovery'] && createdAt) enteredAtByStage['Discovery'] = createdAt;

    // How far the deal got. For a lost deal, the furthest stage it was ever
    // recorded in — history first, falling back to whatever the last non-lost
    // stage would have been.
    const reachedIdx = (() => {
        if (!isLost) return HAPPY_PATH_INDEX[stage] ?? 0;
        const fromHistory = stageHistory
            .map(h => HAPPY_PATH_INDEX[(h.stage?.name || '').trim()])
            .filter(i => i != null) as number[];
        // A Proposal Lost happens at/after Proposal; a Closed Lost can happen
        // anywhere. Use the deepest stage the record can evidence.
        const deepest = fromHistory.length ? Math.max(...fromHistory) : 0;
        return stage === 'Proposal Lost' ? Math.max(deepest, 2) : deepest;
    })();

    // Build the node list. A lost deal ends at a red terminal after the last
    // stage it actually reached, replacing the remaining happy-path nodes.
    const nodes: { key: string; label: string; state: NodeState; date: string | null; exact: string | null }[] = [];
    const lastLiveIdx = isLost ? Math.min(reachedIdx, HAPPY_PATH.length - 2) : HAPPY_PATH.length - 1;

    for (let i = 0; i <= lastLiveIdx; i++) {
        const name = HAPPY_PATH[i];
        const state: NodeState = isLost || i < reachedIdx ? 'done' : i === reachedIdx ? 'current' : 'future';
        nodes.push({
            key: name,
            label: DISPLAY_LABEL[name] || name,
            state,
            // A stage still ahead has not been entered, so it carries no date.
            date: state === 'future' ? null : fmtDate(enteredAtByStage[name]),
            exact: state === 'future' ? null : fmtDateTime(enteredAtByStage[name]),
        });
    }

    if (isLost) {
        nodes.push({
            key: stage,
            label: DISPLAY_LABEL[stage] || stage,
            state: 'lost',
            date: fmtDate(enteredAtByStage[stage]),
            exact: fmtDateTime(enteredAtByStage[stage]),
        });
    }

    const NODE_STYLE: Record<NodeState, { circle: string; label: string; connector: string }> = {
        done: {
            circle: 'bg-emerald-500 border-emerald-500 text-white',
            label: 'text-emerald-700 font-semibold',
            connector: 'bg-emerald-500',
        },
        current: {
            circle: 'bg-emerald-500 border-emerald-600 text-white ring-4 ring-emerald-100',
            label: 'text-emerald-800 font-bold',
            connector: 'bg-slate-200',
        },
        future: {
            circle: 'bg-slate-100 border-slate-300 text-slate-400',
            label: 'text-slate-400 font-medium',
            connector: 'bg-slate-200',
        },
        lost: {
            circle: 'bg-red-500 border-red-600 text-white ring-4 ring-red-100',
            label: 'text-red-700 font-bold',
            connector: 'bg-red-400',
        },
    };

    return (
        <section className="bg-white rounded-lg border border-slate-200 shadow-sm px-4 py-3">
            <div className="flex items-baseline gap-2 mb-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Stage Timeline</h3>
                <span className="text-[11px] text-slate-400">
                    {isLost
                        ? `Closed as ${DISPLAY_LABEL[stage] || stage}`
                        : `Currently in ${DISPLAY_LABEL[stage] || stage || 'Discovery'}`}
                </span>
            </div>

            <ol className="flex items-start overflow-x-auto pb-1">
                {nodes.map((node, i) => {
                    const style = NODE_STYLE[node.state];
                    return (
                        <Fragment key={node.key}>
                            {/* The connector leading into a node is green only
                                once the stage before it has been completed. */}
                            {i > 0 && (
                                <li
                                    aria-hidden="true"
                                    className={`flex-1 min-w-[16px] h-0.5 mt-3.5 ${NODE_STYLE[nodes[i - 1].state].connector}`}
                                />
                            )}
                            <li className="flex flex-col items-center gap-1 px-1.5 shrink-0">
                                <div
                                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${style.circle}`}
                                    title={node.exact
                                        ? `${node.label} — entered ${node.exact}`
                                        : `${node.label} — not reached yet`}
                                >
                                    {node.state === 'lost'
                                        ? <XCircle className="w-4 h-4" />
                                        : node.state === 'future'
                                            ? <span className="text-[10px] font-bold">{i + 1}</span>
                                            : <Check className="w-4 h-4" strokeWidth={3} />}
                                </div>
                                <span className={`text-[10px] text-center leading-tight whitespace-nowrap ${style.label}`}>
                                    {node.label}
                                </span>
                                {/* Fixed height keeps every node's label on the
                                    same baseline whether or not it has a date. */}
                                <span
                                    className={`text-[10px] leading-none h-3.5 whitespace-nowrap ${node.state === 'lost' ? 'text-red-500' : node.date ? 'text-slate-500' : 'text-slate-300'}`}
                                    title={node.exact || undefined}
                                >
                                    {node.date || (node.state === 'future' ? '—' : '')}
                                </span>
                            </li>
                        </Fragment>
                    );
                })}
            </ol>
        </section>
    );
}
