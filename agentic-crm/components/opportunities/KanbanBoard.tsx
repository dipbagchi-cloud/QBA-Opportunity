"use client";

import React, { useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useOpportunityStore, Opportunity } from '@/lib/store';
import { MoreHorizontal, DollarSign, User, AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';

const STAGES = [
    { id: 'Discovery', title: 'Discovery', color: 'bg-indigo-500' },
    { id: 'Qualification', title: 'Qualification', color: 'bg-purple-500' },
    { id: 'Proposal', title: 'Proposal', color: 'bg-pink-500' },
    { id: 'Negotiation', title: 'Negotiation', color: 'bg-orange-500' },
    { id: 'Closed Won', title: 'Closed Won', color: 'bg-emerald-500' },
    { id: 'Closed Lost', title: 'Closed Lost', color: 'bg-red-500' }
];

export default function KanbanBoard() {
    const { opportunities, updateOpportunity } = useOpportunityStore();

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
        <div className="h-[calc(100vh-250px)] overflow-x-auto pb-4">
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex gap-4 h-full min-w-max px-4">
                    {STAGES.map((stage) => (
                        <div key={stage.id} className="w-80 flex-shrink-0 flex flex-col bg-slate-100/50 rounded-xl border border-slate-200/60">
                            {/* Column Header */}
                            <div className="p-3 flex items-center justify-between border-b border-slate-200/60 bg-white/50 rounded-t-xl backdrop-blur-sm sticky top-0 z-10">
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
                                        className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px] transition-colors ${snapshot.isDraggingOver ? 'bg-indigo-50/50' : ''
                                            }`}
                                    >
                                        {columns[stage.id]?.map((opp, index) => (
                                            <Draggable key={opp.id} draggableId={opp.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...dragHandleProps(provided.dragHandleProps)}
                                                        className={`bg-white p-3 rounded-lg shadow-sm border group hover:shadow-md transition-all ${snapshot.isDragging ? 'shadow-lg rotate-2 ring-2 ring-indigo-500/20 z-50' : ''
                                                            } ${opp.isStalled ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'}
                                                            `}
                                                        style={provided.draggableProps.style}
                                                    >
                                                        {/* Header: Name + Icons */}
                                                        <div className="flex justify-between items-start mb-2 gap-2">
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
                                                        <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                                                            <User className="w-3 h-3" />
                                                            <span className="truncate max-w-[120px]">{opp.client}</span>
                                                        </div>

                                                        {/* Metrics Grid */}
                                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                                            <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                                                                <p className="text-[10px] text-slate-400 uppercase font-semibold">Value</p>
                                                                <p className="text-xs font-semibold text-slate-700">${(opp.value / 1000).toFixed(0)}k</p>
                                                            </div>
                                                            <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                                                                <p className="text-[10px] text-slate-400 uppercase font-semibold">Days</p>
                                                                <p className="text-xs font-semibold text-slate-700">{opp.daysInStage || 0}</p>
                                                            </div>
                                                        </div>

                                                        {/* Health Meter */}
                                                        {opp.healthScore !== undefined && (
                                                            <div className="mb-3">
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
