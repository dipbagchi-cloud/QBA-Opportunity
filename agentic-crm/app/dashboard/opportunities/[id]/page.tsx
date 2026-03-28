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
    Search,
    Upload,
    Download,
    Trash2,
    FileText
} from "lucide-react";
import { useOpportunityStore } from "@/lib/store";
import { EstimationTab } from "./components/EstimationTab";
import { ResourceAssignmentTab } from "./components/ResourceAssignmentTab";
import { GomCalculatorTab } from "./components/GomCalculatorTab";
import { OpportunityEstimationProvider, useOpportunityEstimation } from "./context/OpportunityEstimationContext";
import { useCurrency } from "@/components/providers/currency-provider";
import { CommentsPanel } from "./components/CommentsPanel";
import { AuditLogPane } from "./components/AuditLogPane";

// Static dropdowns (not master-data driven)
const DURATION_UNITS = ["days", "weeks", "months"];
const ARCHITECTS = ["David Chen", "Sarah Jones", "Rahul Gupta", "Emily White"];

// Convert duration value + unit to total months (for end date / value calcs)
function durationToDays(value: number, unit: string): number {
    switch (unit) {
        case 'days': return value;
        case 'weeks': return value * 7;
        case 'months': return value * 30;
        default: return value * 30;
    }
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
function PresalesSaveButton() {
    const { saveEstimation, isSaving } = useOpportunityEstimation();
    const { toast } = useToast();

    const handleSave = async () => {
        try {
            await saveEstimation();
            toast({ title: "Saved", description: "Estimation data saved successfully." });
        } catch {
            toast({ title: "Error", description: "Failed to save estimation data." });
        }
    };

    return (
        <div className="flex justify-end mb-2">
            <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
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
    const { format: fmtCurrency, symbol: cSym } = useCurrency();
    const { id } = use(params);
    const { updateOpportunity } = useOpportunityStore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showPresalesModal, setShowPresalesModal] = useState(false);

    // Dynamic dropdown data
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
    const [regions, setRegions] = useState<string[]>([]);
    const [technologies, setTechnologies] = useState<string[]>([]);
    const [pricingModels, setPricingModels] = useState<string[]>([]);
    const [salespersons, setSalespersons] = useState<{ id: string; name: string }[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [managers, setManagers] = useState<{ id: string; name: string; department: string }[]>([]);
    const [isLoadingManagers, setIsLoadingManagers] = useState(false);
    const [opportunityManagerName, setOpportunityManagerName] = useState("");
    const [projectTypes, setProjectTypes] = useState<string[]>([]);
    const [autoSaveIntervalMinutes, setAutoSaveIntervalMinutes] = useState(2);

    // Form State
    const [formData, setFormData] = useState({
        clientName: "",
        region: "",
        projectType: "",
        projectName: "",
        practice: "",
        salesRep: "",
        technology: "",
        tentativeStartDate: "",
        tentativeEndDate: "",
        duration: "",
        durationUnit: "months",
        pricingModel: "",
        expectedDayRate: "",
        description: "",
        value: 0
    });

    // Attachments state
    const [attachments, setAttachments] = useState<{ id: string; fileName: string; fileType: string; fileSize: number; uploadedAt: string }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Presales Modal State (Modal for transition)
    const [presalesForm, setPresalesForm] = useState({
        proposalDueDate: "",
        comments: "",
        managerName: ""
    });

    // Presales View State (The detailed view after transition)
    const [presalesData, setPresalesData] = useState({
        markup: 25,
        modeOfTravel: "Flight",
        frequency: "",
        roundTripCost: 0,
        medicalInsuranceCost: 0,
        visaCost: 0,
        vaccineCost: 0,
        hotelCost: 0
    });

    const handlePresalesDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setPresalesData(prev => ({ ...prev, [name]: value }));
    };

    const [activeTab, setActiveTab] = useState("Project Details");
    const [activeStep, setActiveStep] = useState(0); // 0: Pipeline, 1: Presales
    const [opportunityStage, setOpportunityStage] = useState(0); // actual DB stage (0-3), stays fixed when navigating steps
    const [currentStageName, setCurrentStageName] = useState(''); // actual Kanban stage name (Discovery, Qualification, Proposal, Negotiation, Closed Won, Closed Lost)
    const steps = ["Pipeline", "Presales", "Sales", "Project"];

    // Sales view collapsible sections
    const [salesPipelineOpen, setSalesPipelineOpen] = useState(false);
    const [salesPresalesOpen, setSalesPresalesOpen] = useState(false);

    // Mark as Lost state
    const [showLostModal, setShowLostModal] = useState(false);
    const [lostRemarks, setLostRemarks] = useState("");
    const [isLost, setIsLost] = useState(false);
    const [lostModalType, setLostModalType] = useState<string>('Closed Lost');

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

    // GOM Calculations
    useEffect(() => {
        // Sync markup from presalesData into gomInputs
        const effectiveMarkup = presalesData.markup ?? gomInputs.markupPercent;

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

    }, [gomInputs, presalesData.markup]);

    // Fetch master data for dropdowns
    useEffect(() => {
        const fetchMasterData = async () => {
            const headers = getAuthHeaders();
            try {
                const [clientsRes, regionsRes, techRes, pricingRes, salesRes, deptRes, projTypesRes, budgetRes] = await Promise.all([
                    fetch(`${API_URL}/api/master/clients`, { headers }),
                    fetch(`${API_URL}/api/master/regions`, { headers }),
                    fetch(`${API_URL}/api/master/technologies`, { headers }),
                    fetch(`${API_URL}/api/master/pricing-models`, { headers }),
                    fetch(`${API_URL}/api/master/salespersons`, { headers }),
                    fetch(`${API_URL}/api/master/departments`, { headers }),
                    fetch(`${API_URL}/api/master/project-types`, { headers }),
                    fetch(`${API_URL}/api/admin/budget-assumptions`, { headers }),
                ]);
                if (clientsRes.ok) setClients(await clientsRes.json());
                if (regionsRes.ok) setRegions((await regionsRes.json()).map((r: any) => r.name));
                if (techRes.ok) setTechnologies((await techRes.json()).map((t: any) => t.name));
                if (pricingRes.ok) setPricingModels((await pricingRes.json()).map((p: any) => p.name));
                if (salesRes.ok) setSalespersons(await salesRes.json());
                if (deptRes.ok) setDepartments(await deptRes.json());
                if (projTypesRes.ok) setProjectTypes((await projTypesRes.json()).map((p: any) => p.name));
                if (budgetRes.ok) {
                    const budgetData = await budgetRes.json();
                    if (budgetData.autoSaveIntervalMinutes !== undefined) {
                        setAutoSaveIntervalMinutes(budgetData.autoSaveIntervalMinutes);
                    }
                    if (budgetData.minGomPercent !== undefined) {
                        setMinGomPercent(budgetData.minGomPercent);
                    }
                    if (budgetData.gomAutoApprovePercent !== undefined) {
                        setGomAutoApprovePercent(budgetData.gomAutoApprovePercent);
                    }
                }
            } catch (err) {
                console.error("Failed to load master data", err);
            }
        };
        fetchMasterData();
    }, []);

    // Auto-approve GOM when GOM % reaches configured threshold
    useEffect(() => {
        if (gomAutoApprovePercent > 0 && contextGomPercent >= gomAutoApprovePercent && !gomApproved && id) {
            handleApproveGom(true);
        }
    }, [contextGomPercent, gomAutoApprovePercent]);

    // Auto-calculate tentative end date
    useEffect(() => {
        const dur = Number(formData.duration);
        if (formData.tentativeStartDate && dur > 0 && formData.durationUnit) {
            const start = new Date(formData.tentativeStartDate);
            const days = durationToDays(dur, formData.durationUnit);
            const end = new Date(start);
            end.setDate(end.getDate() + days);
            setFormData(prev => ({ ...prev, tentativeEndDate: end.toISOString().split('T')[0] }));
        }
    }, [formData.tentativeStartDate, formData.duration, formData.durationUnit]);

    // Auto-calculate estimated value = Expected Day Rate × 20 working days × Duration months (only for Staffing)
    useEffect(() => {
        if (formData.projectType !== 'Staffing') return;
        const rate = Number(formData.expectedDayRate) || 0;
        const dur = Number(formData.duration) || 0;
        const months = durationToMonths(dur, formData.durationUnit);
        if (rate > 0 && months > 0) {
            setFormData(prev => ({ ...prev, value: Math.round(rate * 20 * months) }));
        }
    }, [formData.expectedDayRate, formData.duration, formData.durationUnit, formData.projectType]);

    // Fetch Data on Load
    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
                    headers: getAuthHeaders(),
                });
                if (!res.ok) throw new Error("Failed to load");
                const data = await res.json();

                setFormData({
                    clientName: data.client?.name || "",
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
                    value: data.value || 0
                });

                // Load attachments
                if (data.attachments && Array.isArray(data.attachments)) {
                    setAttachments(data.attachments);
                }

                setOpportunityManagerName(data.managerName || "");
                if (data.adjustedEstimatedValue) {
                    setAdjustedEstimatedValue(String(data.adjustedEstimatedValue));
                }
                setDetailedStatus(data.detailedStatus || "");
                setGomApproved(data.gomApproved === true);

                // Fetch pending GOM approval status
                if (!data.gomApproved) {
                    fetch(`${API_URL}/api/opportunities/${id}/gom-approval-status`, { headers: getAuthHeaders() })
                        .then(r => r.ok ? r.json() : null)
                        .then(d => { if (d?.pending) setGomPendingApproval(d.pending); })
                        .catch(() => {});
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
                setActiveStep(stageIdx);
                setOpportunityStage(stageIdx);

                // Load presales data from saved record (Project Details tab fields)
                if (data.presalesData && typeof data.presalesData === 'object') {
                    const pd = data.presalesData as any;
                    if (pd.travelCosts) {
                        setPresalesData(prev => ({
                            ...prev,
                            markup: pd.markupPercent ?? prev.markup,
                            modeOfTravel: pd.travelCosts.modeOfTravel || prev.modeOfTravel,
                            frequency: pd.travelCosts.frequency || prev.frequency,
                            roundTripCost: pd.travelCosts.roundTripCost ?? prev.roundTripCost,
                            medicalInsuranceCost: pd.travelCosts.medicalInsurance ?? prev.medicalInsuranceCost,
                            visaCost: pd.travelCosts.visaCost ?? prev.visaCost,
                            vaccineCost: pd.travelCosts.vaccineCost ?? prev.vaccineCost,
                            hotelCost: pd.travelCosts.hotelCost ?? prev.hotelCost,
                        }));
                    }
                }

            } catch (error) {
                console.error("Load error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (id) fetchDetails();
    }, [id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Attachment upload handler
    const handleFileUpload = async (files: FileList | null) => {
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
    const handleDownloadAttachment = async (attachmentId: string, fileName: string) => {
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${id}/attachments/${attachmentId}/download`, {
                headers: getAuthHeaders(),
            });
            if (!res.ok) throw new Error("Download failed");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            toast({ title: "Error", description: "Failed to download file." });
        }
    };

    // Attachment delete handler
    const handleDeleteAttachment = async (attachmentId: string) => {
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
        toast({ title: "Saving", description: "Saving opportunity..." });
        setIsSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                // Also update store optimistic
                await updateOpportunity(id, {
                    name: formData.projectName,
                    value: Number(formData.value)
                });
                toast({ title: "Success", description: "Opportunity updated successfully!" });
            } else {
                toast({ title: "Error", description: "Failed to save changes. Please check all fields." });
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
        if (autoSaveIntervalMinutes <= 0 || opportunityStage !== 0 || isLost) return;

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
                    presalesData: presalesForm
                })
            });

            if (res.ok) {
                await updateOpportunity(id, { stage: 'Qualification' });
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
                    toast({ title: "GOM Approval Requested", description: `Approval request sent to ${data.reviewer || 'your reporting manager'}.` });
                } else {
                    setGomApproved(data.gomApproved);
                    setGomPendingApproval(null);
                    toast({ title: data.gomApproved ? "GOM Approved" : "GOM Approval Revoked", description: data.gomApproved ? "GOM has been approved. You can now move to Sales." : "GOM approval has been revoked." });
                }
            } else {
                toast({ title: "Error", description: "Failed to update GOM approval." });
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
                setGomPendingApproval(null);
                toast({ title: approved ? "GOM Approved" : "GOM Rejected", description: approved ? "GOM has been approved by manager." : "GOM approval has been rejected." });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleMoveToSales = async () => {
        // Check GOM approval
        if (!gomApproved) {
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
                await updateOpportunity(id, { stage: 'Proposal' });
                setCurrentStageName('Proposal');
                setActiveStep(2);
                setOpportunityStage(2);
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
                await updateOpportunity(id, { stage: 'Negotiation' });
                setCurrentStageName('Negotiation');
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
            const payload: any = { stageName: 'Qualification', reEstimateComment: reEstimateComment.trim() };
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
                toast({ title: "Success", description: "Sent back for re-estimation." });
                // Sync Zustand store in background (non-blocking)
                updateOpportunity(id, { stage: 'Qualification' }).catch(() => {});
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
                setActiveStep(3);
                setOpportunityStage(3);
                toast({ title: "Success", description: "Opportunity converted to Project!" });
            } else if (res.status === 409) {
                // Project already exists — just navigate to project view
                setCurrentStageName('Closed Won');
                setActiveStep(3);
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

    if (isLoading) return <div className="p-6">Loading Opportunity...</div>;

    return (
        <div className="max-w-[1400px] mx-auto space-y-4 relative">
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
                    {opportunityStage === 0 && !isLost && (
                        <button
                            onClick={() => setShowPresalesModal(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
                        >
                            Move to Presales
                        </button>
                    )}
                    {opportunityStage === 1 && !isLost && (
                        <>
                            <button
                                onClick={() => { setLostModalType('Proposal Lost'); setShowLostModal(true); }}
                                disabled={isSaving}
                                className="px-4 py-2 bg-white border border-rose-300 text-rose-600 rounded-md font-medium hover:bg-rose-50 disabled:opacity-50"
                            >
                                <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Proposal Lost</span>
                            </button>
                            <button
                                onClick={handleMoveToSales}
                                disabled={isSaving}
                                className={`px-4 py-2 rounded-md font-medium disabled:opacity-50 ${gomApproved ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-300 text-slate-600 cursor-not-allowed'}`}
                                title={!gomApproved ? 'GOM must be approved first (see GOM Calculator tab)' : ''}
                            >
                                {isSaving ? 'Moving...' : 'Move to Sales'}
                            </button>
                        </>
                    )}
                    {opportunityStage === 2 && !isLost && currentStageName === 'Proposal' && (
                        <>
                            <button
                                onClick={() => { setLostModalType('Proposal Lost'); setShowLostModal(true); }}
                                disabled={isSaving}
                                className="px-4 py-2 bg-white border border-rose-300 text-rose-600 rounded-md font-medium hover:bg-rose-50 disabled:opacity-50"
                            >
                                <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Proposal Lost</span>
                            </button>
                            <button
                                onClick={handleSendBackForReestimate}
                                disabled={isSaving}
                                className="px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-md font-medium hover:bg-amber-50 disabled:opacity-50"
                            >
                                {isSaving ? 'Sending...' : 'Send Back for Re-estimate'}
                            </button>
                            <button
                                onClick={handleProposalSent}
                                disabled={isSaving}
                                className="px-4 py-2 bg-orange-600 text-white rounded-md font-medium hover:bg-orange-700 disabled:opacity-50"
                            >
                                {isSaving ? 'Sending...' : 'Proposal Sent'}
                            </button>
                        </>
                    )}
                    {opportunityStage === 2 && !isLost && currentStageName === 'Negotiation' && (
                        <>
                            <button
                                onClick={() => { setLostModalType('Closed Lost'); setShowLostModal(true); }}
                                disabled={isSaving}
                                className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-md font-medium hover:bg-red-50 disabled:opacity-50"
                            >
                                <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Mark as Lost</span>
                            </button>
                            <button
                                onClick={handleSendBackForReestimate}
                                disabled={isSaving}
                                className="px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-md font-medium hover:bg-amber-50 disabled:opacity-50"
                            >
                                {isSaving ? 'Sending...' : 'Send Back for Re-estimate'}
                            </button>
                            <button
                                onClick={handleMoveToProject}
                                disabled={isSaving}
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
                    {opportunityStage < 3 && !isLost && (
                        <button className="px-4 py-2 bg-slate-900 text-white rounded-md font-medium hover:bg-slate-800">
                            Hold
                        </button>
                    )}
                </div>
            </div>

            {/* Detailed Status Banner */}
            {detailedStatus === 'Sent for Re-estimate' && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800">
                    <RefreshCw className="w-4 h-4 flex-shrink-0 text-amber-500" />
                    <div>
                        <span className="font-semibold text-sm">Sent for Re-estimation</span>
                        <span className="text-xs ml-2 text-amber-600">— This opportunity was sent back for re-estimation by the Sales team</span>
                    </div>
                </div>
            )}
            {detailedStatus === 'Estimation Submitted' && (
                <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-indigo-800">
                    <Check className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                    <div>
                        <span className="font-semibold text-sm">Estimation Submitted</span>
                        <span className="text-xs ml-2 text-indigo-600">— Estimation has been submitted to the Sales team for review</span>
                    </div>
                </div>
            )}
            {detailedStatus === 'Re-estimation Submitted' && (
                <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-purple-800">
                    <Check className="w-4 h-4 flex-shrink-0 text-purple-500" />
                    <div>
                        <span className="font-semibold text-sm">Re-estimation Submitted</span>
                        <span className="text-xs ml-2 text-purple-600">— Updated re-estimation has been submitted to Sales</span>
                    </div>
                </div>
            )}

            {/* Stepper Navigation */}
            <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                <div className="flex w-full mt-1 h-8 bg-slate-50 rounded-full overflow-hidden border border-slate-200">
                    {steps.map((step, idx) => {
                        const isCompleted = idx < opportunityStage || (idx === 3 && opportunityStage === 3);
                        const isActive = idx === activeStep;
                        const isAccessible = idx <= opportunityStage;

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

            {/* PIPELINE VIEW (Step 0) */}
            {activeStep === 0 && (() => {
                const isPipelineEditable = opportunityStage === 0 && !isLost;
                const disabledClass = !isPipelineEditable ? "bg-slate-50 cursor-not-allowed opacity-70" : "bg-white";
                return (
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                    {/* ... Existing Pipeline Form Code ... */}
                    <div className="mb-4 flex items-center gap-3">
                        <h2 className="text-base font-bold text-slate-900">Basic Information</h2>
                        {!isPipelineEditable && !isLost && (
                            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold border border-slate-200">
                                Read Only
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
                            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold border border-blue-200">
                                Estimation in Progress
                            </span>
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
                            <select
                                name="clientName"
                                required
                                value={formData.clientName}
                                disabled={!isPipelineEditable}
                                className={`w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm shadow-sm ${disabledClass}`}
                                onChange={handleChange}
                            >
                                <option value="">Select Client</option>
                                {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Region *</label>
                            <select
                                name="region"
                                required
                                value={formData.region}
                                disabled={!isPipelineEditable}
                                className={`w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm shadow-sm ${disabledClass}`}
                                onChange={handleChange}
                            >
                                <option value="">Select Region</option>
                                {regions.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Project Type *</label>
                            <select
                                name="projectType"
                                required
                                value={formData.projectType}
                                disabled={!isPipelineEditable}
                                className={`w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm shadow-sm ${disabledClass}`}
                                onChange={handleChange}
                            >
                                <option value="">Select Project Type</option>
                                {projectTypes.map((t: string) => <option key={t} value={t}>{t}</option>)}
                            </select>
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
                            <select
                                name="practice"
                                value={formData.practice}
                                disabled={!isPipelineEditable}
                                className={`w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm shadow-sm ${disabledClass}`}
                                onChange={handleChange}
                            >
                                <option value="">Find Practice</option>
                                {departments.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>

                        {/* Row 3 */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Sales Representative *</label>
                            <select
                                name="salesRep"
                                required
                                value={formData.salesRep}
                                disabled={!isPipelineEditable}
                                className={`w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm shadow-sm ${disabledClass}`}
                                onChange={handleChange}
                            >
                                <option value="">Find SalesPerson</option>
                                {salespersons.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Technology *</label>
                            <div className="relative" ref={techDropdownRef}>
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

                        {/* Day Rate (only for Staffing) */}
                        {formData.projectType === 'Staffing' && (
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Expected Day Rate ({cSym}) *</label>
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
                            <label className="block text-sm font-bold text-slate-700">Estimated Value ({cSym}){formData.projectType !== 'Staffing' ? ' *' : ''}</label>
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
                                    required
                                    value={formData.value || ''}
                                    placeholder="0.00"
                                    disabled={!isPipelineEditable}
                                    className={`w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm shadow-sm ${isPipelineEditable ? 'bg-white' : 'bg-slate-50 cursor-not-allowed opacity-70'}`}
                                    onChange={(e) => setFormData(prev => ({ ...prev, value: Number(e.target.value) || 0 }))}
                                />
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
                            <label className="block text-sm font-bold text-slate-700">Duration/Tentative End Date</label>
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
                                onChange={(e) => handleFileUpload(e.target.files)}
                            />
                            {attachments.length === 0 ? (
                                <div className="mt-1 border border-slate-300 rounded-md p-4 bg-white flex flex-col items-center justify-center text-slate-400 gap-2 border-dashed h-[120px]">
                                    <span className="text-xs">No files attached.</span>
                                    {isPipelineEditable && (
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
                                                {isPipelineEditable && (
                                                    <button type="button" onClick={() => handleDeleteAttachment(att.id)} className="text-slate-400 hover:text-red-600 flex-shrink-0">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {isPipelineEditable && (
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
                    {isPipelineEditable && (
                    <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-6 py-2 bg-blue-600 border border-transparent rounded-md text-white font-bold hover:bg-blue-700 transition-all disabled:opacity-70"
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                    )}
                </form>
                );
            })()}

            {/* PRESALES VIEW (Step 1) */}
            {activeStep === 1 && (
                <OpportunityEstimationProvider opportunityId={id} readOnly={opportunityStage >= 2} startDate={formData.tentativeStartDate} endDate={formData.tentativeEndDate} adjustedEstimatedValue={Number(adjustedEstimatedValue) || 0}>
                    <GomPercentSync onGomPercentChange={setContextGomPercent} />
                    {opportunityStage < 2 && <PresalesSaveButton />}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                        {isLost && (
                            <div className="mx-4 mt-3 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 font-medium">
                                {currentStageName === 'Proposal Lost' ? 'Proposal Lost' : 'Closed Lost'} — All fields are read-only.
                            </div>
                        )}
                        {!isLost && opportunityStage >= 2 && (
                            <div className="mx-4 mt-3 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700 font-medium">
                                {opportunityStage === 3 ? 'SOW Approved' : currentStageName === 'Negotiation' ? 'Under Negotiation' : currentStageName || 'Sales'} — All fields are read-only.
                            </div>
                        )}
                        {/* Inner Tabs */}
                        <div className="flex items-center gap-4 px-4 border-b border-slate-200 text-sm font-medium">
                            {["Project Details", "Schedule", "Resource Assignment", "GOM Calculator", "Estimation"].map(tab => (
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
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isLost ? 'bg-red-50 text-red-700 border-red-200' : opportunityStage === 3 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : opportunityStage >= 2 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-cyan-50 text-cyan-600 border-cyan-100'}`}>
                                        {isLost ? (currentStageName === 'Proposal Lost' ? 'Proposal Lost' : 'Closed Lost') : opportunityStage === 3 ? 'SOW Approved' : opportunityStage >= 2 ? (currentStageName === 'Negotiation' ? 'Under Negotiation' : 'Proposal Submitted') : 'Estimation in Progress'}
                                    </span>
                                </div>

                                {/* Read Only Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-sm">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Client Name</label>
                                        <div className="font-semibold text-slate-800">{formData.clientName}</div>
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
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Region</label>
                                        <div className="font-semibold text-slate-800">{formData.region}</div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Project Type</label>
                                        <div className="font-semibold text-slate-800">{formData.projectType}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Practice</label>
                                        <div className="font-semibold text-slate-800">{formData.practice}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Proposal Due Date</label>
                                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                                            {new Date().toLocaleDateString()}
                                            <button className="text-xs text-indigo-600 underline uppercase tracking-wider font-bold">Change</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Sales Representative</label>
                                        <div className="font-semibold text-slate-800">{formData.salesRep}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Manager</label>
                                        <div className="font-semibold text-slate-800">{opportunityManagerName || <span className="text-slate-400">—</span>}</div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Pricing Model</label>
                                        <div className="font-semibold text-slate-800">{formData.pricingModel}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Expected Day Rate</label>
                                        <div className="font-semibold text-slate-800">{formData.expectedDayRate}</div>
                                    </div>
                                    {Number(adjustedEstimatedValue) > 0 && (
                                    <div>
                                        <label className="block text-xs font-semibold text-amber-600 uppercase mb-1">Adjusted Estimated Value</label>
                                        <div className="font-bold text-amber-700">{fmtCurrency(Number(adjustedEstimatedValue))}</div>
                                    </div>
                                    )}
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Description</label>
                                        <div className="font-semibold text-slate-800 truncate">{formData.description}</div>
                                    </div>
                                </div>

                                {/* Divider */}
                                <hr className="border-slate-100" />

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Left: Resource & Cost */}
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">Resource & Cost</h3>

                                        <div className="grid grid-cols-2 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">GOM (%)</label>
                                            <div className="text-sm font-bold text-slate-800">: 0.0</div>

                                            <label className="text-sm font-medium text-slate-600">GOM Approve/Reject</label>
                                            <div className="text-sm font-bold text-amber-600">: Approval Needed</div>

                                            <label className="text-sm font-medium text-slate-600">Revenue ({cSym})</label>
                                            <div className="text-sm font-bold text-slate-800">: 0.0</div>

                                            <label className="text-sm font-medium text-slate-600">Final Cost ({cSym})</label>
                                            <div className="text-sm font-bold text-slate-800">: 0.0</div>
                                        </div>
                                    </div>

                                    {/* Right: Inputs */}
                                    <div className="space-y-4 pt-10">
                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Resource Cost ({cSym})</label>
                                            <input disabled type="text" className="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm" />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Markup (%)</label>
                                            <input
                                                type="number"
                                                name="markup"
                                                value={presalesData.markup}
                                                onChange={handlePresalesDataChange}
                                                disabled={opportunityStage >= 2}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Travel & Hospitality */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">Travel & Hospitality</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                                        {/* Left Col */}
                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Mode of Travel</label>
                                            <select
                                                name="modeOfTravel"
                                                value={presalesData.modeOfTravel}
                                                onChange={handlePresalesDataChange}
                                                disabled={opportunityStage >= 2}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                            >
                                                <option>Flight</option>
                                                <option>Train</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Frequency</label>
                                            <input
                                                type="text"
                                                name="frequency"
                                                value={presalesData.frequency}
                                                onChange={handlePresalesDataChange}
                                                disabled={opportunityStage >= 2}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Round Trip Cost ({cSym})</label>
                                            <input
                                                type="number"
                                                name="roundTripCost"
                                                value={presalesData.roundTripCost}
                                                onChange={handlePresalesDataChange}
                                                disabled={opportunityStage >= 2}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Medical Insurance Cost ({cSym})</label>
                                            <input
                                                type="number"
                                                name="medicalInsuranceCost"
                                                value={presalesData.medicalInsuranceCost}
                                                onChange={handlePresalesDataChange}
                                                disabled={opportunityStage >= 2}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Visa Cost ({cSym})</label>
                                            <input
                                                type="number"
                                                name="visaCost"
                                                value={presalesData.visaCost}
                                                onChange={handlePresalesDataChange}
                                                disabled={opportunityStage >= 2}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Vaccine Cost ({cSym})</label>
                                            <input
                                                type="number"
                                                name="vaccineCost"
                                                value={presalesData.vaccineCost}
                                                onChange={handlePresalesDataChange}
                                                disabled={opportunityStage >= 2}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Hotel Cost ({cSym})</label>
                                            <input
                                                type="number"
                                                name="hotelCost"
                                                value={presalesData.hotelCost}
                                                onChange={handlePresalesDataChange}
                                                disabled={opportunityStage >= 2}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <div className="col-span-3 flex justify-end gap-3 items-center">
                                                {gomApproved && (
                                                    <span className="flex items-center gap-1.5 text-sm text-green-700 font-semibold">
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                        GOM Approved
                                                    </span>
                                                )}
                                                {opportunityStage < 2 && !gomApproved && gomPendingApproval && (
                                                    <span className="flex items-center gap-1.5 text-sm text-amber-600 font-semibold">
                                                        <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.828a1 1 0 101.415-1.414L11 9.586V6z" clipRule="evenodd" /></svg>
                                                        Pending Approval{gomPendingApproval.reviewer ? ` from ${gomPendingApproval.reviewer}` : ''}
                                                    </span>
                                                )}
                                                {opportunityStage < 2 && !gomApproved && gomPendingApproval && (
                                                    <div className="flex gap-1">
                                                        <button onClick={() => handleReviewGomApproval(true)} className="px-3 py-1.5 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 text-xs">
                                                            Approve
                                                        </button>
                                                        <button onClick={() => handleReviewGomApproval(false, 'Rejected')} className="px-3 py-1.5 bg-red-500 text-white font-bold rounded-md hover:bg-red-600 text-xs">
                                                            Reject
                                                        </button>
                                                    </div>
                                                )}
                                                {opportunityStage < 2 && !gomApproved && !gomPendingApproval && (
                                                    <button onClick={() => handleApproveGom(true)} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 text-sm">
                                                        {gomAutoApprovePercent > 0 && contextGomPercent < gomAutoApprovePercent ? 'Request GOM Approval' : 'Approve GOM'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Attachments */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                                        <h3 className="font-bold text-slate-900">Attachments</h3>
                                        {opportunityStage < 2 && (
                                            <>
                                                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
                                                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-3 py-1.5 bg-slate-100 text-slate-700 font-medium rounded text-xs hover:bg-slate-200 flex items-center gap-2">
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
                                                            {opportunityStage < 2 && (
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
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isLost ? 'bg-red-50 text-red-700 border-red-200' : opportunityStage >= 2 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-cyan-50 text-cyan-600 border-cyan-100'}`}>
                                            {isLost ? (currentStageName === 'Proposal Lost' ? 'Proposal Lost' : 'Closed Lost') : opportunityStage >= 2 ? (currentStageName || 'Sales') : 'Estimation in Progress'}
                                        </span>
                                    </div>
                                    {opportunityStage < 2 && (
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
                                            disabled={opportunityStage >= 2}
                                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm disabled:bg-slate-100 disabled:cursor-not-allowed cursor-pointer"
                                            onClick={(e) => !(e.target as HTMLInputElement).disabled && (e.target as HTMLInputElement).showPicker?.()}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-bold text-slate-700">Duration/Tentative End Date *</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                name="duration"
                                                min="1"
                                                value={formData.duration}
                                                onChange={handleChange}
                                                disabled={opportunityStage >= 2}
                                                placeholder="Enter duration"
                                                className="flex-1 px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                                            />
                                            <select
                                                name="durationUnit"
                                                value={formData.durationUnit}
                                                onChange={handleChange}
                                                disabled={opportunityStage >= 2}
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
                                        <span className="px-3 py-1 rounded-full bg-cyan-50 text-cyan-600 text-xs font-bold border border-cyan-100">
                                            Estimation in Progress
                                        </span>
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

                        {/* TAB CONTENT: Estimation */}
                        {activeTab === "Estimation" && (
                            <div className="p-5">
                                <EstimationTab />
                            </div>
                        )}

                        {/* TAB CONTENT: GOM Calculator */}
                        {activeTab === "GOM Calculator" && (
                            <div className="p-5">
                                <GomCalculatorTab gomApproved={gomApproved} onApproveGom={handleApproveGom} canApprove={opportunityStage === 1 && !isLost} />
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
                                <h3 className="font-bold text-red-800 text-sm">Opportunity Closed — {currentStageName === 'Proposal Lost' ? 'Proposal Lost' : 'Lost'}</h3>
                                <p className="text-sm text-red-700 mt-1"><span className="font-semibold">Remarks:</span> {lostRemarks || 'No remarks provided.'}</p>
                            </div>
                        </div>
                    )}

                    {/* Header Card */}
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
                                <p className="font-semibold text-slate-800">{formData.duration || "N/A"}</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500 mb-1">Day Rate</p>
                                <p className="font-semibold text-slate-800">{formData.expectedDayRate || "N/A"}</p>
                            </div>
                            <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                                <p className="text-xs text-indigo-600 mb-1">Estimated Value</p>
                                <p className="font-semibold text-indigo-700">{fmtCurrency(Number(formData.value))}</p>
                            </div>
                            {Number(adjustedEstimatedValue) > 0 && (
                            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                                <p className="text-xs text-amber-600 mb-1">Adjusted Value</p>
                                <p className="font-bold text-amber-700">{fmtCurrency(Number(adjustedEstimatedValue))}</p>
                            </div>
                            )}
                        </div>
                    </div>

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
                                        <p className="font-medium text-slate-800 mt-1">{formData.duration || "N/A"}</p>
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
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-sm mb-4">
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Markup %</span>
                                        <p className="font-medium text-slate-800 mt-1">{presalesData.markup}%</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Mode of Travel</span>
                                        <p className="font-medium text-slate-800 mt-1">{presalesData.modeOfTravel || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Travel Frequency</span>
                                        <p className="font-medium text-slate-800 mt-1">{presalesData.frequency || "N/A"}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Round Trip Cost</span>
                                        <p className="font-medium text-slate-800 mt-1">{fmtCurrency(Number(presalesData.roundTripCost))}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Medical Insurance</span>
                                        <p className="font-medium text-slate-800 mt-1">{fmtCurrency(Number(presalesData.medicalInsuranceCost))}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Visa Cost</span>
                                        <p className="font-medium text-slate-800 mt-1">{fmtCurrency(Number(presalesData.visaCost))}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Vaccine Cost</span>
                                        <p className="font-medium text-slate-800 mt-1">{fmtCurrency(Number(presalesData.vaccineCost))}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wide">Hotel Cost</span>
                                        <p className="font-medium text-slate-800 mt-1">{fmtCurrency(Number(presalesData.hotelCost))}</p>
                                    </div>
                                </div>

                                {/* GOM Summary */}
                                <h4 className="text-xs font-semibold text-slate-700 mb-2 pt-3 border-t border-slate-100">GOM Summary</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                        <p className="text-xs text-blue-600 mb-1">Revenue</p>
                                        <p className="text-sm font-bold text-blue-700">{fmtCurrency(Math.round(gomResults.offshoreRevenue * (gomInputs.workingDays || 1)))}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                        <p className="text-xs text-slate-500 mb-1">Offshore Day Rate</p>
                                        <p className="text-sm font-bold text-slate-700">{gomResults.offshoreDayRate.toLocaleString()}</p>
                                    </div>
                                    <div className={`rounded-lg p-3 border ${gomResults.offshoreGom >= 20 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                        <p className="text-xs text-slate-500 mb-1">GOM %</p>
                                        <p className={`text-sm font-bold ${gomResults.offshoreGom >= 20 ? 'text-green-700' : 'text-red-700'}`}>{gomResults.offshoreGom.toFixed(1)}%</p>
                                    </div>
                                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                                        <p className="text-xs text-purple-600 mb-1">Adjusted Cost</p>
                                        <p className="text-sm font-bold text-purple-700">{fmtCurrency(Math.round(gomResults.adjustedCost))}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* PROJECT VIEW (Step 3) — Converted project info */}
            {activeStep === 3 && (
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
                                <p className="font-semibold text-sm text-slate-800">{fmtCurrency(Number(formData.value))}</p>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CommentsPanel opportunityId={id} currentStage={steps[activeStep]} />
                <AuditLogPane opportunityId={id} />
            </div>

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
                                    <div className="text-xs text-slate-400 py-2">Loading managers…</div>
                                ) : (
                                    <select
                                        required
                                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                        value={presalesForm.managerName}
                                        onChange={(e) => setPresalesForm({ ...presalesForm, managerName: e.target.value })}
                                    >
                                        <option value="">Select Manager</option>
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
                                    ? 'Mark this opportunity as Proposal Lost — the proposal was not accepted. Please provide a reason.'
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
                                Provide a comment explaining why re-estimation is needed. Optionally provide an adjusted estimated value.
                            </p>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-bold text-slate-700">Comment *</label>
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
                                <label className="block text-sm font-bold text-slate-700">Adjusted Estimated Value ({cSym})</label>
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
        </div>
    );
}
