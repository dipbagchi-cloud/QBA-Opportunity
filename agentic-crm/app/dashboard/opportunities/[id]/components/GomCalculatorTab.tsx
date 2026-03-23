"use client";

import { useState } from "react";
import { TrendingUp, AlertCircle, CheckCircle, XCircle, DollarSign } from "lucide-react";
import { useOpportunityEstimation } from "../context/OpportunityEstimationContext";

// Exchange rates (INR as base)
const EXCHANGE_RATES: Record<string, { rate: number; symbol: string; name: string }> = {
    INR: { rate: 1, symbol: "₹", name: "Indian Rupee" },
    USD: { rate: 0.012, symbol: "$", name: "US Dollar" },
    EUR: { rate: 0.011, symbol: "€", name: "Euro" },
    GBP: { rate: 0.0094, symbol: "£", name: "British Pound" },
    AED: { rate: 0.044, symbol: "د.إ", name: "UAE Dirham" },
    SGD: { rate: 0.016, symbol: "S$", name: "Singapore Dollar" },
};

export function GomCalculatorTab() {
    const {
        assumptions,
        setAssumptions,
        travelCosts,
        setTravelCosts,
        markupPercent,
        setMarkupPercent,
        totalResourceCost,
        totalTravelCost,
        totalCost,
        revenue,
        gomPercent,
        gomStatus,
        resources,
        readOnly,
    } = useOpportunityEstimation();

    // Currency converter state
    const [selectedCurrency, setSelectedCurrency] = useState<string>("INR");

    // Get status icon
    const getStatusIcon = () => {
        if (gomPercent >= 30) return <CheckCircle className="w-5 h-5" />;
        if (gomPercent >= 20) return <AlertCircle className="w-5 h-5" />;
        return <XCircle className="w-5 h-5" />;
    };

    // Convert amount to selected currency
    const convertCurrency = (amountInINR: number) => {
        const rate = EXCHANGE_RATES[selectedCurrency].rate;
        return amountInINR * rate;
    };

    // Format currency
    const formatCurrency = (amount: number) => {
        const symbol = EXCHANGE_RATES[selectedCurrency].symbol;
        return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium opacity-90">Total Revenue</span>
                        <TrendingUp className="w-4 h-4 opacity-75" />
                    </div>
                    <div className="text-xl font-bold">₹{revenue.toLocaleString()}</div>
                    <div className="text-[10px] opacity-75 mt-0.5">Quote Price</div>
                </div>

                <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-3 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium opacity-90">Total Cost</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-white/20 rounded">
                            {resources.length} Resources
                        </span>
                    </div>
                    <div className="text-xl font-bold">₹{totalCost.toLocaleString()}</div>
                    <div className="text-[10px] opacity-75 mt-0.5">Resource + Travel</div>
                </div>

                <div className={`bg-gradient-to-br rounded-lg p-3 text-white shadow-lg ${gomPercent >= 20 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'}`}>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium opacity-90">GOM %</span>
                        {getStatusIcon()}
                    </div>
                    <div className="text-xl font-bold">{gomPercent.toFixed(1)}%</div>
                    <div className="text-[10px] opacity-75 mt-0.5">{gomStatus.text}</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium opacity-90">Profit</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-white/20 rounded">
                            INR
                        </span>
                    </div>
                    <div className="text-xl font-bold">₹{(revenue - totalCost).toLocaleString()}</div>
                    <div className="text-[10px] opacity-75 mt-0.5">Net Margin</div>
                </div>
            </div>

            {/* Budget Assumptions (Read-Only from Admin Settings) */}
            <div>
                <h3 className="text-base font-bold text-slate-800 mb-3">Budget Assumptions <span className="text-xs font-normal text-slate-500">(Configured by Admin)</span></h3>
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span className="text-slate-500">Margin:</span> <span className="font-semibold">{assumptions.marginPercent}%</span></div>
                        <div><span className="text-slate-500">Working Days/Year:</span> <span className="font-semibold">{assumptions.workingDaysPerYear}</span></div>
                        <div><span className="text-slate-500">Delivery Mgmt:</span> <span className="font-semibold">{assumptions.deliveryMgmtPercent}%</span></div>
                        <div><span className="text-slate-500">Bench:</span> <span className="font-semibold">{assumptions.benchPercent}%</span></div>
                        <div><span className="text-slate-500">Leave Eligibility:</span> <span className="font-semibold">{assumptions.leaveEligibilityPercent}%</span></div>
                        <div><span className="text-slate-500">Growth Buffer:</span> <span className="font-semibold">{assumptions.annualGrowthBufferPercent}%</span></div>
                        <div><span className="text-slate-500">Increments:</span> <span className="font-semibold">{assumptions.averageIncrementPercent}%</span></div>
                        <div><span className="text-slate-500">Bonus:</span> <span className="font-semibold">{assumptions.bonusPercent}%</span></div>
                        <div><span className="text-slate-500">Indirect Cost:</span> <span className="font-semibold">{assumptions.indirectCostPercent}%</span></div>
                        <div><span className="text-slate-500">Welfare/FTE:</span> <span className="font-semibold">₹{assumptions.welfarePerFte.toLocaleString()}</span></div>
                        <div><span className="text-slate-500">Training/FTE:</span> <span className="font-semibold">₹{assumptions.trainingPerFte.toLocaleString()}</span></div>
                    </div>
                </div>
            </div>

            {/* GOM Configuration & Travel Costs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* GOM Configuration */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                    <h3 className="text-base font-bold text-slate-800 mb-4">GOM Configuration</h3>

                    <div className="space-y-3">
                        {/* Markup Input */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                Markup Percentage (%)
                            </label>
                            <input
                                type="number"
                                value={markupPercent}
                                onChange={(e) => setMarkupPercent(Number(e.target.value))}
                                disabled={readOnly}
                                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                                placeholder="Enter markup %"
                                min="0"
                                step="0.1"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Applied on total cost to calculate revenue
                            </p>
                        </div>

                        {/* Cost Breakdown */}
                        <div className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-200">
                            <h4 className="text-sm font-semibold text-slate-700 mb-3">Cost Breakdown</h4>

                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600">Resource Cost:</span>
                                <span className="font-semibold text-slate-900">₹{totalResourceCost.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600">Travel Cost:</span>
                                <span className="font-semibold text-slate-900">₹{totalTravelCost.toLocaleString()}</span>
                            </div>

                            <div className="border-t border-slate-300 pt-2 mt-2">
                                <div className="flex justify-between items-center text-sm font-bold">
                                    <span className="text-slate-700">Total Cost:</span>
                                    <span className="text-slate-900">₹{totalCost.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Revenue Calculation */}
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-medium text-blue-900">Calculated Revenue:</span>
                                <span className="text-base font-bold text-blue-700">₹{revenue.toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-blue-600">
                                Formula: Total Cost × (1 + {markupPercent}%)
                            </p>
                        </div>

                        {/* GOM Status */}
                        <div className={`rounded-lg p-3 border ${gomStatus.color}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-medium mb-1">GOM Status</div>
                                    <div className="text-lg font-bold">{gomStatus.text}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold">{gomPercent.toFixed(1)}%</div>
                                    <div className="text-xs mt-1">
                                        {gomPercent >= 30 ? '✓ Exceeds 30%' : gomPercent >= 20 ? '⚠ Above 20%' : '✗ Below 20%'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Travel & Hospitality Costs */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                    <h3 className="text-base font-bold text-slate-800 mb-4">Travel & Hospitality Costs</h3>

                    <div className="space-y-3">
                        {/* Travel Details */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Mode of Travel</label>
                                <select
                                    value={travelCosts.modeOfTravel}
                                    onChange={(e) => setTravelCosts({ ...travelCosts, modeOfTravel: e.target.value })}
                                    disabled={readOnly}
                                    className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                >
                                    <option value="">Select Mode</option>
                                    <option value="Flight">Flight</option>
                                    <option value="Train">Train</option>
                                    <option value="Car">Car</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Frequency</label>
                                <input
                                    type="text"
                                    value={travelCosts.frequency}
                                    onChange={(e) => setTravelCosts({ ...travelCosts, frequency: e.target.value })}
                                    disabled={readOnly}
                                    placeholder="e.g., Monthly"
                                    className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>

                        {/* Cost Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Round Trip Cost (₹)</label>
                                <input
                                    type="number"
                                    value={travelCosts.roundTripCost}
                                    onChange={(e) => setTravelCosts({ ...travelCosts, roundTripCost: Number(e.target.value) })}
                                    disabled={readOnly}
                                    placeholder="0"
                                    className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Medical Insurance (₹)</label>
                                <input
                                    type="number"
                                    value={travelCosts.medicalInsurance}
                                    onChange={(e) => setTravelCosts({ ...travelCosts, medicalInsurance: Number(e.target.value) })}
                                    disabled={readOnly}
                                    placeholder="0"
                                    className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Visa Cost (₹)</label>
                                <input
                                    type="number"
                                    value={travelCosts.visaCost}
                                    onChange={(e) => setTravelCosts({ ...travelCosts, visaCost: Number(e.target.value) })}
                                    disabled={readOnly}
                                    placeholder="0"
                                    className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Vaccine Cost (₹)</label>
                                <input
                                    type="number"
                                    value={travelCosts.vaccineCost}
                                    onChange={(e) => setTravelCosts({ ...travelCosts, vaccineCost: Number(e.target.value) })}
                                    disabled={readOnly}
                                    placeholder="0"
                                    className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Local Conveyance (₹)</label>
                                <input
                                    type="number"
                                    value={travelCosts.localConveyance}
                                    onChange={(e) => setTravelCosts({ ...travelCosts, localConveyance: Number(e.target.value) })}
                                    disabled={readOnly}
                                    placeholder="0"
                                    className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Marketing/Communication (₹)</label>
                                <input
                                    type="number"
                                    value={travelCosts.marketingCom}
                                    onChange={(e) => setTravelCosts({ ...travelCosts, marketingCom: Number(e.target.value) })}
                                    disabled={readOnly}
                                    placeholder="0"
                                    className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Hotel Cost (₹)</label>
                            <input
                                type="number"
                                value={travelCosts.hotelCost}
                                onChange={(e) => setTravelCosts({ ...travelCosts, hotelCost: Number(e.target.value) })}
                                disabled={readOnly}
                                placeholder="0"
                                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            />
                        </div>

                        {/* Total Travel Cost Summary */}
                        <div className="bg-blue-50 p-3 rounded-md border border-blue-200 mt-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-blue-900">Total Travel Cost:</span>
                                <span className="text-base font-bold text-blue-700">
                                    ₹{totalTravelCost.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Reference Guide */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200">
                <h4 className="text-xs font-semibold text-slate-700 mb-3">GOM Calculation Reference</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="bg-white p-3 rounded border border-slate-200">
                        <div className="font-semibold text-slate-700 mb-1">Total Cost</div>
                        <div className="text-slate-600">Resource Cost + Travel Cost + Auto Overheads (Bonus, Indirect, Welfare, Training)</div>
                    </div>
                    <div className="bg-white p-3 rounded border border-slate-200">
                        <div className="font-semibold text-slate-700 mb-1">Revenue</div>
                        <div className="text-slate-600">Total Cost × (1 + Markup %)</div>
                    </div>
                    <div className="bg-white p-3 rounded border border-slate-200">
                        <div className="font-semibold text-slate-700 mb-1">GOM %</div>
                        <div className="text-slate-600">(Revenue - Total Cost) / Revenue × 100</div>
                    </div>
                </div>
            </div>

            {/* Currency Converter */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border-2 border-indigo-200 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-600 p-1.5 rounded-lg">
                            <DollarSign className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Currency Converter</h3>
                            <p className="text-xs text-slate-600">View GOM metrics in different currencies</p>
                        </div>
                    </div>

                    <select
                        value={selectedCurrency}
                        onChange={(e) => setSelectedCurrency(e.target.value)}
                        className="px-3 py-1.5 bg-white border-2 border-indigo-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                    >
                        {Object.entries(EXCHANGE_RATES).map(([code, { name, symbol }]) => (
                            <option key={code} value={code}>
                                {symbol} {code} - {name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Converted Values Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Total Revenue */}
                    <div className="bg-white rounded-lg p-3 border border-indigo-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-medium text-slate-500 uppercase mb-1">Total Revenue</div>
                        <div className="text-lg font-bold text-blue-600 mb-1">
                            {formatCurrency(convertCurrency(revenue))}
                        </div>
                        <div className="text-xs text-slate-500">
                            ₹{revenue.toLocaleString()} INR
                        </div>
                    </div>

                    {/* Total Cost */}
                    <div className="bg-white rounded-lg p-3 border border-indigo-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-medium text-slate-500 uppercase mb-1">Total Cost</div>
                        <div className="text-lg font-bold text-slate-700 mb-1">
                            {formatCurrency(convertCurrency(totalCost))}
                        </div>
                        <div className="text-xs text-slate-500">
                            ₹{totalCost.toLocaleString()} INR
                        </div>
                    </div>

                    {/* Profit */}
                    <div className="bg-white rounded-lg p-3 border border-indigo-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xs font-medium text-slate-500 uppercase mb-1">Profit</div>
                        <div className="text-lg font-bold text-purple-600 mb-1">
                            {formatCurrency(convertCurrency(revenue - totalCost))}
                        </div>
                        <div className="text-xs text-slate-500">
                            ₹{(revenue - totalCost).toLocaleString()} INR
                        </div>
                    </div>

                    {/* GOM % (No conversion needed) */}
                    <div className={`bg-white rounded-lg p-3 border-2 shadow-sm hover:shadow-md transition-shadow ${gomPercent >= 20 ? 'border-green-300' : 'border-red-300'}`}>
                        <div className="text-xs font-medium text-slate-500 uppercase mb-1">GOM %</div>
                        <div className={`text-lg font-bold mb-1 ${gomPercent >= 20 ? 'text-green-600' : 'text-red-600'}`}>
                            {gomPercent.toFixed(1)}%
                        </div>
                        <div className="text-xs font-semibold" style={{ color: gomPercent >= 30 ? '#16a34a' : gomPercent >= 20 ? '#d97706' : '#dc2626' }}>
                            {gomStatus.text}
                        </div>
                    </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="mt-4 bg-white rounded-lg p-3 border border-indigo-200">
                    <h4 className="text-xs font-semibold text-slate-700 mb-2">Detailed Cost Breakdown</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-600">Resource Cost:</span>
                            <div className="text-right">
                                <div className="font-semibold text-slate-900">{formatCurrency(convertCurrency(totalResourceCost))}</div>
                                <div className="text-xs text-slate-500">₹{totalResourceCost.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-600">Travel Cost:</span>
                            <div className="text-right">
                                <div className="font-semibold text-slate-900">{formatCurrency(convertCurrency(totalTravelCost))}</div>
                                <div className="text-xs text-slate-500">₹{totalTravelCost.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Exchange Rate Info */}
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-600">
                    <span className="font-medium">Exchange Rate:</span>
                    <span className="px-2 py-1 bg-white rounded border border-indigo-200">
                        1 INR = {EXCHANGE_RATES[selectedCurrency].rate.toFixed(4)} {selectedCurrency}
                    </span>
                    <span className="text-slate-400">• Live conversion</span>
                </div>
            </div>
        </div>
    );
}
