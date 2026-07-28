#!/bin/bash
# DGTL OS — double-click launcher (macOS)
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run DGTL OS locally."
  echo "Install the LTS build from https://nodejs.org, then double-click start.command again."
  echo ""
  read -p "Press Return to close this window."
  exit 1
fi

PORT="${PORT:-8787}"

# stop any previous instance on this port so re-runs restart cleanly with the new key
lsof -ti tcp:"${PORT}" | xargs kill -9 2>/dev/null

# open the browser once the server is up
( sleep 1.2; open "http://localhost:${PORT}" ) &

echo "Starting DGTL OS…  (close this window or press Ctrl-C to stop)"
node server.mjs
