"use client";

import React, { useState, useEffect, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { API_URL, getAuthHeaders } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
    Calendar,
    Plus,
    ArrowRight,
    Paperclip,
    ArrowLeft,
    User,
    Check,
    X,
    Briefcase,
    RefreshCw,
    Percent,
    Info,
    Clock,
    ChevronDown,
    XCircle,
    AlertTriangle,
    AlertCircle,
    CheckCircle,
    TrendingUp,
    DollarSign,
    Search,
    Upload,
    Download,
    Trash2,
    FileText
} from "lucide-react";
import { useOpportunityStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { EstimationTab } from "./components/EstimationTab";
import { ResourceAssignmentTab } from "./components/ResourceAssignmentTab";
import { GomCalculatorTab } from "./components/GomCalculatorTab";
import { OpportunityEstimationProvider, useOpportunityEstimation } from "./context/OpportunityEstimationContext";
import { useCurrency } from "@/components/providers/currency-provider";
import { CommentsPanel } from "./components/CommentsPanel";
import { AuditLogPane } from "./components/AuditLogPane";
import { AssignmentPane } from "./components/AssignmentPane";
import { AssignPresalesModal } from "./components/AssignPresalesModal";
import { SowStudio } from "./components/SowStudio";

// Static dropdowns (not master-data driven)
const DURATION_UNITS = ["days", "weeks", "months"];
const ARCHITECTS = ["David Chen", "Sarah Jones", "Rahul Gupta", "Emily White"];

function SearchableSelect({ name, value, options, disabled, onChange, placeholder, required, className }: any) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filtered = options.filter((o: any) => o.label.toLowerCase().includes(search.toLowerCase()));
    const selectedOption = options.find((o: any) => o.value === value);

    return (
        <div className="relative w-full" ref={ref}>
            <div 
                className={`w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-md text-sm shadow-sm flex items-center justify-between ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-70' : 'bg-white cursor-pointer'} ${className || ''}`}
                onClick={() => { if (!disabled) { setOpen(!open); setSearch(""); } }}
            >
                <span className={selectedOption ? "text-slate-800" : "text-slate-400"}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
            {open && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
                    <div className="p-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md">
                            <Search className="w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.map((o: any) => (
                            <div 
                                key={o.value} 
                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 ${o.value === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
                                onClick={() => {
                                    onChange({ target: { name, value: o.value } });
                                    setOpen(false);
                                }}
                            >
                                {o.label}
                            </div>
                        ))}
                        {filtered.length === 0 && <div className="px-3 py-4 text-sm text-slate-400 text-center">No results found</div>}
                    </div>
                </div>
            )}
            {/* hidden native input to trigger required validation */}
            {required && <input type="text" name={name} value={value || ''} readOnly className="absolute bottom-0 left-0 w-full h-0 opacity-0 pointer-events-none" required />}
        </div>
    );
}

function SearchableMultiSelect({ name, value, options, disabled, onChange, placeholder, className }: any) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedValues = (value || "")
        .split(",")
        .map((v: string) => v.trim())
        .filter(Boolean);
    const selectedSet = new Set(selectedValues.map((v: string) => v.toLowerCase()));
    const filtered = options.filter((o: any) => o.label.toLowerCase().includes(search.toLowerCase()));

    const emitChange = (nextValues: string[]) => {
        onChange({ target: { name, value: nextValues.join(", ") } });
    };

    const toggleOption = (optionValue: string) => {
        const exists = selectedValues.some((v: string) => v.toLowerCase() === optionValue.toLowerCase());
        emitChange(exists ? selectedValues.filter((v: string) => v.toLowerCase() !== optionValue.toLowerCase()) : [...selectedValues, optionValue]);
    };

    return (
        <div className="relative w-full" ref={ref}>
            <div
                className={`w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-md text-sm shadow-sm flex items-center justify-between gap-2 ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-70' : 'bg-white cursor-pointer'} ${className || ''}`}
                onClick={() => { if (!disabled) { setOpen(!open); setSearch(""); } }}
            >
                <div className="flex-1 flex flex-wrap gap-1">
                    {selectedValues.length > 0 ? selectedValues.map((selected: string) => (
                        <span key={selected} className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-xs px-2 py-0.5 rounded-full border border-amber-200">
                            {selected}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        emitChange(selectedValues.filter((v: string) => v !== selected));
                                    }}
                                    className="hover:text-red-600"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </span>
                    )) : <span className="text-slate-400">{placeholder}</span>}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </div>
            {open && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
                    <div className="p-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md">
                            <Search className="w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.map((o: any) => {
                            const checked = selectedSet.has(o.value.toLowerCase());
                            return (
                                <label
                                    key={o.value}
                                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 ${checked ? 'bg-amber-50 text-amber-800 font-medium' : 'text-slate-700'}`}
                                >
                                    <input
                                        type="checkbox"
                                        className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                        checked={checked}
                                        onChange={() => toggleOption(o.value)}
                                    />
                                    {o.label}
                                </label>
                            );
                        })}
                        {filtered.length === 0 && <div className="px-3 py-4 text-sm text-slate-400 text-center">No results found</div>}
                    </div>
                </div>
            )}
        </div>
    );
}

// Convert duration value + unit to total months (for end date / value calcs)
function durationToDays(value: number, unit: string): number {
    switch (unit) {
        case 'days': return value;
        case 'weeks': return value * 7;
        case 'months': return value * 30;
        default: return value * 30;
    }
}

function durationToWorkingDays(value: number, unit: string): number {
    switch (unit) {
        case 'days': return value; // Already in working days
        case 'weeks': return value * 5; // 5 working days per week
        case 'months': return value * 20; // ~20 working days per month
        default: return value * 20;
    }
}

/**
 * Calculate tentative end date from start date + duration.
 * - Days: Start date is day 1 (inclusive). End date = the Nth working day counting from start.
 * - Weeks: End Date = Start Date + (N × 7) − 1 calendar day
 * - Months: End Date = Start Date + N months − 1 calendar day
 */
function calculateEndDate(startDateStr: string, duration: number, unit: string, holidays: string[] = []): Date {
    const start = new Date(startDateStr);
    if (unit === 'months') {
        // End Date = Start + N months - 1 day
        const end = new Date(start);
        end.setMonth(end.getMonth() + duration);
        end.setDate(end.getDate() - 1);
        return end;
    }
    if (unit === 'weeks') {
        // End Date = Start + N*7 - 1 calendar day
        const end = new Date(start);
        end.setDate(end.getDate() + duration * 7 - 1);
        return end;
    }
    // Days: working days with start date as day 1
    // Find the Nth working day starting from (and including) startDate
    const date = new Date(start);
    let counted = 0;
    // First check if start date itself is a working day
    const startDay = date.getDay();
    const startStr = date.toISOString().split('T')[0];
    if (startDay !== 0 && startDay !== 6 && !holidays.includes(startStr)) {
        counted = 1;
    }
    if (counted >= duration) return date;
    // Continue counting from next day
    while (counted < duration) {
        date.setDate(date.getDate() + 1);
        const dateStr = date.toISOString().split('T')[0];
        if (date.getDay() !== 0 && date.getDay() !== 6 && !holidays.includes(dateStr)) {
            counted++;
        }
    }
    return date;
}

/** Count working days in a calendar period (inclusive of start, up to but not including end boundary).
 *  For months: period = [startDate, startDate + N months - 1 day] inclusive.
 */
function countWorkingDaysInPeriod(startDateStr: string, months: number, holidays: string[] = []): number {
    if (!startDateStr || months <= 0) return 0;
    const start = new Date(startDateStr);
    const end = new Date(startDateStr);
    end.setMonth(end.getMonth() + months);
    // end is exclusive boundary (one day past the last day of the period)
    let count = 0;
    const current = new Date(start);
    while (current < end) {
        const day = current.getDay();
        const dateStr = current.toISOString().split('T')[0];
        if (day !== 0 && day !== 6 && !holidays.includes(dateStr)) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

function durationToMonths(value: number, unit: string): number {
    switch (unit) {
        case 'days': return value / 30;
        case 'weeks': return value / 4.33;
        case 'months': return value;
        default: return value;
    }
}

function formatDuration(value: string, unit: string): string {
    if (!value) return '';
    return `${value} ${unit}`;
}

// Save button that uses the estimation context (must be inside the provider)
function PresalesSaveButton({ onAfterSave, viewOnly = false }: { onAfterSave?: (gomPct: number) => void; viewOnly?: boolean }) {
    const { saveEstimation, isSaving, readOnly, gomPercent } = useOpportunityEstimation();
    const { toast } = useToast();

    const disabled = isSaving || viewOnly || readOnly;

    if (readOnly && !viewOnly) return null;

    const handleSave = async () => {
        if (viewOnly) return;
        try {
            await saveEstimation();
            toast({ title: "Saved", description: "Estimation data saved successfully." });
            onAfterSave?.(gomPercent);
        } catch {
            toast({ title: "Error", description: "Failed to save estimation data." });
        }
    };

    return (
        <div className="flex justify-end mb-2">
            <button
                onClick={handleSave}
                disabled={disabled}
                title={disabled ? "The Estimation tab is view only. Edit presales inputs in the editable tabs." : undefined}
                className={`px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 shadow-sm ${
                    disabled
                        ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
            >
                {isSaving ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                    <><Check className="w-4 h-4" /> Save Estimation</>
                )}
            </button>
        </div>
    );
}

// Bridge component to sync GOM percent from context to parent
function GomPercentSync({ onGomPercentChange }: { onGomPercentChange: (pct: number) => void }) {
    const { gomPercent } = useOpportunityEstimation();
    useEffect(() => { onGomPercentChange(gomPercent); }, [gomPercent, onGomPercentChange]);
    return null;
}

