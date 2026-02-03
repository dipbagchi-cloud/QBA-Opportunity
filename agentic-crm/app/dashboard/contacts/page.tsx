"use client";

import { Search, Filter, Plus, MoreVertical, Mail, Phone, MapPin } from "lucide-react";
import { useState } from "react";

const contacts = [
    {
        id: 1,
        name: "Alice Johnson",
        role: "VP of Engineering",
        company: "Acme Corp",
        email: "alice@acme.com",
        phone: "+1 (555) 123-4567",
        location: "San Francisco, CA",
        avatar: "AJ"
    },
    {
        id: 2,
        name: "Bob Smith",
        role: "CTO",
        company: "Globex Inc",
        email: "bob@globex.com",
        phone: "+1 (555) 987-6543",
        location: "New York, NY",
        avatar: "BS"
    },
    {
        id: 3,
        name: "Carol Williams",
        role: "Director of IT",
        company: "Stark Industries",
        email: "carol@stark.com",
        phone: "+1 (555) 456-7890",
        location: "Austin, TX",
        avatar: "CW"
    }
];

export default function ContactsPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                        Contacts
                    </h1>
                    <p className="text-slate-500 mt-1">Manage your professional network and key stakeholders.</p>
                </div>
                <div className="flex gap-3">
                    <button className="btn-ghost bg-white border border-slate-200 text-slate-600 flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Filter
                    </button>
                    <button className="btn-primary flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        Add Contact
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search contacts..."
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm"
                />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {contacts.map((contact) => (
                    <div key={contact.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                                {contact.avatar}
                            </div>
                            <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="w-4 h-4" />
                            </button>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900">{contact.name}</h3>
                        <p className="text-sm text-slate-500 mb-4">{contact.role} at {contact.company}</p>

                        <div className="space-y-2 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-slate-400" />
                                {contact.email}
                            </div>
                            <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-slate-400" />
                                {contact.phone}
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                {contact.location}
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                            <button className="flex-1 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                View Profile
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
