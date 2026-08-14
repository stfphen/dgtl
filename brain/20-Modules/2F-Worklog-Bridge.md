---
title: 2F · Worklog Bridge
type: module
tags: [module, integration, architecture, security]
status: living
updated: 2026-08-14
---

# Worklog Bridge (DGTL Core Stage 4)

## Purpose
Move a won/delivery-ready canonical Opportunity into a DGTL Worklog delivery Project through
approved, idempotent operations — without creating a second task/time system. Worklog remains the
only authority for clients, projects, tasks, time entries, shifts, budgets, and execution state;
Core stores links, approvals, and freshness-stamped read-only snapshots.

## Data flow
`Company ↔ Worklog Client (ExternalLink) · Opportunity → handoff preview → IntegrationOperation
(draft → owner/admin approval + payload checksum → execute) → Worklog Project/Tasks over HTTP →
ExternalLinks + Activity → read-through status/time/budget/digest snapshots`

## Key files
- `apps/worklog/client/worklog-client.mjs` — the ONE Worklog HTTP client (cookie auth, single 401
  re-auth, 120 ms serialized queue, credential hygiene); the MCP re-wraps it, Core imports it.
- `platform/lib/stage4/registry.js` — connector capabilities, consequential-action contracts, and
  declared-unsupported operations (notably: Worklog has **no client-create endpoint**; clients
  materialise from a project's `clientName` and are pruned with their last project).
- `platform/lib/stage4/worklogConnector.js` — server-configured connector (env only: base URL,
  dedicated account, `CORE_WORKLOG_TEAM_ID` binding), cached/coalesced reads, health states.
- `platform/lib/stage4/service.js` — matching, link lifecycle (retire/revive/repair with history),
  IntegrationOperation approval/execution/reconciliation, read-through snapshots, Activity.
- `platform/migrations/013_worklog_operations_phase_4.sql` — `integration_operations` + external
  link lifecycle columns. No canonical copy of any Worklog table.
- `platform/scripts/rehearse-stage4.js` — CI acceptance against a REAL local Worklog server.
- `docs/architecture/dgtl-core-phase-4.md` — full capability audit and contract.

## Idempotency truth
Worklog has no idempotency keys, no external refs, and no unique names. The guarantee is Core-side:
team-unique payload-bound idempotency keys, a deterministic project code (`C4-…`) and per-task note
markers (`[core:<op>#<i>]`), read-before-write adoption, durable per-item progress, and an
`outcome_unknown` quarantine whose only exit is deterministic reconciliation. A retry can never
create a duplicate project or task.

## Security invariants
- Endpoint and credentials are server env; no browser input reaches the connector (no SSRF).
- Connector serves exactly one Core team (`CORE_WORKLOG_TEAM_ID`); everything else fails closed.
- Core role checks (request: sales+; approve/execute: owner/admin) AND the Worklog identity's own
  permission are both enforced — Core never bypasses Worklog authorization, and never touches the
  Worklog SQLite database (tested).
- Payload tampering after approval cancels the operation.
- Unlink retires the Core link only; the Worklog record is untouched. Repairs are explicit.
- One Worklog project per opportunity; conflicting claims and client mismatches fail with
  exceptions.

## Current status
22/22 stage-4 unit/security tests; full real-Worklog acceptance green (project + implicit client +
3 marked tasks over the real HTTP API; duplicate prevention proven via Worklog's own API; member
executed work; read-through showed 180 logged minutes / 15% budget; digest passed through with 13
provenance rows; ambiguous/lost-response/stale/permission/auth/tamper failure paths all exercised).
MCP gained `worklog_list_clients` + `worklog_client_digest`. Not deployed to production; the
production integration account and env are deliberately unconfigured.

## Next
Stage 5 HOME consumes `/operations/worklog` data; DGTL.chat reuses the same connector/operation
boundary. Shift read-through classified but not built. Production setup steps are in the phase doc.

Related: [[13-Data-Model]] · [[14-Routes-Map]] · [[2E-Artifact-Automation]] · [[53-Known-Issues]]

Up: [[20-Modules-MOC]]
