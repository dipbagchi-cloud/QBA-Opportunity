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
    const { subject, body, isActive, name, metadata } = req.body;
    const updated = await prisma.emailTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(subject !== undefined && { subject }),
        ...(body !== undefined && { body }),
        ...(isActive !== undefined && { isActive }),
        ...(name !== undefined && { name }),
        ...(metadata !== undefined && { metadata }),
      },
    });
    res.json(updated);
  } catch (error) {
    console.error('Update email template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
}

// POST /api/admin/email-templates
export async function createEmailTemplate(req: Request, res: Response) {
  try {
    const { eventKey, name, subject, body, isActive, metadata } = req.body;
    if (!eventKey || !name || !subject || !body) {
      return res.status(400).json({ error: 'eventKey, name, subject, and body are required' });
    }
    const key = String(eventKey).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (!key) return res.status(400).json({ error: 'Invalid eventKey' });

    const existing = await prisma.emailTemplate.findUnique({ where: { eventKey: key } });
    if (existing) return res.status(409).json({ error: `Event key '${key}' already exists` });

    const created = await prisma.emailTemplate.create({
      data: {
        eventKey: key,
        name: String(name),
        subject: String(subject),
        body: String(body),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        ...(metadata !== undefined && { metadata }),
      },
    });
    res.status(201).json(created);
  } catch (error) {
    console.error('Create email template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
}

// DELETE /api/admin/email-templates/:id
export async function deleteEmailTemplate(req: Request, res: Response) {
  try {
    // Reject deletion if any active notification rule references this template
    const template = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const inUse = await prisma.notificationRule.count({ where: { emailTemplateKey: template.eventKey } });
    if (inUse > 0) {
      return res.status(409).json({
        error: `Cannot delete — ${inUse} notification rule(s) reference this template. Remove those rules first.`,
      });
    }

    await prisma.emailTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete email template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
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
      // Mock calculated fields for testing
      'calc:opportunityAge': '15',
      'calc:daysInStage': '3',
      'calc:daysUntilClose': '45',
      'calc:formattedValue': 'USD 250,000',
      'calc:weightedValue': 'USD 175,000',
      'calc:stageProgress': '33%',
      'calc:currentDate': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      'calc:currentTime': new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      'calc:stageSLA': 'On Track',
      'calc:expectedCloseFormatted': 'August 15, 2025',
      'calc:createdDateFormatted': 'June 1, 2025',
      opportunityLink: `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/test-123`,
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
