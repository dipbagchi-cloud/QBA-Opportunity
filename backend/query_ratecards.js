const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
Promise.all([
    p.rateCard.findMany({
        where: { role: { contains: 'NET' }, experienceBand: { contains: '15' } },
        select: { role: true, skill: true, experienceBand: true, ctc: true, maxCtc: true }
    }),
    p.systemConfig.findFirst({ where: { key: 'budget_assumptions' } })
]).then(([cards, config]) => {
    console.log('Rate Cards:', JSON.stringify(cards, null, 2));
    console.log('Budget Config:', JSON.stringify(config, null, 2));
}).finally(() => p.$disconnect());
