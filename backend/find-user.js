// Find Sootam user
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({
  where: { name: { contains: 'ootam', mode: 'insensitive' } },
  select: { id: true, name: true, email: true, isActive: true, muteNotification: true }
}).then(r => { console.log(JSON.stringify(r, null, 2)); p.$disconnect(); });
