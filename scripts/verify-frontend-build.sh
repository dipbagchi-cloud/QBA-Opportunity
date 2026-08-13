#!/bin/bash
#
# Verify that a Next.js frontend is actually SERVING the build that is on disk,
# and repair it if not.
#
# Why this exists
# ---------------
# `next build` rewrites .next in place, deleting the previous build's hashed
# assets. The running server keeps advertising the OLD asset URLs until it is
# restarted, so for the whole build window — and indefinitely if the restart is
# skipped or fails — every /_next/static/* request 404s. The page still returns
# 200, so a naive health check passes while users get raw unstyled HTML.
#
# That is exactly what hit production on 2026-08-12: .next was rebuilt at 16:31,
# the frontend process was 88 minutes old, and the site rendered with no CSS.
#
# So "is the port up?" is NOT a sufficient post-deploy check. This asserts the
# two things that actually matter:
#   1. the served HTML references the BUILD_ID currently on disk
#   2. an asset that HTML references really resolves (200)
#
# Usage:
#   verify-frontend-build.sh <app-dir> <port> <pm2-name> [ecosystem-config]
# Example:
#   verify-frontend-build.sh /home/azureuser/app 3000 qcrm-frontend
set -uo pipefail

APP_DIR="${1:?app-dir is required}"          # e.g. /home/azureuser/app
PORT="${2:?port is required}"                # e.g. 3000
PM2_NAME="${3:?pm2-name is required}"        # e.g. qcrm-frontend
ECO="${4:-$APP_DIR/ecosystem.config.js}"

NEXT_DIR="$APP_DIR/agentic-crm/.next"
RESTART="$APP_DIR/scripts/pm2-safe-restart.sh"

log() { echo "[verify-frontend] $*"; }

# curl and wget get OOM-killed on this VM, so all HTTP probing goes through node.
fetch() {
    node -e "
        const http = require('http');
        http.get({host:'127.0.0.1', port:$1, path:'$2', timeout:15000}, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { process.stdout.write(res.statusCode + '\n' + d); });
        }).on('error', () => { process.stdout.write('0\n'); })
          .on('timeout', function () { this.destroy(); process.stdout.write('0\n'); });
    " 2>/dev/null
}

status_of() { fetch "$1" "$2" | head -1; }

check() {
    local disk_id served status body asset asset_status
    disk_id="$(cat "$NEXT_DIR/BUILD_ID" 2>/dev/null || true)"
    if [ -z "$disk_id" ]; then
        log "FAIL: no BUILD_ID at $NEXT_DIR — the build did not complete"
        return 1
    fi

    served="$(fetch "$PORT" /login)"
    status="$(echo "$served" | head -1)"
    body="$(echo "$served" | tail -n +2)"

    if [ "$status" != "200" ]; then
        log "not serving yet (HTTP ${status:-none})"
        return 1
    fi

    # 1. Is the running process on the build that is on disk?
    #
    # Matched on everything after the first character, for two reasons, both of
    # which this script hit for real on a BUILD_ID of "-Xb30TwrqO2ds70amKTqD":
    #
    #   * a leading "-" makes grep read the id as OPTIONS, so the check failed
    #     no matter what the page contained — hence the "--" below;
    #   * the App Router prints the id as an HTML comment, "<!--<id>-->", and
    #     escapes a leading "-" to "_" because "<!---" would be malformed. The
    #     literal id is therefore genuinely absent from the page.
    #
    # It reported STALE against a perfectly good build and restarted the
    # frontend on every run. A verification that cries wolf is worse than none:
    # it trains you to ignore it, and it restarts a healthy process.
    local id_tail="${disk_id:1}"
    if [ ${#disk_id} -lt 8 ] || [ -z "$id_tail" ]; then
        log "FAIL: BUILD_ID '$disk_id' is too short to verify against"
        return 1
    fi
    if ! echo "$body" | grep -qF -- "$id_tail"; then
        log "STALE: disk BUILD_ID=$disk_id is not referenced by the served HTML"
        return 1
    fi

    # 2. Do the assets that HTML points at actually resolve? This is the check
    #    that catches a half-swapped .next, which a page-level 200 hides.
    for pattern in '/_next/static/css/[A-Za-z0-9._-]*\.css' '/_next/static/chunks/[A-Za-z0-9._-]*\.js'; do
        asset="$(echo "$body" | grep -oE "$pattern" | head -1)"
        [ -z "$asset" ] && continue
        asset_status="$(status_of "$PORT" "$asset")"
        if [ "$asset_status" != "200" ]; then
            log "BROKEN ASSET: $asset -> HTTP $asset_status (this is the unstyled-page signature)"
            return 1
        fi
    done

    log "OK: serving BUILD_ID=$disk_id with assets resolving"
    return 0
}

log "checking $PM2_NAME on port $PORT ($APP_DIR)"

# Give a just-restarted server a moment to come up before judging it.
for attempt in $(seq 1 20); do
    if check; then exit 0; fi
    sleep 3
done

log "still wrong after the initial wait — restarting $PM2_NAME to pick up the new build"
bash "$RESTART" "$PM2_NAME" "$PORT" "$ECO" || log "restart script reported a problem; continuing to verify"

for attempt in $(seq 1 20); do
    if check; then
        log "recovered after restart"
        exit 0
    fi
    sleep 3
done

log "FAILED: $PM2_NAME is not serving the build on disk after a restart"
log "last 20 lines of its log:"
pm2 logs "$PM2_NAME" --lines 20 --nostream 2>&1 | tail -20
exit 1
