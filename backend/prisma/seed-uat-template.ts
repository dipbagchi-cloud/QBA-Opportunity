/**
 * Seed the UAT Welcome email template with DOCX attachment reference.
 * Run: npx ts-node prisma/seed-uat-template.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EVENT_KEY = 'uat_welcome';

const UAT_BODY = `<div style="font-family:Calibri,Arial,sans-serif;color:#333;line-height:1.6">
<p>We are pleased to share the <strong>Q-CRM Role Use Cases &amp; Permission Guide</strong> document to support the upcoming User Acceptance Testing (UAT) cycle.</p>

<div style="text-align:center;margin:20px 0">
<a href="https://qcrm.qbadvisory.com" style="display:inline-block;background:#1a3764;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:600">🔗 Open Q-CRM Application</a>
</div>

<div style="display:inline-flex;align-items:center;gap:6px;background:#f0f5ff;border:1px solid #d0ddf0;border-radius:6px;padding:8px 14px;font-size:12px;color:#1a3764;font-weight:600;margin:8px 0">📎 Attached: QCRM_Role_Use_Cases.docx</div>

<h3 style="color:#1a3764;font-size:14px;font-weight:700;margin:20px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px">What This Document Covers</h3>
<ul style="margin:0;padding:0 0 0 20px">
<li><strong>6 system roles</strong> — Admin, Manager, Sales, Presales, Management, and Read-Only</li>
<li><strong>Detailed use cases</strong> for each role with expected behavior</li>
<li><strong>Permission matrix</strong> showing what each role can and cannot access</li>
<li><strong>Restriction lists</strong> to verify unauthorized actions are properly blocked</li>
</ul>

<h3 style="color:#1a3764;font-size:14px;font-weight:700;margin:20px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px">How to Use This Guide for UAT</h3>
<div style="background:#fafbfc;border:1px solid #e2e8f0;border-radius:6px;padding:16px 20px;margin:12px 0">
<ol style="margin:0;padding:0 0 0 18px">
<li>Identify which role(s) you have been assigned for testing</li>
<li>Navigate to the corresponding section in the attached document</li>
<li>Execute each numbered use case (e.g., UC-M01, UC-S03) and verify the expected behavior</li>
<li>For each role, also verify the <strong>Restrictions</strong> — confirm that blocked actions show appropriate error messages or are hidden from the UI</li>
<li>Log any deviations as defects with the <strong>use case ID</strong> for easy tracking</li>
</ol>
</div>

<h3 style="color:#1a3764;font-size:14px;font-weight:700;margin:20px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px">Key Areas to Validate</h3>
<div style="background:#f0f5ff;border-left:3px solid #1a3764;padding:12px 16px;border-radius:0 6px 6px 0;margin:16px 0;font-size:13px">
<ul style="margin:0;padding:0 0 0 18px">
<li>Role switching works correctly when a user has multiple roles</li>
<li>Permission boundaries are enforced (e.g., Sales cannot edit presales data)</li>
<li>Admin wildcard access covers all features without gaps</li>
<li>Data visibility is appropriate per role</li>
</ul>
</div>

<p>Please report any issues with the use case ID, steps to reproduce, and screenshots where possible.</p>
<p>Should you have any questions or need test credentials, feel free to reach out.</p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
<p style="margin-bottom:0">Best regards,<br/><strong>Jaydeep Bandyopadhyay</strong></p>
</div>`;

async function main() {
  // Upsert the template
  const existing = await prisma.emailTemplate.findUnique({ where: { eventKey: EVENT_KEY } });

  const data = {
    name: 'UAT Welcome — Role Testing Guide',
    subject: 'Q-CRM UAT – Role-Based Testing Guide & Instructions',
    body: UAT_BODY,
    isActive: true,
    metadata: {
      attachments: [
        {
          filename: 'QCRM_Role_Use_Cases.docx',
          storedName: 'tmpl-uat-role-guide.docx',
          size: 46012,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          uploadedAt: new Date().toISOString(),
        },
      ],
    },
  };

  if (existing) {
    await prisma.emailTemplate.update({ where: { eventKey: EVENT_KEY }, data });
    console.log(`Updated existing template: ${EVENT_KEY}`);
  } else {
    await prisma.emailTemplate.create({ data: { eventKey: EVENT_KEY, ...data } });
    console.log(`Created new template: ${EVENT_KEY}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
