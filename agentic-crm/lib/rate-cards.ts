import { apiClient } from './api';

export const LOCATION_KEYS = ['India + Kolkata', 'India + Hyd', 'India + Pune', 'Nigeria + Lagos', 'Luxembourg'] as const;
export type LocationKey = typeof LOCATION_KEYS[number];

// Maps UI location label → DB field name on rate card
const LOCATION_CTC_FIELD: Record<string, string> = {
    'India + Kolkata': 'ctc',
    'India + Hyd': 'ctcHyd',
    'India + Pune': 'ctcPune',
    'Nigeria + Lagos': 'ctcNigeriaLagos',
    'Luxembourg': 'ctcLuxembourg',
};

export function getCtcForLocation(rateCard: any, locationKey: string): number {
    const field = LOCATION_CTC_FIELD[locationKey] ?? 'ctc';
    return Number((rateCard as any)[field]) || 0;
}

export interface RateCardEntry {
    id: string;
    code: string;
    role: string;
    skill: string;
    experienceBand: string;
    ctc: number;
    ctcHyd: number;
    ctcPune: number;
    ctcNigeriaLagos: number;
    ctcLuxembourg: number;
    category: string;
    isActive: boolean;
}

export const MOCK_ASSUMPTIONS = {
    marginPercent: 35,
    benchPercent: 10,
    workingDaysPerYear: 220,
};

// Fetch rate cards from backend API and compute derived fields
export async function fetchRateCards() {
    const data = await apiClient<RateCardEntry[]>('/api/rate-cards');

    return data.map((r) => {
        const offCost = r.ctc * (1 + MOCK_ASSUMPTIONS.benchPercent / 100);
        const offDailyCost = offCost / MOCK_ASSUMPTIONS.workingDaysPerYear;
        const offDailyRate = offDailyCost / (1 - MOCK_ASSUMPTIONS.marginPercent / 100);

        return {
            code: r.code,
            role: r.role,
            skill: r.skill,
            experienceBand: r.experienceBand,
            category: r.category,
            // All location CTCs (raw, for re-lookup when location changes)
            ctc: r.ctc || 0,
            ctcHyd: r.ctcHyd || 0,
            ctcPune: r.ctcPune || 0,
            ctcNigeriaLagos: r.ctcNigeriaLagos || 0,
            ctcLuxembourg: r.ctcLuxembourg || 0,
            // Derived fields for default location (India + Kolkata) — kept for backward compat
            annualCtc: r.ctc || 0,
            dailyCost: offDailyCost,
            dailyRate: offDailyRate,
        };
    });
}

// Keep synchronous version as fallback (uses same assumptions)
export function getRateCards() {
    console.warn('getRateCards() is deprecated — use fetchRateCards() instead');
    return [] as ReturnType<typeof fetchRateCards> extends Promise<infer T> ? T : never;
}
