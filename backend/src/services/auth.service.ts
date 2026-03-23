import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'agentic-crm-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';
const BCRYPT_ROUNDS = 12;

export interface TokenPayload {
  userId: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  roles: { id: string; name: string; permissions: string[] }[];
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
