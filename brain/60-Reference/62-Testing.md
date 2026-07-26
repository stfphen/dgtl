---
title: 62 · Testing & Verification
type: reference
tags: [reference]
status: stable
updated: 2026-06-27
source: tests/, package.json
---

# Testing & Verification

## Runner
`npm test` → `node --test tests/*.test.js` (Node's built-in test runner). Tests run against an isolated
temp JSON store (`APP_STORE_PATH`) — **no live DB or provider keys needed.** Build gate: `npm run build`.

> Historical full pass: **101/101** (PROJECT_STATUS 06-18); an earlier pass was 85/85. Re-run to get the current count.

## Test files (26) by subsystem
| Area | Files |
|---|---|
| Auth / users / audit | `auth.test.js`, `users.test.js`, `create-owner.test.js`, `audit.test.js` |
| Core / store | `core.test.js` (26KB — csv, defaultTenant, integrations, store), `branding.test.js` |
| Funding | `funding-scoring.test.js`, `funding-accuracy.test.js`, `funding-v1.test.js`, `funding-survey.test.js`, `funding-survey-normalize.test.js`, `funding-survey-ui.test.js` |
| Enrichment | `enrichment-index.test.js`, `enrichment-workflow.test.js`, `batch-enrichment.test.js`, `lead-enrichment.test.js`, `website-enrichment.test.js`, `google-auto-enrich.test.js`, `social-profiles.test.js`, `sales-brief.test.js`, `llm-brief.test.js` |
| Lead research | `lead-research.test.js`, `fill-missing.test.js` |
| Tenant builder | `tenant-builder.test.js` |
| Payments | `stripe-checkout.test.js` |
| Telephony | `telephony.test.js` (23KB) |

## Verification practice (from CLAUDE.md + go-live)
- Before marking work complete: run `npm test` + `npm run build`; report exact commands, results, and files changed. [[CLAUDE-Operating-Rules]]
- Hard deploy gate: green tests + clean build (never deploy on red). [[41-Deployment-Runbook]]
- For high-stakes work, run an **independent verification pass with a subagent** (Phase 11). [[42-Go-Live-Plan]]
- Post-deploy smoke: `/`, `/t/funded-growth`, funding subdomain, `/admin` login, one prospecting search, one outreach action, one Stripe test, one inbound call, one AI feature. [[46-Demo-Flow]]

## Gaps
- No `lint` script (use build as the gate). [[53-Known-Issues]]
- 2 moderate npm advisories outstanding.

Up: [[60-Reference-MOC]]
