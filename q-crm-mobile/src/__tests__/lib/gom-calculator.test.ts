/**
 * Unit tests for the GOM calculator pure functions.
 * No React, no mocks needed — just math.
 */
import {
  calculateRateCard,
  calculateProjectGom,
} from '../../lib/gom-calculator';
import type {
  RateCardParams,
  ResourceLine,
  OtherCost,
  BudgetAssumptions,
} from '../../lib/gom-calculator';
import {mockBudgetAssumptions} from '../setup/mock-data';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal assumptions — all overheads at 0 so raw math is simple. */
const zeroAssumptions: BudgetAssumptions = mockBudgetAssumptions;

function makeLine(
  dailyRate: number,
  dailyCost: number,
  days: number,
  month = '2026-01',
): ResourceLine {
  return {
    id: `line-${Math.random()}`,
    role: 'Consultant',
    location: 'Offshore',
    dailyRate,
    dailyCost,
    months: [{month, days}],
  };
}

// ─── calculateRateCard ────────────────────────────────────────────────────────

describe('calculateRateCard', () => {
  const baseParams: RateCardParams = {
    annualCtc: 120_000,
    monthsPerYear: 12,
    marginPercent: 0,
    deliveryMgmtPercent: 0,
    benchPercent: 0,
    leaveEligibilityPercent: 0,
    annualGrowthBufferPercent: 0,
    averageIncrementPercent: 0,
    workingDaysPerYear: 250,
    bonusPercent: 0,
    indirectCostPercent: 0,
    welfarePerFte: 0,
    trainingPerFte: 0,
  };

  it('returns correct adjustedCost when all overheads are 0', () => {
    const result = calculateRateCard(baseParams);
    expect(result.adjustedCost).toBe(120_000);
  });

  it('calculates monthly cost as adjustedCost / 12', () => {
    const result = calculateRateCard(baseParams);
    expect(result.monthlyCost).toBeCloseTo(120_000 / 12, 4);
  });

  it('calculates daily cost as adjustedCost / workingDaysPerYear', () => {
    const result = calculateRateCard(baseParams);
    expect(result.dailyCost).toBeCloseTo(120_000 / 250, 4);
  });

  it('adds delivery management overhead to annual cost', () => {
    const params: RateCardParams = {...baseParams, deliveryMgmtPercent: 10};
    const result = calculateRateCard(params);
    // 120k + 10% = 132k
    expect(result.adjustedCost).toBeCloseTo(132_000, 2);
  });

  it('combines multiple overheads correctly', () => {
    const params: RateCardParams = {
      ...baseParams,
      deliveryMgmtPercent: 5, // +6k
      benchPercent: 5,        // +6k
    };
    const result = calculateRateCard(params);
    expect(result.adjustedCost).toBeCloseTo(132_000, 2);
  });
});

// ─── calculateProjectGom ─────────────────────────────────────────────────────

