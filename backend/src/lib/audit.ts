import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma';

/**
 * Audit trail for administrative changes.
 *
 * The requirement is absolute: *any* change made through the admin surface
 * must end up in the audit log and be visible in Settings → Audit Log. Adding
 * a `prisma.auditLog.create` by hand to each of the ~76 mutating admin routes
 * cannot deliver that — one omission is invisible, and every endpoint added
 * later starts out unaudited. (That is exactly how `stage_history` ended up
 * empty.)
 *
 * So this module provides two layers:
 *
 *   1. `recordAudit(...)` — an explicit, richly-described entry written by a
 *      controller that knows what actually changed.
 *   2. `auditMutations()` — router middleware that, after any successful
 *      mutating request that did NOT record an explicit entry, writes a
 *      fallback entry describing the request. Coverage therefore holds for
 *      endpoints nobody remembered to instrument, including future ones.
 *
 * Layer 2 only fires when layer 1 stayed silent, so instrumented endpoints
 * keep their detailed entry rather than gaining a duplicate.
 */

/**
 * Per-request flag recording whether ANY audit row was written while handling
 * it — including by the ~22 controllers that call `prisma.auditLog.create`
 * directly rather than going through `recordAudit`. Detecting the write at the
 * Prisma layer (below) rather than trusting callers is what stops the safety
 * net from duplicating an entry an endpoint already wrote itself, and it keeps
 * working for raw calls added in future.
 */
type AuditFlag = { wrote: boolean };
const auditContext = new AsyncLocalStorage<AuditFlag>();

/**
 * Register once per process: any successful AuditLog create marks the
 * in-flight request as audited.
 *
 * This wraps `prisma.auditLog.create` directly rather than using Prisma
 * middleware — `$use` was removed in Prisma 6, and the `$extends` replacement
 * returns a *new* client, which would mean rethreading the shared singleton
 * through every module that imports it. Wrapping the one method is contained
 * and leaves all existing call sites and types untouched.
 */
let interceptorInstalled = false;
function installAuditInterceptor() {
    if (interceptorInstalled) return;
    interceptorInstalled = true;
    try {
        const delegate: any = (prisma as any).auditLog;
        if (!delegate || typeof delegate.create !== 'function') {
            throw new Error('prisma.auditLog.create is unavailable');
        }
        const original = delegate.create.bind(delegate);
        delegate.create = async (...args: unknown[]) => {
            const result = await original(...args);
            const store = auditContext.getStore();
            if (store) store.wrote = true;
            return result;
        };
    } catch (error) {
        // Without the interceptor the net still works — it may duplicate an
        // entry rather than lose one. Noisy, never silent.
        console.error('[audit] could not install audit interceptor', error);
    }
}

/** Body keys whose values must never reach the audit log. */
const SECRET_KEY_RE = /pass(word)?|secret|token|apikey|api_key|credential|clientsecret|authorization/i;

/**
 * Recursively strip secret-bearing values from a request body before it is
 * persisted. Admin endpoints carry real credentials — assignLocalPassword and
 * resetUserPassword both take plaintext passwords — and an audit log is one of
 * the most widely-readable tables in the app.
 */
export function redactSecrets(value: unknown, depth = 0): unknown {
    if (depth > 6 || value == null) return value;
    if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactSecrets(v, depth + 1));
    if (typeof value !== 'object') return value;

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = SECRET_KEY_RE.test(k) ? '[redacted]' : redactSecrets(v, depth + 1);
    }
    return out;
}

/**
 * Write an audit entry describing a change the caller understands in detail.
 *
 * Never throws: an audit failure must not fail the operation the user just
 * performed. It is logged loudly instead, so a silent gap is still noticed.
 */
export async function recordAudit(params: {
    req: Request;
    entity: string;
    entityId: string;
    action: string;
    changes?: unknown;
}): Promise<void> {
    const { req, entity, entityId, action, changes } = params;
    try {
        await prisma.auditLog.create({
            data: {
                entity,
                entityId: entityId || '(none)',
                action,
                userId: req.user?.userId || null,
                changes: (changes === undefined ? undefined : (redactSecrets(changes) as any)),
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
            },
        });
    } catch (error) {
        console.error('[audit] failed to record entry', { entity, entityId, action, error });
    }
}

/** Did anything write an audit row while this request was being handled? */
export function wasAudited(): boolean {
    return auditContext.getStore()?.wrote === true;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Router-level safety net: audit every successful mutating request that no
 * controller explicitly logged.
 *
 * `entity` is derived from the route so the existing Settings → Audit Log
 * entity filter keeps working (e.g. `PATCH /api/admin/users/:id` → `User`).
 * The entry records the actor, the route, and the redacted body, which is
 * enough to answer "who changed what, and when" even for an endpoint that was
 * never instrumented by hand.
 */
export function auditMutations(options: { source: string; skipPaths?: RegExp }) {
    installAuditInterceptor();
    return function auditMutationsMiddleware(req: Request, res: Response, next: NextFunction) {
        if (!MUTATING.has(req.method)) return next();
        // Some POSTs are reads in disguise (validators, previews, test sends).
        // Auditing those buries the real changes in noise.
        if (options.skipPaths?.test(req.path)) return next();

        // Snapshot the body now — a controller may mutate req.body while running.
        let bodySnapshot: unknown;
        try {
            bodySnapshot = redactSecrets(req.body);
        } catch {
            bodySnapshot = undefined;
        }

        // Held by reference so the finish handler, which runs outside the
        // async context, can still read what happened during the request.
        const flag: AuditFlag = { wrote: false };

        res.on('finish', () => {
            // Only successful changes are auditable events; a rejected request
            // changed nothing, and 4xx noise would bury the real entries.
            if (res.statusCode < 200 || res.statusCode >= 300) return;
            // The endpoint already described the change itself — don't duplicate it.
            if (flag.wrote) return;

            const routePath = `${req.baseUrl}${req.route?.path ?? req.path}`;
            void prisma.auditLog.create({
                data: {
                    entity: entityFromPath(req.baseUrl, req.path, options.source),
                    entityId: String(req.params?.id ?? req.params?.userId ?? '(none)'),
                    action: `${req.method} ${routePath}`,
                    userId: req.user?.userId || null,
                    changes: (bodySnapshot as any) ?? undefined,
                    ipAddress: req.ip || null,
                    userAgent: req.get('user-agent') || null,
                },
            }).catch((error) => {
                console.error('[audit] safety-net entry failed', { path: routePath, error });
            });
        });

        auditContext.run(flag, next);
    };
}

/**
 * Turn `/api/admin` + `/users/abc123` into a stable, human-meaningful entity
 * name ("User") for the audit-log entity filter. Falls back to the router's
 * own label when the segment isn't recognised.
 */
function entityFromPath(baseUrl: string, path: string, fallback: string): string {
    const segment = (path || '').split('/').filter(Boolean)[0] || '';
    const KNOWN: Record<string, string> = {
        users: 'User',
        roles: 'Role',
        teams: 'Team',
        clients: 'Client',
        regions: 'Region',
        technologies: 'Technology',
        'pricing-models': 'PricingModel',
        'project-types': 'ProjectType',
        'project-roles': 'ProjectRole',
        'rate-cards': 'RateCard',
        'email-templates': 'EmailTemplate',
        'notification-rules': 'NotificationRule',
        'budget-assumptions': 'BudgetAssumptions',
        'auth-config': 'AuthConfig',
        'qpeople-mappings': 'QPeopleMapping',
        currencies: 'CurrencyRate',
        contacts: 'Contact',
    };
    return KNOWN[segment] || (segment ? segment : fallback);
}
