
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Connecting to DB...");
        const count = await prisma.opportunity.count();
        console.log("Successfully connected. Opportunity count:", count);
    } catch (e) {
        console.error("DB Connection Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
