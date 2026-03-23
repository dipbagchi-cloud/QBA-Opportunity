"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
    Bot,
    Shield,
    RefreshCw
} from "lucide-react";
import { motion } from "framer-motion";
import { AuthProvider } from "@/components/providers/auth-provider";
import { useAuthStore } from "@/lib/auth-store";

interface NavItem {
    icon: any;
    label: string;
    href: string;
    permission?: string;
}

const allSidebarItems: NavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", permission: "dashboard:view" },
    { icon: Briefcase, label: "Opportunities", href: "/dashboard/opportunities", permission: "pipeline:view" },
    { icon: Users, label: "Contacts", href: "/dashboard/contacts", permission: "contacts:view" },
    { icon: BarChart3, label: "Analytics", href: "/dashboard/analytics", permission: "analytics:view" },
    { icon: Bot, label: "Agentic AI", href: "/dashboard/agents", permission: "agents:execute" },
    { icon: BarChart3, label: "GOM Calculator", href: "/dashboard/gom", permission: "gom:view" },
    { icon: Settings, label: "Settings", href: "/dashboard/settings", permission: "settings:view" },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <DashboardContent>{children}</DashboardContent>
        </AuthProvider>
    );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
    const [switchingRole, setSwitchingRole] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout, hasPermission, switchRole } = useAuthStore();

    const sidebarItems = allSidebarItems.filter((item) => {
        if (!item.permission) return true;
        return hasPermission(item.permission);
    });

    const userInitials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '??';

    const handleSignOut = () => {
        logout();
        router.push('/login');
    };

    const handleSwitchRole = async (roleId: string) => {
        setSwitchingRole(true);
        const success = await switchRole(roleId);
        setSwitchingRole(false);
        if (success) {
            setShowRoleSwitcher(false);
            router.push('/dashboard');
        }
    };

    const hasMultipleRoles = (user?.roles?.length || 0) > 1;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex">
            {/* Sidebar */}
            <motion.aside
                animate={{ width: isSidebarOpen ? 220 : 56 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="fixed md:relative z-40 h-screen glass border-r border-slate-200 shrink-0"
            >
                <div className="flex flex-col h-full overflow-hidden">
                    {/* Logo */}
                    <div className={`border-b border-slate-200 flex items-center gap-2 ${isSidebarOpen ? 'px-4 py-3' : 'p-3 justify-center'}`}>
                        <div className="w-7 h-7 rounded-md gradient-primary flex items-center justify-center shadow-glow-primary shrink-0">
                            <Bot className="w-4 h-4 text-indigo-600" />
                        </div>
                        {isSidebarOpen && (
                            <span className="text-base font-bold tracking-tight text-slate-800 overflow-hidden whitespace-nowrap">
                                Agentic CRM
                            </span>
                        )}
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-1.5 space-y-0.5 overflow-y-auto scrollbar-thin">
                        {sidebarItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    title={!isSidebarOpen ? item.label : undefined}
                                    className={`flex items-center gap-2.5 rounded-lg transition-all duration-150 group relative overflow-hidden whitespace-nowrap ${
                                        isSidebarOpen ? 'px-3 py-2' : 'px-0 py-2 justify-center'
                                    } ${isActive
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
                                    <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                                    {isSidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User Profile / Logout */}
                    <div className="p-2 border-t border-slate-200">
                        {isSidebarOpen ? (
                            <>
                                <div className="glass-card p-2 rounded-lg flex items-center gap-2 mb-2 cursor-pointer hover:bg-slate-50 transition-colors border border-slate-100">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-secondary-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                        {userInitials}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs font-medium text-slate-800 truncate">{user?.name || 'User'}</p>
                                        <p className="text-[11px] text-slate-500 truncate">{user?.email || ''}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 px-2 py-0.5 mb-1">
                                    <Shield className="w-3 h-3 text-indigo-500" />
                                    <span className="text-xs text-indigo-600 font-medium">{user?.role?.name || 'Unknown'}</span>
                                </div>

                                {/* Switch Role (only if user has multiple roles) */}
                                {hasMultipleRoles && (
                                    <div className="relative mb-2">
                                        <button
                                            onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
                                            disabled={switchingRole}
                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${switchingRole ? 'animate-spin' : ''}`} />
                                            Switch Role
                                        </button>
                                        {showRoleSwitcher && (
                                            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50">
                                                <p className="text-[10px] text-slate-400 uppercase font-semibold px-2 py-1 tracking-wider">Switch to</p>
                                                {user?.roles
                                                    ?.filter((r) => r.id !== user.role.id)
                                                    .map((r) => (
                                                        <button
                                                            key={r.id}
                                                            onClick={() => handleSwitchRole(r.id)}
                                                            disabled={switchingRole}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                                                        >
                                                            <Shield className="w-3 h-3" />
                                                            {r.name}
                                                        </button>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={handleSignOut}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-secondary-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white" title={user?.name || 'User'}>
                                    {userInitials}
                                </div>
                                {hasMultipleRoles && (
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
                                            disabled={switchingRole}
                                            title="Switch Role"
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${switchingRole ? 'animate-spin' : ''}`} />
                                        </button>
                                        {showRoleSwitcher && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 min-w-[150px]">
                                                <p className="text-[10px] text-slate-400 uppercase font-semibold px-2 py-1 tracking-wider">Switch to</p>
                                                {user?.roles
                                                    ?.filter((r) => r.id !== user.role.id)
                                                    .map((r) => (
                                                        <button
                                                            key={r.id}
                                                            onClick={() => handleSwitchRole(r.id)}
                                                            disabled={switchingRole}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                                                        >
                                                            <Shield className="w-3 h-3" />
                                                            {r.name}
                                                        </button>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <button
                                    onClick={handleSignOut}
                                    title="Sign Out"
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </motion.aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* Header */}
                <header className="h-12 bg-white/50 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-30">
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
                <main className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                    {children}
                </main>
            </div>
        </div>
    );
}
