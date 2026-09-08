import { checkStageEntry } from '../lib/opportunity-stage-gates';

const quote = { finalRevenue: 500000 };

describe('checkStageEntry — Negotiation requires a sent proposal', () => {
  it('blocks Negotiation when there is no committed quote', () => {
    const r = checkStageEntry('Negotiation', {});
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/no proposal has been sent/i);
  });

  it('allows Negotiation once a committed quote exists', () => {
    expect(checkStageEntry('Negotiation', { presalesData: quote }).allowed).toBe(true);
  });

  it('resolves the workflow-vocabulary target too', () => {
    // 'Negotiation' has no alias, but the resolver must not throw for others.
    expect(checkStageEntry('Sales', { presalesData: quote }).allowed).toBe(true); // → Proposal, no gate here
  });
});

describe('checkStageEntry — other stages are unrestricted here', () => {
  it('allows Discovery / Qualification / Proposal / closed without this gate', () => {
    for (const s of ['Discovery', 'Qualification', 'Proposal', 'Closed Won', 'Closed Lost']) {
      expect(checkStageEntry(s, {}).allowed).toBe(true);
    }
  });
});
