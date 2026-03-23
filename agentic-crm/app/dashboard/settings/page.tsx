"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { User, Lock, Users, Shield, Plus, X, Check, AlertCircle, RotateCcw, Pencil, ToggleLeft, ToggleRight, DollarSign, Trash2, Globe, Cpu, Tag, Building2, Download, Settings2, ChevronDown, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, Search, Eye, EyeOff, FileText } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { apiClient } from "@/lib/api";

// ── Permission categories for the checkbox grid ──
const PERMISSION_CATEGORIES = [
    {
        label: "Dashboard",
        permissions: [
            { key: "dashboard:view", label: "View" },
        ],
    },
    {
        label: "Pipeline / Opportunities",
        permissions: [
            { key: "pipeline:view", label: "View" },
            { key: "pipeline:write", label: "Create / Edit" },
        ],
    },
    {
        label: "Presales",
        permissions: [
            { key: "presales:view", label: "View" },
            { key: "presales:write", label: "Edit" },
        ],
    },
    {
        label: "Estimation",
        permissions: [{ key: "estimation:manage", label: "Manage" }],
    },
    {
        label: "Sales",
        permissions: [
            { key: "sales:view", label: "View" },
            { key: "sales:write", label: "Edit" },
        ],
    },
    {
        label: "Approvals",
        permissions: [{ key: "approvals:manage", label: "Manage" }],
    },
    {
        label: "Contacts",
        permissions: [
            { key: "contacts:view", label: "View" },
            { key: "contacts:write", label: "Create / Edit" },
        ],
    },
    {
        label: "Analytics",
        permissions: [
            { key: "analytics:view", label: "View" },
            { key: "analytics:export", label: "Export" },
        ],
    },
    {
        label: "Agents / AI",
        permissions: [{ key: "agents:execute", label: "Execute" }],
    },
    {
        label: "GOM Calculator",
        permissions: [{ key: "gom:view", label: "View" }],
    },
    {
        label: "Leads",
        permissions: [{ key: "leads:manage", label: "Manage" }],
    },
    {
        label: "Resources",
        permissions: [{ key: "resources:manage", label: "Manage" }],
    },
    {
        label: "Settings",
        permissions: [
            { key: "settings:view", label: "View" },
            { key: "settings:manage", label: "Manage" },
        ],
    },
    {
        label: "Administration",
        permissions: [
            { key: "users:manage", label: "Users" },
            { key: "roles:manage", label: "Roles" },
            { key: "metadata:manage", label: "Metadata" },
            { key: "costcard:manage", label: "Cost Cards" },
            { key: "auditlogs:view", label: "Audit Logs" },
        ],
    },
];

interface AdminUser {
    id: string;
    email: string;
    name: string;
    title?: string;
    department?: string;
    designation?: string;
    qpeopleId?: string;
    isActive: boolean;
    roles: { id: string; name: string }[];
    team?: { id: string; name: string } | null;
    createdAt: string;
}

interface AdminRole {
    id: string;
    name: string;
    description?: string;
    permissions: string[];
    isSystem: boolean;
    userCount: number;
}

interface TeamOption {
    id: string;
    name: string;
}

type Tab = "profile" | "security" | "users" | "roles" | "ratecards" | "budgetassumptions" | "clients" | "regions" | "technologies" | "pricingmodels" | "auditlog";

