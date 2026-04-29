const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.auditLog.deleteMany({
    where: { entity: { in: ['OPPORTUNITY', 'PROJECT', 'SOW_DOCUMENT'] } }
  });
  console.log('Deleted', r.count, 'audit logs');
  const opp = await prisma.opportunity.count();
  const proj = await prisma.project.count();
  console.log('Remaining: opportunities=' + opp, 'projects=' + proj);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
