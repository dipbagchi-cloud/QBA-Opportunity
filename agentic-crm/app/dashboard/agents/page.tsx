"use client";

import { Bot, Sparkles, MessageSquare, Zap, Play, Plus, Settings, Activity, Power, X, Save, Terminal } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface AgentLog {
    step: string;
    detail: string;
    status: 'thinking' | 'action' | 'success';
}

interface Agent {
    id: number;
    name: string;
    active: boolean;
    desc: string;
    status: string;
    tasks: string;
    creativity: number;
    logs: AgentLog[];
}

export default function AgenticAIPage() {
    const [agents, setAgents] = useState<Agent[]>([
        { id: 1, name: "Outreach Agent", active: true, desc: "Drafts and sends personalized cold emails to leads.", status: "Running", tasks: "1.2k emails sent", creativity: 75, logs: [] },
        { id: 2, name: "Researcher Agent", active: true, desc: "Enriches lead profiles with data from LinkedIn and web.", status: "Running", tasks: "450 profiles enriched", creativity: 40, logs: [] },
        { id: 3, name: "Scheduler Agent", active: false, desc: "Coordinates meeting times and sends calendar invites.", status: "Paused", tasks: "0 meetings set", creativity: 20, logs: [] },
    ]);

    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newAgentName, setNewAgentName] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const [runInput, setRunInput] = useState("Research Acme Corp and find their CTO.");
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom of logs
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [selectedAgent?.logs]);

    const toggleAgentStatus = (id: number) => {
        setAgents(agents.map(agent => {
            if (agent.id === id) {
                const newActive = !agent.active;
                return {
                    ...agent,
                    active: newActive,
                    status: newActive ? "Running" : "Paused"
                };
            }
            return agent;
        }));

        // Update selected agent if open
        if (selectedAgent && selectedAgent.id === id) {
            setSelectedAgent(prev => prev ? ({ ...prev, active: !prev.active, status: !prev.active ? "Running" : "Paused" }) : null);
        }
    };

    const runAgentSimulation = async () => {
        if (!selectedAgent) return;
        setIsRunning(true);

        // Clear previous logs for this run
        const clearedAgent = { ...selectedAgent, logs: [] };
        setSelectedAgent(clearedAgent);

        try {
            const response = await fetch('/api/agent/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: selectedAgent.id, task: runInput })
            });

            if (!response.body) return;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));

                        // Update local state for immediate feedback
                        setSelectedAgent(prev => {
                            if (!prev) return null;
                            return {
                                ...prev,
                                logs: [...(prev.logs || []), data]
                            };
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Agent Error:", error);
        } finally {
            setIsRunning(false);
        }
    };

    const handleCreateAgent = () => {
        if (!newAgentName) return;
        const newAgent: Agent = {
            id: Date.now(),
            name: newAgentName,
            active: false,
            desc: "Custom agent trained on your specific playbook.",
            status: "Configuring",
            tasks: "0 tasks",
            creativity: 50,
            logs: []
        };
        setAgents([...agents, newAgent]);
        setNewAgentName("");
        setIsCreating(false);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 relative min-h-screen pb-20">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                    Agentic AI
                </h1>
                <p className="text-slate-500 mt-1">Configure and monitor your autonomous sales agents.</p>
            </div>

            {/* Agent Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map((agent) => (
                    <div key={agent.id} className={`bg-white p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group
                        ${agent.active ? 'border-indigo-200 shadow-md shadow-indigo-500/10' : 'border-slate-200 shadow-sm opacity-90'}
                    `}>
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Bot className="w-24 h-24 rotate-12" />
                        </div>

                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <div className={`p-3 rounded-xl ${agent.active ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                <Bot className="w-6 h-6" />
                            </div>
                            <div className="flex gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5
                                    ${agent.active
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'}
                                `}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${agent.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                    {agent.status}
                                </span>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 mb-2 relative z-10">{agent.name}</h3>
                        <p className="text-slate-500 text-sm mb-6 h-10 relative z-10 line-clamp-2">{agent.desc}</p>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 relative z-10">
                            <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <Activity className="w-3 h-3" />
                                {agent.tasks}
                            </span>
                            <button
                                onClick={() => setSelectedAgent({ ...agent, logs: agent.logs || [] })}
                                className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                            >
                                Configure <Settings className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create New Agent CTA */}
            <div className="bg-indigo-900 rounded-3xl p-8 md:p-12 text-white relative overflow-hidden shadow-xl shadow-indigo-900/20">
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 max-w-2xl">
                    <h2 className="text-2xl md:text-3xl font-bold mb-4">Train Your Custom Agent</h2>
                    <p className="text-indigo-200 mb-8 text-lg">
                        Create a bespoke agent tailored to your specific sales playbook. Upload your scripts, objection handlers, and best practices.
                    </p>

                    {!isCreating ? (
                        <button
                            onClick={() => setIsCreating(true)}
                            className="bg-white text-indigo-900 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-lg shadow-indigo-900/50"
                        >
                            <Plus className="w-5 h-5" />
                            Create New Agent
                        </button>
                    ) : (
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-4">
                            <label className="block text-sm font-medium text-indigo-100 mb-2">Agent Name</label>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={newAgentName}
                                    onChange={(e) => setNewAgentName(e.target.value)}
                                    placeholder="e.g., Closer Bot"
                                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder:text-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    autoFocus
                                />
                                <button
                                    onClick={handleCreateAgent}
                                    className="bg-white text-indigo-900 px-4 py-2 rounded-xl font-bold hover:bg-indigo-50 transition-colors"
                                >
                                    Create
                                </button>
                                <button
                                    onClick={() => setIsCreating(false)}
                                    className="px-4 py-2 rounded-xl font-medium text-white hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Configuration Modal / Overlay */}
            {selectedAgent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${selectedAgent.active ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{selectedAgent.name}</h3>
                                    <p className="text-xs text-slate-500">{selectedAgent.status}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedAgent(null)}
                                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6 overflow-y-auto">
                            {/* Toggle Active */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div>
                                    <p className="font-medium text-slate-900">Agent Status</p>
                                    <p className="text-sm text-slate-500">{selectedAgent.active ? "Agent is running and processing tasks." : "Agent is paused."}</p>
                                </div>
                                <button
                                    onClick={() => toggleAgentStatus(selectedAgent.id)}
                                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${selectedAgent.active ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                >
                                    <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${selectedAgent.active ? 'translate-x-7' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* Test Run Console */}
                            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
                                <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700">
                                    <span className="text-xs font-medium text-slate-300 flex items-center gap-2">
                                        <Terminal className="w-3 h-3" />
                                        Live Agent Terminal
                                    </span>
                                    {isRunning && <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                                </div>

                                <div className="p-4 h-48 overflow-y-auto space-y-3 font-mono text-xs">
                                    {selectedAgent.logs && selectedAgent.logs.length > 0 ? (
                                        selectedAgent.logs.map((log, i) => (
                                            <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                                                <span className={`shrink-0 font-bold w-20 text-right uppercase tracking-wider scale-90 ${log.status === 'thinking' ? 'text-blue-400' :
                                                    log.status === 'action' ? 'text-amber-400' : 'text-emerald-400'
                                                    }`}>
                                                    [{log.step}]
                                                </span>
                                                <span className="text-slate-300">{log.detail}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-slate-600 italic text-center mt-12">
                                            Ready to initialize agent loop...
                                        </div>
                                    )}
                                    <div ref={logsEndRef} />
                                </div>

                                <div className="p-2 bg-slate-800 border-t border-slate-700 flex gap-2">
                                    <input
                                        value={runInput}
                                        onChange={(e) => setRunInput(e.target.value)}
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                                    />
                                    <button
                                        onClick={runAgentSimulation}
                                        disabled={isRunning}
                                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                    >
                                        <Play className="w-3 h-3" />
                                        Run
                                    </button>
                                </div>
                            </div>

                            {/* Creativity Slider */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-medium text-slate-700">Temperature / Creativity</label>
                                    <span className="text-sm text-slate-500">{selectedAgent.creativity}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={selectedAgent.creativity}
                                    onChange={(e) => {
                                        if (selectedAgent) {
                                            setSelectedAgent({ ...selectedAgent, creativity: parseInt(e.target.value) });
                                        }
                                    }}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <div className="flex justify-between mt-1 text-xs text-slate-400">
                                    <span>Precise</span>
                                    <span>Balanced</span>
                                    <span>Creative</span>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                            <button
                                onClick={() => setSelectedAgent(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => setSelectedAgent(null)}
                                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 transition-colors flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
