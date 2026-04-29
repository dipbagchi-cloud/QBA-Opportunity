"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Briefcase, Users, Building, User, LayoutTemplate, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { API_URL, getAuthHeaders } from "@/lib/api";
import Link from "next/link";

interface SearchResults {
    opportunities: any[];
    contacts: any[];
    clients: any[];
    users: any[];
    projects: any[];
}

export default function GlobalSearch() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResults>({
        opportunities: [],
        contacts: [],
        clients: [],
        users: [],
        projects: []
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Click outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Close on escape
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Debounced Search
    useEffect(() => {
        if (!query.trim()) {
            setResults({ opportunities: [], contacts: [], clients: [], users: [], projects: [] });
            setIsLoading(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(query)}`, {
                    headers: getAuthHeaders()
                });
                if (res.ok) {
                    const data = await res.json();
                    setResults(data);
                    setIsOpen(true);
                }
            } catch (err) {
                console.error("Failed to fetch global search", err);
            } finally {
                setIsLoading(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [query]);

    const hasResults = results.opportunities.length > 0 || 
                       results.contacts.length > 0 || 
                       results.clients.length > 0 || 
                       results.users.length > 0 ||
                       results.projects?.length > 0;

    const handleClear = () => {
        setQuery("");
        setIsOpen(false);
    };

    const handleSelect = (href: string) => {
        setIsOpen(false);
        setQuery("");
        router.push(href);
    };

    return (
        <div className="relative hidden md:block" ref={wrapperRef}>
            <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        if (e.target.value) setIsOpen(true);
                    }}
                    onFocus={() => {
                        if (query.trim() && hasResults) setIsOpen(true);
                    }}
                    placeholder="Search globally..."
                    className="w-72 bg-slate-100/50 border border-slate-200 rounded-lg py-2 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder:text-slate-400"
                />
                {isLoading ? (
                    <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 animate-spin" />
                ) : query && (
                    <button onClick={handleClear} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Dropdown Results */}
            {isOpen && query.trim() && !isLoading && (
                <div className="absolute top-full left-0 mt-2 w-[400px] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden max-h-[80vh] overflow-y-auto">
                    {!hasResults ? (
                        <div className="p-4 text-center text-sm text-slate-500">
                            No results found for "{query}"
                        </div>
                    ) : (
                        <div className="py-2">
                            {/* Opportunities */}
                            {results.opportunities.length > 0 && (
                                <div className="mb-2">
                                    <h3 className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">Opportunities</h3>
                                    {results.opportunities.map((opp) => (
                                        <button
                                            key={opp.id}
                                            onClick={() => handleSelect(`/dashboard/opportunities/${opp.id}`)}
                                            className="w-full text-left px-4 py-2 hover:bg-indigo-50 flex items-start gap-3 transition-colors"
                                        >
                                            <Briefcase className="w-4 h-4 mt-0.5 text-indigo-500 shrink-0" />
                                            <div>
                                                <div className="text-sm font-medium text-slate-800">{opp.title}</div>
                                                <div className="text-xs text-slate-500">
                                                    {opp.client?.name} • Stage: {opp.currentStage}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Contacts */}
                            {results.contacts.length > 0 && (
                                <div className="mb-2">
                                    <h3 className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">Contacts</h3>
                                    {results.contacts.map((contact) => (
                                        <button
                                            key={contact.id}
                                            onClick={() => handleSelect(`/dashboard/contacts`)} // Navigate to contacts page generally, or specific ID if you have a contact detail page
                                            className="w-full text-left px-4 py-2 hover:bg-purple-50 flex items-start gap-3 transition-colors"
                                        >
                                            <Users className="w-4 h-4 mt-0.5 text-purple-500 shrink-0" />
                                            <div>
                                                <div className="text-sm font-medium text-slate-800">{contact.firstName} {contact.lastName}</div>
                                                <div className="text-xs text-slate-500">
                                                    {contact.title} {contact.client?.name ? `at ${contact.client.name}` : ''}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Clients */}
                            {results.clients.length > 0 && (
                                <div className="mb-2">
                                    <h3 className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">Clients</h3>
                                    {results.clients.map((client) => (
                                        <button
                                            key={client.id}
                                            onClick={() => handleSelect(`/dashboard/contacts`)} // Currently clients might not have a dedicated page
                                            className="w-full text-left px-4 py-2 hover:bg-emerald-50 flex items-start gap-3 transition-colors"
                                        >
                                            <Building className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                                            <div>
                                                <div className="text-sm font-medium text-slate-800">{client.name}</div>
                                                <div className="text-xs text-slate-500">
                                                    {client.domain || client.industry || 'Client'}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Users */}
                            {results.users.length > 0 && (
                                <div className="mb-2">
                                    <h3 className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">Users</h3>
                                    {results.users.map((u) => (
                                        <button
                                            key={u.id}
                                            onClick={() => handleSelect(`/dashboard/users/${u.id}`)}
                                            className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-start gap-3 transition-colors"
                                        >
                                            <User className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
                                            <div>
                                                <div className="text-sm font-medium text-slate-800">{u.name}</div>
                                                <div className="text-xs text-slate-500">
                                                    {u.email} {u.department ? `• ${u.department}` : ''}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Projects */}
                            {results.projects?.length > 0 && (
                                <div className="mb-1">
                                    <h3 className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">Projects</h3>
                                    {results.projects.map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => handleSelect(`/dashboard/projects`)} // Fallback if no project details page exists yet
                                            className="w-full text-left px-4 py-2 hover:bg-blue-50 flex items-start gap-3 transition-colors"
                                        >
                                            <LayoutTemplate className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
                                            <div>
                                                <div className="text-sm font-medium text-slate-800">{p.name} {p.code ? `(${p.code})` : ''}</div>
                                                <div className="text-xs text-slate-500">
                                                    {p.client?.name} • Status: {p.status}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
