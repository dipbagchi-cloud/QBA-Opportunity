"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { API_URL, getAuthHeaders } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface CurrencyRate {
    id: string;
    code: string;
    name: string;
    symbol: string;
    region: string;
    rateToBase: number; // rate relative to base (INR)
    baseCurrency: string;
    isActive: boolean;
}

interface CurrencyContextType {
    /** Currently selected currency code, e.g. "INR", "USD" */
    currency: string;
    /** Set active currency */
    setCurrency: (code: string) => void;
    /** Symbol for current currency */
    symbol: string;
    /** All available (active) currencies from master */
    currencies: CurrencyRate[];
    /** Convert an amount from INR (base) to the selected currency */
    convert: (amountInBase: number) => number;
    /** Format an amount with currency symbol */
    format: (amountInBase: number, opts?: { compact?: boolean; decimals?: number }) => string;
    /** Get symbol for a specific currency code */
    getSymbol: (code: string) => string;
    /** Get rate for a specific currency code (relative to INR base) */
    getRate: (code: string) => number;
    /** Whether rates have been loaded */
    loaded: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export function CurrencyProvider({ children }: { children: ReactNode }) {
    const [currency, setCurrencyState] = useState("INR");
    const [currencies, setCurrencies] = useState<CurrencyRate[]>([]);
    const [loaded, setLoaded] = useState(false);

    // Fetch currency rates from master
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_URL}/api/admin/currency-rates`, { headers: getAuthHeaders() });
                if (!res.ok) return;
                const data: CurrencyRate[] = await res.json();
                const activeRates = data.filter(r => r.isActive);
                setCurrencies(activeRates);

                // Load saved preference
                const saved = localStorage.getItem("qcrm_currency");
                if (saved && activeRates.some(r => r.code === saved)) {
                    setCurrencyState(saved);
                }
            } catch {
                // Fallback: at least have INR
                setCurrencies([{ id: "fallback", code: "INR", name: "Indian Rupee", symbol: "₹", region: "India", rateToBase: 1, baseCurrency: "INR", isActive: true }]);
            } finally {
                setLoaded(true);
            }
        })();
    }, []);

    const setCurrency = useCallback((code: string) => {
        setCurrencyState(code);
        localStorage.setItem("qcrm_currency", code);
    }, []);

    const getRate = useCallback((code: string): number => {
        if (code === "INR") return 1;
        const rate = currencies.find(r => r.code === code);
        return rate ? rate.rateToBase : 1;
    }, [currencies]);

    const getSymbol = useCallback((code: string): string => {
        const rate = currencies.find(r => r.code === code);
        return rate?.symbol || code;
    }, [currencies]);

    const symbol = getSymbol(currency);

    const convert = useCallback((amountInBase: number): number => {
        if (currency === "INR") return amountInBase;
        const rate = getRate(currency);
        // rateToBase is how much 1 INR = X of this currency
        return amountInBase * rate;
    }, [currency, getRate]);

    const format = useCallback((amountInBase: number, opts?: { compact?: boolean; decimals?: number }): string => {
        const converted = convert(amountInBase);
        const sym = symbol;
        if (opts?.compact) {
            const abs = Math.abs(converted);
            if (abs >= 10000000) return `${sym}${(converted / 10000000).toFixed(1)}Cr`;
            if (abs >= 100000) return `${sym}${(converted / 100000).toFixed(1)}L`;
            if (abs >= 1000) return `${sym}${(converted / 1000).toFixed(1)}K`;
        }
        const decimals = opts?.decimals ?? 0;
        return `${sym}${converted.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    }, [convert, symbol]);

    return (
        <CurrencyContext.Provider value={{ currency, setCurrency, symbol, currencies, convert, format, getSymbol, getRate, loaded }}>
            {children}
        </CurrencyContext.Provider>
    );
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useCurrency() {
    const ctx = useContext(CurrencyContext);
    if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
    return ctx;
}
