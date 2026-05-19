// One-off: insert the 3 reassignment email templates and 3 default
// notification rules. Safe to re-run (uses upsert / findFirst-then-create).
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const tplBody = (header) => `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px">
<h2 style="color:#4f46e5;margin:0 0 16px">${header}</h2>
<p>Hi {{recipientName}},</p>
<p>You have been assigned as <strong>{{assignmentField}}</strong> on the following opportunity:</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;width:40%"><strong>Opportunity</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{opportunityTitle}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Client</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{clientName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Stage</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{stageName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Value</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{currency}} {{value}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Region</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{region}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Technology</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{technology}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Sales Rep</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{salesRepName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Manager</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{managerName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Presales</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{presalesAssigneeName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Previously</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{previousAssignee}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Reassigned By</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{updatedBy}}</td></tr>
</table>
<p style="margin-top:20px"><a href="{{opportunityLink}}" style="background:#4f46e5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">View Opportunity</a></p>
<p style="color:#64748b;font-size:12px;margin-top:24px">This is an automated notification from Q-CRM.</p>
</div>`;

const templates = [
  { eventKey: 'sales_rep_reassigned', name: 'Sales Rep Reassigned',  subject: 'Q-CRM: You are the new Sales Rep on "{{opportunityTitle}}"',          body: tplBody('You are the new Sales Rep') },
  { eventKey: 'manager_reassigned',   name: 'Manager Reassigned',    subject: 'Q-CRM: You are the new Offshore Manager on "{{opportunityTitle}}"',   body: tplBody('You are the new Offshore Manager') },
  { eventKey: 'presales_assigned',    name: 'Presales Assigned',     subject: 'Q-CRM: You are now on the Presales team for "{{opportunityTitle}}"',  body: tplBody('You are now on the Presales team') },
];

const ruleDefs = [
  { field: 'sales_rep', templateKey: 'sales_rep_reassigned', label: 'Sales Rep' },
  { field: 'manager',   templateKey: 'manager_reassigned',   label: 'Manager' },
  { field: 'presales',  templateKey: 'presales_assigned',    label: 'Presales' },
];

(async () => {
  for (const t of templates) {
    await prisma.emailTemplate.upsert({
      where: { eventKey: t.eventKey },
      update: { subject: t.subject, body: t.body, name: t.name },
      create: t,
    });
    console.log(`upserted template: ${t.eventKey}`);
  }
  for (const def of ruleDefs) {
    const existing = await prisma.notificationRule.findFirst({
      where: { triggerType: 'assignment_change', toStage: def.field },
    });
    if (!existing) {
      await prisma.notificationRule.create({
        data: {
          name: `${def.label} Reassigned → Notify New Assignee`,
          description: `Emails the newly assigned ${def.label} whenever the field changes on an opportunity.`,
          isActive: true,
          triggerType: 'assignment_change',
          toStage: def.field,
          recipientRoles: [],
          channels: ['in_app', 'email'],
          emailTemplateKey: def.templateKey,
          titleTemplate: 'You are the new {{assignmentField}} on "{{opportunityTitle}}"',
          messageTemplate: '{{updatedBy}} assigned you as {{assignmentField}} for {{clientName}} on {{opportunityTitle}}.',
        },
      });
      console.log(`created rule: assignment_change/${def.field}`);
    } else {
      console.log(`rule already exists: assignment_change/${def.field}`);
    }
  }
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
