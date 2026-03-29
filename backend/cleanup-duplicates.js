/**
 * Script to detect and delete duplicate opportunities
 * Run with: node cleanup-duplicates.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Scanning for duplicate opportunities...\n');
  
  // Get all opportunities ordered by createdAt
  const allOpps = await prisma.opportunity.findMany({
    select: { 
      id: true, 
      title: true, 
      clientId: true,
      currentStage: true, 
      value: true,
      createdAt: true,
      tentativeStartDate: true,
    },
    orderBy: { createdAt: 'asc' }
  });
  
  console.log(`Total opportunities: ${allOpps.length}\n`);
  
  // Group by title + clientId + value (potential duplicates have same title, client, and value)
  const groups = {};
  allOpps.forEach(opp => {
    // Create a key based on title, client and value
    const key = `${opp.title?.toLowerCase()}|${opp.clientId}|${opp.value}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(opp);
  });
  
  // Find groups with duplicates
  const duplicateGroups = Object.entries(groups).filter(([_, opps]) => opps.length > 1);
  
  if (duplicateGroups.length === 0) {
    console.log('No duplicates found!');
    return;
  }
  
  console.log(`Found ${duplicateGroups.length} groups of duplicates:\n`);
  
  const toDelete = [];
  
  for (const [key, opps] of duplicateGroups) {
    console.log(`\nDuplicate group (${opps.length} records):`);
    opps.forEach((opp, idx) => {
      const isKeep = idx === 0 ? '[KEEP]' : '[DELETE]';
      console.log(`  ${isKeep} ${opp.id.slice(0,8)} | ${opp.title?.slice(0,30)} | ${opp.currentStage} | ${opp.createdAt}`);
      if (idx > 0) toDelete.push(opp.id);
    });
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Records to delete: ${toDelete.length}`);
  
  if (toDelete.length > 0 && process.argv.includes('--delete')) {
    console.log('\nDeleting duplicates...');
    
    for (const id of toDelete) {
      // Delete related records first (use try-catch for optional relations)
      try { await prisma.comment.deleteMany({ where: { opportunityId: id } }); } catch(e) {}
      try { await prisma.auditLog.deleteMany({ where: { opportunityId: id } }); } catch(e) {}
      try { await prisma.attachment.deleteMany({ where: { opportunityId: id } }); } catch(e) {}
      await prisma.opportunity.delete({ where: { id } });
      console.log(`  Deleted: ${id}`);
    }
    
    console.log('\nDone! Duplicates removed.');
  } else if (toDelete.length > 0) {
    console.log('\nTo actually delete duplicates, run: node cleanup-duplicates.js --delete');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
