/**
 * Update the `opportunity_created` email template to include Manager + Presales
 * rows. The original seed.ts only showed Sales Rep / Created By, so the email
 * body had no Manager line even when one was assigned at creation.
 * Run on each env: npx ts-node update-opp-created-template.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const NEW_BODY = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px">
<h2 style="color:#4f46e5;margin:0 0 16px">New Opportunity Created</h2>
<p>A new opportunity has been created in Q-CRM:</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;width:40%"><strong>Title</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{opportunityTitle}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Client</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{clientName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Stage</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{stageName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Value</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{currency}} {{value}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Probability</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{calc:probability}}%</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Region</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{region}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Practice</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{practice}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Technology</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{technology}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Project Type</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{projectType}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Pricing Model</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{pricingModel}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Tentative Start</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{tentativeStartDate}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Duration</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{tentativeDuration}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Sales Rep</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{salesRepName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Manager (Offshore)</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{managerName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Presales</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{presalesAssigneeName}}</td></tr>
<tr><td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0"><strong>Created By</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">{{createdBy}}</td></tr>
</table>
<p><strong>Description:</strong></p>
<p style="padding:12px;background:#f8fafc;border-left:3px solid #4f46e5;margin:8px 0">{{description}}</p>
<p style="margin-top:20px"><a href="{{opportunityLink}}" style="background:#4f46e5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">View Opportunity</a></p>
<p style="color:#64748b;font-size:12px;margin-top:24px">This is an automated notification from Q-CRM.</p>
</div>`;

async function main() {
  const r = await prisma.emailTemplate.update({
    where: { eventKey: 'opportunity_created' },
    data: { body: NEW_BODY },
  });
  console.log('Updated template:', r.eventKey, 'len=', r.body.length);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
