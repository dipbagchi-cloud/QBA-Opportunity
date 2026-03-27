import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const BCRYPT_ROUNDS = 12;

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
        { name: 'Proposal Lost', order: 7, probability: 0, color: '#e11d48', isClosed: true, isWon: false },
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

    // 3. Create Roles with Permission Sets
    const roles = [
        {
            name: 'Admin',
            description: 'Full system access. Can manage users, roles, settings, and all data.',
            permissions: ['*'],
            isSystem: true,
        },
        {
            name: 'Manager',
            description: 'Team management. Can manage pipeline, presales, sales, approvals, resources, and analytics.',
            permissions: [
                'dashboard:view',
                'pipeline:view', 'pipeline:write',
                'presales:view', 'presales:write',
                'sales:view', 'sales:write',
                'estimation:manage',
                'approvals:manage',
                'contacts:view', 'contacts:write',
                'analytics:view', 'analytics:export',
                'agents:execute',
                'gom:view',
                'leads:manage',
                'resources:manage',
                'settings:view',
                'auditlogs:view',
            ],
            isSystem: true,
        },
        {
            name: 'Sales',
            description: 'Sales operations. Can manage pipeline and sales entries.',
            permissions: [
                'dashboard:view',
                'pipeline:view', 'pipeline:write',
                'presales:view',
                'sales:view', 'sales:write',
                'contacts:view', 'contacts:write',
                'analytics:view',
                'agents:execute',
                'gom:view',
                'leads:manage',
                'settings:view',
            ],
            isSystem: true,
        },
        {
            name: 'Presales',
            description: 'Presales operations. Can manage presales entries and estimations.',
            permissions: [
                'dashboard:view',
                'pipeline:view',
                'presales:view', 'presales:write',
                'estimation:manage',
                'sales:view',
                'contacts:view',
                'analytics:view',
                'agents:execute',
                'gom:view',
                'settings:view',
            ],
            isSystem: true,
        },
        {
            name: 'Read-Only',
            description: 'View-only access to pipeline, presales, sales, and analytics.',
            permissions: [
                'dashboard:view',
                'pipeline:view',
                'presales:view',
                'sales:view',
                'contacts:view',
                'analytics:view',
                'gom:view',
                'settings:view',
            ],
            isSystem: true,
        },
        {
            name: 'Management',
            description: 'Senior management view. Read-only access plus analytics export and approval management.',
            permissions: [
                'dashboard:view',
                'pipeline:view',
                'presales:view',
                'sales:view',
                'contacts:view',
                'analytics:view',
                'analytics:export',
                'approvals:manage',
                'auditlogs:view',
                'gom:view',
                'settings:view',
            ],
            isSystem: true,
        },
    ];

    const createdRoles: Record<string, string> = {};
    for (const role of roles) {
        const r = await prisma.role.upsert({
            where: { name: role.name },
            update: { permissions: role.permissions, description: role.description, isSystem: role.isSystem },
            create: role,
        });
        createdRoles[role.name] = r.id;
    }

    // 4. Create Team
    const team = await prisma.team.upsert({
        where: { id: 'default-team' },
        update: {},
        create: {
            id: 'default-team',
            name: 'Sales Team',
            description: 'Default sales team',
        },
    });

    // 5. Create Users (one per role) with hashed passwords
    const defaultPassword = await bcrypt.hash('password123', BCRYPT_ROUNDS);

    const users = [
        {
            email: 'dip.bagchi@example.com',
            name: 'Dip Bagchi',
            title: 'Sales Director',
            roleName: 'Admin',
            extraRoles: ['Manager', 'Sales'],
            teamId: team.id,
        },
        {
            email: 'manager@example.com',
            name: 'Raj Kumar',
            title: 'Sales Manager',
            roleName: 'Manager',
            extraRoles: ['Sales'],
            teamId: team.id,
        },
        {
            email: 'sales@example.com',
            name: 'Priya Sharma',
            title: 'Sales Executive',
            roleName: 'Sales',
            extraRoles: [],
            teamId: team.id,
        },
        {
            email: 'presales@example.com',
            name: 'Amit Patel',
            title: 'Presales Consultant',
            roleName: 'Presales',
            extraRoles: [],
            teamId: team.id,
        },
        {
            email: 'viewer@example.com',
            name: 'Suman Roy',
            title: 'Business Analyst',
            roleName: 'Read-Only',
            extraRoles: [],
            teamId: team.id,
        },
    ];

    let defaultUserId = '';
    for (const u of users) {
        const allRoleIds = [createdRoles[u.roleName], ...u.extraRoles.map(r => createdRoles[r])];
        const roleConnects = allRoleIds.map(id => ({ id }));

        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: {
                passwordHash: defaultPassword,
                roles: { set: roleConnects },
                activeRoleId: createdRoles[u.roleName],
            },
            create: {
                email: u.email,
                name: u.name,
                title: u.title,
                passwordHash: defaultPassword,
                roles: { connect: roleConnects },
                activeRoleId: createdRoles[u.roleName],
                teamId: u.teamId,
            },
        });
        if (u.roleName === 'Admin') defaultUserId = user.id;
    }

    // 6. Create Client
    const client = await prisma.client.upsert({
        where: { id: 'default-client' },
        update: {},
        create: {
            id: 'default-client',
            name: "Acme Corp",
            domain: "acme.com",
            industry: "Technology",
            revenue: 50000000
        }
    });

    // 7. Create Resources (Mock HRMS)
    const resources = [
        { name: "John Developer", grade: "L3", effortFactor: 1.2, attritionFactor: 1.1, standardRate: 60, skills: "React, Node.js" },
        { name: "Jane Tester", grade: "L2", effortFactor: 1.0, attritionFactor: 1.05, standardRate: 40, skills: "Selenium, Cypress" },
        { name: "Mike Manager", grade: "L5", effortFactor: 1.5, attritionFactor: 1.0, standardRate: 100, skills: "Agile, Scrum" }
    ];

    for (const res of resources) {
        const existing = await prisma.resource.findFirst({ where: { name: res.name } });
        if (!existing) {
            await prisma.resource.create({ data: res });
        }
    }

    // 8. Seed Rate Cards from Excel-generated JSON (delete old records first)
    await prisma.rateCard.deleteMany();
    const rateCardsPath = path.join(__dirname, 'rate-cards-data.json');
    const rateCardsData: Array<{ code: string; role: string; skill: string; experienceBand: string; masterCtc?: number; mercerCtc?: number; copilot?: number; existingCtc?: number; maxCtc?: number; ctc: number; category: string }> = JSON.parse(fs.readFileSync(rateCardsPath, 'utf-8'));

    for (const rc of rateCardsData) {
        await prisma.rateCard.upsert({
            where: { code: rc.code },
            update: {
                role: rc.role,
                skill: rc.skill,
                experienceBand: rc.experienceBand,
                masterCtc: rc.masterCtc || 0,
                mercerCtc: rc.mercerCtc || 0,
                copilot: rc.copilot || 0,
                existingCtc: rc.existingCtc || 0,
                maxCtc: rc.maxCtc || 0,
                ctc: rc.ctc || 0,
                category: rc.category,
            },
            create: {
                code: rc.code,
                role: rc.role,
                skill: rc.skill,
                experienceBand: rc.experienceBand,
                masterCtc: rc.masterCtc || 0,
                mercerCtc: rc.mercerCtc || 0,
                copilot: rc.copilot || 0,
                existingCtc: rc.existingCtc || 0,
                maxCtc: rc.maxCtc || 0,
                ctc: rc.ctc || 0,
                category: rc.category,
            },
        });
    }
    console.log(`  Seeded ${rateCardsData.length} rate cards.`);

    // 8b. Seed Regions
    const regions = ['North America', 'Europe', 'Asia Pacific', 'Middle East', 'India', 'Latin America', 'Africa'];
    for (const name of regions) {
        await prisma.region.upsert({ where: { name }, update: {}, create: { name } });
    }
    console.log(`  Seeded ${regions.length} regions.`);

    // 8c. Seed Technologies
    const technologies = [
        '.NET', 'Java', 'Python', 'React', 'Angular', 'Node.js', 'SAP', 'Salesforce',
        'AWS', 'Azure', 'GCP', 'AI/ML', 'Data Engineering', 'DevOps', 'Cybersecurity',
        'Power Platform', 'ServiceNow', 'Blockchain', 'IoT', 'Mobile (iOS/Android)',
    ];
    for (const name of technologies) {
        await prisma.technology.upsert({ where: { name }, update: {}, create: { name } });
    }
    console.log(`  Seeded ${technologies.length} technologies.`);

    // 8d. Seed Pricing Models
    const pricingModels = ['Fixed Price', 'Time & Material', 'Hybrid', 'Managed Services', 'Outcome-Based', 'Staff Augmentation'];
    for (const name of pricingModels) {
        await prisma.pricingModel.upsert({ where: { name }, update: {}, create: { name } });
    }
    console.log(`  Seeded ${pricingModels.length} pricing models.`);

    // 9. Create Opportunity
    const discoveryStage = await prisma.stage.findUnique({ where: { name: 'Discovery' } })
    const newBizType = await prisma.opportunityType.findUnique({ where: { name: 'New Business' } })

    if (discoveryStage && newBizType && defaultUserId) {
        const existingOpp = await prisma.opportunity.findFirst({ where: { title: 'Project Phoenix' } });
        if (!existingOpp) {
            await prisma.opportunity.create({
                data: {
                    title: "Project Phoenix",
                    value: 150000,
                    probability: 20,
                    currency: "USD",
                    clientId: client.id,
                    ownerId: defaultUserId,
                    typeId: newBizType.id,
                    stageId: discoveryStage.id,
                    priority: "High",
                    tags: "strategic,ai-deal",
                    currentStage: "Pipeline",
                    detailedStatus: "in process",
                    geolocation: "North America",
                    salesRepName: "Dip Bagchi"
                }
            })
        }
    }

    console.log('Seeding finished.')
    console.log('Test credentials (all passwords: password123):')
    console.log('  Admin:     dip.bagchi@example.com')
    console.log('  Manager:   manager@example.com')
    console.log('  Sales:     sales@example.com')
    console.log('  Presales:  presales@example.com')
    console.log('  Read-Only: viewer@example.com')
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
