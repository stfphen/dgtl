---
title: 2G · HOME Command Center
type: module
tags: [module, dashboard, architecture]
status: living
updated: 2026-08-14
---

# HOME Command Center (DGTL Core Stage 5)

## Purpose
One authenticated surface (`/home`) that answers, in order: what needs attention, what happens
today, pipeline, delivery, approvals, system health, recent activity — as a pure projection over
canonical Stage 1–4 state. HOME owns nothing: no notifications table, no dashboard state, no
persisted KPIs, no migration.

## Key files
- `platform/lib/stage5/homeService.js` — `HomeService.snapshot()` (per-section degradation via
  allSettled; Worklog probed once, coalesced, 3 s-bounded) and `search()` (team-scoped, bounded).
- `platform/lib/stage5/repository.js` — the only new reads: team-wide activities, opportunity
  stage aggregates (known value vs unknown-value count), message state aggregates, bounded
  drafts list, per-kind ILIKE search. Extends the Stage 4 repository chain.
- `platform/app/(core)/home/page.jsx` + `components/core/CommandPalette.jsx` (⌘K, the second
  client component in Core) + `/api/core/search`.
- `platform/app/page.jsx` — unclaimed hosts now land on `/home`; tenant-claimed hosts render
  funnels unchanged (regression-tested by source assertion).
- `platform/scripts/rehearse-stage5.js` — projection acceptance on disposable PG + real local
  Worklog: six attention conditions appear, resolutions in the authoritative systems make them
  disappear, no dashboard table exists.
- `docs/architecture/dgtl-core-phase-5.md` — full IA, attention rules, routing decision, seam.

## Attention rules (deterministic, no scoring)
critical (failures/unknown outcomes/broken links/failing connector) → action_required (approvals,
open exceptions, unlinked delivery-ready opportunities, overdue next actions) → due_today →
upcoming → informational; within a class oldest first, then key. Stable keys mean items vanish
naturally when the source state resolves.

## Invariants
- HOME never calls Worklog for card data; delivery renders Stage 4 snapshots with `snapshotAt`.
- A failing source degrades its own sections only; the rest of HOME renders.
- Unknown estimated values are counted separately, never shown as $0.
- No inline approval controls; every item deep-links to the authoritative workflow.
- Search and every section are team-isolated; team comes from the session only.
- "Disabled intentionally" (test transport) is not an error state.

## Current status
17/17 stage-5 tests; full suite green; rehearsal green (attention 6 → 2 after real resolutions).
Not deployed; commercial email stays disabled; production Worklog untouched.

## Next (Stage 6 seam)
DGTL.chat/Terminal calls `HomeService.snapshot()/search()` and the existing domain services —
never dashboard HTML. The ⌘K surface is the intended conversational entry point.

Related: [[2E-Artifact-Automation]] · [[2F-Worklog-Bridge]] · [[14-Routes-Map]] · [[53-Known-Issues]]

Up: [[20-Modules-MOC]]
