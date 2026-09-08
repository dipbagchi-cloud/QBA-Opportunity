import { assessStageHygiene } from '../lib/opportunity-stage-hygiene';

// CR-12 — the "stale stage" hygiene signal. A deal is stale when a commercial
// milestone (committed quote / attached SOW) exists but the stage still lags it.
describe('assessStageHygiene — stale stage detection', () => {
  const quote = { finalRevenue: 120000 };

  it('flags a committed quote sitting in Discovery / Qualification', () => {
    const d = assessStageHygiene({ stageName: 'Discovery', presalesData: quote });
    expect(d.stale).toBe(true);
    expect(d.milestone).toBe('committed_quote');
    expect(d.suggestedStage).toBe('Proposal');

    const q = assessStageHygiene({ stageName: 'Qualification', presalesData: quote });
    expect(q.stale).toBe(true);
  });

  it('flags an attached SOW before Proposal (the reviewed finding)', () => {
    // Proposal shared (SOW attached) but the CRM still shows Qualification.
    const r = assessStageHygiene({ stageName: 'Qualification', hasCurrentSow: true });
    expect(r.stale).toBe(true);
    expect(r.milestone).toBe('sow_attached');
    expect(r.suggestedStage).toBe('Proposal');
  });

  it('does NOT flag a deal already in Proposal or later', () => {
    // Attaching a SOW / holding a quote in Proposal is the expected pre-send state.
    expect(assessStageHygiene({ stageName: 'Proposal', presalesData: quote, hasCurrentSow: true }).stale).toBe(false);
    expect(assessStageHygiene({ stageName: 'Negotiation', presalesData: quote }).stale).toBe(false);
  });

  it('does NOT flag when no commercial milestone exists yet', () => {
    expect(assessStageHygiene({ stageName: 'Discovery' }).stale).toBe(false);
    expect(assessStageHygiene({ stageName: 'Qualification', presalesData: { finalRevenue: 0 } }).stale).toBe(false);
  });

  it('never flags closed deals', () => {
    expect(assessStageHygiene({ stageName: 'Closed Won', presalesData: quote, hasCurrentSow: true }).stale).toBe(false);
    expect(assessStageHygiene({ stageName: 'Closed Lost', presalesData: quote }).stale).toBe(false);
  });

  it('resolves the legacy workflow vocabulary (Presales / Pipeline)', () => {
    // 'Presales' aliases to Qualification, 'Pipeline' to Discovery — both before Proposal.
    expect(assessStageHygiene({ stageName: 'Presales', presalesData: quote }).stale).toBe(true);
    expect(assessStageHygiene({ stageName: 'Pipeline', hasCurrentSow: true }).stale).toBe(true);
  });
});
