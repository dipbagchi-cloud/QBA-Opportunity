import {
  calculateOpportunityProbability,
  resolveProbabilityConfig,
  DEFAULT_PROBABILITY_CONFIG,
  type ProbabilityConfig,
} from '../lib/opportunity-probability';

const quote = { finalRevenue: 500000 };

describe('calculateOpportunityProbability — stage base', () => {
  it('uses the stage base (late stages need a committed quote to reach it)', () => {
    expect(calculateOpportunityProbability({ currentStage: 'Discovery' })).toBe(10);
    expect(calculateOpportunityProbability({ currentStage: 'Qualification' })).toBe(25);
    expect(calculateOpportunityProbability({ currentStage: 'Proposal', presalesData: quote })).toBe(50);
    expect(calculateOpportunityProbability({ currentStage: 'Negotiation', presalesData: quote })).toBe(75);
    expect(calculateOpportunityProbability({ currentStage: 'Closed Won' })).toBe(100);
    expect(calculateOpportunityProbability({ currentStage: 'Closed Lost' })).toBe(0);
  });

  it('defaults unknown stages to 10 and prefers stage.name over currentStage', () => {
    expect(calculateOpportunityProbability({ currentStage: 'Banana' })).toBe(10);
    expect(calculateOpportunityProbability({})).toBe(10);
    expect(calculateOpportunityProbability({ stage: { name: 'Proposal' }, currentStage: 'Discovery', presalesData: quote })).toBe(50);
  });

  it('resolves the workflow vocabulary via the stage registry', () => {
    expect(calculateOpportunityProbability({ currentStage: 'Presales' })).toBe(25); // → Qualification
    expect(calculateOpportunityProbability({ currentStage: 'Sales', presalesData: quote })).toBe(50); // → Proposal
  });
});

describe('calculateOpportunityProbability — CR-04 maturity guard (the 81% fix)', () => {
  it('caps a late-stage deal with no committed quote', () => {
    // Negotiation with no proposal sent → capped at 25, not 75 (and never 81).
    expect(calculateOpportunityProbability({ currentStage: 'Negotiation' })).toBe(25);
    expect(calculateOpportunityProbability({ currentStage: 'Proposal' })).toBe(25);
  });

  it('does NOT add any completeness bonus (the old +fields×1.5 term is gone)', () => {
    const loaded = {
      currentStage: 'Negotiation',
      presalesData: quote,
      salesData: { x: 1 },
      expectedCloseDate: '2026-10-01',
      description: 'full',
      tentativeDuration: 6,
      expectedDayRate: 500,
    };
    expect(calculateOpportunityProbability(loaded)).toBe(75); // exactly the base, not 81+
  });

  it('early stages are unaffected by the quote guard', () => {
    expect(calculateOpportunityProbability({ currentStage: 'Qualification' })).toBe(25);
    expect(calculateOpportunityProbability({ currentStage: 'Discovery' })).toBe(10);
  });
});

describe('calculateOpportunityProbability — configurability', () => {
  it('respects a custom late-stage cap', () => {
    const cfg: ProbabilityConfig = { ...DEFAULT_PROBABILITY_CONFIG, unquotedLateStageCap: 40 };
    expect(calculateOpportunityProbability({ currentStage: 'Negotiation' }, cfg)).toBe(40);
  });

  it('can disable the quote guard', () => {
    const cfg: ProbabilityConfig = { ...DEFAULT_PROBABILITY_CONFIG, requireQuoteForLateStage: false };
    expect(calculateOpportunityProbability({ currentStage: 'Negotiation' }, cfg)).toBe(75);
  });

  it('applies the optional qualification factor to unqualified deals past Discovery', () => {
    const cfg: ProbabilityConfig = { ...DEFAULT_PROBABILITY_CONFIG, qualificationFactor: 0.5 };
    // Qualification base 25, not qualified → 25 * 0.5 = 13 (rounded)
    expect(calculateOpportunityProbability({ currentStage: 'Qualification', isQualified: false }, cfg)).toBe(13);
    // Qualified → unaffected
    expect(calculateOpportunityProbability({ currentStage: 'Qualification', isQualified: true }, cfg)).toBe(25);
  });
});

describe('resolveProbabilityConfig', () => {
  it('returns defaults for null / empty', () => {
    expect(resolveProbabilityConfig(null)).toEqual(DEFAULT_PROBABILITY_CONFIG);
    expect(resolveProbabilityConfig({})).toEqual(DEFAULT_PROBABILITY_CONFIG);
  });

  it('merges a partial stage curve and ignores malformed numbers', () => {
    const merged = resolveProbabilityConfig({ stageBase: { Negotiation: 90, Proposal: 'x' }, unquotedLateStageCap: 30 });
    expect(merged.stageBase.Negotiation).toBe(90);
    expect(merged.stageBase.Proposal).toBe(DEFAULT_PROBABILITY_CONFIG.stageBase.Proposal); // fell back
    expect(merged.unquotedLateStageCap).toBe(30);
  });
});
