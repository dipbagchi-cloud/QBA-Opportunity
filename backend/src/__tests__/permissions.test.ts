import {
  PERMISSIONS,
  WILDCARD,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_IMPLICATIONS,
  ALL_PERMISSION_KEYS,
  hasPermission,
  hasAnyPermission,
  validatePermissions,
} from '../lib/permissions';

describe('hasPermission', () => {
  it('grants everything to the wildcard (Admin) permission', () => {
    expect(hasPermission([WILDCARD], PERMISSIONS.PIPELINE_WRITE)).toBe(true);
    expect(hasPermission([WILDCARD], PERMISSIONS.SETTINGS_MANAGE)).toBe(true);
    expect(hasPermission([WILDCARD], 'some:unknown-permission')).toBe(true);
  });

  it('matches a directly granted permission', () => {
    expect(hasPermission([PERMISSIONS.PIPELINE_WRITE], PERMISSIONS.PIPELINE_WRITE)).toBe(true);
  });

  it('returns false when the permission is not present', () => {
    expect(hasPermission([PERMISSIONS.PIPELINE_VIEW], PERMISSIONS.PIPELINE_WRITE)).toBe(false);
    expect(hasPermission([], PERMISSIONS.PIPELINE_VIEW)).toBe(false);
  });

  it('resolves implied (write -> view) permissions', () => {
    expect(hasPermission([PERMISSIONS.PIPELINE_WRITE], PERMISSIONS.PIPELINE_VIEW)).toBe(true);
    expect(hasPermission([PERMISSIONS.PRESALES_WRITE], PERMISSIONS.PRESALES_VIEW)).toBe(true);
    expect(hasPermission([PERMISSIONS.SALES_WRITE], PERMISSIONS.SALES_VIEW)).toBe(true);
    expect(hasPermission([PERMISSIONS.CONTACTS_WRITE], PERMISSIONS.CONTACTS_VIEW)).toBe(true);
  });

  it('does NOT imply in the reverse direction (view -> write)', () => {
    expect(hasPermission([PERMISSIONS.PIPELINE_VIEW], PERMISSIONS.PIPELINE_WRITE)).toBe(false);
  });

  it('resolves multi-level implication chains (sow:admin -> sow:write -> sow:view)', () => {
    expect(hasPermission([PERMISSIONS.SOW_ADMIN], PERMISSIONS.SOW_WRITE)).toBe(true);
    expect(hasPermission([PERMISSIONS.SOW_ADMIN], PERMISSIONS.SOW_VIEW)).toBe(true);
    expect(hasPermission([PERMISSIONS.SOW_WRITE], PERMISSIONS.SOW_VIEW)).toBe(true);
    expect(hasPermission([PERMISSIONS.SOW_VIEW], PERMISSIONS.SOW_WRITE)).toBe(false);
  });

  it('treats admin management permissions as implying settings:view', () => {
    expect(hasPermission([PERMISSIONS.USERS_MANAGE], PERMISSIONS.SETTINGS_VIEW)).toBe(true);
    expect(hasPermission([PERMISSIONS.ROLES_MANAGE], PERMISSIONS.SETTINGS_VIEW)).toBe(true);
    expect(hasPermission([PERMISSIONS.AUDITLOGS_VIEW], PERMISSIONS.SETTINGS_VIEW)).toBe(true);
  });

  it('does not throw or loop on an empty permission set', () => {
    expect(hasPermission([], PERMISSIONS.DASHBOARD_VIEW)).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  it('returns true if any of the required permissions is granted', () => {
    expect(
      hasAnyPermission([PERMISSIONS.PIPELINE_VIEW], [PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.SALES_VIEW]),
    ).toBe(true);
  });

  it('returns false when none of the required permissions is granted', () => {
    expect(
      hasAnyPermission([PERMISSIONS.CONTACTS_VIEW], [PERMISSIONS.PIPELINE_WRITE, PERMISSIONS.SALES_WRITE]),
    ).toBe(false);
  });

  it('honours wildcard for any list', () => {
    expect(hasAnyPermission([WILDCARD], [PERMISSIONS.SETTINGS_MANAGE])).toBe(true);
  });

  it('resolves implications inside the any-list', () => {
    // pipeline:write implies pipeline:view, so a view requirement is met
    expect(hasAnyPermission([PERMISSIONS.PIPELINE_WRITE], [PERMISSIONS.PIPELINE_VIEW])).toBe(true);
  });
});

describe('validatePermissions', () => {
  it('accepts a list of known permissions and de-duplicates it', () => {
    const result = validatePermissions([
      PERMISSIONS.PIPELINE_VIEW,
      PERMISSIONS.PIPELINE_VIEW,
      PERMISSIONS.SALES_VIEW,
    ]);
    expect(result.valid).toBe(true);
    expect(result.invalid).toEqual([]);
    expect(result.permissions).toEqual([PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.SALES_VIEW]);
  });

  it('accepts the wildcard', () => {
    const result = validatePermissions([WILDCARD]);
    expect(result.valid).toBe(true);
    expect(result.invalid).toEqual([]);
  });

  it('flags unknown permissions', () => {
    const result = validatePermissions([PERMISSIONS.PIPELINE_VIEW, 'bogus:permission']);
    expect(result.valid).toBe(false);
    expect(result.invalid).toEqual(['bogus:permission']);
  });

  it('drops falsy entries', () => {
    const result = validatePermissions(['', PERMISSIONS.SALES_VIEW] as string[]);
    expect(result.permissions).toEqual([PERMISSIONS.SALES_VIEW]);
    expect(result.valid).toBe(true);
  });
});

describe('role presets', () => {
  it('gives Admin only the wildcard', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.Admin).toEqual([WILDCARD]);
  });

  it('only references valid permission keys (besides wildcard)', () => {
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const { valid, invalid } = validatePermissions(perms);
      expect({ role, valid, invalid }).toEqual({ role, valid: true, invalid: [] });
    }
  });

  it('grants Management the edit-all bypass but not the wildcard', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.Management).toContain(PERMISSIONS.OPPORTUNITIES_EDIT_ALL);
    expect(DEFAULT_ROLE_PERMISSIONS.Management).not.toContain(WILDCARD);
  });

  it('keeps Read-Only without any write permission', () => {
    const writePerms = DEFAULT_ROLE_PERMISSIONS['Read-Only'].filter((p) => p.endsWith(':write') || p.endsWith(':manage'));
    expect(writePerms).toEqual([]);
  });

  it('does not grant Sales presales:write (presales is a separate role)', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.Sales).not.toContain(PERMISSIONS.PRESALES_WRITE);
  });
});

describe('PERMISSION_IMPLICATIONS map integrity', () => {
  it('only implies permissions that exist in the catalogue', () => {
    for (const [granted, implied] of Object.entries(PERMISSION_IMPLICATIONS)) {
      expect(ALL_PERMISSION_KEYS).toContain(granted);
      for (const next of implied) {
        expect(ALL_PERMISSION_KEYS).toContain(next);
      }
    }
  });
});
