---
title: 25 · AI Deep Research
type: module
tags: [module, ai, leads]
status: stable
updated: 2026-06-27
---

# AI Deep Research

## Purpose
Use Claude to do **web research** on a lead and produce a **structured dossier** (distinct from the
scraping-based [[24-Enrichment]]). Also "fill missing info" on a lead from provider candidates.

## Key files (`lib/leadResearch/`)
- `researchLead.js` (16KB) — two-stage Claude research:
  - **Stage A:** web search (gather).
  - **Stage B:** structured JSON output. (Structured outputs can't be combined with web search, hence two stages.)
  - Exports: `researchLead`, `buildDossierFromModelOutput`, `validateDossierShape`, `mergeDossierIntoLead`; re-exports `collectCitations`/`extractText`/`parseModelJson`.
- `dossierSchema.js` — `DOSSIER_SCHEMA` (JSON schema), `CONFIDENCE_LEVELS`, `HIGH_CONFIDENCE`, `SOCIAL_PLATFORMS`, `SIGNAL_TYPES`.
- `fillMissing.js` — `fillMissingLead({lead})`, `gatherProviderCandidates`, `planFillUpdates`; re-exports `missingFields`.
- `leadFields.js` — `FILLABLE_FIELDS`, `leadValue`, `missingFields`.

## API routes
- `POST /api/admin/leads/research` — deep research on an existing lead.
- `POST /api/admin/leads/research-from-query` — research from a free-text query.
- `POST /api/admin/leads/fill-missing` — fill gaps from provider candidates.
- UI: `components/admin/LeadDeepResearch.jsx` (confidence pills), `ResearchFromQuery.jsx`, `FillMissingButton.jsx`.

## AI backend & cost controls
Runs through the shared transport in [[2B-AI-Backend]] (`lib/ai/claudeBackend.js`).
- `LEAD_RESEARCH_MODEL` (default `claude-opus-4-8`).
- `LEAD_RESEARCH_MAX_WEB_SEARCHES` (default `8`).
- Route `maxDuration = 120` (120s).
- Needs either `CLAUDE_CODE_OAUTH_TOKEN` (subscription) or `ANTHROPIC_API_KEY` (pay-as-you-go), else a clean `AiNotConfigured` error.

## Related
[[2B-AI-Backend]] · [[24-Enrichment]] · [[2A-Tenant-Builder]] · [[43-Environment-Variables]]

Up: [[20-Modules-MOC]]
