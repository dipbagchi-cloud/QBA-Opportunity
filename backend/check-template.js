const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Fix: Update the rule - set fromStage to null since re-estimation can come from Proposal or Negotiation
p.notificationRule.update({
  where: { id: 'cmoc4vgmp00089nuwjyuq5cp7' },
  data: { fromStage: null },
}).then(r => {
  console.log('Updated rule:', r.name, '-> fromStage:', r.fromStage, ', toStage:', r.toStage);
}).finally(() => p.$disconnect());
