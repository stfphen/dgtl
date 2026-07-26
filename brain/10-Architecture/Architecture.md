---
title: Architecture Overview
type: reference
tags: [architecture, moc]
status: stable
updated: 2026-06-27
source: app/, lib/, migrations/
---

# 🏛️ Architecture Overview

A single-page map of how the **Content Checkout Funnel** is built — the main components, the
tenant system, and the admin dashboard — with pointers into the deeper notes. For the structural
detail behind any section, follow the wikilinks. Hub: [[10-Architecture-MOC]].

## The 30-second model
- **Next.js 15 App Router** (`app/`) + **React 19** — pages are server components by default; API
  routes are `route.js` handlers. See [[11-Tech-Stack]] and [[14-Routes-Map]].
- **All business logic lives in `lib/`**; routes and components stay thin. Provider SDKs (Stripe,
  Twilio, Anthropic, Resend) are only imported inside their `lib/` wrapper. See [[12-Repo-Structure]].
- **Postgres** via `pg` (`lib/store.js`), with a **JSON-file fallback** (`data/app-store.json`) so
  local dev runs with no DB. See [[13-Data-Model]].
- **Two isolation boundaries** — `team_id` (ownership/security) and `tenant` (brand/funnel). This is
  the core invariant. See [[15-Multi-Tenancy]].
- **RBAC** via `requireRole` (`lib/permissions.js`); DB-backed, SHA-256-hashed session tokens
  (`lib/auth.js`). See [[21-Admin-Shell]].
- **Graceful degradation everywhere** — a missing API key resolves to "not configured" and the app
  keeps running.

## Main components

The system is organized as a **lead lifecycle**: a contact is captured by a funnel, enriched, then
worked through outreach / telephony / funding / checkout. Each stage is a module in `lib/` with a
dedicated note.

```
Funnel / Survey / Inbound call
        ↓
  LEAD PIPELINE  (capture · score · dedupe)
        ↓
  PROSPECTING    (Google Places · Hunter · Apollo)
        ↓
  ENRICHMENT     (website · social · sales brief)
        ↓
  DEEP RESEARCH  (AI dossier · fill-missing)
        ↓
  OUTREACH  |  TELEPHONY  |  FUNDING REVIEW  |  CHECKOUT
```

| Module | Core files | What it does |
|---|---|---|
| [[21-Admin-Shell]] | `lib/auth.js`, `lib/permissions.js`, `lib/users.js`, `lib/audit.js` | Sessions, RBAC, team isolation, audit logging — the operator cockpit's security layer. |
| [[22-Lead-Pipeline]] | `lib/leadUtils.js`, `lib/csv.js` | Lead capture, scoring, dedupe (email+domain+phone), filter/sort, CSV import/export. |
| [[23-Prospecting]] | `lib/prospecting.js`, `lib/integrations/*` | Batch builder pulling from Google Places / Hunter / Apollo into preview batches. |
| [[24-Enrichment]] | `lib/enrichment/*` | Async pipeline: website metadata, social profiles, LLM sales brief. |
| [[25-Lead-Research-AI]] | `lib/leadResearch/*` | Claude deep-research dossier + fill-missing-fields from the web. |
| [[26-Outreach]] | `lib/outreach.js`, `lib/outreachSequence.js` | Draft → queue → **human-approved** send via Resend; daily/per-domain caps. |
| [[27-Checkout-Payments]] | `lib/payments/stripe.js` | Server-resolved tenant+package price → Stripe Checkout; idempotent webhook fulfillment. |
| [[28-Telephony]] | `lib/telephony/*` | Provider-neutral phone layer (Twilio/Telnyx/mock): inbound routing, click-to-call, recording, transcription. |
| [[29-Funding-Program]] | `lib/funding/*` | Grant-readiness engine: survey intake → server scoring → match to Canadian programs. |
| [[2A-Tenant-Builder]] | `lib/tenantBuilder/generateTenant.js` | AI-generates a full tenant config from a prompt. |
| [[2B-AI-Backend]] | `lib/ai/*` | Shared Claude transport — subscription (Agent SDK) or API-key fallback. |

The data layer underneath all of this is `lib/store.js` (~82KB, 100+ team-scoped CRUD functions) —
see [[13-Data-Model]].

## How the tenant system works

A **tenant** is a white-label funnel config: brand tokens, hero/sections copy, packages, domains,
checkout, and telephony. Tenants are **data, never hardcoded** — product priority #4 in
[[CLAUDE-Operating-Rules]]. Full detail in [[15-Multi-Tenancy]] and [[63-Tenants-Catalog]].

**Shape** (from `lib/defaultTenant.js`): `{ id, slug, status, domains[], defaultPackageId, brand{
name, primaryColor, accentColor, logo, appIcon }, hero, problem, system, process, output, faq,
packages[]{ id, name, price, action, stripe{…} }, checkout, telephony }`. Missing fields are filled
by `normalizeTenantConfig`.

