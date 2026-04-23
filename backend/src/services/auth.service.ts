import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET: string = process.env.JWT_SECRET!;
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_EXPIRES_IN = '24h';
const BCRYPT_ROUNDS = 12;

// Boot ID: changes on every server restart, invalidating all existing tokens
export const SERVER_BOOT_ID = crypto.randomBytes(8).toString('hex');

export interface TokenPayload {
  userId: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  roles: { id: string; name: string; permissions: string[] }[];
  bootId?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload, bootId: SERVER_BOOT_ID }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
  if (decoded.bootId && decoded.bootId !== SERVER_BOOT_ID) {
    throw new Error('Session expired due to server restart');
  }
  return decoded;
}
