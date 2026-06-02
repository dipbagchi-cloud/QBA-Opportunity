import { useEffect, useState, useMemo } from "react";
import { Loader2, Search, Users, X } from "lucide-react";
import { API_URL, getAuthHeaders } from "@/lib/api";

interface AssignPresalesModalProps {
    opportunityId: string;
    isOpen: boolean;
    onAssign: (selectedNames: string) => void;
    onClose?: () => void;
    managerDepartment?: string;
}

export function AssignPresalesModal({ opportunityId, isOpen, onAssign, onClose, managerDepartment }: AssignPresalesModalProps) {
    const [presalesTeam, setPresalesTeam] = useState<{ id: string; name: string; department: string | null }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    
    // We use a string array to allow multiple selections
    const [selectedPresales, setSelectedPresales] = useState<string[]>([]);

    useEffect(() => {
        if (!isOpen) return;

        const fetchTeamData = async () => {
            setIsLoading(true);
            try {
                const headers = getAuthHeaders();

                // Always fetch all presales team members across all departments
                const url = `${API_URL}/api/master/presales-team`;
                
                const presalesRes = await fetch(url, { headers });
                console.log('[AssignPresalesModal] Response status:', presalesRes.status);
                
                if (presalesRes.ok) {
                    const presalesData = await presalesRes.json();
                    setPresalesTeam(presalesData);
                }
            } catch (err) {
                console.error("[AssignPresalesModal] Error fetching presales team:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTeamData();
    }, [isOpen]);

    const filteredTeam = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return presalesTeam;
        return presalesTeam.filter(ps =>
            ps.name.toLowerCase().includes(q) ||
            (ps.department ?? "").toLowerCase().includes(q)
        );
    }, [presalesTeam, search]);

    const toggleSelection = (name: string) => {
        setSelectedPresales(prev => 
            prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
        );
    };

    const handleSave = async () => {
        if (selectedPresales.length === 0) return;
        
        setSaving(true);
        try {
            const joinedNames = selectedPresales.join(", ");
            const response = await fetch(`${API_URL}/api/opportunities/${opportunityId}`, {
                method: "PATCH",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    presalesAssigneeName: joinedNames
                })
            });

            if (!response.ok) {
                throw new Error("Failed to assign presales");
            }
            
            onAssign(joinedNames);
        } catch (error) {
            console.error("Presales assignment failed", error);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-600 mb-1">
                            <Users className="w-5 h-5" />
                            Assign Presales Team
                        </h2>
                        <p className="text-sm text-slate-500">
                            Select presales personnel to work on the schedule and estimate. You can select multiple.
                        </p>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="p-6 bg-slate-50/50">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <>
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name or department…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                            {filteredTeam.length === 0 ? (
                                <div className="text-center py-6">
                                    <p className="text-sm text-slate-600 font-medium mb-2">{search ? "No matches found" : "No presales team members found"}</p>
                                    {!search && <p className="text-xs text-slate-400 mt-2">Please contact your administrator to add presales users.</p>}
                                </div>
                            ) : (
                                filteredTeam.map((ps) => (
                                    <label 
                                        key={ps.id} 
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                            selectedPresales.includes(ps.name) 
                                                ? "bg-indigo-50 border-indigo-200" 
                                                : "bg-white hover:bg-slate-50 border-slate-200"
                                        }`}
                                    >
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300"
                                            checked={selectedPresales.includes(ps.name)}
                                            onChange={() => toggleSelection(ps.name)}
                                        />
                                        <div className="flex-1">
                                            <span className="text-sm font-medium text-slate-800">{ps.name}</span>
                                            {ps.department && (
                                                <span className="text-xs text-slate-500 ml-2">({ps.department})</span>
                                            )}
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                    {onClose && (
                        <button
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Skip for Now
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || selectedPresales.length === 0}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Confirm Assignment
                    </button>
                </div>
            </div>
        </div>
    );
}
