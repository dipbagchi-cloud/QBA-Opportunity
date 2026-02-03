"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Briefcase, MapPin, User, CheckCircle2, AlertCircle,
    ArrowRight, Save, Calculator, FileText, DollarSign, Users,
    ChevronRight, ArrowLeft
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

interface Resource {
    id: string;
    name: string;
    grade: string;
    effortFactor: number;
    attritionFactor: number;
    standardRate: number;
}

interface Opportunity {
    id: string;
    title: string;
    client: { name: string };
    currentStage: string;
    detailedStatus: string;
    geolocation?: string;
    salesRepName?: string;
    presalesData?: any;
    salesData?: any;
    value: number;
}

export default function OpportunityDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [opp, setOpp] = useState<Opportunity | null>(null);
    const [activeTab, setActiveTab] = useState("pipeline");
    const [resources, setResources] = useState<Resource[]>([]);

    // Pipeline Form State
    const [geolocation, setGeolocation] = useState("");
    const [salesRep, setSalesRep] = useState("");
    const [detailedStatus, setDetailedStatus] = useState("");

    // Presales Form State
    const [selectedResourceId, setSelectedResourceId] = useState("");
    const [days, setDays] = useState(0);
    const [selectedResources, setSelectedResources] = useState<any[]>([]); // { resource, days, hours, cost }
    const [marginPercent, setMarginPercent] = useState(35);

    // Sales Form State
    const [finalQuote, setFinalQuote] = useState(0);
    const [salesCategory, setSalesCategory] = useState("Probable");

    const id = params.id as string;

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            const [oppRes, resRes] = await Promise.all([
                fetch(`/api/opportunities/${id}`),
                fetch('/api/resources') // Fetch HRMS resources
            ]);

            const oppData = await oppRes.json();
            const resData = await resRes.json();

            if (oppData.error) throw new Error(oppData.error);

            setOpp(oppData);

            if (Array.isArray(resData)) {
                setResources(resData);
            } else {
                console.error("Failed to load resources:", resData);
                setResources([]); // Fallback to avoid .map crash
            }

            // Init Form State
            setGeolocation(oppData.geolocation || "");
            setSalesRep(oppData.salesRepName || "");
            setDetailedStatus(oppData.detailedStatus || "just received");

            if (oppData.presalesData) {
                // If saved as string, parse it, else use direct
                const pData = typeof oppData.presalesData === 'string' ? JSON.parse(oppData.presalesData) : oppData.presalesData;
                setSelectedResources(pData.selectedResources || []);
            }

            if (oppData.salesData) {
                const sData = typeof oppData.salesData === 'string' ? JSON.parse(oppData.salesData) : oppData.salesData;
                setFinalQuote(sData.finalQuote || 0);
                setSalesCategory(sData.category || "Probable");
            }

            if (oppData.currentStage) setActiveTab(oppData.currentStage.toLowerCase());

        } catch (error) {
            console.error(error);
            toast({ title: "Error loading opportunity", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    // --- Calculations ---
    const calculatePresales = () => {
        const totalCost = selectedResources.reduce((sum, r) => sum + r.cost, 0);
        const totalHours = selectedResources.reduce((sum, r) => sum + r.hours, 0);
        // Projected Quote formula: 35% GOM. 
        // If Margin = 35%, then Cost = Price * (1 - 0.35) -> Price = Cost / 0.65
        const quote = totalCost / (1 - (marginPercent / 100));
        return { totalCost, totalHours, quote };
    };

    const presalesTotals = calculatePresales();

    const addResource = () => {
        const res = resources.find(r => r.id === selectedResourceId);
        if (!res || days <= 0) return;

        // Formula: Hours = days * 8 * effortFactor * attritionFactor
        const hours = days * 8 * res.effortFactor * res.attritionFactor;
        const cost = hours * res.standardRate;

        setSelectedResources([...selectedResources, {
            id: res.id,
            name: res.name,
            grade: res.grade,
            days,
            hours,
            cost
        }]);
        setDays(0);
        setSelectedResourceId("");
    };

    const removeResource = (index: number) => {
        const newRes = [...selectedResources];
        newRes.splice(index, 1);
        setSelectedResources(newRes);
    };

    // --- Actions ---

    const saveDetails = async (stage: string) => {
        if (!opp) return;

        let updateData: any = {
            currentStage: stage.charAt(0).toUpperCase() + stage.slice(1),
            detailedStatus
        };

        if (stage === 'pipeline') {
            updateData.geolocation = geolocation;
            updateData.salesRepName = salesRep;
        }

        if (stage === 'presales') {
            const { totalCost, totalHours, quote } = calculatePresales();
            updateData.presalesData = {
                selectedResources,
                totalHours,
                estimatedCost: totalCost,
                projectedQuote: quote
            };
            // Also update main value for visibility
            updateData.value = quote;
        }

        if (stage === 'sales') {
            updateData.salesData = {
                finalQuote,
                category: salesCategory
            };
            updateData.value = finalQuote; // Final override
        }

        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (res.ok) {
                toast({ title: "Opportunity updated", description: `Data saved for ${stage} stage.` });
                loadData(); // Reload to sync
            } else {
                throw new Error("Failed to save");
            }
        } catch (error) {
            toast({ title: "Error saving", variant: "destructive" });
        }
    };

    if (isLoading) return <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
    if (!opp) return <div className="p-10 text-center">Opportunity not found</div>;

    return (
        <div className="min-h-screen pb-20 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
                <Link href="/dashboard/opportunities">
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{opp.title}</h1>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>{opp.client?.name}</span>
                        <span>•</span>
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-200">
                            {opp.currentStage}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stage Tabs */}
            <div className="flex border-b border-slate-200">
                {['pipeline', 'presales', 'sales'].map((stage) => (
                    <button
                        key={stage}
                        onClick={() => setActiveTab(stage)}
                        className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === stage
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {stage.charAt(0).toUpperCase() + stage.slice(1)} Stage
                    </button>
                ))}
            </div>

            {/* CONTENT AREA */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 min-h-[500px]">

                {/* PIPELINE TAB */}
                {activeTab === 'pipeline' && (
                    <div className="max-w-2xl space-y-6 animate-in fade-in">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-indigo-600" />
                            Lead Information
                        </h3>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="label">Project Name</label>
                                <input disabled value={opp.title} className="input-disabled w-full p-2 border rounded bg-slate-50" />
                            </div>
                            <div>
                                <label className="label">Client Name</label>
                                <input disabled value={opp.client?.name} className="input-disabled w-full p-2 border rounded bg-slate-50" />
                            </div>
                            <div>
                                <label className="label">Sales Representative</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <input
                                        value={salesRep} onChange={e => setSalesRep(e.target.value)}
                                        className="w-full pl-10 p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Enter name"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="label">Geolocation</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <input
                                        value={geolocation} onChange={e => setGeolocation(e.target.value)}
                                        className="w-full pl-10 p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Region / Country"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="label">Status</label>
                                <select
                                    value={detailedStatus} onChange={e => setDetailedStatus(e.target.value)}
                                    className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                                >
                                    <option value="just received">Just Received</option>
                                    <option value="in process">In Process</option>
                                    <option value="move to Presales">Move to Presales</option>
                                    <option value="on hold">On Hold</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button onClick={() => saveDetails('pipeline')} className="btn-primary flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                                <Save className="w-4 h-4" /> Save Pipeline Data
                            </button>
                        </div>
                    </div>
                )}

                {/* PRESALES TAB */}
                {activeTab === 'presales' && (
                    <div className="space-y-8 animate-in fade-in">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Calculator className="w-5 h-5 text-indigo-600" />
                                    Effort Estimation (Automated)
                                </h3>

                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                                    <div className="flex gap-4 items-end">
                                        <div className="flex-1">
                                            <label className="text-sm font-medium text-slate-700 mb-1 block">Select Resource</label>
                                            <select
                                                value={selectedResourceId}
                                                onChange={e => setSelectedResourceId(e.target.value)}
                                                className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                                            >
                                                <option value="">-- Select from HRMS --</option>
                                                {resources.map(r => (
                                                    <option key={r.id} value={r.id}>{r.name} ({r.grade})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-32">
                                            <label className="text-sm font-medium text-slate-700 mb-1 block">Days</label>
                                            <input
                                                type="number" min="1"
                                                value={days} onChange={e => setDays(Number(e.target.value))}
                                                className="w-full p-2 border border-slate-200 rounded-lg"
                                            />
                                        </div>
                                        <button
                                            onClick={addResource}
                                            disabled={!selectedResourceId || days <= 0}
                                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 italic">
                                        Formula: Hours = Days × 8 × Effort Factor × Attrition
                                    </p>
                                </div>

                                {/* Resource Table */}
                                {selectedResources.length > 0 && (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 text-slate-600 font-medium">
                                                <tr>
                                                    <th className="py-2 px-4 text-left">Resource</th>
                                                    <th className="py-2 px-4 text-right">Days</th>
                                                    <th className="py-2 px-4 text-right">Hours</th>
                                                    <th className="py-2 px-4 text-right">Cost</th>
                                                    <th className="py-2 px-4 text-center">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {selectedResources.map((r, idx) => (
                                                    <tr key={idx}>
                                                        <td className="py-2 px-4">{r.name} <span className="text-xs text-slate-400">({r.grade})</span></td>
                                                        <td className="py-2 px-4 text-right">{r.days}</td>
                                                        <td className="py-2 px-4 text-right">{r.hours.toFixed(1)}</td>
                                                        <td className="py-2 px-4 text-right font-mono">${r.cost.toLocaleString()}</td>
                                                        <td className="py-2 px-4 text-center">
                                                            <button onClick={() => removeResource(idx)} className="text-red-500 hover:text-red-700">Delete</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Cost Summary Column */}
                            <div className="space-y-6">
                                <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 space-y-4">
                                    <h4 className="font-bold text-indigo-900">Commercials</h4>

                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Total Hours</span>
                                        <span className="font-medium">{presalesTotals.totalHours.toFixed(1)} hrs</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Cost Base</span>
                                        <span className="font-medium">${presalesTotals.totalCost.toLocaleString()}</span>
                                    </div>
                                    <div className="border-t border-indigo-200 my-2 pt-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-indigo-800">Target Margin</span>
                                            <input
                                                type="number" value={marginPercent}
                                                onChange={e => setMarginPercent(Number(e.target.value))}
                                                className="w-16 text-right p-1 rounded border border-indigo-200 text-sm"
                                            />
                                        </div>
                                        <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                                            <span className="text-sm text-slate-500">Projected Quote</span>
                                            <span className="text-xl font-bold text-indigo-600">${Math.round(presalesTotals.quote).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Status</label>
                                    <select
                                        value={detailedStatus} onChange={e => setDetailedStatus(e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg"
                                    >
                                        <option value="Estimation in progress">Estimation In Progress</option>
                                        <option value="Proposal in Progress">Proposal In Progress</option>
                                        <option value="move to Sales">Move to Sales</option>
                                    </select>
                                </div>

                                <button onClick={() => saveDetails('presales')} className="w-full btn-primary bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 flex justify-center items-center gap-2">
                                    <Save className="w-4 h-4" /> Save Presales Data
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* SALES TAB */}
                {activeTab === 'sales' && (
                    <div className="max-w-3xl space-y-8 animate-in fade-in">
                        <div className="flex items-center gap-2 mb-6">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                            <h3 className="text-xl font-bold text-slate-800">Final Closure</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <label className="label block font-semibold">Initial Quote (Presales)</label>
                                <div className="text-2xl font-bold text-slate-400">
                                    ${Math.round(presalesTotals.quote).toLocaleString()}
                                </div>
                                <p className="text-xs text-slate-400">Calculated from presales estimation</p>
                            </div>
                            <div className="space-y-4">
                                <label className="label block font-semibold text-indigo-700">Final Quote (Agreed)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-3 w-5 h-5 text-indigo-500" />
                                    <input
                                        type="number"
                                        value={finalQuote} onChange={e => setFinalQuote(Number(e.target.value))}
                                        className="w-full pl-10 pr-4 py-2 text-xl font-bold border-2 border-indigo-200 rounded-xl focus:border-indigo-500 outline-none text-indigo-900"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Comparison Visual */}
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                            <h4 className="font-semibold text-slate-700 mb-4">Quote Comparison</h4>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-slate-200 rounded-full overflow-hidden w-full">
                                        <div className="h-full bg-slate-400 w-full"></div>
                                    </div>
                                    <div className="text-xs text-center font-mono">Initial</div>
                                </div>
                                <div className="text-slate-400 font-bold">vs</div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-slate-200 rounded-full overflow-hidden w-full">
                                        <div
                                            className={`h-full ${finalQuote >= presalesTotals.quote ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                            style={{ width: `${Math.min((finalQuote / (presalesTotals.quote || 1)) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-xs text-center font-mono">Final</div>
                                </div>
                            </div>
                            <div className="mt-4 text-center">
                                <span className={`text-sm font-medium ${finalQuote >= presalesTotals.quote ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {finalQuote >= presalesTotals.quote ? 'Upsell Achieved' : 'Discount Applied'}
                                    ({Math.abs(((finalQuote - presalesTotals.quote) / presalesTotals.quote) * 100).toFixed(1)}%)
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="label block mb-2">Likelihood (Category)</label>
                                <div className="flex gap-2">
                                    {['Assured', 'Probable', 'Unlikely'].map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setSalesCategory(cat)}
                                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${salesCategory === cat
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="label block mb-2">Stage Status</label>
                                <select
                                    value={detailedStatus} onChange={e => setDetailedStatus(e.target.value)}
                                    className="w-full p-2 border border-slate-200 rounded-lg"
                                >
                                    <option value="Quote sent">Quote Sent</option>
                                    <option value="Follow-ups ongoing">Follow-ups Ongoing</option>
                                    <option value="Ongoing Negotiations">Ongoing Negotiations</option>
                                    <option value="Closed Won">Closed Won</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button onClick={() => saveDetails('sales')} className="btn-primary bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5" />
                                Confim Sales Closure
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

// Simple label helper
function Label({ children }: { children: React.ReactNode }) {
    return <label className="block text-sm font-medium text-slate-700 mb-1">{children}</label>;
}
