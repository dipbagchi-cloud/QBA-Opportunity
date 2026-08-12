import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

/**
 * Query logging is opt-in, not the default.
 *
 * `log: ['query']` writes every SQL statement to disk. On the shared VM that
 * grew the PM2 logs to 850MB — a single backend's out.log was 219MB — which is
 * pure write amplification on a box whose OOM killer already kills `cat` and
 * `curl`, and it buries real errors in query spam when diagnosing an incident.
 *
 * Warnings and errors are always kept, since those are what you actually need
 * when something breaks. Set PRISMA_LOG_QUERIES=true to turn statement logging
 * back on temporarily while debugging.
 */
const logLevels: ('query' | 'warn' | 'error')[] =
    process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'];

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: logLevels,
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
