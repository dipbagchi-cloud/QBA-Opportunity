const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: 'qcrm.noreply@qbadvisory.com',
    pass: 'V/067505236813al',
  },
});

const HTML_BODY = `<div style="font-family:Calibri,Arial,sans-serif;color:#333;line-height:1.6">
<p>This is an update to the <strong>Q-CRM UAT Testing Guide</strong> shared earlier.</p>

<div style="background:#fff8e1;border-left:4px solid #f9a825;padding:12px 16px;border-radius:0 6px 6px 0;margin:16px 0;font-size:13px">
<strong>⚡ What's New in This Update:</strong>
<ul style="margin:8px 0 0;padding:0 0 0 18px">
<li><strong>Opportunity Lifecycle Workflow Diagrams</strong> — Complete visual pipeline flow showing all 6 stages with probabilities</li>
<li><strong>Back-and-Forth Workflow Diagrams</strong> — All bidirectional loops documented:
  <ul style="margin:4px 0;padding:0 0 0 16px">
    <li>Re-estimate loop (Sales ↔ Presales via Qualification)</li>
    <li>GOM Approval cycle (Presales ↔ Manager)</li>
    <li>Discount Approval cycle (Sales ↔ Finance)</li>
    <li>SOW Approval chain (multi-step review with rejection loops)</li>
    <li>SOW Client Revision loop (Team ↔ Client)</li>
    <li>Requires Inputs loop (Readiness Engine → Author)</li>
  </ul>
</li>
<li><strong>Role Participation by Stage</strong> — Matrix showing which role acts at each lifecycle stage</li>
<li><strong>Complete Handoff Summary Table</strong> — All 6 loops with triggers, resets, and return paths</li>
<li><strong>SOW Document Lifecycle</strong> — 10-status progression with all backward loops marked</li>
</ul>
</div>

<div style="text-align:center;margin:20px 0">
<a href="https://qcrm.qbadvisory.com" style="display:inline-block;background:#1a3764;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:600">🔗 Open Q-CRM Application</a>
</div>

<div style="display:inline-flex;align-items:center;gap:6px;background:#f0f5ff;border:1px solid #d0ddf0;border-radius:6px;padding:8px 14px;font-size:12px;color:#1a3764;font-weight:600;margin:8px 0">📎 Attached: QCRM_Role_Use_Cases.docx (Updated with Workflow Diagrams)</div>

<h3 style="color:#1a3764;font-size:14px;font-weight:700;margin:20px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px">How to Use the Updated Document</h3>
<div style="background:#fafbfc;border:1px solid #e2e8f0;border-radius:6px;padding:16px 20px;margin:12px 0">
<ol style="margin:0;padding:0 0 0 18px">
<li>Open the attached document — it replaces the previous version</li>
<li>Review <strong>Section 1: Opportunity Lifecycle Workflow</strong> for the new visual diagrams</li>
<li>Pay special attention to the <strong>Back-and-Forth Workflows</strong> (Section 1.2) — these show every loop where an opportunity or SOW can move backward</li>
<li>During UAT, verify that each backward transition works correctly (e.g., re-estimate resets GOM approval, SOW rejection restarts the approval chain)</li>
<li>The role-specific use cases (Sections 3–8) remain unchanged from the previous version</li>
</ol>
</div>

<h3 style="color:#1a3764;font-size:14px;font-weight:700;margin:20px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px">Key Workflows to Validate</h3>
<div style="background:#f0f5ff;border-left:3px solid #1a3764;padding:12px 16px;border-radius:0 6px 6px 0;margin:16px 0;font-size:13px">
<ul style="margin:0;padding:0 0 0 18px">
<li><strong>Re-estimate:</strong> From Proposal/Negotiation → back to Qualification (GOM must re-approve)</li>
<li><strong>GOM rejection:</strong> Manager rejects → Presales revises → resubmits within Qualification</li>
<li><strong>SOW approval chain:</strong> Rejection at any step → SOW back to Drafting → chain restarts</li>
<li><strong>SOW client revision:</strong> Client requests changes → back to Drafting → re-share</li>
</ul>
</div>

<p>Please discard the previous version of the document and use this updated one for testing.</p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
<p style="margin-bottom:0">Best regards,<br/><strong>Jaydeep Bandyopadhyay</strong></p>
</div>`;

async function main() {
  // Get all unmuted active users
  const users = await prisma.user.findMany({
    where: { isActive: true, muteNotification: false },
    select: { id: true, name: true, email: true },
  });

  // Also include Sootam
  const sootam = await prisma.user.findFirst({
    where: { email: 'sootam.basu@qbadvisory.com' },
    select: { id: true, name: true, email: true },
  });

  const recipientMap = new Map();
  for (const u of users) recipientMap.set(u.email, u);
  if (sootam) recipientMap.set(sootam.email, sootam);

  const recipients = Array.from(recipientMap.values());
  console.log('Sending to', recipients.length, 'recipients:');
  recipients.forEach(u => console.log(' -', u.name, '<' + u.email + '>'));

  const docxPath = path.resolve(__dirname, 'QCRM_Role_Use_Cases.docx');
  if (!fs.existsSync(docxPath)) {
    console.error('DOCX not found at', docxPath);
    process.exit(1);
  }
  const docxSize = fs.statSync(docxPath).size;
  console.log('Attachment:', docxPath, '(' + Math.round(docxSize/1024) + ' KB)');

  const toList = recipients.map(u => `"${u.name}" <${u.email}>`).join(', ');

  const info = await transporter.sendMail({
    from: '"Q-CRM System" <qcrm.noreply@qbadvisory.com>',
    to: toList,
    subject: 'Q-CRM UAT Update – Workflow Diagrams Added to Role Testing Guide',
    html: `<div style="font-family:Calibri,Arial,sans-serif;color:#333">
<p>Dear Team,</p>
${HTML_BODY}
</div>`,
    attachments: [{
      filename: 'QCRM_Role_Use_Cases.docx',
      path: docxPath,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }],
  });

  console.log('Email sent! Message ID:', info.messageId);
  console.log('Response:', info.response);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
