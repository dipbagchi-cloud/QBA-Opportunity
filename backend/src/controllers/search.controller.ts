import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { PERMISSIONS, hasAnyPermission, hasPermission } from '../lib/permissions';

export const globalSearch = async (req: Request, res: Response) => {
    try {
        const q = req.query.q as string;
        if (!q || q.trim().length === 0) {
            return res.json({
                opportunities: [],
                contacts: [],
                clients: [],
                users: []
            });
        }

        const searchQuery = q.trim();
        const permissions = req.user?.permissions || [];
        const canSearchOpportunities = hasAnyPermission(permissions, [
            PERMISSIONS.PIPELINE_VIEW,
            PERMISSIONS.PRESALES_VIEW,
            PERMISSIONS.SALES_VIEW,
        ]);
        const canSearchContacts = hasAnyPermission(permissions, [
            PERMISSIONS.CONTACTS_VIEW,
            PERMISSIONS.CONTACTS_WRITE,
        ]);
        const canSearchUsers = hasPermission(permissions, PERMISSIONS.USERS_MANAGE);
        const canSearchProjects = hasAnyPermission(permissions, [
            PERMISSIONS.SALES_VIEW,
            PERMISSIONS.SALES_WRITE,
            PERMISSIONS.SOW_VIEW,
            PERMISSIONS.SOW_WRITE,
            PERMISSIONS.SOW_ADMIN,
        ]);

        // Perform parallel queries
        const [opportunities, contacts, clients, users, projects] = await Promise.all([
            // Opportunities
            canSearchOpportunities ? prisma.opportunity.findMany({
                where: {
                    OR: [
                        { title: { contains: searchQuery, mode: 'insensitive' } },
                        { description: { contains: searchQuery, mode: 'insensitive' } },
                        { client: { name: { contains: searchQuery, mode: 'insensitive' } } },
                        { owner: { name: { contains: searchQuery, mode: 'insensitive' } } },
                        { tags: { contains: searchQuery, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, title: true, client: { select: { name: true } }, currentStage: true },
                take: 5
            }) : Promise.resolve([]),
            // Contacts
            canSearchContacts ? prisma.contact.findMany({
                where: {
                    OR: [
                        { firstName: { contains: searchQuery, mode: 'insensitive' } },
                        { lastName: { contains: searchQuery, mode: 'insensitive' } },
                        { email: { contains: searchQuery, mode: 'insensitive' } },
                        { client: { name: { contains: searchQuery, mode: 'insensitive' } } }
                    ]
                },
                select: { id: true, firstName: true, lastName: true, email: true, title: true, client: { select: { name: true } } },
                take: 5
            }) : Promise.resolve([]),
            // Clients
            canSearchContacts ? prisma.client.findMany({
                where: {
                    OR: [
                        { name: { contains: searchQuery, mode: 'insensitive' } },
                        { domain: { contains: searchQuery, mode: 'insensitive' } },
                        { industry: { contains: searchQuery, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, name: true, domain: true, industry: true },
                take: 5
            }) : Promise.resolve([]),
            // Users
            canSearchUsers ? prisma.user.findMany({
                where: {
                    OR: [
                        { name: { contains: searchQuery, mode: 'insensitive' } },
                        { email: { contains: searchQuery, mode: 'insensitive' } },
                        { title: { contains: searchQuery, mode: 'insensitive' } },
                        { department: { contains: searchQuery, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, name: true, email: true, title: true, department: true },
                take: 5
            }) : Promise.resolve([]),
            // Projects
            canSearchProjects ? prisma.project.findMany({
                where: {
                    OR: [
                        { name: { contains: searchQuery, mode: 'insensitive' } },
                        { code: { contains: searchQuery, mode: 'insensitive' } },
                        { description: { contains: searchQuery, mode: 'insensitive' } },
                        { client: { name: { contains: searchQuery, mode: 'insensitive' } } }
                    ]
                },
                select: { id: true, name: true, code: true, status: true, client: { select: { name: true } } },
                take: 5
            }) : Promise.resolve([])
        ]);

        res.json({
            opportunities,
            contacts,
            clients,
            users,
            projects
        });

    } catch (error) {
        console.error('Error in global search:', error);
        res.status(500).json({ message: 'Internal server error during search' });
    }
};
