---
title: 00 · Home (Master MOC)
type: moc
tags: [moc, home]
status: living
updated: 2026-07-16
---

# 🏠 Home — Content Checkout Funnel

> **Read this first in every session.** This is the master Map of Content for the project brain.

## What this project is
A **multi-tenant, white-label B2B sales-funnel + admin platform** for DGTL-style creative &
marketing services, plus a **funding-readiness ("grant opportunity") engine** for Canadian
businesses. Built on **Next.js 15 / React 19 / Postgres**. See [[11-Tech-Stack]] and
[[12-Repo-Structure]].

One-line mental model: *prospects enter through tenant-branded funnels → become leads →
get enriched / researched / scored → routed into outreach, telephony, checkout, or funding
review → all tenant-scoped, permissioned, and audit-logged.*

## 🚦 Start-of-session checklist (for Claude)
1. Read [[31-Current-Priorities]] and [[53-Known-Issues]].
2. Run `git status --short --branch` (guardrails in [[47-Git-Workflow]]).
3. Skim the latest entries in [[51-Timeline]].
4. Re-read [[CLAUDE-Operating-Rules]] before any git/file mutation.
5. For module work, open the matching note in [[20-Modules-MOC]].
6. Visual overviews: [[Vault-Dashboard.base|Vault dashboard]] (note health/staleness) · [[Product-Map.canvas|Product map]] (module flow).

## 🗺️ The four maps
- 🏛️ [[10-Architecture-MOC]] — how the system is built.
- 🧩 [[20-Modules-MOC]] — what each subsystem does (deep notes).
- 🛣️ [[30-Roadmap-MOC]] — where it's going.
- ⚙️ [[40-Operations-MOC]] — how to run, deploy, and secure it.

## 📚 Supporting maps
- 📓 [[50-Audit-Log-MOC]] — history, decisions, issues, session logs.
- 🔎 [[60-Reference-MOC]] — security, testing, tenants, external services.

## ⭐ Most-referenced notes
- [[CLAUDE-Operating-Rules]] — hard guardrails (mirrors repo `CLAUDE.md`).
- [[12-Repo-Structure]] — full directory tree.
- [[13-Data-Model]] — DB tables & migrations.
- [[14-Routes-Map]] — every page + API route.
- [[43-Environment-Variables]] — every env var and what it powers.
- [[42-Go-Live-Plan]] — the 12-phase production plan.
- [[29-Funding-Program]] — the biggest/newest subsystem.

## 🧭 Status at a glance (2026-07-16)
- **Current priority:** merge `feature/platform-landing` (carries all the batch-email work); point `app.dgtlmedia.io` DNS + deploy the DGTL Growth Platform funnel (local `npm test && npm run build` gate first); deploy DGTL Group page; remaining ops items (C1/H3 rotations, pg dedupe parity). See [[31-Current-Priorities]].
- **Active branch:** `feature/platform-landing` @ `61fd3bb` (extends `feature/batch-email-sending`) — everything from the batch-sending line (send engine + claim CAS, drain, drip, signed unsubscribe/H4 fix, migration 008) **plus, all now committed:** admin DGTL reskin **complete** (`4d12dfe` base + `a1e65f5` refinements — shell, pipeline table + drawer, login, cross-tab polish), single-flight `ensureSchema` deadlock fix (`0af5777`), the full `influence-journal/` microsite (`f9aaa71`), creator-features skill + brand-icon library + `dgtl-deploy/` scaffold (`0424b0b`), **DGTL Growth Platform funnel = sole owner of `app.dgtlmedia.io`** (`e8b3166`, new `platform` template + `dgtl-platform` tenant), logo-only admin login (`f6c98f9`), Escott pitch page (`fb2ec8f`), Traefik `app.dgtlmedia.io` route fix (`b8554ec`). **Working tree clean; branch unpushed** — push from the Mac after clearing the live `.git/index.lock` (see [[53-Known-Issues]]).
- **`main`:** @ `fe2d78a` (**pushed**) — `app.dgtlmedia.io` made canonical host; ⚠️ deliberate `lib/defaultTenant.js` conflict with the platform branch — **keep the branch's version on merge** (see [[53-Known-Issues]]). DGTL Group agency page (`/t/dgtl-group`, fourth template `agency`) merged @ `4abc81f`, **not yet deployed**; dgtlgroup.io DNS not pointed. Superseded twin branch `feature/dgtl-group-page` must NOT also be merged.
- **Deploy target:** `dgtlmag.com` on Hetzner VPS `37.27.198.189` (host `DGTLapps`, Coolify edge; the Hostinger box `[retired-vps]` was offboarded 2026-07-21) — **LIVE at `main@32c9f73` (2026-07-04: template library — vertical presets, section variants, authority archetype; smoke green)**. Production tracks `main`. See `docs/DEPLOY_NEXT.md` / [[41-Deployment-Runbook]].
- **Biggest open risks:** C1 key rotation + H3 DB password (ops), pg-vs-file-store dedupe parity (HIGH), Stripe idempotency / batch-import idempotency; `npm audit` 2 moderate accepted (L6). ~~H4 unsubscribe~~ + outreach double-send **resolved 07-04**. See [[53-Known-Issues]].
- **Recently shipped:** DGTL Growth Platform funnel (`app.dgtlmedia.io`) · admin DGTL reskin (complete) · Influence Journal microsite + creator-features skill · outreach batch sending + drip ([[26-Outreach]]) · DGTL Group agency page · Template & Asset Library · DMTV Studio showcase · YouTube hero media. See [[51-Timeline]] / [[16-Design-System]] / [[63-Tenants-Catalog]].
- **Next big build:** merge `feature/platform-landing` → point `app.dgtlmedia.io` DNS + deploy platform page + drain cron → PR #2 (prospect enrichment) decision → Sprint-2 productization. See [[33-Sprint-2-Productization]].

---
*Maintained as a living document. When project reality changes, update the relevant note and add a line to [[51-Timeline]].*
