/**
 * Integration tests for the opportunities controller.
 *
 * These exercise the REAL Express auth/authorize middleware and the REAL
 * buildOpportunityAccess RBAC logic over HTTP (supertest). Only the data layer
 * (Prisma) and side-effecting libs (email, notification-engine) are mocked, so
 * the controller's access gates, validation and field-freeze rules are tested
 * end-to-end without a database.
 */
import express, { type Express } from 'express';
import request from 'supertest';

// ── Mocks (hoisted above imports by jest) ──────────────────────────────────
jest.mock('../lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    opportunity: {
      findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn(),
      findMany: jest.fn(), count: jest.fn(), create: jest.fn(),
    },
    approvalRequest: { findFirst: jest.fn(), updateMany: jest.fn(), update: jest.fn(), create: jest.fn() },
    project: { findFirst: jest.fn(), create: jest.fn() },
    note: { create: jest.fn(), findMany: jest.fn() },
    auditLog: { create: jest.fn(), findMany: jest.fn() },
    stage: { findFirst: jest.fn() },
    systemConfig: { findUnique: jest.fn() },
    currencyRate: { findMany: jest.fn() },
    client: { findFirst: jest.fn(), create: jest.fn() },
    attachment: {
      findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(),
      findFirst: jest.fn(), updateMany: jest.fn(), delete: jest.fn(),
    },
    opportunityType: { findFirst: jest.fn() },
    notification: { create: jest.fn() },
  },
}));
jest.mock('../lib/email', () => ({ sendNotificationEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../lib/notification-engine', () => ({
  evaluateStageChangeRules: jest.fn().mockResolvedValue(undefined),
  evaluateDataConditionRules: jest.fn().mockResolvedValue(undefined),
  evaluateOpportunityCreatedRules: jest.fn().mockResolvedValue(undefined),
  evaluateAssignmentChangeRules: jest.fn().mockResolvedValue(undefined),
  evaluateOpportunityChangeNotice: jest.fn().mockResolvedValue(undefined),
  evaluateExtendedNotification: jest.fn().mockResolvedValue(undefined),
  evaluateStartDateChangedNotification: jest.fn().mockResolvedValue(undefined),
  resolveCalculatedFields: jest.fn((x: unknown) => x),
}));

import { prisma } from '../lib/prisma';
import { authenticate, authorizeAny } from '../middleware/auth';
import { getOpportunity, updateOpportunity, addComment } from '../controllers/opportunities.controller';
import { generateToken, type TokenPayload } from '../services/auth.service';
import { PERMISSIONS, WILDCARD, DEFAULT_ROLE_PERMISSIONS } from '../lib/permissions';

const p = prisma as unknown as Record<string, Record<string, jest.Mock>>;

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  const VIEW = [PERMISSIONS.PIPELINE_VIEW, PERMISSIONS.PRESALES_VIEW, PERMISSIONS.SALES_VIEW] as const;
  const WRITE = [PERMISSIONS.PIPELINE_WRITE, PERMISSIONS.PRESALES_WRITE, PERMISSIONS.SALES_WRITE] as const;
  app.get('/api/opportunities/:id', authenticate, authorizeAny(...VIEW), getOpportunity);
  app.patch('/api/opportunities/:id', authenticate, authorizeAny(...WRITE), updateOpportunity);
  app.post('/api/opportunities/:id/comments', authenticate, authorizeAny(...WRITE), addComment);
  return app;
}

function tokenFor(opts: { userId?: string; name?: string; permissions: string[]; roleName?: string }): string {
  const payload: TokenPayload = {
    userId: opts.userId ?? 'user-1',
    email: `${opts.userId ?? 'user-1'}@qbadvisory.com`,
    roleId: 'role-1',
    roleName: opts.roleName ?? 'Role',
    permissions: opts.permissions,
    roles: [{ id: 'role-1', name: opts.roleName ?? 'Role', permissions: opts.permissions }],
  };
  return generateToken(payload);
}

const ADMIN = tokenFor({ userId: 'admin-1', name: 'Admin User', permissions: [WILDCARD], roleName: 'Admin' });
const MANAGER = tokenFor({ userId: 'mgr-1', permissions: DEFAULT_ROLE_PERMISSIONS.Manager, roleName: 'Manager' });
const READ_ONLY = tokenFor({ userId: 'ro-1', permissions: DEFAULT_ROLE_PERMISSIONS['Read-Only'], roleName: 'Read-Only' });

