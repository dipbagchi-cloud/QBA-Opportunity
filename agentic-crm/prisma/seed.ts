import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding database...')

    // 1. Create Stages
    const stages = [
        { name: 'Discovery', order: 1, probability: 10, color: '#6366f1' },
        { name: 'Qualification', order: 2, probability: 30, color: '#8b5cf6' },
        { name: 'Proposal', order: 3, probability: 50, color: '#ec4899' },
        { name: 'Negotiation', order: 4, probability: 80, color: '#f97316' },
        { name: 'Closed Won', order: 5, probability: 100, color: '#10b981', isClosed: true, isWon: true },
        { name: 'Closed Lost', order: 6, probability: 0, color: '#ef4444', isClosed: true, isWon: false },
    ]

    for (const stage of stages) {
        await prisma.stage.upsert({
            where: { name: stage.name },
            update: {},
            create: {
                ...stage,
                requiredFields: "[]",
                requiredDocs: "[]",
                allowedNextStages: "[]"
            },
        })
    }

    // 2. Create Opportunity Types
    await prisma.opportunityType.upsert({
        where: { name: 'New Business' },
        update: {},
        create: {
            name: 'New Business',
            description: 'Standard new deal logic'
        },
    })

    // 3. Create Default User (You)
    const user = await prisma.user.upsert({
        where: { email: 'dip.bagchi@example.com' },
        update: {},
        create: {
            email: 'dip.bagchi@example.com',
            name: 'Dip Bagchi',
            title: 'Sales Director',
            role: {
                create: {
                    name: 'Admin',
                    permissions: "[\"*\"]"
                }
            }
        },
    })

    // 4. Create Client
    const client = await prisma.client.create({
        data: {
            name: "Acme Corp",
            domain: "acme.com",
            industry: "Technology",
            revenue: 50000000
        }
    })

    // 4b. Create Resources (Mock HRMS)
    const resources = [
        { name: "John Developer", grade: "L3", effortFactor: 1.2, attritionFactor: 1.1, standardRate: 60, skills: "React, Node.js" },
        { name: "Jane Tester", grade: "L2", effortFactor: 1.0, attritionFactor: 1.05, standardRate: 40, skills: "Selenium, Cypress" },
        { name: "Mike Manager", grade: "L5", effortFactor: 1.5, attritionFactor: 1.0, standardRate: 100, skills: "Agile, Scrum" }
    ];

    for (const res of resources) {
        await prisma.resource.create({ data: res });
    }

    // 5. Create Opportunity
    const closedWonStage = await prisma.stage.findUnique({ where: { name: 'Closed Won' } })
    const newBizType = await prisma.opportunityType.findUnique({ where: { name: 'New Business' } })
    const discoveryStage = await prisma.stage.findUnique({ where: { name: 'Discovery' } })

    if (closedWonStage && newBizType && discoveryStage) {
        await prisma.opportunity.create({
            data: {
                title: "Project Phoenix",
                value: 150000,
                probability: 20,
                currency: "USD",
                clientId: client.id,
                ownerId: user.id,
                typeId: newBizType.id,
                stageId: discoveryStage.id,
                priority: "High",
                tags: "strategic,ai-deal",

                // New Lifecycle Fields
                currentStage: "Pipeline",
                detailedStatus: "in process",
                geolocation: "North America",
                salesRepName: "Dip Bagchi"
            }
        })
    }

    console.log('Seeding finished.')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
