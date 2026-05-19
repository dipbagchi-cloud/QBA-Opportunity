import { useState, useEffect, useRef, useCallback } from "react";
import { UserCircle, Briefcase, Code, Loader2, Plus, X, Search, ChevronDown } from "lucide-react";
import { API_URL, getAuthHeaders } from "@/lib/api";

interface AssignmentPaneProps {
    opportunityId: string;
    salesRepName: string;
    managerName: string;
    presalesAssigneeName: string;
    setFormData: (data: any) => void;
    canEditSalesRep: boolean;
    canEditManager: boolean;
    canEditPresales: boolean;
    salesUsers: { id: string; name: string; department?: string | null }[];
    managerUsers: { id: string; name: string; department?: string | null }[];
    onSalesRepChange: (name: string) => void;
    onManagerChange: (name: string) => void;
}

type SearchableSelectOption = { value: string; label: string };

function SearchableSelect({ name, value, options, disabled, onChange, placeholder }: {
    name: string;
    value: string;
    options: SearchableSelectOption[];
    disabled?: boolean;
    onChange: (event: { target: { name: string; value: string }; }) => void;
    placeholder: string;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));
    const selectedOption = options.find((o) => o.value === value);

    return (
        <div className="relative w-full" ref={ref}>
            <div
                className={`w-full min-h-[42px] px-3 py-2 border border-slate-300 rounded-md text-sm shadow-sm flex items-center justify-between ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-70' : 'bg-white cursor-pointer'}`}
                onClick={() => { if (!disabled) { setOpen(!open); setSearch(""); } }}
            >
                <span className={selectedOption ? "text-slate-800" : "text-slate-400"}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
            {open && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg">
                    <div className="p-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md">
                            <Search className="w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search..."
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.map((o) => (
                            <div
                                key={o.value}
                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 ${o.value === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
                                onClick={() => {
                                    onChange({ target: { name, value: o.value } });
                                    setOpen(false);
                                }}
                            >
                                {o.label}
                            </div>
                        ))}
                        {filtered.length === 0 && <div className="px-3 py-4 text-sm text-slate-400 text-center">No results found</div>}
                    </div>
                </div>
            )}
        </div>
    );
}

interface UserSuggestion {
    id: string;
    name: string;
    email: string;
}

