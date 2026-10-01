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

> Phase 1+2 merged checkpoint: **407/407** and 54/54 pages. Stage 3 adds sixteen focused tests and
> three routed pages. Final local Stage 3 gate: **423/423** and 57/57 pages.

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
- `npm run validate:migrations` creates/drops a disposable localhost database, applies 001–012,
  seeds legacy fixtures, repeats 009–012, and attacks both legacy and Artifact cross-team constraints.
- `npm run rehearse:stage2` drives a representative researched CSV through canonical import,
  campaign, approval, concurrent test workers, provider event, and Activity with no external send.
- `tests/core-domain.test.js`, `tests/stage2-import-outreach.test.js`, and
  `tests/core-release-gate.test.js` are also invoked explicitly in CI before the full suite.
- `tests/stage3-artifact-automation.test.js` covers adapter/path security, immutable context and
  versions, approval, revisions, worker leases/failures, deployment idempotency/unknown outcomes,
  exact Message attachment, independent changed-path discovery, symlink rejection, team isolation,
  and worker authentication. `npm run rehearse:stage3`
  executes the real pitch template in temporary Git worktrees and test-deploys only to
  `preview.invalid`.
- `tests/stage4-worklog-operations.test.js` (22 tests) covers connector team binding, capability
  honesty (no client-create), explicit matching, approved idempotent handoff, payload-tamper
  invalidation, ambiguous-match fail-closed, lost-response quarantine + deterministic
  reconciliation, marked task handoff with duplicate-free resume, link retire/revive/repair,
  once-only transition Activities, digest provenance pass-through, and cross-team rejection.
  `npm run rehearse:stage4` boots a **real local Worklog server** on a throwaway SQLite database
  and proves the whole path plus the failure catalogue over the real HTTP API — never against
  `office.dgtl.at`. `npm run validate:migrations` now rehearses 001–013.
- `tests/stage5-home-command-center.test.js` (17 tests) covers HOME snapshot composition,
  deterministic attention ordering, projection semantics (resolutions make items disappear),
  approval/pipeline aggregation with known-vs-unknown values, snapshot-fresh delivery, health
  states (disabled-intentionally ≠ failure), per-section degradation under hung/failing sources,
  cross-team isolation incl. search, role-filtered quick actions, empty states, and host-routing
  regression pins. `npm run rehearse:stage5` proves the projection end-to-end on disposable PG
  plus a real local Worklog.
- `tests/stage6-chat-command-layer.test.js` (25 tests) covers the static tool registry closure
  (unknown ids fail closed and are audited; `shell`/`database` rejected), strict arg validation
  (unknown keys incl. model-supplied `teamId` rejected), role-filtered advertisement AND
  execution-time re-checks, scenarios A–J (grounded answers, entity resolution via real canonical
  IDs, cross-domain analysis, follow-up/generation/handoff/next-action proposals producing only
  native draft state, prompt injection inert, hostile scripted model rejected at every layer,
  stale-proposal no-mutation, provider-failure isolation), cross-team and cross-user privacy,
  payload-hash tamper invalidation, proposal expiry, idempotent double-confirm, thread CAS
  concurrency, tool-loop budget exhaustion, input/rate limits, no chain-of-thought persistence,
  and migration-014/route source assertions. `npm run rehearse:stage6` proves scenarios A–J on
  disposable PG plus a real local Worklog using the **deterministic adapter — CI never depends on
  a live AI provider**. `npm run validate:migrations` now rehearses 001–014.
- `npm audit --omit=dev` reports zero vulnerabilities with lockfile overrides for patched PostCSS
  8.5.26 and Sharp 0.35.3; build/tests verify compatibility with Next 15.
- Worklog's SQLite WAL open has bounded `SQLITE_BUSY` retry and passed three consecutive 375/375
  startup stress runs after the first GitHub gate exposed the race.

## Gaps
- No separate `lint` script (Next build performs the current lint/type gate). [[53-Known-Issues]]
- The required check must still be selected in GitHub branch protection.

Up: [[60-Reference-MOC]]
