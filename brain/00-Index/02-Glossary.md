---
title: 02 · Glossary & Naming Map
type: reference
tags: [meta, glossary]
updated: 2026-06-27
---

# Glossary & Naming Map

Domain terms, internal jargon, and the **easily-confused names** that have caused mix-ups.

## ⚠️ The three things that look alike (confirm before touching anything)
| Thing | Path / location | What it is | Role |
|---|---|---|---|
| **Repo 1 — CANONICAL** | `/Users/emery/content-checkout-funnel` | The real production build (Next.js 15, real integrations, git, half-deployed to dgtlmag.com). | **All work happens here. Deploy this.** |
| **Repo 2 — REFERENCE ONLY** | `/Users/emery/Claude/Projects/content-checkout-funnel` | A "V2" clean rewrite: Next.js 14, TypeScript strict, **mock-only**, no git. Good specs. | Architecture reference. **Do not deploy. Do not split effort.** |
| **Funding survey widget** | feature branches in Repo 1 | Public survey funnel for `funding.dgtlmag.com` / `grants.dgtlmag.com`. | Must be on the deployed branch or it won't exist in the build. |

> Repo 2's `CLAUDE.md` says "no real auth/db/payment/email/APIs until Milestone 8" — that guardrail
> is about **Repo 2 only**. This vault and all production-hardening work target **Repo 1**.

## Core domain terms
- **Tenant** — a white-label brand/funnel config (hero, packages, theme, domains). Stored in `tenants` table / built-in JS configs. See [[15-Multi-Tenancy]] and [[63-Tenants-Catalog]].
- **Team** — the ownership/isolation boundary. Every tenant, lead, contractor, draft is `team_id`-scoped. The built-in tenants live under **`team_default`** (slug must be `default`).
- **Lead** — a captured prospect (from funnel, funding scan, prospecting import, inbound call, or CSV).
- **Funding Scan / Funding Fit Scan** — the public funding-readiness intake form; produces a `funding_scan` lead. See [[29-Funding-Program]].
- **Funding Lane** — one of 8 scored opportunity categories (digital_adoption, ecommerce_growth, export_marketing, creative_tech, clean_tech, workforce_training, public_procurement, market_expansion).
- **Enrichment** — pulling website/social/contact/signal data onto a lead. See [[24-Enrichment]].
- **Deep Research** — AI (Claude) web research producing a structured dossier on a lead. See [[25-Lead-Research-AI]].
- **Outreach Queue** — human-approved-only send pipeline (templates → queue → Resend). See [[26-Outreach]].
- **Routing mode (telephony)** — how inbound calls are directed; only `single_rep` is implemented. See [[28-Telephony]].
- **Closer handoff** — a summary packet handed from setter to closer for a funding lead.

## Recurring conventions
- **"Phase N"** in repo docs maps to feature areas: Phase 2/3=team auth+owner, 4=AI, 5=Stripe, 6=Resend email, 7=telephony, 10=secrets, 12=launch hardening. See [[42-Go-Live-Plan]].
- **E.164 / +1 only** — phone normalization currently supports US/Canada only.
- **"Graceful degradation"** — every external integration reports "not configured" and the app keeps working when its key is absent.
- **`requireRole`** — the RBAC guard wrapping admin/telephony routes. Roles: `owner`, `admin`, `sales`, `contractor`, `viewer`.

## Key infra constants
- **VPS:** `62.72.16.32` (Hostinger, Ubuntu, Docker, Traefik on 80/443).
- **Domain:** `dgtlmag.com` (+ `www`, `funding`, `grants` subdomains).
- **Ports:** dev `8088`, container/prod `3000` (Traefik loadbalancer label = 3000).
- **DB:** Postgres service `content-funnel-postgres`; default team id `team_default`.

Up: [[00-Home]]
