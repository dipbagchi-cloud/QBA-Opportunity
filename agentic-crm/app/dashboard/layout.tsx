"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { API_URL, getAuthHeaders } from "@/lib/api";
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
    RefreshCw,
    Check,
    CheckCheck,
    ExternalLink
} from "lucide-react";
import { motion } from "framer-motion";
import { AuthProvider } from "@/components/providers/auth-provider";
import { CurrencyProvider, useCurrency } from "@/components/providers/currency-provider";
import { useAuthStore } from "@/lib/auth-store";
import ChatBot from "@/components/chatbot/ChatBot";

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
    { icon: Settings, label: "Settings", href: "/dashboard/settings", permission: "settings:view" },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <CurrencyProvider>
                <DashboardContent>{children}</DashboardContent>
            </CurrencyProvider>
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
    const { currency: globalCurrency, setCurrency: setGlobalCurrency, currencies, symbol: currencySymbol } = useCurrency();

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
                                Q-CRM
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

                        {/* Global Currency Selector */}
                        <select
                            value={globalCurrency}
                            onChange={(e) => setGlobalCurrency(e.target.value)}
                            title="Global Currency"
                            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                        >
                            {currencies.map(c => (
                                <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                            ))}
                        </select>

                        {/* Notifications */}
                        <NotificationBell />
                    </div>
                </header>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                    {children}
                </main>
            </div>

            {/* AI Chatbot */}
            <ChatBot />
        </div>
    );
}

// ── Notification Bell with Dropdown ──

interface NotificationItem {
    id: string;
    type: string;
    title: string;
    message: string;
    link: string | null;
    isRead: boolean;
    createdAt: string;
}

function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Poll unread count every 30 seconds
    const fetchUnreadCount = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/notifications/unread-count`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setUnreadCount(data.count);
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    // Click outside to close
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/notifications?limit=20`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount);
            }
        } catch { /* silent */ }
        setLoading(false);
    };

    const handleToggle = () => {
        if (!open) fetchNotifications();
        setOpen(!open);
    };

    const handleMarkRead = async (id: string) => {
        await fetch(`${API_URL}/api/notifications/${id}/read`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const handleMarkAllRead = async () => {
        await fetch(`${API_URL}/api/notifications/read-all`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
    };

    const handleClickNotification = (n: NotificationItem) => {
        if (!n.isRead) handleMarkRead(n.id);
        if (n.link) {
            router.push(n.link);
            setOpen(false);
        }
    };

    const timeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    };

    return (
        <div className="relative" ref={panelRef}>
            <button
                onClick={handleToggle}
                className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                Mark all read
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-8 text-slate-400">
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-10 text-center text-slate-400 text-sm">
                                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                No notifications yet
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => handleClickNotification(n)}
                                    className={`flex gap-3 px-4 py-3 cursor-pointer border-b border-slate-50 transition-colors ${
                                        n.isRead
                                            ? 'bg-white hover:bg-slate-50'
                                            : 'bg-indigo-50/40 hover:bg-indigo-50/70'
                                    }`}
                                >
                                    {/* Unread dot */}
                                    <div className="pt-1.5 shrink-0">
                                        {!n.isRead ? (
                                            <span className="block w-2 h-2 bg-indigo-500 rounded-full" />
                                        ) : (
                                            <span className="block w-2 h-2 bg-transparent rounded-full" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm leading-snug ${n.isRead ? 'text-slate-600' : 'text-slate-800 font-medium'}`}>
                                            {n.title}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-slate-400">{timeAgo(n.createdAt)}</span>
                                            {n.link && <ExternalLink className="w-3 h-3 text-slate-300" />}
                                        </div>
                                    </div>
                                    {/* Mark read button */}
                                    {!n.isRead && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                                            className="shrink-0 p-1 text-slate-300 hover:text-indigo-500 transition-colors"
                                            title="Mark as read"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
