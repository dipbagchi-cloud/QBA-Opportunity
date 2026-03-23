import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../services/auth.service';
import { hasPermission, hasAnyPermission } from '../lib/permissions';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Middleware: Verify JWT token and attach user to request.
 * Returns 401 if no token or invalid token.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware factory: Check that the user has ALL of the specified permissions.
 * Must be used after authenticate().
 */
export function authorize(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userPermissions = req.user.permissions;

    for (const perm of requiredPermissions) {
      if (!hasPermission(userPermissions, perm)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: requiredPermissions,
          role: req.user.roleName,
        });
      }
    }

    next();
  };
}

/**
 * Middleware factory: Check that the user has ANY of the specified permissions.
 * Must be used after authenticate().
 */
export function authorizeAny(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasAnyPermission(req.user.permissions, requiredPermissions)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredPermissions,
        role: req.user.roleName,
      });
    }

    next();
  };
}
