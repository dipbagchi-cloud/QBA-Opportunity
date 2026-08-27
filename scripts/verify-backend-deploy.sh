#!/bin/bash
#
# Verify that a backend process is actually RUNNING the code that is on disk,
# and repair it if not.
#
# Why this exists
# ---------------
# Node loads `dist/**` into memory once, at startup. Copying a newer file over
# it changes nothing until the process is restarted — the server keeps serving
# the old code indefinitely, with no error, no log line, and a perfectly
# healthy-looking port.
#
# That is not hypothetical. On 2026-08-27 a rebuilt controller was scp'd to QA
# at 11:09 while the backend had been running since 10:52. The feature was
# "verified" by a script that did require() on the new file directly — which
# loads a fresh copy from disk, so the test exercised the new code while the
# live server served the old. The test passed, the API returned a payload
# missing the new field, and the UI rendered nothing. Requiring a file proves
# the code is correct; it proves nothing about what the process is serving.
#
# This is the backend twin of verify-frontend-build.sh, which exists for the
# same class of bug on the Next.js side: a bound port and a 200 are not
# evidence that a deploy landed.
#
# What it asserts
#   1. the process started AFTER the newest file in dist/  (it loaded this code)
#   2. the Prisma client is present                        (see the QA/UAT note)
#   3. the server actually answers                         (it is alive)
#
# Usage:
#   verify-backend-deploy.sh <app-dir> <port> <pm2-name> [ecosystem-config]
# Example:
#   verify-backend-deploy.sh /home/azureuser/qa 3003 qcrm-qa-backend
set -uo pipefail

APP_DIR="${1:?app-dir is required}"          # e.g. /home/azureuser/qa
PORT="${2:?port is required}"                # e.g. 3003
PM2_NAME="${3:?pm2-name is required}"        # e.g. qcrm-qa-backend
ECO="${4:-$APP_DIR/ecosystem.config.js}"

DIST="$APP_DIR/backend/dist"
RESTART="$APP_DIR/scripts/pm2-safe-restart.sh"

log() { echo "[verify-backend] $*"; }

# Newest mtime anywhere under dist/, as a unix timestamp.
newest_dist() {
    find "$DIST" -type f -name '*.js' -printf '%T@\n' 2>/dev/null \
        | cut -d. -f1 | sort -n | tail -1
}

# When pm2 says this process started, as a unix timestamp. pm_uptime is the
# start time in ms, not a duration — the name is a trap.
proc_started() {
    pm2 jlist 2>/dev/null | node -e "
        let d = '';
        process.stdin.on('data', c => d += c).on('end', () => {
            try {
                const p = JSON.parse(d).find(x => x.name === '$PM2_NAME');
                if (!p || p.pm2_env.status !== 'online') { process.stdout.write(''); return; }
                process.stdout.write(String(Math.floor(p.pm2_env.pm_uptime / 1000)));
            } catch (e) { process.stdout.write(''); }
        });
    " 2>/dev/null
}

# curl and wget get OOM-killed on this VM, so probe over node.
health() {
    node -e "
        require('http').get(
            { host: '127.0.0.1', port: $PORT, path: '/api/public/stats', timeout: 20000 },
            r => { process.stdout.write(String(r.statusCode)); r.resume(); },
        ).on('error', () => process.stdout.write('0'))
         .on('timeout', function () { this.destroy(); process.stdout.write('0'); });
    " 2>/dev/null
}

# check() returns:
#   0  healthy
#   1  transient — still coming up, worth waiting for
#   2  stale — the process predates its own code, which waiting can never fix
check() {
    local ft pt status
    ft="$(newest_dist)"
    if [ -z "$ft" ]; then
        log "FAIL: no compiled JS under $DIST — nothing was deployed"
        return 1
    fi

    pt="$(proc_started)"
    if [ -z "$pt" ]; then
        log "$PM2_NAME is not online yet"
        return 1
    fi

    # The whole point. Equal timestamps count as stale: a file written in the
    # same second the process booted may or may not have been read, and
    # "probably fine" is what this script exists to eliminate.
    if [ "$pt" -le "$ft" ]; then
        log "STALE: newest dist file $(date -u -d "@$ft" '+%H:%M:%S') is not older than process start $(date -u -d "@$pt" '+%H:%M:%S') (UTC)"
        log "       the running process cannot have loaded it"
        return 2
    fi

    # Prisma's generated client goes missing on QA/UAT after enough restart
    # churn, and the failure mode is a crash loop that looks like a code bug.
    if [ ! -d "$APP_DIR/backend/node_modules/.prisma/client" ]; then
        log "FAIL: node_modules/.prisma/client is missing — run: cd $APP_DIR/backend && npx prisma generate"
        return 1
    fi

    status="$(health)"
    if [ "$status" != "200" ]; then
        log "not serving yet (HTTP ${status:-none} on /api/public/stats)"
        return 1
    fi

    log "OK: process started $(date -u -d "@$pt" '+%H:%M:%S') > newest dist $(date -u -d "@$ft" '+%H:%M:%S') (UTC), serving 200"
    return 0
}

log "checking $PM2_NAME on port $PORT ($APP_DIR)"

# A just-restarted server deserves a moment before being judged — but only for
# conditions that can actually resolve on their own. A process older than its
# own code never will, so that one skips straight to the restart instead of
# spending 45 seconds re-reading the same two timestamps.
for attempt in $(seq 1 15); do
    check
    case $? in
        0) exit 0 ;;
        2) log "not waiting — staleness cannot resolve itself"; break ;;
    esac
    sleep 3
done

log "restarting $PM2_NAME to pick up the deployed code"
bash "$RESTART" "$PM2_NAME" "$PORT" "$ECO" || log "restart script reported a problem; continuing to verify"

for attempt in $(seq 1 15); do
    if check; then
        log "recovered after restart"
        exit 0
    fi
    sleep 3
done

log "FAILED: $PM2_NAME is not running the code on disk after a restart"
log "last 20 lines of its log:"
pm2 logs "$PM2_NAME" --lines 20 --nostream 2>&1 | tail -20
exit 1
