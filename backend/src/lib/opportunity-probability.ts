export function calculateOpportunityProbability(opp: {
  stage?: { name?: string | null } | null;
  currentStage?: string | null;
  presalesData?: unknown;
  salesData?: unknown;
  expectedCloseDate?: Date | string | null;
  description?: string | null;
  tentativeDuration?: number | string | null;
  expectedDayRate?: number | string | null;
}): number {
  const stageName = opp.stage?.name || opp.currentStage || 'Discovery';

  let probability = 10;
  switch (stageName) {
    case 'Discovery': probability = 10; break;
    case 'Qualification': probability = 25; break;
    case 'Proposal': probability = 50; break;
    case 'Negotiation': probability = 75; break;
    case 'Closed Won': probability = 100; break;
    case 'Closed Lost': probability = 0; break;
    default: probability = 10;
  }

  const hasPresalesData = !!(opp.presalesData && typeof opp.presalesData === 'object' && Object.keys(opp.presalesData as Record<string, unknown>).length > 0);
  const hasSalesData = !!(opp.salesData && typeof opp.salesData === 'object' && Object.keys(opp.salesData as Record<string, unknown>).length > 0);
  const hasExpectedClose = !!opp.expectedCloseDate;
  const hasDescription = !!opp.description;
  const hasDuration = !!opp.tentativeDuration;
  const hasRate = opp.expectedDayRate != null && Number(opp.expectedDayRate) > 0;

  const completenessBonus = [
    hasPresalesData,
    hasSalesData,
    hasExpectedClose,
    hasDescription,
    hasDuration,
    hasRate,
  ].filter(Boolean).length;

  const maxForStage = probability;
  return Math.min(
    probability + Math.round(completenessBonus * 1.5),
    Math.min(maxForStage + 15, 100)
  );
}
