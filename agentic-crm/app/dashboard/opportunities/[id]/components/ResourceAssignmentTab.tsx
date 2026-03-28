"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { fetchRateCards } from "@/lib/rate-cards";
import { useOpportunityEstimation, ResourceRow } from "../context/OpportunityEstimationContext";
import { calculateRateCard } from "@/lib/gom-calculator";
import { useCurrency } from "@/components/providers/currency-provider";

const ALL_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ResourceAssignmentTab() {
    const {
        resources,
        setResources,
        selectedYear,
        setSelectedYear,
        assumptions,
        markupPercent,
        readOnly,
        startDate,
        endDate,
    } = useOpportunityEstimation();

    const { format: fmtCurrency } = useCurrency();

    // Rate card CTC values are always in INR — format without currency conversion
    const fmtINR = (val: number, opts?: { compact?: boolean }) => {
        if (opts?.compact && Math.abs(val) >= 100000) {
            return `₹${(val / 100000).toFixed(1)}L`;
        }
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
    };

    const currentYear = new Date().getFullYear();
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [effortType, setEffortType] = useState<"QBA" | "3rd Party" | "QBA + 3rd Party">("QBA");
    const [rateCards, setRateCards] = useState<any[]>([]);

    useEffect(() => {
        fetchRateCards().then(setRateCards).catch(() => setRateCards([]));
    }, []);

    // Compute visible months based on start/end dates — only scheduled months are shown/editable
    const visibleMonths = useMemo(() => {
        if (!startDate) return ALL_MONTHS;
        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : null;

        const startMonth = start.getMonth(); // 0-indexed
        const startYear = start.getFullYear();

        if (!end) {
            if (selectedYear < startYear) return [];
            if (selectedYear === startYear) return ALL_MONTHS.slice(startMonth);
            return ALL_MONTHS; // future years after start
        }

        const endMonth = end.getMonth();
        const endYear = end.getFullYear();

        // Year entirely outside the scheduled range — no editable months
        if (selectedYear < startYear || selectedYear > endYear) return [];

        if (startYear === endYear && startYear === selectedYear) {
            return ALL_MONTHS.slice(startMonth, endMonth + 1);
        } else if (selectedYear === startYear) {
            return ALL_MONTHS.slice(startMonth);
        } else if (selectedYear === endYear) {
            return ALL_MONTHS.slice(0, endMonth + 1);
        }
        return ALL_MONTHS; // full year in between
    }, [startDate, endDate, selectedYear]);

    const filteredRoles = useMemo(() => {
        if (!searchTerm) return rateCards;
        const lowerTerm = searchTerm.toLowerCase();
        return rateCards.filter(r =>
            r.role.toLowerCase().includes(lowerTerm) ||
            (r.code && r.code.toLowerCase().includes(lowerTerm)) ||
            (r.skill && r.skill.toLowerCase().includes(lowerTerm)) ||
            (r.experienceBand && r.experienceBand.toLowerCase().includes(lowerTerm))
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
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2)),
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
        visibleMonths.forEach(month => {
            totals[month] = resources.reduce((sum, r) => sum + (r.monthlyEfforts[month] || 0), 0);
        });
        return totals;
    }, [resources, visibleMonths]);

    return (
        <div className="space-y-4">
            {/* Header with Year Selector and Effort Type */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="font-bold text-base text-slate-800">Estimation Details</h3>

                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        disabled={readOnly}
                        className="px-3 py-1.5 border border-slate-200 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-950 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                        {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>

                {!isAdding && !readOnly && (
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
            <div className="bg-white p-3 rounded-lg border border-slate-200">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Efforts Details</h4>
                <div className="flex gap-4">
                    {(["QBA", "3rd Party", "QBA + 3rd Party"] as const).map(option => (
                        <label key={option} className={`flex items-center gap-2 ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                            <input
                                type="radio"
                                name="effortType"
                                value={option}
                                checked={effortType === option}
                                onChange={(e) => setEffortType(e.target.value as any)}
                                disabled={readOnly}
                                className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm text-slate-700">{option}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Search Panel */}
            {isAdding && !readOnly && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-in slide-in-from-top-2 shadow-sm">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            autoFocus
                            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-slate-950"
                            placeholder="Search by skill, experience, role or code..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <button
                            onClick={() => { setIsAdding(false); setSearchTerm(""); }}
                            className="absolute right-2 top-2 text-xs text-slate-500 hover:text-slate-900 px-2 py-1 bg-slate-100 rounded"
                        >
                            Cancel
                        </button>
                    </div>
                    {/* Columned dropdown list */}
                    <div className="mt-2 max-h-72 overflow-y-auto border rounded-md bg-white">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr className="text-xs text-slate-500 uppercase tracking-wide border-b">
                                    <th className="text-left p-2 pl-3 font-medium">Skill</th>
                                    <th className="text-left p-2 font-medium">Experience</th>
                                    <th className="text-left p-2 font-medium">Category</th>
                                    <th className="text-right p-2 pr-3 font-medium">Annual CTC</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRoles.length === 0 && (
                                    <tr><td colSpan={4} className="p-3 text-sm text-slate-500 text-center">No roles found.</td></tr>
                                )}
                                {filteredRoles.map((r) => (
                                    <tr
                                        key={r.code || r.role}
                                        onClick={() => addRole(r)}
                                        className="hover:bg-blue-50 cursor-pointer transition-colors group"
                                    >
                                        <td className="p-2 pl-3 font-medium text-slate-800">{r.skill || r.role}</td>
                                        <td className="p-2 text-slate-600">{r.experienceBand || '-'}</td>
                                        <td className="p-2 text-slate-500 text-xs">{r.category}</td>
                                        <td className="p-2 pr-3 text-right font-mono text-slate-500 group-hover:text-slate-700">{fmtINR(r.annualCtc, { compact: true })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                                {visibleMonths.map(month => (
                                    <th key={month} className="p-3 text-center border-r min-w-[80px]">{month}</th>
                                ))}
                                {!readOnly && <th className="p-3 text-center min-w-[60px]">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {resources.length === 0 && (
                                <tr>
                                    <td colSpan={visibleMonths.length + 3} className="p-6 text-center text-slate-400 italic">
                                        No resources assigned. Click "Add Resource" to begin.
                                    </td>
                                </tr>
                            )}
                            {resources.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-2 px-3 font-medium text-slate-900 border-r sticky left-0 bg-white z-10">
                                        <div className="flex flex-col">
                                            <span className="text-sm">{row.role}</span>
                                            <span className="text-xs text-slate-500">{fmtINR(row.annualCTC, { compact: true })} CTC</span>
                                        </div>
                                    </td>
                                    <td className="p-2 border-r">
                                        <div className="flex flex-col gap-1">
                                            <select
                                                className="w-full bg-slate-50 border-transparent rounded px-2 py-1 text-slate-700 text-xs focus:bg-white focus:ring-1 focus:ring-slate-200 disabled:cursor-not-allowed"
                                                value={row.baseLocation}
                                                onChange={(e) => updateRow(row.id, "baseLocation", e.target.value)}
                                                disabled={readOnly}
                                            >
                                                <option value="India">India</option>
                                                <option value="USA">USA</option>
                                                <option value="UK">UK</option>
                                            </select>
                                            <select
                                                className="w-full bg-slate-50 border-transparent rounded px-2 py-1 text-slate-700 text-xs focus:bg-white focus:ring-1 focus:ring-slate-200 disabled:cursor-not-allowed"
                                                value={row.deliveryFrom}
                                                onChange={(e) => updateRow(row.id, "deliveryFrom", e.target.value)}
                                                disabled={readOnly}
                                            >
                                                <option value="Hyderabad">Hyderabad</option>
                                                <option value="Bangalore">Bangalore</option>
                                                <option value="Pune">Pune</option>
                                            </select>
                                        </div>
                                    </td>
                                    {visibleMonths.map(month => (
                                        <td key={month} className="p-1 border-r">
                                            {readOnly ? (
                                                <div className="w-full text-center text-xs p-1 text-slate-700">{row.monthlyEfforts[month] || 0}</div>
                                            ) : (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="31"
                                                    placeholder="0"
                                                    value={row.monthlyEfforts[month] || ""}
                                                    onChange={(e) => updateMonthlyEffort(row.id, month, Number(e.target.value) || 0)}
                                                    className="w-full text-center bg-transparent border-none text-xs focus:bg-blue-50 focus:outline-none p-1"
                                                />
                                            )}
                                        </td>
                                    ))}
                                    {!readOnly && (
                                        <td className="p-2 text-center">
                                            <button
                                                onClick={() => removeRow(row.id)}
                                                className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                                title="Remove Resource"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}

                            {/* Totals Row */}
                            {resources.length > 0 && (
                                <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300">
                                    <td className="p-2 px-3 border-r sticky left-0 bg-slate-100 z-10">Total Days</td>
                                    <td className="p-2 border-r"></td>
                                    {visibleMonths.map(month => (
                                        <td key={month} className="p-2 text-center border-r text-slate-900">
                                            {monthlyTotals[month] || '-'}
                                        </td>
                                    ))}
                                    {!readOnly && <td className="p-2"></td>}
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
