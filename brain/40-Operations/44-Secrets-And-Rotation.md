---
title: 44 · Secrets & Rotation Runbook
type: runbook
tags: [ops, security]
status: stable
updated: 2026-06-27
source: docs/SECRETS_AND_ROTATION_RUNBOOK.md, API_KEYS.md
---

# Secrets & Rotation Runbook

> **No secret values in git, ever.** `.env*` git-ignored; only `.env.example` (placeholders) committed.
> Live values live only in the VPS `.env`. Keep a sealed offline backup. See [[43-Environment-Variables]].

## Why this matters (the trigger)
Four provider keys (Resend, Google Places, Hunter, Apollo) were live in `.env` and **appeared in
session tool logs** during go-live (never committed to git, but exposed → rotate). The VPS Postgres
password was the weak literal `content_funnel`. Cross-ref [[61-Security-Review]] C1, H3.

## Generate strong values
```bash
openssl rand -base64 32     # POSTGRES_PASSWORD (and any SESSION_SECRET placeholder)
```
(Note: `SESSION_SECRET` is not read by code yet — security L2.)

## Provider key rotation
| Key | Where | Notes |
|---|---|---|
| `RESEND_API_KEY` | resend.com → API Keys | create new, delete old. |
| `GOOGLE_PLACES_API_KEY` | console.cloud.google.com → Credentials | **restrict to Places API + server IP 62.72.16.32**. |
| `HUNTER_API_KEY` | hunter.io → API | reset key (Free = 50 searches/mo). |
| `APOLLO_API_KEY` | app.apollo.io → Settings → Integrations → API | regenerate. |
Code reads these in `lib/integrations/{resend,googlePlaces,hunter,apollo}.js` — **only the `.env` change is needed.** After rotating, update local `.env` AND VPS `.env`, then `docker compose up -d` on the VPS.

## DB password rotation (VPS, ordered)
```bash
ssh root@62.72.16.32 && cd /opt/content-checkout-funnel
scripts/backup-db.sh                                  # back up first
# inside Postgres: ALTER USER content_funnel WITH PASSWORD '<new>';
# update POSTGRES_PASSWORD in .env, then:
docker compose up -d --force-recreate content-funnel
curl -I https://dgtlmag.com/                          # health check
```
Confirm Postgres has **no host-published port**.

## Owner credentials
Created via one-time `OWNER_PASSWORD` env to `npm run create-owner` (never written to `.env`). Roles
enforced by `requireRole`: `owner`, `admin`, `sales`, `contractor`, `viewer`. [[21-Admin-Shell]]

## Production `.env` template
See the full var list in [[43-Environment-Variables]]. Required for full function:
`POSTGRES_*`, `OWNER_*`, `TEAM_SLUG=default`, `PUBLIC_APP_URL`/`NEXT_PUBLIC_APP_URL`, one Anthropic auth
var, Stripe (`SECRET`/`WEBHOOK_SECRET`/optional `PUBLISHABLE`), the four provider keys,
`TELEPHONY_PROVIDER=twilio` + `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` + `TELEPHONY_WEBHOOK_BASE_URL`,
`DEFAULT_COUNTRY_CODE=CA`, `DEFAULT_TIMEZONE=America/Toronto`, optional `OPENAI_API_KEY`/`OPENAI_MODEL`.

Up: [[40-Operations-MOC]]
