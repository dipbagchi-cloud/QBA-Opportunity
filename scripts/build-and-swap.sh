#!/bin/bash
#
# Build the Next.js frontend without taking the running site down.
#
# The problem
# -----------
# `next build` rewrites its output directory in place. It deletes the previous
# build's content-hashed assets while the server serving that build is still
# advertising them, so for the whole build (~3 minutes) every
# /_next/static/*.js and *.css request 404s. The HTML still returns 200, so
# health checks pass while users get raw unstyled pages.
#
# The fix
# -------
# Build into a scratch directory, then swap it in with renames, which take
# milliseconds. The live .next is untouched for the entire build, so the site
# stays fully healthy until the swap. The only remaining gap is the frontend
# restart itself (~3s), which is unavoidable.
#
# The caller is expected to restart the frontend afterwards and then run
# scripts/verify-frontend-build.sh to confirm the new build is actually served.
#
# Usage:
#   build-and-swap.sh <app-dir> [build-command...]
# Example:
#   build-and-swap.sh /home/azureuser/app npm run build
set -euo pipefail

APP_DIR="${1:?app-dir is required}"
shift
BUILD_CMD=("$@")
[ ${#BUILD_CMD[@]} -eq 0 ] && BUILD_CMD=(npm run build)

FRONTEND_DIR="$APP_DIR/agentic-crm"
SCRATCH=".next.build"          # relative — Next requires distDir inside the project
LIVE="$FRONTEND_DIR/.next"
NEW="$FRONTEND_DIR/$SCRATCH"
PREV="$FRONTEND_DIR/.next.prev"

log() { echo "[build-swap] $*"; }

cd "$FRONTEND_DIR"

log "building into $SCRATCH (live .next untouched, site stays up)"
rm -rf "$NEW"

# NEXT_DIST_DIR is scoped to this command only. It must never leak into the
# PM2 runtime env, or `next start` would look for the scratch directory.
if ! NEXT_DIST_DIR="$SCRATCH" "${BUILD_CMD[@]}"; then
    log "ERROR: build failed — leaving the running build in place, nothing swapped"
    rm -rf "$NEW"
    exit 1
fi

# A build that produced no BUILD_ID is not a build worth swapping in.
if [ ! -f "$NEW/BUILD_ID" ]; then
    log "ERROR: $SCRATCH/BUILD_ID missing after build — refusing to swap"
    rm -rf "$NEW"
    exit 1
fi

NEW_ID="$(cat "$NEW/BUILD_ID")"
OLD_ID="$(cat "$LIVE/BUILD_ID" 2>/dev/null || echo 'none')"
log "built $NEW_ID (replacing $OLD_ID)"

# Carry the build cache across so the next build is not a cold one. Done before
# the swap so it costs nothing while the site is live.
if [ -d "$LIVE/cache" ] && [ ! -d "$NEW/cache" ]; then
    cp -r "$LIVE/cache" "$NEW/cache" 2>/dev/null || log "note: could not carry cache over"
fi

log "swapping in"
rm -rf "$PREV"
[ -d "$LIVE" ] && mv "$LIVE" "$PREV"
mv "$NEW" "$LIVE"

log "swapped: .next is now $NEW_ID (previous kept at .next.prev for rollback)"
log "caller must now restart the frontend and run verify-frontend-build.sh"
