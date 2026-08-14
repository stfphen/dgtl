---
title: 62 · Testing & Verification
type: reference
tags: [reference]
status: stable
updated: 2026-08-14
source: tests/, package.json
---

# Testing & Verification

## Runner
`npm test` → `node --test tests/*.test.js` (Node's built-in test runner). Tests run against an isolated
temp JSON store (`APP_STORE_PATH`) — **no live DB or provider keys needed.** Build gate: `npm run build`.

> Current release-checkpoint pass (2026-08-14): **407/407**. Production Next 15.5.23 build compiled,
> checked types/lint, generated 54/54 static pages, and exited 0.

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

## DGTL Core release gate
- `.github/workflows/core-release-gate.yml` produces the branch-protection-ready
  `Required DGTL Core checkpoint` result.
- `npm run validate:migrations` creates/drops a disposable localhost database, applies 001–011,
  seeds legacy fixtures, repeats 009–011, and attacks a cross-team constraint.
- `npm run rehearse:stage2` drives a representative researched CSV through canonical import,
  campaign, approval, concurrent test workers, provider event, and Activity with no external send.
- `tests/core-domain.test.js`, `tests/stage2-import-outreach.test.js`, and
  `tests/core-release-gate.test.js` are also invoked explicitly in CI before the full suite.
- `npm audit --omit=dev` reports zero vulnerabilities with lockfile overrides for patched PostCSS
  8.5.26 and Sharp 0.35.3; build/tests verify compatibility with Next 15.

## Gaps
- No separate `lint` script (Next build performs the current lint/type gate). [[53-Known-Issues]]
- The required check must still be selected in GitHub branch protection.

Up: [[60-Reference-MOC]]
