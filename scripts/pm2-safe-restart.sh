#!/bin/bash
#
# Safely restart a PM2-managed Q-CRM process. Works around the persistent
# ghost-port issue on the Azure VM where Next.js / Express child processes
# hold ports past SIGTERM, causing the freshly-spawned child to die with
# EADDRINUSE while PM2 keeps reporting "online".
#
# Sequence:
#   1. pm2 stop <name>
#   2. fuser -k -9 <port>/tcp  (twice, with a sleep, in case PM2 respawns)
#   3. pm2 startOrReload ecosystem.config.js --only <name> --update-env
#   4. Wait until the port is actually bound, fail otherwise
#
# Usage:
#   pm2-safe-restart.sh <pm2-name> <port> [ecosystem-config-path]
#
# Examples:
#   pm2-safe-restart.sh qcrm-backend          3001
#   pm2-safe-restart.sh qcrm-qa-frontend      3004
#   pm2-safe-restart.sh qcrm-uat-backend      3003 /home/azureuser/ecosystem.config.js

set -euo pipefail

NAME="${1:?pm2-name is required}"
PORT="${2:?port is required}"
ECO="${3:-/home/azureuser/app/ecosystem.config.js}"

echo "[safe-restart] $NAME (port $PORT)"

pm2 stop "$NAME" 2>&1 | tail -3 || true
sleep 2

# Kill any remaining listener on the target port. Run twice because the
# parent PM2 may try to respawn between the stop above and the first kill.
fuser -k -9 "${PORT}/tcp" 2>/dev/null || true
sleep 3
fuser -k -9 "${PORT}/tcp" 2>/dev/null || true
sleep 2

if fuser "${PORT}/tcp" >/dev/null 2>&1; then
    echo "[safe-restart] WARN: port $PORT still has an owner after two kills"
    fuser "${PORT}/tcp" 2>&1
fi

pm2 startOrReload "$ECO" --only "$NAME" --update-env 2>&1 | tail -5

# Wait up to 30 seconds for the process to actually bind the port.
for i in $(seq 1 30); do
    if fuser "${PORT}/tcp" >/dev/null 2>&1; then
        echo "[safe-restart] $NAME bound port $PORT after ${i}s"
        pm2 save 2>&1 | tail -1
        exit 0
    fi
    sleep 1
done

echo "[safe-restart] ERROR: $NAME did not bind port $PORT within 30s"
pm2 logs "$NAME" --lines 20 --nostream --err 2>&1 | tail -25
exit 1
