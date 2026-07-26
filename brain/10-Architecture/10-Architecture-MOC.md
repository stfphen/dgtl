---
title: 10 · Architecture MOC
type: moc
tags: [moc, architecture]
updated: 2026-06-27
---

# 🏛️ Architecture MOC

How the system is built — the structural facts that rarely change.

## Notes
- [[Architecture]] — single-page overview: main components, tenant system, admin dashboard.
- [[11-Tech-Stack]] — frameworks, libraries, runtime, scripts.
- [[12-Repo-Structure]] — full directory tree with what lives where.
- [[13-Data-Model]] — Postgres tables + the 5 migrations.
- [[14-Routes-Map]] — every page and API route.
- [[15-Multi-Tenancy]] — tenant + team isolation model (the core architectural invariant).
- [[16-Design-System]] — UI tokens, dark mode, motion, mobile-first.

## The 30-second architecture
- **Next.js 15 App Router** (`app/`), **React 19** server + client components.
- **Postgres** via `pg` (`lib/store.js`), with a **JSON-file fallback** (`data/app-store.json`) for local dev with no DB.
- **All business logic in `lib/`** — routes and components stay thin. Provider SDKs (Twilio, Stripe, Anthropic, Resend) are only ever imported inside their `lib/` wrapper.
- **Two isolation boundaries:** `team_id` (ownership) and `tenant` (brand/funnel). See [[15-Multi-Tenancy]].
- **RBAC** via `requireRole` (`lib/permissions.js`); sessions are DB-backed, SHA-256-hashed tokens (`lib/auth.js`).
- **Graceful degradation everywhere** — missing API key → "not configured", app still runs.
- **Deployed** as a Docker container behind Traefik on a Hostinger VPS. See [[41-Deployment-Runbook]].

Up: [[00-Home]]
