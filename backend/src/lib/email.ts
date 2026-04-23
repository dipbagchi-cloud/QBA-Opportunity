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
 *
 * `recipientEmail` may be a single address string or an array for bulk To.
 * `ccEmails` is optional array of CC addresses.
 */
export async function sendNotificationEmail(
  eventKey: string,
  recipientEmail: string | string[],
  recipientName: string,
  variables: Record<string, string>,
  ccEmails?: string[]
): Promise<boolean> {
  try {
    // Normalise inputs to arrays
    const toList = Array.isArray(recipientEmail) ? recipientEmail : [recipientEmail];
    const ccList = Array.isArray(ccEmails) ? ccEmails : [];
    const originalToLabel = toList.join(',');

    // Test-mode override: when EMAIL_TEST_OVERRIDE is set, all emails are
    // redirected to that address and the recipient's mute flag is ignored.
    // The original recipient is annotated in the subject for visibility.
    const testOverride = (process.env.EMAIL_TEST_OVERRIDE || '').trim();
    const isOverride = testOverride.length > 0;

    let actualTo: string[];
    let actualCc: string[];
    if (isOverride) {
      actualTo = [testOverride];
      actualCc = [];
    } else {
      // Check mute flags for each recipient — drop muted ones
      const allEmails = [...toList, ...ccList];
      const muteRows = allEmails.length > 0
        ? await prisma.user.findMany({
            where: { email: { in: allEmails } },
            select: { email: true, muteNotification: true },
          })
        : [];
      const mutedSet = new Set(muteRows.filter(r => r.muteNotification).map(r => r.email.toLowerCase()));
      actualTo = toList.filter(e => !mutedSet.has(e.toLowerCase()));
      actualCc = ccList.filter(e => !mutedSet.has(e.toLowerCase()));
      if (actualTo.length === 0 && actualCc.length === 0) {
        console.log(`[Email] All recipients muted — skipping '${eventKey}'.`);
        return false;
      }
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
    const allVars = { ...variables, recipientName, recipientEmail: originalToLabel };

    let subject = renderTemplate(template.subject, allVars);
    const htmlBody = renderTemplate(template.body, allVars);

    if (isOverride) {
      subject = `[TEST→${originalToLabel}${ccList.length > 0 ? ` cc:${ccList.join(',')}` : ''}] ${subject}`;
    }

    if (USE_GRAPH_API) {
      // Graph API supports cc via message.ccRecipients
      const token = await getGraphAccessToken();
      const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(FROM_EMAIL)}/sendMail`;
      const response = await fetch(graphUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'HTML', content: htmlBody },
            toRecipients: actualTo.map(a => ({ emailAddress: { address: a } })),
            ccRecipients: actualCc.map(a => ({ emailAddress: { address: a } })),
            from: { emailAddress: { name: FROM_NAME, address: FROM_EMAIL } },
          },
          saveToSentItems: false,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Graph API sendMail failed: ${response.status} ${errorText}`);
      }
    } else {
      await transporter!.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: actualTo.join(', '),
        cc: actualCc.length > 0 ? actualCc.join(', ') : undefined,
        subject,
        html: htmlBody,
      });
    }

    console.log(`[Email] Sent '${eventKey}' to [${actualTo.join(',')}]${actualCc.length > 0 ? ` cc:[${actualCc.join(',')}]` : ''}${isOverride ? ` (orig to:${originalToLabel})` : ''} via ${USE_GRAPH_API ? 'Graph API' : 'SMTP'}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send '${eventKey}' to ${Array.isArray(recipientEmail) ? recipientEmail.join(',') : recipientEmail}:`, error);
    return false;
  }
}
