import {
  calculateRateCard,
  calculateProjectGom,
  type BudgetAssumptions,
  type ResourceLine,
  type OtherCost,
} from '@/lib/gom-calculator';

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

const line = (over: Partial<ResourceLine> = {}): ResourceLine => ({
  id: 'r1',
  role: 'Dev',
  location: 'Offshore',
  dailyRate: 1_000,
  dailyCost: 500,
  months: [{ month: '2026-01', days: 20 }],
  ...over,
});

describe('calculateRateCard', () => {
  it('loads CTC by the sum of overhead percentages', () => {
    const r = calculateRateCard({
      ...ZERO_ASSUMPTIONS,
      annualCtc: 1_000_000,
      monthsPerYear: 12,
      deliveryMgmtPercent: 20,
    });
    expect(r.adjustedCost).toBe(1_200_000);
    expect(r.dailyCost).toBe(5_000); // 1.2M / 240
  });
});

describe('calculateProjectGom', () => {
  it('computes revenue, cost and GOM% with no overheads', () => {
    const r = calculateProjectGom([line()], [], ZERO_ASSUMPTIONS);
    expect(r.totalRevenue).toBe(20_000);
    expect(r.totalCost).toBe(10_000);
    expect(r.gomPercent).toBe(50);
    expect(r.monthlyData['2026-01'].salary).toBe(10_000);
    expect(r.monthlyData['2026-01'].overhead).toBe(0);
  });

  it('decomposes loaded cost into salary + overhead without changing total cost', () => {
    // overheadPct = 0.2 => rawSalary = 10,000 / 1.2 = 8,333.33 ; overhead = 1,666.67
    const r = calculateProjectGom([line()], [], { ...ZERO_ASSUMPTIONS, deliveryMgmtPercent: 20 });
    expect(r.monthlyData['2026-01'].salary).toBeCloseTo(8_333.33, 2);
    expect(r.monthlyData['2026-01'].overhead).toBeCloseTo(1_666.67, 2);
    // total cost is still the loaded cost (decomposition is display-only)
    expect(r.totalCost).toBeCloseTo(10_000, 5);
    expect(r.gomPercent).toBeCloseTo(50, 5);
  });

  it('applies bonus on the raw (de-loaded) salary', () => {
    // no org overhead => rawSalary = 10,000 ; bonus 10% = 1,000 => cost 11,000
    const r = calculateProjectGom([line()], [], { ...ZERO_ASSUMPTIONS, bonusPercent: 10 });
    expect(r.totalCost).toBe(11_000);
    expect(r.gomPercent).toBeCloseTo(45, 5);
  });

  it('adds other-costs and aggregates across resources/months', () => {
    const others: OtherCost[] = [{ id: 'o', description: 'Lic', amount: 2_500, month: '2026-01', category: 'Misc' }];
    const r = calculateProjectGom(
      [line(), line({ id: 'b', months: [{ month: '2026-02', days: 10 }] })],
      others,
      ZERO_ASSUMPTIONS,
    );
    // rev: 20,000 + 10,000 = 30,000 ; cost: 10,000 + 5,000 + 2,500 other = 17,500
    expect(r.totalRevenue).toBe(30_000);
    expect(r.totalCost).toBe(17_500);
    expect(r.monthlyData['2026-01'].other).toBe(2_500);
  });

  it('returns zeros for an empty estimation', () => {
    const r = calculateProjectGom([], [], ZERO_ASSUMPTIONS);
    expect(r.totalRevenue).toBe(0);
    expect(r.totalCost).toBe(0);
    expect(r.gomPercent).toBe(0);
  });
});
