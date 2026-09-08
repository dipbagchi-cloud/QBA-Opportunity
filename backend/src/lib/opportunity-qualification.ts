/**
 * CR-02 — Deal Qualification Framework (BANT + Deliverability).
 *
 * A post-Discovery checklist across five dimensions — Budget/Funding,
 * Authority, Need, Timeline and QBA Deliverability/Product Readiness — scored
 * into an outcome (Qualified / Needs Review / Not Qualified) that gates entry
 * into the qualified pipeline and feeds the CR-01 Hot classifier via the
 * `isQualified` flag.
 *
 * Each dimension is answered on a fixed 3-point scale (0 weak, 1 partial,
 * 2 strong). The dimensions and their scale are stable in code; the WEIGHTS,
 * thresholds, the Deliverability hard-gate and the block/warn behaviour are
 * data-driven (systemConfig key `qualification_framework`) so Sales Leadership
 * can tune them without a deploy — the same pattern as `opportunity-hot.ts`.
 *
 * The meeting deliberately left the numeric model open (see the CR document's
 * "Decision Pending"); the defaults here are a proposal for sign-off, not an
 * assumed rule.
 *
 * Pure and framework-free so it can be unit-tested in isolation.
 */

export const QUALIFICATION_DIMENSION_KEYS = [
  'budget',
  'authority',
  'need',
  'timeline',
  'deliverability',
] as const;

export type QualificationDimensionKey = (typeof QUALIFICATION_DIMENSION_KEYS)[number];

/** Dimension labels + the meaning of each 0/1/2 level, for the UI and admin. */
export const QUALIFICATION_DIMENSIONS: {
  key: QualificationDimensionKey;
  label: string;
  options: { points: 0 | 1 | 2; label: string }[];
}[] = [
  {
    key: 'budget',
    label: 'Budget / Funding',
    options: [
      { points: 2, label: 'Confirmed' },
      { points: 1, label: 'Estimated' },
      { points: 0, label: 'None / Unknown' },
    ],
  },
  {
    key: 'authority',
    label: 'Authority',
    options: [
      { points: 2, label: 'Decision-maker engaged' },
      { points: 1, label: 'Influencer only' },
      { points: 0, label: 'Unknown' },
    ],
  },
  {
    key: 'need',
    label: 'Need',
    options: [
      { points: 2, label: 'Defined & urgent' },
      { points: 1, label: 'Defined' },
      { points: 0, label: 'Vague' },
    ],
  },
  {
    key: 'timeline',
    label: 'Timeline',
    options: [
      { points: 2, label: 'Committed date' },
      { points: 1, label: 'Rough' },
      { points: 0, label: 'None' },
    ],
  },
  {
    key: 'deliverability',
    label: 'QBA Deliverability / Product Readiness',
    options: [
      { points: 2, label: 'Proven capability + capacity' },
      { points: 1, label: 'Partial' },
      { points: 0, label: 'Gap' },
    ],
  },
];

export type QualificationWeights = Record<QualificationDimensionKey, number>;

export interface QualificationConfig {
  /** When false, the qualification gate is not enforced on stage progression. */
  enabled: boolean;
  weights: QualificationWeights;
  /** score >= passThreshold → Qualified. */
  passThreshold: number;
  /** passThreshold > score >= needsReviewMin → Needs Review. */
  needsReviewMin: number;
  /** Deliverability = Gap (0) forces Not Qualified regardless of score. */
  deliverabilityGate: boolean;
  /** 'block' rejects progression of an unqualified deal; 'warn' allows it. */
  gateMode: 'block' | 'warn';
}

export const DEFAULT_QUALIFICATION_CONFIG: QualificationConfig = {
  enabled: true,
  weights: { budget: 1, authority: 1, need: 1, timeline: 1, deliverability: 1 },
  passThreshold: 7,
  needsReviewMin: 4,
  deliverabilityGate: true,
  gateMode: 'block',
};

export type QualificationStatus = 'Qualified' | 'Needs Review' | 'Not Qualified' | 'Incomplete';

/** Raw answers: dimension key → level 0/1/2 (missing/invalid = not answered). */
export type QualificationAnswers = Partial<Record<QualificationDimensionKey, number | null>>;

export interface QualificationResult {
  score: number;
  maxScore: number;
  status: QualificationStatus;
  isQualified: boolean;
  /** True once every dimension has a valid answer. */
  complete: boolean;
  reasons: string[];
}

function toLevel(value: unknown): 0 | 1 | 2 | null {
  const n = Number(value);
  if (n === 0 || n === 1 || n === 2) return n;
  return null;
}

/** Merge stored config with defaults, tolerating partial/malformed input. */
export function resolveQualificationConfig(raw: unknown): QualificationConfig {
  const v = raw && typeof raw === 'object' ? (raw as any) : {};
  const w = v.weights && typeof v.weights === 'object' ? v.weights : {};
  const num = (x: any, d: number): number => {
    const n = Number(x);
    return Number.isFinite(n) ? n : d;
  };
  const d = DEFAULT_QUALIFICATION_CONFIG;
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : d.enabled,
    weights: {
      budget: num(w.budget, d.weights.budget),
      authority: num(w.authority, d.weights.authority),
      need: num(w.need, d.weights.need),
      timeline: num(w.timeline, d.weights.timeline),
      deliverability: num(w.deliverability, d.weights.deliverability),
    },
    passThreshold: num(v.passThreshold, d.passThreshold),
    needsReviewMin: num(v.needsReviewMin, d.needsReviewMin),
    deliverabilityGate: typeof v.deliverabilityGate === 'boolean' ? v.deliverabilityGate : d.deliverabilityGate,
    gateMode: v.gateMode === 'warn' ? 'warn' : 'block',
  };
}

/**
 * Score a set of BANT + Deliverability answers into an outcome.
 *
 * Missing answers score zero but mark the result `complete: false`, so an
 * unfinished checklist can never read as Qualified. The Deliverability gate is
 * applied only once the checklist is complete.
 */
export function scoreQualification(
  answers: QualificationAnswers,
  config: QualificationConfig = DEFAULT_QUALIFICATION_CONFIG,
): QualificationResult {
  const reasons: string[] = [];
  const w = config.weights;

  let score = 0;
  let maxScore = 0;
  let complete = true;
  for (const key of QUALIFICATION_DIMENSION_KEYS) {
    const weight = w[key];
    maxScore += 2 * weight;
    const level = toLevel(answers[key]);
    if (level === null) {
      complete = false;
      continue;
    }
    score += level * weight;
  }

  const deliverabilityLevel = toLevel(answers.deliverability);
  const deliverabilityGap = config.deliverabilityGate && deliverabilityLevel === 0;

  let status: QualificationStatus;
  if (!complete) {
    status = 'Incomplete';
    reasons.push('incomplete');
  } else if (deliverabilityGap) {
    status = 'Not Qualified';
    reasons.push('deliverabilityGap');
  } else if (score >= config.passThreshold) {
    status = 'Qualified';
  } else if (score >= config.needsReviewMin) {
    status = 'Needs Review';
    reasons.push('belowPassThreshold');
  } else {
    status = 'Not Qualified';
    reasons.push('belowNeedsReview');
  }

  return {
    score,
    maxScore,
    status,
    isQualified: status === 'Qualified',
    complete,
    reasons,
  };
}
