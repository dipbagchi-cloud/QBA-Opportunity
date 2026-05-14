"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Search, Edit2, X, AlertCircle } from "lucide-react";
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
        currentUserName,
        startDate,
        endDate,
        effortType,
        setEffortType,
        durationInDays, // Expected working days from duration field
    } = useOpportunityEstimation();

    const { format: fmtCurrency, convert: convertCurrency, symbol: cSym, currency: globalCurrencyCode } = useCurrency();

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
    const [rateCards, setRateCards] = useState<any[]>([]);
    const [editingResource, setEditingResource] = useState<ResourceRow | null>(null);

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

    // A row is editable if: not globally readOnly, AND either no ownership info exists
    // (backward compat) OR the row belongs to the current user.
    const canEditRow = (row: ResourceRow) =>
        !readOnly && (!currentUserName || !row.addedBy || row.addedBy === currentUserName);

    const addRole = (roleItem: any) => {
        // Calculate daily cost and rate using assumptions
        const rateCardResult = calculateRateCard({
            annualCtc: roleItem.annualCtc,
            monthsPerYear: 12,
            ...assumptions
        });

        // dailyCost is loaded (CTC + overhead loadings / workingDays), dailyRate adds markup
        const dailyRate = rateCardResult.dailyCost * (1 + (markupPercent / 100));

        const newRow: ResourceRow = {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2)),
            role: roleItem.role,
            skill: roleItem.skill,
            experienceBand: roleItem.experienceBand,
            baseLocation: "India",
            deliveryFrom: "Hyderabad",
            type: "Offshore",
            annualCTC: roleItem.annualCtc,
            dailyCost: rateCardResult.dailyCost,
            dailyRate: dailyRate,
            monthlyEfforts: {},
            addedBy: currentUserName || undefined,
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

    const maxDaysPerMonth = useMemo(() => {
        const getMaxDaysForMonth = (monthStr: string, year: number): number => {
            if (!startDate) return 31;
            const monthIndex = ALL_MONTHS.indexOf(monthStr);
            if (monthIndex === -1) return 31;

            const firstDayOfMonth = new Date(year, monthIndex, 1);
            const lastDayOfMonth = new Date(year, monthIndex + 1, 0);

            const sDate = new Date(startDate);
            const eDate = endDate ? new Date(endDate) : new Date(8640000000000000);
            
            sDate.setHours(0,0,0,0);
            eDate.setHours(23,59,59,999);

            const calcStart = sDate > firstDayOfMonth ? sDate : firstDayOfMonth;
            const calcEnd = eDate < lastDayOfMonth ? eDate : lastDayOfMonth;

            if (calcStart > calcEnd) return 0;

            let workingDays = 0;
            let current = new Date(calcStart);
            current.setHours(0,0,0,0);
            
            while (current <= calcEnd) {
                const dayOfWeek = current.getDay();
                // 0 = Sunday, 6 = Saturday. Exclude weekends.
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    workingDays++;
                }
                current.setDate(current.getDate() + 1);
            }
            return workingDays;
        };

        const maxDays: Record<string, number> = {};
        ALL_MONTHS.forEach(month => {
            maxDays[month] = getMaxDaysForMonth(month, selectedYear);
        });
        return maxDays;
    }, [startDate, endDate, selectedYear]);

    const updateMonthlyEffort = (id: string, month: string, value: number) => {
        const maxVal = maxDaysPerMonth[month] || 31;
        const boundedValue = Math.max(0, Math.min(value, maxVal));
        setResources(resources.map(r => {
            if (r.id === id) {
                return {
                    ...r,
                    monthlyEfforts: {
                        ...r.monthlyEfforts,
                        [month]: boundedValue
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

    // Calculate total allocated days
    const totalAllocatedDays = useMemo(() => {
        return Object.values(monthlyTotals).reduce((sum, val) => sum + val, 0);
    }, [monthlyTotals]);

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
                                <th className="p-3 text-center border-r min-w-[100px]">Cost</th>
                                {!readOnly && <th className="p-3 text-center min-w-[60px]">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {resources.length === 0 && (
                                <tr>
                                    <td colSpan={visibleMonths.length + 4} className="p-6 text-center text-slate-400 italic">
                                        {readOnly ? "No resources assigned." : 'No resources assigned. Click "Add Resource" to begin.'}
                                    </td>
                                </tr>
                            )}
                            {resources.map((row) => {
                                const rowEditable = canEditRow(row);
                                return (
                                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-2 px-3 font-medium text-slate-900 border-r sticky left-0 bg-white z-10">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold">{row.skill || row.role}</span>
                                            <span className="text-xs text-slate-500 mt-0.5">{row.experienceBand || '-'} | {fmtINR(row.annualCTC, { compact: true })} CTC</span>
                                            {row.addedBy && (
                                                <span className="text-[10px] mt-0.5 text-indigo-500 font-medium">
                                                    {rowEditable ? "Your estimate" : `by ${row.addedBy}`}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-2 border-r">
                                        <div className="flex flex-col gap-1">
                                            <select
                                                className="w-full bg-slate-50 border-transparent rounded px-2 py-1 text-slate-700 text-xs focus:bg-white focus:ring-1 focus:ring-slate-200 disabled:cursor-not-allowed"
                                                value={row.baseLocation}
                                                onChange={(e) => updateRow(row.id, "baseLocation", e.target.value)}
                                                disabled={!rowEditable}
                                            >
                                                <option value="India">India</option>
                                                <option value="USA">USA</option>
                                                <option value="UK">UK</option>
                                            </select>
                                            <select
                                                className="w-full bg-slate-50 border-transparent rounded px-2 py-1 text-slate-700 text-xs focus:bg-white focus:ring-1 focus:ring-slate-200 disabled:cursor-not-allowed"
                                                value={row.deliveryFrom}
                                                onChange={(e) => updateRow(row.id, "deliveryFrom", e.target.value)}
                                                disabled={!rowEditable}
                                            >
                                                <option value="Hyderabad">Hyderabad</option>
                                                <option value="Bangalore">Bangalore</option>
                                                <option value="Pune">Pune</option>
                                            </select>
                                        </div>
                                    </td>
                                    {visibleMonths.map(month => (
                                        <td key={month} className="p-1 border-r">
                                            {!rowEditable ? (
                                                <div className="w-full text-center text-xs p-1 text-slate-700">{row.monthlyEfforts[month] || 0}</div>
                                            ) : (
                                                <div className="relative group">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={maxDaysPerMonth[month] || 31}
                                                        placeholder="0"
                                                        value={row.monthlyEfforts[month] === undefined ? "" : row.monthlyEfforts[month]}
                                                        onChange={(e) => updateMonthlyEffort(row.id, month, Number(e.target.value) || 0)}
                                                        className={`w-full text-center border-none text-xs focus:outline-none p-1 ${maxDaysPerMonth[month] === 0 ? 'bg-slate-100 cursor-not-allowed text-slate-400' : 'bg-transparent focus:bg-blue-50 text-slate-900'}`}
                                                        disabled={maxDaysPerMonth[month] === 0}
                                                        title={`Max working days: ${maxDaysPerMonth[month]}`}
                                                    />
                                                </div>
                                            )}
                                        </td>
                                    ))}
                                    <td className="p-2 text-center border-r font-mono text-xs text-slate-700">
                                        {(() => {
                                            const totalDays = visibleMonths.reduce((sum, m) => sum + (row.monthlyEfforts[m] || 0), 0);
                                            const cost = totalDays * row.dailyCost;
                                            const showConverted = globalCurrencyCode !== 'INR';
                                            const monthBreakup = visibleMonths
                                                .filter(m => (row.monthlyEfforts[m] || 0) > 0)
                                                .map(m => {
                                                    const mCost = row.monthlyEfforts[m] * row.dailyCost;
                                                    let line = `${m}: ${row.monthlyEfforts[m]}d x INR ${row.dailyCost.toLocaleString()} = INR ${mCost.toLocaleString()}`;
                                                    if (showConverted) line += ` (${cSym}${convertCurrency(mCost).toLocaleString(undefined, {maximumFractionDigits: 2})})`;
                                                    return line;
                                                })
                                                .join('\n');
                                            // Formula tooltip: CTC + overhead breakdown
                                            const overheadPct = assumptions.deliveryMgmtPercent + assumptions.benchPercent + assumptions.leaveEligibilityPercent + assumptions.annualGrowthBufferPercent + assumptions.averageIncrementPercent;
                                            const rawDaily = row.annualCTC / assumptions.workingDaysPerYear;
                                            let tooltip = `${row.skill || row.role}\nAnnual CTC: INR ${row.annualCTC?.toLocaleString() || '—'}\nOverhead: DM ${assumptions.deliveryMgmtPercent}% + Bench ${assumptions.benchPercent}% + Leave ${assumptions.leaveEligibilityPercent}% + Growth ${assumptions.annualGrowthBufferPercent}% + Incr ${assumptions.averageIncrementPercent}% = ${overheadPct}%\nLoaded Annual: INR ${(row.annualCTC * (1 + overheadPct/100)).toLocaleString(undefined, {maximumFractionDigits: 0})}\nWorking Days: ${assumptions.workingDaysPerYear}\nDaily Cost: INR ${row.dailyCost.toLocaleString(undefined, {maximumFractionDigits: 0})} (raw: INR ${rawDaily.toLocaleString(undefined, {maximumFractionDigits: 0})})`;
                                            if (showConverted) tooltip += ` (${cSym}${convertCurrency(row.dailyCost).toLocaleString(undefined, {maximumFractionDigits: 2})})`;
                                            tooltip += `\n\n${monthBreakup || '(no days allocated)'}\n\nTotal: ${totalDays}d x INR ${row.dailyCost.toLocaleString(undefined, {maximumFractionDigits: 0})} = INR ${cost.toLocaleString()}`;
                                            if (showConverted) tooltip += ` (${cSym}${convertCurrency(cost).toLocaleString(undefined, {maximumFractionDigits: 2})})`;
                                            return <span title={tooltip} className="cursor-help underline decoration-dotted decoration-slate-400">{fmtCurrency(cost)}</span>;
                                        })()}
                                    </td>
                                    {!readOnly && (
                                        <td className="p-2 text-center flex items-center justify-center gap-2">
                                            {rowEditable ? (
                                                <>
                                                    <button
                                                        onClick={() => setEditingResource(row)}
                                                        className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                                        title="Edit Resource"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => removeRow(row.id)}
                                                        className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                                        title="Remove Resource"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic">view only</span>
                                            )}
                                        </td>
                                    )}
                                </tr>
                                );
                            })}

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
                                    <td className="p-2 text-center border-r font-mono text-sm text-slate-900">
                                        {fmtCurrency(resources.reduce((sum, row) => {
                                            const days = visibleMonths.reduce((s, m) => s + (row.monthlyEfforts[m] || 0), 0);
                                            return sum + days * row.dailyCost;
                                        }, 0))}
                                    </td>
                                    {!readOnly && <td className="p-2"></td>}
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Allocation Summary */}
            {durationInDays > 0 && (
                <div className={`p-4 rounded-lg border-2 ${
                    totalAllocatedDays > durationInDays 
                        ? 'bg-red-50 border-red-300' 
                        : totalAllocatedDays === durationInDays
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-amber-50 border-amber-300'
                }`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-1">Working Days Allocation</h4>
                            <div className="flex items-center gap-4 text-sm">
                                <div>
                                    <span className="text-slate-600">Expected: </span>
                                    <span className="font-bold text-slate-900">{durationInDays} days</span>
                                </div>
                                <div>
                                    <span className="text-slate-600">Allocated: </span>
                                    <span className={`font-bold ${
                                        totalAllocatedDays > durationInDays ? 'text-red-600' :
                                        totalAllocatedDays === durationInDays ? 'text-emerald-600' :
                                        'text-amber-600'
                                    }`}>{totalAllocatedDays} days</span>
                                </div>
                                <div>
                                    <span className="text-slate-600">Remaining: </span>
                                    <span className={`font-bold ${
                                        durationInDays - totalAllocatedDays < 0 ? 'text-red-600' : 'text-slate-900'
                                    }`}>{durationInDays - totalAllocatedDays} days</span>
                                </div>
                            </div>
                        </div>
                        {totalAllocatedDays > durationInDays && (
                            <div className="flex items-center gap-2 text-red-600 text-sm font-semibold">
                                <AlertCircle className="w-5 h-5" />
                                Over-allocated by {totalAllocatedDays - durationInDays} days!
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Cost Details Section */}
            <div className="bg-white p-4 rounded-lg border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Cost Details</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-600">Currency:</span>
                        <span className="font-semibold text-slate-900">INR</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-600">Total Resources:</span>
                        <span className="font-semibold text-slate-900">{resources.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-600">Effort Type:</span>
                        <span className="font-semibold text-slate-900">{effortType}</span>
                    </div>
                </div>
            </div>

            {/* Edit Resource Modal */}
            {editingResource && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-bold text-slate-800">Edit Resource Details</h3>
                            <button onClick={() => setEditingResource(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/50 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Role / Skill</label>
                                <input
                                    type="text"
                                    value={editingResource.skill || editingResource.role || ''}
                                    onChange={(e) => setEditingResource({ ...editingResource, skill: e.target.value, role: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Experience Band</label>
                                <input
                                    type="text"
                                    value={editingResource.experienceBand || ''}
                                    onChange={(e) => setEditingResource({ ...editingResource, experienceBand: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Annual CTC (INR)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editingResource.annualCTC || 0}
                                    onChange={(e) => {
                                        const ctc = Number(e.target.value) || 0;
                                        const rateCardResult = calculateRateCard({
                                            annualCtc: ctc,
                                            monthsPerYear: 12,
                                            ...assumptions
                                        });
                                        const loadedDailyCost = rateCardResult.dailyCost;
                                        const dailyRate = loadedDailyCost * (1 + (markupPercent / 100));
                                        setEditingResource({ ...editingResource, annualCTC: ctc, dailyCost: rateCardResult.dailyCost, dailyRate });
                                    }}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="text-xs text-slate-500">Daily Cost & Rate will be auto-calculated.</p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                            <button
                                onClick={() => setEditingResource(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setResources(resources.map(r => r.id === editingResource.id ? editingResource : r));
                                    setEditingResource(null);
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
