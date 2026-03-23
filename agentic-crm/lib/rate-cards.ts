import { apiClient } from './api';

export interface RateCardEntry {
    id: string;
    code: string;
    role: string;
    skill: string;
    experienceBand: string;
    ctc: number;
    category: string;
    isActive: boolean;
}

export const MOCK_ASSUMPTIONS = {
    marginPercent: 35,
    benchPercent: 10,
    workingDaysPerYear: 240,
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
            annualCtc: r.ctc,
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
