import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { hashPassword, comparePassword, generateToken } from '../services/auth.service';

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

    if (!user.passwordHash) {
      return res.status(401).json({ error: 'Account not set up. Contact admin.' });
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
