---
title: CLAUDE Operating Rules
type: guide
tags: [meta, guardrails]
status: stable
updated: 2026-06-27
source: repo CLAUDE.md
---

# CLAUDE Operating Rules

Mirrors and expands the repo's `CLAUDE.md`. **These override default behavior — follow exactly.**

## Project identity
Marketing Agency / Content Checkout Funnel for DGTL-style creative & B2B marketing services.
Includes: tenant-based sales funnels, admin dashboard, lead pipeline, prospecting, outreach,
batch builder, checkout/service-package flows, and the Funding Program / grant-opportunity engine.

## Current priority
**Stabilize the repo before building more features.** See [[31-Current-Priorities]].

## 🔒 Git guardrails (hard rules)
- **Never** delete worktrees, reset branches, force-push, or clean files **without explicit user confirmation.**
- Before editing: run `git status --short --branch`.
- Before committing: run tests/build if available.
- Prefer small branches and small commits.
- Never edit the same files in multiple worktrees at once.
- Use **one integration branch** for merging feature work.
- Full branch landscape + workflow: [[47-Git-Workflow]].

## ✅ Verification (before marking work complete)
- Run `npm test` if available.
- Run `npm run build` if available.
- Report the exact commands and results, and the files changed.
- For high-stakes work, run an independent verification pass (subagent). See [[62-Testing]].

## Product priorities (ordered, do not regress)
1. Keep admin navigation working.
2. Preserve lead pipeline, prospecting, outreach, batch builder, and checkout.
3. Keep tenant-aware architecture.
4. Avoid hardcoding one client, one grant source, or one service path.
5. Prefer mock data first, then real integrations.

## Near-term roadmap (ordered)
See [[32-Near-Term-Roadmap]] for the live version. Source ordering:
1. Repo recovery and branch cleanup.
2. Merge or close PR #2 (AI prospect enrichment) — *done; merged into `main`.*
3. Stabilize admin shell / navigation.
4. Build Funding Program module — *done; V1 shipped.*
5. Connect funding opportunities to lead matching and outreach — *done.*
6. Package the product into a sellable B2B offer — *in progress.*

## Other standing rules
- Outreach is **human-approved only** — never auto-send. See [[26-Outreach]].
- Never commit secrets; live values live only in the VPS `.env`. See [[44-Secrets-And-Rotation]].
- Back up Postgres before every redeploy/migration. See [[45-Database-Backups]].
- Keep work in **Repo 1** (canonical). Don't fork effort into Repo 2. See [[02-Glossary]].
- Funding matching is **human-reviewed**; never auto-claim eligibility/approval. See [[29-Funding-Program]].

Up: [[00-Home]]
