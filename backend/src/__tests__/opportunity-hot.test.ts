import {
  classifyHot,
  resolveHotConfig,
  hasCommittedQuote,
  DEFAULT_HOT_CONFIG,
  type HotClassificationConfig,
} from '../lib/opportunity-hot';

// Fixed clock so the "closing soon" window is deterministic.
const NOW = new Date('2026-09-08T00:00:00.000Z');
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

const quote = { finalRevenue: 500000 };

describe('hasCommittedQuote', () => {
  it('recognises the committed-quote fields, in precedence order', () => {
    expect(hasCommittedQuote({ finalRevenue: 100 })).toBe(true);
    expect(hasCommittedQuote({ totalRevenue: 100 })).toBe(true);
    expect(hasCommittedQuote({ gomSummary: { totalRevenue: 100 } })).toBe(true);
  });
  it('is false for missing, zero or non-numeric revenue', () => {
    expect(hasCommittedQuote(null)).toBe(false);
    expect(hasCommittedQuote({})).toBe(false);
    expect(hasCommittedQuote({ finalRevenue: 0 })).toBe(false);
    expect(hasCommittedQuote({ finalRevenue: 'abc' })).toBe(false);
  });
});

describe('classifyHot — core CR-01 guarantee', () => {
  it('does NOT make a freshly-touched but immature deal Hot (no activity input exists)', () => {
    // Discovery, no quote, no close date — nothing an edit could change.
    const r = classifyHot({ currentStage: 'Discovery' }, DEFAULT_HOT_CONFIG, NOW);
    expect(r.hotScore).toBe(0);
    expect(r.isHot).toBe(false);
  });

  it('classifies a mature deal Hot: proposal stage + committed quote + closing soon', () => {
    const r = classifyHot(
      { currentStage: 'Proposal', presalesData: quote, expectedCloseDate: inDays(30) },
      DEFAULT_HOT_CONFIG,
      NOW,
    );
    expect(r.hotScore).toBe(80); // 40 + 20 + 20
    expect(r.isHot).toBe(true);
    expect(r.reasons).toEqual(expect.arrayContaining(['proposalSent', 'stageProposalPlus', 'closingSoon']));
  });

  it('treats the threshold as the boundary (quote + stage = 60 = threshold → Hot)', () => {
    const r = classifyHot(
      { currentStage: 'Proposal', presalesData: quote, expectedCloseDate: inDays(400) },
      DEFAULT_HOT_CONFIG,
      NOW,
    );
    expect(r.hotScore).toBe(60);
    expect(r.isHot).toBe(true);
  });

  it('a committed quote alone (early stage, no close) is not enough', () => {
    const r = classifyHot({ currentStage: 'Qualification', presalesData: quote }, DEFAULT_HOT_CONFIG, NOW);
    expect(r.hotScore).toBe(40);
    expect(r.isHot).toBe(false);
  });
});

describe('classifyHot — guards', () => {
  it('an overdue close date does not count as closing soon', () => {
    const r = classifyHot(
      { currentStage: 'Proposal', presalesData: quote, expectedCloseDate: inDays(-5) },
      DEFAULT_HOT_CONFIG,
      NOW,
    );
    expect(r.reasons).not.toContain('closingSoon');
    expect(r.hotScore).toBe(60);
  });

  it('suppresses Hot for On Hold deals even when mature', () => {
    const r = classifyHot(
      { currentStage: 'Negotiation', presalesData: quote, expectedCloseDate: inDays(10), detailedStatus: 'On Hold' },
      DEFAULT_HOT_CONFIG,
      NOW,
    );
    expect(r.hotScore).toBe(80);
    expect(r.isHot).toBe(false);
    expect(r.reasons).toContain('suppressedOnHold');
  });

  it('closed or archived deals are never Hot', () => {
    expect(classifyHot({ stage: { name: 'Closed Won' }, presalesData: quote }, DEFAULT_HOT_CONFIG, NOW).isHot).toBe(false);
    expect(
      classifyHot({ currentStage: 'Proposal', presalesData: quote, expectedCloseDate: inDays(5), isArchived: true }, DEFAULT_HOT_CONFIG, NOW).isHot,
    ).toBe(false);
  });
});

describe('classifyHot — CR-02 qualification hook', () => {
  it('adds the qualified weight only when isQualified is true', () => {
    const base = { currentStage: 'Qualification', presalesData: quote }; // 40
    expect(classifyHot(base, DEFAULT_HOT_CONFIG, NOW).hotScore).toBe(40);
    const q = classifyHot({ ...base, isQualified: true }, DEFAULT_HOT_CONFIG, NOW);
    expect(q.hotScore).toBe(70); // 40 + 30
    expect(q.isHot).toBe(true);
    expect(q.reasons).toContain('qualified');
  });
});

describe('classifyHot — configurability', () => {
  it('respects a lowered threshold', () => {
    const opp = { currentStage: 'Qualification', presalesData: quote }; // 40
    const cfg: HotClassificationConfig = { ...DEFAULT_HOT_CONFIG, threshold: 40 };
    expect(classifyHot(opp, cfg, NOW).isHot).toBe(true);
  });

  it('respects a custom closing horizon', () => {
    const opp = { currentStage: 'Discovery', expectedCloseDate: inDays(120) };
    expect(classifyHot(opp, DEFAULT_HOT_CONFIG, NOW).reasons).not.toContain('closingSoon');
    const wide: HotClassificationConfig = { ...DEFAULT_HOT_CONFIG, closingHorizonDays: 180 };
    expect(classifyHot(opp, wide, NOW).reasons).toContain('closingSoon');
  });
});

describe('resolveHotConfig', () => {
  it('returns defaults for null / empty input', () => {
    expect(resolveHotConfig(null)).toEqual(DEFAULT_HOT_CONFIG);
    expect(resolveHotConfig({})).toEqual(DEFAULT_HOT_CONFIG);
  });

  it('merges partial input and ignores malformed numbers', () => {
    const merged = resolveHotConfig({ threshold: 75, weights: { proposalSent: 'oops', qualified: 10 } });
    expect(merged.threshold).toBe(75);
    expect(merged.weights.proposalSent).toBe(DEFAULT_HOT_CONFIG.weights.proposalSent); // fell back
    expect(merged.weights.qualified).toBe(10);
    expect(merged.closingHorizonDays).toBe(DEFAULT_HOT_CONFIG.closingHorizonDays);
  });

  it('honours enabled=false', () => {
    expect(resolveHotConfig({ enabled: false }).enabled).toBe(false);
  });
});
