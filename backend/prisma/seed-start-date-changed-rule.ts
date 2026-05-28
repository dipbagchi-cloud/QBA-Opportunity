/**
 * Seed the EmailTemplate + NotificationRule for the start_date_changed
 * event-driven notification (Sales changes the start date while it is within
 * 7 days — notify everyone involved).
 *
 * Idempotent: upserts the template by eventKey and the rule by (name,
 * triggerType).
 *
 *   npx ts-node prisma/seed-start-date-changed-rule.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TMPL_KEY = 'start_date_changed';
const RULE_NAME = 'Start Date Changed (within 7 days) — Notify All Involved';

const TMPL_SUBJECT = `Q-CRM: Start date changed — "{{opportunityTitle}}"`;

const TMPL_BODY = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px">
<h2 style="color:#4f46e5;margin:0 0 16px">Project Start Date changed</h2>
<p><strong>{{updatedByName}}</strong> changed the Tentative Start Date on an opportunity whose start was imminent (within 7 days). Everyone involved is being notified.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;width:35%"><strong>Opportunity</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{opportunityTitle}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Client</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{clientName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Current Stage</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{stageName}}</td></tr>
<tr><td style="padding:8px 12px;background:#fef3c7;border:1px solid #fde68a"><strong>Old Start Date</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{oldStartDate}}</td></tr>
<tr><td style="padding:8px 12px;background:#dcfce7;border:1px solid #bbf7d0"><strong>New Start Date</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{newStartDate}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Opportunity Close Date</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{expectedCloseDate}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Changed By</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{updatedByName}}</td></tr>
</table>
<p style="margin-top:20px"><a href="{{opportunityLink}}" style="background:#4f46e5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">Open Opportunity</a></p>
<p style="color:#64748b;font-size:12px;margin-top:24px">Automated notice from Q-CRM. To change recipients, channels, or copy, edit the rule under <strong>Settings &raquo; Notifications &raquo; Start Date Changed</strong>.</p>
</div>`;

async function main() {
  const tmpl = await prisma.emailTemplate.upsert({
    where: { eventKey: TMPL_KEY },
    update: { name: 'Start Date Changed', subject: TMPL_SUBJECT, body: TMPL_BODY, isActive: true },
    create: { eventKey: TMPL_KEY, name: 'Start Date Changed', subject: TMPL_SUBJECT, body: TMPL_BODY, isActive: true },
  });
  console.log(`  ✓ EmailTemplate "${tmpl.eventKey}" upserted (${tmpl.id})`);

  const existing = await prisma.notificationRule.findFirst({
    where: { name: RULE_NAME, triggerType: 'start_date_changed' },
  });
  const data = {
    name: RULE_NAME,
    description:
      'Fires when a Sales user changes the Tentative Start Date while the start date is within 7 days of today. Notifies everyone involved in the opportunity (owner / sales rep / manager / presales). recipientRolesCc adds extra Cc roles (e.g. Admin).',
    isActive: true,
    ruleType: 'event_driven',
    triggerType: 'start_date_changed',
    conditions: [{ field: 'daysToStartDate', operator: 'lte', value: '7' }] as any,
    recipientRoles: ['Sales', 'Manager', 'Presales'] as any, // advisory — engine notifies all involved
    recipientRolesCc: ['Admin'] as any,
    channels: ['in_app', 'email'] as any,
    emailTemplateKey: TMPL_KEY,
    titleTemplate: 'Start date changed: "{{opportunityTitle}}"',
    messageTemplate: '{{updatedByName}} moved start date {{oldStartDate}} → {{newStartDate}}.',
  };

  if (existing) {
    const r = await prisma.notificationRule.update({ where: { id: existing.id }, data });
    console.log(`  ✓ NotificationRule "${r.name}" updated (${r.id})`);
  } else {
    const r = await prisma.notificationRule.create({ data });
    console.log(`  ✓ NotificationRule "${r.name}" created (${r.id})`);
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
