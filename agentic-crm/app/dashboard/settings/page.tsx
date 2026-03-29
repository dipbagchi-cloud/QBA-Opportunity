"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { User, Lock, Users, Shield, Plus, X, Check, AlertCircle, RotateCcw, Pencil, ToggleLeft, ToggleRight, DollarSign, Trash2, Globe, Cpu, Tag, Building2, Download, Settings2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, Search, Eye, EyeOff, FileText, Mail, Send, Briefcase, ShieldCheck, RefreshCw, Coins, UserPlus, UserMinus, Calculator, Percent, Info, Clock } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { apiClient } from "@/lib/api";
import { useCurrency } from "@/components/providers/currency-provider";

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
    reportingManagerName?: string;
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
    users?: { id: string; name: string; email: string }[];
}

interface TeamOption {
    id: string;
    name: string;
}

type Tab = "profile" | "security" | "users" | "roles" | "qpeoplemapping" | "authconfig" | "ratecards" | "budgetassumptions" | "currencyrates" | "gomcalculator" | "clients" | "regions" | "technologies" | "pricingmodels" | "projecttypes" | "auditlog" | "emailtemplates";

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
                { key: "qpeoplemapping", label: "QPeople Role Mapping", icon: RefreshCw, adminOnly: true },
                { key: "authconfig", label: "Authentication", icon: ShieldCheck, adminOnly: true },
            ],
        },
        {
            label: "Cost Management",
            adminOnly: true,
            tabs: [
                { key: "ratecards", label: "Rate Cards", icon: DollarSign, adminOnly: true },
                { key: "budgetassumptions", label: "Budget Assumptions", icon: Settings2, adminOnly: true },
                { key: "currencyrates", label: "Currency Rates", icon: Coins, adminOnly: true },
                { key: "gomcalculator", label: "GOM Calculator", icon: DollarSign, adminOnly: true },
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
                { key: "projecttypes", label: "Project Types", icon: Briefcase, adminOnly: true },
            ],
        },
        {
            label: "Compliance",
            adminOnly: true,
            tabs: [
                { key: "auditlog", label: "Audit Log", icon: FileText, adminOnly: true },
            ],
        },
        {
            label: "Notifications",
            adminOnly: true,
            tabs: [
                { key: "emailtemplates", label: "Email Templates", icon: Mail, adminOnly: true },
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
                    {activeTab === "qpeoplemapping" && isAdmin && <QPeopleMappingTab />}
                    {activeTab === "authconfig" && isAdmin && <AuthConfigTab />}
                    {activeTab === "ratecards" && canManageCostCards && <RateCardsTab />}
                    {activeTab === "budgetassumptions" && isAdmin && <BudgetAssumptionsTab />}
                    {activeTab === "currencyrates" && isAdmin && <CurrencyRatesTab />}
                    {activeTab === "gomcalculator" && isAdmin && <GomCalculatorTab />}
                    {activeTab === "clients" && canManageMetadata && <MasterDataTab entity="clients" label="Client" />}
                    {activeTab === "regions" && canManageMetadata && <MasterDataTab entity="regions" label="Region" />}
                    {activeTab === "technologies" && canManageMetadata && <MasterDataTab entity="technologies" label="Technology" />}
                    {activeTab === "pricingmodels" && canManageMetadata && <MasterDataTab entity="pricing-models" label="Pricing Model" />}
                    {activeTab === "projecttypes" && canManageMetadata && <MasterDataTab entity="project-types" label="Project Type" />}
                    {activeTab === "auditlog" && canViewAuditLogs && <AuditLogTab />}
                    {activeTab === "emailtemplates" && isAdmin && <EmailTemplatesTab />}
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
    const { user } = useAuthStore();
    const isSSOUser = user?.email?.toLowerCase().endsWith("@qbadvisory.com");
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

            {isSSOUser ? (
                <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-blue-50 text-blue-700">
                    <ShieldCheck className="w-4 h-4" />
                    Your account uses SSO (Single Sign-On) via @qbadvisory.com. Password management is handled by your organization.
                </div>
            ) : (
            <>
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
            </>
            )}
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
    const [userLimit, setUserLimit] = useState(10);

    // Column filters
    const [filterDept, setFilterDept] = useState("");
    const [filterDesig, setFilterDesig] = useState("");
    const [filterRole, setFilterRole] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterManager, setFilterManager] = useState("");
    const [filterOptions, setFilterOptions] = useState<{ departments: string[]; designations: string[]; managers: string[]; roles: string[]; statuses: string[] }>({ departments: [], designations: [], managers: [], roles: [], statuses: ['active', 'inactive'] });

    // Sort
    const [userSortKey, setUserSortKey] = useState("name");
    const [userSortDir, setUserSortDir] = useState<SortDir>("asc");
    const handleUserSort = (key: string, dir: SortDir) => { setUserSortKey(dir ? key : "name"); setUserSortDir(dir); setUserPage(1); };

    // Reset password
    const [resetUserId, setResetUserId] = useState<string | null>(null);
    const [resetPassword, setResetPassword] = useState("");
    const [resetting, setResetting] = useState(false);
    const [showResetPw, setShowResetPw] = useState(false);

    // Create user form
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [newUserName, setNewUserName] = useState("");
    const [newUserEmail, setNewUserEmail] = useState("");
    const [newUserRole, setNewUserRole] = useState("");
    const [newUserDept, setNewUserDept] = useState("");
    const [creatingUser, setCreatingUser] = useState(false);

    const fetchUsers = useCallback(async (pg = 1, search = "", lim?: number) => {
        try {
            const effectiveLimit = lim ?? userLimit;
            const qp = new URLSearchParams({ page: String(pg), limit: String(effectiveLimit) });
            if (search) qp.set("search", search);
            if (filterDept) qp.set("department", filterDept);
            if (filterDesig) qp.set("designation", filterDesig);
            if (filterRole) qp.set("role", filterRole);
            if (filterStatus) qp.set("status", filterStatus);
            if (filterManager) qp.set("reportingManager", filterManager);
            if (userSortKey && userSortDir) { qp.set("sortBy", userSortKey); qp.set("sortDir", userSortDir); }
            const res = await apiClient<any>(`/api/admin/users?${qp.toString()}`);
            // Support paginated { data, total } or legacy array
            if (res.data && Array.isArray(res.data)) {
                setUsers(res.data);
                setUserTotal(res.total ?? res.data.length);
                setUserPage(res.page ?? pg);
                setUserTotalPages(res.totalPages ?? 1);
                if (res.filters) setFilterOptions(res.filters);
            } else if (Array.isArray(res)) {
                setUsers(res);
                setUserTotal(res.length);
                setUserPage(1);
                setUserTotalPages(1);
            }
        } catch {
            setStatus({ type: "error", message: "Failed to load users." });
        }
    }, [userLimit, filterDept, filterDesig, filterRole, filterStatus, filterManager, userSortKey, userSortDir]);

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

    const handleCreateUser = async () => {
        if (!newUserName.trim() || !newUserEmail.trim() || !newUserRole) {
            setStatus({ type: "error", message: "Name, email, and role are required." });
            return;
        }
        setCreatingUser(true);
        try {
            await apiClient("/api/admin/users", {
                method: "POST",
                body: JSON.stringify({
                    name: newUserName,
                    email: newUserEmail,
                    roleIds: [newUserRole],
                    department: newUserDept || undefined,
                }),
            });
            setStatus({ type: "success", message: "User created. Default password assigned - user must change on first login." });
            setShowCreateUser(false);
            setNewUserName("");
            setNewUserEmail("");
            setNewUserRole("");
            setNewUserDept("");
            fetchUsers(1, userSearch);
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to create user." });
        } finally {
            setCreatingUser(false);
        }
    };

    // Debounced user search
    useEffect(() => {
        const timer = setTimeout(() => {
            setUserPage(1);
            fetchUsers(1, userSearch);
        }, 400);
        return () => clearTimeout(timer);
    }, [userSearch, fetchUsers, filterDept, filterDesig, filterRole, filterStatus, filterManager]);

    if (loading) {
        return <div className="text-center py-12 text-slate-400">Loading users...</div>;
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">User Management</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowCreateUser(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                    >
                        <UserPlus className="w-4 h-4" />
                        Create User
                    </button>
                    <button
                        onClick={handleSyncQPeople}
                        disabled={syncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        <Download className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? "Syncing..." : "Sync from QPeople"}
                    </button>
                </div>
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

            {/* Create user modal */}
            {showCreateUser && (
                <div className="bg-white p-4 rounded-xl border border-green-200 shadow-sm space-y-4">
                    <h4 className="font-semibold text-sm text-slate-800">Create New User</h4>
                    <p className="text-xs text-slate-500">User will be assigned a default password and must change it on first login.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
                            <input
                                placeholder="Full name"
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 text-sm"
                                value={newUserName}
                                onChange={(e) => setNewUserName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
                            <input
                                type="email"
                                placeholder="email@example.com"
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 text-sm"
                                value={newUserEmail}
                                onChange={(e) => setNewUserEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Role *</label>
                            <select
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 text-sm"
                                value={newUserRole}
                                onChange={(e) => setNewUserRole(e.target.value)}
                            >
                                <option value="">Select role...</option>
                                {roles.map((r) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                            <input
                                placeholder="Optional"
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500/20 text-sm"
                                value={newUserDept}
                                onChange={(e) => setNewUserDept(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button
                            disabled={creatingUser}
                            onClick={handleCreateUser}
                            className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                            {creatingUser ? "Creating..." : "Create User"}
                        </button>
                        <button
                            onClick={() => { setShowCreateUser(false); setNewUserName(""); setNewUserEmail(""); setNewUserRole(""); setNewUserDept(""); }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Active column filters */}
            {(filterDept || filterDesig || filterRole || filterStatus || filterManager) && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-slate-400">Filters:</span>
                    {filterDept && <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">{filterDept}<button onClick={() => setFilterDept("")}><X className="w-3 h-3" /></button></span>}
                    {filterDesig && <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">{filterDesig}<button onClick={() => setFilterDesig("")}><X className="w-3 h-3" /></button></span>}
                    {filterManager && <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">{filterManager}<button onClick={() => setFilterManager("")}><X className="w-3 h-3" /></button></span>}
                    {filterRole && <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">{filterRole}<button onClick={() => setFilterRole("")}><X className="w-3 h-3" /></button></span>}
                    {filterStatus && <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">{filterStatus}<button onClick={() => setFilterStatus("")}><X className="w-3 h-3" /></button></span>}
                    <button onClick={() => { setFilterDept(""); setFilterDesig(""); setFilterRole(""); setFilterStatus(""); setFilterManager(""); }} className="text-red-500 hover:underline ml-1">Clear all</button>
                </div>
            )}

            {/* Users table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="overflow-x-auto overflow-y-visible">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <SortableHeader label="Name" sortKey="name" currentSort={userSortKey} currentDir={userSortDir} onSort={handleUserSort} className="text-left px-3 text-slate-600" />
                                <SortableHeader label="Email" sortKey="email" currentSort={userSortKey} currentDir={userSortDir} onSort={handleUserSort} className="text-left px-3 text-slate-600" />
                                <th className="text-left px-3 py-2 font-medium text-slate-600">
                                    <ColumnFilter label="Department" value={filterDept} options={filterOptions.departments} onChange={setFilterDept} />
                                </th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">
                                    <ColumnFilter label="Designation" value={filterDesig} options={filterOptions.designations} onChange={setFilterDesig} />
                                </th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">
                                    <ColumnFilter label="Reporting Manager" value={filterManager} options={filterOptions.managers} onChange={setFilterManager} />
                                </th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">
                                    <ColumnFilter label="Role" value={filterRole} options={filterOptions.roles} onChange={setFilterRole} />
                                </th>
                                <th className="text-left px-3 py-2 font-medium text-slate-600">
                                    <ColumnFilter label="Status" value={filterStatus} options={filterOptions.statuses} onChange={setFilterStatus} />
                                </th>
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
                                    <td className="px-3 py-2 text-slate-600 text-xs">{(u as any).reportingManagerName || '-'}</td>
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
                                        {u.email.toLowerCase().endsWith("@qbadvisory.com") ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-blue-500" title="SSO User — password managed via SSO">
                                                SSO
                                            </span>
                                        ) : (
                                        <button onClick={() => { setResetUserId(u.id); setResetPassword(""); setShowResetPw(false); }} className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 transition-colors" title="Reset Password">
                                            <RotateCcw className="w-3 h-3" /> Reset
                                        </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {users.length === 0 && <div className="text-center py-8 text-slate-400">No users found. Click &quot;Sync from QPeople&quot; to import.</div>}
            </div>

            {/* Advanced Pagination Footer */}
            <PaginationControls
                page={userPage}
                totalPages={userTotalPages}
                total={userTotal}
                limit={userLimit}
                onPageChange={(pg) => { setUserPage(pg); fetchUsers(pg, userSearch); }}
                onLimitChange={(lim) => { setUserLimit(lim); setUserPage(1); fetchUsers(1, userSearch, lim); }}
            />
        </div>
    );
}

/* ─────────────── Sortable Column Header ─────────────── */
type SortDir = "asc" | "desc" | null;
function SortableHeader({ label, sortKey, currentSort, currentDir, onSort, className }: {
    label: string; sortKey: string; currentSort: string; currentDir: SortDir;
    onSort: (key: string, dir: SortDir) => void; className?: string;
}) {
    const active = currentSort === sortKey;
    const next = (): SortDir => !active ? "asc" : currentDir === "asc" ? "desc" : null;
    return (
        <th className={`py-2 px-3 font-semibold select-none cursor-pointer hover:bg-slate-100/60 transition-colors ${className || "text-left text-slate-600"}`}
            onClick={() => onSort(sortKey, next())}>
            <span className="inline-flex items-center gap-1">
                {label}
                {active && currentDir === "asc" && <ChevronUp className="w-3 h-3 text-indigo-600" />}
                {active && currentDir === "desc" && <ChevronDown className="w-3 h-3 text-indigo-600" />}
                {!active && <ChevronDown className="w-3 h-3 text-slate-300" />}
            </span>
        </th>
    );
}

/* ─────────────── Generic client-side sort helper ─────────────── */
function sortData<T>(data: T[], key: string, dir: SortDir): T[] {
    if (!dir || !key) return data;
    return [...data].sort((a: any, b: any) => {
        const av = a[key] ?? "";
        const bv = b[key] ?? "";
        if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
        return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
}

/* ─────────────── Column Filter Dropdown ─────────────── */
function ColumnFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false);
    const [filterText, setFilterText] = useState("");
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);
    const filtered = filterText ? options.filter(o => o.toLowerCase().includes(filterText.toLowerCase())) : options;
    return (
        <div ref={ref} className="relative inline-flex items-center gap-1">
            <span>{label}</span>
            <button onClick={() => { setOpen(!open); setFilterText(""); }} className={`p-0.5 rounded ${value ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                <ChevronDown className="w-3 h-3" />
            </button>
            {open && (
                <div className="absolute top-full left-0 z-50 mt-1 w-48 max-h-60 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden animate-in fade-in duration-150">
                    <div className="p-1.5 border-b border-slate-100">
                        <input autoFocus value={filterText} onChange={e => setFilterText(e.target.value)} placeholder="Search..." className="w-full px-2 py-1 text-xs border border-slate-200 rounded" />
                    </div>
                    <div className="max-h-44 overflow-y-auto">
                        <button onClick={() => { onChange(""); setOpen(false); }} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${!value ? 'text-indigo-600 font-medium' : 'text-slate-500'}`}>
                            All
                        </button>
                        {filtered.map(opt => (
                            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 truncate ${value === opt ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-slate-700'}`}>
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─────────────── Advanced Pagination ─────────────── */
function PaginationControls({ page, totalPages, total, limit, onPageChange, onLimitChange }: {
    page: number; totalPages: number; total: number; limit: number;
    onPageChange: (pg: number) => void; onLimitChange: (lim: number) => void;
}) {
    const start = total === 0 ? 0 : (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    // Generate page buttons: show first, last, and nearby pages
    const pageButtons: (number | '...')[] = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pageButtons.push(i);
    } else {
        pageButtons.push(1);
        if (page > 3) pageButtons.push('...');
        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pageButtons.push(i);
        if (page < totalPages - 2) pageButtons.push('...');
        pageButtons.push(totalPages);
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-2">
            <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                    {total === 0 ? 'No results' : `${start}–${end} of ${total}`}
                </span>
                <select value={limit} onChange={e => onLimitChange(Number(e.target.value))}
                    className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-600">
                    {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
                </select>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center gap-1">
                    <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}
                        className="px-2 py-1 text-xs border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    {pageButtons.map((btn, idx) =>
                        btn === '...' ? (
                            <span key={`dots-${idx}`} className="px-1.5 text-xs text-slate-400">…</span>
                        ) : (
                            <button key={btn} onClick={() => onPageChange(btn as number)}
                                className={`px-2.5 py-1 text-xs rounded border ${page === btn ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}>
                                {btn}
                            </button>
                        )
                    )}
                    <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
                        className="px-2 py-1 text-xs border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
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

    // Search and sort
    const [roleSearch, setRoleSearch] = useState("");
    const [roleSortKey, setRoleSortKey] = useState("name");
    const [roleSortDir, setRoleSortDir] = useState<SortDir>("asc");
    const handleRoleSort = (key: string, dir: SortDir) => { setRoleSortKey(dir ? key : "name"); setRoleSortDir(dir); };

    // Form state
    const [formName, setFormName] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formPermissions, setFormPermissions] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    // Expand/Collapse state for role user list
    const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);

    // All users list (for "add user" dropdown)
    const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([]);
    const [addUserSearch, setAddUserSearch] = useState("");
    const [showAddUserDropdown, setShowAddUserDropdown] = useState(false);

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

    // Fetch all users once for the add-user dropdown
    useEffect(() => {
        (async () => {
            try {
                const users = await apiClient<{ id: string; name: string; email: string }[]>("/api/admin/users");
                setAllUsers(users.map((u: any) => ({ id: u.id, name: u.name, email: u.email })));
            } catch { /* ignore */ }
        })();
    }, []);

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

    const handleAddUser = async (roleId: string, userId: string) => {
        try {
            await apiClient(`/api/admin/roles/${roleId}/users`, {
                method: "POST",
                body: JSON.stringify({ userId }),
            });
            setShowAddUserDropdown(false);
            setAddUserSearch("");
            fetchRoles();
            setStatus({ type: "success", message: "User added to role." });
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to add user." });
        }
    };

    const handleRemoveUser = async (roleId: string, userId: string) => {
        try {
            await apiClient(`/api/admin/roles/${roleId}/users/${userId}`, { method: "DELETE" });
            fetchRoles();
            setStatus({ type: "success", message: "User removed from role." });
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to remove user." });
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

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search roles..."
                    className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                />
            </div>

            {/* Roles list */}
            <div className="grid grid-cols-1 gap-3">
                {sortData(roles.filter(r => !roleSearch || r.name.toLowerCase().includes(roleSearch.toLowerCase()) || (r.description || '').toLowerCase().includes(roleSearch.toLowerCase())), roleSortKey, roleSortDir).map((role) => {
                    const isExpanded = expandedRoleId === role.id;
                    const roleUsers = role.users || [];
                    const assignedUserIds = new Set(roleUsers.map(u => u.id));
                    const availableUsers = allUsers.filter(u => !assignedUserIds.has(u.id) && (
                        !addUserSearch || u.name.toLowerCase().includes(addUserSearch.toLowerCase()) || u.email.toLowerCase().includes(addUserSearch.toLowerCase())
                    ));

                    return (
                    <div key={role.id} className="bg-white rounded-lg border border-slate-200 hover:shadow-sm transition-shadow">
                        <div className="p-3 flex items-center justify-between">
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setExpandedRoleId(isExpanded ? null : role.id); setShowAddUserDropdown(false); setAddUserSearch(""); }}>
                                <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                    <span className="font-semibold text-slate-800">{role.name}</span>
                                    {role.isSystem && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">SYSTEM</span>}
                                    <span className="text-xs text-slate-400">{role.userCount} user{role.userCount !== 1 ? "s" : ""}</span>
                                </div>
                                {role.description && <p className="text-xs text-slate-500 mt-0.5 ml-6">{role.description}</p>}
                                <div className="flex flex-wrap gap-1 mt-2 ml-6">
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

                        {/* Expanded user list */}
                        {isExpanded && (
                            <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                                <div className="flex items-center justify-between mb-2">
                                    <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5" /> Assigned Users ({roleUsers.length})
                                    </h5>
                                    <div className="relative">
                                        <button onClick={() => setShowAddUserDropdown(!showAddUserDropdown)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
                                            <UserPlus className="w-3.5 h-3.5" /> Add User
                                        </button>
                                        {showAddUserDropdown && (
                                            <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-lg shadow-lg w-72 max-h-60 overflow-hidden">
                                                <div className="p-2 border-b border-slate-100">
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search users..."
                                                            value={addUserSearch}
                                                            onChange={(e) => setAddUserSearch(e.target.value)}
                                                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                            autoFocus
                                                        />
                                                    </div>
                                                </div>
                                                <div className="max-h-44 overflow-y-auto">
                                                    {availableUsers.length === 0 ? (
                                                        <p className="text-xs text-slate-400 text-center py-3">No users available</p>
                                                    ) : availableUsers.slice(0, 20).map(u => (
                                                        <button
                                                            key={u.id}
                                                            onClick={() => handleAddUser(role.id, u.id)}
                                                            className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 flex items-center justify-between"
                                                        >
                                                            <div>
                                                                <span className="font-medium text-slate-700">{u.name}</span>
                                                                <span className="text-slate-400 ml-2">{u.email}</span>
                                                            </div>
                                                            <Plus className="w-3.5 h-3.5 text-indigo-500" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {roleUsers.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-2">No users assigned to this role.</p>
                                ) : (
                                    <div className="space-y-1">
                                        {roleUsers.map(u => (
                                            <div key={u.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-md px-3 py-1.5 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                                                        {u.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-slate-700">{u.name}</span>
                                                    <span className="text-slate-400">{u.email}</span>
                                                </div>
                                                <button onClick={() => handleRemoveUser(role.id, u.id)} className="text-slate-400 hover:text-red-600 transition-colors" title="Remove user">
                                                    <UserMinus className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    );
                })}
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

    // Sort
    const [rcSortKey, setRcSortKey] = useState("");
    const [rcSortDir, setRcSortDir] = useState<SortDir>(null);
    const handleRcSort = (key: string, dir: SortDir) => { setRcSortKey(dir ? key : ""); setRcSortDir(dir); };
    const sortedRateCards = sortData(rateCards, rcSortKey, rcSortDir);

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
                            <label className="block text-xs font-medium text-slate-700 mb-1">Master CTC (Base Curr.)</label>
                            <input type="number" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" placeholder="0" value={formData.masterCtc} onChange={(e) => setFormData({ ...formData, masterCtc: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Mercer CTC (Base Curr.)</label>
                            <input type="number" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" placeholder="0" value={formData.mercerCtc} onChange={(e) => setFormData({ ...formData, mercerCtc: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Copilot (Base Curr.)</label>
                            <input type="number" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" placeholder="0" value={formData.copilot} onChange={(e) => setFormData({ ...formData, copilot: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Existing CTC (Base Curr.)</label>
                            <input type="number" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" placeholder="0" value={formData.existingCtc} onChange={(e) => setFormData({ ...formData, existingCtc: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Max CTC (Base Curr.)</label>
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
                                <SortableHeader label="Skill" sortKey="skill" currentSort={rcSortKey} currentDir={rcSortDir} onSort={handleRcSort} className="text-left px-3 text-slate-600" />
                                <SortableHeader label="Experience Band" sortKey="experienceBand" currentSort={rcSortKey} currentDir={rcSortDir} onSort={handleRcSort} className="text-left px-3 text-slate-600" />
                                <SortableHeader label="Master CTC" sortKey="masterCtc" currentSort={rcSortKey} currentDir={rcSortDir} onSort={handleRcSort} className="text-right px-3 text-slate-600" />
                                <SortableHeader label="Mercer CTC" sortKey="mercerCtc" currentSort={rcSortKey} currentDir={rcSortDir} onSort={handleRcSort} className="text-right px-3 text-slate-600" />
                                <SortableHeader label="Copilot" sortKey="copilot" currentSort={rcSortKey} currentDir={rcSortDir} onSort={handleRcSort} className="text-right px-3 text-slate-600" />
                                <SortableHeader label="Existing CTC" sortKey="existingCtc" currentSort={rcSortKey} currentDir={rcSortDir} onSort={handleRcSort} className="text-right px-3 text-slate-600" />
                                <SortableHeader label="Max" sortKey="maxCtc" currentSort={rcSortKey} currentDir={rcSortDir} onSort={handleRcSort} className="text-right px-3 text-slate-600" />
                                <th className="text-right px-3 py-2 font-medium text-slate-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedRateCards.map((rc, idx) => (
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
    autoSaveIntervalMinutes: number;
    minGomPercent: number;
    gomAutoApprovePercent: number;
    defaultCurrency: string;
    supportedCurrencies: string;
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
    autoSaveIntervalMinutes: 2,
    minGomPercent: 20,
    gomAutoApprovePercent: 0,
    defaultCurrency: "INR",
    supportedCurrencies: "INR,USD,EUR,GBP,AED,SGD",
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
        const numericFields = ['marginPercent', 'workingDaysPerYear', 'deliveryMgmtPercent', 'benchPercent', 'leaveEligibilityPercent', 'annualGrowthBufferPercent', 'averageIncrementPercent', 'bonusPercent', 'indirectCostPercent', 'welfarePerFte', 'trainingPerFte', 'autoSaveIntervalMinutes', 'minGomPercent', 'gomAutoApprovePercent'];
        if (numericFields.includes(name)) {
            setData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
        } else {
            setData(prev => ({ ...prev, [name]: value }));
        }
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

                <div className="mt-6 border-t border-slate-200 pt-4">
                    <h3 className="font-semibold text-sm text-slate-800 mb-3">Application Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
                        <InputField label="Auto-Save Interval (minutes)" name="autoSaveIntervalMinutes" desc="How often opportunity forms auto-save (0 = disabled)." />
                        <InputField label="Min GOM % for Sales Submission" name="minGomPercent" desc="Presales cannot submit to Sales unless GOM meets this % (0 = no check)." />
                        <InputField label="GOM Auto-Approve Above %" name="gomAutoApprovePercent" desc="Auto-approve GOM when GOM % is at or above this threshold (0 = manual only)." />
                    </div>
                </div>

                <div className="mt-6 border-t border-slate-200 pt-4">
                    <h3 className="font-semibold text-sm text-slate-800 mb-3">Currency Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
                        <div className="grid gap-1">
                            <label className="text-xs font-medium text-slate-700">Default Currency</label>
                            <select
                                value={data.defaultCurrency || 'INR'}
                                onChange={(e) => handleChange('defaultCurrency', e.target.value)}
                                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {(data.supportedCurrencies || 'INR,USD,EUR,GBP,AED,SGD').split(',').map(c => (
                                    <option key={c.trim()} value={c.trim()}>{c.trim()}</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500">Default currency used across the application.</p>
                        </div>
                        <div className="grid gap-1">
                            <label className="text-xs font-medium text-slate-700">Supported Currencies</label>
                            <input
                                type="text"
                                value={data.supportedCurrencies || 'INR,USD,EUR,GBP,AED,SGD'}
                                onChange={(e) => handleChange('supportedCurrencies', e.target.value)}
                                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <p className="text-xs text-slate-500">Comma-separated list of supported currency codes.</p>
                        </div>
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
    const [alSortKey, setAlSortKey] = useState(""); const [alSortDir, setAlSortDir] = useState<SortDir>(null);
    const handleAlSort = (key: string, dir: SortDir) => { setAlSortKey(dir ? key : ""); setAlSortDir(dir); };
    const sortedLogs = sortData(logs, alSortKey, alSortDir);

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
                                <SortableHeader label="Timestamp" sortKey="timestamp" currentSort={alSortKey} currentDir={alSortDir} onSort={handleAlSort} className="text-left px-3 text-slate-600" />
                                <th className="text-left px-3 py-2 font-semibold text-slate-600">User</th>
                                <SortableHeader label="Entity" sortKey="entity" currentSort={alSortKey} currentDir={alSortDir} onSort={handleAlSort} className="text-left px-3 text-slate-600" />
                                <SortableHeader label="Action" sortKey="action" currentSort={alSortKey} currentDir={alSortDir} onSort={handleAlSort} className="text-left px-3 text-slate-600" />
                                <th className="text-left px-3 py-2 font-semibold text-slate-600">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedLogs.map(log => (
                                <React.Fragment key={log.id}>
                                    <tr
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
                                        <tr className="bg-slate-50/50">
                                            <td colSpan={5} className="px-4 py-3">
                                                <div className="space-y-1">
                                                    <div className="text-xs text-slate-400">Entity ID: {log.entityId}</div>
                                                    {renderChanges(log.changes)}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
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
    const [showInactive, setShowInactive] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [mdSortKey, setMdSortKey] = useState("name");
    const [mdSortDir, setMdSortDir] = useState<SortDir>("asc");
    const handleMdSort = (key: string, dir: SortDir) => { setMdSortKey(dir ? key : "name"); setMdSortDir(dir); };

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

    // Filter: show only active items by default, toggle to see all; also apply search
    const filteredItems = (showInactive ? items : items.filter(i => i.isActive !== false))
        .filter(i => !searchTerm || i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const displayItems = sortData(filteredItems, mdSortKey, mdSortDir);

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
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5" />
                        Show history
                    </label>
                    {!showCreate && !editingId && (
                        <button onClick={() => { resetForm(); setShowCreate(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Add {label}
                        </button>
                    )}
                </div>
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

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder={`Search ${label.toLowerCase()}s...`}
                    className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <SortableHeader label="Name" sortKey="name" currentSort={mdSortKey} currentDir={mdSortDir} onSort={handleMdSort} className="text-left px-3 text-slate-600" />
                                <th className="text-right px-3 py-2 font-medium text-slate-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {displayItems.map(item => (
                                <tr key={item.id} className={`hover:bg-slate-50/50 ${item.isActive === false ? 'opacity-50' : ''}`}>
                                    <td className="px-3 py-2 font-medium text-slate-800">
                                        {item.name}
                                        {item.isActive === false && (
                                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 border border-slate-200">inactive</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {item.isActive !== false && (
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {displayItems.length === 0 && <div className="text-center py-8 text-slate-400">No {label.toLowerCase()}s found.</div>}
            </div>
        </div>
    );
}

/* ─────────────── GOM Calculator Tab ─────────────── */
function GomCalculatorTab() {
    const { currency, setCurrency, symbol: cSym, currencies, getRate } = useCurrency();
    const exchangeRate = getRate(currency) || 1;

    const [annualCTC, setAnnualCTC] = useState<number>(1200000);
    const [deliveryMgmt, setDeliveryMgmt] = useState<number>(5);
    const [benchCost, setBenchCost] = useState<number>(10);
    const [onsiteAllowance, setOnsiteAllowance] = useState<number>(2802);
    const [markupPercent, setMarkupPercent] = useState<number>(0);
    const [targetRevenue, setTargetRevenue] = useState<number>(0);
    const [calcMode, setCalcMode] = useState<'markup' | 'revenue'>('markup');
    const [adjustedCost, setAdjustedCost] = useState<number>(0);
    const [offshoreDayRate, setOffshoreDayRate] = useState<number>(0);
    const [onsiteDayRate, setOnsiteDayRate] = useState<number>(0);
    const [durationMonths, setDurationMonths] = useState<number>(3);
    const [workingDays, setWorkingDays] = useState<number>(55);

    const perDiemUSD = 50;
    const perDiemRate = 85;

    useEffect(() => {
        const loadingFactor = (deliveryMgmt + benchCost) / 100;
        const adjCost = annualCTC * (1 + loadingFactor);
        setAdjustedCost(adjCost);
        const ctcInQuot = adjCost / exchangeRate;
        const offDay = Math.ceil(ctcInQuot / 220);
        setOffshoreDayRate(offDay);
        const perDiemTotal = perDiemUSD * perDiemRate;
        setOnsiteDayRate(offDay + perDiemTotal + onsiteAllowance);
    }, [annualCTC, deliveryMgmt, benchCost, exchangeRate, onsiteAllowance]);

    const calculateMargin = (cost: number) => {
        let rev = 0, gom = 0, profit = 0;
        if (calcMode === 'markup') { rev = cost * (1 + markupPercent / 100); } else { rev = targetRevenue; }
        if (rev > 0) { gom = ((rev - cost) / rev) * 100; profit = (markupPercent / (1 + markupPercent / 100)) * 100; }
        return { revenue: rev, gom, profit };
    };

    const offshoreFinancials = calculateMargin(offshoreDayRate);
    const onsiteFinancials = calculateMargin(onsiteDayRate);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Calculator className="w-5 h-5 text-indigo-600" /> GOM Calculator</h2>
                    <p className="text-slate-500 text-sm mt-0.5">Resource effort estimation and cost calculation.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Inputs Column */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-indigo-600" /> Cost Inputs
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Annual CTC ({cSym})</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">{cSym}</span>
                                    <input type="number" value={annualCTC} onChange={(e) => setAnnualCTC(Number(e.target.value))} className="w-full pl-10 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Delivery Mgmt (%)</label>
                                    <input type="number" value={deliveryMgmt} onChange={(e) => setDeliveryMgmt(Number(e.target.value))} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Addl. Bench (%)</label>
                                    <input type="number" value={benchCost} onChange={(e) => setBenchCost(Number(e.target.value))} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Currency & Exchange Rate</label>
                                <div className="flex gap-2">
                                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none">
                                        {currencies.map((c: any) => (<option key={c.code} value={c.code}>{c.symbol} {c.code}</option>))}
                                    </select>
                                    <input type="number" value={exchangeRate} readOnly className="flex-1 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-sm outline-none cursor-not-allowed" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Onsite Allowance / Loading</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">+</span>
                                    <input type="number" value={onsiteAllowance} onChange={(e) => setOnsiteAllowance(Number(e.target.value))} className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500" />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Adjust to match Base+PerDiem difference</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-emerald-600" /> Margin & Markup
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Markup Percentage (%)</label>
                                <div className="relative">
                                    <Percent className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <input type="number" value={markupPercent} onChange={(e) => { setMarkupPercent(Number(e.target.value)); setCalcMode('markup'); }} className="w-full pl-10 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500" />
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Example: 900%</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-600" /> Period Estimation
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Duration (Months)</label>
                                <input type="number" value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Working Days</label>
                                <input type="number" value={workingDays} onChange={(e) => setWorkingDays(Number(e.target.value))} className={`w-full px-3 py-1.5 bg-slate-50 border rounded-lg text-sm ${workingDays / durationMonths > 22 ? 'border-amber-500 text-amber-700' : 'border-slate-200'}`} />
                            </div>
                        </div>
                        {workingDays / durationMonths > 22 && (
                            <div className="flex items-center gap-2 text-amber-600 text-xs mt-2 bg-amber-50 p-2 rounded">
                                <Info className="w-3 h-3" /><span>Warning: {Math.round(workingDays / durationMonths)} days/month exceeds typical 22 days.</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Results Column */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 text-sm mb-4 border-b border-slate-100 pb-2">Calculation Results</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm text-indigo-600 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Offshore</h4>
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <p className="text-xs text-slate-500 mb-0.5">Cost Per Day</p>
                                    <p className="text-lg font-bold text-slate-800">{offshoreDayRate.toLocaleString()} <span className="text-xs font-normal text-slate-400">{currency}</span></p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-500">Revenue/Day</p><p className="font-semibold text-slate-700">{Math.round(offshoreFinancials.revenue).toLocaleString()}</p></div>
                                    <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-500">GOM %</p><p className="font-semibold text-emerald-600">{offshoreFinancials.gom.toFixed(1)}%</p></div>
                                </div>
                                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                                    <p className="text-xs text-amber-700 font-medium">Est. Cost ({workingDays} days)</p>
                                    <p className="text-base font-bold text-amber-800">{(offshoreDayRate * workingDays).toLocaleString()} {currency}</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm text-purple-600 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500" /> Onsite</h4>
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <p className="text-xs text-slate-500 mb-0.5">Cost Per Day</p>
                                    <p className="text-lg font-bold text-slate-800">{onsiteDayRate.toLocaleString()} <span className="text-xs font-normal text-slate-400">{currency}</span></p>
                                    <p className="text-[10px] text-slate-400 mt-1">Includes Per Diem + Allowance</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-500">Revenue/Day</p><p className="font-semibold text-slate-700">{Math.round(onsiteFinancials.revenue).toLocaleString()}</p></div>
                                    <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-500">GOM %</p><p className="font-semibold text-emerald-600">{onsiteFinancials.gom.toFixed(1)}%</p></div>
                                </div>
                                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                                    <p className="text-xs text-amber-700 font-medium">Est. Cost ({workingDays} days)</p>
                                    <p className="text-base font-bold text-amber-800">{(onsiteDayRate * workingDays).toLocaleString()} {currency}</p>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Stats Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-y border-slate-200">
                                    <tr><th className="py-2 px-3">Metric</th><th className="py-2 px-3">Value</th><th className="py-2 px-3">Formula / Notes</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <tr><td className="py-2 px-3 text-slate-800">Adjusted Cost</td><td className="py-2 px-3 font-mono">{adjustedCost.toLocaleString()}</td><td className="py-2 px-3 text-slate-400 text-xs">CTC * (1 + (Mgmt+Bench)/100)</td></tr>
                                    <tr><td className="py-2 px-3 text-slate-800">Annual Working Days</td><td className="py-2 px-3 font-mono">220</td><td className="py-2 px-3 text-slate-400 text-xs">Fixed Standard</td></tr>
                                    <tr><td className="py-2 px-3 text-slate-800">Actual Profit Margin</td><td className="py-2 px-3 font-mono font-bold text-indigo-600">{offshoreFinancials.profit.toLocaleString()}%</td><td className="py-2 px-3 text-slate-400 text-xs">(Markup / (1 + Markup%)) * 100</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─────────────── Email Templates Tab ─────────────── */
interface EmailTemplateData {
    id: string;
    eventKey: string;
    name: string;
    subject: string;
    body: string;
    isActive: boolean;
}

function EmailTemplatesTab() {
    const [templates, setTemplates] = useState<EmailTemplateData[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: "", subject: "", body: "", isActive: true });
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [testEmail, setTestEmail] = useState("");
    const [sendingTest, setSendingTest] = useState(false);
    const [etSortKey, setEtSortKey] = useState(""); const [etSortDir, setEtSortDir] = useState<SortDir>(null);
    const handleEtSort = (key: string, dir: SortDir) => { setEtSortKey(dir ? key : ""); setEtSortDir(dir); };
    const sortedTemplates = sortData(templates, etSortKey, etSortDir);

    const fetchTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiClient("/api/admin/email-templates");
            setTemplates(data);
        } catch {
            setStatus({ type: "error", message: "Failed to load email templates." });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    const openEdit = (t: EmailTemplateData) => {
        setEditingId(t.id);
        setForm({ name: t.name, subject: t.subject, body: t.body, isActive: t.isActive });
        setStatus(null);
    };

    const handleSave = async () => {
        if (!editingId) return;
        setSaving(true);
        setStatus(null);
        try {
            await apiClient(`/api/admin/email-templates/${editingId}`, {
                method: "PATCH",
                body: JSON.stringify(form),
            });
            setStatus({ type: "success", message: "Template saved." });
            setEditingId(null);
            fetchTemplates();
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to save." });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (t: EmailTemplateData) => {
        try {
            await apiClient(`/api/admin/email-templates/${t.id}`, {
                method: "PATCH",
                body: JSON.stringify({ isActive: !t.isActive }),
            });
            fetchTemplates();
        } catch {
            setStatus({ type: "error", message: "Failed to toggle template." });
        }
    };

    const handleSendTest = async (templateId: string) => {
        if (!testEmail.trim()) {
            setStatus({ type: "error", message: "Enter a test email address." });
            return;
        }
        setSendingTest(true);
        setStatus(null);
        try {
            const result = await apiClient("/api/admin/email-templates/test", {
                method: "POST",
                body: JSON.stringify({ templateId, recipientEmail: testEmail }),
            });
            setStatus({ type: result.success ? "success" : "error", message: result.message });
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Failed to send test email." });
        } finally {
            setSendingTest(false);
        }
    };

    const PLACEHOLDER_HELP = "Available: {{opportunityTitle}}, {{clientName}}, {{stageName}}, {{previousStage}}, {{salesRepName}}, {{managerName}}, {{updatedBy}}, {{comment}}, {{recipientName}}";

    if (loading) return <div className="text-center py-12 text-slate-400">Loading email templates...</div>;

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-base font-bold text-slate-900">Email Notification Templates</h3>
                <p className="text-xs text-slate-500 mt-0.5">Configure email notifications sent when opportunities change stage.</p>
            </div>

            {status && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {status.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {status.message}
                </div>
            )}

            {editingId && (
                <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-slate-800">Edit Template</h4>
                        <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Display Name</label>
                        <input className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                        <input className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Body (HTML)</label>
                        <textarea rows={8} className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-mono" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                    </div>
                    <p className="text-[11px] text-slate-400">{PLACEHOLDER_HELP}</p>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                            <button type="button" onClick={() => setForm({ ...form, isActive: !form.isActive })} className="text-slate-400 hover:text-indigo-600">
                                {form.isActive ? <ToggleRight className="w-5 h-5 text-indigo-600" /> : <ToggleLeft className="w-5 h-5" />}
                            </button>
                            {form.isActive ? "Active" : "Disabled"}
                        </label>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <input
                            type="email"
                            placeholder="Test email address"
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                        />
                        <button
                            onClick={() => handleSendTest(editingId)}
                            disabled={sendingTest}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            <Send className="w-3.5 h-3.5" /> {sendingTest ? "Sending..." : "Send Test"}
                        </button>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button disabled={saving} onClick={handleSave} className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
                            {saving ? "Saving..." : "Save Template"}
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <SortableHeader label="Event" sortKey="eventKey" currentSort={etSortKey} currentDir={etSortDir} onSort={handleEtSort} className="text-left px-3 text-slate-600" />
                            <SortableHeader label="Name" sortKey="name" currentSort={etSortKey} currentDir={etSortDir} onSort={handleEtSort} className="text-left px-3 text-slate-600" />
                            <SortableHeader label="Subject" sortKey="subject" currentSort={etSortKey} currentDir={etSortDir} onSort={handleEtSort} className="text-left px-3 text-slate-600" />
                            <th className="text-center px-3 py-2 font-medium text-slate-600">Active</th>
                            <th className="text-right px-3 py-2 font-medium text-slate-600">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedTemplates.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-mono text-indigo-600">{t.eventKey}</td>
                                <td className="px-3 py-2 text-slate-800 font-medium">{t.name}</td>
                                <td className="px-3 py-2 text-slate-600 truncate max-w-[200px]">{t.subject}</td>
                                <td className="px-3 py-2 text-center">
                                    <button onClick={() => handleToggleActive(t)} className="text-slate-400 hover:text-indigo-600">
                                        {t.isActive ? <ToggleRight className="w-5 h-5 text-indigo-600 inline" /> : <ToggleLeft className="w-5 h-5 inline" />}
                                    </button>
                                </td>
                                <td className="px-3 py-2 text-right">
                                    <button onClick={() => openEdit(t)} className="p-1.5 text-slate-400 hover:text-indigo-600" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {templates.length === 0 && <div className="text-center py-8 text-slate-400">No email templates configured. Run the seed script to create default templates.</div>}
            </div>
        </div>
    );
}

/* ─────────────── Currency Rates Tab ─────────────── */
interface CurrencyRateRow {
    id: string;
    code: string;
    name: string;
    symbol: string;
    region: string;
    rateToBase: number;
    baseCurrency: string;
    isActive: boolean;
    lastSynced: string | null;
}

function CurrencyRatesTab() {
    const [rates, setRates] = useState<CurrencyRateRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [editId, setEditId] = useState<string | null>(null);
    const [editRate, setEditRate] = useState("");
    const [addOpen, setAddOpen] = useState(false);
    const [addForm, setAddForm] = useState({ code: "", name: "", symbol: "", region: "", rateToBase: "1" });
    const [filterRegion, setFilterRegion] = useState("all");

    const fetchRates = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiClient<CurrencyRateRow[]>("/api/admin/currency-rates");
            setRates(data);
        } catch { setStatus({ type: "error", message: "Failed to load currency rates." }); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchRates(); }, [fetchRates]);

    const handleSync = async () => {
        setSyncing(true);
        setStatus(null);
        try {
            const result = await apiClient<{ synced: number; lastSynced: string }>("/api/admin/currency-rates/sync", { method: "POST" });
            setStatus({ type: "success", message: `Synced ${result.synced} rates from open.er-api.com.` });
            fetchRates();
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Sync failed." });
        } finally { setSyncing(false); }
    };

    const handleSeed = async () => {
        setSeeding(true);
        setStatus(null);
        try {
            const result = await apiClient<{ message: string }>("/api/admin/currency-rates/seed", { method: "POST" });
            setStatus({ type: "success", message: result.message });
            fetchRates();
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Seed failed." });
        } finally { setSeeding(false); }
    };

    const handleToggle = async (id: string) => {
        try {
            await apiClient(`/api/admin/currency-rates/${id}/toggle`, { method: "PATCH" });
            fetchRates();
        } catch { setStatus({ type: "error", message: "Toggle failed." }); }
    };

    const handleSaveRate = async (id: string) => {
        const val = parseFloat(editRate);
        if (isNaN(val) || val <= 0) { setStatus({ type: "error", message: "Rate must be a positive number." }); return; }
        try {
            await apiClient(`/api/admin/currency-rates/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ rateToBase: val }),
            });
            setEditId(null);
            fetchRates();
        } catch { setStatus({ type: "error", message: "Update failed." }); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this currency?")) return;
        try {
            await apiClient(`/api/admin/currency-rates/${id}`, { method: "DELETE" });
            fetchRates();
        } catch { setStatus({ type: "error", message: "Delete failed." }); }
    };

    const handleAdd = async () => {
        if (!addForm.code || !addForm.name || !addForm.symbol || !addForm.region) {
            setStatus({ type: "error", message: "All fields are required." }); return;
        }
        try {
            await apiClient("/api/admin/currency-rates", {
                method: "POST",
                body: JSON.stringify({
                    ...addForm,
                    code: addForm.code.toUpperCase(),
                    rateToBase: parseFloat(addForm.rateToBase) || 1,
                }),
            });
            setAddOpen(false);
            setAddForm({ code: "", name: "", symbol: "", region: "", rateToBase: "1" });
            fetchRates();
        } catch (err: any) {
            setStatus({ type: "error", message: err.message || "Add failed." });
        }
    };

    const regions = [...new Set(rates.map(r => r.region))].sort();
    const [crSortKey, setCrSortKey] = useState(""); const [crSortDir, setCrSortDir] = useState<SortDir>(null);
    const handleCrSort = (key: string, dir: SortDir) => { setCrSortKey(dir ? key : ""); setCrSortDir(dir); };
    const filteredBase = filterRegion === "all" ? rates : rates.filter(r => r.region === filterRegion);
    const filtered = sortData(filteredBase, crSortKey, crSortDir);

    if (loading) return <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-indigo-500" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Currency Conversion Master</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Manage exchange rates relative to base currency (INR). Sync live rates from open.er-api.com.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSeed} disabled={seeding} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                        {seeding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Seed Missing
                    </button>
                    <button onClick={handleSync} disabled={syncing} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                        {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Sync Live Rates
                    </button>
                    <button onClick={() => setAddOpen(!addOpen)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                        <Plus className="w-3.5 h-3.5" /> Add Currency
                    </button>
                </div>
            </div>

            {status && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${status.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {status.type === "success" ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {status.message}
                    <button onClick={() => setStatus(null)} className="ml-auto text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
                </div>
            )}

            {/* Add currency form */}
            {addOpen && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700">Add New Currency</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div>
                            <label className="text-xs text-slate-500">Code</label>
                            <input value={addForm.code} onChange={e => setAddForm(p => ({ ...p, code: e.target.value }))} placeholder="USD" maxLength={3} className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-md border border-slate-200 focus:ring-1 focus:ring-indigo-400 uppercase" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500">Name</label>
                            <input value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} placeholder="US Dollar" className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-md border border-slate-200 focus:ring-1 focus:ring-indigo-400" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500">Symbol</label>
                            <input value={addForm.symbol} onChange={e => setAddForm(p => ({ ...p, symbol: e.target.value }))} placeholder="$" className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-md border border-slate-200 focus:ring-1 focus:ring-indigo-400" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500">Region</label>
                            <input value={addForm.region} onChange={e => setAddForm(p => ({ ...p, region: e.target.value }))} placeholder="North America" className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-md border border-slate-200 focus:ring-1 focus:ring-indigo-400" />
                        </div>
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <label className="text-xs text-slate-500">Rate to INR</label>
                                <input value={addForm.rateToBase} onChange={e => setAddForm(p => ({ ...p, rateToBase: e.target.value }))} type="number" step="0.0001" className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-md border border-slate-200 focus:ring-1 focus:ring-indigo-400" />
                            </div>
                            <button onClick={handleAdd} className="px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter by region */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Filter:</span>
                <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} className="text-xs border border-slate-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-indigo-400">
                    <option value="all">All Regions</option>
                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <span className="text-xs text-slate-400 ml-auto">{filtered.length} currencies</span>
            </div>

            {/* Rates table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <SortableHeader label="Code" sortKey="code" currentSort={crSortKey} currentDir={crSortDir} onSort={handleCrSort} className="text-left px-3 text-slate-600" />
                            <SortableHeader label="Currency" sortKey="name" currentSort={crSortKey} currentDir={crSortDir} onSort={handleCrSort} className="text-left px-3 text-slate-600" />
                            <th className="text-left px-3 py-2 font-medium text-slate-600">Symbol</th>
                            <SortableHeader label="Region" sortKey="region" currentSort={crSortKey} currentDir={crSortDir} onSort={handleCrSort} className="text-left px-3 text-slate-600" />
                            <SortableHeader label="Rate (1 INR =)" sortKey="rateToBase" currentSort={crSortKey} currentDir={crSortDir} onSort={handleCrSort} className="text-right px-3 text-slate-600" />
                            <th className="text-center px-3 py-2 font-medium text-slate-600">Active</th>
                            <SortableHeader label="Last Synced" sortKey="lastSynced" currentSort={crSortKey} currentDir={crSortDir} onSort={handleCrSort} className="text-left px-3 text-slate-600" />
                            <th className="text-right px-3 py-2 font-medium text-slate-600">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.map(rate => (
                            <tr key={rate.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-mono font-bold text-indigo-600">{rate.code}</td>
                                <td className="px-3 py-2 text-slate-700">{rate.name}</td>
                                <td className="px-3 py-2 text-slate-500">{rate.symbol}</td>
                                <td className="px-3 py-2 text-slate-500">{rate.region}</td>
                                <td className="px-3 py-2 text-right font-mono text-slate-700">
                                    {editId === rate.id ? (
                                        <div className="flex items-center justify-end gap-1">
                                            <input value={editRate} onChange={e => setEditRate(e.target.value)} type="number" step="0.0001" className="w-24 px-1.5 py-0.5 text-xs rounded border border-indigo-300 text-right" autoFocus />
                                            <button onClick={() => handleSaveRate(rate.id)} className="p-0.5 text-emerald-600 hover:text-emerald-800"><Check className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => setEditId(null)} className="p-0.5 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                                        </div>
                                    ) : (
                                        <span className="cursor-pointer hover:text-indigo-600" onClick={() => { setEditId(rate.id); setEditRate(String(rate.rateToBase)); }}>{rate.rateToBase.toFixed(4)}</span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                    <button onClick={() => handleToggle(rate.id)} className="text-slate-400 hover:text-indigo-600">
                                        {rate.isActive ? <ToggleRight className="w-5 h-5 text-indigo-600 inline" /> : <ToggleLeft className="w-5 h-5 inline" />}
                                    </button>
                                </td>
                                <td className="px-3 py-2 text-slate-400">
                                    {rate.lastSynced ? new Date(rate.lastSynced).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "Never"}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    <button onClick={() => handleDelete(rate.id)} className="p-1 text-slate-400 hover:text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                        No currency rates found. Click &quot;Seed Missing&quot; to auto-populate from regions, then &quot;Sync Live Rates&quot; to fetch current exchange rates.
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─────────────── Auth Configuration Tab ─────────────── */
function AuthConfigTab() {
    const [config, setConfig] = useState<{ mode: string; ssoDomain: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [mode, setMode] = useState("sso");
    const [ssoDomain, setSsoDomain] = useState("@qbadvisory.com");
    const [msg, setMsg] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiClient<any>("/api/admin/auth-config");
            setConfig(data);
            setMode(data.mode || "sso");
            setSsoDomain(data.ssoDomain || "@qbadvisory.com");
        } catch { }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        setSaving(true);
        setMsg("");
        try {
            const res = await apiClient<any>("/api/admin/auth-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode, ssoDomain }),
            });
            setMsg(res.message || "Saved!");
            load();
        } catch (e: any) {
            setMsg(e?.message || "Failed to save");
        }
        setSaving(false);
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Authentication Configuration</h2>
                <p className="text-sm text-slate-500 mt-1">Choose how users authenticate to Q-CRM.</p>
            </div>

            <div className="bg-white border rounded-xl p-6 space-y-5">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Authentication Mode</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { value: "sso", label: "SSO Only", desc: "All domain users authenticate via Microsoft SSO. External users are not allowed." },
                            { value: "local", label: "Local (Password)", desc: "All users use email + password. A default password is auto-assigned; users must change on first login." },
                            { value: "hybrid", label: "Hybrid", desc: "Domain users use SSO. External users (different domain) use local password auth. Admin can add external users." },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setMode(opt.value)}
                                className={`text-left p-4 rounded-lg border-2 transition-all ${mode === opt.value ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300"}`}
                            >
                                <div className="font-medium text-sm">{opt.label}</div>
                                <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {(mode === "sso" || mode === "hybrid") && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">SSO Domain</label>
                        <input
                            type="text"
                            value={ssoDomain}
                            onChange={e => setSsoDomain(e.target.value)}
                            placeholder="@qbadvisory.com"
                            className="w-64 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <p className="text-xs text-slate-400 mt-1">Users with this email domain will authenticate via Microsoft Entra ID (Azure AD).</p>
                    </div>
                )}

                {mode === "local" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                            <div className="text-sm text-amber-800">
                                <strong>Local Mode:</strong> When switching to local mode, all SSO-only users (without a password) will be assigned a
                                default password <code className="bg-amber-100 px-1 rounded">Welcome@CRM1</code> and will be required to change it on first login.
                            </div>
                        </div>
                    </div>
                )}

                {mode === "hybrid" && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                            <div className="text-sm text-blue-800">
                                <strong>Hybrid Mode:</strong> Users with <strong>{ssoDomain}</strong> emails use SSO. External users (any other domain)
                                use password-based login. When adding external users, a default password is auto-assigned and they must change it on first login.
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={save}
                        disabled={saving}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? "Saving..." : "Save Configuration"}
                    </button>
                    {msg && <span className="text-sm text-green-600">{msg}</span>}
                </div>
            </div>

            {config && (
                <div className="bg-slate-50 border rounded-xl p-4">
                    <h3 className="text-sm font-medium text-slate-600 mb-2">Current Configuration</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-slate-500">Mode:</span>
                        <span className="font-medium capitalize">{config.mode}</span>
                        <span className="text-slate-500">SSO Domain:</span>
                        <span className="font-medium">{config.ssoDomain}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─────────────── QPeople Role Mapping Tab ─────────────── */
function QPeopleMappingTab() {
    const [mappings, setMappings] = useState<any[]>([]);
    const [designations, setDesignations] = useState<{designation: string; department: string|null; userCount: number}[]>([]);
    const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [applying, setApplying] = useState(false);
    const [search, setSearch] = useState("");
    const [editRow, setEditRow] = useState<{ designation: string; crmRoleIds: string[]; jobBand: string; department: string } | null>(null);
    const [qpSortKey, setQpSortKey] = useState(""); 
    const [qpSortDir, setQpSortDir] = useState<SortDir>(null);
    const handleQpSort = (key: string) => { if (qpSortKey === key) { setQpSortDir(qpSortDir === "asc" ? "desc" : qpSortDir === "desc" ? null : "asc"); if (qpSortDir === "desc") setQpSortKey(""); } else { setQpSortKey(key); setQpSortDir("asc"); } };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [m, d, r] = await Promise.all([
                apiClient("/api/admin/qpeople-mappings"),
                apiClient("/api/admin/qpeople-mappings/designations"),
                apiClient("/api/admin/roles"),
            ]);
            setMappings(m);
            setDesignations(d);
            const roleList = (r.roles || r || []).map((x: any) => ({ id: x.id, name: x.name }));
            setRoles(roleList);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const mappingMap = new Map(mappings.map((m: any) => [m.qpeopleDesignation, m]));
    const unmappedDesignations = designations.filter(d => !mappingMap.has(d.designation));
    const filtered = sortData(
        search
            ? mappings.filter((m: any) => m.qpeopleDesignation.toLowerCase().includes(search.toLowerCase()) || m.crmRoles?.some((r: any) => r.name?.toLowerCase().includes(search.toLowerCase())))
            : mappings,
        qpSortKey, qpSortDir
    );
    const filteredUnmapped = sortData(
        search
            ? unmappedDesignations.filter(d => d.designation.toLowerCase().includes(search.toLowerCase()))
            : unmappedDesignations,
        qpSortKey === "qpeopleDesignation" ? "designation" : qpSortKey, qpSortDir
    );

    async function handleSave(designation: string, crmRoleIds: string[], jobBand: string, department: string) {
        if (crmRoleIds.length === 0) return;
        setSaving(true);
        try {
            const res = await apiClient<any>("/api/admin/qpeople-mappings", {
                method: "POST",
                body: JSON.stringify({ qpeopleDesignation: designation, crmRoleIds, jobBand: jobBand || null, department: department || null }),
            });
            if (res.applied > 0) {
                alert(`Mapping saved. ${res.applied} user(s) updated automatically.`);
            }
            setEditRow(null);
            await load();
        } catch (e: any) { alert(e.message || "Failed to save"); }
        setSaving(false);
    }

    async function handleDelete(id: string) {
        if (!confirm("Remove this mapping?")) return;
        try {
            await apiClient(`/api/admin/qpeople-mappings/${id}`, { method: "DELETE" });
            await load();
        } catch (e: any) { alert(e.message || "Failed to delete"); }
    }

    async function handleApplyAll() {
        if (!confirm("Apply role mappings to all synced QPeople users? This will assign mapped CRM roles based on their QPeople designation.")) return;
        setApplying(true);
        try {
            const res = await apiClient("/api/admin/qpeople-mappings/apply", { method: "POST" });
            alert(res.message || `Applied to ${res.applied} users`);
        } catch (e: any) { alert(e.message || "Failed to apply"); }
        setApplying(false);
    }

    function toggleEditRole(roleId: string) {
        if (!editRow) return;
        setEditRow({
            ...editRow,
            crmRoleIds: editRow.crmRoleIds.includes(roleId)
                ? editRow.crmRoleIds.filter(id => id !== roleId)
                : [...editRow.crmRoleIds, roleId],
        });
    }

    if (loading) return <div className="flex items-center justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">QPeople Role Mapping</h2>
                    <p className="text-xs text-slate-500">Map QPeople designations to one or more Q-CRM roles. During sync, users are auto-assigned the mapped roles.</p>
                </div>
                <button onClick={handleApplyAll} disabled={applying || mappings.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
                    {applying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Apply Mappings to Users
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search designations or roles..."
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs" />
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-3 text-xs">
                <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">{mappings.length} mapped</span>
                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">{unmappedDesignations.length} unmapped</span>
                <span className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full font-medium">{designations.length} total designations</span>
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{mappings.reduce((s: number, m: any) => s + (m.userCount || 0), 0)} users mapped</span>
                <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">{unmappedDesignations.reduce((s: number, d: any) => s + d.userCount, 0)} users unmapped</span>
            </div>

            {/* Mapped designations table */}
            {filtered.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <SortableHeader label="QPeople Designation" sortKey="qpeopleDesignation" currentSort={qpSortKey} currentDir={qpSortDir} onSort={handleQpSort} className="text-left px-3 text-slate-600" />
                                <SortableHeader label="Department" sortKey="department" currentSort={qpSortKey} currentDir={qpSortDir} onSort={handleQpSort} className="text-left px-3 text-slate-600" />
                                <SortableHeader label="Job Band" sortKey="jobBand" currentSort={qpSortKey} currentDir={qpSortDir} onSort={handleQpSort} className="text-left px-3 text-slate-600" />
                                <th className="text-left py-2 px-3 font-semibold text-slate-600">CRM Roles</th>
                                <SortableHeader label="Users" sortKey="userCount" currentSort={qpSortKey} currentDir={qpSortDir} onSort={handleQpSort} className="text-center px-3 text-slate-600" />
                                <th className="text-right py-2 px-3 font-semibold text-slate-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((m: any) => (
                                <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                    {editRow !== null && editRow.designation === m.qpeopleDesignation ? (
                                        <>
                                            <td className="py-2 px-3 font-medium text-slate-800">{m.qpeopleDesignation}</td>
                                            <td className="py-2 px-3">
                                                <input value={editRow.department} onChange={e => setEditRow({ ...editRow, department: e.target.value })}
                                                    placeholder="e.g. Enterprise Apps" className="w-full px-2 py-1 border border-slate-200 rounded text-xs" />
                                            </td>
                                            <td className="py-2 px-3">
                                                <input value={editRow.jobBand} onChange={e => setEditRow({ ...editRow, jobBand: e.target.value })}
                                                    placeholder="e.g. Band 3" className="w-full px-2 py-1 border border-slate-200 rounded text-xs" />
                                            </td>
                                            <td className="py-2 px-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {roles.map(r => {
                                                        const checked = editRow.crmRoleIds.includes(r.id);
                                                        return (
                                                            <button key={r.id} onClick={() => toggleEditRole(r.id)}
                                                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${checked ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                                                                {checked && <Check className="w-2.5 h-2.5 inline mr-0.5" />}{r.name}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="py-2 px-3 text-center text-slate-500">{m.userCount || 0}</td>
                                            <td className="py-2 px-3 text-right space-x-1">
                                                <button onClick={() => handleSave(editRow.designation, editRow.crmRoleIds, editRow.jobBand, editRow.department)} disabled={saving || editRow.crmRoleIds.length === 0}
                                                    className="p-1 text-green-600 hover:text-green-800 disabled:opacity-30"><Check className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => setEditRow(null)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="py-2 px-3 font-medium text-slate-800">{m.qpeopleDesignation}</td>
                                            <td className="py-2 px-3 text-slate-500">{m.department || "—"}</td>
                                            <td className="py-2 px-3 text-slate-500">{m.jobBand || "—"}</td>
                                            <td className="py-2 px-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {(m.crmRoles || []).map((r: any) => (
                                                        <span key={r.id} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-medium">{r.name}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-2 px-3 text-center text-slate-500">{m.userCount || 0}</td>
                                            <td className="py-2 px-3 text-right space-x-1">
                                                <button onClick={() => setEditRow({ designation: m.qpeopleDesignation, crmRoleIds: m.crmRoleIds || [], jobBand: m.jobBand || "", department: m.department || "" })}
                                                    className="p-1 text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleDelete(m.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Unmapped designations */}
            {filteredUnmapped.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-amber-700 mb-2">Unmapped Designations ({filteredUnmapped.length})</h3>
                    <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30">
                        <table className="w-full text-xs">
                            <thead className="bg-amber-50 border-b border-amber-200">
                            <tr>
                                    <SortableHeader label="QPeople Designation" sortKey="qpeopleDesignation" currentSort={qpSortKey} currentDir={qpSortDir} onSort={handleQpSort} className="text-left px-3 text-amber-700" />
                                    <SortableHeader label="Department" sortKey="department" currentSort={qpSortKey} currentDir={qpSortDir} onSort={handleQpSort} className="text-left px-3 text-amber-700" />
                                    <th className="text-left py-2 px-3 font-semibold text-amber-700">Job Band</th>
                                    <th className="text-left py-2 px-3 font-semibold text-amber-700">Assign CRM Roles</th>
                                    <SortableHeader label="Users" sortKey="userCount" currentSort={qpSortKey} currentDir={qpSortDir} onSort={handleQpSort} className="text-center px-3 text-amber-700" />
                                    <th className="text-right py-2 px-3 font-semibold text-amber-700"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUnmapped.map(d => (
                                    <tr key={d.designation} className="border-b border-amber-100">
                                        {editRow !== null && editRow.designation === d.designation ? (
                                            <>
                                                <td className="py-2 px-3 font-medium text-slate-800">{d.designation}</td>
                                                <td className="py-2 px-3">
                                                    <input value={editRow.department} onChange={e => setEditRow({ ...editRow, department: e.target.value })}
                                                        placeholder="e.g. Enterprise Apps" className="w-full px-2 py-1 border border-slate-200 rounded text-xs" />
                                                </td>
                                                <td className="py-2 px-3">
                                                    <input value={editRow.jobBand} onChange={e => setEditRow({ ...editRow, jobBand: e.target.value })}
                                                        placeholder="e.g. Band 3" className="w-full px-2 py-1 border border-slate-200 rounded text-xs" />
                                                </td>
                                                <td className="py-2 px-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {roles.map(r => {
                                                            const checked = editRow.crmRoleIds.includes(r.id);
                                                            return (
                                                                <button key={r.id} onClick={() => toggleEditRole(r.id)}
                                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${checked ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                                                                    {checked && <Check className="w-2.5 h-2.5 inline mr-0.5" />}{r.name}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="py-2 px-3 text-center text-slate-500">{d.userCount}</td>
                                                <td className="py-2 px-3 text-right space-x-1">
                                                    <button onClick={() => handleSave(editRow.designation, editRow.crmRoleIds, editRow.jobBand, editRow.department)} disabled={saving || editRow.crmRoleIds.length === 0}
                                                        className="p-1 text-green-600 hover:text-green-800 disabled:opacity-30"><Check className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => setEditRow(null)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="py-2 px-3 text-slate-600">{d.designation}</td>
                                                <td className="py-2 px-3 text-slate-400">{d.department || "—"}</td>
                                                <td className="py-2 px-3 text-slate-400">—</td>
                                                <td className="py-2 px-3 text-slate-400">Not mapped</td>
                                                <td className="py-2 px-3 text-center text-slate-500">{d.userCount}</td>
                                                <td className="py-2 px-3 text-right">
                                                    <button onClick={() => setEditRow({ designation: d.designation, crmRoleIds: [], jobBand: "", department: d.department || "" })}
                                                        className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800">Map</button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
