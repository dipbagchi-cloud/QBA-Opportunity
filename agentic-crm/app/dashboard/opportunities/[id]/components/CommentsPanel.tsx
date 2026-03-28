"use client";

import React, { useState, useEffect, useCallback } from "react";
import { API_URL, getAuthHeaders } from "@/lib/api";
import { MessageSquare, Send, RefreshCw } from "lucide-react";

interface Comment {
    id: string;
    content: string;
    stage: string | null;
    createdAt: string;
    author: { id: string; name: string; email: string };
}

interface CommentsPanelProps {
    opportunityId: string;
    currentStage: string; // Pipeline, Presales, Sales, Project
}

export function CommentsPanel({ opportunityId, currentStage }: CommentsPanelProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const fetchComments = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}/comments`, {
                headers: getAuthHeaders(),
            });
            if (res.ok) setComments(await res.json());
        } catch (err) {
            console.error("Failed to load comments", err);
        } finally {
            setIsLoading(false);
        }
    }, [opportunityId]);

    useEffect(() => { fetchComments(); }, [fetchComments]);

    const handleSubmit = async () => {
        if (!newComment.trim()) return;
        setIsSending(true);
        try {
            const res = await fetch(`${API_URL}/api/opportunities/${opportunityId}/comments`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ content: newComment.trim(), stage: currentStage }),
            });
            if (res.ok) {
                const added = await res.json();
                setComments(prev => [added, ...prev]);
                setNewComment("");
            }
        } catch (err) {
            console.error("Failed to add comment", err);
        } finally {
            setIsSending(false);
        }
    };

    const stageBadgeColor = (stage: string | null) => {
        switch (stage) {
            case "Pipeline": return "bg-purple-50 text-purple-700 border-purple-200";
            case "Presales": return "bg-blue-50 text-blue-700 border-blue-200";
            case "Sales": return "bg-amber-50 text-amber-700 border-amber-200";
            case "Project": return "bg-emerald-50 text-emerald-700 border-emerald-200";
            default: return "bg-slate-50 text-slate-600 border-slate-200";
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-800">Comments</h3>
                    <span className="text-xs text-slate-400">({comments.length})</span>
                </div>
                <button onClick={fetchComments} className="text-slate-400 hover:text-slate-600">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {/* Add comment */}
            <div className="px-4 py-3 border-b border-slate-100">
                <div className="flex gap-2">
                    <textarea
                        rows={2}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-300"
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={isSending || !newComment.trim()}
                        className="self-end px-3 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Comments list */}
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {comments.length === 0 && !isLoading && (
                    <p className="px-4 py-6 text-center text-xs text-slate-400">No comments yet</p>
                )}
                {comments.map((c) => (
                    <div key={c.id} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-slate-700">{c.author.name}</span>
                            {c.stage && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${stageBadgeColor(c.stage)}`}>
                                    {c.stage}
                                </span>
                            )}
                            <span className="text-[10px] text-slate-400 ml-auto">
                                {new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">{c.content}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
