"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { getRateCards } from "@/lib/rate-cards";
import { useOpportunityEstimation, ResourceRow } from "../context/OpportunityEstimationContext";
import { calculateRateCard } from "@/lib/gom-calculator";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ResourceAssignmentTab() {
    const {
        resources,
        setResources,
        selectedYear,
        setSelectedYear,
        assumptions,
        markupPercent
    } = useOpportunityEstimation();

    const currentYear = new Date().getFullYear();
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [effortType, setEffortType] = useState<"QBA" | "3rd Party" | "QBA + 3rd Party">("QBA");

    const rateCards = useMemo(() => getRateCards(), []);

    const filteredRoles = useMemo(() => {
        if (!searchTerm) return rateCards;
        const lowerTerm = searchTerm.toLowerCase();
        return rateCards.filter(r =>
            r.role.toLowerCase().includes(lowerTerm) ||
            (r.code && r.code.toLowerCase().includes(lowerTerm))
        );
    }, [rateCards, searchTerm]);

    const addRole = (roleItem: any) => {
        // Calculate daily cost and rate using assumptions
        const rateCardResult = calculateRateCard({
            annualCtc: roleItem.annualCtc,
            monthsPerYear: 12,
            ...assumptions
        });

        // Calculate daily rate with markup
        const dailyRate = rateCardResult.dailyCost * (1 + (markupPercent / 100));

        const newRow: ResourceRow = {
            id: crypto.randomUUID(),
            role: roleItem.role,
            baseLocation: "India",
            deliveryFrom: "Hyderabad",
            type: "Offshore",
            annualCTC: roleItem.annualCtc,
            dailyCost: rateCardResult.dailyCost,
            dailyRate: dailyRate,
            monthlyEfforts: {},
        };
        setResources([...resources, newRow]);
        setIsAdding(false);
        setSearchTerm("");
    };

    const removeRow = (id: string) => {
        setResources(resources.filter(r => r.id !== id));
    };

    const updateRow = (id: string, field: keyof ResourceRow, value: any) => {
        setResources(resources.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const updateMonthlyEffort = (id: string, month: string, value: number) => {
        setResources(resources.map(r => {
            if (r.id === id) {
                return {
                    ...r,
                    monthlyEfforts: {
                        ...r.monthlyEfforts,
                        [month]: value
                    }
                };
            }
            return r;
        }));
    };

    // Calculate totals per month
    const monthlyTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        MONTHS.forEach(month => {
            totals[month] = resources.reduce((sum, r) => sum + (r.monthlyEfforts[month] || 0), 0);
        });
        return totals;
    }, [resources]);

    return (
        <div className="space-y-6">
            {/* Header with Year Selector and Effort Type */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-lg text-slate-800">Estimation Details</h3>
                    <span className="px-3 py-1 bg-cyan-50 text-cyan-600 text-xs font-medium rounded-full border border-cyan-100">
                        Estimation in Progress
                    </span>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="px-3 py-1.5 border border-slate-200 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-950"
                    >
                        {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>

                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-md shadow-sm transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Resource
                    </button>
                )}
            </div>

            {/* Efforts Details - Radio Buttons */}
            <div className="bg-white p-4 rounded-lg border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Efforts Details</h4>
                <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="effortType"
                            value="QBA"
                            checked={effortType === "QBA"}
                            onChange={(e) => setEffortType(e.target.value as any)}
                            className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-slate-700">QBA</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="effortType"
                            value="3rd Party"
                            checked={effortType === "3rd Party"}
                            onChange={(e) => setEffortType(e.target.value as any)}
                            className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-slate-700">3rd Party</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            name="effortType"
                            value="QBA + 3rd Party"
                            checked={effortType === "QBA + 3rd Party"}
                            onChange={(e) => setEffortType(e.target.value as any)}
                            className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-slate-700">QBA + 3rd Party</span>
                    </label>
                </div>
            </div>

            {/* Search Panel */}
            {isAdding && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-in slide-in-from-top-2 shadow-sm">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            autoFocus
                            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="Search by role or code (e.g. 'Java', 'PM', 'NET')..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <button
                            onClick={() => setIsAdding(false)}
                            className="absolute right-2 top-2 text-xs text-slate-500 hover:text-slate-900 px-2 py-1 bg-slate-100 rounded"
                        >
                            Cancel
                        </button>
                    </div>
                    <div className="mt-2 max-h-60 overflow-y-auto border rounded-md bg-white divide-y">
                        {filteredRoles.length === 0 && <div className="p-3 text-sm text-slate-500">No roles found.</div>}
                        {filteredRoles.map((r) => (
                            <button
                                key={r.code || r.role}
                                onClick={() => addRole(r)}
                                className="w-full text-left p-3 text-sm hover:bg-slate-50 flex justify-between items-center group transition-colors"
                            >
                                <div>
                                    <div className="font-medium text-slate-700">
                                        {r.code && <span className="inline-block w-20 text-blue-600 font-mono text-xs">{r.code}</span>}
                                        {r.role}
                                    </div>
                                    <div className="text-xs text-slate-500 pl-20">{r.category}</div>
                                </div>
                                <span className="text-xs text-slate-400 group-hover:text-slate-600 font-mono">
                                    ₹{(r.annualCtc / 100000).toFixed(1)}L
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Table with Monthly Efforts */}
            <div className="border rounded-lg overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
                            <tr>
                                <th className="p-3 border-r sticky left-0 bg-slate-50 z-10 min-w-[200px]">Skillset Experience</th>
                                <th className="p-3 border-r min-w-[150px]">Base Location-Delivery From</th>
                                {MONTHS.map(month => (
                                    <th key={month} className="p-3 text-center border-r min-w-[80px]">{month}</th>
                                ))}
                                <th className="p-3 text-center min-w-[60px]">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {resources.length === 0 && (
                                <tr>
                                    <td colSpan={15} className="p-8 text-center text-slate-400 italic">
                                        No resources assigned. Click "Add Resource" to begin.
                                    </td>
                                </tr>
                            )}
                            {resources.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-2 px-3 font-medium text-slate-900 border-r sticky left-0 bg-white z-10">
                                        <div className="flex flex-col">
                                            <span className="text-sm">{row.role}</span>
                                            <span className="text-xs text-slate-500">₹{(row.annualCTC / 100000).toFixed(1)}L CTC</span>
                                        </div>
                                    </td>
                                    <td className="p-2 border-r">
                                        <div className="flex flex-col gap-1">
                                            <select
                                                className="w-full bg-slate-50 border-transparent rounded px-2 py-1 text-slate-700 text-xs focus:bg-white focus:ring-1 focus:ring-slate-200"
                                                value={row.baseLocation}
                                                onChange={(e) => updateRow(row.id, "baseLocation", e.target.value)}
                                            >
                                                <option value="India">India</option>
                                                <option value="USA">USA</option>
                                                <option value="UK">UK</option>
                                            </select>
                                            <select
                                                className="w-full bg-slate-50 border-transparent rounded px-2 py-1 text-slate-700 text-xs focus:bg-white focus:ring-1 focus:ring-slate-200"
                                                value={row.deliveryFrom}
                                                onChange={(e) => updateRow(row.id, "deliveryFrom", e.target.value)}
                                            >
                                                <option value="Hyderabad">Hyderabad</option>
                                                <option value="Bangalore">Bangalore</option>
                                                <option value="Pune">Pune</option>
                                            </select>
                                        </div>
                                    </td>
                                    {MONTHS.map(month => (
                                        <td key={month} className="p-1 border-r">
                                            <input
                                                type="number"
                                                min="0"
                                                max="31"
                                                placeholder="0"
                                                value={row.monthlyEfforts[month] || ""}
                                                onChange={(e) => updateMonthlyEffort(row.id, month, Number(e.target.value) || 0)}
                                                className="w-full text-center bg-transparent border-none text-xs focus:bg-blue-50 focus:outline-none p-1"
                                            />
                                        </td>
                                    ))}
                                    <td className="p-2 text-center">
                                        <button
                                            onClick={() => removeRow(row.id)}
                                            className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                            title="Remove Resource"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {/* Totals Row */}
                            {resources.length > 0 && (
                                <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300">
                                    <td className="p-2 px-3 border-r sticky left-0 bg-slate-100 z-10">Total Days</td>
                                    <td className="p-2 border-r"></td>
                                    {MONTHS.map(month => (
                                        <td key={month} className="p-2 text-center border-r text-slate-900">
                                            {monthlyTotals[month] || '-'}
                                        </td>
                                    ))}
                                    <td className="p-2"></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Cost Details Section */}
            <div className="bg-white p-4 rounded-lg border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Cost Details</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-600">Currency:</span>
                        <span className="font-semibold text-slate-900">INR</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-600">Total Resources:</span>
                        <span className="font-semibold text-slate-900">{resources.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-600">Effort Type:</span>
                        <span className="font-semibold text-slate-900">{effortType}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
