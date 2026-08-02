#!/usr/bin/env bash
# Seed the pitch host's serving dir from repo pitches/ (skips _templates and status:draft).
# The hub index.html is NOT seeded — the deploy portal regenerates it (POST /api/reindex).
# Usage: ./seed-pitches.sh /opt/dgtl /opt/dgtl-decks/site/pitch
set -euo pipefail
REPO="${1:?repo dir}"; DEST="${2:?serving dir}"
mkdir -p "$DEST"
for d in "$REPO"/pitches/*/; do
  slug=$(basename "$d"); [ "$slug" = "_templates" ] && continue
  status=$(python3 -c "import json,sys;print(json.load(open('$d/pitch.json')).get('status','') if __import__('os').path.exists('$d/pitch.json') else '')" 2>/dev/null || true)
  [ "$status" = "draft" ] && { echo "skip $slug (draft)"; continue; }
  rsync -a --delete --exclude pitch.json "$d" "$DEST/$slug/"
  echo "seeded $slug"
done
cp "$REPO/deploy/decks/site/pitch/404.html" "$DEST/404.html"
echo "now: curl -X POST https://deploy.dgtlmag.com/api/reindex -H \"x-deploy-token: \$DEPLOY_TOKEN\""
