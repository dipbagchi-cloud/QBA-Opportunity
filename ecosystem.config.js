// PM2 process definitions for Q-CRM across the three environments on the
// shared Azure VM.
//
// Key restart policy (applies to every process unless overridden):
//   min_uptime       The process must stay up at least this long to be
//                    considered "up". A crash before this counts as a fast
//                    restart toward max_restarts.
//   max_restarts     Maximum fast-restarts within the min_uptime window.
//                    After this, PM2 marks the process "errored" and stops
//                    bouncing — protects the VM from a 4,000-restart loop
//                    when something is genuinely wrong (e.g. missing
//                    Prisma client, port permanently held by a ghost).
//   restart_delay    Wait this long between restarts, so we don't pin the
//                    CPU during a crash loop.
//   kill_timeout     SIGTERM grace before SIGKILL. Next.js needs ~5 s to
//                    release its port cleanly, otherwise the next spawn
//                    fails with EADDRINUSE.
//   max_memory_restart  Recycle the process if RSS exceeds this — guards
//                    against slow leaks turning into OOM kills.
//
// Use with the CI workflow / manual ops:
//   pm2 startOrReload /home/azureuser/app/ecosystem.config.js --only qcrm-backend
//
// First-time install on a VM:
//   pm2 start /home/azureuser/app/ecosystem.config.js
//   pm2 save
//   pm2 startup    # one-time, prints a sudo command to install the systemd unit

const COMMON = {
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    min_uptime: '20s',
    max_restarts: 10,
    restart_delay: 3000,
    kill_timeout: 8000,
    listen_timeout: 15000,
};

const BACKEND_DEFAULTS = {
    ...COMMON,
    script: 'dist/index.js',
    interpreter: 'node',
    max_memory_restart: '600M',
    out_file: '/home/azureuser/.pm2/logs/${name}-out.log',
    error_file: '/home/azureuser/.pm2/logs/${name}-error.log',
    merge_logs: true,
};

const FRONTEND_DEFAULTS = {
    ...COMMON,
    // Launch Next.js directly via node rather than `npm start`. `npm start` forks
    // `next start` as a CHILD process that PM2 does not own; on a restart that
    // child can survive as an orphan still holding the port, so PM2 then
    // crash-loops on EADDRINUSE while the orphan keeps serving the OLD build —
    // the "QA sometimes won't open after a deploy" symptom. Running the next
    // binary under node makes PM2 track the real next-server process, so a
    // restart cleanly stops and replaces it.
    script: 'node_modules/next/dist/bin/next',
    interpreter: 'node',
    max_memory_restart: '1G',
    merge_logs: true,
};

module.exports = {
    apps: [
        // ── Production ─────────────────────────────────────────────────
        {
            ...BACKEND_DEFAULTS,
            name: 'qcrm-backend',
            cwd: '/home/azureuser/app/backend',
        },
        {
            ...FRONTEND_DEFAULTS,
            name: 'qcrm-frontend',
            cwd: '/home/azureuser/app/agentic-crm',
            args: 'start -p 3000',
        },

        // ── QA ─────────────────────────────────────────────────────────
        {
            ...BACKEND_DEFAULTS,
            name: 'qcrm-qa-backend',
            cwd: '/home/azureuser/qa/backend',
        },
        {
            ...FRONTEND_DEFAULTS,
            name: 'qcrm-qa-frontend',
            cwd: '/home/azureuser/qa/agentic-crm',
            args: 'start -p 3004',
            env: { PORT: '3004' },
        },

        // ── UAT ────────────────────────────────────────────────────────
        {
            ...BACKEND_DEFAULTS,
            name: 'qcrm-uat-backend',
            cwd: '/home/azureuser/uat/backend',
        },
        {
            ...FRONTEND_DEFAULTS,
            name: 'qcrm-uat-frontend',
            cwd: '/home/azureuser/uat/agentic-crm',
            args: 'start -p 3002',
            env: { PORT: '3002' },
        },
    ],
};
