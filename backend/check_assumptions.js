const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();
p.systemConfig.findFirst({ where: { key: 'budget_assumptions' } }).then(r => {
    if (r) {
        const val = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
        console.log('DB budget_assumptions:', JSON.stringify(val, null, 2));
        // Calculate expected daily cost for 42,50,000 CTC
        const ctc = 4250000;
        const oh = (val.deliveryMgmtPercent || 0) + (val.benchPercent || 0) + (val.leaveEligibilityPercent || 0) + (val.annualGrowthBufferPercent || 0) + (val.averageIncrementPercent || 0);
        const loaded = ctc * (1 + oh / 100);
        const daily = loaded / (val.workingDaysPerYear || 220);
        console.log(`\nCTC: ${ctc}, Total overhead: ${oh}%, Loaded annual: ${loaded}, Working days: ${val.workingDaysPerYear}, Daily loaded: ${daily.toFixed(2)}`);
    } else {
        console.log('NOT FOUND');
    }
    p.$disconnect();
});