export function AssignmentPane({
    opportunityId,
    salesRepName,
    managerName,
    presalesAssigneeName,
    setFormData,
    canEditSalesRep,
    canEditManager,
    canEditPresales,
    salesUsers,
    managerUsers,
    onSalesRepChange,
    onManagerChange,
}: AssignmentPaneProps) {
    const [saving, setSaving] = useState(false);
    const [addingPresales, setAddingPresales] = useState(false);
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const presalesNames = presalesAssigneeName
        ? presalesAssigneeName.split(",").map((n) => n.trim()).filter(Boolean)
        : [];

    const salesOptions = salesUsers.map((u) => ({
        value: u.name,
        label: `${u.name}${u.department ? ` (${u.department})` : ''}`,
    }));
    if (salesRepName && !salesOptions.some((o) => o.value === salesRepName)) {
        salesOptions.unshift({ value: salesRepName, label: salesRepName });
    }

    const managerOptions = managerUsers.map((u) => ({
        value: u.name,
        label: `${u.name}${u.department ? ` (${u.department})` : ''}`,
    }));
    if (managerName && !managerOptions.some((o) => o.value === managerName)) {
        managerOptions.unshift({ value: managerName, label: managerName });
    }

    const fetchSuggestions = useCallback(async (q: string) => {
        setLoadingSuggestions(true);
        try {
            const res = await fetch(
                `${API_URL}/api/users/search?q=${encodeURIComponent(q)}&permission=presales%3Awrite`,
                { headers: getAuthHeaders() }
            );
            if (!res.ok) throw new Error("Failed to fetch users");
            const data: UserSuggestion[] = await res.json();
            // exclude already-added names
            const lowerAdded = presalesNames.map((n) => n.toLowerCase());
            setSuggestions(data.filter((u) => !lowerAdded.includes(u.name.toLowerCase())));
        } catch {
            setSuggestions([]);
        } finally {
            setLoadingSuggestions(false);
        }
    }, [presalesNames]);

    useEffect(() => {
        if (!addingPresales) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchSuggestions(query), 200);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query, addingPresales, fetchSuggestions]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setAddingPresales(false);
                setQuery("");
                setSuggestions([]);
            }
        };
        if (addingPresales) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [addingPresales]);

    const patchAssignment = async (field: string, value: string) => {
        setSaving(true);
        try {
            const response = await fetch(`${API_URL}/api/opportunities/${opportunityId}`, {
                method: "PATCH",
                headers: getAuthHeaders(),
                body: JSON.stringify({ [field]: value }),
            });
            if (!response.ok) throw new Error("Failed to update assignment");
        } catch (error) {
            console.error("Assignment update failed", error);
        } finally {
            setSaving(false);
        }
    };

    const handleSalesRepChange = async (selectedName: string) => {
        onSalesRepChange(selectedName);
        await patchAssignment("salesRepName", selectedName);
    };

    const handleManagerChange = async (selectedName: string) => {
        onManagerChange(selectedName);
        await patchAssignment("managerName", selectedName);
    };

    const handleSelectUser = async (user: UserSuggestion) => {
        const updated = [...presalesNames, user.name].join(", ");
        setFormData((prev: any) => ({ ...prev, presalesAssignee: updated }));
        setQuery("");
        setSuggestions([]);
        setAddingPresales(false);
        await patchAssignment("presalesAssigneeName", updated);
    };

    const handleRemovePresales = async (name: string) => {
        const updated = presalesNames.filter((n) => n !== name).join(", ");
        setFormData((prev: any) => ({ ...prev, presalesAssignee: updated }));
        await patchAssignment("presalesAssigneeName", updated);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                handleSelectUser(suggestions[highlightedIndex]);
            }
        } else if (e.key === "Escape") {
            setAddingPresales(false);
            setQuery("");
            setSuggestions([]);
        }
        setHighlightedIndex(-1);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[300px]">
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <UserCircle className="w-5 h-5 text-indigo-500" />
                    <span>Assigned To</span>
                </div>
                {saving && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-5">
                {/* Sales Person */}
                <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        <Briefcase className="w-3 h-3 text-emerald-500" />
                        Sales Person
                    </label>
                    {canEditSalesRep ? (
                        <SearchableSelect
                            name="salesRep"
                            value={salesRepName}
                            options={salesOptions}
                            onChange={(e) => handleSalesRepChange(e.target.value)}
                            placeholder="Select Sales Rep"
                            disabled={!canEditSalesRep}
                        />
                    ) : (
                        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-800 font-medium">
                            {salesRepName || <span className="text-slate-400 font-normal italic">Unassigned</span>}
                        </div>
                    )}
                </div>

                {/* Offshore Manager */}
                <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        <UserCircle className="w-3 h-3 text-blue-500" />
                        Offshore Manager
                    </label>
                    {canEditManager ? (
                        <SearchableSelect
                            name="managerName"
                            value={managerName}
                            options={managerOptions}
                            onChange={(e) => handleManagerChange(e.target.value)}
                            placeholder="Select Manager"
                            disabled={!canEditManager}
                        />
                    ) : (
                        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-800 font-medium">
                            {managerName || <span className="text-slate-400 font-normal italic">Unassigned</span>}
                        </div>
                    )}
                </div>

                {/* Presales Team */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <Code className="w-3 h-3 text-amber-500" />
                            Presales Team
                        </label>
                        {canEditPresales && !addingPresales && (
                            <button
                                type="button"
                                onClick={() => { setAddingPresales(true); setHighlightedIndex(-1); }}
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                <Plus className="w-3 h-3" />
                                Add Person
                            </button>
                        )}
                    </div>

                    {/* Chips */}
                    <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                        {presalesNames.length === 0 && !addingPresales && (
                            <span className="text-sm text-slate-400 italic">Unassigned</span>
                        )}
                        {presalesNames.map((name) => (
                            <span
                                key={name}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-medium text-amber-800"
                            >
                                {name}
                                {canEditPresales && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePresales(name)}
                                        className="text-amber-500 hover:text-red-600 transition-colors ml-0.5"
                                        title={`Remove ${name}`}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </span>
                        ))}
                    </div>

                    {/* Search dropdown */}
                    {addingPresales && (
                        <div ref={dropdownRef} className="mt-2 relative">
                            <div className="flex items-center border border-slate-300 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-indigo-400">
                                <input
                                    autoFocus
                                    type="text"
                                    value={query}
                                    onChange={(e) => { setQuery(e.target.value); setHighlightedIndex(-1); }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Search presales users..."
                                    className="flex-1 px-2.5 py-1.5 text-sm focus:outline-none"
                                />
                                {loadingSuggestions && (
                                    <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin mr-2 shrink-0" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => { setAddingPresales(false); setQuery(""); setSuggestions([]); }}
                                    className="px-2 py-1.5 text-slate-400 hover:text-slate-600"
                                    title="Cancel"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {suggestions.length > 0 && (
                                <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                    {suggestions.map((user, idx) => (
                                        <li
                                            key={user.id}
                                            onMouseDown={(e) => { e.preventDefault(); handleSelectUser(user); }}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            className={`px-3 py-2 cursor-pointer text-sm ${
                                                idx === highlightedIndex
                                                    ? "bg-indigo-50 text-indigo-800"
                                                    : "text-slate-700 hover:bg-slate-50"
                                            }`}
                                        >
                                            <span className="font-medium">{user.name}</span>
                                            <span className="ml-2 text-xs text-slate-400">{user.email}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {!loadingSuggestions && suggestions.length === 0 && query.length > 0 && (
                                <p className="mt-1 px-3 py-2 text-xs text-slate-400 bg-white border border-slate-200 rounded-md">
                                    No matching presales users found.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
