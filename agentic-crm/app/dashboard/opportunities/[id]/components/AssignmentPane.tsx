import { useEffect, useState } from "react";
import { UserCircle, Briefcase, Code, Loader2 } from "lucide-react";

interface AssignmentPaneProps {
    opportunityId: string;
    salesRepName: string;
    managerName: string;
    presalesAssigneeName: string;
    setFormData: (data: any) => void;
    setOpportunityManagerName: (name: string) => void;
    hasEditAccess: boolean;
    userRole: string;
    userName: string;
}

export function AssignmentPane({
    opportunityId,
    salesRepName,
    managerName,
    presalesAssigneeName,
    setFormData,
    setOpportunityManagerName,
    hasEditAccess,
    userRole,
    userName
}: AssignmentPaneProps) {
    const [salesReps, setSalesReps] = useState<string[]>([]);
    const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
    const [presalesTeam, setPresalesTeam] = useState<{ id: string; name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchTeamData = async () => {
            try {
                const token = localStorage.getItem("token");
                const headers = {
                    "Authorization": `Bearer ${token}`
                };

                const [salesRes, mgrsRes, presalesRes] = await Promise.all([
                    fetch("/api/master/salespersons", { headers }),
                    fetch("/api/master/managers", { headers }),
                    fetch("/api/master/presales-team", { headers }),
                ]);

                if (salesRes.ok) {
                    const salesData = await salesRes.json();
                    setSalesReps(salesData.map((s: any) => s.salesRepName || s.name));
                }
                if (mgrsRes.ok) {
                    const mgrData = await mgrsRes.json();
                    setManagers(mgrData);
                }
                if (presalesRes.ok) {
                    const presalesData = await presalesRes.json();
                    setPresalesTeam(presalesData);
                }
            } catch (err) {
                console.error("Error fetching assignment teams:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTeamData();
    }, []);

    const updateAssignment = async (field: string, value: string) => {
        if (!hasEditAccess) return;

        // Optimistic UI update
        if (field === 'salesRep') {
            setFormData((prev: any) => ({ ...prev, salesRep: value }));
        } else if (field === 'managerName') {
            setOpportunityManagerName(value);
        } else if (field === 'presalesAssigneeName') {
            setFormData((prev: any) => ({ ...prev, presalesAssignee: value }));
        }

        setSaving(true);
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`/api/opportunities/${opportunityId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    [field]: value
                })
            });

            if (!response.ok) {
                throw new Error("Failed to update assignment");
            }
        } catch (error) {
            console.error("Assignment update failed", error);
            // Revert changes if needed (not strictly required here for simple dropdowns)
        } finally {
            setSaving(false);
        }
    };

    const isSalesOrPresales = userRole?.toLowerCase().includes("sales") || userRole?.toLowerCase().includes("presales");
    const isAdmin = !isSalesOrPresales;

    // Rules for assigning:
    // Sales Reps can only be changed by Admins or if you are the owner. 
    // Manager can be changed by Sales Rep, Owner, or Admin.
    // Presales can ONLY be assigned by the assigned Manager, or Admin.
    const canEditSalesRep = hasEditAccess;
    const canEditManager = hasEditAccess;
    const canEditPresales = isAdmin || userName === managerName;

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
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : (
                    <>
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

                        {/* Presales Person */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                <Code className="w-3 h-3 text-amber-500" />
                                Presales Person
                            </label>
                            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-800 font-medium">
                                {presalesAssigneeName || <span className="text-slate-400 font-normal italic">Unassigned</span>}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
