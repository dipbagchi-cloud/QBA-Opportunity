import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { hashPassword, comparePassword, generateToken } from '../services/auth.service';

const SSO_DOMAIN = '@qbadvisory.com';
const DEFAULT_LOCAL_PASSWORD = 'Welcome@CRM1';

// Microsoft Entra ID (Azure AD) configuration
const AZURE_TENANT_ID = process.env.AZURE_AD_TENANT_ID || '';
const AZURE_CLIENT_ID = process.env.AZURE_AD_CLIENT_ID || '';
const AZURE_CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET || '';
const AZURE_REDIRECT_URI = process.env.AZURE_AD_REDIRECT_URI || 'http://localhost:3000/login';

// ─── AUTH MODE RESOLUTION ───────────────────────────────────────────────────

interface AuthConfig {
  mode: 'sso' | 'local' | 'hybrid';
  ssoDomain: string;
  localPasswordPolicy: { minLength: number; requireChangeOnFirstLogin: boolean };
}

let _authConfigCache: AuthConfig | null = null;
let _authConfigLastLoaded = 0;
const AUTH_CONFIG_TTL = 60 * 1000; // 1 min cache

export async function getAuthMode(): Promise<AuthConfig> {
  if (_authConfigCache && Date.now() - _authConfigLastLoaded < AUTH_CONFIG_TTL) return _authConfigCache;
  const config = await prisma.systemConfig.findUnique({ where: { key: 'auth_mode' } });
  _authConfigCache = config
    ? (config.value as any)
    : { mode: 'sso', ssoDomain: SSO_DOMAIN, localPasswordPolicy: { minLength: 6, requireChangeOnFirstLogin: true } };
  _authConfigLastLoaded = Date.now();
  return _authConfigCache!;
}

export function isSSOUser(email: string): boolean {
  // Sync check using cached config (for non-async contexts)
  const domain = _authConfigCache?.ssoDomain || SSO_DOMAIN;
  return email.toLowerCase().endsWith(domain.toLowerCase());
}

export async function isSSOUserAsync(email: string): Promise<boolean> {
  const config = await getAuthMode();
  if (config.mode === 'local') return false; // All users are local in local mode
  return email.toLowerCase().endsWith(config.ssoDomain.toLowerCase());
}

