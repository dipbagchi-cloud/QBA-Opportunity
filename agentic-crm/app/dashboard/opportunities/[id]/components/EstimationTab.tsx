"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { useOpportunityEstimation } from "../context/OpportunityEstimationContext";

const EXCHANGE_RATES: Record<string, number> = {
    INR: 1,
    USD: 84.5,
    EUR: 91.2,
    GBP: 106.8
};

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
        otherCosts,
    } = useOpportunityEstimation();

    const convert = (valInInr: number) => {
        return valInInr / EXCHANGE_RATES[currency];
    };

    const format = (val: number, isCurrency = true) => {
        if (!isCurrency) return val.toFixed(2);
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 0
        }).format(val);
    };

    const workingDaysPerMonth = assumptions.workingDaysPerYear / 12 || 20;

    // 1. Grid 1: Billed Resources (FTE count per month)
    const resourceRows = useMemo(() => {
        return resources.map(resource => {
            const monthlyFtes: Record<string, number> = {};
            Object.entries(resource.monthlyEfforts).forEach(([monthName, days]) => {
                if (days > 0) {
                    const monthIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(monthName);
                    if (monthIndex !== -1) {
                        const monthStr = `${new Date().getFullYear()}-${String(monthIndex + 1).padStart(2, '0')}`;
                        monthlyFtes[monthStr] = days / workingDaysPerMonth;
                    }
                }
            });
            return {
                role: resource.role,
                fte: monthlyFtes
            };
        });
    }, [resources, workingDaysPerMonth]);

    // 2. Grid 2: Salary Cost (Direct Cost)
    const salaryRows = useMemo(() => {
        return resources.map(resource => {
            const monthlyCost: Record<string, number> = {};
            Object.entries(resource.monthlyEfforts).forEach(([monthName, days]) => {
                if (days > 0) {
                    const monthIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(monthName);
                    if (monthIndex !== -1) {
                        const monthStr = `${new Date().getFullYear()}-${String(monthIndex + 1).padStart(2, '0')}`;
                        monthlyCost[monthStr] = days * resource.dailyCost;
                    }
                }
            });
            return {
                role: resource.role,
                costs: monthlyCost
            };
        });
    }, [resources]);

    // 3. Grid 3: GOM Summary Structure
    const expenseRows = useMemo(() => {
        const rows: Record<string, Record<string, number>> = {
            "Salary": {},
            "Subcontracting": {},
            "Travel + Stay": {},
            "Misc. Expense": {},
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
                        const monthStr = `${new Date().getFullYear()}-${String(monthIndex + 1).padStart(2, '0')}`;
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
    }, [months, resources, otherCosts]);

    // Totals for GOM Table
    const revenueRow = useMemo(() => {
        const row: Record<string, number> = {};
        months.forEach(m => {
            row[m] = resources.reduce((sum, resource) => {
                let monthTotal = 0;
                Object.entries(resource.monthlyEfforts).forEach(([monthName, days]) => {
                    const monthIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(monthName);
                    if (monthIndex !== -1) {
                        const monthStr = `${new Date().getFullYear()}-${String(monthIndex + 1).padStart(2, '0')}`;
                        if (monthStr === m && days > 0) {
                            monthTotal += days * resource.dailyRate;
                        }
                    }
                });
                return sum + monthTotal;
            }, 0);
        });
        return row;
    }, [months, resources]);

    // Show message if no data
    if (resources.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <Info className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No Resources Assigned</h3>
                <p className="text-sm text-slate-500 text-center max-w-md">
                    Please go to the <strong>Resource Assignment</strong> tab to add resources and define monthly efforts before viewing the estimation summary.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Top Bar: Quote Price */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-lg p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h2 className="text-lg font-light text-slate-300">Total Quote Price (Revenue)</h2>
                    <div className="text-4xl font-bold mt-1 tracking-tight">
                        {format(convert(revenue))}
                    </div>
                    <p className="text-sm text-slate-400 mt-2 flex items-center gap-1">
                        <Info className="w-4 h-4" /> Based on {resources.length} resources across {months.length} months
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                    <span className="text-sm font-medium px-2">Display Currency:</span>
                    <select
                        className="bg-transparent border border-white/20 rounded px-3 py-1 text-sm focus:outline-none focus:bg-slate-800 transition-colors"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                    >
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                    </select>
                </div>
            </div>

            {/* Grid 1: Billed Resources (FTE) */}
            <div className="border rounded-lg bg-white shadow-sm overflow-hidden flex flex-col max-h-[500px]">
                <div className="bg-slate-50 p-3 border-b flex justify-between items-center sticky top-0 z-20">
                    <div>
                        <h3 className="font-semibold text-slate-800 text-sm">1. Input # of resources against each month (FTE)</h3>
                        <p className="text-[10px] text-slate-500">
                            FTE = Alloc / {workingDaysPerMonth.toFixed(1)} days.
                        </p>
                    </div>
                </div>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-medium sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-2 border-r border-b w-64 min-w-[200px] bg-slate-100 sticky left-0 z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">Resource Skill Set</th>
                                {months.map(m => <th key={m} className="p-2 text-center w-24 min-w-[80px] border-r border-b bg-slate-100">{DateFormat(m)}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {resourceRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                                    <td className="p-1 px-2 font-medium border-r truncate max-w-xs sticky left-0 bg-white z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]" title={row.role}>{row.role}</td>
                                    {months.map(m => (
                                        <td key={m} className="p-1 px-2 text-center border-r text-slate-600 font-mono text-[11px]">
                                            {row.fte[m] ? row.fte[m].toFixed(2) : '-'}
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
                    <h3 className="font-semibold text-slate-800 text-sm">2. Salary Cost for Billed hours ({currency})</h3>
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
                                        <td className="p-1 px-2 font-medium border-r truncate max-w-xs sticky left-0 bg-white z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">{row.role}</td>
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
                <div className="bg-slate-50 p-4 border-b bg-green-50/50">
                    <h3 className="font-semibold text-slate-800">3. GOM Analysis ({currency})</h3>
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

                            {/* Salary */}
                            <tr>
                                <td className="p-2 border-r pl-4">Salary (Resource Cost)</td>
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
                                { label: "Miscl. Expense", key: "Misc. Expense" },
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
                                { label: "Bonus", key: "bonus" },
                                { label: "Indirect Cost", key: "indirect" },
                                { label: "Team Building+Welfare", key: "welfare" },
                                { label: "Training", key: "training" },
                            ].map((item) => {
                                const rowData = months.reduce((acc, m) => {
                                    const mData = gomSummary.monthlyData[m];
                                    acc[m] = mData ? (mData as any)[item.key] || 0 : 0;
                                    return acc;
                                }, {} as Record<string, number>);

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
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                            {/* GOM Row */}
                            <tr>
                                <td className="p-2 border-r">GOM Value</td>
                                {months.map(m => {
                                    const rev = revenueRow[m] || 0;
                                    let totalCost = expenseRows["Salary"]?.[m] || 0;

                                    // Add manual items
                                    ["Subcontracting", "Travel + Stay", "Misc. Expense", "Special HW Cost", "Special SW Cost", "Other Indirect Cost"].forEach(key => {
                                        totalCost += expenseRows[key]?.[m] || 0;
                                    });

                                    // Add auto items if summary exists
                                    if (gomSummary) {
                                        const mData = gomSummary.monthlyData[m];
                                        if (mData) {
                                            totalCost += (mData.bonus || 0) + (mData.indirect || 0) + (mData.welfare || 0) + (mData.training || 0);
                                        }
                                    }

                                    const gom = rev - totalCost;
                                    const isNeg = gom < 0;
                                    return (
                                        <td key={m} className={`p-2 text-right border-r ${isNeg ? 'text-red-700' : 'text-green-700'}`}>
                                            {isNeg ? '(' : ''}{Math.round(convert(Math.abs(gom))).toLocaleString()}{isNeg ? ')' : ''}
                                        </td>
                                    );
                                })}
                                <td className="p-2 text-right text-green-800">
                                    {gomSummary ? Math.round(convert(gomSummary.gomFull)).toLocaleString() : '0'}
                                </td>
                            </tr>
                            {/* GOM % Row */}
                            <tr className="text-blue-700">
                                <td className="p-2 border-r">GOM %</td>
                                {months.map(m => {
                                    const rev = revenueRow[m] || 0;
                                    let totalCost = expenseRows["Salary"]?.[m] || 0;

                                    ["Subcontracting", "Travel + Stay", "Misc. Expense", "Special HW Cost", "Special SW Cost", "Other Indirect Cost"].forEach(key => {
                                        totalCost += expenseRows[key]?.[m] || 0;
                                    });

                                    if (gomSummary) {
                                        const mData = gomSummary.monthlyData[m];
                                        if (mData) {
                                            totalCost += (mData.bonus || 0) + (mData.indirect || 0) + (mData.welfare || 0) + (mData.training || 0);
                                        }
                                    }

                                    const gom = rev - totalCost;
                                    const pct = rev > 0 ? (gom / rev) * 100 : 0;
                                    return (
                                        <td key={m} className="p-2 text-right border-r">
                                            {pct.toFixed(1)}%
                                        </td>
                                    );
                                })}
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
