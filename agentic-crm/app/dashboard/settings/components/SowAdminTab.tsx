"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_URL, getAuthHeaders } from "@/lib/api";
import {
    FileText, Plus, Trash2, Edit3, Save, X, Download, Upload,
    RefreshCw, Loader2, ChevronDown, ChevronRight, Check,
    AlertTriangle, Hash, BookOpen, Shield, Settings2, ListOrdered
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type SowAdminTab = "templates" | "metadata" | "static-content" | "clauses" | "section-rules" | "approval-config" | "numbering";

// ============================================================================
// MAIN SOW ADMIN COMPONENT
// ============================================================================

export function SowAdminTab() {
    const [subTab, setSubTab] = useState<SowAdminTab>("section-rules");

    const subTabs: { key: SowAdminTab; label: string; icon: any }[] = [
        { key: "section-rules", label: "Section Rules", icon: ListOrdered },
        { key: "templates", label: "Templates", icon: FileText },
        { key: "metadata", label: "Metadata", icon: BookOpen },
        { key: "static-content", label: "Static Content", icon: FileText },
        { key: "clauses", label: "Clause Library", icon: Shield },
        { key: "approval-config", label: "Approval Config", icon: Check },
        { key: "numbering", label: "Numbering", icon: Hash },
    ];

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-base font-bold text-slate-900">SOW Administration</h3>
                <p className="text-xs text-slate-500 mt-0.5">Manage templates, sections, metadata, and approval workflows for SOW generation.</p>
            </div>

            {/* Sub-tab navigation */}
            <div className="flex flex-wrap gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                {subTabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setSubTab(t.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            subTab === t.key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                        <t.icon className="w-3.5 h-3.5" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Sub-tab content */}
            {subTab === "section-rules" && <SectionRulesPanel />}
            {subTab === "templates" && <TemplatesPanel />}
            {subTab === "metadata" && <MetadataPanel />}
            {subTab === "static-content" && <StaticContentPanel />}
            {subTab === "clauses" && <ClausesPanel />}
            {subTab === "approval-config" && <ApprovalConfigPanel />}
            {subTab === "numbering" && <NumberingPanel />}
        </div>
    );
}

// ============================================================================
// SECTION RULES PANEL
// ============================================================================

