#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
SERVICE_NAME="${POSTGRES_SERVICE_NAME:-content-funnel-postgres}"

cd "$ROOT_DIR"

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${POSTGRES_DB:?Set POSTGRES_DB in .env or the environment.}"
: "${POSTGRES_USER:?Set POSTGRES_USER in .env or the environment.}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
OUTPUT_FILE="$BACKUP_DIR/${POSTGRES_DB}_${TIMESTAMP}.dump"

echo "[backup-db] Ensuring Postgres service is running..."
docker compose up -d "$SERVICE_NAME" >/dev/null

echo "[backup-db] Creating backup: $OUTPUT_FILE"
docker compose exec -T "$SERVICE_NAME" \
  pg_dump \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --format=custom \
    --no-owner \
    --no-privileges \
  > "$OUTPUT_FILE"

echo "[backup-db] Backup complete: $OUTPUT_FILE"
