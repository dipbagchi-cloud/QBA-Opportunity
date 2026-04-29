// Send UAT email to a specific user
require('dotenv').config();
const nodemailer = require('nodemailer');
const path = require('path');

const ATTACHMENT_PATH = path.resolve(__dirname, '..', 'QCRM_Role_Use_Cases.docx');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
body{font-family:Calibri,Arial,sans-serif;color:#333;line-height:1.6;margin:0;padding:0}
.container{max-width:640px;margin:0 auto;padding:24px}
.header{background:linear-gradient(135deg,#1a3764,#2c5f8a);color:#fff;padding:28px 24px;border-radius:8px 8px 0 0;text-align:center}
.header h1{margin:0;font-size:22px;font-weight:600;letter-spacing:.5px}
.header p{margin:6px 0 0;font-size:13px;opacity:.85}
.body{background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:28px 24px}
.app-link{display:inline-block;background:#1a3764;color:#fff!important;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:600;margin:12px 0}
.section-title{color:#1a3764;font-size:14px;font-weight:700;margin:20px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px}
.checklist{margin:0;padding:0 0 0 20px}.checklist li{margin:6px 0;font-size:13px}
.highlight{background:#f0f5ff;border-left:3px solid #1a3764;padding:12px 16px;border-radius:0 6px 6px 0;margin:16px 0;font-size:13px}
.steps{background:#fafbfc;border:1px solid #e2e8f0;border-radius:6px;padding:16px 20px;margin:12px 0}
.steps ol{margin:0;padding:0 0 0 18px}.steps ol li{margin:6px 0;font-size:13px}
.attachment-badge{display:inline-flex;align-items:center;gap:6px;background:#f0f5ff;border:1px solid #d0ddf0;border-radius:6px;padding:8px 14px;font-size:12px;color:#1a3764;font-weight:600;margin:8px 0}
.footer{text-align:center;padding:20px;color:#999;font-size:11px}
.divider{border:none;border-top:1px solid #e2e8f0;margin:20px 0}
</style></head><body>
<div class="container">
<div class="header"><h1>Q-CRM — User Acceptance Testing</h1><p>Role-Based Testing Guide &amp; Instructions</p></div>
<div class="body">
<p>Dear Sootam,</p>
<p>We are pleased to share the <strong>Q-CRM Role Use Cases &amp; Permission Guide</strong> document to support the upcoming User Acceptance Testing (UAT) cycle.</p>
<div style="text-align:center;margin:20px 0"><a href="https://qcrm.qbadvisory.com" class="app-link">🔗 Open Q-CRM Application</a></div>
<div class="attachment-badge">📎 Attached: QCRM_Role_Use_Cases.docx</div>
<p class="section-title">What This Document Covers</p>
<ul class="checklist">
<li><strong>6 system roles</strong> — Admin, Manager, Sales, Presales, Management, and Read-Only</li>
<li><strong>Detailed use cases</strong> for each role with expected behavior</li>
<li><strong>Permission matrix</strong> showing what each role can and cannot access</li>
<li><strong>Restriction lists</strong> to verify unauthorized actions are properly blocked</li>
</ul>
<p class="section-title">How to Use This Guide for UAT</p>
<div class="steps"><ol>
<li>Identify which role(s) you have been assigned for testing</li>
<li>Navigate to the corresponding section in the attached document</li>
<li>Execute each numbered use case (e.g., UC-M01, UC-S03) and verify the expected behavior</li>
<li>For each role, also verify the <strong>Restrictions</strong> — confirm that blocked actions show appropriate error messages or are hidden from the UI</li>
<li>Log any deviations as defects with the <strong>use case ID</strong> for easy tracking</li>
</ol></div>
<p class="section-title">Key Areas to Validate</p>
<div class="highlight"><ul style="margin:0;padding:0 0 0 18px">
<li>Role switching works correctly when a user has multiple roles</li>
<li>Permission boundaries are enforced (e.g., Sales cannot edit presales data)</li>
<li>Admin wildcard access covers all features without gaps</li>
<li>Data visibility is appropriate per role</li>
</ul></div>
<p>Please report any issues with the use case ID, steps to reproduce, and screenshots where possible.</p>
<p>Should you have any questions or need test credentials, feel free to reach out.</p>
<hr class="divider">
<p style="margin-bottom:0">Best regards,<br><strong>Jaydeep Bandyopadhyay</strong></p>
</div>
<div class="footer">Q-CRM &bull; QB Advisory &bull; <a href="https://qcrm.qbadvisory.com" style="color:#1a3764">qcrm.qbadvisory.com</a></div>
</div></body></html>`;

transporter.sendMail({
  from: '"Q-CRM Notifications" <qcrm.noreply@qbadvisory.com>',
  to: 'sootam.basu@qbadvisory.com',
  subject: 'Q-CRM UAT – Role-Based Testing Guide & Instructions',
  html: htmlBody,
  attachments: [{
    filename: 'QCRM_Role_Use_Cases.docx',
    path: ATTACHMENT_PATH,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }],
}).then(info => {
  console.log('Email sent to sootam.basu@qbadvisory.com');
  console.log('Message ID:', info.messageId);
  console.log('Response:', info.response);
}).catch(e => {
  console.error('FAIL:', e.message);
});
