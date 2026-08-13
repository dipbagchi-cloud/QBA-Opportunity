"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Sparkles, ChevronDown, BarChart3, Table, AlertTriangle, FileText, Loader2, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useCurrency } from "@/components/providers/currency-provider";

// ───── Types ─────

interface ChatMsg {
    role: "user" | "assistant";
    content: string;
    data?: any;
    actions?: { tool: string; success: boolean; summary: string }[];
    pendingFields?: string[];
    timestamp: Date;
}

// ───── Mini chart components ─────

// Categorical palette, validated for the lightness band, chroma floor,
// adjacent-pair CVD separation, normal-vision floor and contrast on both light
// and dark surfaces. Assigned in fixed order — never cycled for a 9th slice,
// which is why the backend rolls the tail into "Other".
const CHART_COLORS = [
    "#4f46e5", "#c2410c", "#0891b2", "#a21caf", "#4d7c0f",
    "#1d4ed8", "#be123c", "#059669", "#7c3aed",
];

/**
 * Replace the backend's {{money:N}} tokens with the global currency.
 *
 * The bot deliberately sends amounts untyped so the header's currency picker
 * decides how they read — the same format() every other screen uses, so the
 * bot's figures match the dashboard rather than showing a hardcoded "$".
 */
function renderMoneyTokens(text: string, format: (n: number, o?: any) => string): string {
    return (text || "").replace(/\{\{money:(-?\d+)\}\}/g, (_m, n) => format(Number(n)));
}

