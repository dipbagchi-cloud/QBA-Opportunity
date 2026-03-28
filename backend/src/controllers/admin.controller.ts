import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../services/auth.service';
import { isSSOUser } from './auth.controller';

// GET /api/admin/users
export async function listUsers(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const search = (req.query.search as string || '').trim();

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { roles: true, team: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        title: u.title,
        department: u.department,
        designation: (u as any).designation,
        phone: u.phone,
        qpeopleId: (u as any).qpeopleId,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        roles: u.roles.map((r: any) => ({ id: r.id, name: r.name })),
        team: u.team ? { id: u.team.id, name: u.team.name } : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

// POST /api/admin/users
export async function createUser(req: Request, res: Response) {
  try {
    const { email, name, password, roleId, roleIds, teamId, title, department } = req.body;
    const resolvedRoleIds: string[] = roleIds && Array.isArray(roleIds) ? roleIds : roleId ? [roleId] : [];

    const ssoUser = isSSOUser(email);

    if (!email || !name || resolvedRoleIds.length === 0) {
      return res.status(400).json({ error: 'email, name, and at least one role are required' });
    }

    if (!ssoUser && !password) {
      return res.status(400).json({ error: 'password is required for non-SSO users' });
    }

    // Check unique email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    // Verify roles exist
    const rolesExist = await prisma.role.findMany({ where: { id: { in: resolvedRoleIds } } });
    if (rolesExist.length !== resolvedRoleIds.length) {
      return res.status(400).json({ error: 'One or more invalid roleIds' });
    }

    const passwordHash = ssoUser ? null : await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        ...(passwordHash ? { passwordHash } : {}),
        roles: { connect: resolvedRoleIds.map(id => ({ id })) },
        activeRoleId: resolvedRoleIds[0],
        teamId: teamId || undefined,
        title: title || undefined,
        department: department || undefined,
      },
      include: { roles: true, team: true },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        entity: 'User',
        entityId: user.id,
        action: 'CREATE_USER',
        userId: req.user!.userId,
        changes: { email, name, roles: rolesExist.map(r => r.name) },
      },
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map((r: any) => ({ id: r.id, name: r.name })),
      team: user.team ? { id: user.team.id, name: user.team.name } : null,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

// PATCH /api/admin/users/:id
export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { roleId, roleIds, isActive, name, title, department, teamId } = req.body;

    const user = await prisma.user.findUnique({ where: { id }, include: { roles: true } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData: any = {};

    // Handle roleIds array (multiselect) or legacy single roleId
    const resolvedRoleIds: string[] | undefined = roleIds && Array.isArray(roleIds)
      ? roleIds
      : roleId
        ? [roleId]
        : undefined;

    if (resolvedRoleIds !== undefined) {
      if (resolvedRoleIds.length === 0) {
        return res.status(400).json({ error: 'At least one role is required' });
      }
      const rolesExist = await prisma.role.findMany({ where: { id: { in: resolvedRoleIds } } });
      if (rolesExist.length !== resolvedRoleIds.length) {
        return res.status(400).json({ error: 'One or more invalid roleIds' });
      }
      updateData.roles = { set: resolvedRoleIds.map((rid: string) => ({ id: rid })) };
      // If current activeRoleId is no longer in the new set, reset it
      if (!resolvedRoleIds.includes(user.activeRoleId || '')) {
        updateData.activeRoleId = resolvedRoleIds[0];
      }
    }

    if (isActive !== undefined) updateData.isActive = isActive;
    if (name !== undefined) updateData.name = name;
    if (title !== undefined) updateData.title = title;
    if (department !== undefined) updateData.department = department;
    if (teamId !== undefined) updateData.teamId = teamId || null;

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { roles: true, team: true },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        entity: 'User',
        entityId: id,
        action: 'UPDATE_USER',
        userId: req.user!.userId,
        changes: resolvedRoleIds ? { ...updateData, roleIds: resolvedRoleIds } : updateData,
      },
    });

    res.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      isActive: updated.isActive,
      roles: updated.roles.map((r: any) => ({ id: r.id, name: r.name })),
      team: updated.team ? { id: updated.team.id, name: updated.team.name } : null,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

// PATCH /api/admin/users/:id/reset-password
export async function resetUserPassword(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Block password reset for SSO users
    if (isSSOUser(user.email)) {
      return res.status(403).json({ error: 'Cannot reset password for SSO users (@qbadvisory.com). They authenticate via SSO.' });
    }

    const passwordHash = await hashPassword(newPassword);
    await (prisma.user as any).update({ where: { id }, data: { passwordHash, mustChangePassword: true } });

    await prisma.auditLog.create({
      data: {
        entity: 'User',
        entityId: id,
        action: 'RESET_PASSWORD',
        userId: req.user!.userId,
      },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
}

// GET /api/admin/roles
export async function listRoles(req: Request, res: Response) {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: { select: { users: true } },
        users: { select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(
      roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: r.permissions,
        isSystem: r.isSystem,
        userCount: r._count.users,
        users: r.users,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }))
    );
  } catch (error) {
    console.error('List roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
}

// POST /api/admin/roles
export async function createRole(req: Request, res: Response) {
  try {
    const { name, description, permissions } = req.body;

    if (!name || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'name and permissions (array) are required' });
    }

    const existing = await prisma.role.findUnique({ where: { name } });
    if (existing) {
      return res.status(409).json({ error: 'A role with this name already exists' });
    }

    const role = await prisma.role.create({
      data: { name, description, permissions, isSystem: false },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'Role',
        entityId: role.id,
        action: 'CREATE_ROLE',
        userId: req.user!.userId,
        changes: { name, permissions },
      },
    });

    res.status(201).json(role);
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
}

