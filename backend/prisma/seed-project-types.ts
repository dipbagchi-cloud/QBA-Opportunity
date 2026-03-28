import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const types = ['New Development', 'Modernization', 'Maintenance', 'Consulting', 'Staffing'];
    for (const name of types) {
        await prisma.projectType.upsert({
            where: { name },
            update: {},
            create: { name }
        });
        console.log('Seeded:', name);
    }
}

main()
    .then(() => prisma.$disconnect())
    .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
