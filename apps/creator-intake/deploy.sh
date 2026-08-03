#!/usr/bin/env bash
# Deploy apps/creator-intake to Hostinger shared hosting over SSH.
#
#   ./deploy.sh user@server[:port]         e.g. ./deploy.sh u12345@145.14.1.2:65002
#
# Never git-deploy the monorepo into public_html — this rsyncs site/ only.
# One-time manual steps live in README.md (DNS, MySQL import, mailbox, R2, .env).
set -euo pipefail
cd "$(dirname "$0")"

TARGET="${1:?usage: ./deploy.sh user@host[:port]}"
HOSTPART="${TARGET%%:*}"
PORT="${TARGET##*:}"
[ "$PORT" = "$TARGET" ] && PORT=22
DOMAIN_DIR="domains/join.dgtlinfluence.com"

echo "→ syncing site/ to $HOSTPART:~/$DOMAIN_DIR/public_html (port $PORT)"
rsync -avz --delete \
  --exclude '.env*' \
  -e "ssh -p $PORT" \
  site/ "$HOSTPART:~/$DOMAIN_DIR/public_html/"

echo "→ syncing cron/ beside the webroot"
rsync -avz -e "ssh -p $PORT" cron/ "$HOSTPART:~/$DOMAIN_DIR/cron/"

echo "→ done. Post-deploy checklist:"
echo "   1. ~/$DOMAIN_DIR/.env exists (scp it manually once; never in git)"
echo "   2. schema.sql imported into the Hostinger MySQL DB"
echo "   3. hPanel cron: php ~/$DOMAIN_DIR/cron/maintenance.php  (daily)"
echo "   4. smoke: ./tests/smoke.sh https://join.dgtlinfluence.com   (then delete the test record in admin)"
