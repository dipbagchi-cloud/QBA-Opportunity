const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Total count
  const total = await prisma.opportunity.count();
  console.log('Total opportunities:', total);
  
  // Get all opportunities
  const allOpps = await prisma.opportunity.findMany({
    select: { id: true, title: true, currentStage: true, createdAt: true, clientId: true },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  
  console.log('\nRecent 50 opportunities:');
  allOpps.forEach(o => {
    console.log(o.id.slice(0,8), '|', o.title?.slice(0,30).padEnd(30), '|', o.currentStage, '|', o.createdAt);
  });
  
  // Check for exact duplicates by title
  const titleCount = {};
  allOpps.forEach(o => {
    const key = (o.title || '').toLowerCase();
    titleCount[key] = (titleCount[key] || 0) + 1;
  });
  
  const duplicates = Object.entries(titleCount).filter(([_, c]) => c > 1);
  console.log('\nDuplicate titles in recent 50:', duplicates.length);
  duplicates.forEach(([title, count]) => {
    console.log(`  "${title}": ${count} records`);
  });
}

main().finally(() => prisma.$disconnect());

main().finally(() => prisma.$disconnect());
