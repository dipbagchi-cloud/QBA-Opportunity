import nodemailer from 'nodemailer';
import { prisma } from './prisma';

// Microsoft Graph OAuth2 configuration
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || '';
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '';
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || '';
const FROM_EMAIL = process.env.SMTP_FROM || 'Jaydeep.Bandyopadhyay@qbadvisory.com';
const FROM_NAME = process.env.SMTP_FROM_NAME || 'Q-CRM Notifications';

// Use Microsoft Graph API if Azure credentials are configured, otherwise fall back to SMTP
const USE_GRAPH_API = !!(AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET);

// Fallback SMTP transporter (only used if Azure credentials are not set)
const transporter = USE_GRAPH_API ? null : nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

// Cache the access token to avoid fetching on every email
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getGraphAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    client_secret: AZURE_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Graph API token: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

async function sendViaGraphApi(to: string, subject: string, htmlBody: string): Promise<void> {
  const token = await getGraphAccessToken();
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(FROM_EMAIL)}/sendMail`;

  const response = await fetch(graphUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: htmlBody },
        toRecipients: [{ emailAddress: { address: to } }],
        from: { emailAddress: { name: FROM_NAME, address: FROM_EMAIL } },
      },
      saveToSentItems: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Graph API sendMail failed: ${response.status} ${errorText}`);
  }
}

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

    if (USE_GRAPH_API) {
      await sendViaGraphApi(recipientEmail, subject, htmlBody);
    } else {
      await transporter!.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: recipientEmail,
        subject,
        html: htmlBody,
      });
    }

    console.log(`[Email] Sent '${eventKey}' to ${recipientEmail} via ${USE_GRAPH_API ? 'Graph API' : 'SMTP'}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send '${eventKey}' to ${recipientEmail}:`, error);
    return false;
  }
}
