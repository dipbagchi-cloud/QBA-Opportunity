const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Deactivate the duplicate "moved to presales" rule
p.notificationRule.update({
  where: { id: 'cmnrtomwr00069n1o9ahh3gvo' },
  data: { isActive: false },
}).then((r) => {
  console.log('Deactivated duplicate rule:', r.name);
}).then(() => {
  // Show remaining active rules
  return p.notificationRule.findMany({ where: { isActive: true }, select: { id: true, name: true, toStage: true, fromStage: true } });
}).then((r) => {
  console.log('\nRemaining active rules:');
  r.forEach((x) => console.log('  ' + JSON.stringify(x)));
}).finally(() => p.$disconnect());