const app = makeApp();

function openOpportunity(over: Record<string, unknown> = {}) {
  return {
    id: 'opp-1',
    ownerId: 'owner-x',
    salesRepName: null,
    managerName: null,
    presalesAssigneeName: null,
    country: 'France',
    region: 'EU',
    currentStage: 'Qualification',
    stage: { name: 'Qualification' },
    client: { name: 'Acme' },
    owner: { id: 'owner-x', name: 'Owner', email: 'owner@x.com' },
    attachments: [],
    expectedCloseDate: null,
    tentativeStartDate: null,
    title: 'Acme deal',
    value: 100000,
    probability: 25,
    technology: 'SharePoint',
    ...over,
  };
}

beforeEach(() => {
  // Sensible defaults so the success paths don't read undefined.
  p.user.findUnique.mockImplementation(async ({ where }: any) => ({ id: where.id, name: where.id === 'admin-1' ? 'Admin User' : where.id, email: `${where.id}@qbadvisory.com` }));
  p.approvalRequest.findFirst.mockResolvedValue(null);
  p.project.findFirst.mockResolvedValue(null);
  p.stage.findFirst.mockResolvedValue({ id: 'stage-1', name: 'Qualification' });
  p.systemConfig.findUnique.mockResolvedValue(null);
  p.client.findFirst.mockResolvedValue({ id: 'client-1', name: 'Acme' });
  p.auditLog.create.mockResolvedValue({});
  p.opportunity.update.mockImplementation(async ({ data }: any) => openOpportunity(data));
  p.note.create.mockResolvedValue({ id: 'note-1', content: 'hi', author: { id: 'admin-1', name: 'Admin User' } });
});

