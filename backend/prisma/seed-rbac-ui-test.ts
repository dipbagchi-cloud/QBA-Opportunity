import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;
const PASSWORD = 'password123';

const users = {
  owner: {
    email: 'rbac.owner.external@example.com',
    name: 'RBAC Owner External',
    role: 'Sales',
    title: 'Sales Owner',
  },
  peer: {
    email: 'rbac.peer.external@example.com',
    name: 'RBAC Peer External',
    role: 'Sales',
    title: 'Sales Peer',
  },
  presales: {
    email: 'rbac.presales.external@example.com',
    name: 'RBAC Presales External',
    role: 'Presales',
    title: 'Presales Consultant',
  },
  manager: {
    email: 'rbac.manager.external@example.com',
    name: 'RBAC Manager External',
    role: 'Manager',
    title: 'Delivery Manager',
  },
  viewer: {
    email: 'rbac.viewer.external@example.com',
    name: 'RBAC Viewer External',
    role: 'Read-Only',
    title: 'Read Only User',
  },
  contactsOnly: {
    email: 'rbac.contacts.external@example.com',
    name: 'RBAC Contacts External',
    role: 'RBAC UI Contacts Only',
    title: 'Contacts Only User',
  },
};

async function ensureBaseData() {
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
      update: stage,
      create: {
        ...stage,
        requiredFields: '[]',
        requiredDocs: '[]',
        allowedNextStages: '[]',
      },
    });
  }

  const type = await prisma.opportunityType.upsert({
    where: { name: 'New Business' },
    update: {},
    create: { name: 'New Business', description: 'Standard new deal logic' },
  });

  const team = await prisma.team.upsert({
    where: { id: 'rbac-ui-test-team' },
    update: {
      name: 'RBAC UI Test Team',
      description: 'Local access-control test users',
    },
    create: {
      id: 'rbac-ui-test-team',
      name: 'RBAC UI Test Team',
      description: 'Local access-control test users',
    },
  });

  const client = await prisma.client.upsert({
    where: { id: 'rbac-ui-test-client' },
    update: { name: 'RBAC UI Test Client', industry: 'Technology' },
    create: {
      id: 'rbac-ui-test-client',
      name: 'RBAC UI Test Client',
      industry: 'Technology',
    },
  });

  return { type, team, client };
}

async function ensureRoles() {
  const roleDefs = [
    {
      name: 'Sales',
      description: 'Sales operations. Can manage pipeline and sales entries.',
      permissions: [
        'dashboard:view',
        'pipeline:view',
        'pipeline:write',
        'presales:view',
        'sales:view',
        'sales:write',
        'contacts:view',
        'contacts:write',
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
        'presales:view',
        'presales:write',
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
      name: 'Manager',
      description: 'Team management. Can manage workflow, approvals, and analytics.',
      permissions: [
        'dashboard:view',
        'pipeline:view',
        'pipeline:write',
        'presales:view',
        'presales:write',
        'sales:view',
        'sales:write',
        'estimation:manage',
        'approvals:manage',
        'contacts:view',
        'contacts:write',
        'analytics:view',
        'analytics:export',
        'agents:execute',
        'gom:view',
        'leads:manage',
        'resources:manage',
        'settings:view',
        'auditlogs:view',
        'sow:view',
        'sow:write',
      ],
      isSystem: true,
    },
    {
      name: 'Read-Only',
      description: 'View-only access to workflow screens.',
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
      name: 'RBAC UI Contacts Only',
      description: 'Test role created locally to verify admin-defined screen access.',
      permissions: ['dashboard:view', 'contacts:view'],
      isSystem: false,
    },
  ];

  const roles: Record<string, string> = {};
  for (const role of roleDefs) {
    const saved = await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
      },
      create: role,
    });
    roles[role.name] = saved.id;
  }

  return roles;
}

async function ensureUsers(roleIds: Record<string, string>, teamId: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
  const savedUsers: Record<string, { id: string; email: string; name: string }> = {};

  for (const [key, user] of Object.entries(users)) {
    const roleId = roleIds[user.role];
    if (!roleId) throw new Error(`Missing role ${user.role}`);

    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        title: user.title,
        passwordHash,
        mustChangePassword: false,
        isActive: true,
        roles: { set: [{ id: roleId }] },
        activeRoleId: roleId,
        teamId,
        externalId: null,
      },
      create: {
        email: user.email,
        name: user.name,
        title: user.title,
        passwordHash,
        mustChangePassword: false,
        roles: { connect: [{ id: roleId }] },
        activeRoleId: roleId,
        teamId,
        externalId: null,
      },
    });
    savedUsers[key] = { id: saved.id, email: saved.email, name: saved.name };
  }

  return savedUsers;
}

