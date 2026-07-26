---
title: 12 · Repo Structure
type: reference
tags: [architecture]
status: stable
updated: 2026-07-07
---

# Repo Structure

Canonical repo: `/Users/emery/content-checkout-funnel` (Repo 1). See [[02-Glossary]] for the
Repo-1-vs-Repo-2 distinction.

## Top-level tree
```
content-checkout-funnel/
├── app/                 # Next.js App Router (pages + API routes)  → [[14-Routes-Map]]
├── components/          # React components (funnel, admin, funding, motion)
├── lib/                 # ALL business logic (the heart of the app)
├── migrations/          # 5 SQL migrations                          → [[13-Data-Model]]
├── scripts/             # migrate, create-owner, seed, backup/restore
├── tests/               # 26 node --test files                      → [[62-Testing]]
├── docs/                # raw project docs (mapped in [[Repo-Docs-Index]])
├── prototypes/          # standalone HTML concept prototypes (not wired into the app)
├── brain/               # ← THIS VAULT
├── public/ assets/      # static assets, audio sample for telephony
├── data/                # app-store.json (JSON fallback store)
├── styles.css           # global stylesheet (~82KB)                 → [[16-Design-System]]
├── Dockerfile, docker-compose.yml, deploy.sh
├── next.config.mjs, package.json, package-lock.json
└── *.md                 # root context docs (mapped in [[Repo-Docs-Index]])
```

## `lib/` — business logic (most important folder)
| Path | What it is | Module note |
|---|---|---|
| `lib/store.js` (82KB) | The data layer. Postgres + JSON fallback; CRUD for tenants, leads, batches, contractors, drafts, outreach, calls, tasks. | [[13-Data-Model]] |
| `lib/auth.js` | Admin sessions/cookies; SHA-256 token hashing. | [[21-Admin-Shell]] |
| `lib/permissions.js` | RBAC: `requireRole`, role constants, capability checks. | [[21-Admin-Shell]] |
| `lib/users.js` | User/team management, bcrypt hashing. | [[21-Admin-Shell]] |
| `lib/audit.js` | Audit logging with secret redaction. | [[21-Admin-Shell]] |
| `lib/leadUtils.js` | Lead vocab, scoring, dedupe, filter/sort, CSV. | [[22-Lead-Pipeline]] |
| `lib/csv.js` | CSV parse + lead mapping. | [[22-Lead-Pipeline]] |
| `lib/prospecting.js` | Prospecting query builder, batch merge. | [[23-Prospecting]] |
| `lib/integrations/*` | apollo, googlePlaces, hunter, resend, providerResponse. | [[23-Prospecting]] |
| `lib/enrichment/*` | Website/social/sales-brief enrichment pipeline. | [[24-Enrichment]] |
| `lib/leadResearch/*` | AI deep-research dossier + fill-missing. | [[25-Lead-Research-AI]] |
| `lib/outreach.js`, `lib/outreachSequence.js` | Draft emails + outreach engine. | [[26-Outreach]] |
| `lib/payments/stripe.js` | Stripe checkout + webhook. | [[27-Checkout-Payments]] |
| `lib/telephony/*` | Provider-neutral phone layer (Twilio/Telnyx/mock). | [[28-Telephony]] |
| `lib/funding/*` (17 files) | The Funding Program engine. | [[29-Funding-Program]] |
| `lib/tenantBuilder/generateTenant.js` | AI tenant builder. | [[2A-Tenant-Builder]] |
| `lib/ai/*` | Shared Claude transport (claudeBackend, aiParse). | [[2B-AI-Backend]] |
| `lib/branding.js`, `lib/branding/appIcon.js` | Per-tenant theming + PWA icon. | [[15-Multi-Tenancy]] |
| `lib/defaultTenant.js`, `lib/tenants/*` | Built-in tenant configs. | [[63-Tenants-Catalog]] |
| `lib/tenantValidation.js` | Tenant config sanitize/validate. | [[15-Multi-Tenancy]] |

## `components/`
- **Public:** `FunnelPage.jsx` (renders tenant funnel + survey widget).
- **funding/:** `FundingSurveyWidget.jsx` (+ ProgressBar, QuestionStep, ResultCard, TrustNotice, `.module.css` = mobile-first reference).
- **admin/:** `AdminTabbedShell.jsx`, `CallsTable.jsx`, `DialPad.jsx`, `LeadCallPanel.jsx`, `RecordingButton.jsx`, `LeadDeepResearch.jsx`, `ResearchFromQuery.jsx`, `FillMissingButton.jsx`, `OutreachQueueBuilder.jsx`, `TenantBuilder.jsx`, `TenantBrandingSettings.jsx`, `TenantPhoneSettings.jsx`.
- **motion/:** `Reveal.jsx`, `Stagger.jsx` (reduced-motion aware).

## `scripts/`
`migrate.js`, `create-owner.js`, `seed-funding-demo.js`, `seed-tenants.js`, `backup-db.sh`, `restore-db.sh`. See [[45-Database-Backups]].

Up: [[10-Architecture-MOC]]
