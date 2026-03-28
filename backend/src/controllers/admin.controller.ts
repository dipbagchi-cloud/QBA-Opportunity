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

    // Column filters
    const filterDept = (req.query.department as string || '').trim();
    const filterDesig = (req.query.designation as string || '').trim();
    const filterRole = (req.query.role as string || '').trim();
    const filterStatus = (req.query.status as string || '').trim();
    const filterManager = (req.query.reportingManager as string || '').trim();

    const where: any = {};
    const andConditions: any[] = [];

    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { department: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (filterDept) andConditions.push({ department: { equals: filterDept, mode: 'insensitive' } });
    if (filterDesig) andConditions.push({ designation: { equals: filterDesig, mode: 'insensitive' } });
    if (filterManager) andConditions.push({ reportingManagerName: { equals: filterManager, mode: 'insensitive' } });
    if (filterStatus === 'active') andConditions.push({ isActive: true });
    else if (filterStatus === 'inactive') andConditions.push({ isActive: false });
    if (filterRole) andConditions.push({ roles: { some: { name: { equals: filterRole, mode: 'insensitive' } } } });

    if (andConditions.length > 0) where.AND = andConditions;

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

    // Get distinct values for filter dropdowns
    const [departments, designations, managers, rolesList] = await Promise.all([
      prisma.user.findMany({ where: { department: { not: null } }, select: { department: true }, distinct: ['department'], orderBy: { department: 'asc' } }),
      prisma.user.findMany({ where: { designation: { not: null } }, select: { designation: true }, distinct: ['designation'], orderBy: { designation: 'asc' } }),
      prisma.user.findMany({ where: { reportingManagerName: { not: null } }, select: { reportingManagerName: true }, distinct: ['reportingManagerName'], orderBy: { reportingManagerName: 'asc' } }),
      prisma.role.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
    ]);

    res.json({
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        title: u.title,
        department: u.department,
        designation: u.designation,
        reportingManagerName: u.reportingManagerName,
        jobBand: (u as any).jobBand,
        phone: u.phone,
        qpeopleId: u.qpeopleId,
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
      filters: {
        departments: departments.map(d => d.department).filter(Boolean),
        designations: designations.map(d => d.designation).filter(Boolean),
        managers: managers.map(m => m.reportingManagerName).filter(Boolean),
        roles: rolesList.map(r => r.name),
        statuses: ['active', 'inactive'],
      },
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

    // Load QPeople designation-to-role mappings (multi-role: crmRoleIds is String[])
    const roleMappings = await (prisma as any).qPeopleRoleMapping.findMany();
    const designationToRoleIds = new Map<string, string[]>(roleMappings.map((m: any) => [m.qpeopleDesignation, m.crmRoleIds || []]));
    const designationToJobBand = new Map<string, string>(roleMappings.filter((m: any) => m.jobBand).map((m: any) => [m.qpeopleDesignation, m.jobBand]));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let roleMapped = 0;

    for (const emp of employees) {
      const empName = emp.employee_name || emp.name || '';
      const empEmail = emp.user_id || emp.prefered_email || emp.company_email || '';
      const empDept = emp.department || emp.department_name || '';
      const empDesignation = emp.designation || '';
      const empReportingManager = emp.reporting_manager_name || '';
      const empId = emp.employee || emp.name || '';

      if (!empEmail || !empName) {
        skipped++;
        continue;
      }

      // Resolve mapped roles and jobBand
      const mappedRoleIds = designationToRoleIds.get(empDesignation) || [];
      const mappedJobBand = designationToJobBand.get(empDesignation) || null;

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
        // Update department, designation, reporting manager, jobBand
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            department: empDept || existing.department,
            designation: empDesignation || existing.designation,
            reportingManagerName: empReportingManager || existing.reportingManagerName,
            qpeopleId: empId || existing.qpeopleId,
            ...( mappedJobBand ? { jobBand: mappedJobBand } : {}),
          } as any,
        });
        // Auto-assign mapped roles if designation has mappings
        if (mappedRoleIds.length > 0) {
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              roles: { connect: mappedRoleIds.map((rid: string) => ({ id: rid })) },
              activeRoleId: mappedRoleIds[0],
            },
          });
          roleMapped++;
        }
        updated++;
      } else {
        // Determine roles: use mapped roles if available, otherwise default Read-Only
        const assignRoleIds = mappedRoleIds.length > 0 ? mappedRoleIds : [defaultRole.id];
        if (mappedRoleIds.length > 0) roleMapped++;

        // Create new user (no password — they can't login until admin sets one)
        await prisma.user.create({
          data: {
            email: empEmail,
            name: empName,
            department: empDept || undefined,
            designation: empDesignation || undefined,
            reportingManagerName: empReportingManager || undefined,
            qpeopleId: empId || undefined,
            ...(mappedJobBand ? { jobBand: mappedJobBand } : {}),
            roles: { connect: assignRoleIds.map((rid: string) => ({ id: rid })) },
            activeRoleId: assignRoleIds[0],
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
        changes: { totalFetched: employees.length, created, updated, skipped, roleMapped },
      },
    });

    res.json({
      message: `QPeople sync complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Role-mapped: ${roleMapped}`,
      created,
      updated,
      skipped,
      roleMapped,
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

// ── QPeople Role Mappings ──

// GET /api/admin/qpeople-mappings — list all mappings
export async function listQPeopleMappings(req: Request, res: Response) {
  try {
    const mappings = await (prisma as any).qPeopleRoleMapping.findMany({
      orderBy: { qpeopleDesignation: 'asc' },
    });
    // Resolve role names from crmRoleIds
    const allRoles = await prisma.role.findMany({ select: { id: true, name: true } });
    const roleMap = new Map(allRoles.map(r => [r.id, r.name]));

    const result = mappings.map((m: any) => ({
      id: m.id,
      qpeopleDesignation: m.qpeopleDesignation,
      jobBand: m.jobBand,
      crmRoleIds: m.crmRoleIds || [],
      crmRoles: (m.crmRoleIds || []).map((rid: string) => ({ id: rid, name: roleMap.get(rid) || 'Unknown' })),
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    res.json(result);
  } catch (error) {
    console.error('List QPeople mappings error:', error);
    res.status(500).json({ error: 'Failed to fetch QPeople mappings' });
  }
}

// GET /api/admin/qpeople-mappings/designations — get distinct designations from synced users
export async function listQPeopleDesignations(req: Request, res: Response) {
  try {
    const rows = await prisma.user.findMany({
      where: { designation: { not: null } },
      select: { designation: true },
      distinct: ['designation'],
      orderBy: { designation: 'asc' },
    });
    const designations = rows.map(r => r.designation).filter(Boolean);
    res.json(designations);
  } catch (error) {
    console.error('List QPeople designations error:', error);
    res.status(500).json({ error: 'Failed to fetch designations' });
  }
}

// POST /api/admin/qpeople-mappings — create or update a mapping
export async function upsertQPeopleMapping(req: Request, res: Response) {
  try {
    const { qpeopleDesignation, crmRoleIds, jobBand, department } = req.body;
    if (!qpeopleDesignation || !crmRoleIds || !Array.isArray(crmRoleIds) || crmRoleIds.length === 0) {
      return res.status(400).json({ error: 'qpeopleDesignation and crmRoleIds (array) are required' });
    }
    // Verify all roles exist
    const roles = await prisma.role.findMany({ where: { id: { in: crmRoleIds } } });
    if (roles.length !== crmRoleIds.length) {
      return res.status(404).json({ error: 'One or more roles not found' });
    }

    const mapping = await (prisma as any).qPeopleRoleMapping.upsert({
      where: { qpeopleDesignation },
      create: { qpeopleDesignation, crmRoleIds, jobBand: jobBand || null, department: department || null },
      update: { crmRoleIds, jobBand: jobBand || null, department: department || null },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'QPeopleRoleMapping',
        entityId: mapping.id,
        action: 'UPSERT',
        userId: req.user!.userId,
        changes: { qpeopleDesignation, crmRoleIds, jobBand, department },
      },
    });

    // Auto-apply: update all users with this designation
    const usersWithDesignation = await prisma.user.findMany({
      where: { designation: qpeopleDesignation },
      include: { roles: { select: { id: true } } },
    });
    let applied = 0;
    for (const user of usersWithDesignation) {
      const newRoleIds = crmRoleIds.filter((rid: string) => !user.roles.some(r => r.id === rid));
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(newRoleIds.length > 0 ? {
            roles: { connect: newRoleIds.map((rid: string) => ({ id: rid })) },
            activeRoleId: crmRoleIds[0],
          } : {}),
          ...(jobBand ? { jobBand } : {}),
          ...(department ? { department } : {}),
        } as any,
      });
      applied++;
    }

    res.json({ ...mapping, applied });
  } catch (error) {
    console.error('Upsert QPeople mapping error:', error);
    res.status(500).json({ error: 'Failed to save mapping' });
  }
}

// DELETE /api/admin/qpeople-mappings/:id — delete a mapping
export async function deleteQPeopleMapping(req: Request, res: Response) {
  try {
    await (prisma as any).qPeopleRoleMapping.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete QPeople mapping error:', error);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
}

// POST /api/admin/qpeople-mappings/apply — apply mappings to all synced users
export async function applyQPeopleMappings(req: Request, res: Response) {
  try {
    const mappings: any[] = await (prisma as any).qPeopleRoleMapping.findMany();
    const designationToRoleIds = new Map<string, string[]>(mappings.map((m: any) => [m.qpeopleDesignation, m.crmRoleIds || []]));
    const designationToJobBand = new Map<string, string>(mappings.filter((m: any) => m.jobBand).map((m: any) => [m.qpeopleDesignation, m.jobBand]));
    const designationToDept = new Map<string, string>(mappings.filter((m: any) => m.department).map((m: any) => [m.qpeopleDesignation, m.department]));

    const users = await prisma.user.findMany({
      where: { designation: { not: null }, qpeopleId: { not: null } },
      include: { roles: { select: { id: true } } },
    });

    let applied = 0;
    for (const user of users) {
      const mappedRoleIds = designationToRoleIds.get(user.designation || '') || [];
      const mappedJobBand = designationToJobBand.get(user.designation || '') || null;
      const mappedDept = designationToDept.get(user.designation || '') || null;
      if (mappedRoleIds.length === 0 && !mappedJobBand && !mappedDept) continue;

      const newRoleIds = mappedRoleIds.filter(rid => !user.roles.some(r => r.id === rid));

      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(newRoleIds.length > 0 ? {
            roles: { connect: newRoleIds.map(rid => ({ id: rid })) },
            activeRoleId: mappedRoleIds[0],
          } : {}),
          ...(mappedJobBand ? { jobBand: mappedJobBand } : {}),
          ...(mappedDept ? { department: mappedDept } : {}),
        } as any,
      });
      if (newRoleIds.length > 0 || mappedJobBand || mappedDept) applied++;
    }

    res.json({ message: `Applied role/job-band mappings to ${applied} users`, applied, total: users.length });
  } catch (error) {
    console.error('Apply QPeople mappings error:', error);
    res.status(500).json({ error: 'Failed to apply mappings' });
  }
}
