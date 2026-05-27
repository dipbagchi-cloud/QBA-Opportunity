/**
 * Seed the EmailTemplate + NotificationRule for the stale-opportunity reminder.
 *
 * Idempotent: re-running will upsert the template/rule using their unique keys
 * (eventKey / name) without duplicating rows.
 *
 *   npx ts-node prisma/seed-stalled-opportunity-rule.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEMPLATE_KEY = 'stalled_opportunity';
const RULE_NAME = 'Stale Opportunity — Daily Reminder';

const TEMPLATE_SUBJECT =
  `Q-CRM: No update in {{daysIdle}} days — "{{opportunityTitle}}"`;

const TEMPLATE_BODY = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px">
<h2 style="color:#b45309;margin:0 0 16px">Stale Opportunity Reminder</h2>
<p>This opportunity has not been updated in <strong>{{daysIdle}} day(s)</strong>. The current stage's owner is in the <strong>To</strong> line; everyone else involved is in <strong>Cc</strong>.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;width:35%"><strong>Opportunity</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{opportunityTitle}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Client</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{clientName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Current Stage</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{stageName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Stage Owner</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{stageOwner}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Value</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{currency}} {{value}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Expected Close</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{expectedCloseDate}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Last updated</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{lastUpdatedDate}} ({{daysIdle}}d ago)</td></tr>
</table>
<p style="margin-top:20px"><a href="{{opportunityLink}}" style="background:#4f46e5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">Open Opportunity</a></p>
<p style="color:#64748b;font-size:12px;margin-top:24px">Automated reminder from Q-CRM. You are receiving this because you are the current stage owner or part of the opportunity assignment. To change recipients, threshold (days), or schedule, edit the rule under <strong>Settings &raquo; Notifications &raquo; Stale Opportunity</strong>.</p>
</div>`;

async function main() {
  // 1. Email template
  const tmpl = await prisma.emailTemplate.upsert({
    where: { eventKey: TEMPLATE_KEY },
    update: {
      name: 'Stale Opportunity Reminder',
      subject: TEMPLATE_SUBJECT,
      body: TEMPLATE_BODY,
      isActive: true,
    },
    create: {
      eventKey: TEMPLATE_KEY,
      name: 'Stale Opportunity Reminder',
      subject: TEMPLATE_SUBJECT,
      body: TEMPLATE_BODY,
      isActive: true,
    },
  });
  console.log(`  ✓ EmailTemplate "${tmpl.eventKey}" upserted (${tmpl.id})`);

  // 2. Notification rule
  // Use findFirst+update/create since NotificationRule has no unique on name.
  const existing = await prisma.notificationRule.findFirst({
    where: { name: RULE_NAME, triggerType: 'stalled_deal' },
  });

  const ruleData = {
    name: RULE_NAME,
    description:
      'Sends a daily reminder when an opportunity has not been updated for the configured number of days. Stage owner in To, others involved in Cc.',
    isActive: true,
    ruleType: 'time_driven',
    triggerType: 'stalled_deal',
    conditions: [
      { field: 'daysSinceUpdate', operator: 'gte', value: '3' },
    ] as any,
    recipientRoles: ['Sales'] as any,            // advisory — the engine uses dynamic stage-owner-in-TO
    recipientRolesCc: ['Manager', 'Presales'] as any,
    channels: ['in_app', 'email'] as any,
    emailTemplateKey: TEMPLATE_KEY,
    titleTemplate: 'No update in {{daysIdle}} days: "{{opportunityTitle}}"',
    messageTemplate: '{{stageName}} stage — last updated {{lastUpdatedDate}}.',
  };

  if (existing) {
    const r = await prisma.notificationRule.update({
      where: { id: existing.id },
      data: ruleData,
    });
    console.log(`  ✓ NotificationRule "${r.name}" updated (${r.id})`);
  } else {
    const r = await prisma.notificationRule.create({ data: ruleData });
    console.log(`  ✓ NotificationRule "${r.name}" created (${r.id})`);
  }
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
