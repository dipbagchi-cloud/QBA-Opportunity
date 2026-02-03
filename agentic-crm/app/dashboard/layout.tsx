"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    Briefcase,
    BarChart3,
    Settings,
    Bell,
    Search,
    Menu,
    X,
    LogOut,
    Bot
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Briefcase, label: "Opportunities", href: "/dashboard/opportunities" },
    { icon: Users, label: "Contacts", href: "/dashboard/contacts" },
    { icon: BarChart3, label: "Analytics", href: "/dashboard/analytics" },
    { icon: Bot, label: "Agentic AI", href: "/dashboard/agents" },
    { icon: BarChart3, label: "GOM Calculator", href: "/dashboard/gom" },
    { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex">
            {/* Sidebar */}
            <AnimatePresence mode="wait">
                <motion.aside
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: isSidebarOpen ? 280 : 0, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className={`fixed md:relative z-40 h-screen glass border-r border-slate-200 ${!isSidebarOpen && "hidden md:block"}`}
                >
                    <div className="flex flex-col h-full overflow-hidden">
                        {/* Logo */}
                        <div className="p-6 border-b border-slate-200 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shadow-glow-primary">
                                <Bot className="w-5 h-5 text-indigo-600" />
                            </div>
                            <span className="text-xl font-bold tracking-tight text-slate-800 overflow-hidden whitespace-nowrap">
                                Agentic CRM
                            </span>
                        </div>

                        {/* Navigation */}
                        <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin">
                            {sidebarItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden whitespace-nowrap ${isActive
                                            ? "bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm"
                                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                            }`}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="active-nav"
                                                className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500 rounded-r-full"
                                            />
                                        )}
                                        <item.icon className={`w-5 h-5 ${isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                                        <span className="font-medium">{item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Use Profile / Logout */}
                        <div className="p-4 border-t border-slate-200">
                            <div className="glass-card p-3 rounded-xl flex items-center gap-3 mb-3 cursor-pointer hover:bg-slate-50 transition-colors border border-slate-100">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-secondary-500 to-purple-500 flex items-center justify-center text-sm font-bold">
                                    DB
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-sm font-medium text-slate-800 truncate">Dip Bagchi</p>
                                    <p className="text-xs text-slate-500 truncate">dip.bagchi@example.com</p>
                                </div>
                            </div>
                            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>
                        </div>
                    </div>
                </motion.aside>
            </AnimatePresence>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white/50 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        {isSidebarOpen ? <Menu className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>

                    <div className="flex items-center gap-4">
                        {/* Search */}
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search opportunities..."
                                className="w-64 bg-slate-100/50 border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder:text-slate-400"
                            />
                        </div>

                        {/* Notifications */}
                        <button className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        </button>
                    </div>
                </header>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    {children}
                </main>
            </div>
        </div>
    );
}
