#!/usr/bin/env bash
# End-to-end smoke test over HTTP.
#   ./tests/smoke.sh                    → boots php -S on :8089 against a temp SQLite DB
#   ./tests/smoke.sh https://join.…     → runs against a deployed instance (no server boot)
# R2 steps run only when R2_SECRET_ACCESS_KEY is configured in the env file.
set -euo pipefail
cd "$(dirname "$0")/.."

BASE="${1:-}"
if [ -z "$BASE" ]; then
  BASE="http://localhost:8089"
  php -S localhost:8089 -t site >/dev/null 2>&1 &
  PHP_PID=$!
  trap 'kill $PHP_PID 2>/dev/null || true' EXIT
  sleep 1
fi

# Unique per run so reruns against the same dev DB never collide.
EMAIL="smoke-$(date +%s)-$$@example.com"

J() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)"; }
say() { printf '  %s\n' "$*"; }
POST() { curl -sS -X POST -H 'Content-Type: application/json' -d "$2" "$BASE$1"; }

echo "smoke against $BASE"

say "health"
POST_OUT=$(curl -sS "$BASE/api/health.php")
[ "$(echo "$POST_OUT" | J "['ok']")" = "True" ]

say "create draft (step 1)"
R=$(POST /api/draft.php "{\"step\":1,\"hp_website\":\"\",\"fields\":{
  \"applicant_type\":\"creator\",\"legal_name\":\"Smoke Test\",\"public_name\":\"Smokey\",
  \"email\":\"$EMAIL\",\"phone\":\"+1 416 555 0100\",\"city\":\"Toronto\",
  \"country\":\"Canada\",\"entity_type\":\"individual\"}}")
PID=$(echo "$R" | J "['public_id']")
TOK=$(echo "$R" | J "['draft_token']")
[ -n "$PID" ] && [ -n "$TOK" ]

say "save step 2"
R=$(POST /api/draft.php "{\"step\":2,\"public_id\":\"$PID\",\"draft_token\":\"$TOK\",\"base_rev\":1,\"fields\":{
  \"primary_category\":\"music\",\"bio_short\":\"Smoke bio.\",\"looking_for\":[\"brand_deals\"]}}")
[ "$(echo "$R" | J "['payload_rev']")" = "2" ]

say "stale base_rev conflicts with 409"
CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -d "{\"step\":2,\"public_id\":\"$PID\",\"draft_token\":\"$TOK\",\"base_rev\":1,\"fields\":{}}" \
  "$BASE/api/draft.php")
[ "$CODE" = "409" ]

say "save steps 3 + 4"
POST /api/draft.php "{\"step\":3,\"public_id\":\"$PID\",\"draft_token\":\"$TOK\",\"fields\":{
  \"socials\":[{\"platform\":\"instagram\",\"handle\":\"@smokey\",\"profile_url\":\"instagram.com/smokey\",
  \"follower_count\":1000,\"verified\":false,\"is_primary\":true}]}}" | J "['ok']" >/dev/null
POST /api/draft.php "{\"step\":4,\"public_id\":\"$PID\",\"draft_token\":\"$TOK\",\"fields\":{
  \"media_links\":[{\"url\":\"https://drive.google.com/smoke\",\"label\":\"EPK\"}],
  \"rights_confirmation\":true,\"derivative_ok\":true,\"broadcast_ok\":false,
  \"ai_training_optout\":true,\"credit_line\":\"Photo: Smoke\",
  \"signature_name\":\"Smoke Test\",\"signature_date\":\"2026-08-03\"}}" | J "['ok']" >/dev/null

if [ -n "${SMOKE_R2:-}" ]; then
  say "presign + upload 1KB to R2 + confirm"
  R=$(POST /api/presign.php "{\"public_id\":\"$PID\",\"draft_token\":\"$TOK\",\"kind\":\"upload\",
    \"filename\":\"smoke.png\",\"mime\":\"image/png\",\"bytes\":1024}")
  MID=$(echo "$R" | J "['media_id']")
  URL=$(echo "$R" | J "['upload_url']")
  head -c 1024 /dev/zero > /tmp/smoke-blob.png
  curl -sS -f -X PUT -H 'Content-Type: image/png' --data-binary @/tmp/smoke-blob.png "$URL" > /dev/null
  POST /api/confirm-upload.php "{\"public_id\":\"$PID\",\"draft_token\":\"$TOK\",\"media_id\":$MID,
    \"title\":\"Smoke\",\"is_owner\":true}" | J "['ok']" >/dev/null
  rm -f /tmp/smoke-blob.png
else
  say "R2 steps skipped (set SMOKE_R2=1 with R2 creds in .env to include them)"
fi

say "magic link (dev debug) + resume rotates the token"
R=$(POST /api/magic-link.php "{\"email\":\"$EMAIL\"}")
RESUME_URL=$(echo "$R" | J "['debug']['resume_url']")
MTOK="${RESUME_URL##*resume=}"
R=$(POST /api/resume.php "{\"token\":\"$MTOK\"}")
TOK=$(echo "$R" | J "['draft_token']")
[ "$(echo "$R" | J "['public_id']")" = "$PID" ]

say "second redeem of the same link is 410"
CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -d "{\"token\":\"$MTOK\"}" "$BASE/api/resume.php")
[ "$CODE" = "410" ]

say "submit"
R=$(POST /api/submit.php "{\"public_id\":\"$PID\",\"draft_token\":\"$TOK\",\"fields\":{
  \"how_did_you_hear\":\"smoke\",\"consent_marketing_email\":false,\"consent_survey_panel\":false}}")
[ "$(echo "$R" | J "['status']")" = "submitted" ]

say "post-submit edits are refused (409)"
CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -d "{\"step\":2,\"public_id\":\"$PID\",\"draft_token\":\"$TOK\",\"fields\":{}}" \
  "$BASE/api/draft.php")
[ "$CODE" = "409" ]

echo "smoke: all green"
