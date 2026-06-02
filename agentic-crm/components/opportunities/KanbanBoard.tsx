"use client";

import React, { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useOpportunityStore, Opportunity } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';
import { MoreHorizontal, User, AlertCircle, Clock, Calendar, CalendarCheck, CalendarClock, X } from 'lucide-react';
import Link from 'next/link';
import { useCurrency } from '@/components/providers/currency-provider';

const STAGES = [
    { id: 'Discovery', title: 'Discovery', color: 'bg-indigo-500' },
    { id: 'Qualification', title: 'Qualification', color: 'bg-purple-500' },
    { id: 'Proposal', title: 'Proposal', color: 'bg-pink-500' },
    { id: 'Proposal Lost', title: 'Proposal Lost', color: 'bg-rose-600' },
    { id: 'Negotiation', title: 'Negotiation', color: 'bg-orange-500' },
    { id: 'Closed Won', title: 'Closed Won', color: 'bg-emerald-500' },
    { id: 'Closed Lost', title: 'Closed Lost', color: 'bg-red-500' }
];

export default function KanbanBoard() {
    const { opportunities, updateOpportunity } = useOpportunityStore();
    const { user } = useAuthStore();
    const { currency: globalCurrency, getSymbol, getRate } = useCurrency();

    const isViewOnly = (opp: any) => {
        if (!user || !user.role || !user.role.name) return true;
        const role = user.role.name.toLowerCase();
        if (role === 'sales' || role === 'presales') {
            const isOwner = opp.ownerId === user.id || opp.owner?.id === user.id || opp.owner === user.name;
            const isAssigned = opp.salesRepName === user.name || opp.managerName === user.name;
            return !isOwner && !isAssigned;
        }
        return false;
    };

    // Group opportunities by stage
    const columns = useMemo(() => {
        const cols: Record<string, Opportunity[]> = {};
        STAGES.forEach(stage => {
            cols[stage.id] = opportunities.filter(opp => opp.stage === stage.id);
        });
        // Also catch any opportunities with invalid stages and put them in Discovery or a distinct pile? 
        // For now, let's assume valid stages.
        return cols;
    }, [opportunities]);

    const [dragError, setDragError] = useState<string | null>(null);

    // Valid forward transitions (stage order index)
    const STAGE_ORDER: Record<string, number> = {
        'Discovery': 0, 'Qualification': 1, 'Proposal': 2, 'Negotiation': 3, 'Closed Won': 4,
        'Proposal Lost': -1, 'Closed Lost': -1
    };

    const onDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const fromStage = source.droppableId;
        const toStage = destination.droppableId;
        const opp = opportunities.find(o => o.id === draggableId);
        if (!opp) return;

        // Allow reordering within same column
        if (fromStage === toStage) return;

        // Block backward moves (except to Lost stages)
        const fromIdx = STAGE_ORDER[fromStage] ?? 0;
        const toIdx = STAGE_ORDER[toStage] ?? 0;
        if (toStage !== 'Closed Lost' && toStage !== 'Proposal Lost' && toIdx < fromIdx) {
            setDragError(`Cannot move backward from ${fromStage} to ${toStage}. Use the detail page to send back for re-estimation.`);
            return;
        }

        // Block skipping stages (must go one step at a time)
        if (toStage !== 'Closed Lost' && toStage !== 'Proposal Lost' && toIdx > fromIdx + 1) {
            setDragError(`Cannot skip stages. Move one step at a time (${fromStage} must go to ${STAGES.find(s => STAGE_ORDER[s.id] === fromIdx + 1)?.title || 'next stage'}).`);
            return;
        }

        // Discovery -> Qualification: requires technology
        if (fromStage === 'Discovery' && toStage === 'Qualification') {
            if (!opp.technology || (typeof opp.technology === 'string' && opp.technology.trim() === '')) {
                setDragError(`Cannot move to Qualification: Technology must be filled. Please open the opportunity detail page to complete required fields and use "Move to Presales".`);
                return;
            }
            // Presales data (manager name, proposal due date) is needed
            setDragError(`Moving to Qualification requires presales data (Manager, Proposal Due Date). Please open the opportunity detail page and use "Move to Presales" button.`);
            return;
        }

        // Qualification -> Proposal: requires GOM approval
        if (fromStage === 'Qualification' && toStage === 'Proposal') {
            if (!opp.gomApproved) {
                setDragError(`Cannot move to Sales: GOM must be approved first. Please open the opportunity detail page, complete the estimation, and use "Move to Sales" button.`);
                return;
            }
            // GOM approved - allow the move
            updateOpportunity(draggableId, { stage: toStage });
            return;
        }

        // Proposal -> Negotiation: allowed (proposal sent)
        if (fromStage === 'Proposal' && toStage === 'Negotiation') {
            updateOpportunity(draggableId, { stage: toStage });
            return;
        }

        // Negotiation -> Closed Won: allowed
        if (fromStage === 'Negotiation' && toStage === 'Closed Won') {
            updateOpportunity(draggableId, { stage: toStage });
            return;
        }

        // Moving to Lost stages: allowed but requires remarks via detail page
        if (toStage === 'Closed Lost' || toStage === 'Proposal Lost') {
            setDragError(`To mark as lost, please open the opportunity detail page and use "Mark as Lost" button to provide required remarks.`);
            return;
        }

        // Default: block unrecognized transitions
        setDragError(`This transition (${fromStage} to ${toStage}) is not allowed from the Kanban board. Please use the opportunity detail page.`);
    };

    return (
        <div className="h-[calc(100vh-200px)] overflow-x-auto pb-2 relative">
            {/* Drag Error Alert */}
            {dragError && (
                <div className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center p-4" onClick={() => setDragError(null)}>
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-800 text-sm mb-1">Stage Transition Blocked</h3>
                                <p className="text-sm text-slate-600">{dragError}</p>
                            </div>
                            <button onClick={() => setDragError(null)} className="text-slate-400 hover:text-slate-600 p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button onClick={() => setDragError(null)} className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800">OK</button>
                        </div>
                    </div>
                </div>
            )}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-3 h-full min-w-max px-2">
                    {STAGES.map((stage) => (
                        <div key={stage.id} className="w-72 flex-shrink-0 flex flex-col bg-slate-100/50 rounded-lg border border-slate-200/60">
                            {/* Column Header */}
                            <div className="p-2.5 flex items-center justify-between border-b border-slate-200/60 bg-white/50 rounded-t-lg backdrop-blur-sm sticky top-0 z-10">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                                    <h3 className="font-semibold text-slate-700 text-sm">{stage.title}</h3>
                                    <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-xs font-medium">
                                        {columns[stage.id]?.length || 0}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 text-slate-400">
                                    <button className="hover:text-slate-600 p-1 rounded"><MoreHorizontal className="w-4 h-4" /></button>
                                </div>
                            </div>

                            {/* Droppable Area */}
                            <Droppable droppableId={stage.id}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`flex-1 p-1.5 space-y-1.5 overflow-y-auto min-h-[80px] transition-colors ${snapshot.isDraggingOver ? 'bg-indigo-50/50' : ''
                                            }`}
                                    >
                                        {columns[stage.id]?.map((opp, index) => (
                                            <Draggable key={opp.id} draggableId={opp.id} index={index} isDragDisabled={isViewOnly(opp)}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...dragHandleProps(provided.dragHandleProps)}
                                                        className={`bg-white p-2.5 rounded-md shadow-sm border group hover:shadow-md transition-all ${snapshot.isDragging ? 'shadow-lg rotate-2 ring-2 ring-indigo-500/20 z-50' : ''
                                                            } ${(opp.status === 'stalled' || opp.detailedStatus === 'On Hold') ? 'border-orange-300 bg-orange-50/30' : 'border-slate-200'}
                                                            `}
                                                        style={provided.draggableProps.style}
                                                        title={`${opp.name}\nClient: ${opp.client}\nOwner: ${opp.owner || 'N/A'}\nStage: ${stage.title}\nValue: ${(opp.value || 0).toLocaleString()}\nProbability: ${opp.probability}%\nDays in Stage: ${opp.daysInStage || 0}\nHealth: ${opp.healthScore ?? 'N/A'}/100\nStatus: ${opp.status}\nSales Rep: ${opp.salesRepName || 'N/A'}\nManager: ${opp.managerName || 'N/A'}\nCreated: ${opp.createdAt || 'N/A'}\nExpected Close: ${opp.expectedCloseDate || 'N/A'}\nStart Date: ${opp.tentativeStartDate || 'N/A'}\nEnd Date: ${opp.tentativeEndDate || 'N/A'}`}
                                                    >
                                                        {/* Header: Name + Icons */}
                                                        <div className="flex justify-between items-start mb-1.5 gap-2">
                                                            <Link href={`/dashboard/opportunities/${opp.id}`} className="text-sm font-semibold text-slate-800 line-clamp-2 leading-tight hover:text-indigo-600 hover:underline cursor-pointer">
                                                                {opp.name}
                                                            </Link>
                                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                                {opp.detailedStatus === 'On Hold' && (
                                                                    <div className="text-[10px] font-bold bg-amber-100 text-amber-600 px-1 rounded uppercase tracking-wider flex items-center gap-0.5" title="On Hold">
                                                                        <Clock className="w-3 h-3" />
                                                                        On Hold
                                                                    </div>
                                                                )}
                                                                {opp.detailedStatus !== 'On Hold' && opp.status === 'stalled' && (
                                                                    <div className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1 rounded uppercase tracking-wider flex items-center gap-0.5" title="Stalled">
                                                                        <Clock className="w-3 h-3" />
                                                                        Stalled
                                                                    </div>
                                                                )}
                                                                {(opp.status === 'at-risk' || opp.status === 'critical') && (
                                                                    <AlertCircle className={`w-4 h-4 ${opp.status === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Sub-header: Client */}
                                                        <div className="flex flex-col gap-1.5 mb-2">
                                                            <div className="flex items-center gap-1 text-xs text-slate-500">
                                                                <User className="w-3 h-3" />
                                                                <span className="truncate max-w-[120px]">{opp.client}</span>
                                                            </div>
                                                            {/* Sales Rep */}
                                                            {opp.salesRepName && (
                                                                <div className="flex items-center">
                                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${getAvatarColor(opp.salesRepName)}`}>
                                                                        <User className="w-2.5 h-2.5" />
                                                                        {opp.salesRepName}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Metrics Grid */}
                                                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                                                            <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                                                                <p className="text-[10px] text-slate-400 uppercase font-semibold">Value</p>
                                                                <p className="text-xs font-semibold text-slate-700">
                                                                    {(() => {
                                                                        const val = typeof opp.value === 'number' ? opp.value : Number(opp.value) || 0;
                                                                        const oppCurr = (opp as any).currency || 'USD';
                                                                        if (oppCurr === globalCurrency) {
                                                                            return `${getSymbol(globalCurrency)}${val.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })}`;
                                                                        }
                                                                        
                                                                        const rates = (opp as any).metadata?.exchangeRatesSnapshot;
                                                                        if (rates && rates[oppCurr] && rates[globalCurrency]) {
                                                                            const converted = (val * rates[globalCurrency]) / rates[oppCurr];
                                                                            return (
                                                                                <>
                                                                                    {getSymbol(globalCurrency)}{converted.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })}
                                                                                    <span className="text-[9px] text-slate-400 ml-1 font-normal">
                                                                                        ({getSymbol(oppCurr)}{val.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })})
                                                                                    </span>
                                                                                </>
                                                                            );
                                                                        }
                                                                        
                                                                        const convertedLive = (val * getRate(globalCurrency)) / getRate(oppCurr);
                                                                        return (
                                                                            <>
                                                                                {getSymbol(globalCurrency)}{convertedLive.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })}
                                                                                <span className="text-[9px] text-slate-400 ml-1 font-normal">
                                                                                    ({getSymbol(oppCurr)}{val.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 })})
                                                                                </span>
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </p>
                                                            </div>
                                                            <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                                                                <p className="text-[10px] text-slate-400 uppercase font-semibold">Days</p>
                                                                <p className="text-xs font-semibold text-slate-700">{opp.daysInStage || 0}</p>
                                                            </div>
                                                        </div>

                                                        {/* Health Meter */}
                                                        {opp.healthScore !== undefined && (
                                                            <div className="mb-2">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="text-[10px] text-slate-400 font-medium">Health Score</span>
                                                                    <span className={`text-[10px] font-bold ${getHealthColor(opp.healthScore)}`}>{opp.healthScore}/100</span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-500 ${getHealthBarColor(opp.healthScore)}`}
                                                                        style={{ width: `${opp.healthScore}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Footer: Probability */}
                                                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                                                            <div className="text-xs text-slate-400">Prob.</div>
                                                            <div className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getProbabilityColor(opp.probability)}`}>
                                                                {opp.probability}%
                                                            </div>
                                                        </div>

                                                        {/* Dates */}
                                                        {(opp.expectedCloseDate || opp.tentativeStartDate || opp.actualCloseDate) && (
                                                            <div className="mt-2 pt-2 border-t border-slate-50 space-y-1">
                                                                {opp.tentativeStartDate && (
                                                                    <div className="flex items-center gap-1 text-[10px] text-indigo-600">
                                                                        <CalendarClock className="w-3 h-3 flex-shrink-0" />
                                                                        <span className="text-slate-400">Start:</span>
                                                                        <span className="font-medium">{opp.tentativeStartDate}</span>
                                                                    </div>
                                                                )}
                                                                {opp.tentativeEndDate && !opp.actualCloseDate && (
                                                                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                                                        <CalendarClock className="w-3 h-3 flex-shrink-0" />
                                                                        <span className="text-slate-400">Est. End:</span>
                                                                        <span className="font-medium">{opp.tentativeEndDate}</span>
                                                                    </div>
                                                                )}
                                                                {opp.actualCloseDate ? (
                                                                    <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                                                                        <CalendarCheck className="w-3 h-3 flex-shrink-0" />
                                                                        <span className="text-slate-400">Closed:</span>
                                                                        <span className="font-medium">{opp.actualCloseDate}</span>
                                                                    </div>
                                                                ) : opp.expectedCloseDate ? (
                                                                    <div className="flex items-center gap-1 text-[10px] text-amber-600">
                                                                        <CalendarCheck className="w-3 h-3 flex-shrink-0" />
                                                                        <span className="text-slate-400">Exp. Close:</span>
                                                                        <span className="font-medium">{opp.expectedCloseDate}</span>
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>
        </div>
    );
}

// Helper to make drag handle props safer
function dragHandleProps(props: any) {
    return props || {};
}

function getProbabilityColor(prob: number) {
    if (prob >= 80) return 'bg-emerald-100 text-emerald-700';
    if (prob >= 50) return 'bg-indigo-100 text-indigo-700';
    if (prob >= 20) return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-700';
}

function getHealthColor(score: number) {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
}

function getHealthBarColor(score: number) {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
}

function getAvatarColor(name: string) {
    if (!name) return 'bg-slate-50 text-slate-600 border-slate-200';
    const colors = [
        'bg-blue-50 text-blue-600 border-blue-200',
        'bg-purple-50 text-purple-600 border-purple-200',
        'bg-pink-50 text-pink-600 border-pink-200',
        'bg-emerald-50 text-emerald-600 border-emerald-200',
        'bg-orange-50 text-orange-600 border-orange-200',
        'bg-teal-50 text-teal-600 border-teal-200',
        'bg-cyan-50 text-cyan-600 border-cyan-200',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}
