"use client";

import { motion } from "framer-motion";
import {
    ArrowUpRight,
    ArrowDownRight,
    DollarSign,
    Users,
    Target,
    Activity,
    MoreHorizontal
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const stats = [
    {
        title: "Total Revenue",
        value: "$2,456,000",
        change: "+12.5%",
        trend: "up",
        icon: DollarSign,
        color: "primary"
    },
    {
        title: "Active Opportunities",
        value: "45",
        change: "+5",
        trend: "up",
        icon: Target,
        color: "secondary"
    },
    {
        title: "Win Rate",
        value: "68%",
        change: "-2.3%",
        trend: "down",
        icon: Activity,
        color: "success"
    },
    {
        title: "New Leads",
        value: "128",
        change: "+14.2%",
        trend: "up",
        icon: Users,
        color: "warning"
    }
];

const chartData = [
    { name: "Mon", value: 4000 },
    { name: "Tue", value: 3000 },
    { name: "Wed", value: 2000 },
    { name: "Thu", value: 2780 },
    { name: "Fri", value: 1890 },
    { name: "Sat", value: 2390 },
    { name: "Sun", value: 3490 },
];

export default function DashboardPage() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold mb-2 text-slate-900">Dashboard</h1>
                <p className="text-slate-500">Welcome back, here's what's happening today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl bg-${stat.color}-500/10`}>
                                <stat.icon className={`w-6 h-6 text-${stat.color}-400`} />
                            </div>
                            <div className={`flex items-center gap-1 text-sm ${stat.trend === "up" ? "text-emerald-600" : "text-rose-600"}`}>
                                {stat.trend === "up" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                {stat.change}
                            </div>
                        </div>
                        <h3 className="text-slate-500 text-sm mb-1">{stat.title}</h3>
                        <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-lg text-slate-800">Revenue Overview</h3>
                        <select className="bg-slate-50 border border-slate-200 text-sm text-slate-600 focus:ring-2 focus:ring-indigo-500/20 rounded-lg outline-none cursor-pointer">
                            <option>Last 7 Days</option>
                            <option>Last 30 Days</option>
                            <option>This Quarter</option>
                        </select>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#1e293b' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* AI Insights / Tasks */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-lg text-slate-800">AI Insights</h3>
                        <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">View All</button>
                    </div>
                    <div className="space-y-4">
                        {[
                            { text: "Deal 'Metropolis Corp' has been idle for 14 days.", type: "warning" },
                            { text: "High probability of closure for 'TechStart Inc' this week.", type: "success" },
                            { text: "Follow up required with John Doe regarding contract.", type: "neutral" }
                        ].map((insight, idx) => (
                            <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                                <div className="flex gap-3">
                                    <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${insight.type === "warning" ? "bg-amber-500" :
                                        insight.type === "success" ? "bg-green-500" : "bg-blue-500"
                                        }`} />
                                    <p className="text-sm text-slate-600 leading-relaxed">{insight.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Deals Table */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-semibold text-lg text-slate-800">Recent Opportunities</h3>
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"><MoreHorizontal className="w-5 h-5" /></button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 text-left text-sm text-slate-500">
                                <th className="pb-4 pl-4 font-medium">Opportunity Name</th>
                                <th className="pb-4 font-medium">Value</th>
                                <th className="pb-4 font-medium">Stage</th>
                                <th className="pb-4 font-medium">Probability</th>
                                <th className="pb-4 font-medium">Owner</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {[
                                { name: "Enterprise License - Acme Corp", value: "$45,000", stage: "Negotiation", prob: "80%", owner: "Sarah Wilson" },
                                { name: "Cloud Migration - Globex", value: "$120,000", stage: "Discovery", prob: "20%", owner: "Mike Ross" },
                                { name: "Q4 Consulting - Stark Ind", value: "$15,000", stage: "Proposal", prob: "60%", owner: "Jessica Pearson" },
                                { name: "AI Implementation - Cyberdyne", value: "$85,000", stage: "Qualifying", prob: "10%", owner: "John Connor" },
                            ].map((deal, idx) => (
                                <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                    <td className="py-4 pl-4 font-medium text-slate-900">{deal.name}</td>
                                    <td className="py-4 text-slate-600">{deal.value}</td>
                                    <td className="py-4">
                                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                            {deal.stage}
                                        </span>
                                    </td>
                                    <td className="py-4 text-slate-600">{deal.prob}</td>
                                    <td className="py-4 text-slate-600">{deal.owner}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