**Resolution** — two entry paths:
- **By host** (`getTenantForHost(host)` in `lib/store.js`) — the public funnel at `/` maps the
  incoming host header (`dgtlmag.com`, `funding.dgtlmag.com`, `on-homedecor.com`, …) to a tenant.
- **By slug** (`getTenantBySlug` / `getTenantByIdOrSlug`) — `/t/[slug]` renders a preview;
  `?preview=draft` renders the unpublished draft config.

**Config lifecycle:** `saveTenantDraftConfig` → `publishTenantConfig` (with `duplicateTenantConfig`
for cloning), sanitized/validated by `lib/tenantValidation.js`.

**Built-in tenants** register under the internal **`team_default`** team:
- Default "Content Day" — `lib/defaultTenant.js` (`dgtlmag.com`)
- Funded Growth — `lib/funding/tenant.js` (`funding.dgtlmag.com`)
- ON Home Decor — `lib/tenants/onHomeDecor.js` (`on-homedecor.com`) *(newest)*
- DMTV, ELiXR — `lib/tenants/{dmtv,elixr}.js`

> ⚠️ **The `team_default` gotcha:** the operating owner must be created in that team
> (`TEAM_SLUG=default`), or `/admin` shows no built-in tenants and no funnel leads. #1 deploy
> gotcha — see [[41-Deployment-Runbook]] and [[15-Multi-Tenancy]].

**Per-tenant theming:** `lib/branding.js` → `getTenantTheme(brand)` returns inline CSS-var overrides
(`--blue`, `--blue-dark`, `--accent`, `--on-blue`) injected per tenant; the PWA app icon is served
per tenant by `/branding/icon`. Brand tokens are a contract — never override them in base CSS. See
[[16-Design-System]].

## How the admin dashboard works

The admin dashboard is the **operator cockpit** at `/admin` — full security/auth detail in
[[21-Admin-Shell]].

**Shell:** `app/admin/page.jsx` is a `force-dynamic` **server component**. It checks
`getAdminSession()` (redirecting to `/admin/login` if absent), resolves the caller's team, then
**fetches all data server-side, already team-scoped**, and hands it to
`components/admin/AdminTabbedShell.jsx` (a client component). The shell is a tabbed UI with a
mobile "More" overflow sheet, dark-mode toggle, and reduced-motion-aware framer-motion.

```
app/admin/page.jsx (server)
  ├─ getAdminSession()            → redirect to /admin/login if null
  ├─ getSessionTeamId(session)    → scope every query to team_id
  ├─ listLeads/listCalls/…({ teamId })
  └─ <AdminTabbedShell …>         (client)
         └─ tabs render forms POSTing to /api/admin/*  → redirect + refresh
```

**Tabs** (each gated by role): Dashboard · Pipeline · Prospecting · Outreach · Tenants · Funding ·
Calls — wiring each admin panel to the matching module above. Mutations POST to `/api/admin/*`,
which re-check `requireRole`, write through `lib/store.js`, log via `lib/audit.js`, and redirect back
to `/admin`.

**Security properties** (verified in [[61-Security-Review]]): bcrypt cost 12; 32-byte session tokens
stored only as SHA-256; `httpOnly`/`secure`/`sameSite` cookies; parameterized SQL; audit-log secret
redaction; most admin routes enforce `requireRole`.

> ⚠️ **Open issues:** no rate limiting anywhere (no `middleware.ts`); `leads/enrich` +
> `leads/enrich-batch` skip team scoping (IDOR, H2); public `/api/leads` + `/api/funding/survey`
> trust client-supplied `tenantId`/`teamId` (M1/M2) and the survey has an SSRF vector (C2). Tracked
> in [[53-Known-Issues]] and [[61-Security-Review]].

## Persistence & data model

`lib/store.js` is the only data layer — Postgres when `DATABASE_URL` is set, otherwise the
`data/app-store.json` fallback. **Every business table carries `team_id NOT NULL`** (since migration
`003`) — the multi-tenancy security boundary. Core entities: `tenants`, `leads`, `contractors`,
`users`, `teams`, `team_memberships`, `sessions`, `prospecting_batches`, `outreach_*`, `calls`,
`call_events`, `tasks`, `draft_emails`, `audit_logs`. Full schema + the 5 migrations: [[13-Data-Model]].

## External integrations

All provider calls are wrapped in `lib/` and degrade gracefully when their key is absent: **Google
Places / Hunter / Apollo** (prospecting), **Resend** (outreach + webhook events), **Stripe**
(checkout + webhook), **Twilio/Telnyx** (telephony), **Claude** (research/enrichment/tenant-gen, via
subscription token *or* API key), **Deepgram** (optional transcription). Catalog + env vars:
[[64-External-Services]] and [[43-Environment-Variables]].

## Related
[[10-Architecture-MOC]] · [[11-Tech-Stack]] · [[12-Repo-Structure]] · [[13-Data-Model]] ·
[[14-Routes-Map]] · [[15-Multi-Tenancy]] · [[16-Design-System]] · [[20-Modules-MOC]]

Up: [[10-Architecture-MOC]]
