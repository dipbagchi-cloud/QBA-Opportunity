"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/components/providers/currency-provider";
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
    Paperclip,
    X,
    Upload,
    FileText,
    Trash2
} from "lucide-react";
import { useOpportunityStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { API_URL, getAuthHeaders } from "@/lib/api";

const DURATION_UNITS = ["days", "weeks", "months"];

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

// Convert duration value + unit for calculations
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

export default function NewOpportunityPage() {
    const router = useRouter();
    const { currency, symbol: cSym, setCurrency } = useCurrency();
    const { addOpportunity } = useOpportunityStore();
    const { user } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);

    // Dynamic dropdown data
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
    const [regions, setRegions] = useState<string[]>([]);
    const [technologies, setTechnologies] = useState<string[]>([]);
    const [pricingModels, setPricingModels] = useState<string[]>([]);
    const [salespersons, setSalespersons] = useState<{ id: string; name: string; department?: string }[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [projectTypes, setProjectTypes] = useState<string[]>([]);

    // Add Client modal
    const [showAddClient, setShowAddClient] = useState(false);
    const [newClientName, setNewClientName] = useState("");
    const [newClientContact, setNewClientContact] = useState("");
    const [newClientAddress, setNewClientAddress] = useState("");
    const [addingClient, setAddingClient] = useState(false);

    // Tech dropdown state
    const [techDropdownOpen, setTechDropdownOpen] = useState(false);
    const techDropdownRef = useRef<HTMLDivElement>(null);

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
        duration: "",
        durationUnit: "months",
        pricingModel: "",
        expectedDayRate: "",
        description: "",
        value: 0
    });

    // Country → Region + Currency mapping (fetched from API)
    const [countryRegionMap, setCountryRegionMap] = useState<Record<string, { region: string; currency: string }>>({});
    const countries = Object.keys(countryRegionMap).sort();

    // Attachments State
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Step State
    const [activeStep, setActiveStep] = useState(0);
    const steps = ["Pipeline", "Presales", "Sales", "Project"];

    // Fetch dropdown data
    useEffect(() => {
        const fetchMasterData = async () => {
            const headers = getAuthHeaders();
            try {
                const [clientsRes, regionsRes, techRes, pricingRes, salesRes, deptRes, projTypesRes, countryMapRes] = await Promise.all([
                    fetch(`${API_URL}/api/master/clients`, { headers }),
                    fetch(`${API_URL}/api/master/regions`, { headers }),
                    fetch(`${API_URL}/api/master/technologies`, { headers }),
                    fetch(`${API_URL}/api/master/pricing-models`, { headers }),
                    fetch(`${API_URL}/api/master/salespersons`, { headers }),
                    fetch(`${API_URL}/api/master/departments`, { headers }),
                    fetch(`${API_URL}/api/master/project-types`, { headers }),
                    fetch(`${API_URL}/api/master/country-region-map`, { headers }),
                ]);
                if (clientsRes.ok) setClients(await clientsRes.json());
                if (regionsRes.ok) setRegions((await regionsRes.json()).map((r: any) => r.name));
                if (techRes.ok) setTechnologies((await techRes.json()).map((t: any) => t.name));
                if (pricingRes.ok) setPricingModels((await pricingRes.json()).map((p: any) => p.name));
                if (salesRes.ok) setSalespersons(await salesRes.json());
                if (deptRes.ok) setDepartments(await deptRes.json());
                if (projTypesRes.ok) setProjectTypes((await projTypesRes.json()).map((p: any) => p.name));
                if (countryMapRes.ok) setCountryRegionMap(await countryMapRes.json());
            } catch (err) {
                console.error("Failed to load master data", err);
            }
        };
        fetchMasterData();
    }, []);



    // Auto-calculate tentative end date from start date + duration
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

    // Click-outside handler for tech dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (techDropdownRef.current && !techDropdownRef.current.contains(e.target as Node)) {
                setTechDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'country') {
            const countryInfo = countryRegionMap[value];
            const autoRegion = countryInfo?.region || '';
            setFormData(prev => ({ ...prev, country: value, region: autoRegion }));
            // Auto-switch global currency to the selected country's currency
            if (countryInfo?.currency) {
                setCurrency(countryInfo.currency);
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

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
                setNewClientContact("");
                setNewClientAddress("");
                setShowAddClient(false);
            } else {
                const errorData = await res.json().catch(() => ({}));
                alert(`Error: ${errorData.error || "Failed to add client. It may already exist."}`);
            }
        } catch (err) {
            console.error("Failed to add client", err);
            alert("Network error while adding client.");
        } finally {
            setAddingClient(false);
        }
    };

    const handleFileSelect = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const newFiles = Array.from(files);
        setPendingFiles(prev => [...prev, ...newFiles]);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const removePendingFile = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const rawValue: any = formData.value;
            const created = await addOpportunity({
                title: formData.projectName,
                companyName: formData.clientName, // Store maps this to Client Relation
                value: rawValue !== undefined && rawValue !== ''
                    ? Number(rawValue)
                    : (formData.projectType === 'Staffing' && formData.expectedDayRate
                        ? Math.round(Number(formData.expectedDayRate) * 20 * durationToMonths(Number(formData.duration) || 0, formData.durationUnit))
                        : undefined),
                currency, // <-- Add the current currency from context
                stage: "Pipeline",
                description: formData.description,

                // Enhanced Fields
                country: formData.country,
                region: formData.region,
                practice: formData.practice,
                technology: formData.technology,
                projectType: formData.projectType,
                tentativeStartDate: formData.tentativeStartDate ? new Date(formData.tentativeStartDate) : null,
                tentativeEndDate: formData.tentativeEndDate ? new Date(formData.tentativeEndDate) : null,
                tentativeDuration: formData.duration,
                tentativeDurationUnit: formData.durationUnit,
                salesRepName: formData.salesRep,
                pricingModel: formData.pricingModel,
                expectedDayRate: Number(formData.expectedDayRate),

                // Defaults
                probability: 10,
                ownerId: "user-1", // Mock current user
                source: "Manual Entry"
            });

            if (created && created.id && pendingFiles.length > 0) {
                // Upload files sequentially to the newly created opportunity
                for (let i = 0; i < pendingFiles.length; i++) {
                    const fd = new FormData();
                    fd.append("file", pendingFiles[i]);
                    await fetch(`${API_URL}/api/opportunities/${created.id}/attachments`, {
                        method: "POST",
                        headers: { Authorization: getAuthHeaders().Authorization },
                        body: fd,
                    });
                }
            }

            router.push("/dashboard/opportunities");
        } catch (error) {
            console.error("Failed to create opportunity", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-4">
            {/* Header / Breadcrumb */}
            <div>
                <h1 className="text-lg font-semibold text-slate-800">
                    Opportunity / <span className="text-slate-500 font-normal">New Pipeline</span>
                </h1>
            </div>

            {/* Stepper Navigation */}
            <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                <div className="flex w-full mt-1 h-8 bg-slate-50 rounded-full overflow-hidden border border-slate-200">
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
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
                <div className="mb-4">
                    <h2 className="text-base font-bold text-slate-900">Basic Information</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">

                    {/* Row 1: Client, Country, Region */}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Client Name *</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <SearchableSelect
                                    name="clientName"
                                    required={true}
                                    value={formData.clientName}
                                    onChange={handleChange}
                                    placeholder="Select Client"
                                    options={clients.map(c => ({ label: c.name, value: c.name }))}
                                />
                            </div>
                            <button type="button" onClick={() => setShowAddClient(true)} className="p-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Country *</label>
                        <SearchableSelect
                            name="country"
                            required={true}
                            value={formData.country}
                            onChange={handleChange}
                            placeholder="Select Country"
                            options={countries.map(c => ({ label: c, value: c }))}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Region {formData.country ? '' : '*'}</label>
                        <SearchableSelect
                            name="region"
                            required={true}
                            value={formData.region}
                            disabled={!!formData.country}
                            onChange={handleChange}
                            placeholder="Select Region"
                            options={regions.map(r => ({ label: r, value: r }))}
                        />
                        {formData.country && <p className="text-xs text-slate-400 mt-0.5">Auto-set from country</p>}
                    </div>

                    {/* Row 1b: Project Type */}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Project Type *</label>
                        <SearchableSelect
                            name="projectType"
                            required={true}
                            value={formData.projectType}
                            onChange={handleChange}
                            placeholder="Select Project Type"
                            options={projectTypes.map((t: string) => ({ label: t, value: t }))}
                        />
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
                        <SearchableSelect
                            name="practice"
                            value={formData.practice}
                            onChange={handleChange}
                            placeholder="Find Practice"
                            options={departments.map(p => ({ label: p, value: p }))}
                        />
                    </div>

                    {/* Row 3 */}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Sales Representative *</label>
                        <SearchableSelect
                            name="salesRep"
                            required={true}
                            value={formData.salesRep}
                            onChange={handleChange}
                            placeholder="Find SalesPerson"
                            options={salespersons.map(s => ({ label: `${s.name}${s.department ? ` (${s.department})` : ''}`, value: s.name }))}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Technology *</label>
                        <div className="relative" ref={techDropdownRef}>
                            <div
                                className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm flex flex-wrap gap-1 cursor-pointer"
                                onClick={() => setTechDropdownOpen(!techDropdownOpen)}
                            >
                                {formData.technology ? formData.technology.split(',').filter(Boolean).map(t => (
                                    <span key={t} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full border border-indigo-200">
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
                            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {technologies.map(t => {
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
                            </div>
                            )}
                        </div>
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
                        <label className="block text-sm font-bold text-slate-700">Duration</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                name="duration"
                                min="1"
                                value={formData.duration}
                                placeholder="Enter duration"
                                className="flex-1 px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                                onChange={handleChange}
                            />
                            <select
                                name="durationUnit"
                                value={formData.durationUnit}
                                className="w-28 px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
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

                    {/* Row 5: Pricing */}
                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Pricing Model *</label>
                        <SearchableSelect
                            name="pricingModel"
                            required={true}
                            value={formData.pricingModel}
                            onChange={handleChange}
                            placeholder="Select Model"
                            options={pricingModels.map(m => ({ label: m, value: m }))}
                        />
                    </div>

                    {formData.projectType === 'Staffing' && (
                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Expected Day Rate ({cSym}) *</label>
                        <input
                            type="number"
                            name="expectedDayRate"
                            required
                            placeholder="0"
                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                            onChange={handleChange}
                        />
                    </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700">Estimated Value ({cSym})</label>
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
                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm"
                            onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value === '' ? ('' as any) : Number(e.target.value) }))}
                        />
                        )}
                    </div>

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
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFileSelect(e.target.files)}
                        />
                        {pendingFiles.length === 0 ? (
                            <div className="mt-1 border border-slate-300 rounded-md p-4 bg-white flex flex-col items-center justify-center text-slate-400 gap-2 border-dashed h-[120px]">
                                <span className="text-xs">No files attached.</span>
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 text-slate-600 font-semibold text-xs hover:text-indigo-600">
                                    <Upload className="w-3 h-3" />
                                    Attach file
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2 mt-1">
                                <div className="max-h-[120px] overflow-y-auto space-y-1.5">
                                    {pendingFiles.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileText className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                                                <span className="text-slate-700 truncate">{f.name}</span>
                                                <span className="text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                                            </div>
                                            <button type="button" onClick={() => removePendingFile(i)} className="text-slate-400 hover:text-red-600 flex-shrink-0">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 text-slate-600 font-semibold text-xs hover:text-indigo-600">
                                    <Upload className="w-3 h-3" />
                                    Attach more
                                </button>
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="mt-8 flex justify-end gap-2 pt-4 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-4 py-1.5 bg-white border border-slate-300 rounded-md text-sm text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                    >
                        Clear
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 py-1.5 bg-indigo-600 border border-transparent rounded-md text-sm text-white font-bold hover:bg-indigo-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Submitting...' : 'Save'}
                    </button>
                </div>
            </form>

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
        </div>
    );
}
