import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// GET /api/admin/notification-rules
export async function listNotificationRules(req: Request, res: Response) {
  try {
    const rules = await prisma.notificationRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(rules);
  } catch (error) {
    console.error('List notification rules error:', error);
    res.status(500).json({ error: 'Failed to fetch notification rules' });
  }
}

// POST /api/admin/notification-rules
export async function createNotificationRule(req: Request, res: Response) {
  try {
    const { name, description, triggerType, fromStage, toStage, conditions, recipientRoles, channels, emailTemplateKey, titleTemplate, messageTemplate } = req.body;

    if (!name || !triggerType || !recipientRoles || !channels) {
      return res.status(400).json({ error: 'name, triggerType, recipientRoles, and channels are required' });
    }

    const validTriggers = ['stage_change', 'data_condition', 'approval', 'stalled_deal', 'health_drop'];
    if (!validTriggers.includes(triggerType)) {
      return res.status(400).json({ error: `triggerType must be one of: ${validTriggers.join(', ')}` });
    }

    const rule = await prisma.notificationRule.create({
      data: {
        name,
        description: description || null,
        triggerType,
        fromStage: fromStage || null,
        toStage: toStage || null,
        conditions: conditions || null,
        recipientRoles,
        channels,
        emailTemplateKey: emailTemplateKey || null,
        titleTemplate: titleTemplate || null,
        messageTemplate: messageTemplate || null,
      },
    });

    res.status(201).json(rule);
  } catch (error) {
    console.error('Create notification rule error:', error);
    res.status(500).json({ error: 'Failed to create notification rule' });
  }
}

// PATCH /api/admin/notification-rules/:id
export async function updateNotificationRule(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, isActive, triggerType, fromStage, toStage, conditions, recipientRoles, channels, emailTemplateKey, titleTemplate, messageTemplate } = req.body;

    const existing = await prisma.notificationRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Notification rule not found' });
    }

    const updated = await prisma.notificationRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(triggerType !== undefined && { triggerType }),
        ...(fromStage !== undefined && { fromStage }),
        ...(toStage !== undefined && { toStage }),
        ...(conditions !== undefined && { conditions }),
        ...(recipientRoles !== undefined && { recipientRoles }),
        ...(channels !== undefined && { channels }),
        ...(emailTemplateKey !== undefined && { emailTemplateKey }),
        ...(titleTemplate !== undefined && { titleTemplate }),
        ...(messageTemplate !== undefined && { messageTemplate }),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update notification rule error:', error);
    res.status(500).json({ error: 'Failed to update notification rule' });
  }
}

// DELETE /api/admin/notification-rules/:id
export async function deleteNotificationRule(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const existing = await prisma.notificationRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Notification rule not found' });
    }

    await prisma.notificationRule.delete({ where: { id } });
    res.json({ message: 'Notification rule deleted' });
  } catch (error) {
    console.error('Delete notification rule error:', error);
    res.status(500).json({ error: 'Failed to delete notification rule' });
  }
}