async function upsertOpportunity(params: {
  title: string;
  stageName: string;
  ownerId: string;
  clientId: string;
  typeId: string;
  salesRepName: string;
  managerName: string;
  presalesAssigneeName: string;
  teamId: string;
  gomApproved?: boolean;
  detailedStatus?: string;
}) {
  const stage = await prisma.stage.findUniqueOrThrow({ where: { name: params.stageName } });
  const existing = await prisma.opportunity.findFirst({ where: { title: params.title } });
  const data = {
    title: params.title,
    description: `Local UI RBAC fixture for ${params.stageName}`,
    value: 125000,
    currency: 'USD',
    probability: stage.probability,
    priority: 'Medium',
    tags: '',
    region: 'North America',
    country: 'United States',
    practice: 'Digital',
    technology: 'React',
    projectType: 'New Business',
    pricingModel: 'Fixed Price',
    tentativeStartDate: new Date('2026-07-01T00:00:00.000Z'),
    tentativeDuration: '3',
    tentativeDurationUnit: 'months',
    tentativeEndDate: new Date('2026-09-30T00:00:00.000Z'),
    salesRepName: params.salesRepName,
    managerName: params.managerName,
    presalesAssigneeName: params.presalesAssigneeName,
    currentStage: params.stageName,
    detailedStatus: params.detailedStatus || 'Open',
    gomApproved: params.gomApproved || false,
    metadata: { fixture: 'rbac-ui-access-test' },
    clientId: params.clientId,
    ownerId: params.ownerId,
    teamId: params.teamId,
    stageId: stage.id,
    typeId: params.typeId,
  };

  const opportunity = existing
    ? await prisma.opportunity.update({ where: { id: existing.id }, data })
    : await prisma.opportunity.create({ data });

  await prisma.stageHistory.deleteMany({ where: { opportunityId: opportunity.id } });
  await prisma.stageHistory.create({
    data: {
      opportunityId: opportunity.id,
      stageId: stage.id,
      enteredAt: new Date(),
      notes: 'RBAC UI test fixture',
    },
  });

  return opportunity;
}

async function main() {
  const { type, team, client } = await ensureBaseData();
  const roleIds = await ensureRoles();
  const createdUsers = await ensureUsers(roleIds, team.id);

  const pipeline = await upsertOpportunity({
    title: 'RBAC UI Pipeline Assigned Opportunity',
    stageName: 'Discovery',
    ownerId: createdUsers.owner.id,
    clientId: client.id,
    typeId: type.id,
    salesRepName: createdUsers.owner.name,
    managerName: createdUsers.manager.name,
    presalesAssigneeName: createdUsers.presales.name,
    teamId: team.id,
  });

  const presales = await upsertOpportunity({
    title: 'RBAC UI Presales Assigned Opportunity',
    stageName: 'Qualification',
    ownerId: createdUsers.owner.id,
    clientId: client.id,
    typeId: type.id,
    salesRepName: createdUsers.owner.name,
    managerName: createdUsers.manager.name,
    presalesAssigneeName: createdUsers.presales.name,
    teamId: team.id,
    gomApproved: true,
    detailedStatus: 'Presales In Progress',
  });

  const proposal = await upsertOpportunity({
    title: 'RBAC UI Proposal Assigned Opportunity',
    stageName: 'Proposal',
    ownerId: createdUsers.owner.id,
    clientId: client.id,
    typeId: type.id,
    salesRepName: createdUsers.owner.name,
    managerName: createdUsers.manager.name,
    presalesAssigneeName: createdUsers.presales.name,
    teamId: team.id,
    gomApproved: true,
    detailedStatus: 'Estimation Submitted',
  });

  const artifactDir = path.resolve(__dirname, '.rbac-ui-test');
  fs.mkdirSync(artifactDir, { recursive: true });
  const fixture = {
    password: PASSWORD,
    users: createdUsers,
    opportunities: {
      pipeline: { id: pipeline.id, title: pipeline.title },
      presales: { id: presales.id, title: presales.title },
      proposal: { id: proposal.id, title: proposal.title },
    },
  };
  fs.writeFileSync(path.join(artifactDir, 'fixture.json'), JSON.stringify(fixture, null, 2));
  console.log(JSON.stringify(fixture, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
