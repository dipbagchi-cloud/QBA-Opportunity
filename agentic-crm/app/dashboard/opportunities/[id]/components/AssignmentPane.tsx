import { useState } from "react";
import { UserCircle, Briefcase, Code, Loader2, Plus, X } from "lucide-react";
import { API_URL, getAuthHeaders } from "@/lib/api";

interface AssignmentPaneProps {
    opportunityId: string;
    salesRepName: string;
    managerName: string;
    presalesAssigneeName: string;
    setFormData: (data: any) => void;
    isAssignedManager: boolean;
    isAdmin: boolean;
}

export function AssignmentPane({
    opportunityId,
    salesRepName,
    managerName,
    presalesAssigneeName,
    setFormData,
    isAssignedManager,
    isAdmin,
}: AssignmentPaneProps) {
    const [saving, setSaving] = useState(false);
    const [addingPresales, setAddingPresales] = useState(false);
    const [newPresalesName, setNewPresalesName] = useState("");

    // Parse comma-separated presales names into an array
    const presalesNames = presalesAssigneeName
        ? presalesAssigneeName.split(",").map((n) => n.trim()).filter(Boolean)
        : [];

    // Only the assigned manager or admin can edit presales assignments
    const canEditPresales = isAdmin || isAssignedManager;

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

    const handleAddPresales = async () => {
        const name = newPresalesName.trim();
        if (!name) return;
        if (presalesNames.map((n) => n.toLowerCase()).includes(name.toLowerCase())) {
            setNewPresalesName("");
            setAddingPresales(false);
            return;
        }
        const updated = [...presalesNames, name].join(", ");
        setFormData((prev: any) => ({ ...prev, presalesAssignee: updated }));
        setNewPresalesName("");
        setAddingPresales(false);
        await patchAssignment("presalesAssigneeName", updated);
    };

    const handleRemovePresales = async (name: string) => {
        const updated = presalesNames.filter((n) => n !== name).join(", ");
        setFormData((prev: any) => ({ ...prev, presalesAssignee: updated }));
        await patchAssignment("presalesAssigneeName", updated);
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
                    <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-800 font-medium">
                        {salesRepName || <span className="text-slate-400 font-normal italic">Unassigned</span>}
                    </div>
                </div>

                {/* Offshore Manager */}
                <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        <UserCircle className="w-3 h-3 text-blue-500" />
                        Offshore Manager
                    </label>
                    <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-800 font-medium">
                        {managerName || <span className="text-slate-400 font-normal italic">Unassigned</span>}
                    </div>
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
                                onClick={() => setAddingPresales(true)}
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

                    {/* Add presales input */}
                    {addingPresales && (
                        <div className="mt-2 flex gap-2">
                            <input
                                autoFocus
                                type="text"
                                value={newPresalesName}
                                onChange={(e) => setNewPresalesName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAddPresales();
                                    if (e.key === "Escape") { setAddingPresales(false); setNewPresalesName(""); }
                                }}
                                placeholder="Full name..."
                                className="flex-1 px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <button
                                type="button"
                                onClick={handleAddPresales}
                                disabled={!newPresalesName.trim()}
                                className="px-2.5 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Add
                            </button>
                            <button
                                type="button"
                                onClick={() => { setAddingPresales(false); setNewPresalesName(""); }}
                                className="px-2.5 py-1.5 bg-white border border-slate-300 text-xs text-slate-600 rounded-md hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
