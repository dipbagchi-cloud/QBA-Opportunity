"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { User, Briefcase, LayoutTemplate, Building, MapPin, Calendar, CheckCircle, ArrowLeft } from "lucide-react";
import { API_URL, getAuthHeaders } from "@/lib/api";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";

export default function UserDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const userId = params.id as string;

    const [userData, setUserData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState<"opportunities" | "projects">("opportunities");

    const authStore = useAuthStore();
    const currentUser = authStore.user as any;
    const isAdmin = currentUser?.permissions?.includes("users:manage");

    useEffect(() => {
        if (!userId) return;

        const fetchUser = async () => {
            try {
                setIsLoading(true);
                const res = await fetch(`${API_URL}/api/users/${userId}`, {
                    headers: getAuthHeaders()
                });
                
                if (!res.ok) {
                    throw new Error("Failed to load user data");
                }
                
                const data = await res.json();
                setUserData(data);
                
                // If the user has projects but no opportunities (and is admin), default to projects
                if (data.projects && data.projects.length > 0 && data.opportunities.length === 0) {
                    setActiveTab("projects");
                }
            } catch (err: any) {
                setError(err.message || "An error occurred");
            } finally {
                setIsLoading(false);
            }
        };

        fetchUser();
    }, [userId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !userData?.user) {
        return (
            <div className="p-8 text-center text-red-500">
                <p>{error || "User not found"}</p>
                <button onClick={() => router.back()} className="mt-4 text-indigo-600 hover:underline">
                    Go Back
                </button>
            </div>
        );
    }

    const { user, opportunities, projects } = userData;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <button onClick={() => router.back()} className="flex items-center text-sm text-slate-500 hover:text-slate-800 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </button>

            {/* Profile Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                <div className="px-8 pb-8 relative">
                    <div className="flex items-end justify-between">
                        <div className="flex items-end space-x-5 -mt-12 relative">
                            <div className="w-24 h-24 bg-white rounded-xl shadow-md border-4 border-white flex items-center justify-center text-4xl font-bold text-indigo-600 uppercase">
                                {user.name.charAt(0)}
                            </div>
                            <div className="pb-2">
                                <h1 className="text-2xl font-bold text-slate-800">{user.name}</h1>
                                <p className="text-slate-500 flex items-center mt-1">
                                    <Briefcase className="w-4 h-4 mr-2" />
                                    {user.title || "No title provided"}
                                </p>
                            </div>
                        </div>
                        {isAdmin && (
                            <div className="pb-2">
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {user.isActive ? "Active Account" : "Inactive"}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Extended Details for Admin */}
                    <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex items-center text-slate-600">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-3">
                                <User className="w-4 h-4 text-slate-500" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">Email Address</p>
                                <p className="text-sm font-medium">{user.email}</p>
                            </div>
                        </div>
                        
                        {isAdmin && user.department && (
                            <div className="flex items-center text-slate-600">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-3">
                                    <Building className="w-4 h-4 text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">Department</p>
                                    <p className="text-sm font-medium">{user.department}</p>
                                </div>
                            </div>
                        )}

                        {isAdmin && user.createdAt && (
                            <div className="flex items-center text-slate-600">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-3">
                                    <Calendar className="w-4 h-4 text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400">Joined Date</p>
                                    <p className="text-sm font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab("opportunities")}
                        className={`px-6 py-4 text-sm font-medium flex items-center transition-colors ${activeTab === "opportunities" ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
                    >
                        <Briefcase className="w-4 h-4 mr-2" />
                        Opportunities ({opportunities?.length || 0})
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab("projects")}
                            className={`px-6 py-4 text-sm font-medium flex items-center transition-colors ${activeTab === "projects" ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
                        >
                            <LayoutTemplate className="w-4 h-4 mr-2" />
                            Projects ({projects?.length || 0})
                        </button>
                    )}
                </div>

                <div className="p-6">
                    {/* Opportunities Tab */}
                    {activeTab === "opportunities" && (
                        <div>
                            {opportunities?.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    No opportunities created by this user.
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {opportunities.map((opp: any) => (
                                        <Link href={`/dashboard/opportunities/${opp.id}`} key={opp.id}>
                                            <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all flex items-center justify-between group bg-white">
                                                <div>
                                                    <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{opp.title}</h3>
                                                    <p className="text-sm text-slate-500 mt-1">{opp.client?.name} • Stage: {opp.currentStage}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-slate-800">{opp.currency} {Number(opp.value).toLocaleString()}</div>
                                                    <div className="text-xs text-slate-400 mt-1">{new Date(opp.createdAt).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Projects Tab */}
                    {activeTab === "projects" && isAdmin && (
                        <div>
                            {projects?.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    No projects associated with this user.
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {projects.map((proj: any) => (
                                        <div key={proj.id} className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all flex items-center justify-between group bg-white">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-slate-800">{proj.name}</h3>
                                                    {proj.code && <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-100 rounded-md">{proj.code}</span>}
                                                </div>
                                                <p className="text-sm text-slate-500 mt-1">{proj.client?.name}</p>
                                            </div>
                                            <div className="text-right flex items-center gap-4">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</span>
                                                    <span className="px-2 py-1 text-xs rounded-md bg-blue-50 text-blue-700 font-medium">{proj.status}</span>
                                                </div>
                                                <div className="flex flex-col items-end w-16">
                                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Health</span>
                                                    <span className={`font-bold ${proj.healthScore >= 80 ? 'text-emerald-600' : proj.healthScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                        {proj.healthScore}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