// POST /api/auth/login
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: true, team: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check auth mode - in local mode, auto-assign password if missing
    const authConfig = await getAuthMode();
    if (!user.passwordHash) {
      if (authConfig.mode === 'local') {
        // Auto-assign default password for first login
        const defaultHash = await hashPassword(DEFAULT_LOCAL_PASSWORD);
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: defaultHash, mustChangePassword: true } as any,
        });
        user.passwordHash = defaultHash;
        (user as any).mustChangePassword = true;
      } else {
        return res.status(401).json({ error: 'Account not set up. Contact admin.' });
      }
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Build roles array
    const allRoles = user.roles.map((r) => ({
      id: r.id,
      name: r.name,
      permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
    }));

    // Determine active role: use activeRoleId if set, otherwise first role
    const activeRole = allRoles.find((r) => r.id === user.activeRoleId) || allRoles[0];
    if (!activeRole) {
      return res.status(401).json({ error: 'User has no roles assigned. Contact admin.' });
    }

    const permissions = activeRole.permissions;

    const token = generateToken({
      userId: user.id,
      email: user.email,
      roleId: activeRole.id,
      roleName: activeRole.name,
      permissions,
      roles: allRoles,
    });

    res.json({
      token,
      mustChangePassword: (user as any).mustChangePassword === true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        title: user.title,
        department: user.department,
        image: user.image,
        role: {
          id: activeRole.id,
          name: activeRole.name,
          permissions,
        },
        roles: allRoles,
        team: user.team ? { id: user.team.id, name: user.team.name } : null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/auth/me
export async function getMe(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true, team: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const allRoles = user.roles.map((r) => ({
      id: r.id,
      name: r.name,
      permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
    }));

    const activeRole = allRoles.find((r) => r.id === user.activeRoleId) || allRoles[0];
    const permissions = activeRole
      ? activeRole.permissions
      : [];

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      title: user.title,
      department: user.department,
      image: user.image,
      role: activeRole
        ? { id: activeRole.id, name: activeRole.name, permissions }
        : { id: '', name: 'No Role', permissions: [] },
      roles: allRoles,
      team: user.team ? { id: user.team.id, name: user.team.name } : null,
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/auth/switch-role
export async function switchRole(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { roleId } = req.body;
    if (!roleId) {
      return res.status(400).json({ error: 'roleId is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true, team: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Verify the user actually has this role
    const targetRole = user.roles.find((r: any) => r.id === roleId);
    if (!targetRole) {
      return res.status(403).json({ error: 'You do not have this role assigned' });
    }

    // Update activeRoleId on user
    await prisma.user.update({
      where: { id: userId },
      data: { activeRoleId: roleId },
    });

    const allRoles = user.roles.map((r: any) => ({
      id: r.id,
      name: r.name,
      permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
    }));

    const permissions = Array.isArray(targetRole.permissions)
      ? (targetRole.permissions as string[])
      : [];

    const token = generateToken({
      userId: user.id,
      email: user.email,
      roleId: targetRole.id,
      roleName: targetRole.name,
      permissions,
      roles: allRoles,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        title: user.title,
        department: user.department,
        image: user.image,
        role: {
          id: targetRole.id,
          name: targetRole.name,
          permissions,
        },
        roles: allRoles,
        team: user.team ? { id: user.team.id, name: user.team.name } : null,
      },
    });
  } catch (error) {
    console.error('Switch role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/auth/change-password
export async function changePassword(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const { currentPassword, newPassword } = req.body;

    // Block password change for SSO users (only in sso/hybrid mode)
    const authConfig = await getAuthMode();
    if (authConfig.mode !== 'local' && req.user?.email && isSSOUser(req.user.email)) {
      return res.status(403).json({ error: 'SSO users cannot change password. Use your organization SSO to manage credentials.' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await hashPassword(newPassword);
    await (prisma.user as any).update({
      where: { id: userId },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'User',
        entityId: userId!,
        action: 'CHANGE_PASSWORD',
        userId: userId!,
      },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/auth/set-password — First-time password setup (no current password required)
export async function setPassword(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const { newPassword } = req.body;

    // Block for SSO users (only in sso/hybrid mode)
    const authCfg = await getAuthMode();
    if (authCfg.mode !== 'local' && req.user?.email && isSSOUser(req.user.email)) {
      return res.status(403).json({ error: 'SSO users cannot set password.' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await (prisma.user as any).findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.mustChangePassword) {
      return res.status(403).json({ error: 'Use change-password instead' });
    }

    const newHash = await hashPassword(newPassword);
    await (prisma.user as any).update({
      where: { id: userId },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'User',
        entityId: userId!,
        action: 'SET_INITIAL_PASSWORD',
        userId: userId!,
      },
    });

    res.json({ message: 'Password set successfully' });
  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/auth/sso/url — Returns Microsoft OAuth2 authorization URL
export async function getSSOUrl(req: Request, res: Response) {
  try {
    // Block SSO in local mode
    const authConfig = await getAuthMode();
    if (authConfig.mode === 'local') {
      return res.status(403).json({ error: 'SSO is disabled. The system uses local authentication.' });
    }

    if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID) {
      return res.status(503).json({ error: 'SSO is not configured. Set AZURE_AD_TENANT_ID and AZURE_AD_CLIENT_ID in environment.' });
    }

    const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64');

    const params = new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      response_type: 'code',
      redirect_uri: AZURE_REDIRECT_URI,
      response_mode: 'query',
      scope: 'openid email profile',
      state,
    });

    const authUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;

    res.json({ url: authUrl, state });
  } catch (error) {
    console.error('SSO URL error:', error);
    res.status(500).json({ error: 'Failed to generate SSO URL' });
  }
}

// POST /api/auth/sso/callback — Exchange Microsoft auth code for tokens, then issue JWT
export async function ssoCallback(req: Request, res: Response) {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
      return res.status(503).json({ error: 'SSO is not configured on the server.' });
    }

    // Exchange authorization code for tokens with Microsoft
    const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
    const tokenParams = new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      client_secret: AZURE_CLIENT_SECRET,
      code,
      redirect_uri: AZURE_REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: 'openid email profile',
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      const errData = await tokenRes.json().catch(() => ({}));
      console.error('Microsoft token exchange failed:', errData);
      return res.status(401).json({ error: 'SSO authentication failed. Could not verify with Microsoft.' });
    }

    const tokenData: any = await tokenRes.json();

    // Decode ID token to get user email (JWT payload is base64 encoded)
    const idToken = tokenData.id_token;
    if (!idToken) {
      return res.status(401).json({ error: 'No ID token received from Microsoft.' });
    }

    const payloadBase64 = idToken.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));

    const msEmail = (payload.email || payload.preferred_username || '').toLowerCase();
    if (!msEmail) {
      return res.status(401).json({ error: 'Could not determine email from Microsoft account.' });
    }

    if (!isSSOUser(msEmail)) {
      const authConfig = await getAuthMode();
      return res.status(403).json({ error: `SSO login is only available for ${authConfig.ssoDomain} users.` });
    }

    // Block SSO in local mode
    const authConfig = await getAuthMode();
    if (authConfig.mode === 'local') {
      return res.status(403).json({ error: 'SSO is disabled. The system uses local authentication.' });
    }

    // Find user in our database
    const user = await prisma.user.findFirst({
      where: { email: { equals: msEmail, mode: 'insensitive' } },
      include: { roles: true, team: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive in Q-CRM. Contact admin.' });
    }

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const allRoles = user.roles.map((r) => ({
      id: r.id,
      name: r.name,
      permissions: Array.isArray(r.permissions) ? (r.permissions as string[]) : [],
    }));

    const activeRole = allRoles.find((r) => r.id === user.activeRoleId) || allRoles[0];
    if (!activeRole) {
      return res.status(401).json({ error: 'User has no roles assigned. Contact admin.' });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      roleId: activeRole.id,
      roleName: activeRole.name,
      permissions: activeRole.permissions,
      roles: allRoles,
    });

    await prisma.auditLog.create({
      data: {
        entity: 'User',
        entityId: user.id,
        action: 'SSO_LOGIN',
        userId: user.id,
        changes: { provider: 'microsoft', msEmail },
      },
    });

    res.json({
      token,
      mustChangePassword: false,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        title: user.title,
        department: user.department,
        image: user.image,
        role: {
          id: activeRole.id,
          name: activeRole.name,
          permissions: activeRole.permissions,
        },
        roles: allRoles,
        team: user.team ? { id: user.team.id, name: user.team.name } : null,
      },
    });
  } catch (error) {
    console.error('SSO callback error:', error);
    res.status(500).json({ error: 'SSO authentication failed.' });
  }
}

// GET /api/auth/info — Public endpoint returning auth mode for the login page
export async function getAuthInfo(req: Request, res: Response) {
  try {
    const config = await getAuthMode();
    res.json({
      mode: config.mode,           // 'sso' | 'local' | 'hybrid'
      ssoDomain: config.ssoDomain, // e.g. '@qbadvisory.com'
      ssoConfigured: !!(AZURE_TENANT_ID && AZURE_CLIENT_ID),
    });
  } catch (error) {
    console.error('Auth info error:', error);
    res.json({ mode: 'sso', ssoDomain: SSO_DOMAIN, ssoConfigured: false });
  }
}
