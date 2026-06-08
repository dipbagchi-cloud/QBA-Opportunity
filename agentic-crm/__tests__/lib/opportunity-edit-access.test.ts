import { getOpportunityEditAccess, type OpportunityEditAccessInput } from '@/lib/opportunity-edit-access';

// Stage map: 0 Pipeline, 1 Presales, 2 Sales, 3 SOW/Won
const base: OpportunityEditAccessInput = {
  isActiveAdmin: false,
  isLost: false,
  isStalled: false,
  opportunityStage: 0,
  currentStageName: 'Discovery',
  canEditPipeline: true,
  canEditPresalesData: true,
};

const access = (over: Partial<OpportunityEditAccessInput> = {}) => getOpportunityEditAccess({ ...base, ...over });

describe('getOpportunityEditAccess — closed/admin base flags', () => {
  it('marks a Lost deal as closed and never admin-unlocked', () => {
    const a = access({ isActiveAdmin: true, isLost: true });
    expect(a.isDealClosed).toBe(true);
    expect(a.adminEditUnlocked).toBe(false);
  });

  it('marks a Won/Delivered deal (stage 3) as closed', () => {
    expect(access({ opportunityStage: 3 }).isDealClosed).toBe(true);
    expect(access({ isActiveAdmin: true, opportunityStage: 3 }).adminEditUnlocked).toBe(false);
  });

  it('treats On-Hold and Negotiation as still OPEN (admin stays unlocked)', () => {
    expect(access({ isActiveAdmin: true, isStalled: true }).adminEditUnlocked).toBe(true);
    expect(access({ isActiveAdmin: true, opportunityStage: 2, currentStageName: 'Negotiation' }).adminEditUnlocked).toBe(true);
  });
});

describe('Pipeline tab editability', () => {
  it('is editable for a normal user only in early open stages', () => {
    expect(access({ opportunityStage: 0 }).pipelineEditable).toBe(true);
    expect(access({ opportunityStage: 1 }).pipelineEditable).toBe(true);
    expect(access({ opportunityStage: 2 }).pipelineEditable).toBe(true);
  });

  it('freezes for a normal user at Negotiation, On-Hold or stage 3', () => {
    expect(access({ opportunityStage: 2, currentStageName: 'Negotiation' }).pipelineEditable).toBe(false);
    expect(access({ isStalled: true }).pipelineEditable).toBe(false);
    expect(access({ opportunityStage: 3 }).pipelineEditable).toBe(false);
    expect(access({ isLost: true }).pipelineEditable).toBe(false);
  });

  it('stays editable for an Admin through Negotiation / On-Hold but not when closed', () => {
    expect(access({ isActiveAdmin: true, opportunityStage: 2, currentStageName: 'Negotiation' }).pipelineEditable).toBe(true);
    expect(access({ isActiveAdmin: true, isStalled: true }).pipelineEditable).toBe(true);
    expect(access({ isActiveAdmin: true, opportunityStage: 3 }).pipelineEditable).toBe(false);
    expect(access({ isActiveAdmin: true, isLost: true }).pipelineEditable).toBe(false);
  });

  it('requires the pipeline edit grant regardless of admin', () => {
    expect(access({ isActiveAdmin: true, canEditPipeline: false }).pipelineEditable).toBe(false);
  });
});

describe('Client/Country and Close Date sub-gates', () => {
  it('client/country freezes for a normal user the moment the deal leaves Pipeline', () => {
    expect(access({ opportunityStage: 0 }).clientCountryEditable).toBe(true);
    expect(access({ opportunityStage: 1 }).clientCountryEditable).toBe(false);
  });

  it('client/country stays editable for an Admin on any open deal', () => {
    expect(access({ isActiveAdmin: true, opportunityStage: 2 }).clientCountryEditable).toBe(true);
    expect(access({ isActiveAdmin: true, opportunityStage: 3 }).clientCountryEditable).toBe(false);
  });

  it('close date freezes for a normal user once the proposal is submitted (stage >= 2)', () => {
    expect(access({ opportunityStage: 1 }).closeDateEditable).toBe(true);
    expect(access({ opportunityStage: 2 }).closeDateEditable).toBe(false);
  });

  it('close date stays editable for an Admin until the deal closes', () => {
    expect(access({ isActiveAdmin: true, opportunityStage: 2 }).closeDateEditable).toBe(true);
    expect(access({ isActiveAdmin: true, opportunityStage: 3 }).closeDateEditable).toBe(false);
  });
});

describe('Presales tab editability', () => {
  it('is read-only for a normal user from Sales onward (stage >= 2), or when stalled/lost', () => {
    expect(access({ opportunityStage: 1 }).presalesReadOnly).toBe(false);
    expect(access({ opportunityStage: 2 }).presalesReadOnly).toBe(true);
    expect(access({ isStalled: true }).presalesReadOnly).toBe(true);
    expect(access({ isLost: true }).presalesReadOnly).toBe(true);
  });

  it('stays editable for an Admin until the deal closes', () => {
    expect(access({ isActiveAdmin: true, opportunityStage: 2 }).presalesReadOnly).toBe(false);
    expect(access({ isActiveAdmin: true, isStalled: true }).presalesReadOnly).toBe(false);
    expect(access({ isActiveAdmin: true, opportunityStage: 3 }).presalesReadOnly).toBe(true);
    expect(access({ isActiveAdmin: true, isLost: true }).presalesReadOnly).toBe(true);
  });

  it('is read-only without the presales edit grant, even for an admin', () => {
    expect(access({ isActiveAdmin: true, canEditPresalesData: false }).presalesReadOnly).toBe(true);
  });

  it('drives schedule editability and stage-unlock consistently', () => {
    expect(access({ opportunityStage: 1 }).presalesScheduleEditable).toBe(true);
    expect(access({ opportunityStage: 2 }).presalesScheduleEditable).toBe(false);
    expect(access({ isActiveAdmin: true, opportunityStage: 2 }).presalesScheduleEditable).toBe(true);
    expect(access({ opportunityStage: 2 }).presalesStageUnlocked).toBe(false);
    expect(access({ isActiveAdmin: true, opportunityStage: 2 }).presalesStageUnlocked).toBe(true);
  });
});

describe('Assignment lock', () => {
  it('locks assignment dropdowns at Negotiation/On-Hold/closed for normal users', () => {
    expect(access({ opportunityStage: 0 }).assignmentLocked).toBe(false);
    expect(access({ currentStageName: 'Negotiation', opportunityStage: 2 }).assignmentLocked).toBe(true);
    expect(access({ isStalled: true }).assignmentLocked).toBe(true);
    expect(access({ opportunityStage: 3 }).assignmentLocked).toBe(true);
  });

  it('does not lock assignment for an Admin while the deal is open', () => {
    expect(access({ isActiveAdmin: true, currentStageName: 'Negotiation', opportunityStage: 2 }).assignmentLocked).toBe(false);
    expect(access({ isActiveAdmin: true, opportunityStage: 3 }).assignmentLocked).toBe(true);
  });
});
