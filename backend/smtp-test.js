// Quick SMTP debug test
require('dotenv').config();
const nodemailer = require('nodemailer');

const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS set:', !!process.env.SMTP_PASS);

t.verify()
  .then(() => {
    console.log('SMTP connection: OK');
    return t.sendMail({
      from: '"Q-CRM Notifications" <qcrm.noreply@qbadvisory.com>',
      to: 'Jaydeep.Bandyopadhyay@qbadvisory.com',
      subject: 'SMTP Test - ' + new Date().toISOString(),
      text: 'If you see this, SMTP is working.',
    });
  })
  .then(info => {
    console.log('Test email sent! MessageId:', info.messageId);
    console.log('Response:', info.response);
  })
  .catch(e => {
    console.error('SMTP FAIL:', e.message);
    console.error('Full error:', e);
  });
