import {
  scoreQualification,
  resolveQualificationConfig,
  DEFAULT_QUALIFICATION_CONFIG,
  QUALIFICATION_DIMENSION_KEYS,
  type QualificationConfig,
} from '../lib/opportunity-qualification';

const full = (b: number, a: number, n: number, t: number, d: number) => ({
  budget: b, authority: a, need: n, timeline: t, deliverability: d,
});

describe('scoreQualification — outcomes', () => {
  it('is Incomplete until every dimension is answered', () => {
    const r = scoreQualification({ budget: 2, authority: 2 });
    expect(r.complete).toBe(false);
    expect(r.status).toBe('Incomplete');
    expect(r.isQualified).toBe(false);
  });

  it('Qualified when the score clears the pass threshold', () => {
    // 2+2+2+1+1 = 8 >= 7
    const r = scoreQualification(full(2, 2, 2, 1, 1));
    expect(r.score).toBe(8);
    expect(r.maxScore).toBe(10);
    expect(r.status).toBe('Qualified');
    expect(r.isQualified).toBe(true);
  });

  it('Needs Review in the middle band', () => {
    // 1+1+1+1+1 = 5 → between 4 and 7
    const r = scoreQualification(full(1, 1, 1, 1, 1));
    expect(r.score).toBe(5);
    expect(r.status).toBe('Needs Review');
    expect(r.isQualified).toBe(false);
  });

  it('Not Qualified below the needs-review floor', () => {
    // 1+0+1+0+1 = 3 < 4 (deliverability = 1 so the gap gate does not fire)
    const r = scoreQualification(full(1, 0, 1, 0, 1));
    expect(r.score).toBe(3);
    expect(r.status).toBe('Not Qualified');
    expect(r.reasons).toContain('belowNeedsReview');
  });
});

describe('scoreQualification — deliverability hard gate', () => {
  it('forces Not Qualified when Deliverability is a Gap, even with a high score', () => {
    // 2+2+2+2+0 = 8 (>=7) but deliverability = 0
    const r = scoreQualification(full(2, 2, 2, 2, 0));
    expect(r.score).toBe(8);
    expect(r.status).toBe('Not Qualified');
    expect(r.isQualified).toBe(false);
    expect(r.reasons).toContain('deliverabilityGap');
  });

  it('can be disabled by config', () => {
    const cfg: QualificationConfig = { ...DEFAULT_QUALIFICATION_CONFIG, deliverabilityGate: false };
    const r = scoreQualification(full(2, 2, 2, 2, 0), cfg);
    expect(r.status).toBe('Qualified');
  });
});

describe('scoreQualification — configurability', () => {
  it('respects a lowered pass threshold', () => {
    const cfg: QualificationConfig = { ...DEFAULT_QUALIFICATION_CONFIG, passThreshold: 5 };
    expect(scoreQualification(full(1, 1, 1, 1, 1), cfg).status).toBe('Qualified');
  });

  it('respects per-dimension weights', () => {
    const cfg: QualificationConfig = {
      ...DEFAULT_QUALIFICATION_CONFIG,
      weights: { ...DEFAULT_QUALIFICATION_CONFIG.weights, budget: 3 },
    };
    // budget 2*3=6, rest 1+1+1+1 = 4 → 10; maxScore = 2*(3+1+1+1+1)=14
    const r = scoreQualification(full(2, 1, 1, 1, 1), cfg);
    expect(r.score).toBe(10);
    expect(r.maxScore).toBe(14);
  });

  it('treats invalid answer levels as unanswered', () => {
    const r = scoreQualification({ ...full(2, 2, 2, 2, 2), need: 9 as any });
    expect(r.complete).toBe(false);
  });
});

describe('resolveQualificationConfig', () => {
  it('returns defaults for null / empty', () => {
    expect(resolveQualificationConfig(null)).toEqual(DEFAULT_QUALIFICATION_CONFIG);
    expect(resolveQualificationConfig({})).toEqual(DEFAULT_QUALIFICATION_CONFIG);
  });

  it('merges partial input and ignores malformed numbers', () => {
    const merged = resolveQualificationConfig({ passThreshold: 8, weights: { budget: 'x', authority: 2 } });
    expect(merged.passThreshold).toBe(8);
    expect(merged.weights.budget).toBe(DEFAULT_QUALIFICATION_CONFIG.weights.budget);
    expect(merged.weights.authority).toBe(2);
  });

  it('validates gateMode', () => {
    expect(resolveQualificationConfig({ gateMode: 'warn' }).gateMode).toBe('warn');
    expect(resolveQualificationConfig({ gateMode: 'nonsense' }).gateMode).toBe('block');
  });

  it('exposes exactly the five BANT + deliverability dimensions', () => {
    expect(QUALIFICATION_DIMENSION_KEYS).toEqual(['budget', 'authority', 'need', 'timeline', 'deliverability']);
  });
});
