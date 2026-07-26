---
title: 42 · Go-Live Plan (12 phases)
type: runbook
tags: [ops, roadmap]
status: living
updated: 2026-06-27
source: GO_LIVE_PLAN.md
---

# Go-Live Plan (12 phases)

Owner: FAYELLA. Target: `dgtlmag.com` (VPS 62.72.16.32). The master ops checklist to go from
half-deployed to fully live with roles, AI, payments, email, telephony, and the funding survey.
Phases are dependency-ordered; 4–9 can run in parallel once the app + auth/DB are live.

| Phase | Goal | Key actions | Module/Note |
|---|---|---|---|
| **0** | Repo consolidation & branch hygiene | Lock Repo 1 canonical; merge funding-survey + telephony → integration → `main`; prune stale branches **only with confirmation**; green test+build. | [[47-Git-Workflow]] |
| **1** ← start | Restore live site (fix 502) | SSH VPS; `docker compose ps`/logs; bring up postgres then app; confirm on `traefik-public`, port label 3000; back up DB first. **Done = `curl -I https://dgtlmag.com/` → 200.** | [[41-Deployment-Runbook]] |
| **2** | Database live | Strong `POSTGRES_PASSWORD`; migrations 001–005; create owner with **`TEAM_SLUG=default`**; prove backup/restore + cadence. | [[13-Data-Model]] / [[45-Database-Backups]] |
| **3** | Auth, roles & live creds | Strong `SESSION_SECRET` + owner password (no defaults); verify `requireRole` guards; create team accounts. | [[21-Admin-Shell]] |
| **4** | Claude / AI features | Pick `CLAUDE_CODE_OAUTH_TOKEN` (subscription) **or** `ANTHROPIC_API_KEY`; verify Tenant Builder + Deep Research + Fill-missing; set model + web-search cap. | [[2B-AI-Backend]] |
| **5** | Payments (Stripe live) | `sk_live_` key; register webhook `https://dgtlmag.com/api/webhooks/stripe` for `checkout.session.completed`; paste `whsec_`; test `4242...`; confirm `metadata.order.status=paid`, replay no-op, graceful fallback. | [[27-Checkout-Payments]] |
| **6** | Email & outreach (Resend) | Verify sender domain (SPF/DKIM/DMARC on dgtlmag.com); match `/admin` sender; validate suppression/unsubscribe, caps; send a real batch. | [[26-Outreach]] |
| **7** | Telephony / call forwarding | Buy +1 number; Voice → `/api/telephony/inbound`, status → `/status` (URLs byte-exact w/ `TELEPHONY_WEBHOOK_BASE_URL`); set SID/token; admin Phone Settings: enable, number, routing, per-rep + fallback; keep `recordingEnabled=false` until consent. | [[28-Telephony]] |
| **8** | Prospecting providers QA | Live-validate Google (billing/quota/Places), Hunter (Free 50/mo), Apollo (People API); preview batch + import; verify source metadata, dedupe, not-configured behavior. | [[23-Prospecting]] |
| **9** | Frontend: survey + funnels live | Deploy from a branch with the survey; add `funding`/`grants` A records; verify `getTenantForHost`; smoke survey, CTA, funnels, package→checkout→confirmation with white-label theming. | [[29-Funding-Program]] |
| **10** | Secrets hygiene & rotation | Rotate the four provider keys; confirm `.env*` git-ignored (only `.env.example` committed); restrict Google key to Places API + server IP; restart stack. | [[44-Secrets-And-Rotation]] |
| **11** | Full verification & smoke | Hard gate `npm test` + `npm run build`; post-deploy smoke on `/`, `/t/funded-growth`, funding subdomain, `/admin`, one prospecting search, one outreach action, one Stripe test, one inbound call, one AI feature; address 2 moderate npm advisories; independent subagent verification. | [[62-Testing]] |
| **12** | Launch hardening & ops | Uptime monitor (would catch the next 502), scheduled DB backups, log-review routine, incident + rollback runbook, confirm LetsEncrypt auto-renew. Then Sprint 2. | [[33-Sprint-2-Productization]] |

## Guardrails (do not violate)
Never delete/reset/force-push/clean without confirmation · `git status` before edit, test+build before
commit/deploy · back up Postgres before every redeploy/migration · outreach human-approved only · never
commit secrets (live values only on VPS) · keep work in Repo 1. See [[CLAUDE-Operating-Rules]].

## Needs FAYELLA's hands (cannot automate from here)
Issuing/pasting live secrets in third-party dashboards: Stripe live keys + webhook, Anthropic token,
Twilio number purchase + SID/token, Resend domain DNS verification, key rotations. Everything else
(diagnosis, code, config, deploy commands, verification) can be driven with VPS access.

Up: [[40-Operations-MOC]]
