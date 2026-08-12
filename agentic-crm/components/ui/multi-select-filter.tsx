"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

/**
 * A compact multi-select filter control sized for a table header cell.
 *
 * The trigger reads like the single-value input it replaces ("filter…" when
 * empty, the value itself when one is picked, "N selected" beyond that), and
 * the dropdown is a searchable checkbox list. Free text is still honoured —
 * typing a value the list doesn't offer and pressing Enter adds it verbatim,
 * so a caller doing server-side "contains" matching keeps working even when
 * the suggestion list is incomplete.
 *
 * Selected values are OR'd by the caller within a column and AND'd across
 * columns; this component only owns the picking.
 */
export function MultiSelectFilter({
    values,
    onChange,
    options,
    placeholder = "filter…",
    triggerClassName,
    maxOptions = 300,
}: {
    values: string[];
    onChange: (next: string[]) => void;
    options: string[];
    placeholder?: string;
    triggerClassName?: string;
    maxOptions?: number;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const rootRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const onDocMouseDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery("");
            }
        };
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, []);

    useEffect(() => {
        if (open) searchRef.current?.focus();
    }, [open]);

    const selected = useMemo(() => new Set(values), [values]);

    // Values picked earlier that are no longer offered (or were free-typed)
    // stay at the top of the list so they can still be unpicked.
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        const pool = Array.from(new Set([...values, ...options]));
        return pool.filter((o) => !q || o.toLowerCase().includes(q)).slice(0, maxOptions);
    }, [options, values, query, maxOptions]);

    const toggle = (option: string) => {
        onChange(selected.has(option) ? values.filter((v) => v !== option) : [...values, option]);
    };

    const label =
        values.length === 0 ? placeholder : values.length === 1 ? values[0] : `${values.length} selected`;

    return (
        <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                title={values.length > 1 ? values.join(", ") : undefined}
                className={triggerClassName}
            >
                <span className={`truncate ${values.length ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
                {values.length > 0 ? (
                    <X
                        className="w-3 h-3 shrink-0 text-slate-400 hover:text-red-500"
                        onClick={(e) => { e.stopPropagation(); onChange([]); }}
                    />
                ) : (
                    <ChevronDown className="w-3 h-3 shrink-0 text-slate-400" />
                )}
            </button>

            {open && (
                <div className="absolute left-0 top-full mt-0.5 z-50 w-max min-w-full max-w-[280px] bg-white border border-slate-200 rounded-md shadow-lg">
                    <div className="p-1.5 border-b border-slate-100">
                        <input
                            ref={searchRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") { setOpen(false); setQuery(""); return; }
                                // Enter accepts free text so a value missing from
                                // the suggestion list can still be filtered on.
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    const typed = query.trim();
                                    if (!typed) return;
                                    const exact = visible.find((o) => o.toLowerCase() === typed.toLowerCase());
                                    const pick = exact ?? (visible.length === 1 ? visible[0] : typed);
                                    if (!selected.has(pick)) onChange([...values, pick]);
                                    setQuery("");
                                }
                            }}
                            placeholder="Search…"
                            autoComplete="off"
                            className="w-full px-2 py-1 text-[11px] font-normal border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                    </div>

                    <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 text-[10px]">
                        <button
                            type="button"
                            onClick={() => onChange(Array.from(new Set([...values, ...visible])))}
                            className="text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                            Select all{query.trim() ? " matching" : ""}
                        </button>
                        <button
                            type="button"
                            onClick={() => onChange([])}
                            disabled={values.length === 0}
                            className="text-slate-500 hover:text-red-600 font-medium disabled:opacity-40 disabled:hover:text-slate-500"
                        >
                            Clear
                        </button>
                    </div>

                    <div className="max-h-52 overflow-y-auto py-0.5">
                        {visible.length === 0 ? (
                            <p className="px-2 py-1.5 text-[11px] text-slate-400">No matching values</p>
                        ) : (
                            visible.map((o) => {
                                const isOn = selected.has(o);
                                return (
                                    <button
                                        key={o}
                                        type="button"
                                        onClick={() => toggle(o)}
                                        className={`flex items-center gap-1.5 w-full text-left px-2 py-1 text-[11px] ${isOn ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"}`}
                                        title={o}
                                    >
                                        <span className={`w-3 h-3 shrink-0 rounded-sm border flex items-center justify-center ${isOn ? "bg-indigo-600 border-indigo-600" : "border-slate-300 bg-white"}`}>
                                            {isOn && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                        </span>
                                        <span className="truncate">{o}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
