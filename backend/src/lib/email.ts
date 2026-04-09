import nodemailer from 'nodemailer';
import { prisma } from './prisma';

// Default SMTP configuration - uses environment variables with fallback to a default account
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'qcrm.notifications@gmail.com',
    pass: process.env.SMTP_PASS || '',
  },
});

const FROM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER || 'qcrm.notifications@gmail.com';
const FROM_NAME = process.env.SMTP_FROM_NAME || 'Q-CRM Notifications';

/**
 * Replace {{variable}} placeholders in a template string with actual values
 */
function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
}

/**
 * Send a notification email for a given event.
 * Looks up the template by eventKey, renders it with variables, and sends.
 * Fails silently (logs errors) so it never blocks the main flow.
 */
export async function sendNotificationEmail(
  eventKey: string,
  recipientEmail: string,
  recipientName: string,
  variables: Record<string, string>
): Promise<boolean> {
  try {
    // Check if recipient has muted notifications
    const recipient = await prisma.user.findUnique({
      where: { email: recipientEmail },
      select: { muteNotification: true },
    });
    if (recipient?.muteNotification) {
      console.log(`[Email] User ${recipientEmail} has muted notifications — skipping '${eventKey}'.`);
      return false;
    }

    // Look up the template
    const template = await prisma.emailTemplate.findUnique({
      where: { eventKey },
    });

    if (!template || !template.isActive) {
      console.log(`[Email] Template '${eventKey}' not found or disabled — skipping.`);
      return false;
    }

    // Merge in recipient info to variables
    const allVars = { ...variables, recipientName, recipientEmail };

    const subject = renderTemplate(template.subject, allVars);
    const htmlBody = renderTemplate(template.body, allVars);

    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: recipientEmail,
      subject,
      html: htmlBody,
    });

    console.log(`[Email] Sent '${eventKey}' to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send '${eventKey}' to ${recipientEmail}:`, error);
    return false;
  }
}
