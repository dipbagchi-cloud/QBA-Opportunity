import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

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

        // Perform parallel queries
        const [opportunities, contacts, clients, users, projects] = await Promise.all([
            // Opportunities
            prisma.opportunity.findMany({
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
            }),
            // Contacts
            prisma.contact.findMany({
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
            }),
            // Clients
            prisma.client.findMany({
                where: {
                    OR: [
                        { name: { contains: searchQuery, mode: 'insensitive' } },
                        { domain: { contains: searchQuery, mode: 'insensitive' } },
                        { industry: { contains: searchQuery, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, name: true, domain: true, industry: true },
                take: 5
            }),
            // Users
            prisma.user.findMany({
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
            }),
            // Projects
            prisma.project.findMany({
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
            })
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
