import {
  calculateRateCard,
  calculateProjectGom,
  type BudgetAssumptions,
  type ResourceLine,
  type OtherCost,
} from '../lib/gom-calculator';

const ZERO_ASSUMPTIONS: BudgetAssumptions = {
  marginPercent: 0,
  deliveryMgmtPercent: 0,
  benchPercent: 0,
  leaveEligibilityPercent: 0,
  annualGrowthBufferPercent: 0,
  averageIncrementPercent: 0,
  workingDaysPerYear: 240,
  bonusPercent: 0,
  indirectCostPercent: 0,
  welfarePerFte: 0,
  trainingPerFte: 0,
};

describe('calculateRateCard', () => {
  it('returns CTC unchanged when all loadings are zero', () => {
    const result = calculateRateCard({ ...ZERO_ASSUMPTIONS, annualCtc: 1_200_000, monthsPerYear: 12 });
    expect(result.adjustedCost).toBe(1_200_000);
    expect(result.monthlyCost).toBe(100_000);
    expect(result.dailyCost).toBe(5_000); // 1.2M / 240
  });

  it('adds each loading as a percentage of CTC', () => {
    const result = calculateRateCard({
      ...ZERO_ASSUMPTIONS,
      annualCtc: 1_000_000,
      monthsPerYear: 12,
      deliveryMgmtPercent: 10,
      benchPercent: 5,
      leaveEligibilityPercent: 5,
      annualGrowthBufferPercent: 5,
      averageIncrementPercent: 5,
    });
    // 1,000,000 * (1 + 0.30) = 1,300,000
    expect(result.adjustedCost).toBe(1_300_000);
    expect(result.monthlyCost).toBeCloseTo(108_333.33, 2);
    expect(result.dailyCost).toBeCloseTo(5_416.67, 2);
  });
});

describe('calculateProjectGom', () => {
  const line = (over: Partial<ResourceLine> = {}): ResourceLine => ({
    id: 'r1',
    role: 'Dev',
    location: 'Offshore',
    dailyRate: 1_000,
    dailyCost: 500,
    months: [{ month: '2026-01', days: 20 }],
    ...over,
  });

  it('computes revenue, cost and GOM% for a single resource-month (no overheads)', () => {
    const result = calculateProjectGom([line()], [], ZERO_ASSUMPTIONS);
    expect(result.totalRevenue).toBe(20_000); // 20 * 1000
    expect(result.totalCost).toBe(10_000); // 20 * 500
    expect(result.gomFull).toBe(10_000);
    expect(result.gomPercent).toBe(50);
    expect(result.monthlyData['2026-01'].gom).toBe(10_000);
  });

  it('applies bonus as a percentage of salary', () => {
    const result = calculateProjectGom([line()], [], { ...ZERO_ASSUMPTIONS, bonusPercent: 10 });
    // salary 10,000 + bonus 1,000 = 11,000 cost
    expect(result.totalCost).toBe(11_000);
    expect(result.gomFull).toBe(9_000);
    expect(result.gomPercent).toBeCloseTo(45, 5);
  });

  it('applies fixed per-FTE welfare/training pro-rated by FTE', () => {
    // 20 days at 20 working-days/month => 1.0 FTE => welfare = 1200/12 = 100
    const result = calculateProjectGom([line()], [], { ...ZERO_ASSUMPTIONS, welfarePerFte: 1_200 });
    expect(result.totalCost).toBe(10_100);
  });

  it('skips resource-months with zero or negative days', () => {
    const result = calculateProjectGom(
      [line({ months: [{ month: '2026-01', days: 0 }, { month: '2026-02', days: -5 }] })],
      [],
      ZERO_ASSUMPTIONS,
    );
    expect(result.totalRevenue).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it('adds manual other-costs to the matching month and total', () => {
    const others: OtherCost[] = [{ id: 'o1', description: 'Travel', amount: 5_000, month: '2026-01', category: 'Travel' }];
    const result = calculateProjectGom([line()], others, ZERO_ASSUMPTIONS);
    expect(result.totalCost).toBe(15_000); // 10,000 salary + 5,000 travel
    expect(result.monthlyData['2026-01'].other).toBe(5_000);
  });

  it('aggregates multiple resources across months', () => {
    const result = calculateProjectGom(
      [
        line({ id: 'a', months: [{ month: '2026-01', days: 20 }] }),
        line({ id: 'b', dailyRate: 2_000, dailyCost: 1_000, months: [{ month: '2026-02', days: 10 }] }),
      ],
      [],
      ZERO_ASSUMPTIONS,
    );
    // rev: 20*1000 + 10*2000 = 40,000 ; cost: 20*500 + 10*1000 = 20,000
    expect(result.totalRevenue).toBe(40_000);
    expect(result.totalCost).toBe(20_000);
    expect(Object.keys(result.monthlyData).sort()).toEqual(['2026-01', '2026-02']);
  });

  it('guards against divide-by-zero with no revenue', () => {
    const result = calculateProjectGom([], [], ZERO_ASSUMPTIONS);
    expect(result.totalRevenue).toBe(0);
    expect(result.gomPercent).toBe(0);
  });
});
