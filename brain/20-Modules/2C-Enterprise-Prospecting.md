---
title: 2C · Enterprise Prospecting (account-based)
type: module
tags: [module, leads, abm, mvp]
status: mvp-built
updated: 2026-06-29
---

# Enterprise Prospecting (account-based) — MVP BUILT

> **MVP shipped to the working tree (2026-06-29), runs offline end-to-end.** Built at the operator's
> explicit direction (overriding the earlier "proposed/do-not-start" hold). Still requires, on a real
> machine: `npm run migrate` (applies migration 006) and `npm run build` (the sandbox can't run SWC).
> Full design in `docs/specs/enterprise-prospecting-module-spec.md`; strategy in
> `docs/specs/enterprise-prospecting-playbook.md`; the engineered prompt in
> `docs/prompts/enterprise-prospecting-master-prompt.md`.

## What shipped (MVP)
- **Data:** `migrations/006_enterprise_prospecting.sql` (`target_accounts`, `account_campaigns`) + inline
  bootstrap DDL + JSON-store keys (`targetAccounts`, `accountCampaigns`) in `lib/store.js`; team-scoped
  CRUD (`createTargetAccount`/`listTargetAccounts`/`getTargetAccountById`/`updateTargetAccount`,
  `createAccountCampaign`/`listAccountCampaigns`/`updateAccountCampaign`).
- **Orchestration:** `lib/enterpriseProspecting/` — `gates.js` (state machine), `accountFit.js`
  (deterministic ICP scoring/tiering), `campaignScope.js` (concept builder), `mockSourcing.js`
  (offline demo accounts + dossier), `contacts.js` (Gate-2 → lead promotion), `index.js`.
- **API:** `/api/admin/accounts` (GET list, POST import), `/api/admin/accounts/search` (POST preview),
  `/api/admin/accounts/action` (POST: score | approve[Gate1] | research | scope | approve-campaign[Gate2]).
  All `requireRole` + team-scoped + team-context guard + audit-logged.
- **UI:** `components/admin/AccountsPanel.jsx` + new "Accounts" tab (`AdminTabbedShell` + `app/admin/page.jsx`).
- **Demo:** `scripts/seed-enterprise-demo.js` (`npm run seed:enterprise-demo`) — 6 fictional accounts.
- **Tests:** `tests/enterprise-prospecting.test.js` — 21 tests (gates, scoring, scoping, contacts,
  store CRUD, full gate→lead flow). All pass. Lead source `enterprise_prospect` added to `lib/leadUtils.js`.
- **Contacts link to leads via `lead.metadata.accountId`** (not a `leads.account_id` column) — MVP choice
  to avoid touching the lead normalizer; reuses the whole pipeline. Source type `enterprise_prospect`.

## Real data sourcing (wired 2026-06-29)
- **Search** = `sourceAccountPreviews()` (`lib/enterpriseProspecting/sourcing.js`) composes **SEC EDGAR**
  (`lib/integrations/secEdgar.js`, no key), **OpenCorporates** (`lib/integrations/openCorporates.js`,
  `OPENCORPORATES_API_TOKEN` optional), and **Google Places** — deduped, fit-scored, **falls back to
  mock** when nothing is configured/returned. Used by `/api/admin/accounts/search`.
- **Research** (Gate-1-gated) = `enrichAccountContacts()` uses **Apollo** (people) + **Hunter** (emails)
  + **EDGAR firmographics**, plus **Claude** (`researchLead`) for signals — all graceful, offline fallback.
- Env: `SEC_EDGAR_USER_AGENT` (recommended), `OPENCORPORATES_API_TOKEN` (optional), `APOLLO_API_KEY` +
  `HUNTER_API_KEY` (set), AI key for real research (not set → offline). 31 tests total (21 + 10 sourcing).

## Still to do (post-MVP)
- Run `npm run migrate` + `npm run build` on a real machine; smoke the Accounts tab in `/admin`.
- **Before real sends:** rotate the exposed provider keys (C1) + verify the Resend sender domain. Outreach stays manual/human-approved by decision.
- Quota care: Hunter free = 50/mo; EDGAR/OpenCorporates accounts have no domain → Apollo/Hunter need a domain (operator can add one).

## Purpose
An account-based (ABM) orchestration layer on top of the existing lead lifecycle for pursuing
**enterprise (1000+)** and **mid-market (200–1000)** companies with **high-ticket, bespoke creative
campaigns**. Runs *account-first* (find right accounts → map buying committee → time with signals →
scope a campaign) instead of contact-first, with **three manual approval gates** before anything
reaches the human-approved outreach queue.

## Design principle — extend, don't fork
Reuses Batch Builder ([[23-Prospecting]]), AI Deep Research ([[25-Lead-Research-AI]]), Enrichment
([[24-Enrichment]]), and Outreach ([[26-Outreach]]). Net-new = two tables + a thin orchestration lib +
an Accounts tab. Honors all standing guardrails (team-scoped, no hardcoding, mock-first, graceful
degradation, **outreach human-approved only**).

## New concepts
- **Target Account** — a company (not a person); tier (1/2/3), `fit_score`, firmographics, gate status.
- **Account Campaign** — a scoped creative concept (big idea, deliverables, budget band, opener).
- **Three gates** — Gate 1 approve accounts+tier; Gate 2 verify contacts + approve campaign; Gate 3 =
  existing human send-approval.

## Planned data (migration 006 — proposed)
- `target_accounts` (team-scoped; `gate_status` state machine; `dossier` jsonb).
- `account_campaigns` (FK → target_accounts).
- `leads.account_id` (nullable FK) links committee contacts to their account — reuses the whole lead pipeline.

## Planned API (proposed)
`/api/admin/accounts/{search,import,score,[id]/approve,[id]/research,[id]/scope,[id]/approve-campaign}`
— all `requireRole` + team-ownership (must not repeat enrich IDOR H2). Gate 3 = existing
`/api/admin/outreach/queue/send`.

## Sourcing & compliance
- Accounts/firmographics: **open DBs** (OpenCorporates, SEC EDGAR, Companies House — free, no emails).
- Contacts: **Apollo/Hunter** (existing); Google Places for local/mid-market.
- Timing/personalization: **SEO/intent signals** (tech stack, job posts, funding, launches, SEO gaps).
- **LinkedIn: no scraping.** ToS §8.2 prohibits it; *hiQ* = not-a-CFAA-crime but still a ToS breach;
  LinkedIn sues/bans (Proxycurl shut down 2025). Official API + manual research only. Decision logged
  in [[52-Decision-Log]].

## AI & cost
Through [[2B-AI-Backend]]; reuse `LEAD_RESEARCH_MODEL` / `LEAD_RESEARCH_MAX_WEB_SEARCHES`; add cheap
`ACCOUNT_FIT_MAX_WEB_SEARCHES=3` triage pass.

## Gotchas / risks
- Provider quota burn (Hunter free = 50/mo) → Gate 1 before sourcing; Tier-1 cap.
- Fabricated contacts → `email_status` labels + Gate 2 verification; never queue unverified.
- Scope creep before stabilization → status stays **proposed**.

## Related
[[23-Prospecting]] · [[25-Lead-Research-AI]] · [[24-Enrichment]] · [[26-Outreach]] · [[22-Lead-Pipeline]] ·
[[13-Data-Model]] · [[34-Do-Not-Start-Yet]]

Up: [[20-Modules-MOC]]
