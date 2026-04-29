const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Count before
  const count = await prisma.opportunity.count();
  console.log('Opportunities to delete:', count);

  if (count === 0) {
    console.log('Nothing to delete.');
    await prisma.$disconnect();
    return;
  }

  // Also delete related projects, audit logs referencing opportunities
  const projectCount = await prisma.project.count();
  console.log('Projects:', projectCount);

  // Delete in order: projects first (if any), then opportunities (cascades notes/activities/tasks/attachments/approvals/leadScores)
  if (projectCount > 0) {
    await prisma.project.deleteMany({});
    console.log('Deleted all projects');
  }

  // Delete SOW documents linked to opportunities
  const sowCount = await prisma.sowDocument.count();
  if (sowCount > 0) {
    await prisma.sowDocument.deleteMany({});
    console.log('Deleted', sowCount, 'SOW documents');
  }

  // Delete opportunities (cascades: notes, activities, tasks, attachments, approval_requests, ai_interactions, notifications, lead_scores)
  const result = await prisma.opportunity.deleteMany({});
  console.log('Deleted', result.count, 'opportunities (+ cascaded related records)');

  // Clean up audit logs for deleted entities
  const auditResult = await prisma.auditLog.deleteMany({
    where: { entity: { in: ['OPPORTUNITY', 'PROJECT', 'SOW_DOCUMENT'] } }
  });
  console.log('Cleaned', auditResult.count, 'audit log entries');

  // Verify
  const remaining = await prisma.opportunity.count();
  console.log('Remaining opportunities:', remaining);

  await prisma.$disconnect();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
