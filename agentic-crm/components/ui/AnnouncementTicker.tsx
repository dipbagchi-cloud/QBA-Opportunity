"use client";

import { useEffect, useRef, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { API_URL, getAuthHeaders } from "@/lib/api";

/**
 * The announcement banner across the top of the app.
 *
 * Dismissal is remembered per ANNOUNCEMENT, not per user: the server sends a
 * version that changes whenever the message does, and that version is what gets
 * stored as dismissed. A plain "hidden" flag would mean the first person to
 * close a notice never sees another one — which is how announcement banners
 * quietly stop working.
 *
 * The text only scrolls when it is too long for its space. A short message
 * sliding past for no reason is harder to read than one sitting still, and
 * anyone who has asked their system for reduced motion gets no movement at all.
 */
export default function AnnouncementTicker() {
    const [announcement, setAnnouncement] = useState<{ enabled: boolean; message: string; version: number } | null>(null);
    const [dismissedVersion, setDismissedVersion] = useState<number | null>(null);
    const [overflowing, setOverflowing] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);

    const STORAGE_KEY = "qcrm.announcement.dismissedVersion";

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            setDismissedVersion(raw === null ? -1 : Number(raw));
        } catch {
            setDismissedVersion(-1);   // storage blocked: show it, do not hide it
        }

        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_URL}/api/admin/announcement`, { headers: getAuthHeaders() });
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) setAnnouncement(data);
            } catch {
                /* no banner rather than a broken one */
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Scroll only if the message genuinely does not fit.
    useEffect(() => {
        if (!announcement?.message) return;
        const check = () => {
            const track = trackRef.current;
            const text = textRef.current;
            if (!track || !text) return;
            setOverflowing(text.scrollWidth > track.clientWidth + 8);
        };
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, [announcement?.message]);

    const dismiss = () => {
        if (!announcement) return;
        try { localStorage.setItem(STORAGE_KEY, String(announcement.version)); } catch { /* non-fatal */ }
        setDismissedVersion(announcement.version);
    };

    if (!announcement?.enabled || !announcement.message) return null;
    if (dismissedVersion === null) return null;              // still reading storage
    if (dismissedVersion >= announcement.version) return null; // already seen and closed

    return (
        <div
            role="status"
            aria-live="polite"
            className="relative flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs shadow-sm"
        >
            <Megaphone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />

            <div ref={trackRef} className="flex-1 overflow-hidden">
                <span
                    ref={textRef}
                    className={`inline-block whitespace-nowrap ${overflowing ? "qcrm-ticker-scroll" : ""}`}
                >
                    {announcement.message}
                </span>
            </div>

            <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss announcement"
                title="Dismiss"
                className="shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
            >
                <X className="w-3.5 h-3.5" />
            </button>

            <style jsx>{`
                .qcrm-ticker-scroll {
                    animation: qcrm-ticker 18s linear infinite;
                    padding-left: 100%;
                }
                @keyframes qcrm-ticker {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }
                /* Someone who has asked for less motion gets none. The message
                   still reads — it simply sits still and wraps out of view. */
                @media (prefers-reduced-motion: reduce) {
                    .qcrm-ticker-scroll {
                        animation: none;
                        padding-left: 0;
                    }
                }
            `}</style>
        </div>
    );
}
