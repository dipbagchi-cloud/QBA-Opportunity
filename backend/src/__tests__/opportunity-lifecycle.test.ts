import {
  deriveLifecycleStatus,
  isActivePipeline,
  normalizeLifecycleOverride,
  LIFECYCLE_STATUSES,
} from '../lib/opportunity-lifecycle';

describe('deriveLifecycleStatus', () => {
  it('derives Won / Lost from the stage', () => {
    expect(deriveLifecycleStatus({ currentStage: 'Closed Won' })).toBe('Won');
    expect(deriveLifecycleStatus({ currentStage: 'Closed Lost' })).toBe('Lost');
    expect(deriveLifecycleStatus({ stage: { name: 'Delivered' } })).toBe('Won'); // alias → Closed Won
  });

  it('derives Archived from the flag, outranking everything', () => {
    expect(deriveLifecycleStatus({ isArchived: true, currentStage: 'Proposal' })).toBe('Archived');
    // Facts (archived) outrank a manual override.
    expect(deriveLifecycleStatus({ isArchived: true, lifecycleStatus: 'Future/Deferred' })).toBe('Archived');
  });

  it('honours the On Hold and Future/Deferred overrides on open deals', () => {
    expect(deriveLifecycleStatus({ currentStage: 'Qualification', lifecycleStatus: 'Future/Deferred' })).toBe('Future/Deferred');
    expect(deriveLifecycleStatus({ currentStage: 'Qualification', lifecycleStatus: 'On Hold' })).toBe('On Hold');
    // Legacy On Hold via detailedStatus still resolves.
    expect(deriveLifecycleStatus({ currentStage: 'Proposal', detailedStatus: 'On Hold' })).toBe('On Hold');
  });

  it('a stored override never overrides a closed/won fact', () => {
    expect(deriveLifecycleStatus({ currentStage: 'Closed Lost', lifecycleStatus: 'Future/Deferred' })).toBe('Lost');
  });

  it('defaults an open deal to Active', () => {
    expect(deriveLifecycleStatus({ currentStage: 'Discovery' })).toBe('Active');
    expect(deriveLifecycleStatus({ currentStage: 'Negotiation' })).toBe('Active');
  });

  it('only exposes the six canonical statuses', () => {
    expect(LIFECYCLE_STATUSES).toEqual(['Active', 'On Hold', 'Future/Deferred', 'Won', 'Lost', 'Archived']);
  });
});

describe('isActivePipeline', () => {
  it('includes Active and On Hold; excludes Future/Won/Lost/Archived', () => {
    expect(isActivePipeline({ currentStage: 'Discovery' })).toBe(true);
    expect(isActivePipeline({ currentStage: 'Proposal', detailedStatus: 'On Hold' })).toBe(true);
    expect(isActivePipeline({ currentStage: 'Qualification', lifecycleStatus: 'Future/Deferred' })).toBe(false);
    expect(isActivePipeline({ currentStage: 'Closed Won' })).toBe(false);
    expect(isActivePipeline({ currentStage: 'Closed Lost' })).toBe(false);
    expect(isActivePipeline({ isArchived: true, currentStage: 'Proposal' })).toBe(false);
  });
});

describe('normalizeLifecycleOverride', () => {
  it('accepts the manual overrides and clears on Active/blank', () => {
    expect(normalizeLifecycleOverride('On Hold')).toBe('On Hold');
    expect(normalizeLifecycleOverride('Future/Deferred')).toBe('Future/Deferred');
    expect(normalizeLifecycleOverride('Active')).toBeNull();
    expect(normalizeLifecycleOverride('')).toBeNull();
    expect(normalizeLifecycleOverride(null)).toBeNull();
  });

  it('rejects derived facts and junk (cannot be set by hand)', () => {
    expect(normalizeLifecycleOverride('Won')).toBeNull();
    expect(normalizeLifecycleOverride('Archived')).toBeNull();
    expect(normalizeLifecycleOverride('Banana')).toBeNull();
  });
});
