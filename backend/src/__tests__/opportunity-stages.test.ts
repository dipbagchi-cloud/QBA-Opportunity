import {
  CANONICAL_STAGES,
  CANONICAL_STAGE_NAMES,
  STAGE_ALIASES,
  STAGE_DISPLAY_GROUP,
  CLOSED_STAGE_NAMES,
  resolveCanonicalStage,
  getStageMeta,
  stageOrder,
  allowedTransitions,
  isLegalTransition,
  stageMoves,
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

  // CR-03 Phase 5: the single reconciled closed-name set (canonical + aliases).
  it('exposes one closed-name set covering canonical names and all closed aliases', () => {
    expect([...CLOSED_STAGE_NAMES].sort()).toEqual(
      ['Closed Lost', 'Closed Won', 'Closed-Won', 'Delivered', 'Proposal Lost'].sort(),
    );
    for (const open of ['Discovery', 'Qualification', 'Proposal', 'Negotiation', 'Pipeline', 'Presales', 'Sales']) {
      expect(CLOSED_STAGE_NAMES).not.toContain(open);
    }
  });

  // CR-03 full stage machine — the legal-move graph.
  it('declares the legal transitions and rejects illegal jumps', () => {
    expect(allowedTransitions('Discovery').sort()).toEqual(['Closed Lost', 'Qualification']);
    expect(allowedTransitions('Qualification').sort()).toEqual(['Closed Lost', 'Discovery', 'Proposal']);
    expect(allowedTransitions('Proposal').sort()).toEqual(['Closed Lost', 'Negotiation', 'Qualification']);
    // CR-03 flow-shift: re-estimation sends the deal back Negotiation -> Proposal
    // (the estimation stage), not to the Qualification checkpoint.
    expect(allowedTransitions('Negotiation').sort()).toEqual(['Closed Lost', 'Closed Won', 'Proposal']);
    expect(allowedTransitions('Closed Won')).toEqual([]);
    // legal vs illegal
    expect(isLegalTransition('Discovery', 'Qualification')).toBe(true);
    expect(isLegalTransition('Discovery', 'Negotiation')).toBe(false); // no skipping
    expect(isLegalTransition('Proposal', 'Qualification')).toBe(true); // send-back
    expect(isLegalTransition('Negotiation', 'Closed Won')).toBe(true);
    expect(isLegalTransition('Qualification', 'Closed Won')).toBe(false);
    // resolves the workflow vocabulary on both sides
    expect(isLegalTransition('Presales', 'Sales')).toBe(true); // Qualification -> Proposal
  });

  it('tags each legal move with the kind of act it is', () => {
    const moves = stageMoves('Negotiation');
    expect(moves.find(m => m.to === 'Closed Won')?.kind).toBe('win');
    expect(moves.find(m => m.to === 'Closed Lost')?.kind).toBe('lose');
    // CR-03 flow-shift: the send-back from Negotiation goes to Proposal.
    expect(moves.find(m => m.to === 'Proposal')?.kind).toBe('back');
    expect(stageMoves('Discovery').find(m => m.to === 'Qualification')?.kind).toBe('forward');
  });

  // CR-03: every stage groups under its own canonical name (the old
  // Pipeline/Presales/Sales words are retired as group labels); the legacy tokens
  // remain as keys so legacy rows bucket correctly.
  it('groups each stage under its canonical name', () => {
    expect(STAGE_DISPLAY_GROUP).toEqual({
      'Discovery': 'Discovery',
      'Pipeline': 'Discovery',
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
