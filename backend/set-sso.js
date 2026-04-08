const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.systemConfig.update({
  where: { key: 'auth_mode' },
  data: {
    value: {
      mode: 'sso',
      ssoDomain: '@qbadvisory.com',
      localPasswordPolicy: { minLength: 6, requireChangeOnFirstLogin: true }
    }
  }
}).then(r => {
  console.log('Auth mode updated to SSO:', JSON.stringify(r.value));
  return p.$disconnect();
}).catch(e => {
  console.error(e.message);
  return p.$disconnect();
});
