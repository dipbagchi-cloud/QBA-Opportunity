/**
 * Pure derivation of the per-tab edit gates for the opportunity detail page.
 *
 * The opportunity detail screen freezes the Pipeline and Presales tabs as a
 * deal progresses through stages. The product rule layered on top: an **Admin**
 * may keep editing those tabs (and their sub-tabs) at ANY open stage — the only
 * hard stop is a deal that has actually CLOSED (Lost, or Won/Delivered at
 * stage >= 3). On-hold and Negotiation are still "open", so Admin keeps access.
 *
 * This logic used to live inline inside the 3k-line page component; it is
 * extracted here so it can be unit-tested in isolation. The page imports
 * `getOpportunityEditAccess` and consumes the returned flags.
 *
 * `opportunityStage`: 0 = Pipeline, 1 = Presales, 2 = Sales, 3 = SOW/Won.
 */
export interface OpportunityEditAccessInput {
  /** Current user is an Admin (wildcard permission / "admin" role). */
  isActiveAdmin: boolean;
  /** Deal is Closed Lost. */
  isLost: boolean;
  /** Deal is On Hold (stalled) — still an OPEN state. */
  isStalled: boolean;
  /** DB stage index: 0 Pipeline, 1 Presales, 2 Sales, 3 SOW/Won. */
  opportunityStage: number;
  /** Kanban stage name (e.g. 'Proposal', 'Negotiation'). */
  currentStageName: string;
  /** Backend grant: the user may edit pipeline workflow fields. */
  canEditPipeline: boolean;
  /** Backend grant: the user may edit presales/estimation content. */
  canEditPresalesData: boolean;
}

export interface OpportunityEditAccess {
  /** Deal has actually closed (Lost, or Won/Delivered at stage >= 3). */
  isDealClosed: boolean;
  /** Admin AND the deal is still open → bypass all stage-progression locks. */
  adminEditUnlocked: boolean;
  /** Assignment dropdowns (sales rep / manager / presales) are locked. */
  assignmentLocked: boolean;
  /** Pipeline tab fields are editable. */
  pipelineEditable: boolean;
  /** Client / Country / Region (freeze when leaving Pipeline; Admin bypass). */
  clientCountryEditable: boolean;
  /** Opportunity Close Date (freeze once proposal submitted; Admin bypass). */
  closeDateEditable: boolean;
  /** The estimation provider's `readOnly` flag for the Presales tab. */
  presalesReadOnly: boolean;
  /**
   * Presales stage is unlocked for editing actions (save button, attachment
   * add/delete) — true before Sales, or for an Admin on an open deal.
   */
  presalesStageUnlocked: boolean;
  /** Presales Schedule fields are editable. */
  presalesScheduleEditable: boolean;
}

export function getOpportunityEditAccess(input: OpportunityEditAccessInput): OpportunityEditAccess {
  const {
    isActiveAdmin,
    isLost,
    isStalled,
    opportunityStage,
    currentStageName,
    canEditPipeline,
    canEditPresalesData,
  } = input;

  const isDealClosed = isLost || opportunityStage >= 3;
  const adminEditUnlocked = isActiveAdmin && !isDealClosed;

  const assignmentLocked =
    (opportunityStage >= 3 || isLost || isStalled || currentStageName === 'Negotiation') && !adminEditUnlocked;

  const pipelineEditable =
    canEditPipeline &&
    ((opportunityStage < 3 && !isLost && !isStalled && currentStageName !== 'Negotiation') || adminEditUnlocked);

  const clientCountryEditable = pipelineEditable && (opportunityStage === 0 || adminEditUnlocked);
  const closeDateEditable = pipelineEditable && (opportunityStage < 2 || adminEditUnlocked);

  const presalesReadOnly =
    !canEditPresalesData || ((opportunityStage >= 2 || isStalled || isLost) && !adminEditUnlocked);

  const presalesStageUnlocked = opportunityStage < 2 || adminEditUnlocked;
  const presalesScheduleEditable = canEditPresalesData && !(opportunityStage >= 2 && !adminEditUnlocked);

  return {
    isDealClosed,
    adminEditUnlocked,
    assignmentLocked,
    pipelineEditable,
    clientCountryEditable,
    closeDateEditable,
    presalesReadOnly,
    presalesStageUnlocked,
    presalesScheduleEditable,
  };
}
