const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const templates = await prisma.emailTemplate.findMany({
        where: {
            OR: [
                { name: { contains: 'estimate' } },
                { eventKey: { contains: 'estimate' } },
                { body: { contains: 'estimate' } }
            ]
        }
    });
    console.log(JSON.stringify(templates, null, 2));
}

main().finally(() => prisma.$disconnect());
