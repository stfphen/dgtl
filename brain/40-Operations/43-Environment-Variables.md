---
title: 43 · Environment Variables
type: reference
tags: [ops]
status: stable
updated: 2026-06-27
source: .env.example, API_KEYS.md, GO_LIVE_PLAN.md
---

# Environment Variables

> **No secret values live in git.** `.env`, `.env.local`, `.env.*` are git-ignored; only
> `.env.example` (placeholders) is committed. Production values live only in the VPS
> `/opt/content-checkout-funnel/.env`. See [[44-Secrets-And-Rotation]].

## Database & identity
| Var | Powers | Notes |
|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Private Postgres | Compose builds `DATABASE_URL` from these. Strong generated password (`openssl rand -base64 32`). |
| `DATABASE_URL` | App → Postgres | If unset, app uses JSON fallback (`data/app-store.json`) — local dev only. |
| `OWNER_EMAIL` / `OWNER_NAME` / `TEAM_NAME` | First owner | Used by `npm run create-owner`. |
| `TEAM_SLUG` | Owner's team | **MUST be `default`** so owner sees built-in tenants + funnel leads. [[15-Multi-Tenancy]] |
| `OWNER_PASSWORD` | One-time owner seed | Passed inline to `create-owner`; never written to `.env`. |
| `SESSION_SECRET` | Session signing | ⚠️ Referenced in docs but **not actually read by code yet** (security L2). |
| `PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_URL` | App origin | `https://dgtlmag.com`. |

## AI (pick one path)
| Var | Powers | Notes |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude subscription path (preferred) | No per-token billing; needs CLI in container. [[2B-AI-Backend]] |
| `ANTHROPIC_API_KEY` | Claude pay-as-you-go / fallback | |
| `LEAD_RESEARCH_MODEL` | Research model | default `claude-opus-4-8`. |
| `LEAD_RESEARCH_MAX_WEB_SEARCHES` | Cost cap | default `8`. |
| `OPENAI_API_KEY` (+ `OPENAI_MODEL`) | Optional LLM sales brief only | default model `gpt-4o-mini`; graceful fallback. [[24-Enrichment]] |

## Payments
`STRIPE_SECRET_KEY` (`sk_test_`/`sk_live_`), `STRIPE_WEBHOOK_SECRET` (`whsec_`), `STRIPE_PUBLISHABLE_KEY` (optional). [[27-Checkout-Payments]]

## Media library (all optional — defaults shown)
| Var | Powers | Notes |
|---|---|---|
| `MEDIA_STORAGE_PROVIDER` | Storage backend for uploads | default `local` (`public/uploads/`); S3 provider slots in later. [[2D-Portfolio-Media]] |
| `MEDIA_UPLOAD_DIR` | Local provider root override | default `<cwd>/public/uploads`; the test seam (mirrors `APP_STORE_PATH`). |
| `MEDIA_MAX_UPLOAD_BYTES` | Upload size cap | default 10 MB. |
| `YOUTUBE_API_KEY` | YouTube Data API v3 for resolving `@handle`//`user/` channel links in the hero-video picker | Optional — without it, resolution falls back to an SSRF-guarded fetch of the public channel page (works today; the API path is the stable one). `/c/` custom URLs always use the page fallback. [[2D-Portfolio-Media]] |

⚠️ Deploy: `next.config.mjs` uses `output:"standalone"` — `public/` is snapshotted at build, so runtime uploads need `public/uploads` mounted as a **volume** in the container until the S3 provider ships.

## Prospecting / email providers (the four exposed keys — rotate)
`RESEND_API_KEY` (outreach send), `GOOGLE_PLACES_API_KEY` (restrict to Places API + IP 62.72.16.32),
`HUNTER_API_KEY` (Free=50/mo), `APOLLO_API_KEY`. Read in `lib/integrations/{resend,googlePlaces,hunter,apollo}.js`. [[44-Secrets-And-Rotation]]

## Outreach batch sending (2026-07-04)
- `RESEND_FROM` — verified Resend sender used as the default From when a queue item has no explicit sender. Real sending requires a domain verified in Resend (SPF/DKIM/DMARC) before any real prospect send.
- `OUTREACH_DRY_RUN=true` — forces the **mock** email provider for ALL sends (records `sent` + events + a `dryrun_*` id, no real email). Opt-in only; also settable per-campaign via `testMode`. Never auto in prod. `lib/integrations/{emailProvider,mockEmailProvider}.js`.
- `OUTREACH_CRON_TOKEN` — bearer token the scheduled-send drain requires. Host cron: `POST /api/cron/outreach/drain` with `Authorization: Bearer $OUTREACH_CRON_TOKEN` (constant-time check). See [[41-Deployment-Runbook]].
- `UNSUBSCRIBE_SECRET` — HMAC key for signed one-click unsubscribe links; falls back to `SESSION_SECRET`. `lib/outreach/unsubscribe.js`. [[26-Outreach]]

## Telephony
`TELEPHONY_PROVIDER` (`twilio` default; `mock`/`telnyx`), `TELEPHONY_WEBHOOK_BASE_URL` (byte-exact;
falls back to `NEXT_PUBLIC_APP_URL`), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (also signature verify),
reserved `TWILIO_API_KEY`/`TWILIO_API_SECRET`/`TWILIO_WEBHOOK_SECRET`, `DEFAULT_COUNTRY_CODE=CA`,
`DEFAULT_TIMEZONE=America/Toronto`, `DEEPGRAM_API_KEY`, `DEEPGRAM_MODEL` (default `nova-3`),
`TELEPHONY_ALLOW_MOCK=1` (auto-mock). [[28-Telephony]]

## Status snapshot (from API_KEYS.md)
- **Present in local `.env`:** the four provider keys (Resend/Google/Hunter/Apollo), `DATABASE_URL`.
- **Empty / you must provide:** Stripe keys (required for live checkout), OpenAI (optional).
- **On VPS:** re-add all provider keys; verify Resend sender/domain.

Up: [[40-Operations-MOC]]
