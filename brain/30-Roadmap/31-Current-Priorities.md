---
title: 31 · Current Priorities
type: roadmap
tags: [roadmap]
status: living
updated: 2026-07-01
---

# Current Priorities

> **Read this at the start of every session.** Update it when reality changes; log changes in [[51-Timeline]].

## The one priority (from CLAUDE.md)
**Stabilize the repo before building more features.** Concretely:

1. ✅ **Repo recovery & branch cleanup — DONE 2026-07-01.** `main` = `cd0597e`, pushed to origin;
   6 merged branches deleted (all-refs bundle at `~/content-funnel-backup-2026-07-01.bundle`);
   `funding-program-docs` worktree resolved. Kept: `backup/*`/`*-wip`/`rescue/*` (possible
   unfinished work) + all remotes. Active line: `feature/portfolio-p0`. See [[51-Timeline]].
2. **Get the live site green & current.** ← **NOW THE TOP PRIORITY** — deploy `main@cd0597e`
   per `docs/DEPLOY_NEXT.md` (includes migration 006 + new env vars). `dgtlmag.com` history includes a 502 (fixed) and a VPS
   running an old snapshot. Sync VPS to `origin/main` and verify 200. See [[41-Deployment-Runbook]].
3. **Address the top security findings** before/at go-live: rotate exposed provider keys, strong DB
   password, SSRF guard, rate limiting, fix the two enrich IDOR routes. See [[53-Known-Issues]] / [[61-Security-Review]].

## Then (productization)
4. Finish packaging into a sellable B2B offer (onboarding + reporting). See [[33-Sprint-2-Productization]].

## Done (so they don't get re-litigated)
- ✅ PR #2 (AI prospect enrichment) merged to `main`.
- ✅ Funding Program V1 shipped (admin tab, matching, review checklist, outreach, closer handoff, demo seed).
- ✅ Funding connected to outreach + lead matching.
- ✅ Real Stripe checkout code.
- ✅ Telephony layer (mock + Twilio, recording/consent, Deepgram transcription, Claude summaries).
- ✅ Mobile-first UI overhaul (2026-06-26).
- ✅ Live 502 fixed (HOSTNAME=0.0.0.0 in docker-compose).

## ⚠️ Verify-before-trusting
Several repo status docs are **snapshots** (PROJECT_STATUS 06-18, RESUME_HERE 06-21) that reference
branches since superseded (`feature/funding-program-v1`, `project-worker-2`). Confirm current state
with `git status`/`git log` before acting. See [[51-Timeline]].

Up: [[30-Roadmap-MOC]]
