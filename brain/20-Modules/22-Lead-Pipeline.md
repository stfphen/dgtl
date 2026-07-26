---
title: 22 · Lead Pipeline
type: module
tags: [module, leads]
status: stable
updated: 2026-06-27
---

# Lead Pipeline

## Purpose
The lead acquisition control center: capture leads from every source, then search, filter, sort,
edit, score, dedupe, and export them. Product priority #2 — must never regress ([[CLAUDE-Operating-Rules]]).

## Lead sources (`source_type`)
- Public funnel (`/api/leads`), funding scan (`/api/funding/survey` → `funding_scan`), prospecting import, inbound call (`inbound_call`), CSV import.

## Key files
- `lib/store.js` — CRUD: `createLead`, `listLeads`, `getLeadById`, `updateLead`, `updateLeadStatus`, `updateLeadResearch`, `mergeLeadMetadata`. Team-scoped.
- `lib/leadUtils.js` — the brain of the pipeline:
  - Vocab: `pipelineStatuses`, `outreachStatuses`, `enrichmentStatuses`, `leadSources`.
  - `normalizeLeadInput`, `withLegacyAliases`.
  - `scoreLead` — deterministic lead scoring.
  - `findDuplicateCandidates` / `shouldSkipReliableDuplicate` / `decorateLeadsWithDuplicates` — dedupe.
  - `filterAndSortLeads` / `sortLeads` — pipeline table.
  - `leadsToCsv` + URL/phone normalizers.
- `lib/csv.js` — `parseCsv`, `leadFromCsvRecord(record, tenantId)`.
- Admin UI: lead table + detail editor in `app/admin/page.jsx` (advanced fields collapse on mobile — see [[16-Design-System]]).

## Pipeline fields
Contact info, `pipeline_status`, `enrichment_status`, `outreach_status`, `lead_score`, `source_type`,
follow-up timestamps, telephony fields (`assigned_to_user_id`, `do_not_call`, `do_not_contact`,
`consent_source`, `phone_country`), `metadata` (jsonb — holds funding scan answers, research dossier, etc.).

## Capabilities
Search across business/contact/website/city/category/notes · filters + sorting · inline detail editing ·
duplicate indicators · scoring · filtered CSV export · CSV import.

## ⚠️ Gotchas
- Public `/api/leads` lets clients set internal fields (`pipelineStatus`, `leadScore`, `assignedTo`, `tenantId`, `teamId`) — security M1/M2. [[61-Security-Review]]
- Leads are team-scoped — remember the `team_default` rule for funnel leads ([[15-Multi-Tenancy]]).

## Related
[[23-Prospecting]] · [[24-Enrichment]] · [[26-Outreach]] · [[29-Funding-Program]] · [[13-Data-Model]]

Up: [[20-Modules-MOC]]
