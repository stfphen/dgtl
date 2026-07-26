#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
SERVICE_NAME="${POSTGRES_SERVICE_NAME:-content-funnel-postgres}"

cd "$ROOT_DIR"

if [ "${1:-}" = "" ]; then
  echo "Usage: scripts/restore-db.sh path/to/backup.dump" >&2
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore-db] Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

: "${POSTGRES_DB:?Set POSTGRES_DB in .env or the environment.}"
: "${POSTGRES_USER:?Set POSTGRES_USER in .env or the environment.}"

if [ "${RESTORE_CONFIRM:-}" != "restore $POSTGRES_DB" ]; then
  echo "[restore-db] Refusing to restore without confirmation." >&2
  echo "[restore-db] Re-run with: RESTORE_CONFIRM='restore $POSTGRES_DB' scripts/restore-db.sh $BACKUP_FILE" >&2
  exit 1
fi

echo "[restore-db] Ensuring Postgres service is running..."
docker compose up -d "$SERVICE_NAME" >/dev/null

case "$BACKUP_FILE" in
  *.sql)
    echo "[restore-db] Restoring SQL backup into $POSTGRES_DB..."
    docker compose exec -T "$SERVICE_NAME" \
      psql \
        --username="$POSTGRES_USER" \
        --dbname="$POSTGRES_DB" \
      < "$BACKUP_FILE"
    ;;
  *)
    echo "[restore-db] Restoring custom dump into $POSTGRES_DB..."
    docker compose exec -T "$SERVICE_NAME" \
      pg_restore \
        --username="$POSTGRES_USER" \
        --dbname="$POSTGRES_DB" \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
      < "$BACKUP_FILE"
    ;;
esac

echo "[restore-db] Restore complete."
