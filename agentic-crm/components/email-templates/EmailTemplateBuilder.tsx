"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";

/*
 * ── Full Database Schema (tables + fields) ──
 * Sourced from backend/prisma/schema.prisma.
 * Users can browse all tables/fields and click to insert {{table.field}} merge tags.
 *
 * The "Merge Variables" group contains the runtime variables that the
 * notification engine actually resolves — these are the primary ones to use.
 * The DB tables below are shown for reference so users know what data exists.
 */

/* ── Sample data for live preview ── */
const SAMPLE_DATA: Record<string, string> = {
    // Merge Variables
    opportunityTitle: "Cloud Migration – Acme Corp",
    opportunityId: "OPP-2024-0042",
    stageName: "Presales",
    previousStage: "Pipeline",
    value: "250000",
    probability: "70",
    description: "Enterprise cloud migration for Acme Corp's legacy infra",
    region: "North America",
    practice: "Cloud & DevOps",
    technology: "Azure / AWS",
    projectType: "Fixed Price",
    pricingModel: "T&M",
    tentativeStartDate: "2025-09-01",
    tentativeDuration: "6 months",
    clientName: "Acme Corporation",
    ownerName: "Sarah Johnson",
    ownerEmail: "sarah.johnson@company.com",
    salesRepName: "Michael Chen",
    managerName: "David Park",
    createdBy: "Sarah Johnson",
    updatedBy: "Michael Chen",
    comment: "Client requested updated timeline",
    recipientName: "John Smith",
    opportunityLink: "https://qcrm.qbadvisory.com/dashboard/opportunities/OPP-2024-0042",
    // Built-in calculated fields
    "calc:opportunityAge": "15",
    "calc:daysInStage": "3",
    "calc:daysUntilClose": "45",
    "calc:formattedValue": "USD 250,000",
    "calc:weightedValue": "USD 175,000",
    "calc:stageProgress": "33%",
    "calc:currentDate": new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    "calc:currentTime": new Date().toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    "calc:stageSLA": "On Track",
    "calc:expectedCloseFormatted": "August 15, 2025",
    "calc:createdDateFormatted": "June 1, 2025",
};

/* ── Custom calculated field definition ── */
export interface CustomCalcField {
    id: string;
    label: string;
    formula: string; // e.g. "value * probability / 100" or "IF(probability > 50, 'High', 'Low')"
}