export default function OpportunityDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { currency: globalCurrency, getSymbol, getRate, setCurrency } = useCurrency();
    const [opportunityCurrency, setOpportunityCurrency] = useState<string>('INR');
    const [opportunityMetadata, setOpportunityMetadata] = useState<any>(null);
    const [originalData, setOriginalData] = useState<{value: number, currency: string} | null>(null);
    const prevCurrencyRef = useRef(globalCurrency);




    const { id } = use(params);
    const { updateOpportunity } = useOpportunityStore();
    const { user } = useAuthStore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    // Guard: skip derived-value effects during initial data load to prevent cascading re-renders ("dancing")
    const skipDerivedEffects = useRef(true);
    // Two-phase reveal: skeleton → hidden content → visible content
    const [dataReady, setDataReady] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showPresalesModal, setShowPresalesModal] = useState(false);
    const [showAssignPresalesModal, setShowAssignPresalesModal] = useState(false);
    const [showViewOnlyModal, setShowViewOnlyModal] = useState(false);
    const [opportunityOwnerId, setOpportunityOwnerId] = useState<string>('');
    const [opportunityAccess, setOpportunityAccess] = useState<any>(null);

    // Dynamic dropdown data
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
    const [regions, setRegions] = useState<string[]>([]);
    const [technologies, setTechnologies] = useState<string[]>([]);
    const [pricingModels, setPricingModels] = useState<string[]>([]);
    const [salespersons, setSalespersons] = useState<{ id: string; name: string; department?: string }[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [managers, setManagers] = useState<{ id: string; name: string; department: string }[]>([]);
    const [isLoadingManagers, setIsLoadingManagers] = useState(false);
    const [opportunityManagerName, setOpportunityManagerName] = useState("");
    const [presalesTeam, setPresalesTeam] = useState<{ id: string; name: string; department?: string | null }[]>([]);
    const [isLoadingPresalesTeam, setIsLoadingPresalesTeam] = useState(false);
    const [projectTypes, setProjectTypes] = useState<string[]>([]);
    const [autoSaveIntervalMinutes, setAutoSaveIntervalMinutes] = useState(2);

    // Form State
    const [formData, setFormData] = useState({
        clientName: "",
        country: "",
        region: "",
        projectType: "",
        projectName: "",
        practice: "",
        salesRep: "",
        technology: "",
        tentativeStartDate: "",
        tentativeEndDate: "",
        presalesAssignee: "",
        duration: "",
        durationUnit: "months",
        pricingModel: "",
        expectedDayRate: "",
        description: "",
        value: 0
    });

    useEffect(() => {
        if (skipDerivedEffects.current) return;
        if (prevCurrencyRef.current && prevCurrencyRef.current !== globalCurrency) {
            const oldRate = getRate(prevCurrencyRef.current);
            const newRate = getRate(globalCurrency);
            if (oldRate && newRate) {
                setFormData(prev => ({
                    ...prev,
                    value: prev.value && !isNaN(Number(prev.value)) ? Math.round((Number(prev.value) * newRate / oldRate) * 100) / 100 : prev.value,
                    expectedDayRate: prev.expectedDayRate ? String(Math.round((Number(prev.expectedDayRate) * newRate / oldRate) * 100) / 100) : ""
                }));
                setAdjustedEstimatedValue(prev => {
                    const n = Number(prev);
                    return n > 0 ? String(Math.round(n * newRate / oldRate * 100) / 100) : prev;
                });
            }
            prevCurrencyRef.current = globalCurrency;
            setOpportunityCurrency(globalCurrency);
        }
    }, [globalCurrency]);


    // Country → Region + Currency mapping (fetched from API)
    const [countryRegionMap, setCountryRegionMap] = useState<Record<string, { region: string; currency: string }>>({});
    const countries = Object.keys(countryRegionMap).sort();

    const [holidays, setHolidays] = useState<string[]>([]);

    // Attachments state
    const [attachments, setAttachments] = useState<{ id: string; fileName: string; fileType: string; fileSize: number; uploadedAt: string }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Add Client modal
    const [showAddClient, setShowAddClient] = useState(false);
    const [newClientName, setNewClientName] = useState("");
    const [newClientContact, setNewClientContact] = useState("");
    const [newClientAddress, setNewClientAddress] = useState("");
    const [addingClient, setAddingClient] = useState(false);

    // Presales Modal State (Modal for transition)
    const [presalesForm, setPresalesForm] = useState({
        proposalDueDate: "",
        comments: "",
        managerName: ""
    });
    
    // Original presalesData from DB to avoid overwriting travelCosts/resources
    const [rawPresalesData, setRawPresalesData] = useState<any>({});

    // Presales View State (The detailed view after transition)
    const [activeTab, setActiveTab] = useState("Project Details");
    const [activeStep, setActiveStep] = useState(0); // 0: Pipeline, 1: Presales
    const [opportunityStage, setOpportunityStage] = useState(0); // actual DB stage (0-3), stays fixed when navigating steps
    const [currentStageName, setCurrentStageName] = useState(''); // actual Kanban stage name (Discovery, Qualification, Proposal, Negotiation, Closed Won, Closed Lost)
    const steps = ["Pipeline", "Presales", "Sales", "SOW", "Project"];
    const isManagerOrAdmin = !!opportunityAccess?.permissions?.approvals?.manage;
    const canApproveGom = !!opportunityAccess?.permissions?.approvals?.manage;
    const canViewPipeline = !!(opportunityAccess?.permissions?.pipeline?.view || opportunityAccess?.workflow?.pipelineEditable);
    const canViewPresales = !!(opportunityAccess?.permissions?.presales?.view || opportunityAccess?.permissions?.estimation?.manage || opportunityAccess?.permissions?.gom?.view || opportunityAccess?.permissions?.approvals?.manage);
    const canViewSales = !!opportunityAccess?.permissions?.sales?.view;
    const canViewProject = !!(opportunityAccess?.permissions?.sales?.view || opportunityAccess?.permissions?.sow?.view);
    const canEditPipeline = !!opportunityAccess?.workflow?.pipelineEditable;
    const canEditPresales = !!opportunityAccess?.workflow?.presalesEditable;
    const canManageEstimation = !!opportunityAccess?.workflow?.estimationEditable;
    const canEditSales = !!opportunityAccess?.workflow?.salesEditable;
    const canEditProjectDetails = !!opportunityAccess?.workflow?.projectDetailsEditable;
    const canManageAttachments = !!opportunityAccess?.workflow?.attachmentsEditable;
    const canComment = !!opportunityAccess?.workflow?.commentsWritable;
    const canRequestGomApproval = !!opportunityAccess?.workflow?.gomRequestAllowed;
    const canManageGomApproval = !!opportunityAccess?.workflow?.gomApprovalManageable;
    const canReviewGomApproval = !!opportunityAccess?.workflow?.gomApprovalReviewable;
    const viewOnlyReason = opportunityAccess?.viewOnlyReason || null;
    const canEditPresalesData = canEditPresales || canManageEstimation;
    const canEditPresalesAttachments = canManageAttachments && canEditPresalesData;
    const canWorkPresalesStage = canEditPresalesData || canManageGomApproval;
    const canWorkSalesStage = canEditSales;
    const hasEditAccess = opportunityStage === 0
        ? canEditPipeline
        : opportunityStage === 1
            ? canWorkPresalesStage
            : opportunityStage === 2
                ? canWorkSalesStage
                : false;

    useEffect(() => {
        const stepAccess = [
            canViewPipeline,
            canViewPresales,
            canViewSales,
            false,
            canViewProject,
        ];
        if (stepAccess[activeStep]) return;

        const reachableSteps =
            opportunityStage === 3 ? [4, 2, 1, 0] :
            opportunityStage === 2 ? [2, 1, 0] :
            opportunityStage === 1 ? [1, 0] :
            [0];
        const fallback = reachableSteps.find((step) => stepAccess[step]);
        if (fallback !== undefined && fallback !== activeStep) {
            setActiveStep(fallback);
        }
    }, [activeStep, opportunityStage, canViewPipeline, canViewPresales, canViewSales, canViewProject]);

    useEffect(() => {
        const visibleTabs = [
            ...(canViewPresales ? ["Project Details", "Schedule", "Resource Assignment"] : []),
            ...(opportunityAccess?.permissions?.gom?.view || opportunityAccess?.permissions?.approvals?.manage ? ["GOM Calculator"] : []),
            ...(canViewPresales ? ["View Estimate"] : []),
        ];
        if (!visibleTabs.length) return;
        if (!visibleTabs.includes(activeTab)) {
            setActiveTab(visibleTabs[0]);
        }
    }, [activeTab, canViewPresales, opportunityAccess?.permissions?.approvals?.manage, opportunityAccess?.permissions?.gom?.view]);

    // Sales view collapsible sections
    const [salesPipelineOpen, setSalesPipelineOpen] = useState(false);
    const [salesPresalesOpen, setSalesPresalesOpen] = useState(false);

    // Mark as Lost state
    const [showLostModal, setShowLostModal] = useState(false);
    const [lostRemarks, setLostRemarks] = useState("");
    const [isLost, setIsLost] = useState(false);
    const [isStalled, setIsStalled] = useState(false);
    const [lostModalType, setLostModalType] = useState<string>('Closed Lost');

    const activeRoleName = (user?.role?.name || "").trim().toLowerCase();
    const isActiveAdmin = !!user?.role?.permissions?.includes("*") || activeRoleName === "admin";
    // Stage-specific assignment rules (tab-driven, per product spec):
    // - Sales Rep: editable in Pipeline (step 0) and Sales (step 2)
    // - Manager:   editable in Presales (step 1) and Sales (step 2)
    // - Presales:  editable in Pipeline (step 0) and Presales (step 1)
    // Plus: a non-admin sales rep / manager may hand off the field ONCE.
    // After the first handoff, only Admin can change it. Counts live in opp.metadata.
    const _meta: any = (opportunityMetadata as any) || {};
    const salesRepHandoffsDone = Number(_meta.salesRepHandoffs) || 0;
    const managerHandoffsDone = Number(_meta.managerHandoffs) || 0;
    const baseAssignmentLock = opportunityStage >= 3 || isLost || isStalled || currentStageName === 'Negotiation';
    const salesRepHandoffLock = !isActiveAdmin && salesRepHandoffsDone >= 1;
    const managerHandoffLock = !isActiveAdmin && managerHandoffsDone >= 1;
    const canEditSalesRepAssignment = !baseAssignmentLock && !salesRepHandoffLock && (isActiveAdmin || activeRoleName === "sales") && (activeStep === 0 || activeStep === 2);
    const canEditManagerAssignment = !baseAssignmentLock && !managerHandoffLock && (isActiveAdmin || activeRoleName === "manager") && (activeStep === 1 || activeStep === 2);
    const canEditPresalesAssignment = !baseAssignmentLock && (isActiveAdmin || activeRoleName === "presales" || (activeRoleName === "manager" && opportunityAccess?.assignment?.isManager)) && (activeStep === 0 || activeStep === 1);

    // Technology multiselect state
    const [techDropdownOpen, setTechDropdownOpen] = useState(false);
    const [techSearch, setTechSearch] = useState("");
    const techDropdownRef = useRef<HTMLDivElement>(null);

    // Re-estimate modal state
    const [showReestimateModal, setShowReestimateModal] = useState(false);
    const [adjustedEstimatedValue, setAdjustedEstimatedValue] = useState<string>("");
    const [reEstimateComment, setReEstimateComment] = useState("");
    const [detailedStatus, setDetailedStatus] = useState<string>("");

    // GOM percent from estimation context (for threshold check)
    const [contextGomPercent, setContextGomPercent] = useState(0);
    const [minGomPercent, setMinGomPercent] = useState(0);
    const [gomAutoApprovePercent, setGomAutoApprovePercent] = useState(0);
    const [gomApproved, setGomApproved] = useState(false);
    const [approvedGomPercent, setApprovedGomPercent] = useState<number | null>(null);
    const [gomPendingApproval, setGomPendingApproval] = useState<{ id: string; requester: string; reviewer: string | null; reason: string } | null>(null);

    // Load managers by department when presales modal opens
    useEffect(() => {
        if (!showPresalesModal) return;
        const dept = formData.practice;
        setIsLoadingManagers(true);
        const url = dept
            ? `${API_URL}/api/master/managers?department=${encodeURIComponent(dept)}`
            : `${API_URL}/api/master/managers`;
        fetch(url, { headers: getAuthHeaders() })
            .then(r => r.ok ? r.json() : [])
            .then((data: any[]) => setManagers(data))
            .catch(() => setManagers([]))
            .finally(() => setIsLoadingManagers(false));
    }, [showPresalesModal, formData.practice]);

    useEffect(() => {
        let cancelled = false;
        const dept = formData.practice;
        const managerUrl = dept
            ? `${API_URL}/api/master/managers?department=${encodeURIComponent(dept)}`
            : `${API_URL}/api/master/managers`;
        const presalesUrl = dept
            ? `${API_URL}/api/master/presales-team?department=${encodeURIComponent(dept)}`
            : `${API_URL}/api/master/presales-team`;

        setIsLoadingManagers(true);
        setIsLoadingPresalesTeam(true);
        Promise.all([
            fetch(managerUrl, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []),
            fetch(presalesUrl, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : []),
        ])
            .then(([managerData, presalesData]) => {
                if (cancelled) return;
                setManagers(Array.isArray(managerData) ? managerData : []);
                setPresalesTeam(Array.isArray(presalesData) ? presalesData : []);
            })
            .catch(() => {
                if (cancelled) return;
                setManagers([]);
                setPresalesTeam([]);
            })
            .finally(() => {
                if (cancelled) return;
                setIsLoadingManagers(false);
                setIsLoadingPresalesTeam(false);
            });

        return () => { cancelled = true; };
    }, [formData.practice]);

    // Click-outside handler for tech dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (techDropdownRef.current && !techDropdownRef.current.contains(e.target as Node)) {
                setTechDropdownOpen(false);
                setTechSearch("");
            }
        };
        if (techDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [techDropdownOpen]);

    // GOM Calculator State
    const [gomInputs, setGomInputs] = useState({
        annualCTC: 1200000,
        deliveryMgmt: 5,
        benchCost: 10,
        exchangeRate: 1,
        currency: "INR",
        onsiteAllowance: 2802,
        markupPercent: 0,
        targetRevenue: 0,
        calcMode: 'markup',
        durationMonths: 3,
        workingDays: 55
    });

    const [gomResults, setGomResults] = useState({
        adjustedCost: 0,
        offshoreDayRate: 0,
        onsiteDayRate: 0,
        offshoreRevenue: 0,
        offshoreGom: 0,
        offshoreProfit: 0,
        onsiteRevenue: 0,
        onsiteGom: 0,
        onsiteProfit: 0
    });

    // Auto-calculate working days from start date + duration months (excluding weekends & holidays)
    useEffect(() => {
        if (skipDerivedEffects.current) return;
        if (formData.tentativeStartDate && gomInputs.durationMonths > 0) {
            const days = countWorkingDaysInPeriod(formData.tentativeStartDate, gomInputs.durationMonths, holidays);
            if (days > 0) {
                setGomInputs(prev => ({ ...prev, workingDays: days }));
            }
        }
    }, [formData.tentativeStartDate, gomInputs.durationMonths, holidays]);

    // GOM Calculations
    useEffect(() => {
        // Sync markup from presalesData into gomInputs
        const effectiveMarkup = (rawPresalesData?.markupPercent || 0) ?? gomInputs.markupPercent;

        // Constants (Hardcoded for now as per GOM page)
        const perDiemUSD = 50;
        const perDiemRate = 85;

        // Step 1: Adjusted Cost (Rs.)
        const loadingFactor = (gomInputs.deliveryMgmt + gomInputs.benchCost) / 100;
        const adjCost = gomInputs.annualCTC * (1 + loadingFactor);

        // Step 2: Convert to Quotation Currency
        const ctcInQuot = adjCost / gomInputs.exchangeRate;

        // Step 3: Offshore Cost Per Day
        const offDay = Math.ceil(ctcInQuot / 220);

        // Step 4: Onsite Cost Per Day
        const perDiemTotal = perDiemUSD * perDiemRate;
        const onDay = offDay + perDiemTotal + gomInputs.onsiteAllowance;

        // Financials Calculation Helper
        const calcFinancials = (cost: number) => {
            let rev = 0;
            let gom = 0;
            let profit = 0;

            if (gomInputs.calcMode === 'markup') {
                rev = cost * (1 + effectiveMarkup / 100);
            } else {
                rev = gomInputs.targetRevenue;
            }

            if (rev > 0) {
                gom = ((rev - cost) / rev) * 100;
                profit = (effectiveMarkup / (1 + effectiveMarkup / 100)) * 100;
            }
            return { rev, gom, profit };
        };

        const offFin = calcFinancials(offDay);
        const onFin = calcFinancials(onDay);

        setGomResults({
            adjustedCost: adjCost,
            offshoreDayRate: offDay,
            onsiteDayRate: onDay,
            offshoreRevenue: offFin.rev,
            offshoreGom: offFin.gom,
            offshoreProfit: offFin.profit,
            onsiteRevenue: onFin.rev,
            onsiteGom: onFin.gom,
            onsiteProfit: onFin.profit
        });

    }, [gomInputs, (rawPresalesData?.markupPercent || 0)]);

    // Fetch master data for dropdowns
    useEffect(() => {
        const fetchMasterData = async () => {
            const headers = getAuthHeaders();
            try {
                const [clientsRes, regionsRes, techRes, pricingRes, salesRes, deptRes, projTypesRes, budgetRes, countryMapRes, holRes] = await Promise.all([
                    fetch(`${API_URL}/api/master/clients`, { headers }),
                    fetch(`${API_URL}/api/master/regions`, { headers }),
                    fetch(`${API_URL}/api/master/technologies`, { headers }),
                    fetch(`${API_URL}/api/master/pricing-models`, { headers }),
                    fetch(`${API_URL}/api/master/salespersons`, { headers }),
                    fetch(`${API_URL}/api/master/departments`, { headers }),
                    fetch(`${API_URL}/api/master/project-types`, { headers }),
                    fetch(`${API_URL}/api/admin/budget-assumptions`, { headers }),
                    fetch(`${API_URL}/api/master/country-region-map`, { headers }),
                    fetch(`${API_URL}/api/master/holidays`, { headers }),
                ]);
                // Parse all JSON in parallel first, then batch state updates
                const [clientsData, regionsData, techData, pricingData, salesData, deptData, projTypesData, budgetData, countryMapData, holData] = await Promise.all([
                    clientsRes.ok ? clientsRes.json() : null,
                    regionsRes.ok ? regionsRes.json() : null,
                    techRes.ok ? techRes.json() : null,
                    pricingRes.ok ? pricingRes.json() : null,
                    salesRes.ok ? salesRes.json() : null,
                    deptRes.ok ? deptRes.json() : null,
                    projTypesRes.ok ? projTypesRes.json() : null,
                    budgetRes.ok ? budgetRes.json() : null,
                    countryMapRes.ok ? countryMapRes.json() : null,
                    holRes.ok ? holRes.json() : null,
                ]);
                // Batch all state updates synchronously so React 18 batches them in one render
                if (clientsData) setClients(clientsData);
                if (regionsData) setRegions(regionsData.map((r: any) => r.name));
                if (techData) setTechnologies(techData.map((t: any) => t.name));
                if (pricingData) setPricingModels(pricingData.map((p: any) => p.name));
                if (salesData) setSalespersons(salesData);
                if (deptData) setDepartments(deptData);
                if (projTypesData) setProjectTypes(projTypesData.map((p: any) => p.name));
                if (countryMapData) setCountryRegionMap(countryMapData);
                if (holData && Array.isArray(holData)) setHolidays(holData);
                if (budgetData) {
                    if (budgetData.autoSaveIntervalMinutes !== undefined) {
                        setAutoSaveIntervalMinutes(budgetData.autoSaveIntervalMinutes);
                    }
                    if (budgetData.minGomPercent !== undefined) {
                        setMinGomPercent(budgetData.minGomPercent);
                    }
                    if (budgetData.gomAutoApprovePercent !== undefined || budgetData.marginPercent !== undefined) {
                        setGomAutoApprovePercent(budgetData.gomAutoApprovePercent || budgetData.marginPercent || 35);
                    }
                }
            } catch (err) {
                console.error("Failed to load master data", err);
            }
        };
        fetchMasterData();
    }, []);




    // Auto-calculate tentative end date using standard formulas:
    // - Days: Start date = day 1, end = Nth working day (skip weekends/holidays)
    // - Weeks: End = Start + N×7 − 1 day (calendar)
    // - Months: End = Start + N months − 1 day (calendar)
    useEffect(() => {
        if (skipDerivedEffects.current) return;
        const dur = Number(formData.duration);
        if (formData.tentativeStartDate && dur > 0 && formData.durationUnit) {
            const end = calculateEndDate(formData.tentativeStartDate, dur, formData.durationUnit, holidays);
            setFormData(prev => ({ ...prev, tentativeEndDate: end.toISOString().split('T')[0] }));
        }
    }, [formData.tentativeStartDate, formData.duration, formData.durationUnit, holidays]);

    // Auto-calculate estimated value = Expected Day Rate × 20 working days × Duration months (only for Staffing)
    useEffect(() => {
        if (skipDerivedEffects.current) return;
        if (formData.projectType !== 'Staffing') return;
        const rate = Number(formData.expectedDayRate) || 0;
        const dur = Number(formData.duration) || 0;
        const months = durationToMonths(dur, formData.durationUnit);
        if (rate > 0 && months > 0) {
            setFormData(prev => ({ ...prev, value: Math.round(rate * 20 * months) }));
        }
    }, [formData.expectedDayRate, formData.duration, formData.durationUnit, formData.projectType]);

    // Sync GOM durationMonths from opportunity duration field
    useEffect(() => {
        if (skipDerivedEffects.current) return;
        const dur = Number(formData.duration) || 0;
        if (dur > 0) {
            const months = Math.round(durationToMonths(dur, formData.durationUnit));
            if (months > 0 && months !== gomInputs.durationMonths) {
                setGomInputs(prev => ({ ...prev, durationMonths: months }));
            }
        }
    }, [formData.duration, formData.durationUnit]);

    // Fetch Data on Load
    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
                    headers: getAuthHeaders(),
                });
                if (res.status === 401) {
                    // Token expired/invalidated (e.g. backend restarted -> new bootId).
                    // Clear stale token and force re-login instead of silently
                    // degrading the whole page to a permission-less read-only state.
                    if (typeof window !== "undefined") {
                        sessionStorage.removeItem("auth_token");
                        localStorage.removeItem("auth_token");
                        if (!window.location.pathname.startsWith("/login")) {
                            window.location.href = "/login";
                        }
                    }
                    return;
                }
                if (!res.ok) throw new Error("Failed to load");
                const data = await res.json();

                setFormData({
                    clientName: data.client?.name || "",
                    country: data.country || "",
                    region: data.region || "",
                    projectType: data.projectType || "New Development",
                    projectName: data.title || "",
                    practice: data.practice || "",
                    salesRep: data.salesRepName || "",
                    technology: data.technology || "",
                    tentativeStartDate: data.tentativeStartDate ? new Date(data.tentativeStartDate).toISOString().split('T')[0] : "",
                    tentativeEndDate: data.tentativeEndDate ? new Date(data.tentativeEndDate).toISOString().split('T')[0] : "",
                    duration: data.tentativeDuration || "",
                    durationUnit: data.tentativeDurationUnit || "months",
                    pricingModel: data.pricingModel || "",
                    expectedDayRate: data.expectedDayRate || "",
                    description: data.description || "",
                    presalesAssignee: data.presalesAssigneeName || "",
                    value: (() => {
                        let loadedValue = data.value || 0;
                        const dataCurr = data.currency || 'USD';
                        if (dataCurr !== globalCurrency) {
                            const rates = data.metadata?.exchangeRatesSnapshot;
                            if (rates && rates[dataCurr] && rates[globalCurrency]) {
                                loadedValue = (loadedValue * rates[globalCurrency]) / rates[dataCurr];
                            } else {
                                loadedValue = (loadedValue * getRate(globalCurrency)) / getRate(dataCurr);
                            }
                            loadedValue = Math.round(loadedValue * 100) / 100;
                        }
                        return loadedValue;
                    })()
                });

                setOriginalData({ value: data.value || 0, currency: data.currency || 'USD' });
                setOpportunityCurrency(globalCurrency);
                setOpportunityMetadata(data.metadata || null);
                setOpportunityOwnerId(data.ownerId || data.owner?.id || '');
                setOpportunityAccess(data.access || null);
                setShowViewOnlyModal(!!data.access?.viewOnlyReason && !data.access?.assignment?.canEditAssignedOpportunity);

                // Load attachments
                if (data.attachments && Array.isArray(data.attachments)) {
                    setAttachments(data.attachments);
                }

                setOpportunityManagerName(data.managerName || "");
                setPresalesForm(prev => ({ ...prev, managerName: data.managerName || "" }));
                setAdjustedEstimatedValue(data.adjustedEstimatedValue != null ? String(data.adjustedEstimatedValue) : "");
                setDetailedStatus(data.detailedStatus || "");
                setGomApproved(data.gomApproved === true);
                setApprovedGomPercent(data.gomApproved === true && data.presalesData?.finalGomPercent != null
                    ? Number(data.presalesData.finalGomPercent)
                    : null);

                // Fetch pending GOM approval status
                if (!data.gomApproved) {
                    fetch(`${API_URL}/api/opportunities/${id}/gom-approval-status`, { headers: getAuthHeaders() })
                        .then(r => r.ok ? r.json() : null)
                        .then(d => { if (d?.pending) setGomPendingApproval(d.pending); })
                        .catch(() => {});
                }

                if (data.detailedStatus === 'On Hold' || data.isStalled) {
                    setIsStalled(true);
                } else {
                    setIsStalled(false);
                }
                
                // Update active step based on stage
                const stageName = data.stage?.name || data.currentStage || '';
                setCurrentStageName(stageName);
                let stageIdx = 0;
                if (stageName === 'Closed Lost' || stageName === 'Proposal Lost') {
                    stageIdx = 2; // keep on Sales tab view
                    setIsLost(true);
                    setLostRemarks(data.salesData?.lostRemarks || data.detailedStatus || '');
                } else if (stageName === 'Closed Won' || stageName === 'Closed-Won' || stageName === 'Delivered' || data.project) {
                    stageIdx = 3;
                } else if (stageName === 'Proposal' || stageName === 'Negotiation' || stageName === 'Sales') {
                    stageIdx = 2;
                } else if (stageName === 'Presales' || stageName === 'Qualification') {
                    stageIdx = 1;
                }
                setActiveStep(stageIdx === 3 ? 4 : stageIdx);
                setOpportunityStage(stageIdx);

                // Load presales data from saved record (Project Details tab fields)
                if (data.presalesData && typeof data.presalesData === 'object') {
                    const pd = data.presalesData as any;
                    setRawPresalesData(pd);
                    if (pd.proposalDueDate) {
                        setPresalesForm(prev => ({ ...prev, proposalDueDate: pd.proposalDueDate }));
                    }
                                    }

                // If user is manager (by role) and no presales assignee, show modal
                const isManagerRole = user?.role?.name?.toLowerCase().includes('manager') || user?.role?.name?.toLowerCase().includes('admin');
                if (isManagerRole && data.managerName === user?.name && !data.presalesAssigneeName && data.stage?.name !== "Pipeline" && data.stage?.name !== "Discovery") {
                    setShowAssignPresalesModal(true);
                }

            } catch (error) {
                console.error("Load error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (id) fetchDetails();
    }, [id]);

    // Enable derived-value effects after the initial data render has fully painted.
    // Wait 2 animation frames so React's batched state updates have all flushed.
    useEffect(() => {
        if (!isLoading && skipDerivedEffects.current) {
            // Frame 1: React has rendered with data
            const raf1 = requestAnimationFrame(() => {
                // Frame 2: layout is stable
                const raf2 = requestAnimationFrame(() => {
                    skipDerivedEffects.current = false;
                    setDataReady(true);
                });
                return () => cancelAnimationFrame(raf2);
            });
            return () => cancelAnimationFrame(raf1);
        }
    }, [isLoading]);

    // Refetch presales data when entering Sales tab to ensure we have the latest GOM calculator saves
    useEffect(() => {
        if (activeStep === 2 && id) {
            fetch(`${API_URL}/api/opportunities/${id}`, { headers: getAuthHeaders() })
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (data?.presalesData && typeof data.presalesData === 'object') {
                        setRawPresalesData(data.presalesData);
                    }
                })
                .catch(err => console.error("Failed to refresh presales data for Sales tab", err));
        }
    }, [activeStep, id]);



    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'country') {
            const countryInfo = countryRegionMap[value];
            const autoRegion = countryInfo?.region || '';
            setFormData(prev => ({ ...prev, country: value, region: autoRegion }));
            // Auto-switch global currency to the selected country's currency (supported only)
            if (countryInfo?.currency) {
                const SUPPORTED_CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD']);
                setCurrency(SUPPORTED_CURRENCIES.has(countryInfo.currency) ? countryInfo.currency : 'USD');
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    // Add Client handler
    const handleAddClient = async () => {
        if (!newClientName.trim()) return;
        setAddingClient(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/clients`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    name: newClientName.trim(),
                    contactPerson: newClientContact.trim() || undefined,
                    address: newClientAddress.trim() || undefined,
                }),
            });
            if (res.ok) {
                const created = await res.json();
                setClients(prev => [...prev, created]);
                setFormData(prev => ({ ...prev, clientName: created.name }));
                setNewClientName("");
                setNewClientContact("");
                setNewClientAddress("");
                setShowAddClient(false);
                toast({ title: "Client Added", description: `${created.name} has been added.` });
            } else {
                const errorData = await res.json().catch(() => ({}));
                toast({ title: "Error", description: errorData.error || "Failed to add client. It may already exist." });
            }
        } catch (err) {
            console.error("Failed to add client", err);
            toast({ title: "Error", description: "Failed to add client." });
        } finally {
            setAddingClient(false);
        }
    };

    // Attachment upload handler
    const handleFileUpload = async (files: FileList | null) => {
        if (!canManageAttachments) {
            toast({ title: "View Only", description: viewOnlyReason || "You do not have permission to upload attachments for this opportunity." });
            return;
        }
        if (!files || files.length === 0) return;
        setIsUploading(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fd = new FormData();
                fd.append("file", file);
                const res = await fetch(`${API_URL}/api/opportunities/${id}/attachments`, {
                    method: "POST",
                    headers: { Authorization: getAuthHeaders().Authorization },
                    body: fd,
                });
                if (!res.ok) throw new Error("Upload failed");
                const attachment = await res.json();
                setAttachments(prev => [...prev, attachment]);
            }
            toast({ title: "Uploaded", description: "File(s) uploaded successfully." });
        } catch {
            toast({ title: "Error", description: "Failed to upload file." });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // Attachment download handler (uses auth headers)
    const handleDownloadAttachment = (attachmentId: string, fileName: string) => {
        try {
            const authHeaders = getAuthHeaders() as any;
            let token = "";
            if (authHeaders.Authorization) {
                token = authHeaders.Authorization.replace("Bearer ", "");
            }
            const url = `${API_URL}/api/opportunities/${id}/attachments/${attachmentId}/download?token=${token}`;
            window.open(url, '_blank');
        } catch {
            toast({ title: "Error", description: "Failed to open file." });
        }
    };

    // Attachment delete handler
    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!canManageAttachments) {
            toast({ title: "View Only", description: viewOnlyReason || "You do not have permission to delete attachments from this opportunity." });
            return;
        }
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${id}/attachments/${attachmentId}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error("Delete failed");
            setAttachments(prev => prev.filter(a => a.id !== attachmentId));
            toast({ title: "Deleted", description: "Attachment removed." });
        } catch {
            toast({ title: "Error", description: "Failed to delete attachment." });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // The pipeline form must gate on pipeline edit permission specifically —
        // NOT the stage-dependent hasEditAccess (which checks presales/sales perms
        // once the opportunity moves past Pipeline stage and would wrongly block an
        // assigned sales rep/manager from editing pipeline fields in presales/sales).
        if (!canEditPipeline) {
            toast({ title: "View Only", description: viewOnlyReason || "You do not have permission to edit this opportunity." });
            return;
        }

        if (!formData.technology || formData.technology.trim() === "") {
            toast({ title: "Validation Error", description: "Technology is required." });
            return;
        }

        toast({ title: "Saving", description: "Saving opportunity..." });
        setIsSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    ...formData,
                    salesRepName: formData.salesRep,
                    managerName: opportunityManagerName,
                    presalesAssigneeName: formData.presalesAssignee,
                    currency: globalCurrency
                })
            });

            if (res.ok) {
                // Update local store only (no second PATCH to avoid duplicate notifications)
                const optimisticUpdates: any = { name: formData.projectName };
                const rawValue: any = formData.value;
                if (rawValue !== '' && rawValue !== undefined) optimisticUpdates.value = Number(rawValue);
                optimisticUpdates.currency = globalCurrency;
                optimisticUpdates.salesRepName = formData.salesRep;
                optimisticUpdates.managerName = opportunityManagerName;
                optimisticUpdates.presalesAssigneeName = formData.presalesAssignee;
                useOpportunityStore.setState((state) => ({
                    opportunities: state.opportunities.map((opp) =>
                        opp.id === id ? { ...opp, ...optimisticUpdates } : opp
                    ),
                }));
                setOpportunityCurrency(globalCurrency);
                toast({ title: "Success", description: "Opportunity updated successfully!" });
            } else {
                const errorData = await res.json().catch(() => ({}));
                toast({ title: "Error", description: errorData.error || "Failed to save changes. Please check all fields." });
            }
        } catch (error) {
            console.error("Update failed", error);
            toast({ title: "Error", description: "An unknown error occurred." });
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-save timer
    const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
    const formDataRef = useRef(formData);
    formDataRef.current = formData;

    useEffect(() => {
        if (autoSaveIntervalMinutes <= 0 || opportunityStage !== 0 || isLost || !canEditPipeline) return;

        autoSaveRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
                    method: 'PATCH',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(formDataRef.current)
                });
                if (res.ok) {
                    toast({ title: "Auto-saved", description: "Changes saved automatically." });
                }
            } catch (err) {
                console.error("Auto-save failed", err);
            }
        }, autoSaveIntervalMinutes * 60 * 1000);

        return () => {
            if (autoSaveRef.current) clearInterval(autoSaveRef.current);
        };
    }, [autoSaveIntervalMinutes, opportunityStage, isLost, id]);

    const handlePresalesSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!canEditPipeline) {
            toast({ title: "View Only", description: viewOnlyReason || "You do not have permission to edit this opportunity." });
            return;
        }

        if (!formData.technology || formData.technology.trim() === "") {
            toast({ title: "Validation Error", description: "Technology must be selected before moving to Presales." });
            return;
        }

        // Validate proposal due date against start date
        if (presalesForm.proposalDueDate && formData.tentativeStartDate && presalesForm.proposalDueDate > formData.tentativeStartDate) {
            toast({ title: "Validation Error", description: "Proposal due date cannot be beyond the estimated start date." });
            return;
        }
        setIsSaving(true);
        try {
            // Update stage to Qualification (Presales) and save presales data
            const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    stageName: 'Qualification', // Maps to Presales in our workflow
                    managerName: presalesForm.managerName,
                    presalesData: {
                        ...rawPresalesData,
                        ...presalesForm
                    }
                })
            });

            if (res.ok) {
                // Update local store only (no second PATCH to avoid duplicate notifications)
                useOpportunityStore.setState((state) => ({
                    opportunities: state.opportunities.map((opp) =>
                        opp.id === id ? { ...opp, stage: 'Qualification' } : opp
                    ),
                }));
                setCurrentStageName('Qualification');
                setActiveStep(1);
                setOpportunityStage(1);
                setOpportunityManagerName(presalesForm.managerName);
                setShowPresalesModal(false);
                toast({ title: "Success", description: "Moved to Presales successfully!" });
            } else {
                toast({ title: "Error", description: "Failed to move to Presales." });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleApproveGom = async (approved: boolean) => {
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${id}/approve-gom`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ approved, gomPercent: contextGomPercent })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.pendingApproval) {
                    setGomPendingApproval({ id: data.approvalId, requester: '', reviewer: data.reviewer, reason: '' });
                    toast({ title: "GOM Approval Requested", description: `Approval request sent to ${data.reviewer || 'the assigned manager'}.` });
                } else {
                    setGomApproved(data.gomApproved);
                    setApprovedGomPercent(data.gomApproved ? contextGomPercent : null);
                    setGomPendingApproval(null);
                    toast({ title: data.gomApproved ? "GOM Approved" : "GOM Approval Revoked", description: data.gomApproved ? "GOM has been approved. You can now move to Sales." : "GOM approval has been revoked." });
                }
            } else {
                const data = await res.json().catch(() => null);
                toast({ title: "Error", description: data?.error || "Failed to update GOM approval." });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleReviewGomApproval = async (approved: boolean, comments?: string) => {
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${id}/review-gom-approval`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ approved, comments })
            });
            if (res.ok) {
                const data = await res.json();
                setGomApproved(data.gomApproved);
                setApprovedGomPercent(data.gomApproved ? contextGomPercent : null);
                setGomPendingApproval(null);
                toast({ title: approved ? "GOM Approved" : "GOM Rejected", description: approved ? "GOM has been approved by manager." : "GOM approval has been rejected." });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleMoveToSales = async () => {
        // GOM is effectively approved when flagged by manager OR when above the auto-approve threshold
        const effectivelyGomApproved = gomApproved || (gomAutoApprovePercent > 0 && contextGomPercent >= gomAutoApprovePercent);
        if (!effectivelyGomApproved) {
            toast({ title: "GOM Not Approved", description: "GOM must be approved before moving to Sales. Please approve the GOM in the GOM Calculator tab." });
            return;
        }
        // Check GOM threshold if configured
        if (minGomPercent > 0 && contextGomPercent < minGomPercent) {
            toast({ title: "GOM Below Threshold", description: `GOM is ${contextGomPercent.toFixed(1)}%, which is below the minimum required ${minGomPercent}%. Cannot submit to Sales.` });
            return;
        }
        toast({ title: "Processing", description: "Moving to Sales..." });
        setIsSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ stageName: 'Proposal' })
            });
            if (res.ok) {
                const updatedData = await res.json().catch(() => ({}));
                // Update local store only (no second PATCH to avoid duplicate notifications)
                useOpportunityStore.setState((state) => ({
                    opportunities: state.opportunities.map((opp) =>
                        opp.id === id ? { ...opp, stage: 'Proposal' } : opp
                    ),
                }));
                setCurrentStageName('Proposal');
                setActiveStep(2);
                setOpportunityStage(2);
                // Sync detailedStatus from backend to clear the re-estimation banner
                setDetailedStatus(updatedData.detailedStatus || '');
                toast({ title: "Success", description: "Moved to Sales stage." });
            } else {
                const err = await res.json().catch(() => ({}));
                toast({ title: "Error", description: err.error || "Failed to move to Sales." });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleProposalSent = async () => {
        toast({ title: "Processing", description: "Sending proposal..." });
        setIsSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ stageName: 'Negotiation' })
            });
            if (res.ok) {
                // Update local store only (no second PATCH to avoid duplicate notifications).
                // Clear detailedStatus so any lingering "Estimation Submitted" /
                // "Re-estimation Submitted" / "Sent for Re-estimate" banner disappears
                // without requiring a page reload.
                useOpportunityStore.setState((state) => ({
                    opportunities: state.opportunities.map((opp) =>
                        opp.id === id ? { ...opp, stage: 'Negotiation', detailedStatus: '' } : opp
                    ),
                }));
                setCurrentStageName('Negotiation');
                setDetailedStatus('');
                toast({ title: "Success", description: "Proposal sent. Opportunity moved to Negotiation." });
            } else {
                toast({ title: "Error", description: "Failed to update stage." });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendBackForReestimate = async () => {
        setShowReestimateModal(true);
    };

    const handleConfirmReestimate = async () => {
        if (!reEstimateComment.trim()) {
            toast({ title: "Required", description: "Please enter a comment explaining why re-estimation is needed." });
            return;
        }
        setIsSaving(true);
        try {
            const payload: any = { stageName: 'Qualification', detailedStatus: 'Re-estimation', status: 're-estimation', reEstimateComment: reEstimateComment.trim() };
            if (adjustedEstimatedValue && Number(adjustedEstimatedValue) > 0) {
                payload.adjustedEstimatedValue = Number(adjustedEstimatedValue);
            }
            const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                // Update UI state immediately
                setCurrentStageName('Qualification');
                setActiveStep(1);
                setOpportunityStage(1);
                setGomApproved(false);
                setShowReestimateModal(false);
                setReEstimateComment("");
                setDetailedStatus('Re-estimation');
                toast({ title: "Success", description: "Sent back for re-estimation." });
                // Update local store only (no second PATCH to avoid duplicate notifications)
                useOpportunityStore.setState((state) => ({
                    opportunities: state.opportunities.map((opp) =>
                        opp.id === id ? { ...opp, stage: 'Qualification' } : opp
                    ),
                }));
            } else {
                toast({ title: "Error", description: "Failed to send back for re-estimation." });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleMarkAsLost = async () => {
        if (!lostRemarks.trim()) {
            toast({ title: "Required", description: "Please enter remarks for marking as lost." });
            return;
        }
        setIsSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    stageName: lostModalType,
                    salesData: { lostRemarks: lostRemarks.trim() }
                })
            });
            if (res.ok) {
                setIsLost(true);
                setCurrentStageName(lostModalType);
                setShowLostModal(false);
                const lostLabel = lostModalType === 'Proposal Lost' ? 'Proposal Lost' : 'Closed Lost';
                toast({ title: lostLabel, description: `Opportunity has been marked as ${lostLabel}.` });
            } else {
                toast({ title: "Error", description: "Failed to mark as lost." });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleMoveToProject = async () => {
        toast({ title: "Processing", description: "Converting to project..." });
        setIsSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${id}/convert`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (res.ok) {
                setCurrentStageName('Closed Won');
                setActiveStep(4);
                setOpportunityStage(3);
                toast({ title: "Success", description: "Opportunity converted to Project!" });
            } else if (res.status === 409) {
                // Project already exists — just navigate to project view
                setCurrentStageName('Closed Won');
                setActiveStep(4);
                setOpportunityStage(3);
                toast({ title: "Info", description: "Project already exists for this opportunity." });
            } else {
                toast({ title: "Error", description: data.error || "Failed to convert to Project." });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return (
        <div className="w-full space-y-4 animate-pulse" style={{ minHeight: '100vh' }}>
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div className="h-6 w-64 bg-slate-200 rounded" />
                <div className="flex gap-2">
                    <div className="h-10 w-24 bg-slate-200 rounded-md" />
                    <div className="h-10 w-32 bg-slate-200 rounded-md" />
                </div>
            </div>
            {/* Stepper skeleton */}
            <div className="flex items-center gap-2 py-3 px-4 bg-white rounded-lg border border-slate-200">
                {[1,2,3,4,5].map(i => (
                    <React.Fragment key={i}>
                        <div className="h-8 w-24 bg-slate-200 rounded-full" />
                        {i < 5 && <div className="h-0.5 flex-1 bg-slate-200" />}
                    </React.Fragment>
                ))}
            </div>
            {/* Content skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                        {[1,2,3,4,5,6].map(i => (
                            <div key={i} className="flex gap-4">
                                <div className="h-4 w-28 bg-slate-200 rounded" />
                                <div className="h-10 flex-1 bg-slate-100 rounded-md" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                        <div className="h-5 w-32 bg-slate-200 rounded" />
                        <div className="h-20 bg-slate-100 rounded" />
                        <div className="h-20 bg-slate-100 rounded" />
                    </div>
                </div>
            </div>
        </div>
    );

    const handleHoldToggle = async () => {
        const newStalled = !isStalled;
        setIsSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    detailedStatus: newStalled ? 'On Hold' : '',
                    isStalled: newStalled,
                    status: newStalled ? 'stalled' : 'healthy'
                })
            });
            if (res.ok) {
                setIsStalled(newStalled);
                setDetailedStatus(newStalled ? 'On Hold' : '');
                toast({ title: newStalled ? "Opportunity on Hold" : "Opportunity Resumed" });
            }
        } catch {
            toast({ title: "Error", description: "Failed to update hold status." });
        } finally {
            setIsSaving(false);
        }
    };


    const getBadgeText = () => {
        if (isStalled) return 'On Hold';
        if (isLost) return currentStageName === 'Proposal Lost' ? 'Proposal Lost' : 'Closed Lost';
        if (detailedStatus === 'Sent for Re-estimate' || detailedStatus === 'Re-estimation') return 'Sent for Re-estimate';
        if (detailedStatus === 'Estimation Submitted') return 'Estimation Submitted';
        if (opportunityStage === 3) return 'SOW Approved';
        if (opportunityStage >= 2) return currentStageName === 'Negotiation' ? 'Under Negotiation' : 'Proposal Submitted';
        return 'Estimation in Progress';
    };

    const getBadgeClass = () => {
        if (isStalled) return 'bg-amber-100 text-amber-800 border-amber-300';
        if (isLost) return 'bg-red-50 text-red-700 border-red-200';
        if (detailedStatus === 'Sent for Re-estimate' || detailedStatus === 'Re-estimation') return 'bg-rose-50 text-rose-700 border-rose-200';
        if (detailedStatus === 'Estimation Submitted') return 'bg-blue-50 text-blue-700 border-blue-200';
        if (opportunityStage === 3) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (opportunityStage >= 2) return 'bg-amber-50 text-amber-700 border-amber-200';
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    };
    
    // Helper for currency symbol

    
    const cSym = getSymbol(opportunityCurrency);
    
    // Convert presales data saved in potentially different currency to current opportunity currency
    const getPresalesConverted = (val: number) => {
        if (!val) return 0;
        const presalesCurr = rawPresalesData?.currency || opportunityCurrency;
        if (presalesCurr === opportunityCurrency) return val;
        
        const ratesSnapshot = opportunityMetadata?.exchangeRatesSnapshot as Record<string, number>;
        const rateToOpp = ratesSnapshot ? ratesSnapshot[opportunityCurrency] : getRate(opportunityCurrency);
        const rateFromPre = ratesSnapshot ? ratesSnapshot[presalesCurr] : getRate(presalesCurr);
        
        if (!rateToOpp || !rateFromPre) return val;
        return (val * rateToOpp) / rateFromPre;
    };

    const getPipelineProjectedRevenueBase = () => {
        const projectedRevenue = Number(adjustedEstimatedValue) > 0
            ? Number(adjustedEstimatedValue)
            : Number(formData.value) || 0;
        const selectedRate = getRate(globalCurrency);
        return selectedRate > 0 ? projectedRevenue / selectedRate : projectedRevenue;
    };


    // Access Control Logic already handled above

    return (
        <div
            className="w-full space-y-4 relative transition-opacity duration-300"
            style={{ opacity: dataReady ? 1 : 0, minHeight: '100vh' }}
        >
            {/* Header with Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold text-slate-800">
                        Opportunity / <span className="text-slate-500 font-normal">Pipeline Details</span>
                    </h1>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md text-slate-700 font-medium hover:bg-slate-50"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    {canEditPipeline && opportunityStage === 0 && !isLost && (
                        <>
                            <button
                                onClick={() => {
                                    setPresalesForm(prev => ({ ...prev, managerName: prev.managerName || opportunityManagerName }));
                                    setShowPresalesModal(true);
                                }}
                                disabled={isStalled}
                                className={`px-4 py-2 text-white rounded-md font-medium ${isStalled ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                Move to Presales
                            </button>
                            <button
                                type="button"
                                onClick={() => { setLostModalType('Closed Lost'); setShowLostModal(true); }}
                                disabled={isStalled}
                                className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-md font-medium hover:bg-red-50 disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <XCircle className="w-4 h-4" /> Mark as Lost
                            </button>
                        </>
                    )}
                    {canWorkPresalesStage && opportunityStage === 1 && !isLost && (
                        <>
                            <button
                                onClick={() => { setLostModalType('Proposal Lost'); setShowLostModal(true); }}
                                disabled={isSaving || isStalled}
                                className="px-4 py-2 bg-white border border-rose-300 text-rose-600 rounded-md font-medium hover:bg-rose-50 disabled:opacity-50"
                            >
                                <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Proposal Lost</span>
                            </button>
                            {(() => {
                                const canMove = gomApproved || (gomAutoApprovePercent > 0 && contextGomPercent >= gomAutoApprovePercent);
                                return (
                                    <button
                                        onClick={handleMoveToSales}
                                        disabled={isSaving || isStalled || !canMove}
                                        className={`px-4 py-2 rounded-md font-medium disabled:opacity-50 ${canMove && !isStalled ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-300 text-slate-600 cursor-not-allowed'}`}
                                        title={!canMove ? 'GOM must be approved first (see GOM Calculator tab)' : ''}
                                    >
                                        {isSaving ? 'Moving...' : 'Move to Sales'}
                                    </button>
                                );
                            })()}
                        </>
                    )}
                    {canWorkSalesStage && opportunityStage === 2 && !isLost && currentStageName === 'Proposal' && (
                        <>
                            <button
                                onClick={() => { setLostModalType('Proposal Lost'); setShowLostModal(true); }}
                                disabled={isSaving || isStalled}
                                className="px-4 py-2 bg-white border border-rose-300 text-rose-600 rounded-md font-medium hover:bg-rose-50 disabled:opacity-50"
                            >
                                <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Proposal Lost</span>
                            </button>
                            <button
                                onClick={handleSendBackForReestimate}
                                disabled={isSaving || isStalled}
                                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md font-medium hover:bg-slate-50 disabled:opacity-50"
                            >
                                <span className="flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /> Send for Re-estimate</span>
                            </button>
                            <button
                                onClick={handleProposalSent}
                                disabled={isSaving || isStalled}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:bg-slate-400"
                            >
                                {isSaving ? 'Sending...' : 'Mark Proposal Sent'}
                            </button>
                        </>
                    )}
                    {canWorkSalesStage && opportunityStage === 2 && !isLost && currentStageName === 'Negotiation' && (
                        <>
                            <button
                                onClick={() => { setLostModalType('Closed Lost'); setShowLostModal(true); }}
                                disabled={isSaving || isStalled}
                                className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-md font-medium hover:bg-red-50 disabled:opacity-50"
                            >
                                <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Mark as Lost</span>
                            </button>
                            <button
                                onClick={handleSendBackForReestimate}
                                disabled={isSaving || isStalled}
                                className="px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-md font-medium hover:bg-amber-50 disabled:opacity-50"
                            >
                                {isSaving ? 'Sending...' : 'Send Back for Re-estimate'}
                            </button>
                            <button
                                onClick={handleMoveToProject}
                                disabled={isSaving || isStalled}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-md font-medium hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {isSaving ? 'Converting...' : 'Move to Project'}
                            </button>
                        </>
                    )}
                    {isLost && (
                        <span className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-md font-semibold text-sm">
                            <XCircle className="w-4 h-4" /> {currentStageName || 'Closed Lost'}
                        </span>
                    )}
                    {hasEditAccess && opportunityStage < 3 && !isLost && (
                        <button 
                            onClick={handleHoldToggle}
                            disabled={isSaving}
                            className={`px-4 py-2 text-white rounded-md font-medium disabled:opacity-50 ${isStalled ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
                            {isStalled ? 'Reactivate' : 'Hold'}
                        </button>
                    )}
                </div>
            </div>

            {/* Detailed Status Banner */}
            {(detailedStatus === 'Sent for Re-estimate' || detailedStatus === 'Re-estimation') && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800">
                    <RefreshCw className="w-4 h-4 flex-shrink-0 text-amber-500" />
                    <div>
                        <span className="font-semibold text-sm">Sent for Re-estimation</span>
                        <span className="text-xs ml-2 text-amber-600">{'-'} This opportunity was sent back for re-estimation by the Sales team</span>
                    </div>
                </div>
            )}
            {detailedStatus === 'Estimation Submitted' && (
                <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-indigo-800">
                    <Check className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                    <div>
                        <span className="font-semibold text-sm">Estimation Submitted</span>
                        <span className="text-xs ml-2 text-indigo-600">{'-'} Estimation has been submitted to the Sales team for review</span>
                    </div>
                </div>
            )}
            {detailedStatus === 'Re-estimation Submitted' && (
                <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-purple-800">
                    <Check className="w-4 h-4 flex-shrink-0 text-purple-500" />
                    <div>
                        <span className="font-semibold text-sm">Re-estimation Submitted</span>
                        <span className="text-xs ml-2 text-purple-600">{'-'} Updated re-estimation has been submitted to Sales</span>
                    </div>
                </div>
            )}

            {/* Stepper Navigation */}
            <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                <div className="flex w-full mt-1 h-8 bg-slate-50 rounded-full overflow-hidden border border-slate-200">
                    {steps.filter(step => step !== "SOW").map((step) => {
                        const idx = steps.indexOf(step);
                        // Map step idx to DB stage: 0=Pipeline, 1=Presales, 2=Sales, 3=SOW (accessible at stage 2+), 4=Project (stage 3)
                        const stageForIdx = idx <= 2 ? idx : idx === 3 ? 2 : 3;
                        const isCompleted = idx <= 2 ? idx < opportunityStage : idx === 3 ? opportunityStage >= 3 : opportunityStage === 3;
                        const isActive = idx === activeStep;
                        const hasStepAccess =
                            idx === 0 ? canViewPipeline :
                            idx === 1 ? canViewPresales :
                            idx === 2 ? canViewSales :
                            canViewProject;
                        const isAccessible = opportunityStage >= stageForIdx && hasStepAccess;

                        let bgClass = "bg-slate-100 text-slate-300 cursor-not-allowed";
                        if (isAccessible) {
                            bgClass = "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer";
                        }
                        if (isCompleted && !isActive) bgClass = "bg-emerald-500 text-white cursor-pointer";
                        if (isCompleted && isActive) bgClass = "bg-emerald-700 text-white cursor-pointer ring-2 ring-emerald-300";
                        if (isActive && !isCompleted) bgClass = "bg-indigo-900 text-white cursor-pointer";

                        return (
                            <button
                                key={step}
                                onClick={() => { if (isAccessible) setActiveStep(idx); }}
                                disabled={!isAccessible}
                                className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors relative ${bgClass}`}
                            >
                                {isCompleted && <Check className="w-4 h-4" />}
                                {step}
                                {/* Chevron Separator */}
                                {idx !== steps.length - 1 && (
                                    <div className={`absolute right-0 top-0 bottom-0 w-[1px] transform skew-x-12 translate-x-3 z-10 
                                        ${isCompleted && idx + 1 <= opportunityStage ? 'bg-emerald-500 border-r border-emerald-400' : 'bg-white border-r border-slate-300'}`}
                                    ></div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Project Title Header */}
            <div className="mt-4 mb-2 flex items-center justify-between">
                <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
                    <Briefcase className="w-6 h-6 text-indigo-600" />
                    {formData.projectName || "New Opportunity"}
                </h1>
            </div>

            {/* PIPELINE VIEW (Step 0) */}
            {activeStep === 0 && (() => {
                // D2 rule: Pipeline tab stays editable through Pipeline, Presales, and Sales
                // stages — it only freezes once the proposal is sent to the client
                // (Negotiation onwards) or the opportunity is Closed/Lost/On Hold.
                // Client name, country, and region freeze the moment the opportunity
                // moves OUT of Pipeline (stage > 0).
                const isPipelineEditable = canEditPipeline && opportunityStage < 3 && !isLost && !isStalled && currentStageName !== 'Negotiation';
                const isClientCountryEditable = isPipelineEditable && opportunityStage === 0;
                const hasAssignmentEdit = canEditSalesRepAssignment || canEditManagerAssignment || canEditPresalesAssignment;
                const managerOptions = managers.map(m => ({ value: m.name, label: `${m.name}${m.department ? ` (${m.department})` : ''}` }));
                if (opportunityManagerName && !managerOptions.some(o => o.value === opportunityManagerName)) {
                    managerOptions.unshift({ value: opportunityManagerName, label: opportunityManagerName });
                }
                const presalesOptions = presalesTeam.map(p => ({ value: p.name, label: `${p.name}${p.department ? ` (${p.department})` : ''}` }));
                const disabledClass = !isPipelineEditable ? "bg-slate-50 cursor-not-allowed opacity-70" : "bg-white";
                return (
                <div className="space-y-4 mt-4">
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                    {/* ... Existing Pipeline Form Code ... */}
                    <div className="mb-4 flex items-center gap-3">
                        <h2 className="text-base font-bold text-slate-900">Basic Information</h2>
                        {!isPipelineEditable && !isLost && currentStageName !== 'Proposal' && currentStageName !== 'Negotiation' && (
                            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold border border-slate-200">
                                Read Only
                            </span>
                        )}
                        {(isStalled || detailedStatus === 'On Hold') && (
                            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-300">
                                On Hold
                            </span>
                        )}
                        {isLost && (
                            <span className="px-3 py-1 rounded-full bg-red-100 text-red-600 text-xs font-semibold border border-red-200">
                                {currentStageName === 'Proposal Lost' ? 'Proposal Lost' : 'Closed Lost'}
                            </span>
                        )}
                        {!isLost && opportunityStage === 0 && (
                            <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-600 text-xs font-semibold border border-purple-200">
                                Just Received
                            </span>
                        )}
                        {!isLost && opportunityStage === 1 && (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getBadgeClass()}`}>{getBadgeText()}</span>
                        )}
                        {!isLost && opportunityStage === 2 && currentStageName === 'Proposal' && (
                            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-600 text-xs font-semibold border border-amber-200">
                                Proposal Submitted
                            </span>
                        )}
                        {!isLost && opportunityStage === 2 && currentStageName === 'Negotiation' && (
                            <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-600 text-xs font-semibold border border-orange-200">
                                Under Negotiation
                            </span>
                        )}
                        {!isLost && opportunityStage === 3 && (
                            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-600 text-xs font-semibold border border-emerald-200">
                                SOW Approved
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                        {/* Row 1 */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Client Name *</label>
                            <div className="flex gap-2">
                                <SearchableSelect
                                    name="clientName"
                                    value={formData.clientName}
                                    options={clients.map(c => ({ value: c.name, label: c.name }))}
                                    onChange={handleChange}
                                    placeholder="Select Client"
                                    disabled={!isClientCountryEditable}
                                    required={true}
                                />
                                <button type="button" onClick={() => setShowAddClient(true)} disabled={!isClientCountryEditable} className="p-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Country</label>
                            <SearchableSelect
                                name="country"
                                value={formData.country}
                                options={countries.map(c => ({ value: c, label: c }))}
                                onChange={handleChange}
                                placeholder="Select Country"
                                disabled={!isClientCountryEditable}
                                required={false}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Region *</label>
                            <SearchableSelect
                                name="region"
                                value={formData.region}
                                options={regions.map(r => ({ value: r, label: r }))}
                                onChange={handleChange}
                                placeholder="Select Region"
                                disabled={!isClientCountryEditable || !!formData.country}
                                required={true}
                            />
                            {formData.country && <p className="text-xs text-slate-400 mt-0.5">Auto-set from country</p>}
                        </div>

                        {/* Row 1b: Project Type */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Project Type *</label>
                            <SearchableSelect
                                name="projectType"
                                value={formData.projectType}
                                options={projectTypes.map((t: string) => ({ value: t, label: t }))}
                                onChange={handleChange}
                                placeholder="Select Project Type"
                                disabled={!isPipelineEditable}
                                required={true}
                            />
                        </div>

                        {/* Row 2 */}
                        <div className="col-span-1 md:col-span-2 space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Project Name *</label>
                            <input
                                type="text"
                                name="projectName"
                                required
                                value={formData.projectName}
                                placeholder="XXX--XXX- Project Details"
                                disabled={!isPipelineEditable}
                                className={`w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm shadow-sm ${disabledClass}`}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Practice</label>
                            <SearchableSelect
                                name="practice"
                                value={formData.practice}
                                options={departments.map(p => ({ value: p, label: p }))}
                                onChange={handleChange}
                                placeholder="Find Practice"
                                disabled={!isPipelineEditable}
                                required={false}
                            />
                        </div>

                        {/* Row 3 */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Sales Representative *</label>
                            <SearchableSelect
                                name="salesRep"
                                value={formData.salesRep}
                                options={salespersons.map(s => ({ value: s.name, label: `${s.name}${s.department ? ` (${s.department})` : ''}` }))}
                                onChange={handleChange}
                                placeholder="Find SalesPerson"
                                disabled={!canEditSalesRepAssignment}
                                required={true}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Manager</label>
                            <SearchableSelect
                                name="managerName"
                                value={opportunityManagerName}
                                options={managerOptions}
                                onChange={(e: any) => {
                                    const nextManager = e.target.value;
                                    setOpportunityManagerName(nextManager);
                                    setPresalesForm(prev => ({ ...prev, managerName: nextManager }));
                                }}
                                placeholder={isLoadingManagers ? "Loading managers..." : "Select Manager"}
                                disabled={!canEditManagerAssignment || isLoadingManagers}
                                required={false}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Presales Assignee</label>
                            <SearchableMultiSelect
                                name="presalesAssignee"
                                value={formData.presalesAssignee}
                                options={presalesOptions}
                                onChange={handleChange}
                                placeholder={isLoadingPresalesTeam ? "Loading presales..." : "Select Presales"}
                                disabled={!canEditPresalesAssignment || isLoadingPresalesTeam}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Technology *</label>
                            <div className="relative" ref={techDropdownRef}>
                                <input type="text" name="technology" value={formData.technology || ''} readOnly className="absolute bottom-0 left-0 w-full h-0 opacity-0 pointer-events-none" required tabIndex={-1} />
                                <div
                                    className={`w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-md text-sm shadow-sm flex flex-wrap gap-1 ${isPipelineEditable ? 'bg-white cursor-pointer' : 'bg-slate-50 cursor-not-allowed opacity-70'}`}
                                    onClick={() => { if (isPipelineEditable) setTechDropdownOpen(!techDropdownOpen); }}
                                >
                                    {formData.technology ? formData.technology.split(',').filter(Boolean).map((t, i) => (
                                        <span key={`${t}-${i}`} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full border border-indigo-200">
                                            {t}
                                            <button type="button" onClick={(e) => {
                                                e.stopPropagation();
                                                const newTech = formData.technology.split(',').filter(x => x !== t).join(',');
                                                setFormData(prev => ({ ...prev, technology: newTech }));
                                            }} className="hover:text-red-500">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    )) : <span className="text-slate-400">Select Technologies</span>}
                                </div>
                                {techDropdownOpen && (
                                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
                                        <div className="p-2 border-b border-slate-100">
                                            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md">
                                                <Search className="w-3.5 h-3.5 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search technologies..."
                                                    value={techSearch}
                                                    onChange={(e) => setTechSearch(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const filtered = technologies.filter(t => t.toLowerCase().includes(techSearch.toLowerCase()));
                                                            if (filtered.length > 0) {
                                                                const t = filtered[0];
                                                                const current = formData.technology.split(',').filter(Boolean);
                                                                const selected = current.includes(t);
                                                                const newTech = selected
                                                                    ? current.filter(x => x !== t).join(',')
                                                                    : [...current, t].join(',');
                                                                setFormData(prev => ({ ...prev, technology: newTech }));
                                                            }
                                                        }
                                                    }}
                                                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                            {technologies.filter(t => t.toLowerCase().includes(techSearch.toLowerCase())).map(t => {
                                                const selected = formData.technology.split(',').filter(Boolean).includes(t);
                                                return (
                                                    <label key={t} className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 ${selected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}>
                                                        <input
                                                            type="checkbox"
                                                            className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                            checked={selected}
                                                            onChange={() => {
                                                                const current = formData.technology.split(',').filter(Boolean);
                                                                const newTech = selected
                                                                    ? current.filter(x => x !== t).join(',')
                                                                    : [...current, t].join(',');
                                                                setFormData(prev => ({ ...prev, technology: newTech }));
                                                            }}
                                                        />
                                                        {t}
                                                    </label>
                                                );
                                            })}
                                            {technologies.filter(t => t.toLowerCase().includes(techSearch.toLowerCase())).length === 0 && (
                                                <div className="px-3 py-4 text-sm text-slate-400 text-center">No technologies found</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pricing Model */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Pricing Model</label>
                            <SearchableSelect
                                name="pricingModel"
                                value={formData.pricingModel}
                                options={pricingModels.map(m => ({ value: m, label: m }))}
                                onChange={handleChange}
                                placeholder="Select Model"
                                disabled={!isPipelineEditable}
                                required={false}
                            />
                        </div>

                        {/* Day Rate (only for Staffing) */}
                        {formData.projectType === 'Staffing' && (
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Expected Day Rate ({getSymbol(globalCurrency)}) *</label>
                            <input
                                type="number"
                                name="expectedDayRate"
                                required
                                value={formData.expectedDayRate}
                                placeholder="0"
                                disabled={!isPipelineEditable}
                                className={`w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm shadow-sm ${disabledClass}`}
                                onChange={handleChange}
                            />
                        </div>
                        )}

                        {/* Value */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Estimated Value ({getSymbol(globalCurrency)})</label>
                            {formData.projectType === 'Staffing' ? (
                            <>
                                <input
                                    type="number"
                                    name="value"
                                    readOnly
                                    value={formData.value}
                                    placeholder="0.00"
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-sm shadow-sm text-slate-500 cursor-not-allowed"
                                />
                                <p className="text-[10px] text-slate-400">= Day Rate ({formData.expectedDayRate || 0}) × 20 days × {Math.round(durationToMonths(Number(formData.duration) || 0, formData.durationUnit) * 100) / 100} months</p>
                            </>
                            ) : (
                                <input
                                    type="number"
                                    name="value"
                                    value={formData.value !== undefined ? formData.value : ''}
                                    placeholder="0.00"
                                    disabled={!isPipelineEditable}
                                    className={`w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm shadow-sm ${isPipelineEditable ? 'bg-white' : 'bg-slate-50 cursor-not-allowed opacity-70'}`}
                                    onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value === '' ? ('' as any) : Number(e.target.value) }))}
                                />
                            )}
                            {originalData && originalData.currency !== globalCurrency && originalData.value > 0 && (
                                <div className="text-xs text-slate-500 font-medium mt-1">
                                    <span className="text-slate-400 mr-1 font-normal">Original:</span>
                                    {getSymbol(originalData.currency)}{originalData.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </div>
                            )}
                        </div>

                        {/* Row 4: Dates & Duration */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Tentative Start Date *</label>
                            <input
                                type="date"
                                name="tentativeStartDate"
                                required
                                value={formData.tentativeStartDate}
                                disabled={!isPipelineEditable}
                                className={`w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm shadow-sm text-slate-500 ${isPipelineEditable ? 'cursor-pointer' : 'cursor-not-allowed bg-slate-50 opacity-70'}`}
                                onChange={handleChange}
                                onClick={(e) => { if (isPipelineEditable) (e.target as HTMLInputElement).showPicker?.(); }}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Duration</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    name="duration"
                                    min="1"
                                    value={formData.duration}
                                    disabled={!isPipelineEditable}
                                    placeholder="Enter duration"
                                    className={`flex-1 px-3 py-2.5 border border-slate-300 rounded-md text-sm shadow-sm ${disabledClass}`}
                                    onChange={handleChange}
                                />
                                <select
                                    name="durationUnit"
                                    value={formData.durationUnit}
                                    disabled={!isPipelineEditable}
                                    className={`w-28 px-3 py-2.5 border border-slate-300 rounded-md text-sm shadow-sm ${disabledClass}`}
                                    onChange={handleChange}
                                >
                                    {DURATION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Tentative End Date</label>
                            <input
                                type="date"
                                name="tentativeEndDate"
                                readOnly
                                value={formData.tentativeEndDate}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-sm shadow-sm text-slate-500 cursor-not-allowed"
                            />
                            <p className="text-[10px] text-slate-400">Auto-calculated from Start Date + Duration</p>
                        </div>

                        {/* Row 5: Description & Attachments */}
                        <div className="col-span-1 md:col-span-2 space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Description</label>
                            <textarea
                                name="description"
                                placeholder="Project Description..."
                                rows={4}
                                value={formData.description}
                                disabled={!isPipelineEditable}
                                className={`w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm shadow-sm resize-none ${isPipelineEditable ? 'bg-white' : 'bg-slate-50 cursor-not-allowed opacity-70'}`}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Attachments</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                disabled={!canManageAttachments}
                                onChange={(e) => handleFileUpload(e.target.files)}
                            />
                            {attachments.length === 0 ? (
                                <div className="mt-1 border border-slate-300 rounded-md p-4 bg-white flex flex-col items-center justify-center text-slate-400 gap-2 border-dashed h-[120px]">
                                    <span className="text-xs">No files attached.</span>
                                    {canManageAttachments && (
                                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-1 text-slate-600 font-semibold text-xs hover:text-indigo-600">
                                            <Upload className="w-3 h-3" />
                                            {isUploading ? "Uploading..." : "Attach file"}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="max-h-[120px] overflow-y-auto space-y-1.5">
                                        {attachments.map(att => (
                                            <div key={att.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FileText className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                                                    <button type="button" onClick={() => handleDownloadAttachment(att.id, att.fileName)} className="text-indigo-600 hover:underline truncate text-left">{att.fileName}</button>
                                                    <span className="text-slate-400">{(att.fileSize / 1024).toFixed(0)} KB</span>
                                                </div>
                                                {canManageAttachments && (
                                                    <button type="button" onClick={() => handleDeleteAttachment(att.id)} className="text-slate-400 hover:text-red-600 flex-shrink-0">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {canManageAttachments && (
                                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-1 text-slate-600 font-semibold text-xs hover:text-indigo-600">
                                            <Upload className="w-3 h-3" />
                                            {isUploading ? "Uploading..." : "Attach more"}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Footer Actions */}
                    <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
                        {canEditPipeline && opportunityStage === 0 && !isLost && !isStalled && (
                            <button
                                type="button"
                                onClick={() => { setLostModalType('Closed Lost'); setShowLostModal(true); }}
                                className="px-4 py-2 border border-red-200 text-red-600 rounded-md font-semibold text-sm hover:bg-red-50 flex items-center gap-2 transition-colors"
                            >
                                <XCircle className="w-4 h-4" /> Mark as Lost
                            </button>
                        )}
                        {(isPipelineEditable || hasAssignmentEdit) && (
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-6 py-2 bg-blue-600 border border-transparent rounded-md text-white font-bold hover:bg-blue-700 transition-all disabled:opacity-70"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        )}
                    </div>
                </form>
                </div>
                );
            })()}

            {/* PRESALES VIEW (Step 1) */}
            {activeStep === 1 && (
                <OpportunityEstimationProvider
                    opportunityId={id}
                    readOnly={!canEditPresalesData || opportunityStage >= 2 || isStalled || isLost}
                    startDate={formData.tentativeStartDate}
                    endDate={formData.tentativeEndDate}
                    durationInDays={
                        formData.durationUnit === 'months' && formData.tentativeStartDate
                            ? countWorkingDaysInPeriod(formData.tentativeStartDate, Number(formData.duration) || 0, holidays)
                            : durationToWorkingDays(Number(formData.duration) || 0, formData.durationUnit)
                    }
                    salesTargetRevenue={getPipelineProjectedRevenueBase()}
                    isReEstimation={detailedStatus === 'Re-estimation' || detailedStatus === 'Sent for Re-estimate'}
                    initialCurrency={globalCurrency}
                    currentUserName={user?.name || ''}
                >
                    <GomPercentSync onGomPercentChange={setContextGomPercent} />
                    {opportunityStage < 2 && activeTab !== "View Estimate" && (
                        <PresalesSaveButton onAfterSave={(gomPct) => {
                            if (gomAutoApprovePercent <= 0) return;
                            const gomChangedSinceApproval = approvedGomPercent != null && Math.abs(gomPct - approvedGomPercent) > 0.05;
                            if (gomPct >= gomAutoApprovePercent && !gomApproved) {
                                handleApproveGom(true);
                            } else if (gomPct < gomAutoApprovePercent && gomApproved && gomChangedSinceApproval) {
                                handleApproveGom(false);
                            }
                        }} />
                    )}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                        {isLost && (
                            <div className="mx-4 mt-3 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 font-medium">
                                {currentStageName === 'Proposal Lost' ? 'Proposal Lost' : 'Closed Lost'} - All fields are read-only.
                            </div>
                        )}
                        {!isLost && opportunityStage >= 2 && (
                            <div className="mx-4 mt-3 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700 font-medium">
                                {opportunityStage === 3 ? 'SOW Approved' : currentStageName === 'Negotiation' ? 'Under Negotiation' : currentStageName || 'Sales'} - All fields are read-only.
                            </div>
                        )}
                        {/* Inner Tabs */}
                        <div className="flex items-center gap-4 px-4 border-b border-slate-200 text-sm font-medium">
                            {[
                                ...(canViewPresales ? ["Project Details", "Schedule", "Resource Assignment"] : []),
                                ...(opportunityAccess?.permissions?.gom?.view || opportunityAccess?.permissions?.approvals?.manage ? ["GOM Calculator"] : []),
                                ...(canViewPresales ? ["View Estimate"] : []),
                            ].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`py-3 border-b-2 transition-colors ${activeTab === tab ? "border-indigo-600 text-indigo-900 font-bold" : "border-transparent text-slate-500 hover:text-indigo-600"}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* TAB CONTENT: Project Details */}
                        {activeTab === "Project Details" && (
                            <div className="p-5 space-y-4 animate-in fade-in duration-300">

                                {/* Status Badge */}
                                <div className="mb-3">
                                    <h2 className="text-base font-bold text-slate-900 inline-block mr-3">Project Details</h2>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getBadgeClass()}`}>
                                        {getBadgeText()}
                                    </span>
                                </div>

                                {/* Read Only Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-sm">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Client Name</label>
                                        <div className="font-semibold text-slate-800">{formData.clientName}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Country</label>
                                        <div className="font-semibold text-slate-800">{formData.country || <span className="text-slate-400">-</span>}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Region</label>
                                        <div className="font-semibold text-slate-800">{formData.region}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Project Name</label>
                                        <div className="font-semibold text-slate-800">{formData.projectName}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Type of Opportunity</label>
                                        <div className="font-semibold text-slate-800">{formData.projectType}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Practice</label>
                                        <div className="font-semibold text-slate-800">{formData.practice}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Proposal Due Date</label>
                                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                                            {presalesForm.proposalDueDate || <span className="text-slate-400">-</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Sales Representative</label>
                                        <div className="font-semibold text-slate-800">{formData.salesRep}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Manager</label>
                                        <div className="font-semibold text-slate-800">{opportunityManagerName || <span className="text-slate-400">-</span>}</div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Pricing Model</label>
                                        <div className="font-semibold text-slate-800">{formData.pricingModel}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Duration</label>
                                        <div className="font-semibold text-slate-800">{formData.duration ? `${formData.duration} ${formData.durationUnit || 'months'}` : "N/A"}</div>
                                    </div>
                                    {formData.expectedDayRate && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Expected Day Rate</label>
                                        <div className="font-semibold text-slate-800">{formData.expectedDayRate}</div>
                                    </div>
                                    )}
                                    {Number(formData.value) > 0 && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Estimated Value</label>
                                        <div className="font-semibold text-slate-800">
                                            {getSymbol(globalCurrency)}{Number(formData.value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                            {originalData && originalData.currency !== globalCurrency && originalData.value > 0 && (
                                                <div className="text-xs text-slate-500 font-medium mt-0.5">
                                                    <span className="text-slate-400 font-normal">Original: </span>
                                                    {getSymbol(originalData.currency)}{originalData.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    )}
                                    {Number(adjustedEstimatedValue) > 0 && (
                                    <div>
                                        <label className="block text-xs font-semibold text-amber-600 uppercase mb-1">Adjusted Quote Value</label>
                                        <div className="font-bold text-amber-700">
                                            {cSym}{Number(adjustedEstimatedValue).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                            {opportunityCurrency && globalCurrency && opportunityCurrency !== globalCurrency && (
                                                <span className="text-xs text-slate-500 ml-1">
                                                    ({getSymbol(globalCurrency)}{(Number(adjustedEstimatedValue) * getRate(globalCurrency) / getRate(opportunityCurrency)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    )}
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Description</label>
                                        <div className="font-semibold text-slate-800 whitespace-pre-wrap">{formData.description}</div>
                                    </div>
                                </div>

                                {/* Divider */}
                                <hr className="border-slate-100" />

                                {/* Attachments */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                                        <h3 className="font-bold text-slate-900">Attachments</h3>
                                        {opportunityStage < 2 && (
                                            <>
                                                <input ref={fileInputRef} type="file" multiple className="hidden" disabled={!canEditPresalesAttachments} onChange={(e) => handleFileUpload(e.target.files)} />
                                                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading || !canEditPresalesAttachments} className="px-3 py-1.5 bg-slate-100 text-slate-700 font-medium rounded text-xs hover:bg-slate-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                                    <Paperclip className="w-3 h-3" /> {isUploading ? "Uploading..." : "Attach"}
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    <div className="bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
                                        <table className="w-full text-xs text-left text-slate-600">
                                            <thead className="bg-slate-100 border-b border-slate-200 font-semibold">
                                                <tr>
                                                    <th className="px-3 py-2">File Name</th>
                                                    <th className="px-3 py-2">File Type</th>
                                                    <th className="px-3 py-2">Upload Date</th>
                                                    <th className="px-3 py-2">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {attachments.length === 0 ? (
                                                    <tr>
                                                        <td className="px-3 py-6 text-center text-slate-400 italic" colSpan={4}>No attachments found</td>
                                                    </tr>
                                                ) : attachments.map(att => (
                                                    <tr key={att.id} className="border-b border-slate-100 hover:bg-slate-100">
                                                        <td className="px-3 py-2">
                                                            <button type="button" onClick={() => handleDownloadAttachment(att.id, att.fileName)} className="text-indigo-600 hover:underline text-left">{att.fileName}</button>
                                                        </td>
                                                        <td className="px-3 py-2">{att.fileType}</td>
                                                        <td className="px-3 py-2">{new Date(att.uploadedAt).toLocaleDateString()}</td>
                                                        <td className="px-3 py-2 flex items-center gap-2">
                                                            <button type="button" onClick={() => handleDownloadAttachment(att.id, att.fileName)} className="text-slate-400 hover:text-indigo-600"><Download className="w-3.5 h-3.5" /></button>
                                                            {opportunityStage < 2 && canEditPresalesAttachments && (
                                                                <button onClick={() => handleDeleteAttachment(att.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB CONTENT: Schedule */}
                        {activeTab === "Schedule" && (
                            <div className="p-5 space-y-4 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-base font-bold text-slate-900">Schedule Details</h2>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getBadgeClass()}`}>
                                            {getBadgeText()}
                                        </span>
                                    </div>
                                    {canEditPresalesData && opportunityStage < 2 && (
                                        <button onClick={async () => {
                                            setIsSaving(true);
                                            try {
                                                const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
                                                    method: 'PATCH',
                                                    headers: getAuthHeaders(),
                                                    body: JSON.stringify({
                                                        tentativeStartDate: formData.tentativeStartDate,
                                                        tentativeEndDate: formData.tentativeEndDate,
                                                        duration: formData.duration,
                                                        durationUnit: formData.durationUnit,
                                                        technology: formData.technology,
                                                        projectType: formData.projectType,
                                                        salesRepName: formData.salesRep,
                                                        managerName: opportunityManagerName,
                                                        presalesAssigneeName: formData.presalesAssignee,
                                                    })
                                                });
                                                if (res.ok) toast({ title: "Success", description: "Schedule updated." });
                                                else toast({ title: "Error", description: "Failed to update schedule." });
                                            } catch { toast({ title: "Error", description: "Failed to update schedule." }); }
                                            finally { setIsSaving(false); }
                                        }} disabled={isSaving} className="px-6 py-2 bg-white border border-blue-200 text-blue-600 font-semibold rounded-md hover:bg-blue-50 disabled:opacity-50">
                                            {isSaving ? 'Saving...' : 'Update'}
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-bold text-slate-700">Tentative Start Date *</label>
                                        <input
                                            type="date"
                                            name="tentativeStartDate"
                                            value={formData.tentativeStartDate}
                                            onChange={handleChange}
                                            disabled={!canEditPresalesData || opportunityStage >= 2}
                                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm disabled:bg-slate-100 disabled:cursor-not-allowed cursor-pointer"
                                            onClick={(e) => !(e.target as HTMLInputElement).disabled && (e.target as HTMLInputElement).showPicker?.()}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-bold text-slate-700">Duration *</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                name="duration"
                                                min="1"
                                                value={formData.duration}
                                                onChange={handleChange}
                                                disabled={!canEditPresalesData || opportunityStage >= 2}
                                                placeholder="Enter duration"
                                                className="flex-1 px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                            />
                                            <select
                                                name="durationUnit"
                                                value={formData.durationUnit}
                                                onChange={handleChange}
                                                disabled={!canEditPresalesData || opportunityStage >= 2}
                                                className="w-28 px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                            >
                                                {DURATION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-bold text-slate-700">Tentative End Date</label>
                                        <input
                                            type="date"
                                            name="tentativeEndDate"
                                            readOnly
                                            value={formData.tentativeEndDate}
                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-sm shadow-sm text-slate-500 cursor-not-allowed"
                                        />
                                        <p className="text-[10px] text-slate-400">Auto-calculated from Start Date + Duration</p>
                                    </div>
                                </div>
                            </div>
                        )}



                        {/* TAB CONTENT: Resource Assignment */}
                        {activeTab === "Resource Assignment" && (
                            <div className="p-5">
                                <ResourceAssignmentTab />
                            </div>
                        )}

                        {/* Old GOM Calculator (Hidden) */}
                        {activeTab === "OldResourceAssignment" && (
                            <div className="p-5 space-y-4 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-base font-bold text-slate-900">Resource Assignment</h2>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getBadgeClass()}`}>{getBadgeText()}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    {/* Inputs Column */}
                                    <div className="lg:col-span-1 space-y-4">
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                <Briefcase className="w-4 h-4 text-indigo-600" />
                                                Cost Inputs
                                            </h3>

                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Annual CTC</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">{gomInputs.currency}</span>
                                                        <input
                                                            type="number"
                                                            value={gomInputs.annualCTC}
                                                            onChange={(e) => setGomInputs({ ...gomInputs, annualCTC: Number(e.target.value) })}
                                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Delivery Mgmt (%)</label>
                                                        <input
                                                            type="number"
                                                            value={gomInputs.deliveryMgmt}
                                                            onChange={(e) => setGomInputs({ ...gomInputs, deliveryMgmt: Number(e.target.value) })}
                                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Addl. Bench (%)</label>
                                                        <input
                                                            type="number"
                                                            value={gomInputs.benchCost}
                                                            onChange={(e) => setGomInputs({ ...gomInputs, benchCost: Number(e.target.value) })}
                                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Currency & Rate</label>
                                                    <div className="flex gap-2">
                                                        <select
                                                            value={gomInputs.currency}
                                                            onChange={(e) => setGomInputs({ ...gomInputs, currency: e.target.value })}
                                                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                                                        >
                                                            <option value="INR">INR</option>
                                                            <option value="USD">USD</option>
                                                            <option value="EUR">EUR</option>
                                                        </select>
                                                        <input
                                                            type="number"
                                                            value={gomInputs.exchangeRate}
                                                            onChange={(e) => setGomInputs({ ...gomInputs, exchangeRate: Number(e.target.value) })}
                                                            placeholder="Rate"
                                                            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Onsite Allowance</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">+</span>
                                                        <input
                                                            type="number"
                                                            value={gomInputs.onsiteAllowance}
                                                            onChange={(e) => setGomInputs({ ...gomInputs, onsiteAllowance: Number(e.target.value) })}
                                                            className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                <RefreshCw className="w-4 h-4 text-emerald-600" />
                                                Margin & Markup
                                            </h3>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Markup Percentage (%)</label>
                                                <div className="relative">
                                                    <Percent className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                                    <input
                                                        type="number"
                                                        value={gomInputs.markupPercent}
                                                        onChange={(e) => setGomInputs({ ...gomInputs, markupPercent: Number(e.target.value), calcMode: 'markup' })}
                                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Period Estimation */}
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-amber-600" />
                                                Period Estimation
                                            </h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Duration (Months)</label>
                                                    <input
                                                        type="number"
                                                        value={gomInputs.durationMonths}
                                                        onChange={(e) => setGomInputs({ ...gomInputs, durationMonths: Number(e.target.value) })}
                                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Working Days</label>
                                                    <input
                                                        type="number"
                                                        value={gomInputs.workingDays}
                                                        onChange={(e) => setGomInputs({ ...gomInputs, workingDays: Number(e.target.value) })}
                                                        className={`w-full px-4 py-2 bg-slate-50 border rounded-lg text-sm ${gomInputs.workingDays / gomInputs.durationMonths > 22 ? 'border-amber-500 text-amber-700' : 'border-slate-200'}`}
                                                    />
                                                </div>
                                            </div>
                                            {gomInputs.workingDays / gomInputs.durationMonths > 22 && (
                                                <div className="flex items-center gap-2 text-amber-600 text-xs mt-2 bg-amber-50 p-2 rounded">
                                                    <Info className="w-3 h-3" />
                                                    <span>Warning: {Math.round(gomInputs.workingDays / gomInputs.durationMonths)} days/month exceeds typical 22 days.</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Results Column */}
                                    <div className="lg:col-span-2 space-y-4">
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Calculation Results</h3>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                                <div className="space-y-4">
                                                    <h4 className="font-semibold text-indigo-600 flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-indigo-500" /> Offshore
                                                    </h4>
                                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                        <p className="text-xs text-slate-500 mb-1">Cost Per Day</p>
                                                        <p className="text-2xl font-bold text-slate-800">{gomResults.offshoreDayRate.toLocaleString()} <span className="text-xs font-normal text-slate-400">{gomInputs.currency}</span></p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="p-3 bg-slate-50 rounded-lg">
                                                            <p className="text-xs text-slate-500">Revenue/Day</p>
                                                            <p className="font-semibold text-slate-700">{Math.round(gomResults.offshoreRevenue).toLocaleString()}</p>
                                                        </div>
                                                        <div className="p-3 bg-slate-50 rounded-lg">
                                                            <p className="text-xs text-slate-500">GOM %</p>
                                                            <p className="font-semibold text-emerald-600">{gomResults.offshoreGom.toFixed(1)}%</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                                                        <p className="text-xs text-amber-700 font-medium">Est. Cost ({gomInputs.workingDays} days)</p>
                                                        <p className="text-lg font-bold text-amber-800">{(gomResults.offshoreDayRate * gomInputs.workingDays).toLocaleString()} {gomInputs.currency}</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <h4 className="font-semibold text-purple-600 flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-purple-500" /> Onsite
                                                    </h4>
                                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                        <p className="text-xs text-slate-500 mb-1">Cost Per Day</p>
                                                        <p className="text-2xl font-bold text-slate-800">{gomResults.onsiteDayRate.toLocaleString()} <span className="text-xs font-normal text-slate-400">{gomInputs.currency}</span></p>
                                                        <p className="text-[10px] text-slate-400 mt-1">Includes Per Diem + Allowance</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="p-3 bg-slate-50 rounded-lg">
                                                            <p className="text-xs text-slate-500">Revenue/Day</p>
                                                            <p className="font-semibold text-slate-700">{Math.round(gomResults.onsiteRevenue).toLocaleString()}</p>
                                                        </div>
                                                        <div className="p-3 bg-slate-50 rounded-lg">
                                                            <p className="text-xs text-slate-500">GOM %</p>
                                                            <p className="font-semibold text-emerald-600">{gomResults.onsiteGom.toFixed(1)}%</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                                                        <p className="text-xs text-amber-700 font-medium">Est. Cost ({gomInputs.workingDays} days)</p>
                                                        <p className="text-lg font-bold text-amber-800">{(gomResults.onsiteDayRate * gomInputs.workingDays).toLocaleString()} {gomInputs.currency}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Detailed Stats */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-slate-50 text-slate-500 font-medium border-y border-slate-200">
                                                        <tr>
                                                            <th className="py-2 px-3">Metric</th>
                                                            <th className="py-2 px-3">Value</th>
                                                            <th className="py-2 px-3">Formula / Notes</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        <tr>
                                                            <td className="py-2 px-3 text-slate-800">Adjusted Cost</td>
                                                            <td className="py-2 px-3 font-mono">{gomResults.adjustedCost.toLocaleString()}</td>
                                                            <td className="py-2 px-3 text-slate-400 text-xs">CTC * (1 + (Mgmt+Bench)/100)</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="py-2 px-3 text-slate-800">Annual Working Days</td>
                                                            <td className="py-2 px-3 font-mono">220</td>
                                                            <td className="py-2 px-3 text-slate-400 text-xs">Fixed Standard</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="py-2 px-3 text-slate-800">Actual Profit Margin</td>
                                                            <td className="py-2 px-3 font-mono font-bold text-indigo-600">{gomResults.offshoreProfit.toLocaleString()}%</td>
                                                            <td className="py-2 px-3 text-slate-400 text-xs">(Markup / (1 + Markup%)) * 100</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB CONTENT: View Estimate */}
                        {activeTab === "View Estimate" && (
                            <div className="p-5">
                                <div className="mb-4 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-500 font-medium flex items-center gap-2">
                                    <Info className="w-3.5 h-3.5 shrink-0" />
                                    View only - This tab shows a read-only summary of the estimation. To make changes, use the Resource Assignment or GOM Calculator tabs.
                                </div>
                                <EstimationTab />
                            </div>
                        )}

                        {/* TAB CONTENT: GOM Calculator */}
                        {activeTab === "GOM Calculator" && (
                            <div className="p-5">
                                <GomCalculatorTab
                                    gomApproved={gomApproved}
                                    approvedGomPercent={approvedGomPercent}
                                    onApproveGom={handleApproveGom}
                                    canManagerApprove={(canManageGomApproval || canReviewGomApproval) && opportunityStage === 1 && !isLost}
                                    canRequestApproval={!canApproveGom && canRequestGomApproval && canEditPresalesData && opportunityStage === 1 && !isLost && gomAutoApprovePercent > 0 && contextGomPercent > 0 && contextGomPercent < gomAutoApprovePercent}
                                    isManagerOrAdmin={isManagerOrAdmin}
                                    gomThreshold={gomAutoApprovePercent}
                                    pendingApproval={gomPendingApproval}
                                    onReviewGomApproval={handleReviewGomApproval}
                                />
                            </div>
                        )}
                    </div>
                </OpportunityEstimationProvider>
            )}

            {/* SALES VIEW (Step 2) — Read-only summary with collapsible sections */}
            {activeStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    {/* Lost Banner */}
                    {isLost && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                <XCircle className="w-4 h-4 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-red-800 text-sm">Opportunity Closed - {currentStageName === 'Proposal Lost' ? 'Proposal Lost' : 'Lost'}</h3>
                                <p className="text-sm text-red-700 mt-1"><span className="font-semibold">Remarks:</span> {lostRemarks || 'No remarks provided.'}</p>
                            </div>
                        </div>
                    )}

                    {/* Pipeline Details — Collapsible */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setSalesPipelineOpen(prev => !prev)}
                            className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-slate-50 transition-colors"
                        >
                            <h3 className="text-sm font-bold text-slate-800">Pipeline Details</h3>
                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${salesPipelineOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {salesPipelineOpen && (
                            <div className="px-6 pb-4 border-t border-slate-100 pt-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-sm">
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Client Name</span>
                                        <p className="font-medium text-slate-800 mt-1">{formData.clientName || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Region</span>
                                        <p className="font-medium text-slate-800 mt-1">{formData.region || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Project Type</span>
                                        <p className="font-medium text-slate-800 mt-1">{formData.projectType || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Project Name</span>
                                        <p className="font-medium text-slate-800 mt-1">{formData.projectName || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Practice</span>
                                        <p className="font-medium text-slate-800 mt-1">{formData.practice || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Sales Rep</span>
                                        <p className="font-medium text-slate-800 mt-1">{formData.salesRep || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Manager</span>
                                        <p className="font-medium text-slate-800 mt-1">{opportunityManagerName || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Technology</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {formData.technology
                                                ? formData.technology.split(',').filter(Boolean).map((t, i) => (
                                                    <span key={`${t}-${i}`} className="inline-block bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full border border-indigo-200">{t}</span>
                                                ))
                                                : <p className="font-medium text-slate-800">N/A</p>
                                            }
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Pricing Model</span>
                                        <p className="font-medium text-slate-800 mt-1">{formData.pricingModel || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Start Date</span>
                                        <p className="font-medium text-slate-800 mt-1">{formData.tentativeStartDate || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">End Date</span>
                                        <p className="font-medium text-slate-800 mt-1">{formData.tentativeEndDate || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Duration</span>
                                        <p className="font-medium text-slate-800 mt-1">{formData.duration ? `${formData.duration} ${formData.durationUnit || 'months'}` : "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Expected Day Rate</span>
                                        <p className="font-medium text-slate-800 mt-1">{formData.expectedDayRate || "N/A"}</p>
                                    </div>
                                </div>
                                {formData.description && (
                                    <div className="mt-4 pt-3 border-t border-slate-100">
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Description</span>
                                        <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{formData.description}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Presales Details — Collapsible */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setSalesPresalesOpen(prev => !prev)}
                            className="w-full flex items-center justify-between px-6 py-3 text-left hover:bg-slate-50 transition-colors"
                        >
                            <h3 className="text-sm font-bold text-slate-800">Presales / Estimation Details</h3>
                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${salesPresalesOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {salesPresalesOpen && (
                            <div className="px-6 pb-4 border-t border-slate-100 pt-3">
                                {/* Travel & Cost Details */}
                                <h4 className="text-xs font-semibold text-slate-700 mb-2">Travel & Cost Assumptions</h4>
                                <div className="flex items-center gap-6 mb-3 text-sm">
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Markup %</span>
                                        <p className="font-medium text-slate-800 mt-0.5">{rawPresalesData?.markupPercent || 0}%</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Sales Comm. %</span>
                                        <p className="font-medium text-slate-800 mt-0.5">{rawPresalesData?.salesCommissionPercent || 0}%</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Pre-Sales Cost %</span>
                                        <p className="font-medium text-slate-800 mt-0.5">{rawPresalesData?.preSalesCostPercent || 0}%</p>
                                    </div>
                                </div>
                                {(() => {
                                    const tc = rawPresalesData?.travelCosts;
                                    // New array format
                                    if (Array.isArray(tc) && tc.length > 0) {
                                        const total = tc.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
                                        return (
                                            <div className="mb-4">
                                                <table className="w-full text-sm border border-slate-200 rounded-md overflow-hidden">
                                                    <thead className="bg-slate-50">
                                                        <tr>
                                                            <th className="text-left px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase">Category</th>
                                                            <th className="text-left px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase">Description</th>
                                                            <th className="text-right px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {tc.map((entry: any, i: number) => (
                                                            <tr key={entry.id || i} className="border-t border-slate-100">
                                                                <td className="px-3 py-1.5 text-slate-700">{entry.category || "-"}</td>
                                                                <td className="px-3 py-1.5 text-slate-600">{entry.description || "-"}</td>
                                                                <td className="px-3 py-1.5 text-right font-medium text-slate-800">{cSym}{getPresalesConverted(Number(entry.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot className="bg-blue-50 border-t border-slate-200">
                                                        <tr>
                                                            <td colSpan={2} className="px-3 py-1.5 text-xs font-semibold text-blue-800">Total Travel & Hospitality</td>
                                                            <td className="px-3 py-1.5 text-right font-bold text-blue-700">{cSym}{getPresalesConverted(total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        );
                                    }
                                    // Legacy object format fallback
                                    if (tc && !Array.isArray(tc)) {
                                        const fields: [string, number][] = ([
                                            ['Round Trip', tc.roundTripCost || 0],
                                            ['Medical Insurance', tc.medicalInsurance || 0],
                                            ['Visa', tc.visaCost || 0],
                                            ['Vaccine', tc.vaccineCost || 0],
                                            ['Hotel', tc.hotelCost || 0],
                                            ['Local Conveyance', tc.localConveyance || 0],
                                            ['Marketing/Comm.', tc.marketingCom || 0],
                                        ] as [string, number][]).filter(([, v]) => v > 0);
                                        if (fields.length > 0) return (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-6 text-sm mb-4">
                                                {fields.map(([label, val]) => (
                                                    <div key={label}>
                                                        <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
                                                        <p className="font-medium text-slate-800 mt-0.5">{cSym}{getPresalesConverted(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }
                                    return <p className="text-xs text-slate-400 italic mb-4">No travel costs recorded.</p>;
                                })()}
                                {/* Special Costs */}
                                {rawPresalesData?.specialCosts && Object.values(rawPresalesData.specialCosts).some((v: any) => Number(v) > 0) && (
                                    <div className="mb-4">
                                        <h4 className="text-xs font-semibold text-slate-700 mb-2">Special Costs</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-6 text-sm">
                                            {([['Subcontracting', rawPresalesData.specialCosts.subcontracting], ['Miscl. Expense', rawPresalesData.specialCosts.miscExpense], ['Special HW', rawPresalesData.specialCosts.specialHwCost], ['Special SW', rawPresalesData.specialCosts.specialSwCost]] as [string, number][]).filter(([, v]) => Number(v) > 0).map(([label, val]) => (
                                                <div key={label}>
                                                    <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
                                                    <p className="font-medium text-slate-800 mt-0.5">{cSym}{getPresalesConverted(Number(val)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* GOM Summary — same 6 tiles shown on the GOM Calculator screen in Presales */}
                                <h4 className="text-xs font-semibold text-slate-700 mb-2 pt-3 border-t border-slate-100">GOM Summary</h4>
                                {(() => {
                                    const pd = rawPresalesData || {};
                                    const baseCost = pd.gomSummary?.totalCost || 0;
                                    const markup = pd.markupPercent || 0;
                                    const commPercent = pd.salesCommissionPercent || 0;
                                    const preSalesPercent = pd.preSalesCostPercent || 0;

                                    const rev = pd.finalRevenue !== undefined ? pd.finalRevenue : (pd.adjustedEstimatedValue > 0 ? pd.adjustedEstimatedValue : baseCost * (1 + markup / 100));
                                    const comm = rev * (commPercent / 100);
                                    const pre = rev * (preSalesPercent / 100);

                                    const totalC = pd.finalTotalCost !== undefined ? pd.finalTotalCost : (baseCost + comm + pre);
                                    const gom = pd.finalGomPercent !== undefined ? pd.finalGomPercent : (rev > 0 ? ((rev - totalC) / rev) * 100 : 0);
                                    const profit = pd.finalProfit !== undefined ? pd.finalProfit : (rev - totalC);

                                    // Tiles render in opportunity currency. Presales-side values flow through
                                    // getPresalesConverted; pipeline projected value is already in opp currency.
                                    const quoteOpp = getPresalesConverted(rev);
                                    const totalCostOpp = getPresalesConverted(totalC);
                                    const profitOpp = getPresalesConverted(profit);
                                    const projectedOpp = Number(adjustedEstimatedValue) > 0
                                        ? Number(adjustedEstimatedValue)
                                        : Number(formData.value) || 0;
                                    const diffOpp = projectedOpp - quoteOpp;
                                    const within = diffOpp >= 0;
                                    const resourceCount = Array.isArray(pd.resources) ? pd.resources.length : 0;
                                    const fmt = (v: number) => `${cSym}${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

                                    const gomStatusText = gom >= 30
                                        ? 'Excellent'
                                        : gom >= 20
                                            ? 'Healthy'
                                            : gom > 0
                                                ? 'Below target'
                                                : 'No data';
                                    const gomIcon = gom >= 30
                                        ? <CheckCircle className="w-5 h-5" />
                                        : gom >= 20
                                            ? <AlertCircle className="w-5 h-5" />
                                            : <XCircle className="w-5 h-5" />;

                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
                                            {/* Total Quote */}
                                            <div className="rounded-lg border border-slate-200 border-l-4 border-l-blue-500 bg-white p-3 shadow-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-semibold text-slate-500">Total Quote</span>
                                                    <span className="h-7 w-7 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center">
                                                        <TrendingUp className="w-4 h-4" />
                                                    </span>
                                                </div>
                                                <div className="text-xl font-bold text-slate-900">{fmt(quoteOpp)}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">Calculated quote price</div>
                                            </div>

                                            {/* Projected Revenue */}
                                            <div className="rounded-lg border border-slate-200 border-l-4 border-l-cyan-600 bg-white p-3 shadow-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-semibold text-slate-500">Projected Revenue</span>
                                                    <span className="h-7 w-7 rounded-md bg-cyan-50 text-cyan-700 flex items-center justify-center">
                                                        <DollarSign className="w-4 h-4" />
                                                    </span>
                                                </div>
                                                <div className="text-xl font-bold text-slate-900">{fmt(projectedOpp)}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">Estimated value from Pipeline</div>
                                            </div>

                                            {/* Difference */}
                                            <div className={`rounded-lg border border-slate-200 border-l-4 bg-white p-3 shadow-sm ${within ? 'border-l-emerald-600' : 'border-l-rose-600'}`}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-semibold text-slate-500">Difference</span>
                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${within ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                        {within ? 'Available' : 'Over'}
                                                    </span>
                                                </div>
                                                <div className="text-xl font-bold text-slate-900">{fmt(Math.abs(diffOpp))}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">Projected - quote</div>
                                            </div>

                                            {/* Total Cost */}
                                            <div className="rounded-lg border border-slate-200 border-l-4 border-l-slate-600 bg-white p-3 shadow-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-semibold text-slate-500">Total Cost</span>
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200">
                                                        {resourceCount} Resources
                                                    </span>
                                                </div>
                                                <div className="text-xl font-bold text-slate-900">{fmt(totalCostOpp)}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">Total estimated expenses</div>
                                            </div>

                                            {/* GOM % */}
                                            <div className={`rounded-lg border border-slate-200 border-l-4 bg-white p-3 shadow-sm ${gom >= 20 ? 'border-l-emerald-600' : 'border-l-rose-600'}`}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-semibold text-slate-500">GOM %</span>
                                                    <span className={`${gom >= 20 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                        {gomIcon}
                                                    </span>
                                                </div>
                                                <div className="text-xl font-bold text-slate-900">{gom.toFixed(1)}%</div>
                                                <div className={`text-[10px] mt-0.5 font-medium ${gom >= 20 ? 'text-emerald-700' : 'text-rose-700'}`}>{gomStatusText}</div>
                                            </div>

                                            {/* Profit */}
                                            <div className="rounded-lg border border-slate-200 border-l-4 border-l-indigo-600 bg-white p-3 shadow-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-semibold text-slate-500">Profit</span>
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200">
                                                        {opportunityCurrency}
                                                    </span>
                                                </div>
                                                <div className="text-xl font-bold text-slate-900">{fmt(profitOpp)}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">Net margin</div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Estimation Summary — moved after Presales/Estimation Details */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Estimation Summary</h2>
                                <p className="text-xs text-slate-500 mt-1">Review all details before converting to a project or sending back for re-estimation.</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isLost
                                ? 'bg-red-50 text-red-700 border-red-300'
                                : opportunityStage === 3
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : currentStageName === 'Negotiation'
                                        ? 'bg-orange-50 text-orange-700 border-orange-300'
                                        : 'bg-amber-50 text-amber-700 border-amber-300'
                            }`}>
                                {isLost ? (currentStageName === 'Proposal Lost' ? 'Proposal Lost' : 'Closed Lost') : opportunityStage === 3 ? 'SOW Approved' : currentStageName === 'Negotiation' ? 'Under Negotiation' : 'Proposal Submitted'}
                            </span>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-2">
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">Client</p>
                                <p className="font-semibold text-slate-800">{formData.clientName}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">Project</p>
                                <p className="font-semibold text-slate-800">{formData.projectName}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">Duration</p>
                                <p className="font-semibold text-slate-800">{formData.duration ? `${formData.duration} ${formData.durationUnit || 'months'}` : "N/A"}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">Day Rate</p>
                                <p className="font-semibold text-slate-800">{formData.expectedDayRate || "N/A"}</p>
                            </div>
                            <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                                <p className="text-xs text-indigo-600 mb-1">Estimated Value</p>
                                <p className="font-semibold text-indigo-700">
                                    {cSym}{Number(formData.value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    {opportunityCurrency && globalCurrency && opportunityCurrency !== globalCurrency && (
                                        <span className="text-xs text-slate-500 ml-1">
                                            ({getSymbol(globalCurrency)}{(Number(formData.value) * getRate(globalCurrency) / getRate(opportunityCurrency)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })})
                                        </span>
                                    )}
                                </p>
                            </div>
                            {Number(adjustedEstimatedValue) > 0 && (
                            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                                <p className="text-xs text-amber-600 mb-1">Adjusted Quote Value</p>
                                <p className="font-bold text-amber-700">
                                    {cSym}{Number(adjustedEstimatedValue).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    {opportunityCurrency && globalCurrency && opportunityCurrency !== globalCurrency && (
                                        <span className="text-xs text-slate-500 ml-1">
                                            ({getSymbol(globalCurrency)}{(Number(adjustedEstimatedValue) * getRate(globalCurrency) / getRate(opportunityCurrency)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })})
                                        </span>
                                    )}
                                </p>
                            </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SOW STUDIO (Step 3) */}
            {activeStep === 3 && (
                <SowStudio opportunityId={id} />
            )}

            {/* PROJECT VIEW (Step 4) — Converted project info */}
            {activeStep === 4 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 mb-3">
                            <Check className="w-6 h-6 text-emerald-600" />
                        </div>
                        <h2 className="text-base font-bold text-slate-900 mb-2">SOW Approved</h2>
                        <p className="text-xs text-slate-500 mb-4">This opportunity has been approved and the SOW has been finalized.</p>

                        <div className="max-w-md mx-auto grid grid-cols-2 gap-3 text-left mb-6">
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">Client</p>
                                <p className="font-semibold text-sm text-slate-800">{formData.clientName}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">Project</p>
                                <p className="font-semibold text-sm text-slate-800">{formData.projectName}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">Value</p>
                                <p className="font-semibold text-sm text-slate-800">
                                    {cSym}{Number(formData.value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    {opportunityCurrency && globalCurrency && opportunityCurrency !== globalCurrency && (
                                        <span className="text-xs text-slate-500 ml-1">
                                            ({getSymbol(globalCurrency)}{(Number(formData.value) * getRate(globalCurrency) / getRate(opportunityCurrency)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })})
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                                <p className="text-xs text-emerald-600 mb-1">Status</p>
                                <p className="font-semibold text-sm text-emerald-700">SOW Approved</p>
                            </div>
                        </div>

                        <button
                            onClick={() => router.push("/dashboard/opportunities")}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700"
                        >
                            Back to Opportunities
                        </button>
                    </div>
                </div>
            )}

            {/* Comments & Audit Log — visible on all stages */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[300px]">
                <AssignmentPane
                    opportunityId={id}
                    salesRepName={formData.salesRep}
                    managerName={opportunityManagerName}
                    presalesAssigneeName={formData.presalesAssignee}
                    setFormData={setFormData}
                    canEditSalesRep={canEditSalesRepAssignment}
                    canEditManager={canEditManagerAssignment}
                    canEditPresales={canEditPresalesAssignment}
                    salesUsers={salespersons}
                    managerUsers={managers}
                    onSalesRepChange={(name) => { setFormData(prev => ({...prev, salesRep: name})); }}
                    onManagerChange={(name) => { setOpportunityManagerName(name); }}
                    onAssignmentSaved={(updatedMetadata) => { setOpportunityMetadata(updatedMetadata); }}
                />
                <CommentsPanel opportunityId={id} currentStage={steps[activeStep]} readOnly={!canComment} readOnlyReason={viewOnlyReason} />
                <AuditLogPane opportunityId={id} />
            </div>

            {showViewOnlyModal && viewOnlyReason && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-white">
                            <h3 className="font-bold text-lg text-slate-800">View-Only Access</h3>
                        </div>
                        <div className="p-6 space-y-3">
                            <p className="text-sm text-slate-600">{viewOnlyReason}</p>
                            <p className="text-xs text-slate-500">
                                Action buttons and editable fields are disabled until you are assigned as the owner, sales rep, manager, or named presales assignee for this opportunity.
                            </p>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowViewOnlyModal(false)}
                                className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800"
                            >
                                Understood
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Presales Modal */}
            {showPresalesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                            <h3 className="font-bold text-lg text-slate-800">Move to Presales</h3>
                            <button
                                onClick={() => setShowPresalesModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handlePresalesSubmit} className="p-5 space-y-4">

                            {formData.practice && (
                                <div className="px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-md text-sm text-indigo-700">
                                    <span className="font-medium">Department / Practice:</span> {formData.practice}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="block text-sm font-bold text-slate-700">Manager *</label>
                                {isLoadingManagers ? (
                                    <div className="text-xs text-slate-400 py-2">Loading managers...</div>
                                ) : (
                                    <select
                                        required
                                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                        value={presalesForm.managerName}
                                        onChange={(e) => setPresalesForm({ ...presalesForm, managerName: e.target.value })}
                                    >
                                        <option value="">Select Manager</option>
                                        {presalesForm.managerName && !managers.some(m => m.name === presalesForm.managerName) && (
                                            <option value={presalesForm.managerName}>{presalesForm.managerName}</option>
                                        )}
                                        {managers.length > 0
                                            ? managers.map(m => (
                                                <option key={m.id} value={m.name}>{m.name}{m.department ? ` (${m.department})` : ''}</option>
                                            ))
                                            : <option value="" disabled>No managers found for this department</option>
                                        }
                                    </select>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-bold text-slate-700">Proposal Due Date *</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                    value={presalesForm.proposalDueDate}
                                    onChange={(e) => setPresalesForm({ ...presalesForm, proposalDueDate: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-bold text-slate-700">Comment *</label>
                                <textarea
                                    required
                                    rows={4}
                                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm resize-none"
                                    placeholder="Enter Comments"
                                    value={presalesForm.comments}
                                    onChange={(e) => setPresalesForm({ ...presalesForm, comments: e.target.value })}
                                ></textarea>
                            </div>

                            <div className="pt-4 flex justify-between gap-3 border-t border-slate-50 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowPresalesModal(false)}
                                    className="w-full px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="w-full px-4 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-sm disabled:opacity-70 transition-colors"
                                >
                                    {isSaving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Mark as Lost Modal */}
            {showLostModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                <h3 className="font-bold text-lg text-slate-800">{lostModalType === 'Proposal Lost' ? 'Mark as Proposal Lost' : 'Mark as Lost'}</h3>
                            </div>
                            <button
                                onClick={() => setShowLostModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <p className="text-sm text-slate-600">
                                {lostModalType === 'Proposal Lost'
                                    ? 'Mark this opportunity as Proposal Lost - the proposal was not accepted. Please provide a reason.'
                                    : 'Are you sure you want to mark this opportunity as lost? This action will close the opportunity.'}
                            </p>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-bold text-slate-700">Reason / Remarks *</label>
                                <textarea
                                    rows={4}
                                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
                                    placeholder="e.g. Lost to competitor, budget constraints, client went with in-house solution..."
                                    value={lostRemarks}
                                    onChange={(e) => setLostRemarks(e.target.value)}
                                />
                            </div>

                            <div className="pt-4 flex justify-between gap-3 border-t border-slate-50">
                                <button
                                    type="button"
                                    onClick={() => setShowLostModal(false)}
                                    className="w-full px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleMarkAsLost}
                                    disabled={isSaving || !lostRemarks.trim()}
                                    className="w-full px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm disabled:opacity-70 transition-colors"
                                >
                                    {isSaving ? 'Saving...' : 'Confirm Lost'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Re-estimate Modal */}
            {showReestimateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                            <div className="flex items-center gap-2">
                                <RefreshCw className="w-5 h-5 text-amber-500" />
                                <h3 className="font-bold text-lg text-slate-800">Send Back for Re-estimation</h3>
                            </div>
                            <button
                                onClick={() => setShowReestimateModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <p className="text-sm text-slate-600">
                                Provide a comment explaining why re-estimation is needed. Optionally provide an adjusted quote value.
                            </p>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-bold text-slate-700">Reason for Re-estimation *</label>
                                <textarea
                                    rows={3}
                                    required
                                    placeholder="Explain why re-estimation is needed..."
                                    value={reEstimateComment}
                                    onChange={(e) => setReEstimateComment(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-bold text-slate-700">Adjusted Quote Value ({cSym})</label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={adjustedEstimatedValue}
                                    onChange={(e) => setAdjustedEstimatedValue(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                                />
                                <p className="text-[10px] text-slate-400">Leave empty to keep the current estimated value</p>
                            </div>

                            <div className="pt-4 flex justify-between gap-3 border-t border-slate-50">
                                <button
                                    type="button"
                                    onClick={() => setShowReestimateModal(false)}
                                    className="w-full px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmReestimate}
                                    disabled={isSaving || !reEstimateComment.trim()}
                                    className="w-full px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md shadow-sm disabled:opacity-70 transition-colors"
                                >
                                    {isSaving ? 'Sending...' : 'Send for Re-estimation'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Client Modal */}
            {showAddClient && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900">Add New Client</h3>
                            <button onClick={() => setShowAddClient(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={newClientName}
                                onChange={(e) => setNewClientName(e.target.value)}
                                placeholder="Client Name *"
                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddClient()}
                            />
                            <input
                                type="text"
                                value={newClientContact}
                                onChange={(e) => setNewClientContact(e.target.value)}
                                placeholder="Client Side Contact Person"
                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                            />
                            <input
                                type="text"
                                value={newClientAddress}
                                onChange={(e) => setNewClientAddress(e.target.value)}
                                placeholder="Client Address"
                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                            />
                        </div>
                        <div className="flex justify-end gap-3 mt-4">
                            <button type="button" onClick={() => setShowAddClient(false)} className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50">Cancel</button>
                            <button type="button" onClick={handleAddClient} disabled={addingClient || !newClientName.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">{addingClient ? 'Adding...' : 'Add Client'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Presales Modal */}
            <AssignPresalesModal
                opportunityId={id}
                isOpen={showAssignPresalesModal}
                onAssign={(selectedNames) => {
                    setFormData(prev => ({ ...prev, presalesAssignee: selectedNames }));
                    setShowAssignPresalesModal(false);
                    toast({
                        title: "Presales Assigned",
                        description: `${selectedNames} assigned to this opportunity.`,
                    });
                }}
                onClose={() => setShowAssignPresalesModal(false)}
                managerDepartment={user?.department}
            />
        </div>
    );
}
