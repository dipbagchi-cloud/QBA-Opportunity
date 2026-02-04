"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Calendar,
    Search,
    ChevronDown,
    Plus,
    ArrowRight,
    Briefcase,
    Globe,
    Code,
    User,
    CheckCircle2,
    Paperclip
} from "lucide-react";
import { useOpportunityStore } from "@/lib/store";

// Mock Data for Dropdowns
const REGIONS = ["North America", "EMEA", "APAC", "LATAM"];
const PRACTICES = ["Cloud Engineering", "Data & AI", "Enterprise Apps", "Cybersecurity", "Digital Experience"];
const PROJECT_TYPES = ["New Development", "Modernization", "Maintenance", "Consulting"];
const PRICING_MODELS = ["Time & Material", "Fixed Price", "Retainer", "Hybrid"];
const DURATIONS = ["3 Months", "6 Months", "9 Months", "12 Months", "> 1 Year"];

export default function NewOpportunityPage() {
    const router = useRouter();
    const { addOpportunity } = useOpportunityStore();
    const [isLoading, setIsLoading] = useState(false);

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

    // Step State
    const [activeStep, setActiveStep] = useState(0);
    const steps = ["Pipeline", "Presales", "Sales", "Project"];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await addOpportunity({
                title: formData.projectName,
                companyName: formData.clientName, // Store maps this to Client Relation
                value: Number(formData.value) || (Number(formData.expectedDayRate) * 20), // Fallback calculation
                stage: "Pipeline",
                description: formData.description,

                // Enhanced Fields
                region: formData.region,
                practice: formData.practice,
                technology: formData.technology,
                tentativeStartDate: formData.tentativeStartDate ? new Date(formData.tentativeStartDate) : null,
                tentativeEndDate: formData.tentativeEndDate ? new Date(formData.tentativeEndDate) : null,
                tentativeDuration: formData.duration,
                salesRepName: formData.salesRep,
                pricingModel: formData.pricingModel,
                expectedDayRate: Number(formData.expectedDayRate),

                // Defaults
                probability: 10,
                ownerId: "user-1", // Mock current user
                source: "Manual Entry"
            });

            router.push("/dashboard/opportunities");
        } catch (error) {
            console.error("Failed to create opportunity", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Header / Breadcrumb */}
            <div>
                <h1 className="text-2xl font-semibold text-slate-800">
                    Opportunity / <span className="text-slate-500 font-normal">New Pipeline</span>
                </h1>
            </div>

            {/* Stepper Navigation */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <div className="flex w-full mt-2 h-10 bg-slate-50 rounded-full overflow-hidden border border-slate-200">
                    {steps.map((step, idx) => (
                        <button
                            key={step}
                            onClick={() => setActiveStep(idx)}
                            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors relative
                                ${activeStep === idx
                                    ? 'bg-indigo-900 text-white'
                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                }
                            `}
                        >
                            {step}
                            {/* Chevron Separator */}
                            {idx !== steps.length - 1 && (
                                <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-white transform skew-x-12 translate-x-3 z-10 border-r border-slate-300"></div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Basic Information Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
                <div className="mb-6">
                    <h2 className="text-lg font-bold text-slate-900">Basic Information</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">

                    {/* Row 1 */}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Client Name *</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <select
                                    name="clientName"
                                    required
                                    className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm
                                             focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    onChange={handleChange}
                                >
                                    <option value="">Select Client</option>
                                    <option value="Acme Corp">Acme Corp</option>
                                    <option value="Globex">Globex Inc</option>
                                    <option value="Stark Ind">Stark Industries</option>
                                </select>
                            </div>
                            <button type="button" className="p-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Region *</label>
                        <select
                            name="region"
                            required
                            className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                            onChange={handleChange}
                        >
                            <option value="">Select Region</option>
                            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Project Type *</label>
                        <select
                            name="projectType"
                            required
                            className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                            onChange={handleChange}
                        >
                            <option value="">Select Project Type</option>
                            {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {/* Row 2 */}
                    <div className="col-span-1 md:col-span-2 space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Project Name *</label>
                        <input
                            type="text"
                            name="projectName"
                            required
                            placeholder="XXX--XXX- Project Details"
                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Practice</label>
                        <select
                            name="practice"
                            className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                            onChange={handleChange}
                        >
                            <option value="">Find Practice</option>
                            {PRACTICES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    {/* Row 3 */}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Sales Representative *</label>
                        <select
                            name="salesRep"
                            required
                            className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                            onChange={handleChange}
                        >
                            <option value="">Find SalesPerson</option>
                            <option value="Sarah Wilson">Sarah Wilson</option>
                            <option value="Mike Ross">Mike Ross</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Technology *</label>
                        <input
                            type="text"
                            name="technology"
                            required
                            placeholder="Technology"
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
                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm text-slate-500"
                            onChange={handleChange}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Duration/Tentative End Date</label>
                        <select
                            name="duration"
                            className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                            onChange={handleChange}
                        >
                            <option value="">Select Duration</option>
                            {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Tentative End Date</label>
                        <input
                            type="date"
                            name="tentativeEndDate"
                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm text-slate-500"
                            onChange={handleChange}
                        />
                    </div>

                    {/* Row 5: Pricing */}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Pricing Model *</label>
                        <select
                            name="pricingModel"
                            required
                            className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                            onChange={handleChange}
                        >
                            <option value="">Select Model</option>
                            {PRICING_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Expected Day Rate (₹) *</label>
                        <input
                            type="number"
                            name="expectedDayRate"
                            required
                            placeholder="0"
                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                            onChange={handleChange}
                        />
                    </div>

                    {/* Spacer for 3rd column */}
                    <div className="hidden lg:block"></div>

                    {/* Row 6: Description & Attachments */}
                    <div className="col-span-1 md:col-span-2 lg:col-span-2 space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Description *</label>
                        <textarea
                            name="description"
                            required
                            placeholder="Project Description..."
                            rows={4}
                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm resize-none"
                            onChange={handleChange}
                        />
                    </div>

                    <div className="col-span-1 space-y-1.5 flex flex-col">
                        <label className="block text-sm font-bold text-slate-700">Attachments</label>
                        <div className="flex-1 mt-1 border border-slate-300 rounded-md p-4 bg-white flex flex-col items-center justify-center text-slate-400 gap-2 border-dashed">
                            <span className="text-xs">There is nothing attached.</span>
                            <button type="button" className="flex items-center gap-1 text-slate-600 font-semibold text-xs hover:text-indigo-600">
                                <Paperclip className="w-3 h-3" />
                                Attach file
                            </button>
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="mt-12 flex justify-end gap-3 pt-6 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2 bg-white border border-slate-300 rounded-md text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                    >
                        Clear
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-6 py-2 bg-indigo-600 border border-transparent rounded-md text-white font-bold hover:bg-indigo-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Submitting...' : 'Submit Details'}
                    </button>
                </div>
            </form>
        </div>
    );
}
