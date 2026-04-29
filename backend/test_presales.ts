import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.opportunity.findMany({where:{presalesData:{not:null}}}).then(ops=>{
    ops.forEach(o=>console.log(o.title, JSON.stringify(o.presalesData).substring(0, 500)));
}).finally(()=>prisma.$disconnect());
