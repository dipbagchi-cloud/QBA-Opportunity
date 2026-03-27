import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// GET /api/admin/email-templates
export async function listEmailTemplates(req: Request, res: Response) {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { eventKey: 'asc' },
    });
    res.json(templates);
  } catch (error) {
    console.error('List email templates error:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
}

// GET /api/admin/email-templates/:id
export async function getEmailTemplate(req: Request, res: Response) {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { id: req.params.id },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch template' });
  }
}

// PATCH /api/admin/email-templates/:id
export async function updateEmailTemplate(req: Request, res: Response) {
  try {
    const { subject, body, isActive, name } = req.body;
    const updated = await prisma.emailTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(subject !== undefined && { subject }),
        ...(body !== undefined && { body }),
        ...(isActive !== undefined && { isActive }),
        ...(name !== undefined && { name }),
      },
    });
    res.json(updated);
  } catch (error) {
    console.error('Update email template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
}

// POST /api/admin/email-templates/test
export async function sendTestEmail(req: Request, res: Response) {
  try {
    const { templateId, recipientEmail } = req.body;
    if (!templateId || !recipientEmail) {
      return res.status(400).json({ error: 'templateId and recipientEmail are required' });
    }

    const { sendNotificationEmail } = await import('../lib/email');

    const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const testVars: Record<string, string> = {
      opportunityTitle: 'Test Opportunity',
      opportunityId: 'test-123',
      clientName: 'Test Client',
      stageName: 'Presales',
      previousStage: 'Pipeline',
      salesRepName: 'John Doe',
      managerName: 'Jane Manager',
      recipientName: 'Test User',
      updatedBy: req.user?.email || 'System',
      comment: 'This is a test email from Q-CRM.',
    };

    const sent = await sendNotificationEmail(
      template.eventKey,
      recipientEmail,
      'Test User',
      testVars
    );

    res.json({ success: sent, message: sent ? 'Test email sent' : 'Failed — check SMTP configuration' });
  } catch (error) {
    console.error('Send test email error:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
}
