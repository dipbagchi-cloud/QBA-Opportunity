import { Request, Response } from 'express';
import { processChat, UserContext } from '../lib/chatbot';

// POST /api/chatbot/message
export async function chatMessage(req: Request, res: Response) {
    try {
        const { message } = req.body;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message is required' });
        }
        if (message.length > 2000) {
            return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
        }

        const user = (req as any).user;
        const ctx: UserContext = {
            userId: user.userId,
            email: user.email,
            roleName: user.roleName,
            permissions: user.permissions || [],
            userName: user.email.split('@')[0],
        };

        const response = await processChat(message.trim(), ctx);
        res.json(response);
    } catch (error: any) {
        console.error('Chatbot error:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
}

// GET /api/chatbot/history
export async function chatHistory(req: Request, res: Response) {
    try {
        const user = (req as any).user;
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        const interactions = await prisma.aIInteraction.findMany({
            where: { userId: user.userId, type: 'CHAT' },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: { id: true, prompt: true, response: true, createdAt: true, toolsCalled: true },
        });

        res.json(interactions.reverse());
    } catch (error: any) {
        console.error('Chat history error:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
}

// GET /api/chatbot/suggestions
export async function chatSuggestions(req: Request, res: Response) {
    const user = (req as any).user;
    const permissions = user.permissions || [];
    const isAdmin = permissions.includes('*');

    const suggestions: string[] = [];

    if (isAdmin || permissions.includes('pipeline:view')) {
        suggestions.push(
            'Show my opportunities',
            'List deals in Proposal stage',
            'Which deals are stalled?',
        );
    }
    if (isAdmin || permissions.includes('pipeline:write')) {
        suggestions.push(
            'Create a new deal called "Project Alpha" worth $200K',
        );
    }
    if (isAdmin || permissions.includes('analytics:view')) {
        suggestions.push(
            'Show pipeline analytics',
            'Revenue by technology',
            'What is our weighted forecast?',
            'Show top clients by revenue',
        );
    }

    res.json({ suggestions: suggestions.slice(0, 8) });
}
