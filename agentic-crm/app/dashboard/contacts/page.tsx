"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Search, Plus, Mail, Phone, MapPin, Building2, Briefcase,
    Edit, Trash2, X, ChevronLeft, ChevronRight,
    Linkedin, Star, User, Loader2
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Contact {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    title: string | null;
    department: string | null;
    isPrimary: boolean;
    linkedInUrl: string | null;
    isActive: boolean;
    clientId: string;
    client: { id: string; name: string; industry: string | null; location: string | null };
}

interface ClientOption {
    id: string;
    name: string;
}

const emptyForm = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    title: "",
    department: "",
    isPrimary: false,
    linkedInUrl: "",
    clientId: "",
};

export default function ContactsPage() {
    const { toast } = useToast();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterClient, setFilterClient] = useState("");
    const limit = 12;

    // Clients for dropdown
    const [clients, setClients] = useState<ClientOption[]>([]);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    // Delete confirmation
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Detail view
    const [viewContact, setViewContact] = useState<Contact | null>(null);

    // Fetch clients for dropdown
    useEffect(() => {
        apiClient<any[]>("/api/master/clients").then(setClients).catch(() => {});
    }, []);

    // Fetch contacts
    const fetchContacts = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: String(limit) });
            if (search) params.set("search", search);
            if (filterClient) params.set("clientId", filterClient);
            const data = await apiClient<any>(`/api/contacts?${params}`);
            setContacts(data.contacts);
            setTotal(data.total);
            setTotalPages(data.totalPages);
        } catch {
            toast({ title: "Error", description: "Failed to load contacts" });
        } finally {
            setIsLoading(false);
        }
    }, [page, search, filterClient, toast]);

    useEffect(() => { fetchContacts(); }, [fetchContacts]);

    // Debounced search
    const [searchInput, setSearchInput] = useState("");
    useEffect(() => {
        const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    const openCreate = () => {
        setForm(emptyForm);
        setEditingId(null);
        setShowModal(true);
    };

    const openEdit = (c: Contact) => {
        setForm({
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email || "",
            phone: c.phone || "",
            title: c.title || "",
            department: c.department || "",
            isPrimary: c.isPrimary,
            linkedInUrl: c.linkedInUrl || "",
            clientId: c.clientId,
        });
        setEditingId(c.id);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.firstName.trim() || !form.lastName.trim() || !form.clientId) {
            toast({ title: "Validation", description: "First name, last name, and client are required" });
            return;
        }
        setSaving(true);
        try {
            if (editingId) {
                await apiClient(`/api/contacts/${editingId}`, { method: "PATCH", body: JSON.stringify(form) });
                toast({ title: "Updated", description: "Contact updated successfully" });
            } else {
                await apiClient("/api/contacts", { method: "POST", body: JSON.stringify(form) });
                toast({ title: "Created", description: "Contact created successfully" });
            }
            setShowModal(false);
            fetchContacts();
        } catch {
            toast({ title: "Error", description: "Failed to save contact" });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await apiClient(`/api/contacts/${deleteId}`, { method: "DELETE" });
            toast({ title: "Deleted", description: "Contact removed" });
            setDeleteId(null);
            fetchContacts();
        } catch {
            toast({ title: "Error", description: "Failed to delete contact" });
        }
    };

    const getInitials = (c: Contact) =>
        `${c.firstName.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase();

    const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
    const endRecord = Math.min(page * limit, total);

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                        Contacts
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        {total} contacts across {clients.length} clients
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add Contact
                </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by name, email, title, department..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm text-sm"
                    />
                </div>
                <select
                    value={filterClient}
                    onChange={(e) => { setFilterClient(e.target.value); setPage(1); }}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                    <option value="">All Clients</option>
                    {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    <span className="ml-2 text-sm text-slate-500">Loading contacts...</span>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && contacts.length === 0 && (
                <div className="text-center py-16">
                    <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="font-semibold text-slate-700">No contacts found</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        {search || filterClient ? "Try adjusting your search or filter" : "Click \"Add Contact\" to create your first contact"}
                    </p>
                </div>
            )}

            {/* Grid */}
            {!isLoading && contacts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {contacts.map((contact) => (
                        <motion.div
                            key={contact.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-sm">
                                        {getInitials(contact)}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1">
                                            {contact.firstName} {contact.lastName}
                                            {contact.isPrimary && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                                        </h3>
                                        <p className="text-xs text-slate-500">{contact.title || "No title"}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openEdit(contact)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-indigo-600">
                                        <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setDeleteId(contact.id)} className="p-1.5 hover:bg-red-50 rounded-md text-slate-400 hover:text-red-600">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 mb-3">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-xs font-medium text-indigo-600 truncate">{contact.client.name}</span>
                                {contact.department && (
                                    <>
                                        <span className="text-slate-300">&bull;</span>
                                        <span className="text-xs text-slate-500 truncate">{contact.department}</span>
                                    </>
                                )}
                            </div>

                            <div className="space-y-1.5 text-xs text-slate-600">
                                {contact.email && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                        <span className="truncate">{contact.email}</span>
                                    </div>
                                )}
                                {contact.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                        <span>{contact.phone}</span>
                                    </div>
                                )}
                                {contact.client.location && (
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                        <span className="truncate">{contact.client.location}</span>
                                    </div>
                                )}
                                {contact.linkedInUrl && (
                                    <div className="flex items-center gap-2">
                                        <Linkedin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                        <a href={contact.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate">
                                            LinkedIn Profile
                                        </a>
                                    </div>
                                )}
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                                <button
                                    onClick={() => setViewContact(contact)}
                                    className="flex-1 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                >
                                    View Profile
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-500">
                        Showing {startRecord}&ndash;{endRecord} of {total} contacts
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-medium text-slate-700">Page {page} of {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Create / Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-5 border-b border-slate-200">
                                <h2 className="text-lg font-bold text-slate-900">{editingId ? "Edit Contact" : "Add Contact"}</h2>
                                <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-md">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                                        <input
                                            type="text"
                                            value={form.firstName}
                                            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="John"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
                                        <input
                                            type="text"
                                            value={form.lastName}
                                            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Doe"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Client *</label>
                                    <select
                                        value={form.clientId}
                                        onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">Select Client</option>
                                        {clients.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Title / Role</label>
                                        <input
                                            type="text"
                                            value={form.title}
                                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="VP of Engineering"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                                        <input
                                            type="text"
                                            value={form.department}
                                            onChange={(e) => setForm({ ...form, department: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Engineering"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="john@example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                                        <input
                                            type="tel"
                                            value={form.phone}
                                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="+1 (555) 123-4567"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">LinkedIn URL</label>
                                    <input
                                        type="url"
                                        value={form.linkedInUrl}
                                        onChange={(e) => setForm({ ...form, linkedInUrl: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="https://linkedin.com/in/..."
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, isPrimary: !form.isPrimary })}
                                        className={`w-8 h-5 rounded-full transition-colors ${form.isPrimary ? "bg-amber-500" : "bg-slate-300"}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${form.isPrimary ? "translate-x-3.5" : "translate-x-0.5"}`} />
                                    </button>
                                    <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                                        <Star className={`w-3.5 h-3.5 ${form.isPrimary ? "text-amber-500" : "text-slate-400"}`} />
                                        Primary Contact
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 p-5 border-t border-slate-200 bg-slate-50 rounded-b-xl">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    {editingId ? "Update" : "Create"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation */}
            <AnimatePresence>
                {deleteId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setDeleteId(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-base font-bold text-slate-900 mb-2">Delete Contact</h3>
                            <p className="text-sm text-slate-600 mb-4">Are you sure you want to delete this contact? This action cannot be undone.</p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setDeleteId(null)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-md hover:bg-red-700"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* View Profile Modal */}
            <AnimatePresence>
                {viewContact && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setViewContact(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-xl shadow-xl w-full max-w-md"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-5">
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-lg">
                                        {getInitials(viewContact)}
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                            {viewContact.firstName} {viewContact.lastName}
                                            {viewContact.isPrimary && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                                        </h2>
                                        <p className="text-sm text-slate-500">{viewContact.title || "No title"}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                        <Building2 className="w-4 h-4 text-slate-400" />
                                        <div>
                                            <p className="text-xs text-slate-500">Company</p>
                                            <p className="text-sm font-medium text-slate-800">{viewContact.client.name}</p>
                                        </div>
                                    </div>
                                    {viewContact.department && (
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                            <Briefcase className="w-4 h-4 text-slate-400" />
                                            <div>
                                                <p className="text-xs text-slate-500">Department</p>
                                                <p className="text-sm font-medium text-slate-800">{viewContact.department}</p>
                                            </div>
                                        </div>
                                    )}
                                    {viewContact.email && (
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                            <Mail className="w-4 h-4 text-slate-400" />
                                            <div>
                                                <p className="text-xs text-slate-500">Email</p>
                                                <p className="text-sm font-medium text-indigo-600">{viewContact.email}</p>
                                            </div>
                                        </div>
                                    )}
                                    {viewContact.phone && (
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                            <Phone className="w-4 h-4 text-slate-400" />
                                            <div>
                                                <p className="text-xs text-slate-500">Phone</p>
                                                <p className="text-sm font-medium text-slate-800">{viewContact.phone}</p>
                                            </div>
                                        </div>
                                    )}
                                    {viewContact.client.location && (
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                            <MapPin className="w-4 h-4 text-slate-400" />
                                            <div>
                                                <p className="text-xs text-slate-500">Location</p>
                                                <p className="text-sm font-medium text-slate-800">{viewContact.client.location}</p>
                                            </div>
                                        </div>
                                    )}
                                    {viewContact.linkedInUrl && (
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                            <Linkedin className="w-4 h-4 text-slate-400" />
                                            <div>
                                                <p className="text-xs text-slate-500">LinkedIn</p>
                                                <a href={viewContact.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-600 hover:underline">
                                                    View Profile
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
                                <button
                                    onClick={() => setViewContact(null)}
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => { openEdit(viewContact); setViewContact(null); }}
                                    className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2"
                                >
                                    <Edit className="w-3.5 h-3.5" />
                                    Edit
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
