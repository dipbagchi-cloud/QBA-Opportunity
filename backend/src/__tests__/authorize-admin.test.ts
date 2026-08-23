import { authorizeAdmin } from '../middleware/auth';
import { DEFAULT_ROLE_PERMISSIONS, WILDCARD } from '../lib/permissions';

/**
 * Actual GOM is Admin-only. The point of authorizeAdmin is that no named
 * permission can express "Admin and nobody else" — a wildcard holder satisfies
 * every named permission a Manager would also pass — so these tests pin the one
 * behaviour that matters: only the wildcard gets through.
 */
function run(permissions: string[], roleName = 'Test') {
  const req: any = { user: { userId: 'u1', permissions, roleName } };
  let statusCode = 0;
  let body: any = null;
  const res: any = {
    status(c: number) { statusCode = c; return this; },
    json(b: any) { body = b; return this; },
  };
  let nextCalled = false;
  authorizeAdmin(req, res, () => { nextCalled = true; });
  return { nextCalled, statusCode, body };
}

describe('authorizeAdmin', () => {
  it('admits a wildcard holder', () => {
    const r = run([WILDCARD], 'Admin');
    expect(r.nextCalled).toBe(true);
    expect(r.statusCode).toBe(0);
  });

  it('rejects a request with no authenticated user', () => {
    const req: any = {};
    let statusCode = 0;
    const res: any = { status(c: number) { statusCode = c; return this; }, json() { return this; } };
    let nextCalled = false;
    authorizeAdmin(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(401);
  });

  // Every non-Admin seeded role must be refused, including the ones that hold
  // broad write access. This is the regression that matters: the Actual GOM
  // routes previously admitted anyone with pipeline/presales/sales permissions.
  const nonAdminRoles = Object.entries(DEFAULT_ROLE_PERMISSIONS)
    .filter(([name]) => name !== 'Admin');

  it.each(nonAdminRoles)('refuses %s', (name, perms) => {
    const r = run(perms as string[], name);
    expect(r.nextCalled).toBe(false);
    expect(r.statusCode).toBe(403);
    expect(r.body.error).toMatch(/Administrator access required/i);
  });

  it('refuses a role holding every named permission but not the wildcard', () => {
    const everyNamedPermission = Array.from(
      new Set(Object.values(DEFAULT_ROLE_PERMISSIONS).flat().filter((p) => p !== WILDCARD)),
    );
    const r = run(everyNamedPermission, 'Superuser-but-not-admin');
    expect(r.nextCalled).toBe(false);
    expect(r.statusCode).toBe(403);
  });

  it('refuses an empty or missing permission set', () => {
    expect(run([]).statusCode).toBe(403);
    const req: any = { user: { userId: 'u1', roleName: 'Broken' } };
    let statusCode = 0;
    const res: any = { status(c: number) { statusCode = c; return this; }, json() { return this; } };
    authorizeAdmin(req, res, () => { /* should not run */ });
    expect(statusCode).toBe(403);
  });
});
