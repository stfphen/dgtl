---
title: 2A · AI Tenant Builder
type: module
tags: [module, ai, tenancy]
status: stable
updated: 2026-06-27
---

# AI Tenant Builder

## Purpose
Generate a complete tenant funnel config from a natural-language prompt (and optional documents), so
a new white-label client can be spun up quickly. Keeps the no-hardcoding invariant ([[15-Multi-Tenancy]]).

## Key files
- `lib/tenantBuilder/generateTenant.js` — `generateTenantConfig({prompt, brandName, slug, documents})` + `buildTenantConfigFromModelOutput`.
  - Model is **hardcoded** to `claude-opus-4-8` (`generateTenant.js:5`) — no env override (unlike lead research).
  - `TENANT_OUTPUT_SCHEMA` (structured output), `MAX_DOCUMENTS=6`, `MAX_DOCUMENT_BYTES=25MB`.
- Runs via shared transport [[2B-AI-Backend]].
- API: `POST /api/admin/tenants/generate` (owner/admin).
- UI: `components/admin/TenantBuilder.jsx`.
- Validation: output is sanitized/validated by `lib/tenantValidation.js` before save.
- Lifecycle: generated config → draft → publish (`saveTenantDraftConfig` → `publishTenantConfig`).

## Env
Needs `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` (else `AiNotConfigured`). See [[2B-AI-Backend]].

## Related
[[2B-AI-Backend]] · [[15-Multi-Tenancy]] · [[63-Tenants-Catalog]] · [[25-Lead-Research-AI]]

Up: [[20-Modules-MOC]]