export default function SettingsPage() {
    const { user, hasPermission } = useAuthStore();
    const isAdmin = hasPermission("users:manage");
    const canManageRoles = hasPermission("roles:manage");
    const canManageCostCards = hasPermission("costcard:manage");
    const canManageMetadata = hasPermission("metadata:manage");
    const canViewAuditLogs = hasPermission("auditlogs:view");

    const sidebarSections: { label: string; adminOnly?: boolean; tabs: { key: Tab; label: string; icon: any; adminOnly?: boolean }[] }[] = [
        {
            label: "Personal",
            tabs: [
                { key: "profile", label: "Profile", icon: User },
                { key: "security", label: "Security", icon: Lock },
            ],
        },
        {
            label: "Administration",
            adminOnly: true,
            tabs: [
                { key: "users", label: "Users", icon: Users, adminOnly: true },
                { key: "roles", label: "Roles", icon: Shield, adminOnly: true },
            ],
        },
        {
            label: "Cost Management",
            adminOnly: true,
            tabs: [
                { key: "ratecards", label: "Rate Cards", icon: DollarSign, adminOnly: true },
                { key: "budgetassumptions", label: "Budget Assumptions", icon: Settings2, adminOnly: true },
            ],
        },
        {
            label: "Master Data",
            adminOnly: true,
            tabs: [
                { key: "clients", label: "Clients", icon: Building2, adminOnly: true },
                { key: "regions", label: "Regions", icon: Globe, adminOnly: true },
                { key: "technologies", label: "Technologies", icon: Cpu, adminOnly: true },
                { key: "pricingmodels", label: "Pricing Models", icon: Tag, adminOnly: true },
            ],
        },
        {
            label: "Compliance",
            adminOnly: true,
            tabs: [
                { key: "auditlog", label: "Audit Log", icon: FileText, adminOnly: true },
            ],
        },
    ];

    const [activeTab, setActiveTab] = useState<Tab>("profile");
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    const [sidebarExpanded, setSidebarExpanded] = useState(true);

    const toggleSection = (label: string) => {
        setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }));
    };

    return (
        <div className="max-w-6xl space-y-4 animate-in fade-in duration-500">
            <div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                    Settings
                </h1>
                <p className="text-slate-500 text-sm mt-0.5">Manage your account and application settings.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                {/* Sidebar tabs - collapsible sections */}
                <div className={`shrink-0 space-y-1 transition-all duration-200 ${sidebarExpanded ? 'w-full md:w-56' : 'w-14'}`}>
                    {/* Toggle button */}
                    <button
                        onClick={() => setSidebarExpanded(!sidebarExpanded)}
                        type="button"
                        className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors mb-1"
                        title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
                    >
                        {sidebarExpanded ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                    </button>
                    {sidebarSections
                        .filter(section => !section.adminOnly || isAdmin)
                        .map((section, sIdx, arr) => {
                            const visibleTabs = section.tabs.filter(t => !t.adminOnly || isAdmin);
                            if (visibleTabs.length === 0) return null;
                            const isCollapsed = collapsedSections[section.label];
                            const isLast = sIdx === arr.length - 1;
                            return (
                                <div key={section.label} className={!isLast ? "border-b border-slate-100 pb-1 mb-1" : ""}>
                                    {sidebarExpanded && (
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSection(section.label); }}
                                            type="button"
                                            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors cursor-pointer select-none"
                                        >
                                            <span>{section.label}</span>
                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                                        </button>
                                    )}
                                    {(!isCollapsed || !sidebarExpanded) && (
                                        <div className="space-y-0.5 pb-1">
                                            {visibleTabs.map(t => (
                                                <button
                                                    key={t.key}
                                                    onClick={() => setActiveTab(t.key)}
                                                    type="button"
                                                    title={!sidebarExpanded ? t.label : undefined}
                                                    className={`w-full flex items-center rounded-xl text-sm font-medium transition-colors ${
                                                        sidebarExpanded ? 'gap-3 px-4 py-2.5' : 'justify-center px-0 py-2.5'
                                                    } ${activeTab === t.key
                                                        ? "bg-indigo-50 text-indigo-700"
                                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                                    }`}
                                                >
                                                    <t.icon className="w-4 h-4 shrink-0" />
                                                    {sidebarExpanded && t.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>

                {/* Tab content */}
                <div className="flex-1 min-w-0">
                    {activeTab === "profile" && <ProfileTab />}
                    {activeTab === "security" && <SecurityTab />}
                    {activeTab === "users" && isAdmin && <UsersTab />}
                    {activeTab === "roles" && canManageRoles && <RolesTab />}
                    {activeTab === "ratecards" && canManageCostCards && <RateCardsTab />}
                    {activeTab === "budgetassumptions" && isAdmin && <BudgetAssumptionsTab />}
                    {activeTab === "clients" && canManageMetadata && <MasterDataTab entity="clients" label="Client" />}
                    {activeTab === "regions" && canManageMetadata && <MasterDataTab entity="regions" label="Region" />}
                    {activeTab === "technologies" && canManageMetadata && <MasterDataTab entity="technologies" label="Technology" />}
                    {activeTab === "pricingmodels" && canManageMetadata && <MasterDataTab entity="pricing-models" label="Pricing Model" />}
                    {activeTab === "auditlog" && canViewAuditLogs && <AuditLogTab />}
                </div>
            </div>
        </div>
    );
}

/* ─────────────── Profile Tab ─────────────── */
function ProfileTab() {
    const { user } = useAuthStore();
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div>
                <h3 className="text-base font-bold text-slate-900 mb-0.5">Personal Information</h3>
                <p className="text-xs text-slate-500">Your profile details (managed by Admin).</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                    <input type="text" readOnly className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700" value={user?.name || ""} />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                    <input type="text" readOnly className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700" value={user?.role?.name || ""} />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                    <input type="email" readOnly className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700" value={user?.email || ""} />
                </div>
            </div>
        </div>
    );
}

/* ─────────────── Security Tab ─────────────── */
function SecurityTab() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [saving, setSaving] = useState(false);

    const handleChangePassword = async () => {
        setStatus(null);
        if (newPassword.length < 6) {
            setStatus({ type: "error", message: "New password must be at least 6 characters." });
            return;
        }
        if (newPassword !== confirmPassword) {
            setStatus({ type: "error", message: "Passwords do not match." });
            return;
        }
        setSaving(true);
        try {
            await apiClient("/api/auth/change-password", {
                method: "PATCH",
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            setStatus({ type: "success", message: "Password changed successfully." });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to change password." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div>
                <h3 className="text-base font-bold text-slate-900 mb-0.5">Change Password</h3>
                <p className="text-xs text-slate-500">Update your account password.</p>
            </div>

            {status && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {status.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {status.message}
                </div>
            )}

            <div className="space-y-3 max-w-md">
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Current Password</label>
                    <input type="password" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">New Password</label>
                    <input type="password" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Confirm New Password</label>
                    <input type="password" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button disabled={saving} onClick={handleChangePassword} className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {saving ? "Saving..." : "Change Password"}
                </button>
            </div>
        </div>
    );
}

/* ─────────────── Role Multi-Select Dropdown ─────────────── */
function RoleMultiSelect({ roles, selectedRoles, onChange }: { roles: AdminRole[]; selectedRoles: { id: string; name: string }[]; onChange: (roleIds: string[]) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const toggle = (roleId: string) => {
        const isSelected = selectedRoles.some(r => r.id === roleId);
        const newIds = isSelected
            ? selectedRoles.filter(r => r.id !== roleId).map(r => r.id)
            : [...selectedRoles.map(r => r.id), roleId];
        if (newIds.length === 0) return; // must have at least one role
        onChange(newIds);
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs hover:bg-slate-50 transition-colors min-w-[100px]"
            >
                <span className="flex-1 text-left truncate">
                    {selectedRoles.length === 0
                        ? <span className="text-slate-400">Select roles</span>
                        : selectedRoles.map(r => r.name).join(", ")}
                </span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-44 bg-white rounded-lg border border-slate-200 shadow-lg py-1 animate-in fade-in duration-150">
                    {roles.map(r => {
                        const isChecked = selectedRoles.some(sr => sr.id === r.id);
                        return (
                            <button
                                key={r.id}
                                onClick={() => toggle(r.id)}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors ${isChecked ? 'text-indigo-700 font-medium' : 'text-slate-600'}`}
                            >
                                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                    {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                                </span>
                                {r.name}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ─────────────── Users Tab (Admin) ─────────────── */
function UsersTab() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [roles, setRoles] = useState<AdminRole[]>([]);
    const [teams, setTeams] = useState<TeamOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Pagination
    const [userPage, setUserPage] = useState(1);
    const [userTotal, setUserTotal] = useState(0);
    const [userTotalPages, setUserTotalPages] = useState(0);
    const [userSearch, setUserSearch] = useState("");
    const userLimit = 10;

    // Reset password
    const [resetUserId, setResetUserId] = useState<string | null>(null);
    const [resetPassword, setResetPassword] = useState("");
    const [resetting, setResetting] = useState(false);
    const [showResetPw, setShowResetPw] = useState(false);

    const fetchUsers = useCallback(async (pg = 1, search = "") => {
        try {
            const qp = new URLSearchParams({ page: String(pg), limit: String(userLimit) });
            if (search) qp.set("search", search);
            const res = await apiClient<any>(`/api/admin/users?${qp.toString()}`);
            // Support paginated { data, total } or legacy array
            if (res.data && Array.isArray(res.data)) {
                setUsers(res.data);
                setUserTotal(res.total ?? res.data.length);
                setUserPage(res.page ?? pg);
                setUserTotalPages(res.totalPages ?? 1);
            } else if (Array.isArray(res)) {
                setUsers(res);
                setUserTotal(res.length);
                setUserPage(1);
                setUserTotalPages(1);
            }
        } catch {
            setStatus({ type: "error", message: "Failed to load users." });
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [r, t] = await Promise.all([
                apiClient<AdminRole[]>("/api/admin/roles"),
                apiClient<TeamOption[]>("/api/admin/teams"),
            ]);
            setRoles(r);
            setTeams(t);
            await fetchUsers(1, "");
        } catch {
            setStatus({ type: "error", message: "Failed to load data." });
        } finally {
            setLoading(false);
        }
    }, [fetchUsers]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSyncQPeople = async () => {
        setSyncing(true);
        setStatus(null);
        try {
            const result = await apiClient<{ message: string; created: number; updated: number; skipped: number }>("/api/admin/users/sync-qpeople", { method: "POST" });
            setStatus({ type: "success", message: result.message });
            fetchUsers(1, userSearch);
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to sync from QPeople." });
        } finally {
            setSyncing(false);
        }
    };

    const handleToggleActive = async (u: AdminUser) => {
        try {
            await apiClient(`/api/admin/users/${u.id}`, {
                method: "PATCH",
                body: JSON.stringify({ isActive: !u.isActive }),
            });
            fetchUsers(userPage, userSearch);
        } catch (err: any) {
            setStatus({ type: "error", message: err.message });
        }
    };

    const handleRoleChange = async (userId: string, roleIds: string[]) => {
        try {
            await apiClient(`/api/admin/users/${userId}`, {
                method: "PATCH",
                body: JSON.stringify({ roleIds }),
            });
            fetchUsers(userPage, userSearch);
            setStatus({ type: "success", message: "Roles updated." });
        } catch (err: any) {
            setStatus({ type: "error", message: err.message });
        }
    };

    const handleResetPassword = async () => {
        if (!resetUserId || resetPassword.length < 6) {
            setStatus({ type: "error", message: "Password must be at least 6 characters." });
            return;
        }
        setResetting(true);
        try {
            await apiClient(`/api/admin/users/${resetUserId}/reset-password`, {
                method: "PATCH",
                body: JSON.stringify({ newPassword: resetPassword }),
            });
            setResetUserId(null);
            setResetPassword("");
            setShowResetPw(false);
            setStatus({ type: "success", message: "Password reset." });
        } catch (err: any) {
            setStatus({ type: "error", message: err.message });
        } finally {
            setResetting(false);
        }
    };

    // Debounced user search
    useEffect(() => {
        const timer = setTimeout(() => {
            setUserPage(1);
            fetchUsers(1, userSearch);
        }, 400);
        return () => clearTimeout(timer);
    }, [userSearch, fetchUsers]);

    const userStart = userTotal === 0 ? 0 : (userPage - 1) * userLimit + 1;
    const userEnd = Math.min(userPage * userLimit, userTotal);

    if (loading) {
        return <div className="text-center py-12 text-slate-400">Loading users...</div>;
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">User Management</h3>
                <button
                    onClick={handleSyncQPeople}
                    disabled={syncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                    <Download className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? "Syncing..." : "Sync from QPeople"}
                </button>
            </div>

            <p className="text-xs text-slate-500">Users are synced from QPeople HRMS. You can assign app-specific roles and reset passwords here.</p>

            {/* User Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search by name, email, or department..."
                    className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                />
            </div>

            {status && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {status.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {status.message}
                </div>
            )}

            {/* Reset password modal */}
            {resetUserId && (
                <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm space-y-3">
                    <h4 className="font-semibold text-sm text-slate-800">Reset Password for {users.find((u) => u.id === resetUserId)?.name}</h4>
                    <div className="relative max-w-md">
                        <input placeholder="New password (min 6 chars)" type={showResetPw ? "text" : "password"} className="w-full px-3 py-1.5 pr-9 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
                        <button type="button" onClick={() => setShowResetPw(!showResetPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showResetPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button disabled={resetting} onClick={handleResetPassword} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
                            {resetting ? "Resetting..." : "Reset Password"}
                        </button>
                        <button onClick={() => { setResetUserId(null); setResetPassword(""); setShowResetPw(false); }} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                    </div>
                </div>
            )}

            {/* Users table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Name</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Email</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Department</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Designation</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Role</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Status</th>
                                <th className="text-right px-3 py-2 font-medium text-slate-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map((u) => (
                                <tr key={u.id} className="hover:bg-slate-50/50">
                                    <td className="px-3 py-2">
                                        <div className="font-medium text-slate-800">{u.name}</div>
                                        {u.qpeopleId && <span className="text-[10px] text-indigo-500 font-mono">QPeople</span>}
                                    </td>
                                    <td className="px-3 py-2 text-slate-500">{u.email}</td>
                                    <td className="px-3 py-2 text-slate-600 text-xs">{u.department || '-'}</td>
                                    <td className="px-3 py-2 text-slate-600 text-xs">{u.designation || '-'}</td>
                                    <td className="px-3 py-2">
                                        <RoleMultiSelect
                                            roles={roles}
                                            selectedRoles={u.roles}
                                            onChange={(newRoleIds) => handleRoleChange(u.id, newRoleIds)}
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <button onClick={() => handleToggleActive(u)} title={u.isActive ? "Deactivate" : "Activate"}>
                                            {u.isActive ? (
                                                <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded-full text-xs font-medium">
                                                    <ToggleRight className="w-3 h-3" /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-1 rounded-full text-xs font-medium">
                                                    <ToggleLeft className="w-3 h-3" /> Inactive
                                                </span>
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <button onClick={() => { setResetUserId(u.id); setResetPassword(""); setShowResetPw(false); }} className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 transition-colors" title="Reset Password">
                                            <RotateCcw className="w-3 h-3" /> Reset
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {users.length === 0 && <div className="text-center py-8 text-slate-400">No users found. Click "Sync from QPeople" to import.</div>}
            </div>

            {/* Pagination Footer */}
            {userTotalPages > 0 && (
                <div className="flex items-center justify-between px-1 py-2">
                    <span className="text-sm text-slate-500">
                        {userTotal === 0 ? 'No users' : `Showing ${userStart}–${userEnd} of ${userTotal} users`}
                    </span>
                    {userTotalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <button
                                disabled={userPage <= 1}
                                onClick={() => { setUserPage(userPage - 1); fetchUsers(userPage - 1, userSearch); }}
                                className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" /> Previous
                            </button>
                            <span className="text-sm text-slate-600 font-medium px-2">Page {userPage} of {userTotalPages}</span>
                            <button
                                disabled={userPage >= userTotalPages}
                                onClick={() => { setUserPage(userPage + 1); fetchUsers(userPage + 1, userSearch); }}
                                className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─────────────── Roles Tab (Admin) ─────────────── */
function RolesTab() {
    const [roles, setRoles] = useState<AdminRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Form state
    const [formName, setFormName] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formPermissions, setFormPermissions] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    const fetchRoles = useCallback(async () => {
        setLoading(true);
        try {
            const r = await apiClient<AdminRole[]>("/api/admin/roles");
            setRoles(r);
        } catch {
            setStatus({ type: "error", message: "Failed to load roles." });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRoles(); }, [fetchRoles]);

    const openEdit = (role: AdminRole) => {
        setEditingRole(role);
        setFormName(role.name);
        setFormDescription(role.description || "");
        setFormPermissions([...(role.permissions as string[])]);
        setShowCreate(false);
    };

    const openCreate = () => {
        setEditingRole(null);
        setFormName("");
        setFormDescription("");
        setFormPermissions([]);
        setShowCreate(true);
    };

    const togglePermission = (perm: string) => {
        setFormPermissions((prev) =>
            prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
        );
    };

    const handleSave = async () => {
        setStatus(null);
        if (!formName.trim()) {
            setStatus({ type: "error", message: "Role name is required." });
            return;
        }
        setSaving(true);
        try {
            if (editingRole) {
                await apiClient(`/api/admin/roles/${editingRole.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ name: formName, description: formDescription, permissions: formPermissions }),
                });
                setStatus({ type: "success", message: "Role updated." });
            } else {
                await apiClient("/api/admin/roles", {
                    method: "POST",
                    body: JSON.stringify({ name: formName, description: formDescription, permissions: formPermissions }),
                });
                setStatus({ type: "success", message: "Role created." });
            }
            setEditingRole(null);
            setShowCreate(false);
            fetchRoles();
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to save role." });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (role: AdminRole) => {
        if (role.isSystem) return;
        if (role.userCount > 0) {
            setStatus({ type: "error", message: `Cannot delete "${role.name}" — it has ${role.userCount} user(s) assigned.` });
            return;
        }
        try {
            await apiClient(`/api/admin/roles/${role.id}`, { method: "DELETE" });
            fetchRoles();
            setStatus({ type: "success", message: "Role deleted." });
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to delete role." });
        }
    };

    const isEditing = editingRole !== null || showCreate;
    const isWildcard = formPermissions.includes("*");

    if (loading) {
        return <div className="text-center py-12 text-slate-400">Loading roles...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Role Management</h3>
                {!isEditing && (
                    <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> New Role
                    </button>
                )}
            </div>

            {status && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {status.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {status.message}
                </div>
            )}

            {/* Role editor */}
            {isEditing && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-slate-800">{editingRole ? `Edit: ${editingRole.name}` : "Create Role"}</h4>
                        <button onClick={() => { setEditingRole(null); setShowCreate(false); }} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Role Name</label>
                            <input className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" value={formName} onChange={(e) => setFormName(e.target.value)} disabled={editingRole?.isSystem} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                            <input className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                        </div>
                    </div>

                    {/* Wildcard (Admin) toggle */}
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={isWildcard} onChange={() => {
                                if (isWildcard) {
                                    setFormPermissions(formPermissions.filter(p => p !== "*"));
                                } else {
                                    setFormPermissions(["*"]);
                                }
                            }} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm font-medium text-slate-700">Full Admin Access (wildcard *)</span>
                        </label>
                    </div>

                    {/* Permission grid */}
                    {!isWildcard && (
                        <div className="space-y-3">
                            <h5 className="text-xs font-semibold text-slate-700">Permissions</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {PERMISSION_CATEGORIES.map((cat) => (
                                    <div key={cat.label} className="border border-slate-100 rounded-lg p-3">
                                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{cat.label}</p>
                                        <div className="space-y-1.5">
                                            {cat.permissions.map((p) => (
                                                <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={formPermissions.includes(p.key)}
                                                        onChange={() => togglePermission(p.key)}
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm text-slate-700">{p.label}</span>
                                                    <span className="text-xs text-slate-400 ml-auto font-mono">{p.key}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                        <button onClick={() => { setEditingRole(null); setShowCreate(false); }} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                        <button disabled={saving} onClick={handleSave} className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                            {saving ? "Saving..." : editingRole ? "Update Role" : "Create Role"}
                        </button>
                    </div>
                </div>
            )}

            {/* Roles list */}
            <div className="grid grid-cols-1 gap-3">
                {roles.map((role) => (
                    <div key={role.id} className="bg-white rounded-lg border border-slate-200 p-3 flex items-center justify-between hover:shadow-sm transition-shadow">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800">{role.name}</span>
                                {role.isSystem && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">SYSTEM</span>}
                                <span className="text-xs text-slate-400">{role.userCount} user{role.userCount !== 1 ? "s" : ""}</span>
                            </div>
                            {role.description && <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>}
                            <div className="flex flex-wrap gap-1 mt-2">
                                {(role.permissions as string[]).includes("*") ? (
                                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">ALL PERMISSIONS</span>
                                ) : (
                                    (role.permissions as string[]).slice(0, 6).map((p) => (
                                        <span key={p} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full font-mono">{p}</span>
                                    ))
                                )}
                                {!((role.permissions as string[]).includes("*")) && (role.permissions as string[]).length > 6 && (
                                    <span className="text-[10px] text-slate-400">+{(role.permissions as string[]).length - 6} more</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                            <button onClick={() => openEdit(role)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                            {!role.isSystem && (
                                <button onClick={() => handleDelete(role)} className="p-2 text-slate-400 hover:text-red-600 transition-colors" title="Delete"><X className="w-4 h-4" /></button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─────────────── Rate Cards Tab (Admin) ─────────────── */
interface RateCardItem {
    id: string;
    code: string;
    role: string;
    skill: string;
    experienceBand: string;
    masterCtc: number;
    mercerCtc: number;
    copilot: number;
    existingCtc: number;
    maxCtc: number;
    ctc: number;
    category: string;
    isActive: boolean;
}

function RateCardsTab() {
    const [rateCards, setRateCards] = useState<RateCardItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Pagination
    const [rcPage, setRcPage] = useState(1);
    const [rcTotal, setRcTotal] = useState(0);
    const [rcTotalPages, setRcTotalPages] = useState(0);
    const rcLimit = 20;

    const [formData, setFormData] = useState({
        code: "", role: "", skill: "", experienceBand: "",
        masterCtc: "", mercerCtc: "", copilot: "", existingCtc: "", maxCtc: "", ctc: "", category: "Technology"
    });

    const fetchRateCards = useCallback(async (pg = 1, search = "") => {
        try {
            const qp = new URLSearchParams({ page: String(pg), limit: String(rcLimit) });
            if (search) qp.set("search", search);
            const res = await apiClient<any>(`/api/admin/rate-cards?${qp.toString()}`);
            if (res.data && Array.isArray(res.data)) {
                setRateCards(res.data);
                setRcTotal(res.total ?? res.data.length);
                setRcPage(res.page ?? pg);
                setRcTotalPages(res.totalPages ?? 1);
            } else if (Array.isArray(res)) {
                setRateCards(res);
                setRcTotal(res.length);
                setRcPage(1);
                setRcTotalPages(1);
            }
        } catch {
            setStatus({ type: "error", message: "Failed to load rate cards." });
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            await fetchRateCards(1, "");
        } catch {
            setStatus({ type: "error", message: "Failed to load rate cards." });
        } finally {
            setLoading(false);
        }
    }, [fetchRateCards]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setRcPage(1);
            fetchRateCards(1, searchTerm);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm, fetchRateCards]);

    const resetForm = () => {
        setFormData({ code: "", role: "", skill: "", experienceBand: "", masterCtc: "", mercerCtc: "", copilot: "", existingCtc: "", maxCtc: "", ctc: "", category: "Technology" });
        setEditingId(null); setShowCreate(false);
    };

    const openEdit = (rc: RateCardItem) => {
        setEditingId(rc.id);
        setFormData({
            code: rc.code, role: rc.role, skill: rc.skill, experienceBand: rc.experienceBand,
            masterCtc: String(rc.masterCtc), mercerCtc: String(rc.mercerCtc),
            copilot: String(rc.copilot), existingCtc: String(rc.existingCtc),
            maxCtc: String(rc.maxCtc), ctc: String(rc.ctc), category: rc.category
        });
        setShowCreate(false);
    };

    const openCreate = () => { resetForm(); setShowCreate(true); };

    const handleSave = async () => {
        setStatus(null);
        if (!formData.skill.trim() || !formData.experienceBand.trim()) {
            setStatus({ type: "error", message: "Skill and Experience Band are required." });
            return;
        }
        setSaving(true);
        const code = formData.code || `${formData.skill.replace(/\s+/g, '-').substring(0, 20)}-${formData.experienceBand}`;
        try {
            const payload = {
                code,
                role: formData.role || formData.skill,
                skill: formData.skill,
                experienceBand: formData.experienceBand,
                masterCtc: Number(formData.masterCtc) || 0,
                mercerCtc: Number(formData.mercerCtc) || 0,
                copilot: Number(formData.copilot) || 0,
                existingCtc: Number(formData.existingCtc) || 0,
                maxCtc: Number(formData.maxCtc) || 0,
                ctc: Number(formData.maxCtc) || 0,
                category: formData.category,
            };
            if (editingId) {
                await apiClient(`/api/admin/rate-cards/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
                setStatus({ type: "success", message: "Rate card updated." });
            } else {
                await apiClient("/api/admin/rate-cards", { method: "POST", body: JSON.stringify(payload) });
                setStatus({ type: "success", message: "Rate card created." });
            }
            resetForm();
            fetchRateCards(rcPage, searchTerm);
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to save rate card." });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (rc: RateCardItem) => {
        try {
            await apiClient(`/api/admin/rate-cards/${rc.id}`, { method: "DELETE" });
            fetchRateCards(rcPage, searchTerm);
            setStatus({ type: "success", message: "Rate card deleted." });
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to delete." });
        }
    };

    const isEditing = editingId !== null || showCreate;

    const rcStart = rcTotal === 0 ? 0 : (rcPage - 1) * rcLimit + 1;
    const rcEnd = Math.min(rcPage * rcLimit, rcTotal);

    if (loading) return <div className="text-center py-12 text-slate-400">Loading rate cards...</div>;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-bold text-slate-900">Rate Card Management</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Columns: Skill, Experience Band, Master CTC, Mercer CTC, Copilot, Existing CTC, Max — matching the Excel</p>
                </div>
                {!isEditing && (
                    <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Add Rate Card
                    </button>
                )}
            </div>

            {status && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {status.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {status.message}
                </div>
            )}

            {/* Create / Edit form */}
            {isEditing && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-slate-800">{editingId ? "Edit Rate Card" : "New Rate Card"}</h4>
                        <button onClick={resetForm} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Skill *</label>
                            <input className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" placeholder="e.g. .NET Developer" value={formData.skill} onChange={(e) => setFormData({ ...formData, skill: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Experience Band *</label>
                            <input className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" placeholder="e.g. 00-02" value={formData.experienceBand} onChange={(e) => setFormData({ ...formData, experienceBand: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Master CTC (₹)</label>
                            <input type="number" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" placeholder="0" value={formData.masterCtc} onChange={(e) => setFormData({ ...formData, masterCtc: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Mercer CTC (₹)</label>
                            <input type="number" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" placeholder="0" value={formData.mercerCtc} onChange={(e) => setFormData({ ...formData, mercerCtc: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Copilot (₹)</label>
                            <input type="number" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" placeholder="0" value={formData.copilot} onChange={(e) => setFormData({ ...formData, copilot: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Existing CTC (₹)</label>
                            <input type="number" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" placeholder="0" value={formData.existingCtc} onChange={(e) => setFormData({ ...formData, existingCtc: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Max CTC (₹)</label>
                            <input type="number" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" placeholder="0" value={formData.maxCtc} onChange={(e) => setFormData({ ...formData, maxCtc: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                            <input className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" placeholder="e.g. Technology" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={resetForm} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                        <button disabled={saving} onClick={handleSave} className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                            {saving ? "Saving..." : editingId ? "Update" : "Create"}
                        </button>
                    </div>
                </div>
            )}

            {/* Search */}
            <div>
                <input
                    type="text"
                    placeholder="Search by skill, experience band, or code..."
                    className="w-full max-w-md px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="text-xs text-slate-400 ml-2">{rcTotal} records</span>
            </div>

            {/* Rate cards table — matches Excel columns */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Skill</th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Experience Band</th>
                                <th className="text-right px-3 py-2 font-medium text-slate-600">Master CTC</th>
                                <th className="text-right px-3 py-2 font-medium text-slate-600">Mercer CTC</th>
                                <th className="text-right px-3 py-2 font-medium text-slate-600">Copilot</th>
                                <th className="text-right px-3 py-2 font-medium text-slate-600">Existing CTC</th>
                                <th className="text-right px-3 py-2 font-medium text-slate-600">Max</th>
                                <th className="text-right px-3 py-2 font-medium text-slate-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rateCards.map((rc, idx) => (
                                <tr key={rc.id} className="hover:bg-slate-50/50">
                                    <td className="px-3 py-2 text-slate-400 text-xs">{(rcPage - 1) * rcLimit + idx + 1}</td>
                                    <td className="px-3 py-2 font-medium text-slate-800">{rc.skill || rc.role}</td>
                                    <td className="px-3 py-2 text-slate-600">{rc.experienceBand || '-'}</td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-700">
                                        {rc.masterCtc != null ? `₹${Math.round(rc.masterCtc).toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-700">
                                        {rc.mercerCtc != null ? `₹${Math.round(rc.mercerCtc).toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-700">
                                        {rc.copilot != null ? `₹${Math.round(rc.copilot).toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-700">
                                        {rc.existingCtc != null ? `₹${Math.round(rc.existingCtc).toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">
                                        {rc.maxCtc != null ? `₹${Math.round(rc.maxCtc).toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => openEdit(rc)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleDelete(rc)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {rateCards.length === 0 && <div className="text-center py-8 text-slate-400">No rate cards found.</div>}
            </div>

            {/* Pagination Footer */}
            {rcTotalPages > 0 && (
                <div className="flex items-center justify-between px-1 py-2">
                    <span className="text-sm text-slate-500">
                        {rcTotal === 0 ? 'No rate cards' : `Showing ${rcStart}–${rcEnd} of ${rcTotal} rate cards`}
                    </span>
                    {rcTotalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <button
                                disabled={rcPage <= 1}
                                onClick={() => { setRcPage(rcPage - 1); fetchRateCards(rcPage - 1, searchTerm); }}
                                className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" /> Previous
                            </button>
                            <span className="text-sm text-slate-600 font-medium px-2">Page {rcPage} of {rcTotalPages}</span>
                            <button
                                disabled={rcPage >= rcTotalPages}
                                onClick={() => { setRcPage(rcPage + 1); fetchRateCards(rcPage + 1, searchTerm); }}
                                className="inline-flex items-center gap-1 px-3 py-1 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─────────────── Budget Assumptions Tab ─────────────── */
interface BudgetAssumptionsData {
    marginPercent: number;
    workingDaysPerYear: number;
    deliveryMgmtPercent: number;
    benchPercent: number;
    leaveEligibilityPercent: number;
    annualGrowthBufferPercent: number;
    averageIncrementPercent: number;
    bonusPercent: number;
    indirectCostPercent: number;
    welfarePerFte: number;
    trainingPerFte: number;
}

const DEFAULT_ASSUMPTIONS: BudgetAssumptionsData = {
    marginPercent: 35,
    workingDaysPerYear: 240,
    deliveryMgmtPercent: 5,
    benchPercent: 10,
    leaveEligibilityPercent: 0,
    annualGrowthBufferPercent: 0,
    averageIncrementPercent: 0,
    bonusPercent: 0,
    indirectCostPercent: 0,
    welfarePerFte: 0,
    trainingPerFte: 0,
};

function BudgetAssumptionsTab() {
    const [data, setData] = useState<BudgetAssumptionsData>(DEFAULT_ASSUMPTIONS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const result = await apiClient("/api/admin/budget-assumptions");
                setData({ ...DEFAULT_ASSUMPTIONS, ...result });
            } catch {
                setStatus({ type: "error", message: "Failed to load budget assumptions." });
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleChange = (name: keyof BudgetAssumptionsData, value: string) => {
        setData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    };

    const handleSave = async () => {
        setSaving(true);
        setStatus(null);
        try {
            await apiClient("/api/admin/budget-assumptions", { method: "PUT", body: JSON.stringify(data) });
            setStatus({ type: "success", message: "Budget assumptions saved." });
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to save." });
        } finally {
            setSaving(false);
        }
    };

    const InputField = ({ label, name, desc }: { label: string; name: keyof BudgetAssumptionsData; desc?: string }) => (
        <div className="grid gap-1">
            <label className="text-xs font-medium text-slate-700">{label}</label>
            <input
                type="number"
                value={data[name]}
                onChange={(e) => handleChange(name, e.target.value)}
                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {desc && <p className="text-xs text-slate-500">{desc}</p>}
        </div>
    );

    if (loading) return <div className="p-6 text-center text-slate-500">Loading...</div>;

    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-bold text-slate-800">Budget Assumptions</h2>
                    <p className="text-xs text-slate-500 mt-1">Configure default assumptions used in GOM / estimation calculations.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            </div>

            {status && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {status.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {status.message}
                </div>
            )}

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-3">
                        <h3 className="font-semibold text-sm border-b pb-2 text-slate-800">Core Rates</h3>
                        <InputField label="Margin %" name="marginPercent" desc="Target profit margin percentage." />
                        <InputField label="Working Days / Year" name="workingDaysPerYear" desc="Standard working days (e.g. 240)." />
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-semibold text-sm border-b pb-2 text-slate-800">Overheads (Loadings)</h3>
                        <InputField label="Delivery Management %" name="deliveryMgmtPercent" />
                        <InputField label="Bench %" name="benchPercent" />
                        <InputField label="Leave Eligibility %" name="leaveEligibilityPercent" />
                        <InputField label="Growth Buffer %" name="annualGrowthBufferPercent" />
                        <InputField label="Increments %" name="averageIncrementPercent" />
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-semibold text-sm border-b pb-2 text-slate-800">Other Cost Drivers</h3>
                        <InputField label="Bonus % (of Base)" name="bonusPercent" desc="Performance bonus loading." />
                        <InputField label="Indirect Cost % (of Base)" name="indirectCostPercent" desc="Overheads and SG&A." />
                        <InputField label="Welfare / FTE (Yearly)" name="welfarePerFte" desc="Team building amount per head/year." />
                        <InputField label="Training / FTE (Yearly)" name="trainingPerFte" desc="Learning budget per head/year." />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─────────────── Audit Log Tab ─────────────── */
interface AuditLogEntry {
    id: string;
    entity: string;
    entityId: string;
    action: string;
    changes: any;
    timestamp: string;
    user?: { id: string; name: string; email: string } | null;
}

function AuditLogTab() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [entityFilter, setEntityFilter] = useState("");
    const [actionFilter, setActionFilter] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [entities, setEntities] = useState<string[]>([]);
    const [actions, setActions] = useState<string[]>([]);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "25" });
            if (entityFilter) params.set("entity", entityFilter);
            if (actionFilter) params.set("action", actionFilter);
            if (searchQuery) params.set("search", searchQuery);
            const data = await apiClient(`/api/admin/audit-logs?${params.toString()}`);
            setLogs(data.data);
            setTotalPages(data.pagination.totalPages);
            setTotal(data.pagination.total);
        } catch {
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [page, entityFilter, actionFilter, searchQuery]);

    const fetchFilters = useCallback(async () => {
        try {
            const [e, a] = await Promise.all([
                apiClient<string[]>("/api/admin/audit-logs/entities"),
                apiClient<string[]>("/api/admin/audit-logs/actions"),
            ]);
            setEntities(e);
            setActions(a);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchFilters(); }, [fetchFilters]);
    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    };

    const actionColor = (action: string) => {
        if (action.includes("CREATE") || action.includes("INGEST")) return "bg-green-50 text-green-700";
        if (action.includes("DELETE") || action.includes("LOST")) return "bg-red-50 text-red-700";
        if (action.includes("STAGE") || action.includes("CONVERT")) return "bg-purple-50 text-purple-700";
        return "bg-blue-50 text-blue-700";
    };

    const renderChanges = (changes: any) => {
        if (!changes || typeof changes !== "object") return <span className="text-slate-400 text-xs">—</span>;
        return (
            <div className="text-xs space-y-0.5">
                {Object.entries(changes).map(([key, val]: [string, any]) => (
                    <div key={key} className="flex gap-1">
                        <span className="font-medium text-slate-600 min-w-[80px]">{key}:</span>
                        {val && typeof val === "object" && val.from !== undefined ? (
                            <span>
                                <span className="text-red-500 line-through">{String(val.from ?? "—")}</span>
                                {" → "}
                                <span className="text-green-600 font-medium">{String(val.to ?? "—")}</span>
                            </span>
                        ) : (
                            <span className="text-slate-700">{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-bold text-slate-900 mb-0.5">Audit Log</h3>
                    <p className="text-xs text-slate-500">Complete history of all system changes.</p>
                </div>
                <span className="text-xs text-slate-400">{total} entries</span>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[150px] max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search user / action..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
                <select
                    value={entityFilter}
                    onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                    <option value="">All Entities</option>
                    {entities.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select
                    value={actionFilter}
                    onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                    <option value="">All Actions</option>
                    {actions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>

            {/* Table */}
            {loading ? (
                <div className="text-center py-8 text-sm text-slate-400">Loading audit logs...</div>
            ) : logs.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">No audit log entries found.</div>
            ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-3 py-2 font-semibold text-slate-600">Timestamp</th>
                                <th className="text-left px-3 py-2 font-semibold text-slate-600">User</th>
                                <th className="text-left px-3 py-2 font-semibold text-slate-600">Entity</th>
                                <th className="text-left px-3 py-2 font-semibold text-slate-600">Action</th>
                                <th className="text-left px-3 py-2 font-semibold text-slate-600">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <>
                                    <tr
                                        key={log.id}
                                        onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                                    >
                                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDate(log.timestamp)}</td>
                                        <td className="px-3 py-2 text-slate-700">{log.user?.name || log.user?.email || "System"}</td>
                                        <td className="px-3 py-2">
                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{log.entity}</span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`px-1.5 py-0.5 rounded font-medium ${actionColor(log.action)}`}>{log.action}</span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-400">
                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedRow === log.id ? 'rotate-180' : ''}`} />
                                        </td>
                                    </tr>
                                    {expandedRow === log.id && (
                                        <tr key={`${log.id}-detail`} className="bg-slate-50/50">
                                            <td colSpan={5} className="px-4 py-3">
                                                <div className="space-y-1">
                                                    <div className="text-xs text-slate-400">Entity ID: {log.entityId}</div>
                                                    {renderChanges(log.changes)}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─────────────── Master Data Tab (Generic CRUD for Clients, Regions, Technologies, Pricing Models) ─────────────── */
function MasterDataTab({ entity, label }: { entity: string; label: string }) {
    const [items, setItems] = useState<{ id: string; name: string; isActive?: boolean }[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formName, setFormName] = useState("");
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiClient(`/api/admin/${entity}`);
            setItems(data);
        } catch {
            setStatus({ type: "error", message: `Failed to load ${label.toLowerCase()}s.` });
        } finally {
            setLoading(false);
        }
    }, [entity, label]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const resetForm = () => { setFormName(""); setEditingId(null); setShowCreate(false); };

    const openEdit = (item: { id: string; name: string }) => {
        setEditingId(item.id);
        setFormName(item.name);
        setShowCreate(false);
    };

    const handleSave = async () => {
        setStatus(null);
        if (!formName.trim()) { setStatus({ type: "error", message: "Name is required." }); return; }
        setSaving(true);
        try {
            if (editingId) {
                await apiClient(`/api/admin/${entity}/${editingId}`, { method: "PATCH", body: JSON.stringify({ name: formName }) });
                setStatus({ type: "success", message: `${label} updated.` });
            } else {
                await apiClient(`/api/admin/${entity}`, { method: "POST", body: JSON.stringify({ name: formName }) });
                setStatus({ type: "success", message: `${label} created.` });
            }
            resetForm();
            fetchData();
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || `Failed to save ${label.toLowerCase()}.` });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await apiClient(`/api/admin/${entity}/${id}`, { method: "DELETE" });
            fetchData();
            setStatus({ type: "success", message: `${label} deleted.` });
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to delete." });
        }
    };

    if (loading) return <div className="text-center py-12 text-slate-400">Loading {label.toLowerCase()}s...</div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">{label} Management</h3>
                {!showCreate && !editingId && (
                    <button onClick={() => { resetForm(); setShowCreate(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Add {label}
                    </button>
                )}
            </div>

            {status && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {status.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {status.message}
                </div>
            )}

            {(showCreate || editingId) && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-slate-800">{editingId ? `Edit ${label}` : `New ${label}`}</h4>
                        <button onClick={resetForm} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                        <input className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" placeholder={`${label} name`} value={formName} onChange={(e) => setFormName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={resetForm} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                        <button disabled={saving} onClick={handleSave} className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                            {saving ? "Saving..." : editingId ? "Update" : "Create"}
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">Name</th>
                                <th className="text-right px-3 py-2 font-medium text-slate-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50/50">
                                    <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
                                    <td className="px-3 py-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {items.length === 0 && <div className="text-center py-8 text-slate-400">No {label.toLowerCase()}s found.</div>}
            </div>
        </div>
    );
}