// PATCH /api/admin/roles/:id
export async function updateRole(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'permissions must be an array' });
      }
      updateData.permissions = permissions;
    }

    const updated = await prisma.role.update({
      where: { id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        entity: 'Role',
        entityId: id,
        action: 'UPDATE_ROLE',
        userId: req.user!.userId,
        changes: updateData,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
}

// DELETE /api/admin/roles/:id
export async function deleteRole(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (role.isSystem) {
      return res.status(400).json({ error: 'System roles cannot be deleted' });
    }

    if (role._count.users > 0) {
      return res.status(400).json({
        error: 'Cannot delete role with assigned users. Reassign users first.',
        userCount: role._count.users,
      });
    }

    await prisma.role.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        entity: 'Role',
        entityId: id,
        action: 'DELETE_ROLE',
        userId: req.user!.userId,
        changes: { name: role.name },
      },
    });

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
}

// POST /api/admin/roles/:id/users — Assign a user to a role
export async function addUserToRole(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) return res.status(404).json({ error: 'Role not found' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await prisma.role.update({
      where: { id },
      data: { users: { connect: { id: userId } } },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'Role',
        entityId: id,
        action: 'ASSIGN_USER_TO_ROLE',
        userId: req.user!.userId,
        changes: { roleName: role.name, userName: user.name, userEmail: user.email },
      },
    });

    res.json({ message: `User ${user.name} added to role ${role.name}` });
  } catch (error) {
    console.error('Add user to role error:', error);
    res.status(500).json({ error: 'Failed to add user to role' });
  }
}

// DELETE /api/admin/roles/:id/users/:userId — Remove a user from a role
export async function removeUserFromRole(req: Request, res: Response) {
  try {
    const { id, userId } = req.params;

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) return res.status(404).json({ error: 'Role not found' });

    await prisma.role.update({
      where: { id },
      data: { users: { disconnect: { id: userId } } },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'Role',
        entityId: id,
        action: 'REMOVE_USER_FROM_ROLE',
        userId: req.user!.userId,
        changes: { roleName: role.name, removedUserId: userId },
      },
    });

    res.json({ message: 'User removed from role' });
  } catch (error) {
    console.error('Remove user from role error:', error);
    res.status(500).json({ error: 'Failed to remove user from role' });
  }
}

