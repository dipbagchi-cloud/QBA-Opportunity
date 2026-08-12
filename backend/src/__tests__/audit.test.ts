/**
 * Covers the guarantee that every admin change reaches the audit log.
 *
 * The point of the safety net is endpoints nobody instrumented by hand, so
 * these tests deliberately mount routes with NO recordAudit call and assert an
 * entry is written anyway.
 */
import express, { type Express } from 'express';
import request from 'supertest';

// Mirrors the REAL Prisma 6 client surface: `auditLog.create`, and NO `$use`.
// An earlier version of this mock stubbed `$use`, which made these tests pass
// while the app was double-logging in production — Prisma 6 removed middleware.
// The mock has to stay honest about what the client actually offers.
jest.mock('../lib/prisma', () => ({
    prisma: { auditLog: { create: jest.fn().mockResolvedValue({}) } },
}));

import { prisma } from '../lib/prisma';
import { auditMutations, recordAudit, redactSecrets } from '../lib/audit';

const p = prisma as unknown as { auditLog: { create: jest.Mock } };
// auditMutations() wraps prisma.auditLog.create to detect writes, so capture
// the underlying spy BEFORE the wrapper is installed — every row, whether
// written by the net, by recordAudit, or by a raw call, lands here.
const createSpy = p.auditLog.create;

function makeApp(): Express {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    router.use((req, _res, next) => { (req as any).user = { userId: 'admin-1' }; next(); });
    router.use(auditMutations({ source: 'Admin', skipPaths: /^\/validate-only/ }));

    // Deliberately uninstrumented — the net must cover these.
    router.get('/users', (_req, res) => { res.json({ ok: true }); });
    router.post('/users', (_req, res) => { res.json({ id: 'u1' }); });
    router.patch('/users/:id', (_req, res) => { res.json({ ok: true }); });
    router.delete('/roles/:id', (_req, res) => { res.json({ ok: true }); });
    router.post('/validate-only', (_req, res) => { res.json({ ok: true }); });
    router.post('/fails', (_req, res) => { res.status(400).json({ error: 'nope' }); });

    // Instrumented via recordAudit — the net must not double-log it.
    router.post('/instrumented', async (req, res) => {
        await recordAudit({ req, entity: 'Widget', entityId: 'w1', action: 'CREATE', changes: { name: 'x' } });
        res.json({ ok: true });
    });

    // Audits itself with a RAW prisma call, the way ~22 existing controllers
    // do. The net must recognise that and stay quiet.
    router.post('/raw-audited', async (_req, res) => {
        await (prisma as any).auditLog.create({ data: { entity: 'Legacy', action: 'CREATE' } });
        res.json({ ok: true });
    });

    app.use('/api/admin', router);
    return app;
}

const app = makeApp();
beforeEach(() => { createSpy.mockClear(); });

describe('audit safety net', () => {
    it('does not log reads', async () => {
        await request(app).get('/api/admin/users').expect(200);
        expect(createSpy).not.toHaveBeenCalled();
    });

    it('logs an uninstrumented POST with actor and entity', async () => {
        await request(app).post('/api/admin/users').send({ name: 'Ada' }).expect(200);
        expect(createSpy).toHaveBeenCalledTimes(1);
        const data = createSpy.mock.calls[0][0].data;
        expect(data.entity).toBe('User');
        expect(data.userId).toBe('admin-1');
        expect(data.action).toContain('POST');
        expect(data.changes).toEqual({ name: 'Ada' });
    });

    it('captures the record id for PATCH and DELETE', async () => {
        await request(app).patch('/api/admin/users/u-42').send({ name: 'B' }).expect(200);
        expect(createSpy.mock.calls[0][0].data.entityId).toBe('u-42');

        createSpy.mockClear();
        await request(app).delete('/api/admin/roles/r-9').expect(200);
        const data = createSpy.mock.calls[0][0].data;
        expect(data.entity).toBe('Role');
        expect(data.entityId).toBe('r-9');
    });

    it('never writes a password into the log', async () => {
        await request(app).post('/api/admin/users')
            .send({ email: 'a@b.com', password: 'hunter2', nested: { apiKey: 'sk-live-123' } })
            .expect(200);
        const changes = createSpy.mock.calls[0][0].data.changes;
        expect(changes.password).toBe('[redacted]');
        expect(changes.nested.apiKey).toBe('[redacted]');
        expect(changes.email).toBe('a@b.com');
        expect(JSON.stringify(changes)).not.toContain('hunter2');
        expect(JSON.stringify(changes)).not.toContain('sk-live-123');
    });

    it('skips excluded read-only POSTs', async () => {
        await request(app).post('/api/admin/validate-only').send({ x: 1 }).expect(200);
        expect(createSpy).not.toHaveBeenCalled();
    });

    it('does not log a failed request — nothing changed', async () => {
        await request(app).post('/api/admin/fails').send({ x: 1 }).expect(400);
        expect(createSpy).not.toHaveBeenCalled();
    });

    it('does not double-log an endpoint that audited itself', async () => {
        await request(app).post('/api/admin/instrumented').send({ x: 1 }).expect(200);
        expect(createSpy).toHaveBeenCalledTimes(1);
        expect(createSpy.mock.calls[0][0].data.entity).toBe('Widget');
    });

    it('does not double-log an endpoint using a raw prisma.auditLog.create', async () => {
        await request(app).post('/api/admin/raw-audited').send({ x: 1 }).expect(200);
        // Exactly one row: the controller's own. This is the regression that
        // showed up live as a delta of 2 on POST /api/master/clients.
        expect(createSpy).toHaveBeenCalledTimes(1);
        expect(createSpy.mock.calls[0][0].data.entity).toBe('Legacy');
    });
});

describe('redactSecrets', () => {
    it('redacts secret-bearing keys at any depth and leaves the rest intact', () => {
        const out: any = redactSecrets({
            name: 'keep', passwordHash: 'x', clientSecret: 'y',
            deep: { token: 't', list: [{ apiKey: 'k', label: 'keep-me' }] },
        });
        expect(out.name).toBe('keep');
        expect(out.passwordHash).toBe('[redacted]');
        expect(out.clientSecret).toBe('[redacted]');
        expect(out.deep.token).toBe('[redacted]');
        expect(out.deep.list[0].apiKey).toBe('[redacted]');
        expect(out.deep.list[0].label).toBe('keep-me');
    });
});