/* ── Formula evaluator for custom calculated fields ── */
function evaluateFormula(formula: string, data: Record<string, string>): string {
    try {
        let expr = formula;
        // Replace field references like {value} or {probability} with actual data
        expr = expr.replace(/\{([\w.:]+)\}/g, (_, key) => {
            const val = data[key] ?? "";
            // If numeric, return as-is for math; else quote
            return isNaN(Number(val)) || val === "" ? `"${val.replace(/"/g, '\\"')}"` : val;
        });

        // Handle IF(condition, trueVal, falseVal)
        expr = expr.replace(/IF\s*\(([^,]+),\s*([^,]+),\s*([^)]+)\)/gi, (_, cond, t, f) => {
            try {
                // eslint-disable-next-line no-new-func
                const result = new Function(`"use strict"; return (${cond});`)();
                return result ? t.trim() : f.trim();
            } catch { return "ERR"; }
        });

        // Handle CONCAT(a, b, ...)
        expr = expr.replace(/CONCAT\s*\(([^)]+)\)/gi, (_, args) => {
            const parts = args.split(",").map((s: string) => s.trim().replace(/^["']|["']$/g, ""));
            return `"${parts.join("")}"`;
        });

        // Handle UPPER(x), LOWER(x)
        expr = expr.replace(/UPPER\s*\(([^)]+)\)/gi, (_, v) => `"${String(v).replace(/^["']|["']$/g, "").toUpperCase()}"`);
        expr = expr.replace(/LOWER\s*\(([^)]+)\)/gi, (_, v) => `"${String(v).replace(/^["']|["']$/g, "").toLowerCase()}"`);

        // Handle ROUND(x, decimals)
        expr = expr.replace(/ROUND\s*\(([^,]+),\s*(\d+)\)/gi, (_, val, dec) => {
            const num = Number(val);
            return isNaN(num) ? "ERR" : String(Number(num.toFixed(Number(dec))));
        });

        // Handle FORMAT_NUMBER(x) → locale-formatted
        expr = expr.replace(/FORMAT_NUMBER\s*\(([^)]+)\)/gi, (_, val) => {
            const num = Number(String(val).replace(/^["']|["']$/g, ""));
            return isNaN(num) ? "ERR" : `"${num.toLocaleString("en-US")}"`;
        });

        // Evaluate final expression
        // eslint-disable-next-line no-new-func
        const result = new Function(`"use strict"; return (${expr});`)();
        return String(result);
    } catch {
        return "⚠ Formula Error";
    }
}

export const FIELD_CATALOG: { table: string; icon: string; fields: { key: string; label: string; type: string }[] }[] = [
    {
        table: "Merge Variables",
        icon: "⚡",
        fields: [
            { key: "opportunityTitle", label: "Opportunity Title", type: "text" },
            { key: "opportunityId", label: "Opportunity ID", type: "id" },
            { key: "stageName", label: "Current Stage", type: "text" },
            { key: "previousStage", label: "Previous Stage", type: "text" },
            { key: "value", label: "Value", type: "number" },
            { key: "probability", label: "Probability (%)", type: "number" },
            { key: "description", label: "Description", type: "text" },
            { key: "region", label: "Region", type: "text" },
            { key: "practice", label: "Practice", type: "text" },
            { key: "technology", label: "Technology", type: "text" },
            { key: "projectType", label: "Project Type", type: "text" },
            { key: "pricingModel", label: "Pricing Model", type: "text" },
            { key: "tentativeStartDate", label: "Tentative Start Date", type: "date" },
            { key: "tentativeDuration", label: "Tentative Duration", type: "text" },
            { key: "clientName", label: "Client Name", type: "text" },
            { key: "ownerName", label: "Owner Name", type: "text" },
            { key: "ownerEmail", label: "Owner Email", type: "email" },
            { key: "salesRepName", label: "Sales Rep", type: "text" },
            { key: "managerName", label: "Manager", type: "text" },
            { key: "createdBy", label: "Created By", type: "text" },
            { key: "updatedBy", label: "Updated By", type: "text" },
            { key: "comment", label: "Comment / Note", type: "text" },
            { key: "opportunityLink", label: "Opportunity Link (deep link)", type: "text" },
        ],
    },
    {
        table: "Opportunity",
        icon: "💼",
        fields: [
            { key: "opportunity.title", label: "Title", type: "text" },
            { key: "opportunity.description", label: "Description", type: "text" },
            { key: "opportunity.value", label: "Value", type: "decimal" },
            { key: "opportunity.currency", label: "Currency", type: "text" },
            { key: "opportunity.probability", label: "Probability", type: "number" },
            { key: "opportunity.expectedCloseDate", label: "Expected Close Date", type: "date" },
            { key: "opportunity.actualCloseDate", label: "Actual Close Date", type: "date" },
            { key: "opportunity.source", label: "Source", type: "text" },
            { key: "opportunity.priority", label: "Priority", type: "text" },
            { key: "opportunity.geolocation", label: "Geolocation", type: "text" },
            { key: "opportunity.salesRepName", label: "Sales Rep Name", type: "text" },
            { key: "opportunity.managerName", label: "Manager Name", type: "text" },
            { key: "opportunity.region", label: "Region", type: "text" },
            { key: "opportunity.practice", label: "Practice", type: "text" },
            { key: "opportunity.technology", label: "Technology", type: "text" },
            { key: "opportunity.projectType", label: "Project Type", type: "text" },
            { key: "opportunity.tentativeStartDate", label: "Tentative Start Date", type: "date" },
            { key: "opportunity.tentativeDuration", label: "Tentative Duration", type: "text" },
            { key: "opportunity.tentativeDurationUnit", label: "Duration Unit", type: "text" },
            { key: "opportunity.tentativeEndDate", label: "Tentative End Date", type: "date" },
            { key: "opportunity.pricingModel", label: "Pricing Model", type: "text" },
            { key: "opportunity.expectedDayRate", label: "Expected Day Rate", type: "decimal" },
            { key: "opportunity.adjustedEstimatedValue", label: "Adjusted Estimated Value", type: "decimal" },
            { key: "opportunity.currentStage", label: "Current Stage", type: "text" },
            { key: "opportunity.detailedStatus", label: "Detailed Status", type: "text" },
            { key: "opportunity.reEstimateCount", label: "Re-estimate Count", type: "number" },
            { key: "opportunity.gomApproved", label: "GOM Approved", type: "boolean" },
        ],
    },
    {
        table: "Client",
        icon: "🏢",
        fields: [
            { key: "client.name", label: "Name", type: "text" },
            { key: "client.domain", label: "Domain", type: "text" },
            { key: "client.industry", label: "Industry", type: "text" },
            { key: "client.size", label: "Size", type: "text" },
            { key: "client.revenue", label: "Revenue", type: "decimal" },
            { key: "client.location", label: "Location", type: "text" },
            { key: "client.country", label: "Country", type: "text" },
            { key: "client.description", label: "Description", type: "text" },
        ],
    },
    {
        table: "User",
        icon: "👤",
        fields: [
            { key: "user.name", label: "Name", type: "text" },
            { key: "user.email", label: "Email", type: "email" },
            { key: "user.title", label: "Title", type: "text" },
            { key: "user.department", label: "Department", type: "text" },
            { key: "user.designation", label: "Designation", type: "text" },
            { key: "user.reportingManagerName", label: "Reporting Manager", type: "text" },
            { key: "user.jobBand", label: "Job Band", type: "text" },
            { key: "user.phone", label: "Phone", type: "text" },
        ],
    },
    {
        table: "Contact",
        icon: "📇",
        fields: [
            { key: "contact.firstName", label: "First Name", type: "text" },
            { key: "contact.lastName", label: "Last Name", type: "text" },
            { key: "contact.email", label: "Email", type: "email" },
            { key: "contact.phone", label: "Phone", type: "text" },
            { key: "contact.title", label: "Title", type: "text" },
            { key: "contact.department", label: "Department", type: "text" },
        ],
    },
    {
        table: "Stage",
        icon: "📊",
        fields: [
            { key: "stage.name", label: "Name", type: "text" },
            { key: "stage.order", label: "Order", type: "number" },
            { key: "stage.probability", label: "Probability", type: "number" },
            { key: "stage.slaHours", label: "SLA Hours", type: "number" },
        ],
    },
    {
        table: "Activity",
        icon: "📝",
        fields: [
            { key: "activity.type", label: "Type", type: "text" },
            { key: "activity.subject", label: "Subject", type: "text" },
            { key: "activity.description", label: "Description", type: "text" },
            { key: "activity.duration", label: "Duration (min)", type: "number" },
            { key: "activity.scheduledAt", label: "Scheduled At", type: "date" },
            { key: "activity.outcome", label: "Outcome", type: "text" },
        ],
    },
    {
        table: "Task",
        icon: "✅",
        fields: [
            { key: "task.title", label: "Title", type: "text" },
            { key: "task.description", label: "Description", type: "text" },
            { key: "task.dueDate", label: "Due Date", type: "date" },
            { key: "task.priority", label: "Priority", type: "text" },
            { key: "task.status", label: "Status", type: "text" },
        ],
    },
    {
        table: "Project",
        icon: "📁",
        fields: [
            { key: "project.name", label: "Name", type: "text" },
            { key: "project.code", label: "Code", type: "text" },
            { key: "project.description", label: "Description", type: "text" },
            { key: "project.status", label: "Status", type: "text" },
            { key: "project.startDate", label: "Start Date", type: "date" },
            { key: "project.endDate", label: "End Date", type: "date" },
            { key: "project.budget", label: "Budget", type: "decimal" },
            { key: "project.consumed", label: "Consumed", type: "decimal" },
            { key: "project.healthScore", label: "Health Score", type: "number" },
            { key: "project.riskLevel", label: "Risk Level", type: "text" },
        ],
    },
    {
        table: "Team",
        icon: "👥",
        fields: [
            { key: "team.name", label: "Name", type: "text" },
            { key: "team.description", label: "Description", type: "text" },
        ],
    },
    {
        table: "Note",
        icon: "📌",
        fields: [
            { key: "note.content", label: "Content", type: "text" },
            { key: "note.stage", label: "Stage", type: "text" },
        ],
    },
    {
        table: "Approval",
        icon: "✋",
        fields: [
            { key: "approval.type", label: "Type", type: "text" },
            { key: "approval.reason", label: "Reason", type: "text" },
            { key: "approval.status", label: "Status", type: "text" },
            { key: "approval.comments", label: "Comments", type: "text" },
        ],
    },
    {
        table: "Rate Card",
        icon: "💰",
        fields: [
            { key: "rateCard.role", label: "Role", type: "text" },
            { key: "rateCard.skill", label: "Skill", type: "text" },
            { key: "rateCard.experienceBand", label: "Experience Band", type: "text" },
            { key: "rateCard.ctc", label: "CTC", type: "decimal" },
            { key: "rateCard.category", label: "Category", type: "text" },
        ],
    },
    {
        table: "Notification Rule",
        icon: "🔔",
        fields: [
            { key: "notifRule.name", label: "Name", type: "text" },
            { key: "notifRule.triggerType", label: "Trigger Type", type: "text" },
            { key: "notifRule.fromStage", label: "From Stage", type: "text" },
            { key: "notifRule.toStage", label: "To Stage", type: "text" },
            { key: "notifRule.emailTemplateKey", label: "Email Template Key", type: "text" },
        ],
    },
    {
        table: "Calculated Fields",
        icon: "🧮",
        fields: [
            { key: "calc:opportunityAge", label: "Opportunity Age (days)", type: "calc" },
            { key: "calc:daysInStage", label: "Days in Current Stage", type: "calc" },
            { key: "calc:daysUntilClose", label: "Days Until Expected Close", type: "calc" },
            { key: "calc:formattedValue", label: "Formatted Value (with currency)", type: "calc" },
            { key: "calc:weightedValue", label: "Weighted Value (value × probability)", type: "calc" },
            { key: "calc:stageProgress", label: "Stage Progress (%)", type: "calc" },
            { key: "calc:currentDate", label: "Current Date", type: "calc" },
            { key: "calc:currentTime", label: "Current Date & Time", type: "calc" },
            { key: "calc:stageSLA", label: "SLA Status (On Track / Overdue)", type: "calc" },
            { key: "calc:expectedCloseFormatted", label: "Expected Close Date (formatted)", type: "calc" },
            { key: "calc:createdDateFormatted", label: "Created Date (formatted)", type: "calc" },
        ],
    },
];

// Type badge colors
const TYPE_COLORS: Record<string, string> = {
    text: "bg-blue-100 text-blue-700",
    number: "bg-green-100 text-green-700",
    decimal: "bg-green-100 text-green-700",
    date: "bg-purple-100 text-purple-700",
    email: "bg-amber-100 text-amber-700",
    boolean: "bg-slate-100 text-slate-600",
    id: "bg-slate-100 text-slate-500",
    calc: "bg-orange-100 text-orange-700",
    formula: "bg-pink-100 text-pink-700",
};

interface Props {
    initialHtml: string;
    onChange: (html: string) => void;
    customCalcFields?: CustomCalcField[];
    onCustomCalcFieldsChange?: (fields: CustomCalcField[]) => void;
}

/* ── Toolbar button helper ── */
function TBtn({ cmd, arg, icon, title, active }: { cmd: string; arg?: string; icon: React.ReactNode; title: string; active?: boolean }) {
    return (
        <button
            type="button"
            title={title}
            onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd, false, arg); }}
            className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${active ? "bg-slate-200 text-indigo-700" : "text-slate-600"}`}
        >
            {icon}
        </button>
    );
}

export default function EmailTemplateBuilder({ initialHtml, onChange, customCalcFields = [], onCustomCalcFieldsChange }: Props) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [showSource, setShowSource] = useState(false);
    const [sourceHtml, setSourceHtml] = useState(initialHtml);
    const [insertFeedback, setInsertFeedback] = useState<string | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ "Merge Variables": true });
    const [fieldSearch, setFieldSearch] = useState("");
    const initialSet = useRef(false);

    // Custom calculated field form state
    const [showCalcForm, setShowCalcForm] = useState(false);
    const [calcLabel, setCalcLabel] = useState("");
    const [calcFormula, setCalcFormula] = useState("");
    const [calcEditId, setCalcEditId] = useState<string | null>(null);

    // Build full catalog including custom calc fields
    const fullCatalog = useMemo(() => {
        const base = [...FIELD_CATALOG];
        if (customCalcFields.length > 0) {
            const customGroup = {
                table: "Custom Formulas",
                icon: "🔧",
                fields: customCalcFields.map(cf => ({
                    key: `custom:${cf.id}`,
                    label: cf.label,
                    type: "formula" as string,
                })),
            };
            // Insert after "Calculated Fields"
            const calcIdx = base.findIndex(t => t.table === "Calculated Fields");
            if (calcIdx >= 0) base.splice(calcIdx + 1, 0, customGroup);
            else base.push(customGroup);
        }
        return base;
    }, [customCalcFields]);

    // Filter catalog by search
    const filteredCatalog = useMemo(() => {
        const q = fieldSearch.trim().toLowerCase();
        if (!q) return fullCatalog;
        return fullCatalog.map(tbl => ({
            ...tbl,
            fields: tbl.fields.filter(f =>
                f.label.toLowerCase().includes(q) ||
                f.key.toLowerCase().includes(q) ||
                f.type.toLowerCase().includes(q) ||
                tbl.table.toLowerCase().includes(q)
            ),
        })).filter(tbl => tbl.fields.length > 0);
    }, [fieldSearch, fullCatalog]);

    // Auto-expand all groups when searching
    useEffect(() => {
        if (fieldSearch.trim()) {
            setExpandedGroups(Object.fromEntries(filteredCatalog.map(t => [t.table, true])));
        }
    }, [fieldSearch, filteredCatalog]);

    const totalFieldCount = useMemo(() => fullCatalog.reduce((sum, t) => sum + t.fields.length, 0), [fullCatalog]);

    // Set initial content once
    useEffect(() => {
        if (editorRef.current && !initialSet.current) {
            editorRef.current.innerHTML = initialHtml;
            initialSet.current = true;
        }
    }, [initialHtml]);

    const emitChange = useCallback(() => {
        if (!editorRef.current) return;
        const html = editorRef.current.innerHTML;
        onChange(html);
        setSourceHtml(html);
    }, [onChange]);

    // Custom calculated field handlers
    const handleSaveCalcField = () => {
        if (!calcLabel.trim() || !calcFormula.trim()) return;
        const id = calcEditId || calcLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
        const updated = calcEditId
            ? customCalcFields.map(f => f.id === calcEditId ? { ...f, label: calcLabel.trim(), formula: calcFormula.trim() } : f)
            : [...customCalcFields, { id, label: calcLabel.trim(), formula: calcFormula.trim() }];
        onCustomCalcFieldsChange?.(updated);
        setCalcLabel("");
        setCalcFormula("");
        setCalcEditId(null);
        setShowCalcForm(false);
        setExpandedGroups(prev => ({ ...prev, "Custom Formulas": true }));
    };

    const handleDeleteCalcField = (id: string) => {
        onCustomCalcFieldsChange?.(customCalcFields.filter(f => f.id !== id));
    };

    const handleEditCalcField = (cf: CustomCalcField) => {
        setCalcLabel(cf.label);
        setCalcFormula(cf.formula);
        setCalcEditId(cf.id);
        setShowCalcForm(true);
    };

    // Evaluate a custom formula for live preview in the field list
    const getFormulaPreview = (formula: string) => evaluateFormula(formula, SAMPLE_DATA);

    const insertToken = (key: string, label: string) => {
        const editor = editorRef.current;
        if (!editor) return;

        editor.focus();
        const sel = window.getSelection();
        // Insert a styled merge-field tag at cursor
        const tag = `<span contenteditable="false" style="background:#e0e7ff;color:#4338ca;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:600;white-space:nowrap;cursor:default;">{{${key}}}</span>&nbsp;`;
        document.execCommand("insertHTML", false, tag);

        // If no selection was in editor, append
        if (!sel || !editor.contains(sel.anchorNode)) {
            editor.innerHTML += tag;
        }

        emitChange();
        setInsertFeedback(label);
        setTimeout(() => setInsertFeedback(null), 1500);
    };

    const handleFontSize = (size: string) => {
        document.execCommand("fontSize", false, size);
        emitChange();
    };

    const handleTextColor = (color: string) => {
        document.execCommand("foreColor", false, color);
        emitChange();
    };

    const handleInsertLink = () => {
        const url = prompt("Enter URL:");
        if (url) {
            document.execCommand("createLink", false, url);
            emitChange();
        }
    };

    const handleInsertTable = () => {
        const html = `<table style="border-collapse:collapse;width:100%;margin:12px 0;" border="1" cellpadding="8" cellspacing="0">
            <tr style="background:#f1f5f9;"><th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Column 1</th><th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Column 2</th><th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Column 3</th></tr>
            <tr><td style="border:1px solid #cbd5e1;padding:8px;">Data</td><td style="border:1px solid #cbd5e1;padding:8px;">Data</td><td style="border:1px solid #cbd5e1;padding:8px;">Data</td></tr>
        </table>`;
        editorRef.current?.focus();
        document.execCommand("insertHTML", false, html);
        emitChange();
    };

    const handleInsertViewOpportunity = () => {
        const html = `<div style="text-align:center;margin:20px 0;"><a href="{{opportunityLink}}" target="_blank" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.3px;">View Opportunity →</a></div>`;
        editorRef.current?.focus();
        document.execCommand("insertHTML", false, html);
        emitChange();
    };

    const applySource = () => {
        if (editorRef.current) {
            editorRef.current.innerHTML = sourceHtml;
            emitChange();
            setShowSource(false);
        }
    };

    // Build preview HTML — replaces merge tags with sample data
    const getPreviewHtml = () => {
        let bodyHtml = editorRef.current?.innerHTML || sourceHtml;

        // Build combined sample data including custom formulas
        const allSample = { ...SAMPLE_DATA };
        for (const cf of customCalcFields) {
            allSample[`custom:${cf.id}`] = evaluateFormula(cf.formula, SAMPLE_DATA);
        }

        // Replace styled merge-field spans with rendered values
        bodyHtml = bodyHtml.replace(
            /<span[^>]*contenteditable="false"[^>]*>\{\{([\w.:]+)\}\}<\/span>/g,
            (_, key) => {
                const val = allSample[key];
                if (val !== undefined) {
                    return `<span style="background:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:600;white-space:nowrap;">${val}</span>`;
                }
                return `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:600;white-space:nowrap;">{{${key}}}</span>`;
            }
        );

        // Also replace plain {{key}} text not in spans
        bodyHtml = bodyHtml.replace(
            /\{\{([\w.:]+)\}\}/g,
            (match, key) => {
                const val = allSample[key];
                if (val !== undefined) {
                    return `<span style="background:#dcfce7;color:#166534;padding:2px 4px;border-radius:3px;font-size:inherit;font-weight:600;">${val}</span>`;
                }
                return match;
            }
        );

        return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
            <p style="margin:0 0 12px 0;color:#6b7280;font-style:italic;">Dear <span style="background:#dbeafe;color:#1e40af;padding:2px 4px;border-radius:3px;">To recipients (auto)</span>,</p>
            ${bodyHtml}
        </div>`;
    };

    return (
        <div className="space-y-3">
            {/* Template info */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" /></svg>
                <div>
                    <p className="text-xs text-amber-800"><b>Note:</b> Every email auto-starts with <b>"Dear [To recipient names],"</b> — this is not editable. Recipients (To/CC) are set in <b>Notification Rules</b>.</p>
                </div>
            </div>

            {/* Main 2-column layout: fields panel + editor */}
            <div className="flex gap-3">
                {/* LEFT: Tables & Fields accordion with search */}
                <div className="w-64 shrink-0 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden self-start">
                    {/* Header */}
                    <div className="bg-indigo-600 px-3 py-2">
                        <h4 className="text-xs font-bold text-white">Tables &amp; Fields</h4>
                        <p className="text-[10px] text-indigo-200 mt-0.5">{fullCatalog.length} tables · {totalFieldCount} fields</p>
                    </div>
                    {/* Search */}
                    <div className="px-2 py-2 border-b border-slate-100">
                        <div className="relative">
                            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input
                                type="text"
                                value={fieldSearch}
                                onChange={(e) => setFieldSearch(e.target.value)}
                                placeholder="Search fields..."
                                className="w-full pl-7 pr-7 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            {fieldSearch && (
                                <button onClick={() => setFieldSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Feedback */}
                    {insertFeedback && (
                        <div className="bg-green-50 px-3 py-1.5 border-b border-green-100 text-xs text-green-700 font-medium animate-pulse">
                            ✓ Inserted: {insertFeedback}
                        </div>
                    )}
                    {/* Accordion */}
                    <div className="max-h-[500px] overflow-y-auto">
                        {filteredCatalog.length === 0 && (
                            <div className="px-3 py-6 text-center text-xs text-slate-400">No fields match &quot;{fieldSearch}&quot;</div>
                        )}
                        {filteredCatalog.map(tbl => {
                            const isExpanded = expandedGroups[tbl.table] ?? false;
                            const isMerge = tbl.table === "Merge Variables";
                            const isCalc = tbl.table === "Calculated Fields";
                            const isCustom = tbl.table === "Custom Formulas";
                            return (
                                <div key={tbl.table}>
                                    {/* Accordion header */}
                                    <button
                                        onClick={() => setExpandedGroups(prev => ({ ...prev, [tbl.table]: !prev[tbl.table] }))}
                                        className={`w-full flex items-center justify-between px-3 py-2 border-b text-left text-[11px] font-semibold transition-colors ${isMerge ? "bg-indigo-50 border-indigo-100 text-indigo-800 hover:bg-indigo-100" : isCalc ? "bg-orange-50 border-orange-100 text-orange-800 hover:bg-orange-100" : isCustom ? "bg-pink-50 border-pink-100 text-pink-800 hover:bg-pink-100" : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100"}`}
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <span>{tbl.icon}</span>
                                            <span>{tbl.table}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isMerge ? "bg-indigo-100 text-indigo-600" : isCalc ? "bg-orange-100 text-orange-600" : isCustom ? "bg-pink-100 text-pink-600" : "bg-slate-200 text-slate-500"}`}>{tbl.fields.length}</span>
                                            {isMerge && <span className="text-[9px] px-1 py-0.5 rounded bg-green-100 text-green-700">Active</span>}
                                            {isCalc && <span className="text-[9px] px-1 py-0.5 rounded bg-orange-100 text-orange-700">Auto</span>}
                                            {isCustom && <span className="text-[9px] px-1 py-0.5 rounded bg-pink-100 text-pink-700">User</span>}
                                        </span>
                                        <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    {/* Accordion body */}
                                    {isExpanded && (
                                        <div className="divide-y divide-slate-50">
                                            {tbl.fields.map(f => {
                                                const customField = isCustom ? customCalcFields.find(cf => `custom:${cf.id}` === f.key) : null;
                                                return (
                                                    <div key={f.key} className="group">
                                                        <button
                                                            onClick={() => insertToken(f.key, `${tbl.table}.${f.label}`)}
                                                            className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 flex items-center justify-between gap-1"
                                                            title={`Click to insert {{${f.key}}}`}
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="text-xs text-slate-800 font-medium group-hover:text-indigo-700 truncate">{f.label}</div>
                                                                <div className="text-[10px] font-mono text-slate-400 group-hover:text-indigo-500 truncate">{`{{${f.key}}}`}</div>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${TYPE_COLORS[f.type] || "bg-slate-100 text-slate-500"}`}>{f.type}</span>
                                                                <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                            </div>
                                                        </button>
                                                        {/* Custom field: show formula + preview + edit/delete */}
                                                        {customField && (
                                                            <div className="px-3 pb-1.5 flex items-center gap-1">
                                                                <span className="text-[10px] text-pink-600 font-mono truncate flex-1" title={customField.formula}>= {customField.formula}</span>
                                                                <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium shrink-0" title="Preview with sample data">→ {getFormulaPreview(customField.formula)}</span>
                                                                <button onClick={(e) => { e.stopPropagation(); handleEditCalcField(customField); }} className="text-slate-400 hover:text-indigo-600 p-0.5" title="Edit formula">
                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteCalcField(customField.id); }} className="text-slate-400 hover:text-red-600 p-0.5" title="Delete">
                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Add Custom Calculated Field button / form */}
                    <div className="border-t border-slate-200">
                        {!showCalcForm ? (
                            <button
                                onClick={() => { setShowCalcForm(true); setCalcEditId(null); setCalcLabel(""); setCalcFormula(""); }}
                                className="w-full px-3 py-2 text-xs font-medium text-pink-700 bg-pink-50 hover:bg-pink-100 transition-colors flex items-center gap-1.5"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4" /></svg>
                                Add Custom Calculated Field
                            </button>
                        ) : (
                            <div className="p-3 bg-pink-50 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-pink-800">{calcEditId ? "Edit" : "New"} Custom Field</span>
                                    <button onClick={() => { setShowCalcForm(false); setCalcEditId(null); }} className="text-slate-400 hover:text-slate-600">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Field name (e.g. Profit Margin)"
                                    value={calcLabel}
                                    onChange={(e) => setCalcLabel(e.target.value)}
                                    className="w-full px-2 py-1.5 rounded border border-pink-200 text-xs focus:outline-none focus:ring-2 focus:ring-pink-500/20"
                                />
                                <textarea
                                    placeholder={"Formula: use {fieldName} for references\ne.g. {value} * {probability} / 100\nor IF({probability} > 50, 'High', 'Low')"}
                                    value={calcFormula}
                                    onChange={(e) => setCalcFormula(e.target.value)}
                                    rows={3}
                                    className="w-full px-2 py-1.5 rounded border border-pink-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-pink-500/20 resize-none"
                                />
                                {/* Live formula preview */}
                                {calcFormula.trim() && (
                                    <div className="bg-white rounded border border-pink-200 px-2 py-1.5 flex items-center gap-1.5">
                                        <span className="text-[10px] text-slate-500">Preview:</span>
                                        <span className="text-[11px] font-semibold text-green-700">{getFormulaPreview(calcFormula)}</span>
                                    </div>
                                )}
                                {/* Formula help */}
                                <details className="text-[10px] text-slate-500">
                                    <summary className="cursor-pointer hover:text-pink-700 font-medium">Formula syntax help</summary>
                                    <div className="mt-1 space-y-0.5 pl-2 text-[9px]">
                                        <p><b>Field ref:</b> <code className="bg-pink-100 px-1 rounded">{"{value}"}</code> <code className="bg-pink-100 px-1 rounded">{"{probability}"}</code></p>
                                        <p><b>Math:</b> <code className="bg-pink-100 px-1 rounded">{"{value}"} * {"{probability}"} / 100</code></p>
                                        <p><b>IF:</b> <code className="bg-pink-100 px-1 rounded">IF({"{probability}"} &gt; 50, &apos;High&apos;, &apos;Low&apos;)</code></p>
                                        <p><b>CONCAT:</b> <code className="bg-pink-100 px-1 rounded">CONCAT({"{clientName}"}, &apos; – &apos;, {"{stageName}"})</code></p>
                                        <p><b>ROUND:</b> <code className="bg-pink-100 px-1 rounded">ROUND({"{value}"} / 1000, 2)</code></p>
                                        <p><b>FORMAT_NUMBER:</b> <code className="bg-pink-100 px-1 rounded">FORMAT_NUMBER({"{value}"})</code></p>
                                        <p><b>UPPER / LOWER:</b> <code className="bg-pink-100 px-1 rounded">UPPER({"{region}"})</code></p>
                                    </div>
                                </details>
                                <button
                                    onClick={handleSaveCalcField}
                                    disabled={!calcLabel.trim() || !calcFormula.trim()}
                                    className="w-full py-1.5 rounded bg-pink-600 text-white text-xs font-medium hover:bg-pink-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    {calcEditId ? "Update Field" : "Add Field"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Rich text editor */}
                <div className="flex-1 min-w-0 space-y-0">
                    {/* Toolbar */}
                    <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-t-lg border-b-0">
                        {/* Text style */}
                        <TBtn cmd="bold" title="Bold (Ctrl+B)" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>} />
                        <TBtn cmd="italic" title="Italic (Ctrl+I)" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>} />
                        <TBtn cmd="underline" title="Underline (Ctrl+U)" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>} />
                        <TBtn cmd="strikeThrough" title="Strikethrough" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="4" y1="12" x2="20" y2="12"/><path d="M17.5 7.5c0-2-1.5-3.5-5.5-3.5S6.5 5.5 6.5 7.5c0 4 11 4 11 8 0 2-2 3.5-5.5 3.5S6 17 6 16.5"/></svg>} />

                        <div className="w-px h-5 bg-slate-300 mx-1" />

                        {/* Font size */}
                        <select
                            title="Font Size"
                            className="text-xs bg-white border border-slate-200 rounded px-1 py-1 text-slate-600"
                            onChange={(e) => { if (e.target.value) { handleFontSize(e.target.value); e.target.value = ""; } }}
                            defaultValue=""
                        >
                            <option value="" disabled>Size</option>
                            <option value="1">Small</option>
                            <option value="3">Normal</option>
                            <option value="4">Medium</option>
                            <option value="5">Large</option>
                            <option value="6">X-Large</option>
                        </select>

                        {/* Text color */}
                        <div className="relative">
                            <input
                                type="color"
                                title="Text Color"
                                className="w-6 h-6 rounded cursor-pointer border border-slate-200"
                                defaultValue="#0f172a"
                                onChange={(e) => handleTextColor(e.target.value)}
                            />
                        </div>

                        <div className="w-px h-5 bg-slate-300 mx-1" />

                        {/* Alignment */}
                        <TBtn cmd="justifyLeft" title="Align Left" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>} />
                        <TBtn cmd="justifyCenter" title="Align Center" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>} />
                        <TBtn cmd="justifyRight" title="Align Right" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>} />

                        <div className="w-px h-5 bg-slate-300 mx-1" />

                        {/* Lists */}
                        <TBtn cmd="insertUnorderedList" title="Bullet List" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>} />
                        <TBtn cmd="insertOrderedList" title="Numbered List" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="3" y="8" fontSize="7" fill="currentColor" fontFamily="Arial">1</text><text x="3" y="14" fontSize="7" fill="currentColor" fontFamily="Arial">2</text><text x="3" y="20" fontSize="7" fill="currentColor" fontFamily="Arial">3</text></svg>} />

                        <div className="w-px h-5 bg-slate-300 mx-1" />

                        {/* Link */}
                        <button type="button" title="Insert Link" onMouseDown={(e) => { e.preventDefault(); handleInsertLink(); }} className="p-1.5 rounded hover:bg-slate-200 text-slate-600">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                        </button>

                        {/* Table */}
                        <button type="button" title="Insert Table" onMouseDown={(e) => { e.preventDefault(); handleInsertTable(); }} className="p-1.5 rounded hover:bg-slate-200 text-slate-600">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                        </button>

                        {/* View Opportunity CTA button */}
                        <button type="button" title="Insert View Opportunity Button (deep link)" onMouseDown={(e) => { e.preventDefault(); handleInsertViewOpportunity(); }} className="p-1.5 rounded hover:bg-indigo-100 text-indigo-600 bg-indigo-50 border border-indigo-200">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </button>

                        <div className="w-px h-5 bg-slate-300 mx-1" />

                        {/* Horizontal line */}
                        <TBtn cmd="insertHorizontalRule" title="Horizontal Line" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="3" y1="12" x2="21" y2="12"/></svg>} />

                        {/* Undo/Redo */}
                        <div className="w-px h-5 bg-slate-300 mx-1" />
                        <TBtn cmd="undo" title="Undo (Ctrl+Z)" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>} />
                        <TBtn cmd="redo" title="Redo (Ctrl+Y)" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>} />

                        <div className="flex-1" />

                        {/* View toggles */}
                        <button type="button" onClick={() => { setShowSource(v => !v); if (!showSource && editorRef.current) setSourceHtml(editorRef.current.innerHTML); }} className={`text-[11px] px-2 py-1 rounded border ${showSource ? "bg-indigo-50 border-indigo-300 text-indigo-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                            {"</>"}
                        </button>
                        <button type="button" onClick={() => setShowPreview(v => !v)} className={`text-[11px] px-2 py-1 rounded border ${showPreview ? "bg-indigo-50 border-indigo-300 text-indigo-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                            Preview
                        </button>
                    </div>

                    {/* Editable area */}
                    {!showSource ? (
                        <div
                            ref={editorRef}
                            contentEditable
                            suppressContentEditableWarning
                            onInput={emitChange}
                            onBlur={emitChange}
                            className="w-full min-h-[320px] max-h-[500px] overflow-y-auto px-4 py-3 border border-slate-200 rounded-b-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            style={{ fontFamily: "Arial, sans-serif", fontSize: "14px", lineHeight: "1.6", color: "#0f172a" }}
                        />
                    ) : (
                        <div className="space-y-2 border border-slate-200 rounded-b-lg p-3 bg-slate-50">
                            <textarea
                                className="w-full px-3 py-2 rounded border border-slate-200 font-mono text-xs bg-white resize-y"
                                rows={12}
                                value={sourceHtml}
                                onChange={(e) => setSourceHtml(e.target.value)}
                            />
                            <div className="flex justify-end">
                                <button type="button" onClick={applySource} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs hover:bg-indigo-700">
                                    Apply HTML
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Preview */}
                    {showPreview && (
                        <div className="border border-slate-200 rounded-lg overflow-hidden mt-3">
                            <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-slate-600">Email Preview — with sample data</span>
                                <span className="flex items-center gap-3 text-[10px]">
                                    <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-green-200 border border-green-400" /> Resolved</span>
                                    <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-amber-200 border border-amber-400" /> Unresolved</span>
                                </span>
                            </div>
                            <div className="p-4 bg-slate-100" dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
