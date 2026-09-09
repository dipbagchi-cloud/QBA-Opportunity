import { roleKey, ROLE_DISPLAY_NAME } from '../lib/role-identity';

describe('roleKey — canonical role identity across the rename', () => {
  it('maps the new display names to their canonical key', () => {
    expect(roleKey('Business Development')).toBe('sales');
    expect(roleKey('Solutions')).toBe('presales');
  });

  it('still maps the legacy names (so issued tokens keep working)', () => {
    expect(roleKey('Sales')).toBe('sales');
    expect(roleKey('Presales')).toBe('presales');
    expect(roleKey('sales')).toBe('sales');
    expect(roleKey('presales')).toBe('presales');
  });

  it('is case-insensitive and trims', () => {
    expect(roleKey('  business development ')).toBe('sales');
    expect(roleKey('SOLUTIONS')).toBe('presales');
  });

  it('passes unrelated roles through unchanged (lower-cased)', () => {
    expect(roleKey('Admin')).toBe('admin');
    expect(roleKey('Manager')).toBe('manager');
    expect(roleKey('Read-Only')).toBe('read-only');
    expect(roleKey('')).toBe('');
    expect(roleKey(null)).toBe('');
  });

  it('exposes the current display names', () => {
    expect(ROLE_DISPLAY_NAME.sales).toBe('Business Development');
    expect(ROLE_DISPLAY_NAME.presales).toBe('Solutions');
  });
});
