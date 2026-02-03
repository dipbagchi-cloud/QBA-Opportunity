"use client";

import { useState, useEffect } from "react";
import { Calculator, DollarSign, RefreshCw, Briefcase, ArrowRight, Percent, Info } from "lucide-react";

export default function GomCalculatorPage() {
    // Inputs
    const [annualCTC, setAnnualCTC] = useState<number>(1200000);
    const [deliveryMgmt, setDeliveryMgmt] = useState<number>(5);
    const [benchCost, setBenchCost] = useState<number>(10);
    const [exchangeRate, setExchangeRate] = useState<number>(1); // 1 for INR
    const [currency, setCurrency] = useState<string>("INR");
    const [onsiteAllowance, setOnsiteAllowance] = useState<number>(2802); // Default to gap value for demo

    // Constants from Prompt
    const perDiemUSD = 50;
    const perDiemRate = 85;

    // Margin / Revenue Inputs
    const [markupPercent, setMarkupPercent] = useState<number>(0);
    const [targetRevenue, setTargetRevenue] = useState<number>(0);
    const [calcMode, setCalcMode] = useState<'markup' | 'revenue'>('markup');

    // Outputs
    const [adjustedCost, setAdjustedCost] = useState<number>(0);
    const [offshoreDayRate, setOffshoreDayRate] = useState<number>(0);
    const [onsiteDayRate, setOnsiteDayRate] = useState<number>(0);
    const [durationMonths, setDurationMonths] = useState<number>(3);
    const [workingDays, setWorkingDays] = useState<number>(55); // Default from prompt Example

    // Calculations
    useEffect(() => {
        // Step 1: Adjusted Cost (Rs.)
        const loadingFactor = (deliveryMgmt + benchCost) / 100;
        const adjCost = annualCTC * (1 + loadingFactor);
        setAdjustedCost(adjCost);

        // Step 2: Convert to Quotation Currency
        const ctcInQuot = adjCost / exchangeRate;

        // Step 3: Offshore Cost Per Day
        // Formula: CTC in Quotation Currency / 220
        const offDay = Math.ceil(ctcInQuot / 220);
        setOffshoreDayRate(offDay);

        // Step 4: Onsite Cost Per Day
        const perDiemTotal = perDiemUSD * perDiemRate;
        // Base Formula: OffshoreCost + PerDiem + Allowance
        setOnsiteDayRate(offDay + perDiemTotal + onsiteAllowance);

    }, [annualCTC, deliveryMgmt, benchCost, exchangeRate, perDiemUSD, perDiemRate, onsiteAllowance]);


    // Margin Calc
    const calculateMargin = (cost: number) => {
        let rev = 0;
        let gom = 0;
        let profit = 0;

        if (calcMode === 'markup') {
            rev = cost * (1 + markupPercent / 100);
        } else {
            rev = targetRevenue;
        }

        if (rev > 0) {
            gom = ((rev - cost) / rev) * 100;
            // Actual Profit Margin = (Markup / (1 + Markup%)) * 100
            profit = (markupPercent / (1 + markupPercent / 100)) * 100;
        }

        return { revenue: rev, gom: gom, profit: profit };
    };

    const offshoreFinancials = calculateMargin(offshoreDayRate);
    const onsiteFinancials = calculateMargin(onsiteDayRate);


    return (
        <div className="space-y-8 animate-in fade-in duration-500 min-h-screen pb-20">
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                    GOM Calculator
                </h1>
                <p className="text-slate-500 mt-1">Resource effort estimation and cost calculation.</p>
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
                                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">{currency}</span>
                                    <input
                                        type="number"
                                        value={annualCTC}
                                        onChange={(e) => setAnnualCTC(Number(e.target.value))}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Delivery Mgmt (%)</label>
                                    <input
                                        type="number"
                                        value={deliveryMgmt}
                                        onChange={(e) => setDeliveryMgmt(Number(e.target.value))}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Addl. Bench (%)</label>
                                    <input
                                        type="number"
                                        value={benchCost}
                                        onChange={(e) => setBenchCost(Number(e.target.value))}
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Currency & Exchange Rate</label>
                                <div className="flex gap-2">
                                    <select
                                        value={currency}
                                        onChange={(e) => setCurrency(e.target.value)}
                                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                                    >
                                        <option value="INR">INR</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                    </select>
                                    <input
                                        type="number"
                                        value={exchangeRate}
                                        onChange={(e) => setExchangeRate(Number(e.target.value))}
                                        placeholder="Rate"
                                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Onsite Allowance / Loading</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">+</span>
                                    <input
                                        type="number"
                                        value={onsiteAllowance}
                                        onChange={(e) => setOnsiteAllowance(Number(e.target.value))}
                                        className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Adjust to match Base+PerDiem difference</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <RefreshCw className="w-5 h-5 text-emerald-600" />
                            Margin & Markup
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Markup Percentage (%)</label>
                                <div className="relative">
                                    <Percent className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <input
                                        type="number"
                                        value={markupPercent}
                                        onChange={(e) => {
                                            setMarkupPercent(Number(e.target.value));
                                            setCalcMode('markup');
                                        }}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Example: 900%</p>
                            </div>
                        </div>
                    </div>

                    {/* Period Estimation */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <ClockIcon className="w-5 h-5 text-amber-600" />
                            Period Estimation
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Duration (Months)</label>
                                <input
                                    type="number"
                                    value={durationMonths}
                                    onChange={(e) => setDurationMonths(Number(e.target.value))}
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Working Days</label>
                                <input
                                    type="number"
                                    value={workingDays}
                                    onChange={(e) => setWorkingDays(Number(e.target.value))}
                                    className={`w-full px-4 py-2 bg-slate-50 border rounded-lg text-sm ${workingDays / durationMonths > 22 ? 'border-amber-500 text-amber-700' : 'border-slate-200'}`}
                                />
                            </div>
                        </div>
                        {workingDays / durationMonths > 22 && (
                            <div className="flex items-center gap-2 text-amber-600 text-xs mt-2 bg-amber-50 p-2 rounded">
                                <Info className="w-3 h-3" />
                                <span>Warning: {Math.round(workingDays / durationMonths)} days/month exceeds typical 22 days.</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Results Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Cost Breakdown */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2">Calculation Results</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            <div className="space-y-4">
                                <h4 className="font-semibold text-indigo-600 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500" /> Offshore
                                </h4>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-xs text-slate-500 mb-1">Cost Per Day</p>
                                    <p className="text-2xl font-bold text-slate-800">{offshoreDayRate.toLocaleString()} <span className="text-xs font-normal text-slate-400">{currency}</span></p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-slate-50 rounded-lg">
                                        <p className="text-xs text-slate-500">Revenue/Day</p>
                                        <p className="font-semibold text-slate-700">{Math.round(offshoreFinancials.revenue).toLocaleString()}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg">
                                        <p className="text-xs text-slate-500">GOM %</p>
                                        <p className="font-semibold text-emerald-600">{offshoreFinancials.gom.toFixed(1)}%</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                                    <p className="text-xs text-amber-700 font-medium">Est. Cost ({workingDays} days)</p>
                                    <p className="text-lg font-bold text-amber-800">{(offshoreDayRate * workingDays).toLocaleString()} {currency}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-semibold text-purple-600 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-purple-500" /> Onsite
                                </h4>
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-xs text-slate-500 mb-1">Cost Per Day</p>
                                    <p className="text-2xl font-bold text-slate-800">{onsiteDayRate.toLocaleString()} <span className="text-xs font-normal text-slate-400">{currency}</span></p>
                                    <p className="text-[10px] text-slate-400 mt-1">Includes Per Diem + Allowance</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-slate-50 rounded-lg">
                                        <p className="text-xs text-slate-500">Revenue/Day</p>
                                        <p className="font-semibold text-slate-700">{Math.round(onsiteFinancials.revenue).toLocaleString()}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg">
                                        <p className="text-xs text-slate-500">GOM %</p>
                                        <p className="font-semibold text-emerald-600">{onsiteFinancials.gom.toFixed(1)}%</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                                    <p className="text-xs text-amber-700 font-medium">Est. Cost ({workingDays} days)</p>
                                    <p className="text-lg font-bold text-amber-800">{(onsiteDayRate * workingDays).toLocaleString()} {currency}</p>
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
                                        <td className="py-3 px-4 font-mono">{adjustedCost.toLocaleString()}</td>
                                        <td className="py-3 px-4 text-slate-400 text-xs">CTC * (1 + (Mgmt+Bench)/100)</td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 px-4 text-slate-800">Annual Working Days</td>
                                        <td className="py-3 px-4 font-mono">220</td>
                                        <td className="py-3 px-4 text-slate-400 text-xs">Fixed Standard</td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 px-4 text-slate-800">Actual Profit Margin</td>
                                        <td className="py-3 px-4 font-mono font-bold text-indigo-600">{offshoreFinancials.profit.toLocaleString()}%</td>
                                        <td className="py-3 px-4 text-slate-400 text-xs">(Markup / (1 + Markup%)) * 100</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ClockIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    )
}
