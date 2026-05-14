const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const roles = await p.role.findMany({where:{name:'Manager'},include:{permissions:{include:{permission:true}}}});
  const result = roles.map(x=>({name:x.name,perms:x.permissions.map(p=>p.permission.name)}));
  console.log(JSON.stringify(result, null, 2));
  await p.$disconnect();
}
main();
