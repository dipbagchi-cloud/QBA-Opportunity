"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
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
    Clock
} from "lucide-react";
import { useOpportunityStore } from "@/lib/store";
import { EstimationTab } from "./components/EstimationTab";
import { ResourceAssignmentTab } from "./components/ResourceAssignmentTab";
import { GomCalculatorTab } from "./components/GomCalculatorTab";
import { OpportunityEstimationProvider } from "./context/OpportunityEstimationContext";

// Mock Data for Dropdowns (Shared)
const REGIONS = ["North America", "EMEA", "APAC", "LATAM"];
const PRACTICES = ["Cloud Engineering", "Data & AI", "Enterprise Apps", "Cybersecurity", "Digital Experience"];
const PROJECT_TYPES = ["New Development", "Modernization", "Maintenance", "Consulting"];
const PRICING_MODELS = ["Time & Material", "Fixed Price", "Retainer", "Hybrid"];
const DURATIONS = ["3 Months", "6 Months", "9 Months", "12 Months", "> 1 Year"];
const ARCHITECTS = ["David Chen", "Sarah Jones", "Rahul Gupta", "Emily White"];

export default function OpportunityDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id } = use(params);
    const { updateOpportunity } = useOpportunityStore();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showPresalesModal, setShowPresalesModal] = useState(false);

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
        pricingModel: "",
        expectedDayRate: "",
        description: "",
        value: 0
    });

    // Presales Modal State (Modal for transition)
    const [presalesForm, setPresalesForm] = useState({
        proposalDueDate: "",
        comments: ""
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
    const steps = ["Pipeline", "Presales", "Sales", "Project"];

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
                rev = cost * (1 + gomInputs.markupPercent / 100);
            } else {
                rev = gomInputs.targetRevenue;
            }

            if (rev > 0) {
                gom = ((rev - cost) / rev) * 100;
                profit = (gomInputs.markupPercent / (1 + gomInputs.markupPercent / 100)) * 100;
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

    }, [gomInputs]);

    // Fetch Data on Load
    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await fetch(`/api/opportunities/${id}`);
                if (!res.ok) throw new Error("Failed to load");
                const data = await res.json();

                setFormData({
                    clientName: data.client?.name || "",
                    region: data.region || "",
                    projectType: "New Development", // Default if missing
                    projectName: data.title || "",
                    practice: data.practice || "",
                    salesRep: data.salesRepName || "",
                    technology: data.technology || "",
                    tentativeStartDate: data.tentativeStartDate ? new Date(data.tentativeStartDate).toISOString().split('T')[0] : "",
                    tentativeEndDate: data.tentativeEndDate ? new Date(data.tentativeEndDate).toISOString().split('T')[0] : "",
                    duration: data.tentativeDuration || "",
                    pricingModel: data.pricingModel || "",
                    expectedDayRate: data.expectedDayRate || "",
                    description: data.description || "",
                    value: data.value || 0
                });

                // Update active step based on stage
                if (data.currentStage === 'Presales' || data.stage?.name === 'Qualification') setActiveStep(1);
                else if (data.stage?.name === 'Proposal') setActiveStep(2);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                // Also update store optimistic
                await updateOpportunity(id, {
                    name: formData.projectName,
                    value: Number(formData.value)
                });
                // Success feedback could be toast, for now just redirect or stay
                alert("Opportunity updated successfully!");
                router.push("/dashboard/opportunities");
            } else {
                alert("Failed to save changes. Please check all fields.");
            }
        } catch (error) {
            console.error("Update failed", error);
            alert("An unknown error occurred.");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePresalesSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            // Update stage to Qualification (Presales) and save presales data
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stageName: 'Qualification', // Maps to Presales in our workflow
                    presalesData: presalesForm
                })
            });

            if (res.ok) {
                await updateOpportunity(id, { stage: 'Qualification' });
                setActiveStep(1);
                setShowPresalesModal(false);
                alert("Moved to Presales successfully!");
            } else {
                alert("Failed to move to Presales.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-8">Loading Opportunity...</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-8 relative">
            {/* Header with Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold text-slate-800">
                        Opportunity / <span className="text-slate-500 font-normal">Pipeline Details</span>
                    </h1>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md text-slate-700 font-medium hover:bg-slate-50"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-md font-medium hover:bg-red-50">
                        Cancel Opportunity
                    </button>
                    <button
                        onClick={() => setShowPresalesModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
                    >
                        Move to Presales
                    </button>
                    <button className="px-4 py-2 bg-slate-900 text-white rounded-md font-medium hover:bg-slate-800">
                        Hold
                    </button>
                </div>
            </div>

            {/* Stepper Navigation */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <div className="flex w-full mt-2 h-10 bg-slate-50 rounded-full overflow-hidden border border-slate-200">
                    {steps.map((step, idx) => {
                        const isCompleted = idx < activeStep;
                        const isActive = idx === activeStep;

                        let bgClass = "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700";
                        if (isCompleted) bgClass = "bg-emerald-500 text-white";
                        if (isActive) bgClass = "bg-indigo-900 text-white";

                        return (
                            <button
                                key={step}
                                onClick={() => setActiveStep(idx)}
                                className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors relative ${bgClass}`}
                            >
                                {isCompleted && <Check className="w-4 h-4" />}
                                {step}
                                {/* Chevron Separator */}
                                {idx !== steps.length - 1 && (
                                    <div className={`absolute right-0 top-0 bottom-0 w-[1px] transform skew-x-12 translate-x-3 z-10 
                                        ${isCompleted && idx + 1 <= activeStep ? 'bg-emerald-500 border-r border-emerald-400' : 'bg-white border-r border-slate-300'}`}
                                    ></div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* PIPELINE VIEW (Step 0) */}
            {activeStep === 0 && (
                <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
                    {/* ... Existing Pipeline Form Code ... */}
                    <div className="mb-6 flex items-center gap-4">
                        <h2 className="text-lg font-bold text-slate-900">Basic Information</h2>
                        <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-600 text-xs font-semibold border border-purple-200">
                            Just Received
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                        {/* Row 1 */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Client Name *</label>
                            <select
                                name="clientName"
                                required
                                value={formData.clientName}
                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                onChange={handleChange}
                            >
                                <option value="">Select Client</option>
                                <option value="Acme Corp">Acme Corp</option>
                                <option value="Globex">Globex Inc</option>
                                <option value="African Industries Group">African Industries Group</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Region *</label>
                            <select
                                name="region"
                                required
                                value={formData.region}
                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                onChange={handleChange}
                            >
                                <option value="">Select Region</option>
                                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                <option value="South Africa">South Africa</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Project Type *</label>
                            <select
                                name="projectType"
                                required
                                value={formData.projectType}
                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                onChange={handleChange}
                            >
                                <option value="">Select Project Type</option>
                                {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                <option value="Development">Development</option>
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
                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                onChange={handleChange}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Practice</label>
                            <select
                                name="practice"
                                value={formData.practice}
                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                onChange={handleChange}
                            >
                                <option value="">Find Practice</option>
                                {PRACTICES.map(p => <option key={p} value={p}>{p}</option>)}
                                <option value="Application Development and Maintenance">Application Development and Maintenance</option>
                            </select>
                        </div>

                        {/* Row 3 */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Sales Representative *</label>
                            <select
                                name="salesRep"
                                required
                                value={formData.salesRep}
                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                onChange={handleChange}
                            >
                                <option value="">Find SalesPerson</option>
                                <option value="Sarah Wilson">Sarah Wilson</option>
                                <option value="Mike Ross">Mike Ross</option>
                                <option value="Sandip Nath">Sandip Nath</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Technology *</label>
                            <input
                                type="text"
                                name="technology"
                                required
                                value={formData.technology}
                                placeholder="Technology"
                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                onChange={handleChange}
                            />
                        </div>

                        {/* Value */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Estimated Value ($)</label>
                            <input
                                type="number"
                                name="value"
                                required
                                value={formData.value}
                                placeholder="0.00"
                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                onChange={handleChange}
                            />
                        </div>

                        {/* Row 4: Dates & Duration */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Tentative Start Date *</label>
                            <input
                                type="date"
                                name="tentativeStartDate"
                                required
                                value={formData.tentativeStartDate}
                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm text-slate-500"
                                onChange={handleChange}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Duration/Tentative End Date</label>
                            <select
                                name="duration"
                                value={formData.duration}
                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                onChange={handleChange}
                            >
                                <option value="">Select Duration</option>
                                {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                <option value="Tentative End Date">Tentative End Date</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-slate-700">Tentative End Date</label>
                            <input
                                type="date"
                                name="tentativeEndDate"
                                value={formData.tentativeEndDate}
                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm text-slate-500"
                                onChange={handleChange}
                            />
                        </div>

                    </div>

                    {/* Footer Actions */}
                    <div className="mt-12 flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-6 py-2 bg-blue-600 border border-transparent rounded-md text-white font-bold hover:bg-blue-700 transition-all disabled:opacity-70"
                        >
                            {isSaving ? 'Saving...' : 'Submit Details'}
                        </button>
                    </div>
                </form>
            )}

            {/* PRESALES VIEW (Step 1) */}
            {activeStep === 1 && (
                <OpportunityEstimationProvider>
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                        {/* Inner Tabs */}
                        <div className="flex items-center gap-6 px-6 border-b border-slate-200 text-sm font-medium">
                            {["Project Details", "Schedule", "Resource Assignment", "Estimation", "GOM Calculator"].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`py-4 border-b-2 transition-colors ${activeTab === tab ? "border-indigo-600 text-indigo-900 font-bold" : "border-transparent text-slate-500 hover:text-indigo-600"}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* TAB CONTENT: Project Details */}
                        {activeTab === "Project Details" && (
                            <div className="p-8 space-y-8 animate-in fade-in duration-300">

                                {/* Status Badge */}
                                <div className="mb-4">
                                    <h2 className="text-lg font-bold text-slate-900 inline-block mr-4">Project Details</h2>
                                    <span className="px-3 py-1 rounded-full bg-cyan-50 text-cyan-600 text-xs font-bold border border-cyan-100">
                                        Estimation in Progress
                                    </span>
                                </div>

                                {/* Read Only Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-8 text-sm">
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
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Pricing Model</label>
                                        <div className="font-semibold text-slate-800">{formData.pricingModel}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Expected Day Rate</label>
                                        <div className="font-semibold text-slate-800">{formData.expectedDayRate}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Description</label>
                                        <div className="font-semibold text-slate-800 truncate">{formData.description}</div>
                                    </div>
                                </div>

                                {/* Divider */}
                                <hr className="border-slate-100" />

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                    {/* Left: Resource & Cost */}
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">Resource & Cost</h3>

                                        <div className="grid grid-cols-2 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">GOM (%)</label>
                                            <div className="text-sm font-bold text-slate-800">: 0.0</div>

                                            <label className="text-sm font-medium text-slate-600">GOM Approve/Reject</label>
                                            <div className="text-sm font-bold text-amber-600">: Approval Needed</div>

                                            <label className="text-sm font-medium text-slate-600">Revenue (₹)</label>
                                            <div className="text-sm font-bold text-slate-800">: 0.0</div>

                                            <label className="text-sm font-medium text-slate-600">Final Cost (₹)</label>
                                            <div className="text-sm font-bold text-slate-800">: 0.0</div>
                                        </div>
                                    </div>

                                    {/* Right: Inputs */}
                                    <div className="space-y-4 pt-10">
                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Resource Cost (₹)</label>
                                            <input disabled type="text" className="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm" />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Markup (%)</label>
                                            <input
                                                type="number"
                                                name="markup"
                                                value={presalesData.markup}
                                                onChange={handlePresalesDataChange}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Travel & Hospitality */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">Travel & Hospitality</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                                        {/* Left Col */}
                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Mode of Travel</label>
                                            <select
                                                name="modeOfTravel"
                                                value={presalesData.modeOfTravel}
                                                onChange={handlePresalesDataChange}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
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
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Round Trip Cost (₹)</label>
                                            <input
                                                type="number"
                                                name="roundTripCost"
                                                value={presalesData.roundTripCost}
                                                onChange={handlePresalesDataChange}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Medical Insurance Cost (₹)</label>
                                            <input
                                                type="number"
                                                name="medicalInsuranceCost"
                                                value={presalesData.medicalInsuranceCost}
                                                onChange={handlePresalesDataChange}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Visa Cost (₹)</label>
                                            <input
                                                type="number"
                                                name="visaCost"
                                                value={presalesData.visaCost}
                                                onChange={handlePresalesDataChange}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Vaccine Cost (₹)</label>
                                            <input
                                                type="number"
                                                name="vaccineCost"
                                                value={presalesData.vaccineCost}
                                                onChange={handlePresalesDataChange}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <label className="text-sm font-medium text-slate-600">Hotel Cost (₹)</label>
                                            <input
                                                type="number"
                                                name="hotelCost"
                                                value={presalesData.hotelCost}
                                                onChange={handlePresalesDataChange}
                                                className="col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 items-center">
                                            <div className="col-span-3 flex justify-end">
                                                <button className="px-4 py-2 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 text-sm">
                                                    Send GOM Approval
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Attachments */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4">
                                        <h3 className="font-bold text-slate-900">Attachments</h3>
                                        <button className="px-3 py-1.5 bg-slate-100 text-slate-700 font-medium rounded text-xs hover:bg-slate-200 flex items-center gap-2">
                                            <Paperclip className="w-3 h-3" /> Attach
                                        </button>
                                    </div>

                                    <div className="bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
                                        <table className="w-full text-sm text-left text-slate-600">
                                            <thead className="bg-slate-100 border-b border-slate-200 font-semibold">
                                                <tr>
                                                    <th className="px-4 py-3">File Name</th>
                                                    <th className="px-4 py-3">File Type</th>
                                                    <th className="px-4 py-3">Upload Date</th>
                                                    <th className="px-4 py-3">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="px-4 py-8 text-center text-slate-400 italic" colSpan={4}>No attachments found</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB CONTENT: Schedule */}
                        {activeTab === "Schedule" && (
                            <div className="p-8 space-y-6 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-xl font-bold text-slate-900">Schedule Details</h2>
                                        <span className="px-3 py-1 rounded-full bg-cyan-50 text-cyan-600 text-xs font-bold border border-cyan-100">
                                            Estimation in Progress
                                        </span>
                                    </div>
                                    <button className="px-6 py-2 bg-white border border-blue-200 text-blue-600 font-semibold rounded-md hover:bg-blue-50">
                                        Update
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-bold text-slate-700">Tentative Start Date *</label>
                                        <input
                                            type="date"
                                            name="tentativeStartDate"
                                            value={formData.tentativeStartDate}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-bold text-slate-700">Duration/Tentative End Date *</label>
                                        <select
                                            name="duration"
                                            value={formData.duration}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                        >
                                            <option value="">Select Duration</option>
                                            <option value="Tentative End Date">Tentative End Date</option>
                                            {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-bold text-slate-700">Tentative End Date</label>
                                        <input
                                            type="date"
                                            name="tentativeEndDate"
                                            value={formData.tentativeEndDate}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}



                        {/* TAB CONTENT: Resource Assignment */}
                        {activeTab === "Resource Assignment" && (
                            <div className="p-8">
                                <ResourceAssignmentTab />
                            </div>
                        )}

                        {/* Old GOM Calculator (Hidden) */}
                        {activeTab === "OldResourceAssignment" && (
                            <div className="p-8 space-y-6 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-xl font-bold text-slate-900">Resource Assignment</h2>
                                        <span className="px-3 py-1 rounded-full bg-cyan-50 text-cyan-600 text-xs font-bold border border-cyan-100">
                                            Estimation in Progress
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Inputs Column */}
                                    <div className="lg:col-span-1 space-y-6">
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                                <Briefcase className="w-5 h-5 text-indigo-600" />
                                                Cost Inputs
                                            </h3>

                                            <div className="space-y-4">
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

                                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                                <RefreshCw className="w-5 h-5 text-emerald-600" />
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
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                                <Clock className="w-5 h-5 text-amber-600" />
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
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2">Calculation Results</h3>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
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
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-slate-50 text-slate-500 font-medium border-y border-slate-200">
                                                        <tr>
                                                            <th className="py-3 px-4">Metric</th>
                                                            <th className="py-3 px-4">Value</th>
                                                            <th className="py-3 px-4">Formula / Notes</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        <tr>
                                                            <td className="py-3 px-4 text-slate-800">Adjusted Cost</td>
                                                            <td className="py-3 px-4 font-mono">{gomResults.adjustedCost.toLocaleString()}</td>
                                                            <td className="py-3 px-4 text-slate-400 text-xs">CTC * (1 + (Mgmt+Bench)/100)</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="py-3 px-4 text-slate-800">Annual Working Days</td>
                                                            <td className="py-3 px-4 font-mono">220</td>
                                                            <td className="py-3 px-4 text-slate-400 text-xs">Fixed Standard</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="py-3 px-4 text-slate-800">Actual Profit Margin</td>
                                                            <td className="py-3 px-4 font-mono font-bold text-indigo-600">{gomResults.offshoreProfit.toLocaleString()}%</td>
                                                            <td className="py-3 px-4 text-slate-400 text-xs">(Markup / (1 + Markup%)) * 100</td>
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
                            <div className="p-8">
                                <EstimationTab />
                            </div>
                        )}

                        {/* TAB CONTENT: GOM Calculator */}
                        {activeTab === "GOM Calculator" && (
                            <div className="p-8">
                                <GomCalculatorTab />
                            </div>
                        )}
                    </div>
                </OpportunityEstimationProvider>
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

                        <form onSubmit={handlePresalesSubmit} className="p-6 space-y-6">

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
        </div>
    );
}
