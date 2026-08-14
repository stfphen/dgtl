---
title: 2E · Artifact Automation
type: module
tags: [module, ai, architecture, security]
status: living
updated: 2026-08-14
---

# Artifact Automation

## Purpose
Turn approved canonical Opportunity context into a validated, versioned sales asset without making
the Next.js app an unrestricted shell or autonomous agent.

## Data flow
`Opportunity → context snapshot → approved brief → GenerationJob → scoped worker → isolated Git
worktree → deterministic validation → sandboxed preview → owner/admin approval → immutable Artifact
→ separately approved test deployment → exact Message attachment → Activity`

## Key files
- `platform/lib/stage3/registry.js` — real capability and deployment-adapter registry.
- `platform/lib/stage3/context.js` — provenance-aware Company/Opportunity/Contact/Research snapshot.
- `platform/lib/stage3/service.js` — authorization, state transitions, approval, versions, Activity,
  exception and Message-attachment rules.
- `platform/lib/stage3/repository.js` — team-scoped PostgreSQL implementation.
- `platform/lib/stage3/isolatedPitchWorker.js` — temporary-worktree `pitch.pages` acceptance worker.
- `platform/migrations/012_artifact_automation_phase_3.sql` — additive version/job/deployment schema.
- `docs/architecture/dgtl-core-phase-3.md` — full capability audit and contract.
- `docs/operations/dgtl-artifact-worker-runbook.md` — safe worker/staging procedure.

## Capability truth
`pitch.pages` is the complete tested path using `engine/dgtl-pitch-pages`; `pitch.composer` is an
alternative registered skill for authorized agents. `pitch.teaser` is a follow-on requiring an
approved pitch. Audit/report generation remains `installed_unavailable` because those skills are not
versioned under `engine/`; their existing deploy hosts do not make generation automatic. Brand-kit
generation is disabled because its output surface is too broad for the Stage 3 allow-list.

## Security invariants
- Browser routes cannot run shell, Git, skills, SSH or deploy commands.
- Session/service configuration supplies team identity; direct input cannot escalate it.
- Worker credentials are server-only and team-scoped.
- Generated paths are allow-listed; traversal/unrelated files fail validation.
- A worker cannot approve its own output; generation, Artifact and deployment approvals are separate.
- Production deployment adapters are disabled. Unknown remote outcomes stop for operator review.
- A Message snapshots Artifact ID/version/URL/checksum and returns to draft when an asset is attached.

## Current status
Local PostgreSQL 16 acceptance generated real pitch v1/v2 candidates in separate Git worktrees,
validated/committed both, served the generated HTML through the authenticated fixed-root sandboxed
preview route, test-deployed v1 to `preview.invalid`, pinned a canonical test Message to v1,
and recorded thirteen Activities. Duplicate result/deployment attempts were idempotent or rejected.
No production asset, live DB, deploy secret, DNS, or external email was touched.

## Next
Operate the scoped worker in an isolated staging environment, validate deferred team FKs against a
fresh snapshot, and wrap the real pitch/report portals in checksum-verifying worker adapters before
any production enablement. Promote audit/report workflows into `engine/` before registering them as
supported.

Related: [[13-Data-Model]] · [[14-Routes-Map]] · [[26-Outreach]] · [[53-Known-Issues]]

Up: [[20-Modules-MOC]]
