"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
    groupHeadings,
}: {
    values: string[];
    onChange: (next: string[]) => void;
    options: string[];
    placeholder?: string;
    triggerClassName?: string;
    maxOptions?: number;
    /**
     * Optional heading rendered above a given option, keyed by that option's
     * value. Lets a caller mixing two kinds of value in one list say where the
     * second kind starts (e.g. stages, then statuses).
     */
    groupHeadings?: Record<string, string>;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    /**
     * The panel is portalled to <body> and positioned with `fixed` rather than
     * being absolutely positioned next to the trigger. Callers put this control
     * inside scrolling table headers, and an ancestor with `overflow` clips a
     * descendant no matter its z-index — which silently truncated the bottom of
     * the list. Fixed + portal escapes every overflow ancestor; the trade-off is
     * that the position must be recomputed while the page scrolls.
     */
    const [pos, setPos] = useState<{ left: number; top: number; minWidth: number; maxHeight: number } | null>(null);

    const updatePosition = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const GAP = 4;
        const MARGIN = 8;      // keep clear of the viewport edge
        const PANEL_WIDTH = 280;
        const spaceBelow = window.innerHeight - r.bottom - GAP - MARGIN;
        const spaceAbove = r.top - GAP - MARGIN;
        // Drop upward only when below genuinely can't hold a usable list.
        const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
        const maxHeight = Math.max(140, Math.min(340, openUp ? spaceAbove : spaceBelow));
        setPos({
            left: Math.max(MARGIN, Math.min(r.left, window.innerWidth - PANEL_WIDTH - MARGIN)),
            top: openUp ? Math.max(MARGIN, r.top - GAP - maxHeight) : r.bottom + GAP,
            minWidth: r.width,
            maxHeight,
        });
    }, []);

    useLayoutEffect(() => {
        if (open) updatePosition();
    }, [open, updatePosition]);

    useEffect(() => {
        if (!open) return;
        const onReflow = () => updatePosition();
        // Capture phase so scrolling of the inner table container counts too,
        // not just the window.
        window.addEventListener("scroll", onReflow, true);
        window.addEventListener("resize", onReflow);
        return () => {
            window.removeEventListener("scroll", onReflow, true);
            window.removeEventListener("resize", onReflow);
        };
    }, [open, updatePosition]);

    useEffect(() => {
        const onDocMouseDown = (e: MouseEvent) => {
            const target = e.target as Node;
            // The panel lives outside rootRef in the portal, so it needs its
            // own containment check or every click inside would dismiss it.
            if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
            setOpen(false);
            setQuery("");
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
                ref={triggerRef}
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

            {open && pos && createPortal(
                <div
                    ref={panelRef}
                    onClick={(e) => e.stopPropagation()}
                    style={{ left: pos.left, top: pos.top, minWidth: pos.minWidth, maxHeight: pos.maxHeight }}
                    className="fixed z-[200] w-max max-w-[280px] flex flex-col bg-white border border-slate-200 rounded-md shadow-lg"
                >
                    <div className="p-1.5 border-b border-slate-100 shrink-0">
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

                    <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 text-[10px] shrink-0">
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

                    {/* flex-1 + min-h-0 so the list absorbs whatever height is
                        left after the search box and the select-all row, and
                        scrolls internally instead of overflowing the panel. */}
                    <div className="flex-1 min-h-0 overflow-y-auto py-0.5">
                        {visible.length === 0 ? (
                            <p className="px-2 py-1.5 text-[11px] text-slate-400">No matching values</p>
                        ) : (
                            visible.map((o) => {
                                const isOn = selected.has(o);
                                const heading = groupHeadings?.[o];
                                return (
                                    <div key={o}>
                                    {heading && (
                                        <p className="px-2 pt-1.5 pb-0.5 mt-0.5 border-t border-slate-100 text-[9px] uppercase tracking-wide text-slate-400 font-semibold">
                                            {heading}
                                        </p>
                                    )}
                                    <button
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
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
