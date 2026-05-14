import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { PERMISSIONS } from '../lib/permissions';

// GET /api/users/search?q=<name>&permission=presales:write
// Returns active users matching the query who hold the requested permission.
export const searchUsers = async (req: Request, res: Response) => {
    try {
        const q = ((req.query.q as string) || '').trim();
        const permission = ((req.query.permission as string) || '').trim();

        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
            },
            select: { id: true, name: true, email: true, roles: { select: { permissions: true } } },
            orderBy: { name: 'asc' },
            take: 30,
        });

        const filtered = permission
            ? users.filter((u) =>
                  u.roles.some((r) => {
                      const perms = r.permissions as string[];
                      return perms.includes('*') || perms.includes(permission);
                  })
              )
            : users;

        res.json(filtered.map(({ id, name, email }) => ({ id, name, email })));
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUserDetails = async (req: Request, res: Response) => {
    try {
        const userId = req.params.id;
        const currentUser = (req as any).user;

        // Determine if the requester has admin rights
        const isAdmin = currentUser?.permissions?.includes(PERMISSIONS.USERS_MANAGE) || false;

        // Fetch user basic data
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                title: true,
                department: isAdmin ? true : false,
                isActive: isAdmin ? true : false,
                createdAt: isAdmin ? true : false,
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Fetch opportunities created by this user (everyone can see this)
        const opportunities = await prisma.opportunity.findMany({
            where: { ownerId: userId, isArchived: false },
            select: {
                id: true,
                title: true,
                currentStage: true,
                value: true,
                currency: true,
                client: { select: { name: true } },
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // Fetch projects involving this user (Admin only as per requirements)
        let projects: any[] = [];
        if (isAdmin) {
            projects = await prisma.project.findMany({
                where: {
                    OR: [
                        { managerId: userId },
                        { team: { some: { userId: userId } } }
                    ]
                },
                select: {
                    id: true,
                    name: true,
                    code: true,
                    status: true,
                    healthScore: true,
                    client: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        }

        res.json({
            user,
            opportunities,
            projects
        });

    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
