import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Calendar, CalendarClock, CalendarCheck } from 'lucide-react';
import { useCurrency } from '@/components/providers/currency-provider';

interface ByOwnerBoardProps {
    opportunities: any[];
    globalCurrency: string;
}

export function ByOwnerBoard({ opportunities, globalCurrency }: ByOwnerBoardProps) {
    const { getSymbol, getRate } = useCurrency();
    const [expandedManagers, setExpandedManagers] = useState<Record<string, boolean>>({});

    const toggleManager = (manager: string) => {
        setExpandedManagers(prev => ({
            ...prev,
            [manager]: !prev[manager]
        }));
    };

    const groupedOpportunities = useMemo(() => {
        const groups: Record<string, any[]> = {};
        opportunities.forEach(opp => {
            const manager = opp.managerName || 'Unassigned';
            if (!groups[manager]) {
                groups[manager] = [];
            }
            groups[manager].push(opp);
        });
        return groups;
    }, [opportunities]);

    const managers = Object.keys(groupedOpportunities).sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;
        return a.localeCompare(b);
    });

    if (opportunities.length === 0) {
        return (
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center">
                <div className="py-8 text-center text-slate-400 text-sm">
                    No opportunities found for the current search/filter selection.
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 overflow-auto p-4 space-y-4">
                {managers.map(manager => {
                    const opps = groupedOpportunities[manager];
                    const isExpanded = expandedManagers[manager] !== false; // Default expanded
                    
                    const totalValue = opps.reduce((sum, opp) => {
                        const val = typeof opp.value === 'number' ? opp.value : Number(opp.value) || 0;
                        const oppCurr = opp.currency || 'USD';
                        if (oppCurr === globalCurrency) {
                            return sum + val;
                        }
                        const rates = opp.metadata?.exchangeRatesSnapshot;
                        if (rates && rates[oppCurr] && rates[globalCurrency]) {
                            return sum + (val * rates[globalCurrency]) / rates[oppCurr];
                        }
                        return sum + (val * getRate(globalCurrency)) / getRate(oppCurr);
                    }, 0);

                    return (
                        <div key={manager} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <button
                                onClick={() => toggleManager(manager)}
                                className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                                    <h3 className="font-bold text-slate-800 text-lg">{manager}</h3>
                                    <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                                        {opps.length} {opps.length === 1 ? 'Opportunity' : 'Opportunities'}
                                    </span>
                                </div>
                                <div className="text-sm font-semibold text-slate-700 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                                    Total Value: <span className="text-indigo-600">{getSymbol(globalCurrency)}{totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                </div>
                            </button>
                            
                            {isExpanded && (
                                <div className="bg-white border-t border-slate-200 p-0 overflow-x-auto">
                                    <table className="w-full min-w-[800px]">
                                        <thead className="bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                <th className="text-left py-3 px-5 font-semibold text-slate-600 text-xs">Opportunity Name</th>
                                                <th className="text-left py-3 px-5 font-semibold text-slate-600 text-xs">Stage</th>
                                                <th className="text-left py-3 px-5 font-semibold text-slate-600 text-xs">Estimated Value</th>
                                                <th className="text-left py-3 px-5 font-semibold text-slate-600 text-xs">Probability</th>
                                                <th className="text-left py-3 px-5 font-semibold text-slate-600 text-xs">Sales Rep</th>
                                                <th className="text-left py-3 px-5 font-semibold text-slate-600 text-xs">Timeline</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {opps.map(opp => (
                                                <tr key={opp.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="py-3 px-5">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className={`w-2 h-2 rounded-full ${opp.status === 'healthy' ? 'bg-emerald-500' :
                                                                    opp.status === 'at-risk' ? 'bg-amber-500' : 'bg-red-500'
                                                                    }`}
                                                                title={`Status: ${opp.status} (Health: ${opp.healthScore}/100)`}
                                                            />
                                                            <div>
                                                                <Link href={`/dashboard/opportunities/${opp.id}`} className="font-semibold text-sm text-slate-800 hover:text-indigo-600 hover:underline">
                                                                    {opp.name}
                                                                </Link>
                                                                <div className="text-xs text-slate-500 mt-0.5">{opp.client}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-5">
                                                        <div className="flex flex-col gap-1.5 items-start">
                                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                                                opp.stage === 'Negotiation' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                                opp.stage === 'Closed Won' || opp.stage === 'Commit' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                                opp.stage === 'Closed Lost' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                                                                                opp.stage === 'Proposal' ? 'bg-pink-50 text-pink-700 border-pink-200' :
                                                                'bg-slate-100 text-slate-700 border-slate-200'
                                                            }`}>
                                                                {opp.stage}
                                                            </span>
                                                            {(opp.status === 'stalled' || opp.detailedStatus === 'On Hold') ? (
                                                                <span className="text-[10px] text-amber-800 font-medium px-1.5 py-0.5 bg-amber-100 rounded-md border border-amber-300">
                                                                    On Hold
                                                                </span>
                                                            ) : opp.detailedStatus && !['Lost', 'Won', 'Open'].includes(opp.detailedStatus) ? (
                                                                <span className="text-[10px] text-slate-500 font-medium px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                                                                    {opp.detailedStatus}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-5">
                                                        <span className="font-semibold text-sm text-slate-700">
                                                            {(() => {
                                                                const val = typeof opp.value === 'number' ? opp.value : Number(opp.value) || 0;
                                                                const oppCurr = opp.currency || 'USD';
                                                                if (oppCurr === globalCurrency) {
                                                                    return `${getSymbol(globalCurrency)}${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
                                                                }
                                                                
                                                                const rates = opp.metadata?.exchangeRatesSnapshot;
                                                                if (rates && rates[oppCurr] && rates[globalCurrency]) {
                                                                    const converted = (val * rates[globalCurrency]) / rates[oppCurr];
                                                                    return (
                                                                        <div className="flex flex-col">
                                                                            <span>{getSymbol(globalCurrency)}{converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                                                            <span className="text-xs text-slate-400 font-normal">
                                                                                ({getSymbol(oppCurr)}{val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })})
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                }
                                                                
                                                                const convertedLive = (val * getRate(globalCurrency)) / getRate(oppCurr);
                                                                return (
                                                                    <div className="flex flex-col">
                                                                        <span>{getSymbol(globalCurrency)}{convertedLive.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                                                                        <span className="text-xs text-slate-400 font-normal">
                                                                            ({getSymbol(oppCurr)}{val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })})
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-indigo-500 rounded-full"
                                                                    style={{ width: `${opp.probability}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-700">{opp.probability}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-5 text-sm text-slate-600">
                                                        {opp.salesRepName || <span className="text-slate-400 italic">None assigned</span>}
                                                    </td>
                                                    <td className="py-3 px-5 text-xs">
                                                        <div className="flex flex-col gap-1.5">
                                                            {opp.tentativeStartDate && (
                                                                <span className="flex items-center gap-1.5 text-indigo-600">
                                                                    <CalendarClock className="w-3.5 h-3.5" /> Start: {opp.tentativeStartDate}
                                                                </span>
                                                            )}
                                                            {opp.actualCloseDate ? (
                                                                <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                                                                    <CalendarCheck className="w-3.5 h-3.5" /> Closed: {opp.actualCloseDate}
                                                                </span>
                                                            ) : opp.expectedCloseDate && (
                                                                <span className="flex items-center gap-1.5 text-amber-600">
                                                                    <CalendarCheck className="w-3.5 h-3.5" /> Close: {opp.expectedCloseDate}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
