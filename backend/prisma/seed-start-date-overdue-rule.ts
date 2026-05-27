/**
 * Seed the EmailTemplate + NotificationRule for the start_date_overdue
 * time-driven workflow.
 *
 * Idempotent: upserts template by eventKey and rule by (name, triggerType).
 *
 *   npx ts-node prisma/seed-start-date-overdue-rule.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TMPL_KEY = 'start_date_overdue';
const RULE_NAME = 'Start Date Overdue — Auto-revert to Presales';

const TMPL_SUBJECT = `Q-CRM: Start date passed ({{daysOverdue}}d ago) — "{{opportunityTitle}}" sent back for re-estimation`;

const TMPL_BODY = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px">
<h2 style="color:#b91c1c;margin:0 0 16px">Tentative Start Date has passed</h2>
<p>The opportunity below crossed its Tentative Start Date <strong>{{daysOverdue}} day(s)</strong> ago. It has been moved back to the <strong>Qualification</strong> stage with status <strong>Extended</strong> so the team can re-estimate against a fresh schedule.</p>
<p style="color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;padding:10px;border-radius:6px;font-size:13px"><strong>Sales: please update the revised Tentative Start Date on this opportunity.</strong> The project duration ({{duration}}) stays the same — the End Date will auto-recompute from the new start. Once you save, Presales will be notified to re-estimate so the GOM% remains valid.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;width:35%"><strong>Opportunity</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{opportunityTitle}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Client</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{clientName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Previous Stage</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{previousStage}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>New Stage / Status</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{stageName}} &raquo; {{detailedStatus}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Old Tentative Start Date</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{oldStartDate}} ({{daysOverdue}}d overdue)</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Duration (unchanged)</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{duration}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Re-estimation Round</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">#{{reEstimateCount}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Sales Rep</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{salesRepName}}</td></tr>
</table>
<p style="margin-top:20px"><a href="{{opportunityLink}}" style="background:#4f46e5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">Update Start Date</a></p>
<p style="color:#64748b;font-size:12px;margin-top:24px">Automated workflow from Q-CRM. The opportunity is auto-reverted once per day until Sales updates the start date. To change recipients, schedule, or copy, edit the rule under <strong>Settings &raquo; Notifications &raquo; Start Date Overdue</strong>.</p>
</div>`;

async function main() {
  const tmpl = await prisma.emailTemplate.upsert({
    where: { eventKey: TMPL_KEY },
    update: {
      name: 'Start Date Overdue',
      subject: TMPL_SUBJECT,
      body: TMPL_BODY,
      isActive: true,
    },
    create: {
      eventKey: TMPL_KEY,
      name: 'Start Date Overdue',
      subject: TMPL_SUBJECT,
      body: TMPL_BODY,
      isActive: true,
    },
  });
  console.log(`  ✓ EmailTemplate "${tmpl.eventKey}" upserted (${tmpl.id})`);

  const existing = await prisma.notificationRule.findFirst({
    where: { name: RULE_NAME, triggerType: 'start_date_overdue' },
  });
  const data = {
    name: RULE_NAME,
    description:
      'Daily time-driven workflow: when the Tentative Start Date passes today, the opportunity is auto-reverted to Qualification with detailedStatus="Extended" and Sales is asked to update the revised start date. Project duration stays the same — end date recomputes when Sales saves. Disable to stop both the auto-revert and the notification.',
    isActive: true,
    ruleType: 'time_driven',
    triggerType: 'start_date_overdue',
    // No threshold needed — the trigger is binary (start date < today). The
    // conditions JSON is kept null but admins can still set per-rule CC roles,
    // channels, template, and copy.
    conditions: null as any,
    recipientRoles: ['Sales'] as any,
    recipientRolesCc: ['Manager', 'Presales'] as any,
    channels: ['in_app', 'email'] as any,
    emailTemplateKey: TMPL_KEY,
    titleTemplate: 'Start date overdue by {{daysOverdue}} days: "{{opportunityTitle}}"',
    messageTemplate: 'Start date {{oldStartDate}} has passed. Moved to Qualification — update the revised start date.',
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
