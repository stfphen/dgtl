---
title: 47 · Git Workflow & Branch Landscape
type: runbook
tags: [ops]
status: living
updated: 2026-06-27
source: CLAUDE.md, git
---

# Git Workflow & Branch Landscape

## 🔒 Hard guardrails (repeat for emphasis)
- **Never** delete worktrees, reset branches, force-push, or clean files **without explicit user confirmation.**
- `git status --short --branch` **before editing.**
- `npm test` + `npm run build` **before committing/deploying.**
- Prefer small branches + small commits. Never edit the same files in multiple worktrees at once.
- Use **one integration branch** for merging feature work. GitHub `origin/main` is the source of truth.
- Back up before destructive ops: branches → `git bundle` / backup bundle; DB → `backup-db.sh`.

## Branch landscape (snapshot 2026-06-27 — verify with `git branch -a`)
**Current line:** `main` (tracks `origin/main`); recent tip = mobile-first UI overhaul merge.

**Local feature branches:**
`feature/funded-growth-engine`, `feature/funding-program-docs`, `feature/google-prospecting-json-wip`,
`feature/hunter-prospecting-json-wip`, `feature/mobile-first`, `feature/outreach-sequence-v1`,
`feature/outreach-sequence-v1-clean`, `feature/per-tenant-app-icon`, `feature/prospecting-panel-wip`,
`feature/tenant-workflow-wip`, `funding-survey-feature`.

**Backup branches:** `backup/feature-lead-pipeline-batches-local`, `backup/funded-growth-engine-local-20260617-2245`, `backup/lead-pipeline-batches-with-admin-ui`, `backup/local-main-docs-b9cb16d`.

**WIP / rescue:** `rescue/tenant-builder-wip`, `wip/admin-mobile-lead-detail`.

**Remote branches:** `origin/main`, `origin/funding-survey-feature`, `origin/feature/funded-growth-engine`, `origin/feature/funded-growth-engine-v2`, `origin/feature/prospect-enrichment-integration` (= the "PR #2 AI prospect enrichment", merged), `origin/claude/demo-results-review-pjspkk`, `origin/claude/mobile-first-redesign-rzgotz`.

> This branch sprawl is exactly the "stale branches cause confusion" problem flagged in CLAUDE.md.
> Phase 0 goal = consolidate to one clean deployable line, prune **only with confirmation**. [[42-Go-Live-Plan]]

## Uncommitted state (snapshot 2026-06-27)
`M lib/store.js`, `M scripts/seed-tenants.js`, untracked `.claude/settings.local.json`, `docs/prompts/`,
`lib/tenants/onHomeDecor.js`. (Verify before any commit.)

## Recent commit themes (newest → older)
1. Mobile-first overhaul (nav cap + More sheet, table→card stacking, collapsed lead fields, pinned funding checklist, audit).
2. Telephony (dialpad, owner-gated call delete, Deepgram transcription + Claude summary, recording proxy, mock provider + lifecycle).
3. Branding/PWA (per-tenant app icon, DM lightning default).
4. Deploy/Docker (non-root node user for the Agent SDK CLI, env forwarding, bind 0.0.0.0 for Traefik).
5. Funding Program V1 (reskin, DMTV+ELiXR tenants + seed, survey, scoring accuracy, Stripe merge).

## History pointers
Full chronological story: [[51-Timeline]]. Key decisions: [[52-Decision-Log]].

Up: [[40-Operations-MOC]]
