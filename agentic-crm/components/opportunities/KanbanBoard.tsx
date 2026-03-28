"use client";

import React, { useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useOpportunityStore, Opportunity } from '@/lib/store';
import { MoreHorizontal, DollarSign, User, AlertCircle, Clock, Calendar, CalendarCheck, CalendarClock } from 'lucide-react';
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
    const { format: fmtCurrency } = useCurrency();

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

    const onDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) {
            return;
        }

        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return;
        }

        const newStage = destination.droppableId;

        // Update the opportunity's stage
        updateOpportunity(draggableId, { stage: newStage });
    };

    return (
        <div className="h-[calc(100vh-200px)] overflow-x-auto pb-2">
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
                                            <Draggable key={opp.id} draggableId={opp.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...dragHandleProps(provided.dragHandleProps)}
                                                        className={`bg-white p-2.5 rounded-md shadow-sm border group hover:shadow-md transition-all ${snapshot.isDragging ? 'shadow-lg rotate-2 ring-2 ring-indigo-500/20 z-50' : ''
                                                            } ${opp.isStalled ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'}
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
                                                                {opp.isStalled && (
                                                                    <div className="text-[10px] font-bold bg-amber-100 text-amber-600 px-1 rounded uppercase tracking-wider flex items-center gap-0.5" title="Stalled: No movement for >30 days">
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
                                                        <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                                                            <User className="w-3 h-3" />
                                                            <span className="truncate max-w-[120px]">{opp.client}</span>
                                                        </div>

                                                        {/* Metrics Grid */}
                                                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                                                            <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                                                                <p className="text-[10px] text-slate-400 uppercase font-semibold">Value</p>
                                                                <p className="text-xs font-semibold text-slate-700">{fmtCurrency(opp.value, { compact: true })}</p>
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
