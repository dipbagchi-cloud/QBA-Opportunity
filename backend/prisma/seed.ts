import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const BCRYPT_ROUNDS = 12;

async function main() {
    console.log('🌱 Seeding database — Full Master Data Migration...')

    // ════════════════════════════════════════════════════════════════════════
    // 1. STAGES
    // ════════════════════════════════════════════════════════════════════════
    const stages = [
        { name: 'Discovery', order: 1, probability: 10, color: '#6366f1' },
        { name: 'Qualification', order: 2, probability: 30, color: '#8b5cf6' },
        { name: 'Proposal', order: 3, probability: 50, color: '#ec4899' },
        { name: 'Negotiation', order: 4, probability: 80, color: '#f97316' },
        { name: 'Closed Won', order: 5, probability: 100, color: '#10b981', isClosed: true, isWon: true },
        { name: 'Closed Lost', order: 6, probability: 0, color: '#ef4444', isClosed: true, isWon: false },
        { name: 'Proposal Lost', order: 7, probability: 0, color: '#e11d48', isClosed: true, isWon: false },
    ];

    for (const stage of stages) {
        await prisma.stage.upsert({
            where: { name: stage.name },
            update: { order: stage.order, probability: stage.probability, color: stage.color },
            create: {
                ...stage,
                requiredFields: "[]",
                requiredDocs: "[]",
                allowedNextStages: "[]",
            },
        });
    }
    console.log(`  ✅ Seeded ${stages.length} stages`);

    // ════════════════════════════════════════════════════════════════════════
    // 2. OPPORTUNITY TYPES
    // ════════════════════════════════════════════════════════════════════════
    const opportunityTypes = [
        { name: 'New Business', description: 'Standard new deal logic' },
    ];

    for (const ot of opportunityTypes) {
        await prisma.opportunityType.upsert({
            where: { name: ot.name },
            update: {},
            create: ot,
        });
    }
    console.log(`  ✅ Seeded ${opportunityTypes.length} opportunity types`);

    // ════════════════════════════════════════════════════════════════════════
    // 3. ROLES WITH PERMISSION SETS
    // ════════════════════════════════════════════════════════════════════════
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
    console.log(`  ✅ Seeded ${roles.length} roles`);

    // ════════════════════════════════════════════════════════════════════════
    // 4. TEAM
    // ════════════════════════════════════════════════════════════════════════
    const team = await prisma.team.upsert({
        where: { id: 'default-team' },
        update: {},
        create: {
            id: 'default-team',
            name: 'Sales Team',
            description: 'Default sales team',
        },
    });
    console.log(`  ✅ Seeded team: ${team.name}`);

    // ════════════════════════════════════════════════════════════════════════
    // 5. DEMO USERS (one per role)
    // ════════════════════════════════════════════════════════════════════════
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

    for (const u of users) {
        const allRoleIds = [createdRoles[u.roleName], ...u.extraRoles.map(r => createdRoles[r])];
        const roleConnects = allRoleIds.map(id => ({ id }));

        await prisma.user.upsert({
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
    }
    console.log(`  ✅ Seeded ${users.length} demo users`);

    // ════════════════════════════════════════════════════════════════════════
    // 6. CLIENTS
    // ════════════════════════════════════════════════════════════════════════
    const clients = [
        { name: 'Acme Corp', domain: 'acme.com', industry: 'Technology' },
        { name: 'AM Corporate', domain: null, industry: null },
        { name: 'AM Liberia', domain: null, industry: null },
        { name: 'AM London', domain: null, industry: null },
        { name: 'AMDS', domain: null, industry: null },
    ];

    for (const c of clients) {
        const existing = await prisma.client.findFirst({ where: { name: c.name } });
        if (!existing) {
            await prisma.client.create({
                data: {
                    name: c.name,
                    domain: c.domain,
                    industry: c.industry,
                },
            });
        }
    }
    console.log(`  ✅ Seeded ${clients.length} clients`);

    // ════════════════════════════════════════════════════════════════════════
    // 7. REGIONS
    // ════════════════════════════════════════════════════════════════════════
    const regions = [
        'North America', 'Europe', 'Asia Pacific', 'Middle East',
        'India', 'Latin America', 'Africa', 'Australia',
    ];

    for (const name of regions) {
        await prisma.region.upsert({ where: { name }, update: {}, create: { name } });
    }
    console.log(`  ✅ Seeded ${regions.length} regions`);

    // ════════════════════════════════════════════════════════════════════════
    // 8. TECHNOLOGIES
    // ════════════════════════════════════════════════════════════════════════
    const technologies = [
        '.NET', 'Java', 'Python', 'React', 'Angular', 'Node.js',
        'SAP', 'Salesforce', 'AWS', 'Azure', 'GCP', 'AI/ML',
        'Data Engineering', 'DevOps', 'Cybersecurity', 'Power Platform',
        'ServiceNow', 'Blockchain', 'IoT', 'Mobile (iOS/Android)',
    ];

    for (const name of technologies) {
        await prisma.technology.upsert({ where: { name }, update: {}, create: { name } });
    }
    console.log(`  ✅ Seeded ${technologies.length} technologies`);

    // ════════════════════════════════════════════════════════════════════════
    // 9. PRICING MODELS
    // ════════════════════════════════════════════════════════════════════════
    const pricingModels = [
        'Fixed Price', 'Time & Material', 'Hybrid',
        'Managed Services', 'Outcome-Based', 'Staff Augmentation',
    ];

    for (const name of pricingModels) {
        await prisma.pricingModel.upsert({ where: { name }, update: {}, create: { name } });
    }
    console.log(`  ✅ Seeded ${pricingModels.length} pricing models`);

    // ════════════════════════════════════════════════════════════════════════
    // 10. PROJECT TYPES
    // ════════════════════════════════════════════════════════════════════════
    const projectTypes = [
        'New Development', 'Modernization', 'Maintenance', 'Consulting', 'Staffing',
    ];

    for (const name of projectTypes) {
        await prisma.projectType.upsert({ where: { name }, update: {}, create: { name } });
    }
    console.log(`  ✅ Seeded ${projectTypes.length} project types`);

    // ════════════════════════════════════════════════════════════════════════
    // 11. RATE CARDS (from Excel-generated JSON)
    // ════════════════════════════════════════════════════════════════════════
    const rateCardsPath = path.join(__dirname, 'rate-cards-data.json');
    if (fs.existsSync(rateCardsPath)) {
        await prisma.rateCard.deleteMany();
        const rateCardsData: Array<{
            code: string; role: string; skill: string; experienceBand: string;
            masterCtc?: number; mercerCtc?: number; copilot?: number;
            existingCtc?: number; maxCtc?: number; ctc: number; category: string;
        }> = JSON.parse(fs.readFileSync(rateCardsPath, 'utf-8'));

        for (const rc of rateCardsData) {
            await prisma.rateCard.upsert({
                where: { code: rc.code },
                update: {
                    role: rc.role, skill: rc.skill, experienceBand: rc.experienceBand,
                    masterCtc: rc.masterCtc || 0, mercerCtc: rc.mercerCtc || 0,
                    copilot: rc.copilot || 0, existingCtc: rc.existingCtc || 0,
                    maxCtc: rc.maxCtc || 0, ctc: rc.ctc || 0, category: rc.category,
                },
                create: {
                    code: rc.code, role: rc.role, skill: rc.skill,
                    experienceBand: rc.experienceBand,
                    masterCtc: rc.masterCtc || 0, mercerCtc: rc.mercerCtc || 0,
                    copilot: rc.copilot || 0, existingCtc: rc.existingCtc || 0,
                    maxCtc: rc.maxCtc || 0, ctc: rc.ctc || 0, category: rc.category,
                },
            });
        }
        console.log(`  ✅ Seeded ${rateCardsData.length} rate cards`);
    } else {
        console.log('  ⚠️  rate-cards-data.json not found — skipping rate cards');
    }

    // ════════════════════════════════════════════════════════════════════════
    // 12. CURRENCY RATES (INR base)
    // ════════════════════════════════════════════════════════════════════════
    const currencyRates = [
        // Africa
        { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', region: 'Africa', rateToBase: 0.559492 },
        { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', region: 'Africa', rateToBase: 0.117011 },
        { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', region: 'Africa', rateToBase: 1.3801 },
        { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', region: 'Africa', rateToBase: 14.692348 },
        { code: 'ZAR', name: 'South African Rand', symbol: 'R', region: 'Africa', rateToBase: 0.181326 },
        // Asia Pacific
        { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', region: 'Asia Pacific', rateToBase: 0.015361 },
        { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', region: 'Asia Pacific', rateToBase: 0.073536 },
        { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', region: 'Asia Pacific', rateToBase: 0.083177 },
        { code: 'JPY', name: 'Japanese Yen', symbol: '¥', region: 'Asia Pacific', rateToBase: 1.695588 },
        { code: 'KRW', name: 'South Korean Won', symbol: '₩', region: 'Asia Pacific', rateToBase: 15.986026 },
        { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', region: 'Asia Pacific', rateToBase: 0.042387 },
        { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', region: 'Asia Pacific', rateToBase: 0.018367 },
        { code: 'PHP', name: 'Philippine Peso', symbol: '₱', region: 'Asia Pacific', rateToBase: 0.58547 },
        { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', region: 'Asia Pacific', rateToBase: 0.013166 },
        { code: 'THB', name: 'Thai Baht', symbol: '฿', region: 'Asia Pacific', rateToBase: 0.339756 },
        { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$', region: 'Asia Pacific', rateToBase: 0.327736 },
        // Europe
        { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', region: 'Europe', rateToBase: 0.008315 },
        { code: 'DKK', name: 'Danish Krone', symbol: 'kr', region: 'Europe', rateToBase: 0.068135 },
        { code: 'EUR', name: 'Euro', symbol: '€', region: 'Europe', rateToBase: 0.009129 },
        { code: 'GBP', name: 'British Pound', symbol: '£', region: 'Europe', rateToBase: 0.007628 },
        { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', region: 'Europe', rateToBase: 0.102832 },
        { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', region: 'Europe', rateToBase: 0.038432 },
        { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', region: 'Europe', rateToBase: 0.095841 },
        // India
        { code: 'INR', name: 'Indian Rupee', symbol: '₹', region: 'India', rateToBase: 1 },
        // Latin America
        { code: 'ARS', name: 'Argentine Peso', symbol: '$', region: 'Latin America', rateToBase: 10.960637 },
        { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', region: 'Latin America', rateToBase: 0.058118 },
        { code: 'CLP', name: 'Chilean Peso', symbol: '$', region: 'Latin America', rateToBase: 9.506626 },
        { code: 'COP', name: 'Colombian Peso', symbol: '$', region: 'Latin America', rateToBase: 41.675062 },
        { code: 'MXN', name: 'Mexican Peso', symbol: '$', region: 'Latin America', rateToBase: 0.203668 },
        // Middle East
        { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', region: 'Middle East', rateToBase: 0.039268 },
        { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD', region: 'Middle East', rateToBase: 0.004028 },
        { code: 'ILS', name: 'Israeli Shekel', symbol: '₪', region: 'Middle East', rateToBase: 0.036005 },
        { code: 'QAR', name: 'Qatari Riyal', symbol: 'QR', region: 'Middle East', rateToBase: 0.038931 },
        { code: 'SAR', name: 'Saudi Riyal', symbol: 'SR', region: 'Middle East', rateToBase: 0.040095 },
        { code: 'TRY', name: 'Turkish Lira', symbol: '₺', region: 'Middle East', rateToBase: 0.386493 },
        // North America
        { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', region: 'North America', rateToBase: 0.014194 },
        { code: 'USD', name: 'US Dollar', symbol: '$', region: 'North America', rateToBase: 0.010694 },
    ];

    for (const cr of currencyRates) {
        await prisma.currencyRate.upsert({
            where: { code_baseCurrency: { code: cr.code, baseCurrency: 'INR' } },
            update: { name: cr.name, symbol: cr.symbol, region: cr.region, rateToBase: cr.rateToBase },
            create: { ...cr, baseCurrency: 'INR' },
        });
    }
    console.log(`  ✅ Seeded ${currencyRates.length} currency rates`);

    // ════════════════════════════════════════════════════════════════════════
    // 13. BUDGET ASSUMPTIONS (SystemConfig)
    // ════════════════════════════════════════════════════════════════════════
    const budgetAssumptions = {
        marginPercent: 35,
        workingDaysPerYear: 240,
        deliveryMgmtPercent: 5,
        benchPercent: 10,
        leaveEligibilityPercent: 0,
        annualGrowthBufferPercent: 0,
        averageIncrementPercent: 0,
        bonusPercent: 0,
        indirectCostPercent: 0,
        welfarePerFte: 0,
        trainingPerFte: 0,
    };

    await prisma.systemConfig.upsert({
        where: { key: 'budget_assumptions' },
        update: { value: budgetAssumptions },
        create: {
            key: 'budget_assumptions',
            value: budgetAssumptions,
            category: 'finance',
            description: 'Global budget assumption parameters for GOM and cost calculations',
        },
    });
    console.log(`  ✅ Seeded budget assumptions`);

    // ════════════════════════════════════════════════════════════════════════
    // 14. EMAIL TEMPLATES
    // ════════════════════════════════════════════════════════════════════════
    const emailTemplates = [
        {
            eventKey: 'pipeline_saved',
            name: 'Pipeline Saved / Submitted',
            subject: 'Q-CRM: Opportunity "{{opportunityTitle}}" Updated',
            body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#4f46e5">Opportunity Update</h2>
<p>Hi {{recipientName}},</p>
<p>The opportunity <strong>{{opportunityTitle}}</strong> for client <strong>{{clientName}}</strong> has been saved/submitted in the Pipeline stage.</p>
<p><strong>Current Stage:</strong> {{stageName}}</p>
<p><strong>Updated by:</strong> {{updatedBy}}</p>
<p style="color:#64748b;font-size:12px;margin-top:24px">This is an automated notification from Q-CRM.</p>
</div>`,
        },
        {
            eventKey: 'moved_to_presales',
            name: 'Moved to Presales',
            subject: 'Q-CRM: "{{opportunityTitle}}" moved to Presales — Action Required',
            body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#4f46e5">Presales Assignment</h2>
<p>Hi {{recipientName}},</p>
<p>The opportunity <strong>{{opportunityTitle}}</strong> for <strong>{{clientName}}</strong> has been moved from <em>{{previousStage}}</em> to <strong>Presales</strong>.</p>
<p>You have been assigned as the manager for this opportunity.</p>
<p><strong>Sales Rep:</strong> {{salesRepName}}</p>
<p>Please review and begin presales activities.</p>
<p style="color:#64748b;font-size:12px;margin-top:24px">This is an automated notification from Q-CRM.</p>
</div>`,
        },
        {
            eventKey: 'presales_submitted_back',
            name: 'Presales Submitted Back to Sales',
            subject: 'Q-CRM: "{{opportunityTitle}}" ready for Sales',
            body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#4f46e5">Presales Complete</h2>
<p>Hi {{recipientName}},</p>
<p>Great news! The presales work for <strong>{{opportunityTitle}}</strong> ({{clientName}}) has been completed and moved to the Sales stage.</p>
<p><strong>Previous Stage:</strong> {{previousStage}}</p>
<p><strong>Manager:</strong> {{managerName}}</p>
<p>Please proceed with the sales process.</p>
<p style="color:#64748b;font-size:12px;margin-top:24px">This is an automated notification from Q-CRM.</p>
</div>`,
        },
        {
            eventKey: 'moved_to_sales',
            name: 'Moved to Sales',
            subject: 'Q-CRM: "{{opportunityTitle}}" moved to Sales Stage',
            body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#4f46e5">Moved to Sales</h2>
<p>Hi {{recipientName}},</p>
<p>The opportunity <strong>{{opportunityTitle}}</strong> for <strong>{{clientName}}</strong> has been moved to the <strong>Sales</strong> stage.</p>
<p><strong>Value:</strong> {{value}}</p>
<p><strong>Sales Rep:</strong> {{salesRepName}}</p>
<p><strong>Manager:</strong> {{managerName}}</p>
<p>Please review and proceed with the sales process.</p>
<p style="color:#64748b;font-size:12px;margin-top:24px">This is an automated notification from Q-CRM.</p>
</div>`,
        },
        {
            eventKey: 'sent_to_client',
            name: 'Proposal Sent to Client',
            subject: 'Q-CRM: Proposal for "{{opportunityTitle}}" sent to client',
            body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#4f46e5">Proposal Sent to Client</h2>
<p>Hi {{recipientName}},</p>
<p>The proposal for opportunity <strong>{{opportunityTitle}}</strong> has been sent to the client <strong>{{clientName}}</strong>.</p>
<p><strong>Proposed Value:</strong> {{value}}</p>
<p><strong>Sales Rep:</strong> {{salesRepName}}</p>
<p style="color:#64748b;font-size:12px;margin-top:24px">This is an automated notification from Q-CRM.</p>
</div>`,
        },
        {
            eventKey: 'sent_back_to_reestimate',
            name: 'Sent Back for Re-Estimation',
            subject: 'Q-CRM: "{{opportunityTitle}}" sent back for re-estimation',
            body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#4f46e5">Re-Estimation Required</h2>
<p>Hi {{recipientName}},</p>
<p>The opportunity <strong>{{opportunityTitle}}</strong> for <strong>{{clientName}}</strong> has been sent back for re-estimation.</p>
<p><strong>Reason:</strong> {{reason}}</p>
<p><strong>Re-estimate Count:</strong> {{reEstimateCount}}</p>
<p><strong>Sent by:</strong> {{updatedBy}}</p>
<p>Please review the estimation and make necessary adjustments.</p>
<p style="color:#64748b;font-size:12px;margin-top:24px">This is an automated notification from Q-CRM.</p>
</div>`,
        },
        {
            eventKey: 'proposal_lost',
            name: 'Proposal Lost',
            subject: 'Q-CRM: "{{opportunityTitle}}" — Proposal Lost',
            body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#e11d48">Proposal Lost</h2>
<p>Hi {{recipientName}},</p>
<p>Unfortunately, the opportunity <strong>{{opportunityTitle}}</strong> for <strong>{{clientName}}</strong> has been marked as <strong>Proposal Lost</strong>.</p>
<p><strong>Value:</strong> {{value}}</p>
<p><strong>Loss Reason:</strong> {{lossReason}}</p>
<p><strong>Updated by:</strong> {{updatedBy}}</p>
<p style="color:#64748b;font-size:12px;margin-top:24px">This is an automated notification from Q-CRM.</p>
</div>`,
        },
        {
            eventKey: 'proposal_won',
            name: 'Proposal Won / Closed Won',
            subject: 'Q-CRM: 🎉 "{{opportunityTitle}}" — Closed Won!',
            body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#16a34a">🎉 Deal Won!</h2>
<p>Hi {{recipientName}},</p>
<p>Great news! The opportunity <strong>{{opportunityTitle}}</strong> for <strong>{{clientName}}</strong> has been marked as <strong>Closed Won</strong>!</p>
<p><strong>Deal Value:</strong> {{value}}</p>
<p><strong>Sales Rep:</strong> {{salesRepName}}</p>
<p><strong>Manager:</strong> {{managerName}}</p>
<p>Congratulations to the team!</p>
<p style="color:#64748b;font-size:12px;margin-top:24px">This is an automated notification from Q-CRM.</p>
</div>`,
        },
    ];

    for (const tmpl of emailTemplates) {
        await prisma.emailTemplate.upsert({
            where: { eventKey: tmpl.eventKey },
            update: {},
            create: tmpl,
        });
    }
    console.log(`  ✅ Seeded ${emailTemplates.length} email templates`);

    // ════════════════════════════════════════════════════════════════════════
    // 15. RESOURCES (Mock HRMS)
    // ════════════════════════════════════════════════════════════════════════
    const resources = [
        { name: 'John Developer', grade: 'L3', effortFactor: 1.2, attritionFactor: 1.1, standardRate: 60, skills: 'React, Node.js' },
        { name: 'Jane Tester', grade: 'L2', effortFactor: 1.0, attritionFactor: 1.05, standardRate: 40, skills: 'Selenium, Cypress' },
        { name: 'Mike Manager', grade: 'L5', effortFactor: 1.5, attritionFactor: 1.0, standardRate: 100, skills: 'Agile, Scrum' },
    ];

    for (const res of resources) {
        const existing = await prisma.resource.findFirst({ where: { name: res.name } });
        if (!existing) {
            await prisma.resource.create({ data: res });
        }
    }
    console.log(`  ✅ Seeded ${resources.length} resources`);

    // ════════════════════════════════════════════════════════════════════════
    // DONE
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🎉 Seeding complete!');
    console.log('\nTest credentials (all passwords: password123):');
    console.log('  Admin:       dip.bagchi@example.com');
    console.log('  Manager:     manager@example.com');
    console.log('  Sales:       sales@example.com');
    console.log('  Presales:    presales@example.com');
    console.log('  Read-Only:   viewer@example.com');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
