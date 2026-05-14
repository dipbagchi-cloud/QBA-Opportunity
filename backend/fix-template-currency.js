/**
 * One-time fix: adds {{currency}} to email template bodies that show {{value}} without currency.
 * Run from the backend directory: node fix-template-currency.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEMPLATES_TO_FIX = [
  { eventKey: 'opportunity_created', from: '>{{value}}<', to: '>{{currency}} {{value}}<' },
  { eventKey: 'moved_to_sales',      from: 'Value:</strong> {{value}}', to: 'Value:</strong> {{currency}} {{value}}' },
  { eventKey: 'sent_to_client',      from: 'Proposed Value:</strong> {{value}}', to: 'Proposed Value:</strong> {{currency}} {{value}}' },
  { eventKey: 'proposal_lost',       from: 'Value:</strong> {{value}}', to: 'Value:</strong> {{currency}} {{value}}' },
  { eventKey: 'proposal_won',        from: 'Deal Value:</strong> {{value}}', to: 'Deal Value:</strong> {{currency}} {{value}}' },
];

async function main() {
  for (const { eventKey, from, to } of TEMPLATES_TO_FIX) {
    const tmpl = await prisma.emailTemplate.findUnique({ where: { eventKey } });
    if (!tmpl) {
      console.log(`  SKIP  ${eventKey} — template not found`);
      continue;
    }
    if (!tmpl.body.includes(from)) {
      console.log(`  SKIP  ${eventKey} — pattern not found (already fixed or different template)`);
      continue;
    }
    const updatedBody = tmpl.body.split(from).join(to);
    await prisma.emailTemplate.update({ where: { eventKey }, data: { body: updatedBody } });
    console.log(`  FIXED ${eventKey}`);
  }
  console.log('\nDone.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
