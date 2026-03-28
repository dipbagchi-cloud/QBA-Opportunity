"use client";

import { useState, useEffect } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { Loader2, DollarSign, Activity, TrendingUp, Users, Target, Clock, FileText, CheckCircle, Trophy, XCircle, RefreshCw, Briefcase } from "lucide-react";

import { API_URL, getAuthHeaders } from '@/lib/api';

const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function AnalyticsPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("dashboard");

    useEffect(() => {
        fetch(`${API_URL}/api/analytics`, { headers: getAuthHeaders() })
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
        <div className="space-y-4 pb-8">
            <div>
                <h1 className="text-xl font-bold text-slate-900">Business Intelligence</h1>
                <p className="text-slate-500 text-sm">Comprehensive analysis of opportunities, revenue, and performance.</p>
            </div>

            {/* Custom Tabs */}
            <div className="bg-white border border-slate-200 p-1 rounded-lg inline-flex gap-1 mb-4">
                <TabButton id="dashboard" label="Dashboard" />
                <TabButton id="pipeline" label="Pipeline Metrics" />
                <TabButton id="presales" label="Resource & Pre-Sales" />
                <TabButton id="sales" label="Sales & Conversion" />
            </div>

            {/* 1. OPPORTUNITY DASHBOARD */}
            {activeTab === "dashboard" && (
                <div className="space-y-4 animate-in fade-in">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <MetricCard title="Projected Revenue" value={`$${((dashboard.projectedRevenue || 0) / 1e6).toFixed(1)}M`} icon={TrendingUp} color="text-indigo-600" bg="bg-indigo-50" />
                        <MetricCard title="Won Revenue" value={`$${((dashboard.closedRevenue || 0) / 1e6).toFixed(1)}M`} icon={DollarSign} color="text-emerald-600" bg="bg-emerald-50" />
                        <MetricCard title="Total Opportunities" value={pipeline?.totalOpps || 0} icon={Briefcase} color="text-blue-600" bg="bg-blue-50" />
                        <MetricCard title="Win Rate" value={`${(pipeline?.conversionRate || 0).toFixed(1)}%`} icon={Trophy} color="text-amber-600" bg="bg-amber-50" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Revenue Projection */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden lg:col-span-2">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-sm text-slate-800">Revenue Projection</h3>
                                <p className="text-xs text-slate-500">Proposed vs Won vs Lost Revenue over time</p>
                            </div>
                            <div className="p-4 h-[260px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashboard.revenueProjection || []}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" fontSize={11} />
                                        <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                                        <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                                        <Legend />
                                        <Bar dataKey="proposed" name="Proposed" stackId="a" fill="#6366f1" radius={[0, 0, 4, 4]} />
                                        <Bar dataKey="actual" name="Won" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="lost" name="Lost" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Stage Distribution Pie */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-sm text-slate-800">Stage Distribution</h3>
                                <p className="text-xs text-slate-500">Opportunities by stage</p>
                            </div>
                            <div className="p-4 h-[260px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={dashboard.countByStatus || []} innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value">
                                            {(dashboard.countByStatus || []).map((_: any, i: number) => (
                                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Revenue by Technology */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-sm text-slate-800">Revenue by Technology</h3>
                                <p className="text-xs text-slate-500">Top technology stacks by revenue</p>
                            </div>
                            <div className="p-4 h-[240px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={(dashboard.revenueByTech || []).slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                                        <XAxis type="number" fontSize={11} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                                        <YAxis dataKey="name" type="category" width={100} fontSize={11} />
                                        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                                        <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Revenue by Client */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-sm text-slate-800">Revenue by Client</h3>
                                <p className="text-xs text-slate-500">Top clients by revenue contribution</p>
                            </div>
                            <div className="p-4 h-[240px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={(dashboard.revenueByClient || []).slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                                        <XAxis type="number" fontSize={11} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                                        <YAxis dataKey="name" type="category" width={100} fontSize={11} />
                                        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                                        <Bar dataKey="value" fill="#ec4899" radius={[0, 4, 4, 0]} barSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Top Clients by Count */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-sm text-slate-800">Top Clients</h3>
                                <p className="text-xs text-slate-500">Active opportunities by client</p>
                            </div>
                            <div className="p-4 h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashboard.countByClient || []} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                                        <XAxis type="number" fontSize={11} />
                                        <YAxis dataKey="name" type="category" width={100} fontSize={11} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Revenue by Owner */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-sm text-slate-800">Revenue by Sales Owner</h3>
                                <p className="text-xs text-slate-500">Owner-wise revenue contribution</p>
                            </div>
                            <div className="p-4 h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashboard.revenueByOwner || []} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                                        <XAxis type="number" fontSize={11} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                                        <YAxis dataKey="name" type="category" width={80} fontSize={11} />
                                        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                                        <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} barSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. PIPELINE METRICS */}
            {activeTab === "pipeline" && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <MetricCard title="Active Projects" value={pipeline.activeProjects} icon={Activity} color="text-blue-600" bg="bg-blue-50" />
                        <MetricCard title="Pipeline Value" value={`$${((pipeline.pipelineValue || 0) / 1e6).toFixed(1)}M`} icon={DollarSign} color="text-emerald-600" bg="bg-emerald-50" />
                        <MetricCard title="Avg Deal Size" value={`$${((pipeline.avgDealValue || 0) / 1e6).toFixed(2)}M`} icon={Target} color="text-purple-600" bg="bg-purple-50" />
                        <MetricCard title="Win Rate" value={`${(pipeline.conversionRate || 0).toFixed(1)}%`} icon={TrendingUp} color="text-amber-600" bg="bg-amber-50" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Pipeline Summary */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <h3 className="font-bold text-sm text-slate-800 mb-3">Pipeline Summary</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                    <span className="text-sm text-slate-600">Total Opportunities</span>
                                    <span className="font-bold text-slate-900">{pipeline.totalOpps}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                    <span className="text-sm text-slate-600">Active Pipeline Value</span>
                                    <span className="font-bold text-emerald-600">${((pipeline.pipelineValue || 0) / 1e6).toFixed(2)}M</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                    <span className="text-sm text-slate-600">Weighted Pipeline Value</span>
                                    <span className="font-bold text-indigo-600">${((pipeline.weightedPipeline || 0) / 1e6).toFixed(2)}M</span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-sm text-slate-600">Avg Deal Size</span>
                                    <span className="font-bold text-purple-600">${((pipeline.avgDealValue || 0) / 1e6).toFixed(2)}M</span>
                                </div>
                            </div>
                        </div>

                        {/* Stage Distribution Bar */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-sm text-slate-800">Stage Distribution</h3>
                                <p className="text-xs text-slate-500">Number of opportunities per stage</p>
                            </div>
                            <div className="p-4 h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashboard.countByStatus || []}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" fontSize={10} angle={-20} textAnchor="end" height={50} />
                                        <YAxis fontSize={11} allowDecimals={false} />
                                        <Tooltip />
                                        <Bar dataKey="value" name="Count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Sales Rep Performance */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-sm text-slate-800">Sales Rep — Deal Count</h3>
                                <p className="text-xs text-slate-500">Total, active, and won opportunities per rep</p>
                            </div>
                            <div className="p-4 h-[240px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashboard.countBySalesRep || []} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                                        <XAxis type="number" fontSize={11} allowDecimals={false} />
                                        <YAxis dataKey="name" type="category" width={80} fontSize={11} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="total" name="Total" fill="#94a3b8" barSize={12} />
                                        <Bar dataKey="active" name="Active" fill="#6366f1" barSize={12} />
                                        <Bar dataKey="won" name="Won" fill="#10b981" barSize={12} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-sm text-slate-800">Sales Rep — Revenue</h3>
                                <p className="text-xs text-slate-500">Revenue generated per sales representative</p>
                            </div>
                            <div className="p-4 h-[240px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashboard.revenueBySalesRep || []} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                                        <XAxis type="number" fontSize={11} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                                        <YAxis dataKey="name" type="category" width={80} fontSize={11} />
                                        <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                                        <Bar dataKey="revenue" name="Revenue" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. PRE-SALES */}
            {activeTab === "presales" && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <MetricCard title="Proposal Success Rate" value={`${(presales.proposalSuccessRate || 0).toFixed(1)}%`} icon={CheckCircle} color="text-emerald-600" bg="bg-emerald-50" />
                        <MetricCard title="Avg Effort Cost / Opp" value={`$${Math.round(presales.effortPerOpp || 0).toLocaleString()}`} icon={Users} color="text-indigo-600" bg="bg-indigo-50" />
                        <MetricCard title="Total Presales Opps" value={presales.totalPresalesOpps || 0} icon={FileText} color="text-slate-600" bg="bg-slate-50" />
                        <MetricCard title="Avg Re-estimate Iterations" value={(presales.avgReEstimateIterations || 0).toFixed(1)} icon={RefreshCw} color="text-orange-600" bg="bg-orange-50" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Re-estimate Metrics */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <h3 className="font-bold text-sm text-slate-800 mb-3">Re-Estimate Analysis</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                    <span className="text-sm text-slate-600">Total Re-estimates</span>
                                    <span className="font-bold text-slate-900">{presales.totalReEstimateCount || 0}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                    <span className="text-sm text-slate-600">Opps with Re-estimates</span>
                                    <span className="font-bold text-slate-900">{presales.oppsWithReEstimates || 0}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                    <span className="text-sm text-slate-600">Avg Iterations per Opp</span>
                                    <span className="font-bold text-orange-600">{(presales.avgReEstimateIterations || 0).toFixed(1)}</span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-sm text-slate-600">Proposal Success Rate</span>
                                    <span className="font-bold text-emerald-600">{(presales.proposalSuccessRate || 0).toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Owner Performance */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-sm text-slate-800">Owner Performance</h3>
                                <p className="text-xs text-slate-500">Active and won opportunities per owner</p>
                            </div>
                            <div className="p-4 h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dashboard.countByOwner || []} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                                        <XAxis type="number" fontSize={11} allowDecimals={false} />
                                        <YAxis dataKey="name" type="category" width={80} fontSize={11} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="active" name="Active" fill="#6366f1" barSize={12} />
                                        <Bar dataKey="won" name="Won" fill="#10b981" barSize={12} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. SALES & CONVERSION */}
            {activeTab === "sales" && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <MetricCard title="Avg Time to Close" value={`${Math.round(sales.avgTimeToClose || 0)} Days`} icon={Clock} color="text-orange-600" bg="bg-orange-50" />
                        <MetricCard title="Won Opportunities" value={sales.wonCount || 0} icon={Trophy} color="text-yellow-600" bg="bg-yellow-50" />
                        <MetricCard title="Lost Opportunities" value={sales.lostCount || 0} icon={XCircle} color="text-red-600" bg="bg-red-50" />
                        <MetricCard title="Win Rate" value={`${(pipeline?.conversionRate || 0).toFixed(1)}%`} icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50" />
                    </div>

                    {/* Manager KPI Table */}
                    {(sales.managerKpi || []).length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-sm text-slate-800">Manager KPI</h3>
                                <p className="text-xs text-slate-500">Response metrics per presales manager</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 text-left">
                                            <th className="px-4 py-2.5 font-medium text-slate-600">Manager</th>
                                            <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Assigned</th>
                                            <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Responded</th>
                                            <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Response Rate</th>
                                            <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Avg Response Days</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(sales.managerKpi || []).map((mgr: any, i: number) => (
                                            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                                                <td className="px-4 py-2.5 font-medium text-slate-900">{mgr.name}</td>
                                                <td className="px-4 py-2.5 text-center text-slate-700">{mgr.totalAssigned}</td>
                                                <td className="px-4 py-2.5 text-center text-slate-700">{mgr.responded}</td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${mgr.totalAssigned > 0 && (mgr.responded / mgr.totalAssigned) >= 0.8 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                                        {mgr.totalAssigned > 0 ? ((mgr.responded / mgr.totalAssigned) * 100).toFixed(0) : 0}%
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-center text-slate-700">{mgr.avgResponseDays}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Won vs Lost Visual */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-sm text-slate-800">Won vs Lost</h3>
                                <p className="text-xs text-slate-500">Outcome distribution</p>
                            </div>
                            <div className="p-4 h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Won', value: sales.wonCount || 0 },
                                                { name: 'Lost', value: sales.lostCount || 0 },
                                                { name: 'Active', value: pipeline?.activeProjects || 0 },
                                            ]}
                                            innerRadius={55}
                                            outerRadius={85}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            <Cell fill="#10b981" />
                                            <Cell fill="#ef4444" />
                                            <Cell fill="#6366f1" />
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Manager KPI Bar */}
                        {(sales.managerKpi || []).length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-slate-100">
                                    <h3 className="font-bold text-sm text-slate-800">Manager Workload</h3>
                                    <p className="text-xs text-slate-500">Assigned vs responded per manager</p>
                                </div>
                                <div className="p-4 h-[220px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={sales.managerKpi || []} layout="vertical" margin={{ left: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                                            <XAxis type="number" fontSize={11} allowDecimals={false} />
                                            <YAxis dataKey="name" type="category" width={80} fontSize={11} />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="totalAssigned" name="Assigned" fill="#94a3b8" barSize={12} />
                                            <Bar dataKey="responded" name="Responded" fill="#10b981" barSize={12} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function MetricCard({ title, value, icon: Icon, color, bg }: any) {
    return (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
                <p className="text-xs font-medium text-slate-500">{title}</p>
                <h3 className="text-lg font-bold text-slate-900">{value}</h3>
            </div>
        </div>
    );
}
