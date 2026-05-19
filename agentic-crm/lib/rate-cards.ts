import { apiClient } from './api';

export const RATE_CARD_LOCATIONS = [
    { key: 'India + Kolkata', country: 'India', city: 'Kolkata', ctcField: 'ctc' },
    { key: 'India + Hyd', country: 'India', city: 'Hyd', ctcField: 'ctcHyd' },
    { key: 'India + Pune', country: 'India', city: 'Pune', ctcField: 'ctcPune' },
    { key: 'Nigeria + Lagos', country: 'Nigeria', city: 'Lagos', ctcField: 'ctcNigeriaLagos' },
    { key: 'Luxembourg', country: 'Luxembourg', city: 'Luxembourg', ctcField: 'ctcLuxembourg' },
] as const;

export const LOCATION_KEYS = RATE_CARD_LOCATIONS.map((loc) => loc.key);
export const RATE_CARD_COUNTRIES = Array.from(new Set(RATE_CARD_LOCATIONS.map((loc) => loc.country)));
export const DEFAULT_LOCATION_KEY = 'India + Kolkata';
export type LocationKey = typeof LOCATION_KEYS[number];

// Maps UI location label to DB field name on rate card.
const LOCATION_CTC_FIELD: Record<string, string> = RATE_CARD_LOCATIONS.reduce((acc, loc) => {
    acc[loc.key] = loc.ctcField;
    return acc;
}, {} as Record<string, string>);

export function getCitiesForCountry(country: string): string[] {
    return RATE_CARD_LOCATIONS
        .filter((loc) => loc.country === country)
        .map((loc) => loc.city);
}

function normalizeCity(city: string): string {
    return city === 'Hyderabad' ? 'Hyd' : city;
}

export function getLocationKey(country: string, city: string): LocationKey {
    const normalizedCity = normalizeCity(city);
    return (RATE_CARD_LOCATIONS.find((loc) => loc.country === country && loc.city === normalizedCity)?.key || DEFAULT_LOCATION_KEY) as LocationKey;
}

export function getLocationParts(locationKey?: string, country?: string, city?: string) {
    const byKey = RATE_CARD_LOCATIONS.find((loc) => loc.key === locationKey);
    if (byKey) return { country: byKey.country, city: byKey.city };
    if (country) {
        const cities = getCitiesForCountry(country);
        const normalizedCity = normalizeCity(city || '');
        return { country, city: normalizedCity && cities.includes(normalizedCity) ? normalizedCity : (cities[0] || '') };
    }
    const defaultLoc = RATE_CARD_LOCATIONS[0];
    return { country: defaultLoc.country, city: defaultLoc.city };
}

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
