---
title: 45 · Database Backups & Restore
type: runbook
tags: [ops]
status: stable
updated: 2026-06-27
source: DEPLOY_HOSTINGER.md, scripts/
---

# Database Backups & Restore

> **Rule:** back up Postgres **before every redeploy, migration, or VPS maintenance.** The Docker
> volume persists DB files, but an explicit dump is the safety net. ([[CLAUDE-Operating-Rules]])

## Scripts
- `scripts/backup-db.sh` — timestamped dump.
- `scripts/restore-db.sh` — guarded restore.

## Backup
```bash
cd /opt/content-checkout-funnel
scripts/backup-db.sh
# → backups/content_funnel_<UTC-timestamp>.dump   e.g. content_funnel_20260615T180000Z.dump
```
Stored in `/opt/content-checkout-funnel/backups/`.

## Restore
```bash
cd /opt/content-checkout-funnel
RESTORE_CONFIRM="restore content_funnel" scripts/restore-db.sh backups/content_funnel_<ts>.dump
```
- `restore-db.sh` runs `pg_restore --clean --if-exists` for `.dump`, `psql` for `.sql`.
- It **refuses to run** unless `RESTORE_CONFIRM` matches the target DB name.
- ⚠️ Test restores on a non-production copy before major migrations. *A backup that hasn't been restored successfully is not proven.*

## Cadence (Phase 12 / [[42-Go-Live-Plan]])
Set scheduled DB backups as part of launch hardening.

Up: [[40-Operations-MOC]]
