import { calculateOpportunityProbability } from '../lib/opportunity-probability';

describe('calculateOpportunityProbability', () => {
  it('uses the stage base probability with no completeness data', () => {
    expect(calculateOpportunityProbability({ currentStage: 'Discovery' })).toBe(10);
    expect(calculateOpportunityProbability({ currentStage: 'Qualification' })).toBe(25);
    expect(calculateOpportunityProbability({ currentStage: 'Proposal' })).toBe(50);
    expect(calculateOpportunityProbability({ currentStage: 'Negotiation' })).toBe(75);
    expect(calculateOpportunityProbability({ currentStage: 'Closed Won' })).toBe(100);
    expect(calculateOpportunityProbability({ currentStage: 'Closed Lost' })).toBe(0);
  });

  it('defaults unknown stages to 10', () => {
    expect(calculateOpportunityProbability({ currentStage: 'Banana' })).toBe(10);
    expect(calculateOpportunityProbability({})).toBe(10);
  });

  it('prefers stage.name over currentStage', () => {
    expect(
      calculateOpportunityProbability({ stage: { name: 'Proposal' }, currentStage: 'Discovery' }),
    ).toBe(50);
  });

  it('adds a completeness bonus of round(count * 1.5), capped at base + 15', () => {
    // Qualification base 25, all 6 completeness signals present => round(6*1.5)=9 => 34, cap 40
    const fully = calculateOpportunityProbability({
      currentStage: 'Qualification',
      presalesData: { a: 1 },
      salesData: { b: 1 },
      expectedCloseDate: '2026-12-31',
      description: 'something',
      tentativeDuration: 5,
      expectedDayRate: 100,
    });
    expect(fully).toBe(34);
  });

  it('caps the bonus at base + 15 (Proposal cannot exceed 65)', () => {
    const result = calculateOpportunityProbability({
      currentStage: 'Proposal',
      presalesData: { a: 1 },
      salesData: { b: 1 },
      expectedCloseDate: '2026-12-31',
      description: 'something',
      tentativeDuration: 5,
      expectedDayRate: 100,
    });
    // base 50 + round(9) = 59, under cap 65
    expect(result).toBe(59);
  });

  it('never exceeds 100 for Closed Won', () => {
    const result = calculateOpportunityProbability({
      currentStage: 'Closed Won',
      presalesData: { a: 1 },
      salesData: { b: 1 },
      expectedCloseDate: '2026-12-31',
      description: 'something',
      tentativeDuration: 5,
      expectedDayRate: 100,
    });
    expect(result).toBe(100);
  });

  it('treats an empty presalesData object as "no data"', () => {
    const empty = calculateOpportunityProbability({ currentStage: 'Proposal', presalesData: {} });
    expect(empty).toBe(50);
    const present = calculateOpportunityProbability({ currentStage: 'Proposal', presalesData: { x: 1 } });
    // base 50 + round(1*1.5)=2 => 52
    expect(present).toBe(52);
  });

  it('only counts a positive expectedDayRate', () => {
    expect(calculateOpportunityProbability({ currentStage: 'Proposal', expectedDayRate: 0 })).toBe(50);
    expect(calculateOpportunityProbability({ currentStage: 'Proposal', expectedDayRate: '0' })).toBe(50);
    // base 50 + round(1*1.5)=2 => 52
    expect(calculateOpportunityProbability({ currentStage: 'Proposal', expectedDayRate: '500' })).toBe(52);
  });
});
