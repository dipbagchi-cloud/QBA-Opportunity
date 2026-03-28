const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const total = await p.user.count();
  const withDesig = await p.user.count({ where: { designation: { not: null } } });
  const withQP = await p.user.count({ where: { qpeopleId: { not: null } } });
  const both = await p.user.count({ where: { designation: { not: null }, qpeopleId: { not: null } } });
  console.log('Total users:', total);
  console.log('With designation:', withDesig);
  console.log('With qpeopleId:', withQP);
  console.log('With both:', both);
  
  const mappings = await p.qPeopleRoleMapping.findMany();
  console.log('Mappings:', mappings.length);
  for (const m of mappings) {
    console.log(`  ${m.qpeopleDesignation}: ${(m.crmRoleIds||[]).length} roles`);
  }

  // Check a sample user with designation
  if (both > 0) {
    const sample = await p.user.findFirst({ where: { designation: { not: null }, qpeopleId: { not: null } }, include: { roles: { select: { id: true, name: true } } } });
    console.log('Sample user:', sample.name, 'designation:', sample.designation, 'roles:', sample.roles.map(r => r.name));
  }

  await p.$disconnect();
})();
