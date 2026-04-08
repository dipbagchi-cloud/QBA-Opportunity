const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const mode = process.argv[2];
if (mode) {
  p.systemConfig.update({
    where: { key: 'auth_mode' },
    data: { value: { mode, ssoDomain: '@qbadvisory.com', localPasswordPolicy: { minLength: 6, requireChangeOnFirstLogin: true } } }
  }).then(r => { console.log('Updated:', JSON.stringify(r.value)); return p.$disconnect(); });
} else {
  p.systemConfig.findFirst({ where: { key: 'auth_mode' } }).then(r => { console.log(JSON.stringify(r.value)); return p.$disconnect(); });
}
