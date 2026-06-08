import {
  hasGrantedPermission,
  hasAnyGrantedPermission,
  canAccessSettingsTab,
  canAccessSettingsArea,
  canAccessDashboardRoute,
} from '@/lib/access-control';

describe('hasGrantedPermission', () => {
  it('returns false for empty / undefined permission lists', () => {
    expect(hasGrantedPermission(undefined, 'pipeline:view')).toBe(false);
    expect(hasGrantedPermission([], 'pipeline:view')).toBe(false);
  });

  it('grants everything to the wildcard', () => {
    expect(hasGrantedPermission(['*'], 'settings:manage')).toBe(true);
  });

  it('matches a direct permission', () => {
    expect(hasGrantedPermission(['sales:view'], 'sales:view')).toBe(true);
  });

  it('resolves write -> view and multi-level sow implications', () => {
    expect(hasGrantedPermission(['pipeline:write'], 'pipeline:view')).toBe(true);
    expect(hasGrantedPermission(['sow:admin'], 'sow:view')).toBe(true);
    expect(hasGrantedPermission(['sow:admin'], 'sow:write')).toBe(true);
  });

  it('does not imply in reverse', () => {
    expect(hasGrantedPermission(['pipeline:view'], 'pipeline:write')).toBe(false);
  });
});

describe('hasAnyGrantedPermission', () => {
  it('is true when any requirement is met (directly or via implication)', () => {
    expect(hasAnyGrantedPermission(['pipeline:write'], ['contacts:view', 'pipeline:view'])).toBe(true);
  });

  it('is false when none are met', () => {
    expect(hasAnyGrantedPermission(['contacts:view'], ['pipeline:write', 'sales:write'])).toBe(false);
  });
});

describe('canAccessSettingsTab', () => {
  it('allows tabs with no specific rule (e.g. profile, security)', () => {
    expect(canAccessSettingsTab('profile', [])).toBe(true);
    expect(canAccessSettingsTab('security', undefined)).toBe(true);
  });

  it('gates the users tab behind users:manage', () => {
    expect(canAccessSettingsTab('users', ['users:manage'])).toBe(true);
    expect(canAccessSettingsTab('users', ['settings:view'])).toBe(false);
  });

  it('gates rate cards behind costcard:manage', () => {
    expect(canAccessSettingsTab('ratecards', ['costcard:manage'])).toBe(true);
    expect(canAccessSettingsTab('ratecards', ['settings:manage'])).toBe(false);
  });

  it('gates metadata tabs behind metadata:manage', () => {
    expect(canAccessSettingsTab('regions', ['metadata:manage'])).toBe(true);
    expect(canAccessSettingsTab('technologies', ['metadata:manage'])).toBe(true);
    expect(canAccessSettingsTab('regions', ['settings:view'])).toBe(false);
  });

  it('lets the wildcard into any tab', () => {
    expect(canAccessSettingsTab('users', ['*'])).toBe(true);
    expect(canAccessSettingsTab('auditlog', ['*'])).toBe(true);
  });
});

describe('canAccessSettingsArea', () => {
  it('is true with any settings-family permission', () => {
    expect(canAccessSettingsArea(['settings:view'])).toBe(true);
    expect(canAccessSettingsArea(['users:manage'])).toBe(true);
    expect(canAccessSettingsArea(['auditlogs:view'])).toBe(true);
  });

  it('is false with only unrelated permissions', () => {
    expect(canAccessSettingsArea(['pipeline:view'])).toBe(false);
    expect(canAccessSettingsArea([])).toBe(false);
  });
});

describe('canAccessDashboardRoute', () => {
  it('requires pipeline:write to open the new-opportunity route', () => {
    expect(canAccessDashboardRoute('/dashboard/opportunities/new', ['pipeline:write'])).toBe(true);
    expect(canAccessDashboardRoute('/dashboard/opportunities/new', ['pipeline:view'])).toBe(false);
  });

  it('allows the opportunities list/detail with any of pipeline/presales/sales view', () => {
    expect(canAccessDashboardRoute('/dashboard/opportunities', ['sales:view'])).toBe(true);
    expect(canAccessDashboardRoute('/dashboard/opportunities/abc123', ['presales:view'])).toBe(true);
    expect(canAccessDashboardRoute('/dashboard/opportunities/abc123', ['contacts:view'])).toBe(false);
  });

  it('gates settings and user-detail routes', () => {
    expect(canAccessDashboardRoute('/dashboard/settings', ['settings:view'])).toBe(true);
    expect(canAccessDashboardRoute('/dashboard/settings/anything', ['metadata:manage'])).toBe(true);
    expect(canAccessDashboardRoute('/dashboard/users/u-1', ['users:manage'])).toBe(true);
    expect(canAccessDashboardRoute('/dashboard/users/u-1', ['pipeline:view'])).toBe(false);
  });

  it('requires dashboard:view for the dashboard home', () => {
    expect(canAccessDashboardRoute('/dashboard', ['dashboard:view'])).toBe(true);
    expect(canAccessDashboardRoute('/dashboard', ['pipeline:view'])).toBe(false);
  });

  it('allows routes with no matching rule (unknown paths are not gated here)', () => {
    expect(canAccessDashboardRoute('/dashboard/some-unmapped-page', [])).toBe(true);
  });
});
