import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// GET /api/resources
export async function listResources(req: Request, res: Response) {
    try {
        const resources = await prisma.resource.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(resources);
    } catch (error) {
        console.error('Resources API Error:', error);
        res.status(500).json({ error: 'Failed to fetch resources' });
    }
}
