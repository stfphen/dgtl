---
title: 46 · Demo Flow & Provider QA
type: runbook
tags: [ops]
status: stable
updated: 2026-06-27
source: DEMO_FLOW.md, LIVE_DEMO_READINESS.md
---

# Demo Flow & Provider QA

A reproducible ~6–8 minute path through the product. If no DB/keys, demo steps 1–6 + 9 on seeded data
and narrate 7–8 from status.

## Prerequisites
- Postgres up with migrations + at least one seeded admin user (auth is DB-backed; `/admin` redirects without it). `docker-compose up` brings up `content-funnel-postgres`.
- Optional keys (each degrades gracefully): `GOOGLE_PLACES_API_KEY`/`HUNTER_API_KEY`/`APOLLO_API_KEY` (prospecting), `RESEND_API_KEY` (outreach), `OPENAI_API_KEY` (optional brief).

## Steps
1. **Admin login** — `/admin` → login → `AdminTabbedShell` (Dashboard / Pipeline / Prospecting / Outreach / Tenants, role-gated).
2. **Tenant page** — `/t/funded-growth`: tenant-branded hero, packages, lead-capture.
3. **Funded Growth scan** — submit the funding scan → `POST /api/leads` → `funding_scan` lead (answers in metadata).
4. **Lead appears** — Funding Scan Leads panel + Lead Pipeline; team-scoped, duplicate-aware.
5. **Funding score / match review** — `scoreFundingLead` + top-3 `matchFundingPrograms`; emphasize **human-reviewed**.
6. **Draft email** — Generate Draft Email (`/api/admin/drafts`) → personalized outreach from real data.
7. **Prospecting import** — Prospecting tab → Google/Hunter/Apollo search → import with dedupe + audit (clear "not configured" notice without keys).
8. **Enrichment** — Enrich from Website (`/api/admin/leads/enrich`) → summary + sales brief; optional Google auto-enrich; batch via `/enrich-batch`.
9. **Outreach queue** — queue a follow-up (template + sender → `/api/admin/outreach/queue`), set dates, mark replied/booked/do-not-contact; approved send needs Resend.

## Pitch (one-liner)
*"White-label B2B growth platform: each client gets a branded funnel; prospects' funding scans land in
a team-scoped pipeline; we score funding fit + surface matching programs (human-reviewed), draft
outreach, prospect from Google/Hunter/Apollo with dedupe + audit, enrich any website lead into a sales
brief, and track outreach end-to-end — all tenant-aware, permissioned, audit-logged."*

## Provider QA checklist (before live)
- **Google Places:** key + billing + quota + Places permission; `med spas + Toronto` preview → import; verify source metadata + dedupe.
- **Hunter:** key + permissions; domain search; verify not-configured when key missing.
- **Apollo:** key + People API; role keywords + company-domain; expect partial contact data.
- **Resend:** verify sender/domain externally; without key → not-configured; with key → send one approved item, confirm status + `lastContactedAt` + follow-up + history update.
- **Stripe:** test keys + `stripe listen` locally; prod dashboard webhook; verify redirect, `4242...` completes, `checkout.session.completed` 200, `metadata.order.status=paid`, replay no-op, fallback without key.

Related: [[42-Go-Live-Plan]] · [[29-Funding-Program]] · [[64-External-Services]]

Up: [[40-Operations-MOC]]
