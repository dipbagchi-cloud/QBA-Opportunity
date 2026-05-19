"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { useOpportunityEstimation } from "../context/OpportunityEstimationContext";
import { useCurrency } from "@/components/providers/currency-provider";

const DateFormat = (dateStr: string) => {
    const d = new Date(dateStr + "-01");
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function EstimationTab() {
    const {
        assumptions,
        resources,
        gomSummary,
        months,
        currency,
        setCurrency,
        revenue,
        gomPercent,
        totalCost: contextTotalCost,
        salesCommissionAmount,
        preSalesCostAmount,
        otherCosts,
        readOnly,
        exchangeRatesSnapshot,
        selectedYear,
    } = useOpportunityEstimation();

    const { currencies, getRate, getSymbol, currency: globalCurrency } = useCurrency();

    const convert = (valInInr: number) => {
        const targetCurrency = exchangeRatesSnapshot ? currency : globalCurrency;
        if (targetCurrency === "INR") return valInInr;
        const rate = exchangeRatesSnapshot ? exchangeRatesSnapshot[targetCurrency] : getRate(targetCurrency);
        return rate > 0 ? valInInr * rate : valInInr;
    };

    const format = (val: number, isCurrency = true) => {
        if (!isCurrency) return val.toFixed(2);
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: exchangeRatesSnapshot ? currency : globalCurrency,
            maximumFractionDigits: 0
        }).format(val);
    };

    const workingDaysPerMonth = assumptions.workingDaysPerYear / 12 || 20;
    // Yellow "View only" banner removed per request; the gray page-level
    // notice on the View Estimate tab already conveys read-only state.
    const viewOnlyBanner = null;

    // 1. Grid 1: Billed Resources (Allocated Days)
    const resourceRows = useMemo(() => {
        return resources.map(resource => {
            const monthlyDays: Record<string, number> = {};
            Object.entries(resource.monthlyEfforts).forEach(([monthName, days]) => {
                if (days > 0) {
                    const monthIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(monthName);
                    if (monthIndex !== -1) {
                        const monthStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
                        monthlyDays[monthStr] = days;
                    }
                }
            });
            return {
                role: resource.role,
                skill: resource.skill,
                experienceBand: resource.experienceBand,
                allocatedDays: monthlyDays
            };
        });
    }, [resources, selectedYear]);

    // 2. Grid 2: Salary Cost (Direct Cost)
    const salaryRows = useMemo(() => {
        return resources.map(resource => {
            const monthlyCost: Record<string, number> = {};
            Object.entries(resource.monthlyEfforts).forEach(([monthName, days]) => {
                if (days > 0) {
                    const monthIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(monthName);
                    if (monthIndex !== -1) {
                        const monthStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
                        monthlyCost[monthStr] = days * resource.dailyCost;
                    }
                }
            });
            return {
                role: resource.role,
                skill: resource.skill,
                experienceBand: resource.experienceBand,
                costs: monthlyCost
            };
        });
    }, [resources, selectedYear]);

    // 3. Grid 3: GOM Summary Structure
    const expenseRows = useMemo(() => {
        const rows: Record<string, Record<string, number>> = {
            "Salary": {},
            "Subcontracting": {},
            "Travel + Stay": {},
            "Miscl. Expense": {},
            "Special HW Cost": {},
            "Special SW Cost": {},
            "Other Indirect Cost": {}
        };

        // Initialize all months
        months.forEach(m => {
            Object.keys(rows).forEach(key => {
                rows[key][m] = 0;
            });
        });

        // Fill salary data
        months.forEach(m => {
            resources.forEach(resource => {
                Object.entries(resource.monthlyEfforts).forEach(([monthName, days]) => {
                    const monthIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(monthName);
                    if (monthIndex !== -1) {
                        const monthStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
                        if (monthStr === m && days > 0) {
                            rows["Salary"][m] += days * resource.dailyCost;
                        }
                    }
                });
            });
        });

        // Fill other costs (travel, etc.)
        otherCosts.forEach(cost => {
            if (rows[cost.category] && cost.month) {
                rows[cost.category][cost.month] = (rows[cost.category][cost.month] || 0) + cost.amount;
            }
        });

        return rows;
    }, [months, resources, otherCosts, selectedYear]);

    // Totals for GOM Table
    const revenueRow = useMemo(() => {
        // First calculate raw billing per month (days × dailyRate)
        const rawRow: Record<string, number> = {};
        months.forEach(m => {
            rawRow[m] = resources.reduce((sum, resource) => {
                let monthTotal = 0;
                Object.entries(resource.monthlyEfforts).forEach(([monthName, days]) => {
                    const monthIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(monthName);
                    if (monthIndex !== -1) {
                        const monthStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
                        if (monthStr === m && days > 0) {
                            monthTotal += days * resource.dailyRate;
                        }
                    }
                });
                return sum + monthTotal;
            }, 0);
        });

        // Scale proportionally so monthly values sum to the actual revenue (which includes markup)
        const rawTotal = Object.values(rawRow).reduce((a, b) => a + b, 0);
        const row: Record<string, number> = {};
        if (rawTotal > 0 && revenue > 0) {
            const scale = revenue / rawTotal;
            months.forEach(m => { row[m] = rawRow[m] * scale; });
        } else {
            months.forEach(m => { row[m] = rawRow[m]; });
        }
        return row;
    }, [months, resources, revenue, selectedYear]);

    // Show message if no data
    if (resources.length === 0) {
        return (
            <div className="space-y-4">
                {viewOnlyBanner}
                <div className="flex flex-col items-center justify-center py-12 px-4">
                    <Info className="w-12 h-12 text-slate-300 mb-3" />
                    <h3 className="text-base font-semibold text-slate-700 mb-2">No Resources Assigned</h3>
                    <p className="text-sm text-slate-500 text-center max-w-md">
                        {readOnly
                            ? "Estimation summary will appear here once presales resources and monthly efforts are available."
                            : <>Please go to the <strong>Resource Assignment</strong> tab to add resources and define monthly efforts before viewing the estimation summary.</>}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {viewOnlyBanner}

            {/* Top Bar: Quote Price */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-lg p-4 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-sm font-light text-slate-300">Total Quote Price (Revenue)</h2>
                    <div className="text-2xl font-bold mt-1 tracking-tight">
                        {format(convert(revenue))}
                    </div>
                    <p className="text-sm text-slate-400 mt-2 flex items-center gap-1">
                        <Info className="w-4 h-4" /> Based on {resources.length} resources across {months.length} months
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                    <span className="text-sm font-medium px-2 text-white/80">Currency: <span className="font-bold text-white">{currency} ({getSymbol(currency)})</span></span>
                </div>
            </div>

            {/* Grid 1: Billed Resources (Allocated Days) */}
            <div className="border rounded-lg bg-white shadow-sm overflow-hidden flex flex-col max-h-[500px]">
                <div className="bg-slate-50 p-3 border-b flex justify-between items-center sticky top-0 z-20">
                    <div>
                        <h3 className="font-semibold text-slate-800 text-sm">1. Resource Allocation (Days)</h3>
                        <p className="text-[10px] text-slate-500">
                            Shows the exact number of working days allocated per month.
                        </p>
                    </div>
                </div>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-medium sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-2 border-r border-b w-64 min-w-[200px] bg-slate-100 sticky left-0 z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">Resource Skill Set</th>
                                {months.map(m => <th key={m} className="p-2 text-center w-24 min-w-[80px] border-r border-b bg-slate-100">{DateFormat(m)} (Days)</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {resourceRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                                    <td className="p-1 px-2 font-medium border-r max-w-[200px] sticky left-0 bg-white z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                                        <div className="truncate" title={row.role}>{row.role}</div>
                                        <div className="text-[10px] text-slate-500 font-normal truncate mt-0.5">
                                            {row.skill || '-'} | {row.experienceBand || '-'} Exp
                                        </div>
                                    </td>
                                    {months.map(m => (
                                        <td key={m} className="p-1 px-2 text-center border-r text-slate-600 font-mono text-[11px]">
                                            {row.allocatedDays[m] ? row.allocatedDays[m].toString() : '-'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Grid 2: Salary Cost */}
            <div className="border rounded-lg bg-white shadow-sm overflow-hidden flex flex-col max-h-[500px]">
                <div className="bg-slate-50 p-3 border-b bg-cyan-50/50 sticky top-0 z-20">
                    <h3 className="font-semibold text-slate-800 text-sm">2. Salary Cost for Billed hours ({exchangeRatesSnapshot ? currency : globalCurrency})</h3>
                </div>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-medium sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-2 border-r border-b w-64 min-w-[200px] bg-slate-100 sticky left-0 z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">Resource Skill Set</th>
                                {months.map(m => <th key={m} className="p-2 text-right w-24 min-w-[90px] border-r border-b font-mono bg-slate-100">{DateFormat(m)}</th>)}
                                <th className="p-2 text-right font-bold w-24 border-b bg-slate-100">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {salaryRows.map((row, idx) => {
                                const rowTotal = Object.values(row.costs).reduce((a, b) => a + b, 0);
                                if (rowTotal === 0) return null;
                                return (
                                    <tr key={idx} className="hover:bg-cyan-50/30 transition-colors">
                                        <td className="p-1 px-2 font-medium border-r max-w-[200px] sticky left-0 bg-white z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                                            <div className="truncate" title={row.role}>{row.role}</div>
                                            <div className="text-[10px] text-slate-500 font-normal truncate mt-0.5">
                                                {row.skill || '-'} | {row.experienceBand || '-'} Exp
                                            </div>
                                        </td>
                                        {months.map(m => (
                                            <td key={m} className="p-1 px-2 text-right border-r text-slate-600 font-mono text-[11px]">
                                                {row.costs[m] ? Math.round(convert(row.costs[m])).toLocaleString() : '-'}
                                            </td>
                                        ))}
                                        <td className="p-1 px-2 text-right font-bold text-slate-900 bg-slate-50 border-l text-[11px]">
                                            {Math.round(convert(rowTotal)).toLocaleString()}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Grid 3: GOM Summary */}
            <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-50 p-3 border-b bg-green-50/50">
                    <h3 className="font-semibold text-slate-800 text-sm">3. GOM Analysis ({exchangeRatesSnapshot ? currency : globalCurrency})</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 font-medium border-b">
                            <tr>
                                <th className="p-2 border-r w-64 min-w-[200px]">Item</th>
                                {months.map(m => <th key={m} className="p-2 text-right w-24 border-r">{m}</th>)}
                                <th className="p-2 text-right font-bold w-24">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {/* Revenue */}
                            <tr className="bg-slate-50 font-semibold text-slate-900 border-b-2 border-slate-300">
                                <td className="p-2 border-r">Revenue</td>
                                {months.map(m => (
                                    <td key={m} className="p-2 text-right border-r">
                                        {Math.round(convert(revenueRow[m] || 0)).toLocaleString()}
                                    </td>
                                ))}
                                <td className="p-2 text-right">
                                    {Math.round(convert(Object.values(revenueRow).reduce((a, b) => a + b, 0))).toLocaleString()}
                                </td>
                            </tr>

                            {/* Direct Costs Header */}
                            <tr className="bg-slate-50/50 italic text-slate-500">
                                <td colSpan={months.length + 2} className="p-1 px-2 border-b">Direct Costs</td>
                            </tr>

                            {/* Salary (loaded cost — includes org-level overhead) */}
                            <tr>
                                <td className="p-2 border-r pl-4">
                                    Salary (Resource Cost)
                                </td>
                                {months.map(m => {
                                    const val = expenseRows["Salary"][m] || 0;
                                    return <td key={m} className="p-2 text-right border-r text-slate-600">{val > 0 ? Math.round(convert(val)).toLocaleString() : '-'}</td>
                                })}
                                <td className="p-2 text-right font-medium">{Math.round(convert(Object.values(expenseRows["Salary"]).reduce((a, b) => a + b, 0))).toLocaleString()}</td>
                            </tr>

                            {/* Other Costs Header */}
                            <tr className="bg-slate-50/50 italic text-slate-500">
                                <td colSpan={months.length + 2} className="p-1 px-2 border-b">Other Direct Expenses</td>
                            </tr>

                            {[
                                { label: "Subcontracting", key: "Subcontracting" },
                                { label: "Travel + Stay Cost", key: "Travel + Stay" },
                                { label: "Miscl. Expense", key: "Miscl. Expense" },
                                { label: "Special HW Cost", key: "Special HW Cost" },
                                { label: "Special SW Cost", key: "Special SW Cost" },
                                { label: "Other Indirect Cost", key: "Other Indirect Cost" },
                            ].map((item) => {
                                const rowData = expenseRows[item.key] || {};
                                const total = Object.values(rowData).reduce((a, b) => a + b, 0);

                                return (
                                    <tr key={item.label} className="hover:bg-slate-50/30 transition-colors">
                                        <td className="p-1 px-2 border-r pl-4 text-slate-700">{item.label}</td>
                                        {months.map(m => (
                                            <td key={m} className="p-1 px-2 text-right border-r text-slate-600 font-mono text-[11px]">
                                                {rowData[m] !== 0 ? Math.round(convert(rowData[m])).toLocaleString() : '-'}
                                            </td>
                                        ))}
                                        <td className="p-1 px-2 text-right font-medium text-slate-800 text-[11px]">{Math.round(convert(total)).toLocaleString()}</td>
                                    </tr>
                                );
                            })}

                            {/* Auto-calculated costs from summary */}
                            {gomSummary && [
                                { label: "Resource Loading (DM, Bench, etc.)", key: "overhead", infoOnly: true },
                                { label: "Bonus", key: "bonus", infoOnly: false },
                                { label: "Indirect Cost", key: "indirect", infoOnly: false },
                                { label: "Team Building+Welfare", key: "welfare", infoOnly: false },
                                { label: "Training", key: "training", infoOnly: false },
                            ].map((item) => {
                                const rowData = months.reduce((acc, m) => {
                                    const mData = gomSummary.monthlyData[m];
                                    acc[m] = mData ? (mData as any)[item.key] || 0 : 0;
                                    return acc;
                                }, {} as Record<string, number>);

                                const total = Object.values(rowData).reduce((a, b) => a + b, 0);

                                return (
                                    <tr key={item.label} className={`hover:bg-slate-50/30 transition-colors ${item.infoOnly ? 'italic text-slate-400' : ''}`}>
                                        <td className="p-1 px-2 border-r pl-4 text-slate-700">
                                            {item.label}
                                            {item.infoOnly && <span className="text-[9px] ml-1">(incl. in salary)</span>}
                                        </td>
                                        {months.map(m => (
                                            <td key={m} className="p-1 px-2 text-right border-r text-slate-600 font-mono text-[11px]">
                                                {rowData[m] !== 0 ? Math.round(convert(rowData[m])).toLocaleString() : '-'}
                                            </td>
                                        ))}
                                        <td className="p-1 px-2 text-right font-medium text-slate-800 text-[11px]">{Math.round(convert(total)).toLocaleString()}</td>
                                    </tr>
                                );
                            })}

                            {/* Sales Commission & Pre-Sales Cost */}
                            {(salesCommissionAmount > 0 || preSalesCostAmount > 0) && (
                                <>
                                    <tr className="bg-slate-50/50 italic text-slate-500">
                                        <td colSpan={months.length + 2} className="p-1 px-2 border-b">Revenue-Based Costs</td>
                                    </tr>
                                    {salesCommissionAmount > 0 && (
                                        <tr className="hover:bg-slate-50/30 transition-colors">
                                            <td className="p-1 px-2 border-r pl-4 text-slate-700">Sales Commission</td>
                                            {months.map(m => <td key={m} className="p-1 px-2 text-right border-r text-slate-600 font-mono text-[11px]">-</td>)}
                                            <td className="p-1 px-2 text-right font-medium text-slate-800 text-[11px]">{Math.round(convert(salesCommissionAmount)).toLocaleString()}</td>
                                        </tr>
                                    )}
                                    {preSalesCostAmount > 0 && (
                                        <tr className="hover:bg-slate-50/30 transition-colors">
                                            <td className="p-1 px-2 border-r pl-4 text-slate-700">Pre-Sales Cost</td>
                                            {months.map(m => <td key={m} className="p-1 px-2 text-right border-r text-slate-600 font-mono text-[11px]">-</td>)}
                                            <td className="p-1 px-2 text-right font-medium text-slate-800 text-[11px]">{Math.round(convert(preSalesCostAmount)).toLocaleString()}</td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                            {/* GOM Row */}
                            <tr>
                                <td className="p-2 border-r">GOM Value</td>
                                {(() => {
                                    const totalRev = Object.values(revenueRow).reduce((a, b) => a + b, 0);
                                    return months.map(m => {
                                        const rev = revenueRow[m] || 0;
                                        // Salary already includes org-level overhead (loaded cost)
                                        let totalCost = expenseRows["Salary"]?.[m] || 0;

                                        // Add manual items
                                        ["Subcontracting", "Travel + Stay", "Miscl. Expense", "Special HW Cost", "Special SW Cost", "Other Indirect Cost"].forEach(key => {
                                            totalCost += expenseRows[key]?.[m] || 0;
                                        });

                                        // Add project-level auto items (NOT overhead — already in salary)
                                        if (gomSummary) {
                                            const mData = gomSummary.monthlyData[m];
                                            if (mData) {
                                                totalCost += (mData.bonus || 0) + (mData.indirect || 0) + (mData.welfare || 0) + (mData.training || 0);
                                            }
                                        }

                                        // Allocate sales commission and pre-sales cost proportionally
                                        const monthShare = totalRev > 0 ? rev / totalRev : 0;
                                        totalCost += salesCommissionAmount * monthShare;
                                        totalCost += preSalesCostAmount * monthShare;

                                        const gom = rev - totalCost;
                                        const isNeg = gom < 0;
                                        return (
                                            <td key={m} className={`p-2 text-right border-r ${isNeg ? 'text-red-700' : 'text-green-700'}`}>
                                                {isNeg ? '(' : ''}{Math.round(convert(Math.abs(gom))).toLocaleString()}{isNeg ? ')' : ''}
                                            </td>
                                        );
                                    });
                                })()}
                                <td className={`p-2 text-right ${(revenue - contextTotalCost) < 0 ? 'text-red-700' : 'text-green-800'}`}>
                                    {Math.round(convert(revenue - contextTotalCost)).toLocaleString()}
                                </td>
                            </tr>
                            {/* GOM % Row */}
                            <tr className="text-blue-700">
                                <td className="p-2 border-r">GOM %</td>
                                {(() => {
                                    const totalRev = Object.values(revenueRow).reduce((a, b) => a + b, 0);
                                    return months.map(m => {
                                        const rev = revenueRow[m] || 0;
                                        // Salary already includes org-level overhead (loaded cost)
                                        let totalCost = expenseRows["Salary"]?.[m] || 0;

                                        ["Subcontracting", "Travel + Stay", "Miscl. Expense", "Special HW Cost", "Special SW Cost", "Other Indirect Cost"].forEach(key => {
                                            totalCost += expenseRows[key]?.[m] || 0;
                                        });

                                        // Add project-level auto items (NOT overhead — already in salary)
                                        if (gomSummary) {
                                            const mData = gomSummary.monthlyData[m];
                                            if (mData) {
                                                totalCost += (mData.bonus || 0) + (mData.indirect || 0) + (mData.welfare || 0) + (mData.training || 0);
                                            }
                                        }

                                        // Allocate sales commission and pre-sales cost proportionally
                                        const monthShare = totalRev > 0 ? rev / totalRev : 0;
                                        totalCost += salesCommissionAmount * monthShare;
                                        totalCost += preSalesCostAmount * monthShare;

                                        const gom = rev - totalCost;
                                        const pct = rev > 0 ? (gom / rev) * 100 : 0;
                                        return (
                                            <td key={m} className="p-2 text-right border-r">
                                                {pct.toFixed(1)}%
                                            </td>
                                        );
                                    });
                                })()}
                                <td className="p-2 text-right">
                                    {gomPercent.toFixed(1)}%
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