function SectionRulesPanel() {
    const [rules, setRules] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ sectionKey: "", title: "", sortOrder: 0, sourceType: "ai", templateAnchor: "", isLocked: false, isMandatory: true });
    const [showAdd, setShowAdd] = useState(false);

    const fetchRules = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/sow/section-rules`, { headers: getAuthHeaders() });
            if (res.ok) { const d = await res.json(); setRules(d.rules || []); }
        } catch {} finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchRules(); }, [fetchRules]);

    const handleSave = async () => {
        const method = editingId ? "PATCH" : "POST";
        const url = editingId ? `${API_URL}/api/admin/sow/section-rules/${editingId}` : `${API_URL}/api/admin/sow/section-rules`;
        try {
            const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(form) });
            if (res.ok) { await fetchRules(); setEditingId(null); setShowAdd(false); resetForm(); }
        } catch {}
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this section rule?")) return;
        await fetch(`${API_URL}/api/admin/sow/section-rules/${id}`, { method: "DELETE", headers: getAuthHeaders() });
        await fetchRules();
    };

    const startEdit = (rule: any) => {
        setEditingId(rule.id);
        setForm({ sectionKey: rule.sectionKey, title: rule.title, sortOrder: rule.sortOrder, sourceType: rule.sourceType, templateAnchor: rule.templateAnchor || "", isLocked: rule.isLocked, isMandatory: rule.isMandatory });
        setShowAdd(true);
    };

    const resetForm = () => setForm({ sectionKey: "", title: "", sortOrder: 0, sourceType: "ai", templateAnchor: "", isLocked: false, isMandatory: true });

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">Section Rules ({rules.length})</h4>
                <div className="flex gap-2">
                    <button onClick={fetchRules} className="text-slate-400 hover:text-slate-600"><RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /></button>
                    <button onClick={() => { setShowAdd(!showAdd); setEditingId(null); resetForm(); }} className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add Rule
                    </button>
                </div>
            </div>

            {showAdd && (
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        <input placeholder="Section Key" className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={form.sectionKey} onChange={e => setForm(p => ({ ...p, sectionKey: e.target.value }))} />
                        <input placeholder="Title" className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                        <input type="number" placeholder="Sort Order" className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={form.sortOrder} onChange={e => setForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                        <select className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={form.sourceType} onChange={e => setForm(p => ({ ...p, sourceType: e.target.value }))}>
                            <option value="ai">AI</option><option value="static">Static</option><option value="dynamic">Dynamic</option><option value="hybrid">Hybrid</option>
                        </select>
                        <input placeholder="Template Anchor" className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={form.templateAnchor} onChange={e => setForm(p => ({ ...p, templateAnchor: e.target.value }))} />
                        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={form.isLocked} onChange={e => setForm(p => ({ ...p, isLocked: e.target.checked }))} /> Locked</label>
                        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={form.isMandatory} onChange={e => setForm(p => ({ ...p, isMandatory: e.target.checked }))} /> Mandatory</label>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSave} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 flex items-center gap-1"><Save className="w-3 h-3" /> {editingId ? "Update" : "Save"}</button>
                        <button onClick={() => { setShowAdd(false); setEditingId(null); resetForm(); }} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200">Cancel</button>
                    </div>
                </div>
            )}

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {isLoading ? (
                    <div className="px-4 py-8 text-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading...</div>
                ) : rules.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400 text-sm">No section rules defined.</div>
                ) : rules.map(rule => (
                    <div key={rule.id} className="px-4 py-2 flex items-center gap-3 hover:bg-slate-50 text-xs">
                        <span className="w-8 text-center font-mono text-slate-400">{rule.sortOrder}</span>
                        <span className="font-medium text-slate-800 w-40 truncate">{rule.title}</span>
                        <span className="font-mono text-slate-400 w-36 truncate">{rule.sectionKey}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            rule.sourceType === "ai" ? "bg-blue-50 text-blue-600" :
                            rule.sourceType === "static" ? "bg-slate-100 text-slate-500" :
                            rule.sourceType === "dynamic" ? "bg-green-50 text-green-600" :
                            "bg-purple-50 text-purple-600"
                        }`}>{rule.sourceType}</span>
                        {rule.isLocked && <span className="text-amber-500" title="Locked"><Shield className="w-3 h-3" /></span>}
                        {rule.isMandatory && <span className="text-emerald-500" title="Mandatory"><Check className="w-3 h-3" /></span>}
                        <div className="ml-auto flex gap-1">
                            <button onClick={() => startEdit(rule)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit3 className="w-3 h-3" /></button>
                            <button onClick={() => handleDelete(rule.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// TEMPLATES PANEL
// ============================================================================

function TemplatesPanel() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showUpload, setShowUpload] = useState(false);
    const [uploadForm, setUploadForm] = useState({ name: "", code: "", description: "", version: "1.0", isDefault: false });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const fetchTemplates = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/sow/templates`, { headers: getAuthHeaders() });
            if (res.ok) { const d = await res.json(); setTemplates(d.templates || []); }
        } catch {} finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    const handleUpload = async () => {
        if (!selectedFile || !uploadForm.name || !uploadForm.code) {
            setUploadError("Name, Code and File are all required.");
            return;
        }
        setIsUploading(true);
        setUploadError(null);
        try {
            const formData = new FormData();
            formData.append("templateFile", selectedFile);
            Object.entries(uploadForm).forEach(([k, v]) => formData.append(k, String(v)));
            const token = localStorage.getItem("auth_token");
            const res = await fetch(`${API_URL}/api/admin/sow/templates`, {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            });
            if (res.ok) {
                await fetchTemplates();
                setShowUpload(false);
                setSelectedFile(null);
                setUploadForm({ name: "", code: "", description: "", version: "1.0", isDefault: false });
            } else {
                const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                setUploadError(errData.error || `Upload failed (${res.status})`);
            }
        } catch (err: any) {
            setUploadError(err.message || "Upload failed");
        } finally { setIsUploading(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this template?")) return;
        await fetch(`${API_URL}/api/admin/sow/templates/${id}`, { method: "DELETE", headers: getAuthHeaders() });
        await fetchTemplates();
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">DOCX Templates ({templates.length})</h4>
                <button onClick={() => setShowUpload(!showUpload)} className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Upload Template
                </button>
            </div>

            {showUpload && (
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 space-y-2">
                    {uploadError && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {uploadError}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Template Name *" className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={uploadForm.name} onChange={e => setUploadForm(p => ({ ...p, name: e.target.value }))} />
                        <input placeholder="Template Code *" className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={uploadForm.code} onChange={e => setUploadForm(p => ({ ...p, code: e.target.value }))} />
                    </div>
                    <input placeholder="Description" className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs" value={uploadForm.description} onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))} />
                    <div className="flex items-center gap-3">
                        <input type="file" accept=".docx,.doc" className="text-xs" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={uploadForm.isDefault} onChange={e => setUploadForm(p => ({ ...p, isDefault: e.target.checked }))} /> Default</label>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleUpload} disabled={isUploading || !selectedFile} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium disabled:opacity-50 flex items-center gap-1">
                            {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Upload
                        </button>
                        <button onClick={() => setShowUpload(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200">Cancel</button>
                    </div>
                </div>
            )}

            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                {isLoading ? (
                    <div className="px-4 py-8 text-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading...</div>
                ) : templates.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400 text-sm">No templates uploaded yet.</div>
                ) : templates.map(t => (
                    <div key={t.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 text-xs">
                        <FileText className="w-4 h-4 text-indigo-500" />
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800">{t.name} <span className="text-slate-400 font-mono">({t.code})</span></div>
                            {t.description && <div className="text-slate-400 truncate">{t.description}</div>}
                        </div>
                        <span className="text-slate-400">v{t.version}</span>
                        {t.isDefault && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-medium">Default</span>}
                        <span className="text-slate-400">{t._count?.documents || 0} docs</span>
                        <button onClick={() => handleDelete(t.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// METADATA PANEL
// ============================================================================

function MetadataPanel() {
    const [categories, setCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [catForm, setCatForm] = useState({ categoryKey: "", label: "", description: "" });
    const [valForm, setValForm] = useState({ value: "", label: "", isDefault: false });

    const fetchCategories = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/sow/metadata`, { headers: getAuthHeaders() });
            if (res.ok) { const d = await res.json(); setCategories(d.categories || []); }
        } catch {} finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchCategories(); }, [fetchCategories]);

    const handleAddCategory = async () => {
        if (!catForm.categoryKey || !catForm.label) return;
        await fetch(`${API_URL}/api/admin/sow/metadata`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(catForm) });
        await fetchCategories();
        setShowAdd(false);
        setCatForm({ categoryKey: "", label: "", description: "" });
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm("Delete this metadata category and all its values?")) return;
        await fetch(`${API_URL}/api/admin/sow/metadata/${id}`, { method: "DELETE", headers: getAuthHeaders() });
        await fetchCategories();
    };

    const handleAddValue = async (categoryId: string) => {
        if (!valForm.value || !valForm.label) return;
        await fetch(`${API_URL}/api/admin/sow/metadata/${categoryId}/values`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(valForm) });
        await fetchCategories();
        setValForm({ value: "", label: "", isDefault: false });
    };

    const handleDeleteValue = async (id: string) => {
        await fetch(`${API_URL}/api/admin/sow/metadata/values/${id}`, { method: "DELETE", headers: getAuthHeaders() });
        await fetchCategories();
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">Metadata Categories ({categories.length})</h4>
                <button onClick={() => setShowAdd(!showAdd)} className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Category
                </button>
            </div>

            {showAdd && (
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        <input placeholder="Category Key" className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={catForm.categoryKey} onChange={e => setCatForm(p => ({ ...p, categoryKey: e.target.value }))} />
                        <input placeholder="Label" className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={catForm.label} onChange={e => setCatForm(p => ({ ...p, label: e.target.value }))} />
                        <input placeholder="Description" className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={catForm.description} onChange={e => setCatForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleAddCategory} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium"><Save className="w-3 h-3 inline mr-1" />Save</button>
                        <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded text-xs">Cancel</button>
                    </div>
                </div>
            )}

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {isLoading ? (
                    <div className="px-4 py-8 text-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading...</div>
                ) : categories.map(cat => (
                    <div key={cat.id}>
                        <div className="px-4 py-2 flex items-center gap-2 hover:bg-slate-50 cursor-pointer text-xs" onClick={() => setExpanded(expanded === cat.id ? null : cat.id)}>
                            {expanded === cat.id ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                            <span className="font-medium text-slate-800">{cat.label}</span>
                            <span className="font-mono text-slate-400">{cat.categoryKey}</span>
                            <span className="text-slate-400 ml-auto">{cat.values?.length || 0} values</span>
                            <button onClick={e => { e.stopPropagation(); handleDeleteCategory(cat.id); }} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                        </div>
                        {expanded === cat.id && (
                            <div className="bg-slate-50 px-4 py-2 border-t border-slate-100">
                                {cat.values?.map((v: any) => (
                                    <div key={v.id} className="flex items-center gap-2 py-1 text-xs">
                                        <span className="text-slate-400 w-4">•</span>
                                        <span className="text-slate-700">{v.label}</span>
                                        <span className="font-mono text-slate-400">{v.value}</span>
                                        {v.isDefault && <span className="text-emerald-500 text-[10px]">default</span>}
                                        <button onClick={() => handleDeleteValue(v.id)} className="ml-auto p-0.5 text-slate-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                                    </div>
                                ))}
                                <div className="flex gap-2 mt-2 pt-2 border-t border-slate-200">
                                    <input placeholder="Value" className="px-2 py-1 border border-slate-300 rounded text-xs w-28" value={valForm.value} onChange={e => setValForm(p => ({ ...p, value: e.target.value }))} />
                                    <input placeholder="Label" className="px-2 py-1 border border-slate-300 rounded text-xs w-28" value={valForm.label} onChange={e => setValForm(p => ({ ...p, label: e.target.value }))} />
                                    <button onClick={() => handleAddValue(cat.id)} className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-medium"><Plus className="w-3 h-3 inline" /> Add</button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// STATIC CONTENT PANEL
// ============================================================================

function StaticContentPanel() {
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ contentKey: "", title: "", body: "", version: "1.0", isApproved: true });

    const fetchItems = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/sow/static-content`, { headers: getAuthHeaders() });
            if (res.ok) { const d = await res.json(); setItems(d.items || []); }
        } catch {} finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    const handleSave = async () => {
        const method = editingId ? "PATCH" : "POST";
        const url = editingId ? `${API_URL}/api/admin/sow/static-content/${editingId}` : `${API_URL}/api/admin/sow/static-content`;
        await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(form) });
        await fetchItems();
        setShowAdd(false);
        setEditingId(null);
        setForm({ contentKey: "", title: "", body: "", version: "1.0", isApproved: true });
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this static content?")) return;
        await fetch(`${API_URL}/api/admin/sow/static-content/${id}`, { method: "DELETE", headers: getAuthHeaders() });
        await fetchItems();
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">Static Content ({items.length})</h4>
                <button onClick={() => { setShowAdd(!showAdd); setEditingId(null); setForm({ contentKey: "", title: "", body: "", version: "1.0", isApproved: true }); }} className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Content
                </button>
            </div>

            {showAdd && (
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Content Key" className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={form.contentKey} onChange={e => setForm(p => ({ ...p, contentKey: e.target.value }))} />
                        <input placeholder="Title" className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                    </div>
                    <textarea placeholder="Content body..." className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs min-h-[100px] font-mono" value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} />
                    <div className="flex gap-2">
                        <button onClick={handleSave} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium"><Save className="w-3 h-3 inline mr-1" />{editingId ? "Update" : "Save"}</button>
                        <button onClick={() => { setShowAdd(false); setEditingId(null); }} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded text-xs">Cancel</button>
                    </div>
                </div>
            )}

            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                {isLoading ? (
                    <div className="px-4 py-8 text-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading...</div>
                ) : items.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400 text-sm">No static content defined.</div>
                ) : items.map(item => (
                    <div key={item.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 text-xs">
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800">{item.title} <span className="font-mono text-slate-400">({item.contentKey})</span></div>
                            <div className="text-slate-400 truncate">{item.body?.substring(0, 80)}...</div>
                        </div>
                        {item.isApproved && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px]">Approved</span>}
                        <button onClick={() => { setEditingId(item.id); setForm({ contentKey: item.contentKey, title: item.title, body: item.body, version: item.version || "1.0", isApproved: item.isApproved }); setShowAdd(true); }} className="p-1 text-slate-400 hover:text-indigo-600"><Edit3 className="w-3 h-3" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// CLAUSES PANEL
// ============================================================================

function ClausesPanel() {
    const [clauses, setClauses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ clauseKey: "", title: "", body: "", category: "", isDefault: false, isLegalApproved: false });

    const fetchClauses = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/sow/clauses`, { headers: getAuthHeaders() });
            if (res.ok) { const d = await res.json(); setClauses(d.clauses || []); }
        } catch {} finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchClauses(); }, [fetchClauses]);

    const handleSave = async () => {
        const method = editingId ? "PATCH" : "POST";
        const url = editingId ? `${API_URL}/api/admin/sow/clauses/${editingId}` : `${API_URL}/api/admin/sow/clauses`;
        await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(form) });
        await fetchClauses();
        setShowAdd(false);
        setEditingId(null);
        setForm({ clauseKey: "", title: "", body: "", category: "", isDefault: false, isLegalApproved: false });
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this clause?")) return;
        await fetch(`${API_URL}/api/admin/sow/clauses/${id}`, { method: "DELETE", headers: getAuthHeaders() });
        await fetchClauses();
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">Clause Library ({clauses.length})</h4>
                <button onClick={() => { setShowAdd(!showAdd); setEditingId(null); setForm({ clauseKey: "", title: "", body: "", category: "", isDefault: false, isLegalApproved: false }); }} className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Clause
                </button>
            </div>

            {showAdd && (
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                        <input placeholder="Clause Key" className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={form.clauseKey} onChange={e => setForm(p => ({ ...p, clauseKey: e.target.value }))} />
                        <input placeholder="Title" className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                        <input placeholder="Category" className="px-2 py-1.5 border border-slate-300 rounded text-xs" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
                    </div>
                    <textarea placeholder="Clause body..." className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs min-h-[80px] font-mono" value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} />
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={form.isDefault} onChange={e => setForm(p => ({ ...p, isDefault: e.target.checked }))} /> Default</label>
                        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={form.isLegalApproved} onChange={e => setForm(p => ({ ...p, isLegalApproved: e.target.checked }))} /> Legal Approved</label>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSave} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium"><Save className="w-3 h-3 inline mr-1" />{editingId ? "Update" : "Save"}</button>
                        <button onClick={() => { setShowAdd(false); setEditingId(null); }} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded text-xs">Cancel</button>
                    </div>
                </div>
            )}

            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                {isLoading ? (
                    <div className="px-4 py-8 text-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading...</div>
                ) : clauses.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400 text-sm">No clauses defined.</div>
                ) : clauses.map(clause => (
                    <div key={clause.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 text-xs">
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-800">{clause.title} <span className="font-mono text-slate-400">({clause.clauseKey})</span></div>
                            {clause.category && <span className="text-slate-400">{clause.category}</span>}
                        </div>
                        {clause.isLegalApproved && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px]">Legal ✓</span>}
                        {clause.isDefault && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">Default</span>}
                        <button onClick={() => { setEditingId(clause.id); setForm({ clauseKey: clause.clauseKey, title: clause.title, body: clause.body, category: clause.category || "", isDefault: clause.isDefault, isLegalApproved: clause.isLegalApproved }); setShowAdd(true); }} className="p-1 text-slate-400 hover:text-indigo-600"><Edit3 className="w-3 h-3" /></button>
                        <button onClick={() => handleDelete(clause.id)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// APPROVAL CONFIG PANEL
// ============================================================================

function ApprovalConfigPanel() {
    const [configs, setConfigs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [form, setForm] = useState({ steps: [] as { stepType: string; stepOrder: number; isRequired: boolean; autoApproveBelow: number }[] });

    const fetchConfig = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/sow/approval-config`, { headers: getAuthHeaders() });
            if (res.ok) { const d = await res.json(); setConfigs(d.configs || []); setForm({ steps: d.configs || [] }); }
        } catch {} finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const handleSave = async () => {
        await fetch(`${API_URL}/api/admin/sow/approval-config`, { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify({ steps: form.steps }) });
        await fetchConfig();
    };

    const addStep = () => {
        setForm(p => ({ steps: [...p.steps, { stepType: "", stepOrder: p.steps.length + 1, isRequired: true, autoApproveBelow: 0 }] }));
    };

    const removeStep = (idx: number) => {
        setForm(p => ({ steps: p.steps.filter((_, i) => i !== idx) }));
    };

    const updateStep = (idx: number, field: string, value: any) => {
        setForm(p => ({ steps: p.steps.map((s, i) => i === idx ? { ...s, [field]: value } : s) }));
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800">Approval Steps</h4>
                <div className="flex gap-2">
                    <button onClick={addStep} className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Step</button>
                    <button onClick={handleSave} className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 flex items-center gap-1"><Save className="w-3 h-3" /> Save All</button>
                </div>
            </div>

            <div className="p-4 space-y-2">
                {isLoading ? (
                    <div className="text-center text-slate-400 text-sm py-4"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading...</div>
                ) : form.steps.length === 0 ? (
                    <div className="text-center text-slate-400 text-sm py-4">No approval steps configured.</div>
                ) : form.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200 text-xs">
                        <span className="font-mono text-slate-400 w-6 text-center">{idx + 1}</span>
                        <input placeholder="Step Type (e.g., Manager)" className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs" value={step.stepType} onChange={e => updateStep(idx, "stepType", e.target.value)} />
                        <input type="number" placeholder="Order" className="w-16 px-2 py-1 border border-slate-300 rounded text-xs" value={step.stepOrder} onChange={e => updateStep(idx, "stepOrder", parseInt(e.target.value))} />
                        <label className="flex items-center gap-1"><input type="checkbox" checked={step.isRequired} onChange={e => updateStep(idx, "isRequired", e.target.checked)} /> Required</label>
                        <button onClick={() => removeStep(idx)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// NUMBERING CONFIG PANEL
// ============================================================================

function NumberingPanel() {
    const [config, setConfig] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [form, setForm] = useState({ prefix: "QBA-SOW", separator: "-", sequenceLength: 4, currentSequence: 1, financialYearBased: false });

    const fetchConfig = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/sow/numbering-config`, { headers: getAuthHeaders() });
            if (res.ok) { const d = await res.json(); if (d.config) { setConfig(d.config); setForm(d.config); } }
        } catch {} finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const handleSave = async () => {
        await fetch(`${API_URL}/api/admin/sow/numbering-config`, { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(form) });
        await fetchConfig();
    };

    const preview = `${form.prefix}${form.separator}${String(form.currentSequence).padStart(form.sequenceLength, "0")}`;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
            <h4 className="text-sm font-bold text-slate-800">Document Numbering</h4>

            {isLoading ? (
                <div className="text-center text-slate-400 py-4"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading...</div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Prefix</label>
                            <input className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" value={form.prefix} onChange={e => setForm(p => ({ ...p, prefix: e.target.value }))} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Separator</label>
                            <input className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" value={form.separator} onChange={e => setForm(p => ({ ...p, separator: e.target.value }))} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Sequence Length</label>
                            <input type="number" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" value={form.sequenceLength} onChange={e => setForm(p => ({ ...p, sequenceLength: parseInt(e.target.value) || 4 }))} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Current Sequence</label>
                            <input type="number" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" value={form.currentSequence} onChange={e => setForm(p => ({ ...p, currentSequence: parseInt(e.target.value) || 1 }))} />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={form.financialYearBased} onChange={e => setForm(p => ({ ...p, financialYearBased: e.target.checked }))} />
                        Financial Year Based (resets yearly)
                    </label>
                    <div className="p-3 bg-slate-50 rounded border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Preview:</p>
                        <p className="font-mono text-sm font-bold text-indigo-700">{preview}</p>
                    </div>
                    <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2">
                        <Save className="w-4 h-4" /> Save Configuration
                    </button>
                </>
            )}
        </div>
    );
}
