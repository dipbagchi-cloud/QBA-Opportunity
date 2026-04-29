const { PrismaClient } = require("@prisma/client"); 
const prisma = new PrismaClient(); 
async function main() { 
    const conf = await prisma.systemConfig.findUnique({ where: { key: "budget_assumptions" } }); 
    console.log(JSON.stringify(conf, null, 2)); 
} 
main().finally(() => prisma.$disconnect());
