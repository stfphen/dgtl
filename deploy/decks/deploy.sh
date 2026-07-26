#!/usr/bin/env bash
# One-command deck deploy on the VPS. GitHub (origin/main) is the source of truth.
# Workflow:  edit a deck on your Mac -> git push  ->  ssh VPS  ->  ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "[decks] 1/3 syncing to origin/main (source of truth)..."
git fetch origin
git checkout main
git reset --hard origin/main
echo "[decks] now at: $(git log --oneline -1)"

echo "[decks] 2/3 rebuilding container..."
docker compose up -d --build

echo "[decks] 3/3 health check..."
sleep 3
code=$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8090/sample-client/ 2>/dev/null || echo "000")
echo "[decks] local health: HTTP $code"
if [ "$code" = "200" ]; then
  echo "[decks] ✅ live — verify https://pitch.dgtlmedia.io/"
else
  echo "[decks] ❌ not healthy. Inspect: docker logs dgtl-decks --tail=50"
  exit 1
fi
