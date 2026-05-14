#!/bin/bash
# Kill any stale process holding the given port before PM2 restarts it.
# Usage: ./start-safe.sh <port> <pm2-name>
PORT=$1
NAME=$2
STALE=$(fuser ${PORT}/tcp 2>/dev/null)
if [ -n "$STALE" ]; then
  echo "[start-safe] Port ${PORT} held by PID ${STALE} — killing..."
  kill $STALE
  sleep 2
fi
pm2 restart $NAME
echo "[start-safe] ${NAME} restarted on port ${PORT}"
