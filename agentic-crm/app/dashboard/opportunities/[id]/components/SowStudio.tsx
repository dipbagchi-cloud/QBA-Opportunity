"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { API_URL, getAuthHeaders } from "@/lib/api";
import {
    FileText, RefreshCw, Check, X, Lock, Unlock, Eye, Download,
    Sparkles, ChevronDown, ChevronRight, AlertTriangle, Clock,
    BarChart3, Send, Edit3, Save, Plus, Info, Zap, CheckCircle2,
    XCircle, Loader2, PanelLeftClose, PanelLeft
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface SowSection {
    id: string;
    sectionKey: string;
    title: string;
    sortOrder: number;
    sourceType: string;
    generatedContent: string | null;
    editedContent: string | null;
    finalContent: string | null;
    isLocked: boolean;
    isStale: boolean;
    staleReason: string | null;
    templateAnchor: string | null;
    contentVersion: number;
    lastEditedBy: string | null;
    lastEditedAt: string | null;
}

interface SowDocument {
    id: string;
    opportunityId: string;
    documentNumber: string;
    documentTitle: string;
    status: string;
    version: string;
    versionLabel: string | null;
    readinessScore: number;
    documentType: string | null;
    serviceCategory: string | null;
    deliveryModel: string | null;
    methodology: string | null;
    sections: SowSection[];
    approvals: any[];
    exports: any[];
    generationRuns: any[];
    versions: any[];
    createdBy: { id: string; name: string; email: string } | null;
    template: any;
    createdAt: string;
    updatedAt: string;
}

interface ReadinessData {
    score: number;
    totalPoints: number;
    earnedPoints: number;
    blockers: string[];
    warnings: string[];
    missingData: string[];
    staleWarnings: string[];
    breakdown: {
        opportunity: number;
        presales: number;
        commercial: number;
        sowSpecific: number;
    };
}

interface SowStudioProps {
    opportunityId: string;
}

// ============================================================================
// SOW STUDIO COMPONENT
// ============================================================================

export function SowStudio({ opportunityId }: SowStudioProps) {
    const [document, setDocument] = useState<SowDocument | null>(null);
    const [readiness, setReadiness] = useState<ReadinessData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState("");
    const [isSavingSection, setIsSavingSection] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewHtml, setPreviewHtml] = useState("");
    const [showOutline, setShowOutline] = useState(true);
    const [generatingSection, setGeneratingSection] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Create form
    const [createForm, setCreateForm] = useState({
        documentTitle: "",
        documentType: "Professional Services",
        serviceCategory: "",
        deliveryModel: "Onsite",
        methodology: "Agile",
    });

    const editorRef = useRef<HTMLTextAreaElement>(null);

    // ============================================================================
    // DATA FETCHING
    // ============================================================================

    const fetchDocument = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}/sow`, {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error("Failed to fetch SOW");
            const data = await res.json();
            setDocument(data.document);
            if (data.document?.sections?.length > 0 && !selectedSection) {
                setSelectedSection(data.document.sections[0].sectionKey);
            }
        } catch (err: any) {
            console.error("Failed to fetch SOW document:", err);
        }
    }, [opportunityId, selectedSection]);

    const fetchReadiness = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}/sow/readiness`, {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error("Failed to fetch readiness");
            const data = await res.json();
            setReadiness(data.readiness);
        } catch (err: any) {
            console.error("Failed to fetch readiness:", err);
        }
    }, [opportunityId]);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            await Promise.all([fetchDocument(), fetchReadiness()]);
            setIsLoading(false);
        };
        load();
    }, [fetchDocument, fetchReadiness]);

    // ============================================================================
    // ACTIONS
    // ============================================================================

    const handleCreate = async () => {
        setIsCreating(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}/sow`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(createForm),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create SOW");
            }
            const data = await res.json();
            setDocument(data.document);
            if (data.document?.sections?.length > 0) {
                setSelectedSection(data.document.sections[0].sectionKey);
            }
            await fetchReadiness();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleGenerate = async () => {
        if (!document) return;
        setIsGenerating(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}/sow/generate`, {
                method: "POST",
                headers: getAuthHeaders(),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Generation failed");
            }
            await fetchDocument();
            await fetchReadiness();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRegenerateSection = async (sectionKey: string) => {
        setGeneratingSection(sectionKey);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}/sow/sections/${sectionKey}/regenerate`, {
                method: "POST",
                headers: getAuthHeaders(),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Regeneration failed");
            }
            await fetchDocument();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setGeneratingSection(null);
        }
    };

    const handleSaveSection = async () => {
        if (!selectedSection) return;
        setIsSavingSection(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}/sow/sections/${selectedSection}`, {
                method: "PATCH",
                headers: getAuthHeaders(),
                body: JSON.stringify({ editedContent: editingContent }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save");
            }
            await fetchDocument();
            setIsEditMode(false);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSavingSection(false);
        }
    };

    const handleToggleLock = async (sectionKey: string, locked: boolean) => {
        try {
            await fetch(`${API_URL}/api/opportunities/${opportunityId}/sow/sections/${sectionKey}/lock`, {
                method: "PATCH",
                headers: getAuthHeaders(),
                body: JSON.stringify({ locked }),
            });
            await fetchDocument();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleExportDocx = async () => {
        setIsExporting(true);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}/sow/export/docx`, {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error("Export failed");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = window.document.createElement("a");
            a.href = url;
            a.download = `${document?.documentNumber || "SOW"}.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
            await fetchDocument();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsExporting(false);
        }
    };

    const handlePreview = async () => {
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}/sow/preview`, {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error("Preview failed");
            const data = await res.json();
            setPreviewHtml(data.html);
            setShowPreview(true);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleSubmitForReview = async () => {
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}/sow/submit-review`, {
                method: "POST",
                headers: getAuthHeaders(),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to submit");
            }
            await fetchDocument();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleCreateVersion = async () => {
        const label = prompt("Version label (e.g., 'Client Review Draft'):");
        if (!label) return;
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}/sow/versions`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    version: incrementVersion(document?.version || "0.1"),
                    versionLabel: label,
                    changeNotes: `Version created: ${label}`,
                }),
            });
            if (!res.ok) throw new Error("Failed to create version");
            await fetchDocument();
        } catch (err: any) {
            setError(err.message);
        }
    };

    // ============================================================================
    // HELPERS
    // ============================================================================

    const getSelectedSectionData = (): SowSection | null => {
        if (!document || !selectedSection) return null;
        return document.sections.find(s => s.sectionKey === selectedSection) || null;
    };

    const getDisplayContent = (section: SowSection): string => {
        return section.finalContent || section.editedContent || section.generatedContent || "";
    };

    const getSectionStatusIcon = (section: SowSection) => {
        if (section.isLocked) return <Lock className="w-3 h-3 text-amber-500" />;
        if (section.isStale) return <AlertTriangle className="w-3 h-3 text-orange-500" />;
        if (section.finalContent || section.editedContent) return <CheckCircle2 className="w-3 h-3 text-emerald-500" />;
        if (section.generatedContent) return <Sparkles className="w-3 h-3 text-blue-500" />;
        return <div className="w-3 h-3 rounded-full border-2 border-slate-300" />;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Not Started": return "bg-slate-100 text-slate-600";
            case "AI Generated": return "bg-blue-100 text-blue-700";
            case "Drafting": return "bg-amber-100 text-amber-700";
            case "In Review": return "bg-purple-100 text-purple-700";
            case "Approved": return "bg-emerald-100 text-emerald-700";
            case "Final": return "bg-emerald-600 text-white";
            default: return "bg-slate-100 text-slate-600";
        }
    };

    const getReadinessColor = (score: number) => {
        if (score >= 80) return "text-emerald-600";
        if (score >= 50) return "text-amber-600";
        return "text-red-600";
    };

    const getReadinessBarColor = (score: number) => {
        if (score >= 80) return "bg-emerald-500";
        if (score >= 50) return "bg-amber-500";
        return "bg-red-500";
    };

    const incrementVersion = (ver: string) => {
        const parts = ver.split(".");
        const minor = parseInt(parts[1] || "0") + 1;
        return `${parts[0]}.${minor}`;
    };

    const sectionsWithContent = document?.sections?.filter(s => s.finalContent || s.editedContent || s.generatedContent) || [];
    const totalSections = document?.sections?.length || 0;
    const completionPct = totalSections > 0 ? Math.round((sectionsWithContent.length / totalSections) * 100) : 0;

    // ============================================================================
    // LOADING STATE
    // ============================================================================

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mr-2" />
                <span className="text-sm text-slate-500">Loading SOW Studio...</span>
            </div>
        );
    }

    // ============================================================================
    // CREATE STATE — No document yet
    // ============================================================================

    if (!document) {
        return (
            <div className="space-y-4 animate-in fade-in duration-300">
                {/* Readiness overview */}
                {readiness && (
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <BarChart3 className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-sm font-bold text-slate-800">SOW Readiness Assessment</h3>
                            <span className={`text-lg font-bold ${getReadinessColor(readiness.score)}`}>{readiness.score}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                            <div className={`h-full rounded-full transition-all ${getReadinessBarColor(readiness.score)}`}
                                style={{ width: `${readiness.score}%` }} />
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                            {Object.entries(readiness.breakdown).map(([key, val]) => (
                                <div key={key} className="bg-slate-50 rounded p-2 text-center">
                                    <div className="font-medium text-slate-600 capitalize mb-1">{key.replace(/([A-Z])/g, " $1").trim()}</div>
                                    <div className={`font-bold ${getReadinessColor(val)}`}>{val}%</div>
                                </div>
                            ))}
                        </div>
                        {readiness.blockers.length > 0 && (
                            <div className="mt-3 p-2 bg-red-50 rounded border border-red-100">
                                <p className="text-xs font-bold text-red-700 mb-1">Blockers:</p>
                                {readiness.blockers.map((b, i) => (
                                    <p key={i} className="text-xs text-red-600">• {b}</p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Create form */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <FileText className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Initialize SOW Document</h2>
                            <p className="text-xs text-slate-500">Set up the document metadata to create sections and begin drafting.</p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
                            <XCircle className="w-4 h-4" /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Document Title</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                                placeholder="SOW - Project Name"
                                value={createForm.documentTitle}
                                onChange={(e) => setCreateForm(prev => ({ ...prev, documentTitle: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Document Type</label>
                            <select
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                                value={createForm.documentType}
                                onChange={(e) => setCreateForm(prev => ({ ...prev, documentType: e.target.value }))}
                            >
                                <option>Professional Services</option>
                                <option>Managed Services</option>
                                <option>Staff Augmentation</option>
                                <option>Fixed Bid</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Service Category</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                                placeholder="e.g., Custom Development"
                                value={createForm.serviceCategory}
                                onChange={(e) => setCreateForm(prev => ({ ...prev, serviceCategory: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Delivery Model</label>
                            <select
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                                value={createForm.deliveryModel}
                                onChange={(e) => setCreateForm(prev => ({ ...prev, deliveryModel: e.target.value }))}
                            >
                                <option>Onsite</option>
                                <option>Offshore</option>
                                <option>Hybrid</option>
                                <option>Remote</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Methodology</label>
                            <select
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                                value={createForm.methodology}
                                onChange={(e) => setCreateForm(prev => ({ ...prev, methodology: e.target.value }))}
                            >
                                <option>Agile</option>
                                <option>Waterfall</option>
                                <option>Hybrid</option>
                                <option>SAFe</option>
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleCreate}
                        disabled={isCreating}
                        className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isCreating ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                        ) : (
                            <><Plus className="w-4 h-4" /> Create SOW Document</>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // ============================================================================
    // MAIN STUDIO VIEW
    // ============================================================================

    const currentSection = getSelectedSectionData();

    return (
        <div className="space-y-3 animate-in fade-in duration-300">
            {/* Error banner */}
            {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
                    <div className="flex items-center gap-2"><XCircle className="w-4 h-4" /> {error}</div>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            {/* ── TOP SUMMARY BAR ── */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Status badge */}
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(document.status)}`}>
                        {document.status}
                    </span>

                    {/* Version */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>v{document.version}</span>
                        {document.versionLabel && <span className="text-slate-400">({document.versionLabel})</span>}
                    </div>

                    {/* Readiness */}
                    {readiness && (
                        <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${getReadinessBarColor(readiness.score)}`}
                                    style={{ width: `${readiness.score}%` }} />
                            </div>
                            <span className={`text-xs font-bold ${getReadinessColor(readiness.score)}`}>
                                {readiness.score}% ready
                            </span>
                        </div>
                    )}

                    {/* Completion */}
                    <span className="text-xs text-slate-500">
                        {sectionsWithContent.length}/{totalSections} sections
                    </span>

                    {/* Doc number */}
                    <span className="text-xs text-slate-400 font-mono">{document.documentNumber}</span>

                    {/* Spacer + actions */}
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                        >
                            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {isGenerating ? "Generating..." : "AI Generate All"}
                        </button>
                        <button
                            onClick={handlePreview}
                            className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50 flex items-center gap-1.5"
                        >
                            <Eye className="w-3.5 h-3.5" /> Preview
                        </button>
                        <button
                            onClick={handleExportDocx}
                            disabled={isExporting}
                            className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50 flex items-center gap-1.5"
                        >
                            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            DOCX
                        </button>
                        <button
                            onClick={handleCreateVersion}
                            className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50 flex items-center gap-1.5"
                        >
                            <Plus className="w-3.5 h-3.5" /> Version
                        </button>
                            {document.status === "Drafting" && (
                            <button
                                onClick={handleSubmitForReview}
                                className="px-3 py-1.5 bg-purple-600 text-white rounded-md text-xs font-medium hover:bg-purple-700 flex items-center gap-1.5"
                            >
                                <Send className="w-3.5 h-3.5" /> Submit for Review
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── THREE-PANEL LAYOUT ── */}
            <div className="flex gap-3" style={{ minHeight: "calc(100vh - 350px)" }}>
                {/* LEFT — Section Outline */}
                {showOutline && (
                    <div className="w-64 flex-shrink-0 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col">
                        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Sections</h3>
                            <button onClick={() => setShowOutline(false)} className="text-slate-400 hover:text-slate-600">
                                <PanelLeftClose className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto py-1">
                            {document.sections.map((section) => {
                                const isSelected = section.sectionKey === selectedSection;
                                const hasContent = !!(section.finalContent || section.editedContent || section.generatedContent);
                                return (
                                    <button
                                        key={section.sectionKey}
                                        onClick={() => {
                                            setSelectedSection(section.sectionKey);
                                            setIsEditMode(false);
                                        }}
                                        className={`w-full px-3 py-2 text-left flex items-center gap-2 text-xs transition-colors
                                            ${isSelected ? "bg-indigo-50 border-r-2 border-indigo-600 text-indigo-800 font-semibold" : "hover:bg-slate-50 text-slate-600"}`}
                                    >
                                        {getSectionStatusIcon(section)}
                                        <span className={`flex-1 truncate ${!hasContent ? "italic text-slate-400" : ""}`}>
                                            {section.title}
                                        </span>
                                        {section.isStale && <AlertTriangle className="w-3 h-3 text-orange-400 flex-shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Section stats */}
                        <div className="px-3 py-2 border-t border-slate-100 text-xs text-slate-400">
                            <div className="flex justify-between">
                                <span>Completed</span>
                                <span className="font-medium">{completionPct}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${completionPct}%` }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* CENTER — Section Editor */}
                <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col min-w-0">
                    {!showOutline && (
                        <button
                            onClick={() => setShowOutline(true)}
                            className="absolute left-1 top-1 z-10 p-1.5 bg-white border border-slate-200 rounded shadow-sm text-slate-400 hover:text-slate-600"
                        >
                            <PanelLeft className="w-4 h-4" />
                        </button>
                    )}
                    {currentSection ? (
                        <>
                            {/* Section header */}
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-slate-800">{currentSection.title}</h3>
                                    <span className="text-xs text-slate-400 font-mono">({currentSection.sectionKey})</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                        currentSection.sourceType === "ai" ? "bg-blue-50 text-blue-600" :
                                        currentSection.sourceType === "static" ? "bg-slate-50 text-slate-500" :
                                        currentSection.sourceType === "dynamic" ? "bg-green-50 text-green-600" :
                                        "bg-purple-50 text-purple-600"
                                    }`}>
                                        {currentSection.sourceType}
                                    </span>
                                    {currentSection.isStale && (
                                        <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-[10px] font-medium flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> Stale
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => handleToggleLock(currentSection.sectionKey, !currentSection.isLocked)}
                                        className={`p-1.5 rounded text-xs ${currentSection.isLocked ? "bg-amber-50 text-amber-600" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"}`}
                                        title={currentSection.isLocked ? "Unlock section" : "Lock section"}
                                    >
                                        {currentSection.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                    </button>
                                    <button
                                        onClick={() => handleRegenerateSection(currentSection.sectionKey)}
                                        disabled={!!generatingSection || currentSection.isLocked}
                                        className="p-1.5 rounded text-slate-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30"
                                        title="AI Regenerate"
                                    >
                                        {generatingSection === currentSection.sectionKey ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                    {!isEditMode ? (
                                        <button
                                            onClick={() => {
                                                setIsEditMode(true);
                                                setEditingContent(getDisplayContent(currentSection));
                                            }}
                                            disabled={currentSection.isLocked}
                                            className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-200 disabled:opacity-30 flex items-center gap-1"
                                        >
                                            <Edit3 className="w-3 h-3" /> Edit
                                        </button>
                                    ) : (
                                        <div className="flex gap-1">
                                            <button
                                                onClick={handleSaveSection}
                                                disabled={isSavingSection}
                                                className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                                            >
                                                {isSavingSection ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setIsEditMode(false)}
                                                className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-200"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section content */}
                            <div className="flex-1 overflow-y-auto p-4">
                                {isEditMode ? (
                                    <textarea
                                        ref={editorRef}
                                        className="w-full h-full min-h-[300px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300"
                                        value={editingContent}
                                        onChange={(e) => setEditingContent(e.target.value)}
                                    />
                                ) : (
                                    <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed">
                                        {getDisplayContent(currentSection) ? (
                                            <div className="whitespace-pre-wrap">{getDisplayContent(currentSection)}</div>
                                        ) : (
                                            <div className="text-center py-12 text-slate-400">
                                                <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
                                                <p className="text-sm mb-2">No content generated yet</p>
                                                <p className="text-xs">Click &quot;AI Generate All&quot; or use the regenerate button to create content for this section.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Section footer */}
                            <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                                <span>Version {currentSection.contentVersion}</span>
                                {currentSection.lastEditedAt && (
                                    <span>Last edited: {new Date(currentSection.lastEditedAt).toLocaleString()}</span>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">
                            <div className="text-center">
                                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Select a section from the outline</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT — Info Panel */}
                <div className="w-72 flex-shrink-0 space-y-3">
                    {/* Readiness card */}
                    {readiness && (
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <BarChart3 className="w-4 h-4 text-indigo-600" />
                                <h4 className="text-xs font-bold text-slate-700">Readiness</h4>
                                <span className={`ml-auto text-sm font-bold ${getReadinessColor(readiness.score)}`}>{readiness.score}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full mb-2 overflow-hidden">
                                <div className={`h-full rounded-full ${getReadinessBarColor(readiness.score)}`}
                                    style={{ width: `${readiness.score}%` }} />
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {Object.entries(readiness.breakdown).map(([key, val]) => (
                                    <div key={key} className="text-center py-1 bg-slate-50 rounded">
                                        <div className="text-[10px] text-slate-500 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</div>
                                        <div className={`text-xs font-bold ${getReadinessColor(val)}`}>{val}%</div>
                                    </div>
                                ))}
                            </div>
                            {readiness.blockers.length > 0 && (
                                <div className="mt-2 text-[10px] text-red-600">
                                    {readiness.blockers.slice(0, 3).map((b, i) => (
                                        <p key={i} className="flex items-start gap-1"><XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" /> {b}</p>
                                    ))}
                                </div>
                            )}
                            {readiness.warnings.length > 0 && (
                                <div className="mt-1 text-[10px] text-amber-600">
                                    {readiness.warnings.slice(0, 3).map((w, i) => (
                                        <p key={i} className="flex items-start gap-1"><AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" /> {w}</p>
                                    ))}
                                </div>
                            )}
                            <button onClick={fetchReadiness}
                                className="mt-2 w-full py-1 text-[10px] text-indigo-600 hover:bg-indigo-50 rounded font-medium flex items-center justify-center gap-1">
                                <RefreshCw className="w-3 h-3" /> Refresh
                            </button>
                        </div>
                    )}

                    {/* Document info */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
                        <h4 className="text-xs font-bold text-slate-700 mb-2">Document Info</h4>
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-medium text-slate-700">{document.documentType || "—"}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Delivery</span><span className="font-medium text-slate-700">{document.deliveryModel || "—"}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="font-medium text-slate-700">{document.methodology || "—"}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Category</span><span className="font-medium text-slate-700">{document.serviceCategory || "—"}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Created by</span><span className="font-medium text-slate-700">{document.createdBy?.name || "—"}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Created</span><span className="font-medium text-slate-700">{new Date(document.createdAt).toLocaleDateString()}</span></div>
                        </div>
                    </div>

                    {/* Version history */}
                    {document.versions.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
                            <h4 className="text-xs font-bold text-slate-700 mb-2">Versions</h4>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {document.versions.map((ver: any) => (
                                    <div key={ver.id} className="flex items-center gap-2 text-xs">
                                        <span className="font-mono text-indigo-600">v{ver.version}</span>
                                        <span className="text-slate-500 truncate flex-1">{ver.versionLabel}</span>
                                        <span className="text-slate-400 text-[10px]">{new Date(ver.createdAt).toLocaleDateString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Approvals */}
                    {document.approvals.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
                            <h4 className="text-xs font-bold text-slate-700 mb-2">Approvals</h4>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {document.approvals.map((appr: any) => (
                                    <div key={appr.id} className="flex items-center gap-2 text-xs">
                                        <span className={`w-2 h-2 rounded-full ${
                                            appr.status === "Approved" ? "bg-emerald-500" :
                                            appr.status === "Rejected" ? "bg-red-500" :
                                            "bg-amber-500"
                                        }`} />
                                        <span className="text-slate-600 truncate flex-1">{appr.stepType}</span>
                                        <span className={`text-[10px] font-medium ${
                                            appr.status === "Approved" ? "text-emerald-600" :
                                            appr.status === "Rejected" ? "text-red-600" :
                                            "text-amber-600"
                                        }`}>{appr.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent generation runs */}
                    {document.generationRuns.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
                            <h4 className="text-xs font-bold text-slate-700 mb-2">Generation History</h4>
                            <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                {document.generationRuns.slice(0, 5).map((run: any) => (
                                    <div key={run.id} className="flex items-center gap-2 text-xs">
                                        <Sparkles className="w-3 h-3 text-blue-400" />
                                        <span className="text-slate-600 truncate flex-1">{run.runType}{run.sectionKey ? `: ${run.sectionKey}` : ""}</span>
                                        <span className={`text-[10px] font-medium ${run.status === "completed" ? "text-emerald-600" : run.status === "failed" ? "text-red-600" : "text-amber-600"}`}>
                                            {run.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── PREVIEW MODAL ── */}
            {showPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                            <h3 className="text-sm font-bold text-slate-800">SOW Preview — {document.documentTitle}</h3>
                            <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="max-w-3xl mx-auto prose prose-sm" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
