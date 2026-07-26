---
title: 23 · Prospecting / Batch Builder
type: module
tags: [module, leads]
status: stable
updated: 2026-06-27
---

# Prospecting / Batch Builder

## Purpose
Find and import new prospects as leads from third-party data providers, with preview, dedupe, and
audit trails. The "Batch Builder" runs a search → previews results → imports selected → optionally
enriches.

## Key files
- `lib/prospecting.js` — `defaultApolloRoles`, `buildProspectingQuery`, `selectedPreviewResults`, `mergeBatchCounts`.
- `lib/integrations/` (provider wrappers, all via `fetch`, all degrade gracefully):
  - `googlePlaces.js` — `searchGooglePlaces({query, maxResults})`, `mapGooglePlace` (`GOOGLE_PLACES_API_KEY`).
  - `hunter.js` — `lookupHunterDomain(domain)` (`HUNTER_API_KEY`).
  - `apollo.js` — `searchApolloPeople({domain, titles})` (`APOLLO_API_KEY`).
  - `providerResponse.js` — shared shape: `providerSuccess` / `providerNotConfigured` / `providerFailure`.
- API: `/api/admin/prospecting/{google,hunter,apollo,batches,batches/import}`.
- Data: `prospecting_batches` table (query/category/city/provider, `preview_results` jsonb, counts jsonb, `enrich_hunter`/`enrich_apollo` flags). [[13-Data-Model]]

## Flow
1. Operator builds a query (e.g. `med spas + Toronto`) → provider search returns preview results.
2. Operator selects results → import as leads (dedupe applied, audit logged).
3. Optional: Google import can auto-enrich imported leads (capped) — see `maybeAutoEnrichGoogleLead` in [[24-Enrichment]].

## Provider notes / quotas
- **Google Places:** needs billing + Places permission; restrict key to Places API + server IP (`62.72.16.32`).
- **Hunter:** Free plan = **50 searches/mo**.
- **Apollo:** People API; may return partial contact data (not always direct emails/phones).
- Without a key, each route returns a clear "not configured" notice. See [[64-External-Services]].

## ⚠️ Gotchas
- Provider hardening (retries, rate limits, quota handling) is a Sprint 2 item — see [[33-Sprint-2-Productization]].
- Keys were exposed during go-live and should be rotated — see [[44-Secrets-And-Rotation]].

## Related
[[24-Enrichment]] · [[22-Lead-Pipeline]] · [[64-External-Services]] · [[43-Environment-Variables]]

Up: [[20-Modules-MOC]]
