"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Sparkles } from "lucide-react";
import { useOpportunityStore } from "@/lib/store";

export default function NewOpportunityPage() {
    const router = useRouter();
    const { addOpportunity } = useOpportunityStore();
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        client: "",
        value: "",
        stage: "Discovery",
        description: "",
    });

    const handleAnalyze = () => {
        if (!formData.description) return;
        setIsAnalyzing(true);
        // Simulate AI analysis
        setTimeout(() => {
            setIsAnalyzing(false);
            // Simulate AI suggestions
            setFormData(prev => ({
                ...prev,
                value: "150000",
                stage: "Qualifying"
            }));
        }, 1500);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Add to global store
        addOpportunity({
            name: formData.name,
            client: formData.client,
            value: Number(formData.value) || 0,
            stage: formData.stage,
            probability: 20, // Default for new deals
            owner: "Dip Bagchi", // Current user
            description: formData.description
        });

        router.push("/dashboard/opportunities");
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">New Opportunity</h1>
                    <p className="text-slate-500">Create a new deal or ask AI to draft it from notes.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Form */}
                <div className="md:col-span-2 space-y-6">
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Opportunity Name</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                    placeholder="e.g., Enterprise License Expansion"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Client / Account</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Search client..."
                                    value={formData.client}
                                    onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Value</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-2 text-slate-400">$</span>
                                        <input
                                            type="number"
                                            className="w-full pl-8 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                            placeholder="0.00"
                                            value={formData.value}
                                            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Stage</label>
                                    <select
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                                        value={formData.stage}
                                        onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                                    >
                                        <option>Discovery</option>
                                        <option>Qualifying</option>
                                        <option>Proposal</option>
                                        <option>Negotiation</option>
                                        <option>Closed Won</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description / Notes</label>
                                <div className="relative">
                                    <textarea
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[120px]"
                                        placeholder="Paste meeting notes or email content here for AI analysis..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAnalyze}
                                        disabled={isAnalyzing || !formData.description}
                                        className="absolute right-3 bottom-3 p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                                        title="Analyze with AI"
                                    >
                                        <Sparkles className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : ""}`} />
                                    </button>
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                    Tip: Paste your raw meeting notes above and click the sparkle icon to auto-fill fields.
                                </p>
                            </div>
                        </div>

                        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="btn-ghost"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn-primary flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Create Opportunity
                            </button>
                        </div>
                    </form>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center mb-4">
                            <Sparkles className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h3 className="font-semibold text-indigo-900 mb-2">AI Assistant</h3>
                        <p className="text-sm text-indigo-700/80 leading-relaxed">
                            I can help you fill out this form. Just verify the client name and paste any rough notes you have. I'll predict the deal value and suggest the appropriate stage.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