// GET /api/admin/teams
export async function listTeams(req: Request, res: Response) {
  try {
    const teams = await prisma.team.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(teams);
  } catch (error) {
    console.error('List teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
}

// POST /api/admin/users/sync-qpeople — Sync users from QPeople HRMS
export async function syncQPeopleUsers(req: Request, res: Response) {
  try {
    const qpeopleRes = await fetch(
      'https://hr.qbadvisory.com/api/method/hrms.api.employee.get_all_users_details',
      { headers: { 'Authorization': 'token 762913b0eb9f140:1205f410c1b7b31' } }
    );
    if (!qpeopleRes.ok) {
      return res.status(502).json({ error: 'Failed to fetch from QPeople API' });
    }
    const json: any = await qpeopleRes.json();
    const employees: any[] = json.message?.data || [];

    // Get default role (Read-Only) for new synced users
    let defaultRole = await prisma.role.findFirst({ where: { name: 'Read-Only' } });
    if (!defaultRole) {
      defaultRole = await prisma.role.findFirst({ orderBy: { createdAt: 'asc' } });
    }
    if (!defaultRole) {
      return res.status(500).json({ error: 'No roles exist. Create at least one role first.' });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const emp of employees) {
      const empName = emp.employee_name || emp.name || '';
      const empEmail = emp.user_id || emp.prefered_email || emp.company_email || '';
      const empDept = emp.department || emp.department_name || '';
      const empDesignation = emp.designation || '';
      const empId = emp.employee || emp.name || '';

      if (!empEmail || !empName) {
        skipped++;
        continue;
      }

      // Check if user already exists by email or qpeopleId
      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { email: empEmail },
            ...(empId ? [{ qpeopleId: empId }] : []),
          ],
        },
      });

      if (existing) {
        // Update department and designation
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            department: empDept || existing.department,
            designation: empDesignation || existing.designation,
            qpeopleId: empId || existing.qpeopleId,
          },
        });
        updated++;
      } else {
        // Create new user (no password — they can't login until admin sets one)
        await prisma.user.create({
          data: {
            email: empEmail,
            name: empName,
            department: empDept || undefined,
            designation: empDesignation || undefined,
            qpeopleId: empId || undefined,
            roles: { connect: [{ id: defaultRole.id }] },
            activeRoleId: defaultRole.id,
            isActive: true,
          },
        });
        created++;
      }
    }

    await prisma.auditLog.create({
      data: {
        entity: 'User',
        entityId: 'bulk-sync',
        action: 'SYNC_QPEOPLE',
        userId: req.user!.userId,
        changes: { totalFetched: employees.length, created, updated, skipped },
      },
    });

    res.json({
      message: `QPeople sync complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`,
      created,
      updated,
      skipped,
      total: employees.length,
    });
  } catch (error) {
    console.error('QPeople sync error:', error);
    res.status(500).json({ error: 'Failed to sync users from QPeople' });
  }
}

const BUDGET_ASSUMPTIONS_KEY = 'budget_assumptions';

const DEFAULT_BUDGET_ASSUMPTIONS = {
  marginPercent: 35,
  workingDaysPerYear: 240,
  deliveryMgmtPercent: 5,
  benchPercent: 10,
  leaveEligibilityPercent: 0,
  annualGrowthBufferPercent: 0,
  averageIncrementPercent: 0,
  bonusPercent: 0,
  indirectCostPercent: 0,
  welfarePerFte: 0,
  trainingPerFte: 0,
};

// GET /api/admin/budget-assumptions
export async function getBudgetAssumptions(req: Request, res: Response) {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: BUDGET_ASSUMPTIONS_KEY },
    });
    res.json(config ? config.value : DEFAULT_BUDGET_ASSUMPTIONS);
  } catch (error) {
    console.error('Get budget assumptions error:', error);
    res.status(500).json({ error: 'Failed to fetch budget assumptions' });
  }
}

// PUT /api/admin/budget-assumptions
export async function updateBudgetAssumptions(req: Request, res: Response) {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const config = await prisma.systemConfig.upsert({
      where: { key: BUDGET_ASSUMPTIONS_KEY },
      update: { value: data },
      create: {
        key: BUDGET_ASSUMPTIONS_KEY,
        value: data,
        category: 'estimation',
        description: 'Budget assumptions for GOM/estimation calculations',
      },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'SystemConfig',
        entityId: config.id,
        action: 'UPDATE_BUDGET_ASSUMPTIONS',
        userId: req.user!.userId,
        changes: data,
      },
    });

    res.json(config.value);
  } catch (error) {
    console.error('Update budget assumptions error:', error);
    res.status(500).json({ error: 'Failed to update budget assumptions' });
  }
}
