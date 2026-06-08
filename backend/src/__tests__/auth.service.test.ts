import jwt from 'jsonwebtoken';
import {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  SERVER_BOOT_ID,
  type TokenPayload,
} from '../services/auth.service';

const samplePayload: TokenPayload = {
  userId: 'u-123',
  email: 'user@qbadvisory.com',
  roleId: 'role-1',
  roleName: 'Admin',
  permissions: ['*'],
  roles: [{ id: 'role-1', name: 'Admin', permissions: ['*'] }],
};

describe('password hashing', () => {
  it('hashes a password to something other than the plaintext', async () => {
    const hash = await hashPassword('S3cret!');
    expect(hash).not.toBe('S3cret!');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse');
    expect(await comparePassword('correct horse', hash)).toBe(true);
    expect(await comparePassword('wrong horse', hash)).toBe(false);
  });
});

describe('JWT generate / verify', () => {
  it('round-trips the payload and stamps the current boot id', () => {
    const token = generateToken(samplePayload);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('u-123');
    expect(decoded.email).toBe('user@qbadvisory.com');
    expect(decoded.roleName).toBe('Admin');
    expect(decoded.permissions).toEqual(['*']);
    expect(decoded.bootId).toBe(SERVER_BOOT_ID);
  });

  it('rejects a token carrying a stale boot id (server-restart invalidation)', () => {
    const stale = jwt.sign(
      { ...samplePayload, bootId: 'deadbeefdeadbeef' },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' },
    );
    expect(() => verifyToken(stale)).toThrow(/server restart/i);
  });

  it('rejects a token signed with the wrong secret', () => {
    const forged = jwt.sign(samplePayload, 'a-different-secret', { expiresIn: '24h' });
    expect(() => verifyToken(forged)).toThrow();
  });

  it('rejects a malformed token', () => {
    expect(() => verifyToken('not-a-jwt')).toThrow();
  });
});
