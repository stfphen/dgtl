---
title: 15 · Multi-Tenancy & Team Isolation
type: reference
tags: [architecture, tenancy]
status: stable
updated: 2026-06-27
---

# Multi-Tenancy & Team Isolation

The **core architectural invariant**: never hardcode one client, one grant source, or one service
path (see [[CLAUDE-Operating-Rules]] product priority #4). Two distinct boundaries:

## 1. Team — the ownership/security boundary
- Every `tenants`, `leads`, `contractors`, `draft_emails` row carries `team_id NOT NULL` (migration `003`). See [[13-Data-Model]].
- RBAC: `requireRole` (`lib/permissions.js`) gates admin routes; roles = `owner`/`admin`/`sales`/`contractor`/`viewer`.
- `getSessionTeamId` resolves the caller's team; queries are team-scoped.
- **⚠️ Known IDOR gaps:** `leads/enrich` and `leads/enrich-batch` use bare `getAdminSession()` without team scoping (H2). Public lead/survey endpoints trust client-supplied `tenantId`/`teamId` (M1/M2). See [[61-Security-Review]].

### The `team_default` gotcha (memorize this)
- Built-in tenants (default + funded-growth + others) register under internal **`team_default`**.
- Public-funnel and funding-scan leads are scoped to `team_default`.
- **The operating owner must be created in that team** (`TEAM_SLUG=default` in `.env`), or `/admin` shows **no built-in tenants and no funnel leads** (empty team).
- This is the #1 deploy gotcha — documented in [[41-Deployment-Runbook]]. Sprint 2 aims to remove this workaround (self-serve onboarding). See [[33-Sprint-2-Productization]].

## 2. Tenant — the brand/funnel boundary
- A tenant = a white-label config: hero, packages, theme/brand tokens, domains, telephony, checkout.
- **Resolution:**
  - By host: `getTenantForHost(host)` (`lib/store.js`) — maps `dgtlmag.com`, `funding.dgtlmag.com`, `grants.dgtlmag.com`, etc. to a tenant.
  - By slug: `getTenantBySlug` / `getTenantByIdOrSlug` (used by `/t/[slug]`).
- **Config lifecycle:** `saveTenantDraftConfig` → `publishTenantConfig`; `duplicateTenantConfig`; validated by `lib/tenantValidation.js` (`sanitizeTenantConfig`, `validateTenantConfig`).
- **Defaults:** `lib/defaultTenant.js` (`normalizeTenantConfig` fills media/routing/checkout/defaults).
- **Built-in tenants:** `lib/tenants/*` (dmtv, elixr, onHomeDecor) + funded-growth (`lib/funding/tenant.js`). See [[63-Tenants-Catalog]].

## Branding (per-tenant theming)
- `lib/branding.js` → `getTenantTheme(brand)` returns an inline CSS-var style object.
- **Brand tokens are a contract:** `--blue`, `--blue-dark`, `--accent` are injected per tenant; never override them in base/theme CSS. See [[16-Design-System]].
- PWA app icon per tenant: `lib/branding/appIcon.js` (`MAX_APP_ICON_BYTES`=512KB).

Up: [[10-Architecture-MOC]]
