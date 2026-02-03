"use client";

import { User, Bell, Lock, Globe, Shield } from "lucide-react";

export default function SettingsPage() {
    return (
        <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                    Settings
                </h1>
                <p className="text-slate-500 mt-1">Manage your account preferences and application settings.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-64 space-y-2">
                    {[
                        { icon: User, label: "Profile", active: true },
                        { icon: Bell, label: "Notifications", active: false },
                        { icon: Lock, label: "Security", active: false },
                        { icon: Globe, label: "Integrations", active: false },
                        { icon: Shield, label: "Compliance", active: false },
                    ].map((item, i) => (
                        <button key={i} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${item.active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-1">Personal Information</h3>
                            <p className="text-sm text-slate-500">Update your public profile and details.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                                <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" defaultValue="Dip" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                                <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" defaultValue="Bagchi" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                <input type="email" className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" defaultValue="dip.bagchi@example.com" />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                            <button className="btn-primary">Save Changes</button>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 mb-1">Preferences</h3>
                            <p className="text-sm text-slate-500">Customize your workspace experience.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-slate-800">Email Notifications</p>
                                    <p className="text-xs text-slate-500">Receive daily digest of AI insights</p>
                                </div>
                                <div className="w-12 h-6 bg-indigo-600 rounded-full relative cursor-pointer">
                                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-slate-800">Dark Mode</p>
                                    <p className="text-xs text-slate-500">Switch between light and dark themes</p>
                                </div>
                                <div className="w-12 h-6 bg-slate-200 rounded-full relative cursor-pointer">
                                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
