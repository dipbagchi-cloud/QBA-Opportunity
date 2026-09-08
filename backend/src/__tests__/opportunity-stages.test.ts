import {
  CANONICAL_STAGES,
  CANONICAL_STAGE_NAMES,
  STAGE_ALIASES,
  STAGE_DISPLAY_GROUP,
  resolveCanonicalStage,
  getStageMeta,
  stageOrder,
} from '../lib/opportunity-stages';

describe('canonical stage registry', () => {
  it('lists the six commercial stages in Stage-table order', () => {
    expect(CANONICAL_STAGE_NAMES).toEqual([
      'Discovery', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost',
    ]);
    expect(CANONICAL_STAGES.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('marks closed/won semantics correctly', () => {
    expect(getStageMeta('Closed Won')).toMatchObject({ isClosed: true, isWon: true });
    expect(getStageMeta('Closed Lost')).toMatchObject({ isClosed: true, isWon: false });
    for (const open of ['Discovery', 'Qualification', 'Proposal', 'Negotiation']) {
      expect(getStageMeta(open)).toMatchObject({ isClosed: false, isWon: false });
    }
  });

  it('resolves the internal workflow vocabulary onto commercial stages', () => {
    expect(resolveCanonicalStage('Pipeline')).toBe('Discovery');
    expect(resolveCanonicalStage('Presales')).toBe('Qualification');
    expect(resolveCanonicalStage('Sales')).toBe('Proposal');
  });

  it('resolves closed-state variants', () => {
    expect(resolveCanonicalStage('Closed-Won')).toBe('Closed Won');
    expect(resolveCanonicalStage('Delivered')).toBe('Closed Won');
    expect(resolveCanonicalStage('Proposal Lost')).toBe('Closed Lost');
  });

  // CR-05 relies on this: every closed variant must read as closed so the
  // active-pipeline filter excludes them (not just the two exact names).
  it('treats every closed variant as isClosed for the active-pipeline filter', () => {
    for (const v of ['Closed Won', 'Closed-Won', 'Delivered', 'Closed Lost', 'Proposal Lost']) {
      expect(getStageMeta(v)?.isClosed).toBe(true);
    }
    for (const v of ['Discovery', 'Qualification', 'Presales', 'Proposal', 'Sales', 'Negotiation']) {
      expect(getStageMeta(v)?.isClosed).toBe(false);
    }
  });

  it('passes canonical names through and leaves unknown input untouched', () => {
    expect(resolveCanonicalStage('Negotiation')).toBe('Negotiation');
    expect(resolveCanonicalStage('Banana')).toBe('Banana');
    expect(resolveCanonicalStage('')).toBe('');
    expect(resolveCanonicalStage(null)).toBe('');
    expect(stageOrder('Presales')).toBe(2); // via alias → Qualification
    expect(getStageMeta('Banana')).toBeUndefined();
  });

  it('every alias resolves to a real canonical stage', () => {
    for (const target of Object.values(STAGE_ALIASES)) {
      expect(CANONICAL_STAGE_NAMES).toContain(target);
    }
  });

  // Behaviour-neutrality guard: STAGE_DISPLAY_GROUP must remain byte-identical to
  // the map analytics.controller used inline before CR-03 Phase 1 relocated it.
  it('reproduces the exact analytics stage→group map', () => {
    expect(STAGE_DISPLAY_GROUP).toEqual({
      'Discovery': 'Pipeline',
      'Pipeline': 'Pipeline',
      'Qualification': 'Qualification',
      'Presales': 'Qualification',
      'Proposal': 'Proposal',
      'Sales': 'Proposal',
      'Negotiation': 'Negotiation',
      'Closed Won': 'Closed Won',
      'Closed Lost': 'Closed Lost',
    });
  });
});
