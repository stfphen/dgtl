#!/usr/bin/env bash
# Restore production data from the offboard bundle into the running containers.
# Usage: ./restore-data.sh /opt/offboard/dgtl-offboard-20260721 /opt/dgtl
# Run AFTER the postgres containers are up, BEFORE first real use.
set -euo pipefail
BUNDLE="${1:?bundle dir}"; REPO="${2:?repo dir}"
sha256sum -c "$BUNDLE/SHA256SUMS.txt" --quiet --ignore-missing || { echo "bundle checksum FAILED"; exit 1; }
source "$REPO/platform/.env"
echo "→ content_funnel into content-funnel-postgres ($POSTGRES_DB as $POSTGRES_USER)"
docker exec -i content-funnel-postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$BUNDLE/db-dumps/content_funnel.sql"
source "$REPO/apps/dgtl-os/local/deploy/docker/.env"
echo "→ dgtlkb into dgtl-pgvector ($POSTGRES_DB as $POSTGRES_USER)"
docker exec -i dgtl-pgvector psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$BUNDLE/db-dumps/dgtlkb.sql"
echo "→ uploads → platform/uploads/ (compose binds ./uploads:/app/public/uploads)"
mkdir -p "$REPO/platform/uploads"
cp -rv "$BUNDLE/source/opt-content-checkout-funnel/uploads/." "$REPO/platform/uploads/"
echo "done. Verify: docker exec content-funnel-postgres psql -U $POSTGRES_USER -d content_funnel -c 'select count(*) from leads;'"