describe('auth + authorize middleware (real)', () => {
  it('rejects an unauthenticated request with 401', async () => {
    await request(app).get('/api/opportunities/opp-1').expect(401);
  });

  it('rejects a junk token with 401', async () => {
    await request(app).get('/api/opportunities/opp-1').set('Authorization', 'Bearer not.a.jwt').expect(401);
  });

  it('rejects a write with 403 when the role lacks any write permission', async () => {
    const res = await request(app)
      .patch('/api/opportunities/opp-1')
      .set('Authorization', `Bearer ${READ_ONLY}`)
      .send({ description: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/insufficient permissions/i);
  });
});

describe('GET /api/opportunities/:id — returns RBAC access model', () => {
  it('404 when the opportunity does not exist', async () => {
    p.opportunity.findUnique.mockResolvedValue(null);
    await request(app).get('/api/opportunities/opp-1').set('Authorization', `Bearer ${ADMIN}`).expect(404);
  });

  it('grants an Admin full edit access on an open deal', async () => {
    p.opportunity.findUnique.mockResolvedValue(openOpportunity());
    const res = await request(app).get('/api/opportunities/opp-1').set('Authorization', `Bearer ${ADMIN}`);
    expect(res.status).toBe(200);
    expect(res.body.access.workflow.pipelineEditable).toBe(true);
    expect(res.body.access.workflow.presalesEditable).toBe(true);
    expect(res.body.access.viewOnlyReason).toBeNull();
  });

  it('returns view-only access for a Manager who is not assigned', async () => {
    p.opportunity.findUnique.mockResolvedValue(openOpportunity({ managerName: 'Someone Else' }));
    const res = await request(app).get('/api/opportunities/opp-1').set('Authorization', `Bearer ${MANAGER}`);
    expect(res.status).toBe(200);
    expect(res.body.access.workflow.pipelineEditable).toBe(false);
    expect(res.body.access.viewOnlyReason).toMatch(/only the assigned/i);
  });
});

describe('POST /api/opportunities/:id/comments', () => {
  it('400 when content is blank', async () => {
    const res = await request(app).post('/api/opportunities/opp-1/comments').set('Authorization', `Bearer ${ADMIN}`).send({ content: '   ' });
    expect(res.status).toBe(400);
  });

  it('404 when the opportunity is missing', async () => {
    p.opportunity.findUnique.mockResolvedValue(null);
    await request(app).post('/api/opportunities/opp-1/comments').set('Authorization', `Bearer ${ADMIN}`).send({ content: 'hi' }).expect(404);
  });

  it('403 when a Manager is not assigned (comments not writable)', async () => {
    p.opportunity.findUnique.mockResolvedValue(openOpportunity({ managerName: 'Other' }));
    const res = await request(app).post('/api/opportunities/opp-1/comments').set('Authorization', `Bearer ${MANAGER}`).send({ content: 'hi' });
    expect(res.status).toBe(403);
  });

  it('201/200 and creates the note when an Admin comments', async () => {
    p.opportunity.findUnique.mockResolvedValue(openOpportunity());
    const res = await request(app).post('/api/opportunities/opp-1/comments').set('Authorization', `Bearer ${ADMIN}`).send({ content: 'looks good' });
    expect(res.status).toBe(200);
    expect(p.note.create).toHaveBeenCalled();
  });
});

describe('PATCH /api/opportunities/:id — access + field-freeze rules', () => {
  it('404 when the opportunity is missing', async () => {
    p.opportunity.findUnique.mockResolvedValue(null);
    await request(app).patch('/api/opportunities/opp-1').set('Authorization', `Bearer ${MANAGER}`).send({ description: 'x' }).expect(404);
  });

  it('403 when a Manager with write perms is not assigned to the deal', async () => {
    p.opportunity.findUnique.mockResolvedValue(openOpportunity({ managerName: 'Other Manager' }));
    const res = await request(app).patch('/api/opportunities/opp-1').set('Authorization', `Bearer ${MANAGER}`).send({ description: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/only the assigned/i);
  });

  it('403 when a non-admin tries to change Country after Pipeline (frozen field)', async () => {
    // Assigned manager -> passes the assignment gate, but the D2 freeze blocks the field
    p.opportunity.findUnique.mockResolvedValue(openOpportunity({ managerName: 'Mgr-1', stage: { name: 'Proposal' }, currentStage: 'Proposal' }));
    const res = await request(app).patch('/api/opportunities/opp-1').set('Authorization', `Bearer ${MANAGER}`).send({ country: 'Germany' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cannot be changed after the opportunity moves out of Pipeline/i);
  });

  it('lets an Admin change Country at a post-Pipeline stage (freeze does not apply)', async () => {
    p.opportunity.findUnique.mockResolvedValue(openOpportunity({ stage: { name: 'Proposal' }, currentStage: 'Proposal' }));
    const res = await request(app).patch('/api/opportunities/opp-1').set('Authorization', `Bearer ${ADMIN}`).send({ country: 'Germany' });
    expect(res.status).toBe(200);
    expect(p.opportunity.update).toHaveBeenCalled();
  });

  it('400 when the close date is on/after the tentative start date', async () => {
    p.opportunity.findUnique.mockResolvedValue(openOpportunity());
    const res = await request(app)
      .patch('/api/opportunities/opp-1')
      .set('Authorization', `Bearer ${ADMIN}`)
      .send({ expectedCloseDate: '2027-01-10', tentativeStartDate: '2027-01-05' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/before the Tentative Start Date/i);
  });

  it('accepts a back-dated tentative start date (past start dates are allowed)', async () => {
    p.opportunity.findUnique.mockResolvedValue(openOpportunity());
    const res = await request(app)
      .patch('/api/opportunities/opp-1')
      .set('Authorization', `Bearer ${ADMIN}`)
      .send({ tentativeStartDate: '2020-01-01' });
    expect(res.status).toBe(200);
    expect(p.opportunity.update).toHaveBeenCalled();
    // Persisted as UTC midnight of the calendar day picked, regardless of server TZ.
    const saved = p.opportunity.update.mock.calls.at(-1)![0].data.tentativeStartDate as Date;
    expect(saved.toISOString()).toBe('2020-01-01T00:00:00.000Z');
  });

  it('still rejects a malformed tentative start date', async () => {
    p.opportunity.findUnique.mockResolvedValue(openOpportunity());
    const res = await request(app)
      .patch('/api/opportunities/opp-1')
      .set('Authorization', `Bearer ${ADMIN}`)
      .send({ tentativeStartDate: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });
});
