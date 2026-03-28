import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// GET /api/contacts
export async function listContacts(req: Request, res: Response) {
    try {
        const { search, clientId, department, page = '1', limit = '20' } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = { isActive: true };

        if (search) {
            const s = String(search);
            where.OR = [
                { firstName: { contains: s, mode: 'insensitive' } },
                { lastName: { contains: s, mode: 'insensitive' } },
                { email: { contains: s, mode: 'insensitive' } },
                { title: { contains: s, mode: 'insensitive' } },
                { department: { contains: s, mode: 'insensitive' } },
            ];
        }

        if (clientId) where.clientId = String(clientId);
        if (department) where.department = { contains: String(department), mode: 'insensitive' };

        const [contacts, total] = await Promise.all([
            prisma.contact.findMany({
                where,
                include: { client: { select: { id: true, name: true, industry: true, location: true } } },
                orderBy: [{ isPrimary: 'desc' }, { firstName: 'asc' }],
                skip,
                take: Number(limit),
            }),
            prisma.contact.count({ where }),
        ]);

        res.json({ contacts, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    } catch (error) {
        console.error('List contacts error:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
}

// GET /api/contacts/:id
export async function getContact(req: Request, res: Response) {
    try {
        const contact = await prisma.contact.findUnique({
            where: { id: req.params.id },
            include: {
                client: { select: { id: true, name: true, industry: true, location: true } },
                activities: { orderBy: { createdAt: 'desc' }, take: 20 },
            },
        });
        if (!contact) return res.status(404).json({ error: 'Contact not found' });
        res.json(contact);
    } catch (error) {
        console.error('Get contact error:', error);
        res.status(500).json({ error: 'Failed to fetch contact' });
    }
}

// POST /api/contacts
export async function createContact(req: Request, res: Response) {
    try {
        const { firstName, lastName, email, phone, title, department, isPrimary, linkedInUrl, clientId } = req.body;

        if (!firstName || !lastName || !clientId) {
            return res.status(400).json({ error: 'firstName, lastName, and clientId are required' });
        }

        // Verify client exists
        const client = await prisma.client.findUnique({ where: { id: clientId } });
        if (!client) return res.status(400).json({ error: 'Client not found' });

        const contact = await prisma.contact.create({
            data: { firstName, lastName, email, phone, title, department, isPrimary: isPrimary || false, linkedInUrl, clientId },
            include: { client: { select: { id: true, name: true, industry: true, location: true } } },
        });

        res.status(201).json(contact);
    } catch (error) {
        console.error('Create contact error:', error);
        res.status(500).json({ error: 'Failed to create contact' });
    }
}

// PATCH /api/contacts/:id
export async function updateContact(req: Request, res: Response) {
    try {
        const existing = await prisma.contact.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Contact not found' });

        const { firstName, lastName, email, phone, title, department, isPrimary, linkedInUrl, clientId, isActive } = req.body;
        const data: any = {};
        if (firstName !== undefined) data.firstName = firstName;
        if (lastName !== undefined) data.lastName = lastName;
        if (email !== undefined) data.email = email;
        if (phone !== undefined) data.phone = phone;
        if (title !== undefined) data.title = title;
        if (department !== undefined) data.department = department;
        if (isPrimary !== undefined) data.isPrimary = isPrimary;
        if (linkedInUrl !== undefined) data.linkedInUrl = linkedInUrl;
        if (isActive !== undefined) data.isActive = isActive;
        if (clientId !== undefined) {
            const client = await prisma.client.findUnique({ where: { id: clientId } });
            if (!client) return res.status(400).json({ error: 'Client not found' });
            data.clientId = clientId;
        }

        const contact = await prisma.contact.update({
            where: { id: req.params.id },
            data,
            include: { client: { select: { id: true, name: true, industry: true, location: true } } },
        });

        res.json(contact);
    } catch (error) {
        console.error('Update contact error:', error);
        res.status(500).json({ error: 'Failed to update contact' });
    }
}

// DELETE /api/contacts/:id
export async function deleteContact(req: Request, res: Response) {
    try {
        const existing = await prisma.contact.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Contact not found' });

        await prisma.contact.update({
            where: { id: req.params.id },
            data: { isActive: false },
        });

        res.json({ message: 'Contact deleted' });
    } catch (error) {
        console.error('Delete contact error:', error);
        res.status(500).json({ error: 'Failed to delete contact' });
    }
}