/** Compact money/count formatting so long figures don't blow out the panel. */
function fmtChartValue(n: number, measure?: string): string {
    if (measure === "count") return String(n);
    const abs = Math.abs(n);
    if (abs >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
    if (abs >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toLocaleString();
}

function BarChart({ data }: { data: any }) {
    const { format } = useCurrency();
    if (!data?.labels?.length) return null;
    const dataset = data.datasets?.[0];
    if (!dataset?.data?.length) return null;
    const maxVal = Math.max(...dataset.data, 1);

    return (
        <div className="mt-2 space-y-1">
            <p className="text-[11px] font-semibold text-slate-600 mb-1">{data.title}</p>
            {data.labels.map((label: string, i: number) => (
                <div key={`${label}-${i}`} className="flex items-center gap-2 text-[10px]">
                    <span className="w-20 text-right text-slate-500 truncate" title={label}>{label}</span>
                    <div className="flex-1 h-4 bg-slate-100 rounded-sm overflow-hidden">
                        <div
                            className="h-full rounded-sm transition-all duration-500"
                            style={{
                                width: `${(dataset.data[i] / maxVal) * 100}%`,
                                background: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                        />
                    </div>
                    <span className="w-14 text-right text-slate-600 font-medium tabular-nums">
                        {data.measure === 'count' ? fmtChartValue(dataset.data[i], 'count') : format(dataset.data[i], { compact: true })}
                    </span>
                </div>
            ))}
        </div>
    );
}

/**
 * Pie rendered as a conic-gradient disc with a labelled legend.
 *
 * The legend carries the identity and the value, so the slice colours are never
 * the only way to read the chart — and every slice is labelled, which a pie
 * needs far more than a bar does.
 */
function PieChart({ data }: { data: any }) {
    const { format } = useCurrency();
    if (!data?.labels?.length) return null;
    const values: number[] = data.datasets?.[0]?.data || [];
    const total = values.reduce((s, v) => s + (Number(v) || 0), 0);
    if (!(total > 0)) return null;

    let cursor = 0;
    const stops: string[] = [];
    values.forEach((v, i) => {
        const pct = (Number(v) || 0) / total * 100;
        const color = CHART_COLORS[i % CHART_COLORS.length];
        stops.push(`${color} ${cursor}% ${cursor + pct}%`);
        cursor += pct;
    });

    return (
        <div className="mt-2">
            <p className="text-[11px] font-semibold text-slate-600 mb-1.5">{data.title}</p>
            <div className="flex items-center gap-3">
                <div
                    className="w-24 h-24 rounded-full shrink-0 border border-slate-200"
                    style={{ background: `conic-gradient(${stops.join(", ")})` }}
                    role="img"
                    aria-label={data.title}
                />
                <div className="flex-1 min-w-0 space-y-0.5">
                    {data.labels.map((label: string, i: number) => {
                        const v = Number(values[i]) || 0;
                        return (
                            <div key={`${label}-${i}`} className="flex items-center gap-1.5 text-[10px]">
                                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                <span className="text-slate-600 truncate flex-1" title={label}>{label}</span>
                                <span className="text-slate-500 tabular-nums">{data.measure === 'count' ? fmtChartValue(v, 'count') : format(v, { compact: true })}</span>
                                <span className="text-slate-400 tabular-nums w-9 text-right">{((v / total) * 100).toFixed(0)}%</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}


function DataTable({ data }: { data: any }) {
    const { format } = useCurrency();
    if (!data?.rows?.length) return null;
    return (
        <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-[10px]">
                <thead className="bg-slate-50">
                    <tr>
                        {(data.columns || []).map((col: string) => (
                            <th key={col} className="text-left px-2 py-1 font-semibold text-slate-600">{col}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.rows.slice(0, 10).map((row: any, i: number) => (
                        <tr key={row.id || i} className="border-t border-slate-100">
                            <td className="px-2 py-1 text-slate-800 font-medium">{row.title}</td>
                            <td className="px-2 py-1 text-slate-500">{row.client}</td>
                            <td className="px-2 py-1">
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                                    row.stage === 'Closed Won' ? 'bg-green-100 text-green-700' :
                                    row.stage === 'Closed Lost' ? 'bg-red-100 text-red-700' :
                                    'bg-indigo-50 text-indigo-600'
                                }`}>{row.stage}</span>
                            </td>
                            <td className="px-2 py-1 text-slate-600 font-medium">{format(row.value, { compact: true })}</td>
                            <td className="px-2 py-1 text-slate-500">{row.owner}</td>
                            <td className="px-2 py-1 text-slate-400">{row.technology}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {data.rows.length > 10 && (
                <div className="px-2 py-1 text-center text-[9px] text-slate-400 bg-slate-50">
                    Showing 10 of {data.rows.length}
                </div>
            )}
        </div>
    );
}

function OpportunityDetail({ data }: { data: any }) {
    const { format } = useCurrency();
    const opp = data?.opportunity;
    if (!opp) return null;
    const fields = [
        ['Client', opp.client],
        ['Stage', opp.stage],
        ['Value', format(Number(opp.value) || 0)],
        ['Owner', opp.owner],
        ['Technology', opp.technology],
        ['Region', opp.region],
        ['Priority', opp.priority],
        ['Probability', opp.probability != null ? `${opp.probability}%` : null],
        ['GOM Approved', opp.gomApproved != null ? (opp.gomApproved ? 'Yes' : 'No') : null],
        ['Pricing Model', opp.pricingModel],
        ['Sales Rep', opp.salesRepName],
        ['Manager', opp.managerName],
        ['Day Rate', opp.expectedDayRate ? format(Number(opp.expectedDayRate)) : null],
        ['Start Date', opp.tentativeStartDate ? new Date(opp.tentativeStartDate).toLocaleDateString() : null],
        ['Duration', opp.tentativeDuration ? `${opp.tentativeDuration} ${opp.tentativeDurationUnit || ''}` : null],
        ['Close Date', opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toLocaleDateString() : null],
        ['Re-estimates', opp.reEstimateCount > 0 ? String(opp.reEstimateCount) : null],
        ['Status', opp.detailedStatus],
        ['Description', opp.description],
    ].filter(([, v]) => v && v !== '—' && v !== 'null');

    return (
        <div className="mt-2 space-y-2">
            <div className="grid grid-cols-2 gap-1 text-[10px]">
                {fields.map(([label, value]) => (
                    <div key={label as string} className="flex gap-1">
                        <span className="text-slate-400 font-medium">{label}:</span>
                        <span className="text-slate-700">{value}</span>
                    </div>
                ))}
            </div>
            {opp.recentComments?.length > 0 && (
                <div className="mt-1">
                    <p className="text-[10px] font-semibold text-slate-500 mb-0.5">Recent Comments:</p>
                    {opp.recentComments.slice(0, 3).map((c: any, i: number) => (
                        <div key={i} className="text-[9px] text-slate-500 ml-2">
                            <span className="font-medium text-slate-600">{c.author}:</span> {c.content}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function HealthReport({ data }: { data: any }) {
    if (!data) return null;
    return (
        <div className="mt-2 space-y-2 text-[10px]">
            {data.stalled?.length > 0 && (
                <div>
                    <p className="font-semibold text-red-600 flex items-center gap-1 mb-0.5">
                        <AlertTriangle className="w-3 h-3" /> Stalled ({data.stalled.length})
                    </p>
                    {data.stalled.slice(0, 5).map((d: any) => (
                        <div key={d.id} className="ml-3 text-slate-600">
                            {d.title} — <span className="text-slate-400">{d.client}</span> — {d.daysSinceUpdate}d — ${(d.value / 1000).toFixed(0)}K
                        </div>
                    ))}
                </div>
            )}
            {data.atRisk?.length > 0 && (
                <div>
                    <p className="font-semibold text-amber-600 flex items-center gap-1 mb-0.5">
                        <AlertTriangle className="w-3 h-3" /> At Risk ({data.atRisk.length})
                    </p>
                    {data.atRisk.slice(0, 5).map((d: any) => (
                        <div key={d.id} className="ml-3 text-slate-600">
                            {d.title} — <span className="text-slate-400">{d.client}</span> — {d.daysSinceUpdate}d — ${(d.value / 1000).toFixed(0)}K
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ───── Render data block ─────

function DataBlock({ data }: { data: any }) {
    if (!data) return null;
    if (data.type === 'chart') return data.chartType === 'pie' ? <PieChart data={data} /> : <BarChart data={data} />;
    if (data.type === 'table') return <DataTable data={data} />;
    if (data.type === 'detail') return <OpportunityDetail data={data} />;
    if (data.type === 'health') return <HealthReport data={data} />;
    return null;
}

// ───── Main ChatBot Component ─────

export default function ChatBot() {
    // Money in replies follows the header's currency picker, like every other screen.
    const { format } = useCurrency();
    const [isOpen, setIsOpen] = useState(false);

    // Where the launcher sits. null means "docked bottom-centre", the default
    // for anyone who has never dragged it — so the button does not need a stored
    // position to appear, and a cleared browser simply returns to the dock.
    const [launcherPos, setLauncherPos] = useState<{ x: number; y: number } | null>(null);
    const launcherRef = useRef<HTMLDivElement>(null);
    // Drag bookkeeping. `moved` is what separates a drag from a click: without
    // it, every drag would also open the chat on release.
    const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
    // Click fires after pointerup, by which time the drag record is gone, so the
    // "was that a drag?" answer has to outlive it by one event.
    const suppressClickRef = useRef(false);
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load suggestions
    useEffect(() => {
        if (isOpen && suggestions.length === 0) {
            apiClient<{ suggestions: string[] }>("/api/chatbot/suggestions")
                .then(res => setSuggestions(res.suggestions))
                .catch(() => {});
        }
    }, [isOpen, suggestions.length]);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) inputRef.current.focus();
    }, [isOpen]);

    // Re-focus input after loading completes
    useEffect(() => {
        if (!loading && isOpen && inputRef.current) inputRef.current.focus();
    }, [loading, isOpen]);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || loading) return;
        const userMsg: ChatMsg = { role: "user", content: text.trim(), timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const res = await apiClient<any>("/api/chatbot/message", {
                method: "POST",
                body: JSON.stringify({ message: text.trim() }),
            });
            const botMsg: ChatMsg = {
                role: "assistant",
                content: res.content,
                data: res.data,
                actions: res.actions,
                pendingFields: res.pendingFields,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (err: any) {
            setMessages(prev => [...prev, {
                role: "assistant",
                content: `Sorry, I encountered an error: ${err.message}`,
                timestamp: new Date(),
            }]);
        }
        setLoading(false);
        // Re-focus input after bot responds
        setTimeout(() => { inputRef.current?.focus(); }, 50);
    }, [loading]);

    // ───── Draggable launcher ─────

    const LAUNCHER_SIZE = 56;   // w-14 / h-14
    const LAUNCHER_MARGIN = 8;
    const LAUNCHER_POS_KEY = "qcrm.chatbot.launcherPosition";

    /** Keep the button on screen — including after the window is resized. */
    const clampToViewport = useCallback((p: { x: number; y: number }) => ({
        x: Math.min(Math.max(p.x, LAUNCHER_MARGIN), Math.max(LAUNCHER_MARGIN, window.innerWidth - LAUNCHER_SIZE - LAUNCHER_MARGIN)),
        y: Math.min(Math.max(p.y, LAUNCHER_MARGIN), Math.max(LAUNCHER_MARGIN, window.innerHeight - LAUNCHER_SIZE - LAUNCHER_MARGIN)),
    }), []);

    // Restore the saved spot on mount, and re-clamp when the window changes so a
    // position saved on a wide monitor cannot strand the button off-screen on a
    // laptop.
    useEffect(() => {
        try {
            const raw = localStorage.getItem(LAUNCHER_POS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
                    setLauncherPos(clampToViewport(parsed));
                }
            }
        } catch {
            /* unreadable or disabled storage just means the default dock */
        }
        const onResize = () => setLauncherPos(p => (p ? clampToViewport(p) : p));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [clampToViewport]);

    const handleLauncherPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const rect = launcherRef.current?.getBoundingClientRect();
        if (!rect) return;
        dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handleLauncherPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag) return;
        const next = clampToViewport({ x: e.clientX - drag.dx, y: e.clientY - drag.dy });
        // A few pixels of slop, so a slightly shaky click still opens the chat
        // rather than being swallowed as a drag.
        if (!drag.moved) {
            const rect = launcherRef.current?.getBoundingClientRect();
            if (rect && Math.abs(next.x - rect.left) + Math.abs(next.y - rect.top) > 4) drag.moved = true;
        }
        if (drag.moved) setLauncherPos(next);
    };

    const handleLauncherPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        suppressClickRef.current = !!drag?.moved;
        if (!drag?.moved) return;
        // Persist only a real move, so the placement survives reloads and stays
        // put until it is dragged somewhere else.
        setLauncherPos(p => {
            if (p) { try { localStorage.setItem(LAUNCHER_POS_KEY, JSON.stringify(p)); } catch { /* non-fatal */ } }
            return p;
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    return (
        <>
            {/* Floating toggle button, docked bottom-centre.
                z-30 deliberately sits BELOW the app's dialog layer (z-50) and
                the toast layer (z-[100]) so the launcher can never cover a
                modal's action buttons — it is the least important thing on
                screen whenever a dialog is open. It stays above page chrome
                (sticky table headers are z-20).
                Centre-bottom also keeps it out of the corners the app puts its
                controls in: the opportunities footer holds the row count on the
                left and the pagination buttons on the right, leaving the middle
                clear. */}
            {!isOpen && (
                <div
                    ref={launcherRef}
                    onPointerDown={handleLauncherPointerDown}
                    onPointerMove={handleLauncherPointerMove}
                    onPointerUp={handleLauncherPointerUp}
                    onPointerCancel={handleLauncherPointerUp}
                    style={launcherPos
                        ? { left: launcherPos.x, top: launcherPos.y, touchAction: "none" }
                        : { touchAction: "none" }}
                    className={`fixed z-30 flex flex-col items-center animate-in fade-in duration-300 ${
                        launcherPos ? "" : "bottom-4 left-1/2 -translate-x-1/2"
                    }`}
                >
                    <button
                        // Click is suppressed after a drag, so releasing the
                        // button at its new home does not also open the chat.
                        onClick={() => {
                            if (suppressClickRef.current) { suppressClickRef.current = false; return; }
                            setIsOpen(true);
                        }}
                        className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-grab active:cursor-grabbing"
                        title="AI Assistant — drag to move"
                    >
                        <Sparkles className="w-6 h-6" />
                    </button>
                </div>
            )}

            {/* Chat panel.
                z-40 keeps it above page content but still under dialogs, so a
                confirmation modal opened behind it always wins. Sized against
                the viewport rather than fixed pixels: on a phone the old
                w-[420px] h-[600px] overflowed the screen and pushed its own
                input off-screen. dvh (not vh) accounts for mobile browser
                chrome that shrinks the visible area. */}
            {isOpen && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-2rem)] sm:w-[420px] h-[min(600px,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="font-semibold text-sm">Q-CRM AI Assistant</p>
                                <p className="text-[10px] text-white/70">Ask about opportunities, analytics & more</p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
                        {messages.length === 0 && !loading && (
                            <div className="text-center py-8">
                                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                                    <MessageSquare className="w-6 h-6 text-indigo-400" />
                                </div>
                                <p className="text-sm font-medium text-slate-700 mb-1">How can I help you?</p>
                                <p className="text-xs text-slate-400 mb-4">Ask me about your deals, pipeline, or analytics</p>

                                {/* Suggestions */}
                                {suggestions.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 justify-center px-2">
                                        {suggestions.map((s, i) => (
                                            <button
                                                key={i}
                                                onClick={() => sendMessage(s)}
                                                className="px-2.5 py-1.5 rounded-full bg-slate-100 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border border-slate-200"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[90%] rounded-xl px-3 py-2 ${
                                    msg.role === "user"
                                        ? "bg-indigo-600 text-white"
                                        : "bg-slate-100 text-slate-800"
                                }`}>
                                    {msg.role === "assistant" && (
                                        <div className="flex items-center gap-1 mb-1">
                                            <Sparkles className="w-3 h-3 text-indigo-500" />
                                            <span className="text-[9px] font-semibold text-indigo-500">AI</span>
                                        </div>
                                    )}
                                    <div className="text-xs whitespace-pre-wrap leading-relaxed">
                                        {renderMoneyTokens(msg.content, format).split('\n').map((line, j) => {
                                            // Bold text + bullet rendering
                                            const parts = line.split(/(\*\*[^*]+\*\*)/g);
                                            const isBullet = line.trimStart().startsWith('•') || line.trimStart().startsWith('-');
                                            return (
                                                <div key={j} className={isBullet ? 'ml-2' : ''}>
                                                    {parts.map((part, k) =>
                                                        part.startsWith('**') && part.endsWith('**')
                                                            ? <strong key={k}>{part.slice(2, -2)}</strong>
                                                            : <span key={k}>{part}</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {msg.data && <DataBlock data={msg.data} />}

                                    {/* Confirmation quick-actions */}
                                    {msg.role === "assistant" && msg.content.includes('**"yes"**') && i === messages.length - 1 && !loading && (
                                        <div className="flex gap-2 mt-2">
                                            <button onClick={() => sendMessage("yes")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500 text-white text-[11px] font-medium hover:bg-green-600 transition-colors">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                                            </button>
                                            <button onClick={() => sendMessage("no")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 text-white text-[11px] font-medium hover:bg-red-600 transition-colors">
                                                <XCircle className="w-3.5 h-3.5" /> Cancel
                                            </button>
                                        </div>
                                    )}

                                    {/* Pending fields indicator */}
                                    {msg.role === "assistant" && msg.pendingFields && msg.pendingFields.length > 0 && i === messages.length - 1 && (
                                        <div className="mt-2 flex items-center gap-1 text-[9px] text-indigo-500">
                                            <RotateCcw className="w-3 h-3" />
                                            <span>{msg.pendingFields.length} field{msg.pendingFields.length > 1 ? 's' : ''} remaining</span>
                                        </div>
                                    )}

                                    <div className={`text-[9px] mt-1 ${msg.role === "user" ? "text-white/50" : "text-slate-400"}`}>
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Loading */}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-100 rounded-xl px-3 py-2 flex items-center gap-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                                    <span className="text-xs text-slate-500">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick actions (after first message) */}
                    {messages.length > 0 && suggestions.length > 0 && !loading && (
                        <div className="px-3 py-1.5 border-t border-slate-100 flex gap-1 overflow-x-auto scrollbar-thin">
                            {suggestions.slice(0, 4).map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => sendMessage(s)}
                                    className="shrink-0 px-2 py-1 rounded-full bg-slate-50 text-[10px] text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border border-slate-200"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="px-3 py-3 border-t border-slate-200 bg-white">
                        {/* Cancel button when in interactive mode */}
                        {messages.length > 0 && messages[messages.length - 1]?.pendingFields?.length && !loading && (
                            <div className="flex items-center gap-2 mb-2">
                                <button
                                    onClick={() => sendMessage("cancel")}
                                    className="text-[10px] text-red-500 hover:text-red-600 flex items-center gap-1"
                                >
                                    <XCircle className="w-3 h-3" /> Cancel data entry
                                </button>
                                <button
                                    onClick={() => sendMessage("skip")}
                                    className="text-[10px] text-slate-400 hover:text-slate-500 flex items-center gap-1"
                                >
                                    Skip this field
                                </button>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={messages.length > 0 && messages[messages.length - 1]?.pendingFields?.length ? "Type your answer or 'skip'..." : "Ask about opportunities, analytics..."}
                                className="flex-1 bg-slate-100 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 border border-slate-200"
                                disabled={loading}
                                maxLength={2000}
                            />
                            <button
                                onClick={() => sendMessage(input)}
                                disabled={loading || !input.trim()}
                                className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition-colors shrink-0"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
