/**
 * Seed the EmailTemplates + NotificationRules for:
 *  - start_date_approaching     (time-driven, daily reminder to Sales)
 *  - opportunity_extended       (event-driven, Sales bumped startDate post-proposal)
 *
 * Idempotent: re-running upserts the templates by eventKey and the rules by
 * (name, triggerType) match.
 *
 *   npx ts-node prisma/seed-start-date-rules.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/* ─── Template 1: start_date_approaching ──────────────────────────────── */

const T1_KEY = 'start_date_approaching';
const T1_SUBJECT = `Q-CRM: Start date in {{daysToStartDate}} day(s) — "{{opportunityTitle}}"`;
const T1_BODY = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px">
<h2 style="color:#4f46e5;margin:0 0 16px">Tentative Start Date is approaching</h2>
<p>The project start date for the opportunity below is <strong>{{daysToStartDate}} day(s)</strong> away. Please confirm the date or update it if it has slipped.</p>
<p style="color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;padding:10px;border-radius:6px;font-size:13px"><strong>Note:</strong> If you update the Tentative Start Date on an opportunity whose proposal has already been submitted (Proposal / Negotiation stage), the deal will automatically move back to Presales with status <em>Extended</em> so the team can re-estimate against the new timeline.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;width:35%"><strong>Opportunity</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{opportunityTitle}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Client</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{clientName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Current Stage</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{stageName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Tentative Start Date</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{tentativeStartDate}} ({{daysToStartDate}}d away)</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Opportunity Close Date</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{expectedCloseDate}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Sales Rep</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{salesRepName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Manager</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{managerName}}</td></tr>
</table>
<p style="margin-top:20px"><a href="{{opportunityLink}}" style="background:#4f46e5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">Open Opportunity</a></p>
<p style="color:#64748b;font-size:12px;margin-top:24px">Automated reminder from Q-CRM. To adjust the days-out threshold or the daily schedule, edit the rule under <strong>Settings &raquo; Notifications &raquo; Start Date Approaching</strong>.</p>
</div>`;

/* ─── Template 2: opportunity_extended ────────────────────────────────── */

const T2_KEY = 'opportunity_extended';
const T2_SUBJECT = `Q-CRM: Re-estimation needed (Extended) — "{{opportunityTitle}}"`;
const T2_BODY = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px">
<h2 style="color:#b45309;margin:0 0 16px">Opportunity moved to Extended</h2>
<p>{{updatedByName}} updated the Tentative Start Date on an opportunity whose proposal had already been submitted. The deal has been automatically reverted to the <strong>Qualification</strong> stage with status <strong>Extended</strong>. The Presales team is asked to re-estimate so the GOM% remains valid against the new timeline.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;width:35%"><strong>Opportunity</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{opportunityTitle}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Client</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{clientName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Previous Stage</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{previousStage}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>New Stage / Status</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{stageName}} &raquo; {{detailedStatus}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>New Tentative Start Date</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{newStartDate}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Opportunity Close Date</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{expectedCloseDate}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Re-estimation Round</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">#{{reEstimateCount}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Updated By</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{updatedByName}}</td></tr>
</table>
<p style="background:#fef3c7;border:1px solid #fde68a;padding:10px;border-radius:6px;font-size:13px;color:#78350f"><strong>Action required (Presales):</strong> review the GOM Calculator inputs (resource months, rate cards, special costs) so the GOM% holds against the new timeline. GOM approval has been reset. Once re-approved, the deal will follow the standard sales path back to client.</p>
<p style="margin-top:20px"><a href="{{opportunityLink}}" style="background:#4f46e5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">Open Opportunity</a></p>
<p style="color:#64748b;font-size:12px;margin-top:24px">Automated notice from Q-CRM. To adjust recipients, channels, or copy, edit the rule under <strong>Settings &raquo; Notifications &raquo; Opportunity Extended</strong>.</p>
</div>`;

async function upsertTemplate(key: string, name: string, subject: string, body: string) {
  const t = await prisma.emailTemplate.upsert({
    where: { eventKey: key },
    update: { name, subject, body, isActive: true },
    create: { eventKey: key, name, subject, body, isActive: true },
  });
  console.log(`  ✓ EmailTemplate "${t.eventKey}" upserted (${t.id})`);
}

async function upsertRule(name: string, data: any) {
  const existing = await prisma.notificationRule.findFirst({
    where: { name, triggerType: data.triggerType },
  });
  if (existing) {
    const r = await prisma.notificationRule.update({ where: { id: existing.id }, data });
    console.log(`  ✓ NotificationRule "${r.name}" updated (${r.id})`);
  } else {
    const r = await prisma.notificationRule.create({ data });
    console.log(`  ✓ NotificationRule "${r.name}" created (${r.id})`);
  }
}

async function main() {
  await upsertTemplate(T1_KEY, 'Start Date Approaching', T1_SUBJECT, T1_BODY);
  await upsertTemplate(T2_KEY, 'Opportunity Extended', T2_SUBJECT, T2_BODY);

  await upsertRule('Start Date Approaching — Daily Reminder', {
    name: 'Start Date Approaching — Daily Reminder',
    description:
      'Daily reminder to Sales when the Tentative Start Date is within the configured window (default 7 days). Editing the date on an already-submitted opportunity auto-moves it back to Qualification with status "Extended".',
    isActive: true,
    ruleType: 'time_driven',
    triggerType: 'start_date_approaching',
    conditions: [{ field: 'daysToStartDate', operator: 'lte', value: '7' }],
    recipientRoles: ['Sales'],
    recipientRolesCc: ['Manager', 'Presales'],
    channels: ['in_app', 'email'],
    emailTemplateKey: T1_KEY,
    titleTemplate: 'Start date in {{daysToStartDate}} days: "{{opportunityTitle}}"',
    messageTemplate: 'Tentative Start Date {{tentativeStartDate}} is approaching — confirm or update.',
  });

  await upsertRule('Opportunity Extended — Re-estimation Required', {
    name: 'Opportunity Extended — Re-estimation Required',
    description:
      'Fires when Sales updates the Tentative Start Date on an opportunity past proposal submission. The opportunity is auto-reverted to Qualification with status="Extended" and Presales is asked to re-estimate.',
    isActive: true,
    ruleType: 'event_driven',
    triggerType: 'opportunity_extended',
    conditions: null,
    recipientRoles: ['Presales'],
    recipientRolesCc: ['Sales', 'Manager'],
    channels: ['in_app', 'email'],
    emailTemplateKey: T2_KEY,
    titleTemplate: 'Opportunity Extended: "{{opportunityTitle}}"',
    messageTemplate: '{{updatedByName}} updated Start Date to {{newStartDate}}. Re-estimate to match GOM%.',
  });
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
