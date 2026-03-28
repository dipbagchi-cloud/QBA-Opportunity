"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Sparkles, ChevronDown, BarChart3, Table, AlertTriangle, FileText, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";

// ───── Types ─────

interface ChatMsg {
    role: "user" | "assistant";
    content: string;
    data?: any;
    actions?: { tool: string; success: boolean; summary: string }[];
    timestamp: Date;
}

// ───── Mini chart components ─────

function BarChart({ data }: { data: any }) {
    if (!data?.labels?.length) return null;
    const dataset = data.datasets?.[0];
    if (!dataset?.data?.length) return null;
    const maxVal = Math.max(...dataset.data, 1);

    return (
        <div className="mt-2 space-y-1">
            <p className="text-[11px] font-semibold text-slate-600 mb-1">{data.title}</p>
            {data.labels.map((label: string, i: number) => (
                <div key={label} className="flex items-center gap-2 text-[10px]">
                    <span className="w-20 text-right text-slate-500 truncate" title={label}>{label}</span>
                    <div className="flex-1 h-4 bg-slate-100 rounded-sm overflow-hidden">
                        <div
                            className="h-full bg-indigo-400 rounded-sm transition-all duration-500"
                            style={{ width: `${(dataset.data[i] / maxVal) * 100}%` }}
                        />
                    </div>
                    <span className="w-12 text-right text-slate-600 font-medium">{dataset.data[i]}</span>
                </div>
            ))}
            {data.datasets?.length > 1 && (
                <div className="flex gap-3 mt-1 text-[9px] text-slate-400">
                    {data.datasets.map((ds: any, i: number) => (
                        <span key={i} className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                            {ds.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function DataTable({ data }: { data: any }) {
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
                            <td className="px-2 py-1 text-slate-600 font-medium">${(row.value / 1000).toFixed(0)}K</td>
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
    const opp = data?.opportunity;
    if (!opp) return null;
    const fields = [
        ['Client', opp.client],
        ['Stage', opp.stage],
        ['Value', `${opp.currency || 'USD'} ${Number(opp.value).toLocaleString()}`],
        ['Owner', opp.owner],
        ['Technology', opp.technology],
        ['Region', opp.region],
        ['Priority', opp.priority],
        ['Probability', `${opp.probability}%`],
        ['GOM Approved', opp.gomApproved ? 'Yes' : 'No'],
        ['Pricing Model', opp.pricingModel],
        ['Sales Rep', opp.salesRepName],
    ].filter(([, v]) => v && v !== '—');

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
    if (data.type === 'chart') return <BarChart data={data} />;
    if (data.type === 'table') return <DataTable data={data} />;
    if (data.type === 'detail') return <OpportunityDetail data={data} />;
    if (data.type === 'health') return <HealthReport data={data} />;
    return null;
}

// ───── Main ChatBot Component ─────

export default function ChatBot() {
    const [isOpen, setIsOpen] = useState(false);
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
    }, [loading]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    return (
        <>
            {/* Floating toggle button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                    title="AI Assistant"
                >
                    <Sparkles className="w-6 h-6" />
                </button>
            )}

            {/* Chat panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
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
                                        {msg.content.split('\n').map((line, j) => {
                                            // Bold text
                                            const parts = line.split(/(\*\*[^*]+\*\*)/g);
                                            return (
                                                <div key={j}>
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
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask about opportunities, analytics..."
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