describe('calculateProjectGom', () => {
  describe('basic GOM calculation', () => {
    it('calculates 30% GOM when dailyRate=100, dailyCost=70, 10 days', () => {
      const line = makeLine(100, 70, 10);
      const result = calculateProjectGom([line], [], zeroAssumptions);

      expect(result.totalRevenue).toBeCloseTo(1000, 4);
      expect(result.totalCost).toBeCloseTo(700, 4);
      expect(result.gomFull).toBeCloseTo(300, 4);
      expect(result.gomPercent).toBeCloseTo(30, 4);
    });

    it('calculates 25% GOM when dailyRate=100, dailyCost=75', () => {
      const line = makeLine(100, 75, 10);
      const result = calculateProjectGom([line], [], zeroAssumptions);

      expect(result.gomPercent).toBeCloseTo(25, 4);
    });

    it('calculates 15% GOM when dailyRate=100, dailyCost=85', () => {
      const line = makeLine(100, 85, 10);
      const result = calculateProjectGom([line], [], zeroAssumptions);

      expect(result.gomPercent).toBeCloseTo(15, 4);
    });

    it('calculates 0% when revenue equals cost exactly', () => {
      const line = makeLine(100, 100, 10);
      const result = calculateProjectGom([line], [], zeroAssumptions);

      expect(result.gomPercent).toBeCloseTo(0, 4);
      expect(result.gomFull).toBeCloseTo(0, 4);
    });
  });

  describe('GOM thresholds (status labelling in screens)', () => {
    it('gomPercent >= 30 qualifies as "Good"', () => {
      const line = makeLine(100, 70, 10); // 30%
      const result = calculateProjectGom([line], [], zeroAssumptions);

      const label =
        result.gomPercent >= 30
          ? 'Good'
          : result.gomPercent >= 15
          ? 'Acceptable'
          : 'Below Target';
      expect(label).toBe('Good');
    });

    it('gomPercent >= 15 and < 30 qualifies as "Acceptable"', () => {
      const line = makeLine(100, 75, 10); // 25%
      const result = calculateProjectGom([line], [], zeroAssumptions);

      const label =
        result.gomPercent >= 30
          ? 'Good'
          : result.gomPercent >= 15
          ? 'Acceptable'
          : 'Below Target';
      expect(label).toBe('Acceptable');
    });

    it('gomPercent < 15 qualifies as "Below Target"', () => {
      const line = makeLine(100, 90, 10); // 10%
      const result = calculateProjectGom([line], [], zeroAssumptions);

      const label =
        result.gomPercent >= 30
          ? 'Good'
          : result.gomPercent >= 15
          ? 'Acceptable'
          : 'Below Target';
      expect(label).toBe('Below Target');
    });
  });

  describe('edge cases', () => {
    it('returns gomPercent=0 for zero resources (no revenue)', () => {
      const result = calculateProjectGom([], [], zeroAssumptions);

      expect(result.totalRevenue).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.gomPercent).toBe(0);
    });

    it('skips months with 0 days', () => {
      const line: ResourceLine = {
        id: 'line-zero',
        role: 'Dev',
        location: 'Offshore',
        dailyRate: 100,
        dailyCost: 70,
        months: [
          {month: '2026-01', days: 0},
          {month: '2026-02', days: 10},
        ],
      };
      const result = calculateProjectGom([line], [], zeroAssumptions);

      // Only Feb should contribute
      expect(result.totalRevenue).toBeCloseTo(1000, 4);
      expect(result.gomPercent).toBeCloseTo(30, 4);
    });

    it('includes other costs in totalCost', () => {
      const line = makeLine(100, 70, 10); // revenue=1000, cost=700
      const travel: OtherCost = {
        id: 'other-001',
        description: 'Travel',
        amount: 100,
        month: '2026-01',
        category: 'Travel',
      };
      const result = calculateProjectGom([line], [travel], zeroAssumptions);

      expect(result.totalCost).toBeCloseTo(800, 4);
      expect(result.gomFull).toBeCloseTo(200, 4);
      expect(result.gomPercent).toBeCloseTo(20, 4);
    });

    it('sums multiple resource lines', () => {
      const line1 = makeLine(100, 70, 10, '2026-01'); // rev 1000, cost 700
      const line2 = makeLine(150, 100, 10, '2026-01'); // rev 1500, cost 1000
      const result = calculateProjectGom([line1, line2], [], zeroAssumptions);

      expect(result.totalRevenue).toBeCloseTo(2500, 4);
      expect(result.totalCost).toBeCloseTo(1700, 4);
      expect(result.gomPercent).toBeCloseTo(32, 4);
    });
  });

  describe('monthly breakdown', () => {
    it('populates monthlyData for each month', () => {
      const line: ResourceLine = {
        id: 'line-multi',
        role: 'Dev',
        location: 'Offshore',
        dailyRate: 100,
        dailyCost: 70,
        months: [
          {month: '2026-01', days: 10},
          {month: '2026-02', days: 5},
        ],
      };
      const result = calculateProjectGom([line], [], zeroAssumptions);

      expect(result.monthlyData['2026-01']).toBeDefined();
      expect(result.monthlyData['2026-02']).toBeDefined();
      expect(result.monthlyData['2026-01'].revenue).toBeCloseTo(1000, 4);
      expect(result.monthlyData['2026-02'].revenue).toBeCloseTo(500, 4);
    });

    it('monthlyData GOM = revenue - cost for each month', () => {
      const line = makeLine(100, 70, 10, '2026-01');
      const result = calculateProjectGom([line], [], zeroAssumptions);

      const jan = result.monthlyData['2026-01'];
      expect(jan.gom).toBeCloseTo(jan.revenue - jan.cost, 4);
    });
  });

  describe('bonus and overhead calculation', () => {
    it('applies bonusPercent to salary cost', () => {
      const assumptions: BudgetAssumptions = {
        ...zeroAssumptions,
        bonusPercent: 10, // 10% of salary
      };
      const line = makeLine(100, 70, 10);
      const result = calculateProjectGom([line], [], assumptions);

      // salary = 700, bonus = 70
      expect(result.totalCost).toBeCloseTo(770, 4);
    });

    it('applies indirectCostPercent to salary cost', () => {
      const assumptions: BudgetAssumptions = {
        ...zeroAssumptions,
        indirectCostPercent: 5,
      };
      const line = makeLine(100, 70, 10);
      const result = calculateProjectGom([line], [], assumptions);

      // salary = 700, indirect = 35
      expect(result.totalCost).toBeCloseTo(735, 4);
    });
  });
});
