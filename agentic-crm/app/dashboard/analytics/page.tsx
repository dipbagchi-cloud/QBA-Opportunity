"use client";

import { useState, useEffect } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { Loader2, DollarSign, Activity, TrendingUp, Users, Target, Clock, FileText, CheckCircle, Trophy, XCircle } from "lucide-react";

const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function AnalyticsPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("dashboard");

    useEffect(() => {
        fetch('/api/analytics')
            .then(res => res.json())
            .then(data => {
                setData(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, []);

    if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
    if (!data || data.error) return <div className="p-10">Failed to load analytics.</div>;

    const { dashboard, pipeline, presales, sales } = data || {};

    if (!dashboard) {
        return <div className="p-10">Data formatting error. Please check console.</div>;
    }

    // Helper Components to replace missing shadcn/ui
    const TabButton = ({ id, label }: { id: string, label: string }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === id
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50'
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-6 pb-20">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Business Intelligence</h1>
                <p className="text-slate-500">Comprehensive analysis of opportunities, revenue, and performance.</p>
            </div>

            {/* Custom Tabs */}
            <div className="bg-white border border-slate-200 p-1 rounded-xl inline-flex gap-1 mb-6">
                <TabButton id="dashboard" label="Dashboard" />
                <TabButton id="pipeline" label="Pipeline Metrics" />
                <TabButton id="presales" label="Resource & Pre-Sales" />
                <TabButton id="sales" label="Sales & Conversion" />
            </div>

            {/* 1. OPPORTUNITY DASHBOARD */}
            {activeTab === "dashboard" && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Revenue Projection */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden col-span-1 lg:col-span-2">
                            <div className="p-6 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800">Revenue Projection</h3>
                                <p className="text-sm text-slate-500">Proposed vs Actual Revenue over time</p>
                            </div>
                            <div className="p-6 h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashboard.revenueProjection || []}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" fontSize={12} />
                                        <YAxis fontSize={12} tickFormatter={(value) => `$${value / 1000}k`} />
                                        <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                                        <Legend />
                                        <Bar dataKey="proposed" name="Proposed Revenue" stackId="a" fill="#6366f1" radius={[0, 0, 4, 4]} />
                                        <Bar dataKey="actual" name="Actual Revenue" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Opportunity Count Pie */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800">Market Mix</h3>
                                <p className="text-sm text-slate-500">Opportunities by Status</p>
                            </div>
                            <div className="p-6 h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={dashboard.countByStatus || []}
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {(dashboard.countByStatus || []).map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Clients Bar */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden col-span-1 lg:col-span-3">
                            <div className="p-6 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800">Top Clients</h3>
                                <p className="text-sm text-slate-500">Active opportunities by client</p>
                            </div>
                            <div className="p-6 h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashboard.countByClient || []} layout="vertical" margin={{ left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" fontSize={12} />
                                        <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. PIPELINE METRICS */}
            {activeTab === "pipeline" && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard title="Active Projects" value={pipeline.activeProjects} icon={Activity} color="text-blue-600" bg="bg-blue-50" />
                        <MetricCard title="Total Pipeline Value" value={`$${(pipeline.pipelineValue / 1000).toFixed(1)}k`} icon={DollarSign} color="text-emerald-600" bg="bg-emerald-50" />
                        <MetricCard title="Avg Deal Size" value={`$${(pipeline.avgDealValue / 1000).toFixed(1)}k`} icon={Target} color="text-purple-600" bg="bg-purple-50" />
                        <MetricCard title="Win Rate" value={`${pipeline.conversionRate.toFixed(1)}%`} icon={TrendingUp} color="text-amber-600" bg="bg-amber-50" />
                    </div>
                    <div className="bg-slate-50 p-8 rounded-xl text-center text-slate-500 border border-slate-200 border-dashed">
                        Historical trend charts will appear here as more data is collected.
                    </div>
                </div>
            )}

            {/* 5. PRE-SALES */}
            {activeTab === "presales" && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <MetricCard title="Proposal Success Rate" value={`${presales.proposalSuccessRate.toFixed(1)}%`} icon={CheckCircle} color="text-emerald-600" bg="bg-emerald-50" />
                        <MetricCard title="Avg Effort Cost / Opp" value={`$${Math.round(presales.effortPerOpp).toLocaleString()}`} icon={Users} color="text-indigo-600" bg="bg-indigo-50" />
                        <MetricCard title="Total Presales Opps" value={presales.totalPresalesOpps} icon={FileText} color="text-slate-600" bg="bg-slate-50" />
                    </div>
                </div>
            )}

            {/* 6. SALES */}
            {activeTab === "sales" && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <MetricCard title="Avg Time to Close" value={`${Math.round(sales.avgTimeToClose)} Days`} icon={Clock} color="text-orange-600" bg="bg-orange-50" />
                        <MetricCard title="Won Opportunities" value={sales.wonCount} icon={Trophy} color="text-yellow-600" bg="bg-yellow-50" />
                        <MetricCard title="Lost Opportunities" value={sales.lostCount} icon={XCircle} color="text-red-600" bg="bg-red-50" />
                    </div>
                </div>
            )}
        </div>
    );
}

function MetricCard({ title, value, icon: Icon, color, bg }: any) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div>
                <p className="text-sm font-medium text-slate-500">{title}</p>
                <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
            </div>
        </div>
    );
}
