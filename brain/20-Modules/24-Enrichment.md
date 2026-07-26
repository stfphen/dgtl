---
title: 24 · Lead Enrichment
type: module
tags: [module, enrichment, leads]
status: stable
updated: 2026-06-27
---

# Lead Enrichment

## Purpose
Given a lead with a website, pull website/social/contact/signal data and produce a **sales brief**
(summary, suggested offer, caller opener, fit/confidence scores). Shipped via PR #2 (merged to `main`).

## Key files (`lib/enrichment/`)
- `index.js` — `enrichLeadContext({lead, options})` merges website + provider signals.
- `workflow.js` — ordered resumable pipeline: stages `resume-check → gather → brief` (`ENRICHMENT_WORKFLOW_STAGES`, `runLeadEnrichmentWorkflow`).
- `website.js` (16KB) — `enrichWebsite(...)` scrapes a site (5s timeout, 350KB max, 3 internal pages). **⚠️ This is the SSRF-vulnerable `fetchPage` — see below.**
- `lead.js` — `buildLeadEnrichmentUpdate`, `buildLeadEnrichmentUpdateWithOptionalLlm`, `buildLeadEnrichmentNotice`.
- `salesBrief.js` — deterministic `buildSalesBrief({lead})`.
- `llmBrief.js` — optional OpenAI brief: `buildOptionalSalesBrief`, `validateSalesBriefShape` (falls back to deterministic if no key).
- `socialProfiles.js` — `SUPPORTED_SOCIAL_PLATFORMS`, `classifySocialUrl`, `extractHandle`, `normalizeSocialUrl`.
- `batch.js` — batch enrichment (`DEFAULT_BATCH_ENRICHMENT_LIMIT=3`, `MAX=5`, stale after 30 days); `selectLeadsForBatchEnrichment`, `isLeadEnrichmentStale`.
- `googleAutoEnrich.js` — `maybeAutoEnrichGoogleLead`, `isAutoEnrichEnabled` (`DEFAULT_MAX_GOOGLE_AUTO_ENRICH=5`).
- `url.js` — `normalizeUrl`, `getDomainFromUrl`, `isHttpUrl`, `sameDomain`.
- `providers/` — `types.js` (`createProviderResult`, `hasProviderKey`) + `reviews.js`, `news.js`, `techStack.js`, `jobs.js` (each `enrich*({lead})`).

## API
- `/api/admin/leads/enrich` (single), `/api/admin/leads/enrich-batch` (batch).
- ⚠️ Both currently skip `requireRole` + team scoping (IDOR **H2**). [[61-Security-Review]]

## 🔴 SSRF (security C2 — top priority fix)
`fetchPage` in `website.js:370-382` follows redirects with **no scheme allowlist** and **no block on**
`localhost`/`127.0.0.1`/`169.254.169.254`/RFC-1918. The `websiteUrl` is attacker-controllable via the
**public unauthenticated** `POST /api/leads` and `POST /api/funding/survey`. Fix = scheme allowlist +
private-IP block + redirect validation. See [[53-Known-Issues]].

## Optional LLM brief
`OPENAI_API_KEY` (+ `OPENAI_MODEL`, default `gpt-4o-mini`) powers `llmBrief.js` only. Without it, the
deterministic brief is used. Do not enable LLM brief in production without a cost/guardrail decision ([[34-Do-Not-Start-Yet]]).

## Related
[[25-Lead-Research-AI]] (AI dossier, distinct from enrichment) · [[23-Prospecting]] · [[22-Lead-Pipeline]] · [[2B-AI-Backend]]

Up: [[20-Modules-MOC]]
