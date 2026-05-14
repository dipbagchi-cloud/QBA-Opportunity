import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';

const TEMPLATE_ATTACHMENTS_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'attachments');

// Multer upload for template attachments
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(TEMPLATE_ATTACHMENTS_DIR)) fs.mkdirSync(TEMPLATE_ATTACHMENTS_DIR, { recursive: true });
    cb(null, TEMPLATE_ATTACHMENTS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `tmpl-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});
export const templateAttachmentUpload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

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
      // Merge Variables
      opportunityTitle: 'Test Opportunity — Cloud Migration',
      opportunityId: 'test-123',
      dealName: 'Test Opportunity — Cloud Migration',
      clientName: 'Acme Corporation',
      stageName: 'Presales',
      previousStage: 'Pipeline',
      salesRepName: 'John Doe',
      managerName: 'Jane Manager',
      ownerName: 'Sarah Johnson',
      ownerEmail: 'sarah.johnson@qbadvisory.com',
      updatedBy: req.user?.email || 'System',
      createdBy: req.user?.email || 'System',
      userName: req.user?.email || 'System',
      comment: 'This is a test email from Q-CRM.',
      reason: 'This is a test email from Q-CRM.',
      region: 'South Asia',
      technology: 'Azure / AWS',
      practice: 'Cloud & DevOps',
      projectType: 'Fixed Price',
      pricingModel: 'T&M',
      description: 'Enterprise cloud migration for Acme Corp legacy infrastructure.',
      tentativeStartDate: 'September 1, 2025',
      tentativeDuration: '6 months',
      value: '250,000',
      currency: 'USD',
      probability: '70',
      adjustedEstimatedValue: 'USD 265,000',
      reEstimateCount: '0',
      recipientName: 'Test User',
      opportunityLink: `${process.env.FRONTEND_URL || 'https://qcrm.qbadvisory.com'}/dashboard/opportunities/test-123`,
      // opportunity.* fields (match template builder Opportunity catalog)
      'opportunity.title': 'Test Opportunity — Cloud Migration',
      'opportunity.description': 'Enterprise cloud migration for Acme Corp legacy infrastructure.',
      'opportunity.value': '250,000',
      'opportunity.currency': 'USD',
      'opportunity.probability': '70',
      'opportunity.currentStage': 'Presales',
      'opportunity.detailedStatus': 'Estimation Submitted',
      'opportunity.region': 'South Asia',
      'opportunity.practice': 'Cloud & DevOps',
      'opportunity.technology': 'Azure / AWS',
      'opportunity.projectType': 'Fixed Price',
      'opportunity.pricingModel': 'T&M',
      'opportunity.salesRepName': 'John Doe',
      'opportunity.managerName': 'Jane Manager',
      'opportunity.tentativeStartDate': 'September 1, 2025',
      'opportunity.tentativeDuration': '6 months',
      'opportunity.tentativeDurationUnit': 'months',
      'opportunity.tentativeEndDate': 'March 1, 2026',
      'opportunity.expectedCloseDate': 'April 30, 2026',
      'opportunity.expectedDayRate': '1,200',
      'opportunity.adjustedEstimatedValue': 'USD 265,000',
      'opportunity.reEstimateCount': '0',
      'opportunity.gomApproved': 'Yes',
      // Built-in calculated fields
      'calc:opportunityAge': '15',
      'calc:daysInStage': '3',
      'calc:daysUntilClose': '45',
      'calc:formattedValue': 'USD 250,000',
      'calc:weightedValue': 'USD 175,000',
      'calc:stageProgress': '33%',
      'calc:currentDate': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      'calc:currentTime': new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      'calc:stageSLA': 'On Track',
      'calc:expectedCloseFormatted': 'April 30, 2026',
      'calc:createdDateFormatted': 'June 1, 2025',
      // GOM / profitability fields
      'calc:gomPercent': '42.5%',
      'calc:totalRevenue': 'USD 265,000',
      'calc:totalCost': 'USD 152,375',
      'calc:gomAbsolute': 'USD 112,625',
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

// POST /api/admin/email-templates/:id/attachments — Upload attachment to template
export async function uploadTemplateAttachment(req: Request, res: Response) {
  try {
    const template = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } }) as any;
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const meta = template.metadata || {};
    const attachments: any[] = meta.attachments || [];
    attachments.push({
      filename: req.file.originalname,
      storedName: req.file.filename,
      size: req.file.size,
      contentType: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
    });

    await prisma.emailTemplate.update({
      where: { id: req.params.id },
      data: { metadata: { ...meta, attachments } },
    });

    res.json({ success: true, attachment: attachments[attachments.length - 1], total: attachments.length });
  } catch (error) {
    console.error('Upload template attachment error:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
}

// DELETE /api/admin/email-templates/:id/attachments/:storedName — Remove attachment from template
export async function deleteTemplateAttachment(req: Request, res: Response) {
  try {
    const template = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } }) as any;
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const meta = template.metadata || {};
    const attachments: any[] = meta.attachments || [];
    const idx = attachments.findIndex((a: any) => a.storedName === req.params.storedName);
    if (idx === -1) return res.status(404).json({ error: 'Attachment not found' });

    // Delete file from disk
    const filePath = path.join(TEMPLATE_ATTACHMENTS_DIR, attachments[idx].storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    attachments.splice(idx, 1);
    await prisma.emailTemplate.update({
      where: { id: req.params.id },
      data: { metadata: { ...meta, attachments } },
    });

    res.json({ success: true, remaining: attachments.length });
  } catch (error) {
    console.error('Delete template attachment error:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
}
