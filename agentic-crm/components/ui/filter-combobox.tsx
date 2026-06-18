"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A lightweight type-ahead filter input: an input that, on focus/typing, shows
 * a dropdown of matching values from `options` (case-insensitive "contains").
 * Picking an option sets the value; free text is still allowed so the caller's
 * underlying filtering (e.g. server-side contains) keeps working.
 *
 * Unlike a native <datalist> the dropdown is real DOM we control, so it renders
 * consistently across browsers and is obviously visible.
 */
export function FilterCombobox({
    value,
    onChange,
    options,
    placeholder,
    inputClassName,
    maxOptions = 50,
}: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    placeholder?: string;
    inputClassName?: string;
    maxOptions?: number;
}) {
    const [open, setOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDocMouseDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, []);

    const q = (value || "").trim().toLowerCase();
    const matches = (options || [])
        .filter((o) => !q || o.toLowerCase().includes(q))
        .slice(0, maxOptions);

    const select = (v: string) => {
        onChange(v);
        setOpen(false);
        setActiveIdx(-1);
    };

    return (
        <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()}>
            <input
                value={value}
                onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIdx(-1); }}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                    if (e.key === "Escape") { setOpen(false); return; }
                    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActiveIdx((i) => Math.min(i + 1, matches.length - 1)); }
                    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
                    else if (e.key === "Enter" && activeIdx >= 0 && matches[activeIdx]) { e.preventDefault(); select(matches[activeIdx]); }
                }}
                placeholder={placeholder}
                autoComplete="off"
                className={inputClassName}
            />
            {open && matches.length > 0 && (
                <div className="absolute left-0 top-full mt-0.5 z-50 w-full min-w-[150px] max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg">
                    {matches.map((o, i) => (
                        <button
                            key={o}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); select(o); }}
                            onMouseEnter={() => setActiveIdx(i)}
                            className={`block w-full text-left px-2 py-1 text-[11px] truncate ${i === activeIdx ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"}`}
                            title={o}
                        >
                            {o}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
