---
title: 32 · Near-Term Roadmap
type: roadmap
tags: [roadmap]
status: living
updated: 2026-06-27
source: NEXT_STEPS.md, CLAUDE.md
---

# Near-Term Roadmap

## Immediate next steps (ordered)
1. **Consolidate branches → one clean `main`.** Merge any outstanding feature/survey/telephony work
   into an integration branch, green test + build, then `main`. Prune stale branches **only with
   explicit confirmation**. [[47-Git-Workflow]]
2. **Provide / rotate keys.** Add Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) and optionally
   OpenAI; rotate the four exposed provider keys. [[44-Secrets-And-Rotation]]
3. **Deploy current code to `dgtlmag.com`.** Follow [[41-Deployment-Runbook]] (note `TEAM_SLUG=default`).
   Register the Stripe webhook `https://dgtlmag.com/api/webhooks/stripe`. Verify DNS/Traefik/TLS, smoke live.
4. **Security hardening pass** (SSRF guard, rate limiting, enrich IDOR fix). [[53-Known-Issues]]

## Roadmap status (vs CLAUDE.md's 6-item list)
1. ✅ Repo recovery & branch cleanup (redundant enrichment worktrees removed; archive retained).
2. ✅ PR #2 (AI prospect enrichment) merged into `main`.
3. ✅ Admin shell/navigation stable (`AdminTabbedShell`, now with Funding tab + mobile-first).
4. ✅ Funding Program module — V1 productized.
5. ✅ Funding connected to outreach + lead matching.
6. ⏳ **Package into a sellable B2B offer** — checkout is real (Stripe); continue with onboarding + reporting → [[33-Sprint-2-Productization]].

## Go-live phases (full plan)
The 12-phase production plan lives in [[42-Go-Live-Plan]]. Phases 4–9 can run in parallel once the app
is up and auth/DB are live.

Up: [[30-Roadmap-MOC]]
