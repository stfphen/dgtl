---
title: 2H · DGTL.chat Command & Action Layer
type: module
tags: [module, ai, assistant, architecture, security]
status: living
updated: 2026-08-14
---

# DGTL.chat Command & Action Layer (DGTL Core Stage 6)

## Purpose
The first conversational interface over Core (`/chat`). The model interprets, reasons and
proposes; **Core validates, authorizes and executes**. Answers are grounded in canonical state via
a static server-owned tool registry; anything consequential becomes an ActionProposal that only an
explicit human confirmation — revalidated at execution time — turns into the normal native draft
state. There is deliberately no shell, SQL, HTTP, filesystem, Git, email-send or deploy tool.

## Key files
- `platform/lib/stage6/toolRegistry.js` — 16 static tools: 12 READ (home snapshot, search,
  entity/campaign/generation/artifact gets, stored Worklog delivery summary, exceptions,
  activity) + 4 PREPARE (`message.prepare_followup`, `generation.prepare_asset`,
  `worklog.prepare_handoff`, `opportunity.prepare_next_action`). Strict arg validation —
  unknown keys rejected, `teamId` never model-suppliable; `hashPayload` (canonical sha256);
  `untrusted()` marker for business content.
- `platform/lib/stage6/assistantService.js` — `handleTurn` (bounded loop, `TURN_LIMITS`:
  4k input / 8 iterations / 6 tool calls / 60 s / 10 turns/min; thread CAS idle→running) and
  `confirmProposal` (owner + write role + tool role re-check, hash + expiry + fresh-precondition
  revalidation → `stale` with no mutation; idempotent executed return; native failure → `failed`).
- `platform/lib/stage6/modelAdapter.js` — `ChatModelAdapter` seam: deterministic (CI/acceptance
  authority, zero external deps), scripted (tests), anthropic (via the shared transport's new
  `runChatToolTurn`, API-key path only — the subscription/Agent-SDK path is excluded because it
  bypasses permissions). Selected by `CORE_CHAT_PROVIDER`.
- `platform/lib/stage6/policy.js` — versioned system policy (`ASSISTANT_POLICY_VERSION`) with the
  trust hierarchy: SYSTEM POLICY → TOOL DEFINITIONS → USER REQUEST → UNTRUSTED BUSINESS DATA.
- `platform/lib/stage6/repository.js` + `memoryRepository.js` — threads/messages/tool-runs/
  proposals over migration `014_dgtl_chat_command_layer.sql` (CAS transitions, `unique(id,team_id)`,
  one live proposal per exact payload per thread).
- `platform/app/(core)/chat/page.jsx` + `components/core/ChatSurface.jsx` + `/api/core/chat/*`
  (threads, turns, proposal confirm/reject, health). Confirm route is `requireCoreWrite`.
- `platform/scripts/rehearse-stage6.js` — scenarios A–J on disposable PG + real local Worklog with
  the deterministic adapter (CI never needs an AI key).
- `docs/architecture/dgtl-core-phase-6.md` — trust chain, audit table, full contract.

## Invariants
- Registry is the hard boundary: unknown tool ids fail closed and are audited; RESTRICTED
  operations (send email, deploy, delete, direct Worklog mutation, SQL, shell…) are not tools.
- The model can never confirm its own proposal; confirmation is a UI button on a
  `requireCoreWrite` route, thread-owner-only, roles re-checked, revalidated at execution.
- Team always derives from the session; a model-supplied `teamId` is a validation error.
- SourceRefs come only from tool results — the model cannot fabricate a clickable ID.
- No chain-of-thought is requested or persisted; provider metadata stored is operational only.
- Provider failure degrades `/chat` only; HOME, search, entities and the Worklog bridge are
  proven unaffected.

## Current status
25/25 stage-6 tests; full suite 487/487; `rehearse:stage6` green (all scenarios incl. prompt
injection inert, hostile scripted model rejected at every layer, stale proposal no-mutation).
CI extended. Not deployed; no production email; production Worklog untouched.

Related: [[2G-Home-Command-Center]] · [[2B-AI-Backend]] · [[2F-Worklog-Bridge]] ·
[[14-Routes-Map]] · [[43-Environment-Variables]] · [[53-Known-Issues]]

Up: [[20-Modules-MOC]]
