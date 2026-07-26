---
title: 2B · AI Backend (Claude transport)
type: module
tags: [module, ai]
status: stable
updated: 2026-07-02
source: docs/CLAUDE_AI_SETUP.md
---

# AI Backend (Claude transport)

## Purpose
Shared Claude transport used by all AI features: Tenant Builder ([[2A-Tenant-Builder]]), Deep Research
([[25-Lead-Research-AI]]), Fill Missing, and call summaries ([[28-Telephony]]). Optional OpenAI powers
only the enrichment sales brief ([[24-Enrichment]]).

## Key files (`lib/ai/`)
- `claudeBackend.js` — the transport. `aiMode`, `aiNotConfiguredError`, `runWebResearch`, `generateJson`. `DEFAULT_MODEL = LEAD_RESEARCH_MODEL || "claude-opus-4-8"`.
- `aiParse.js` — `isPlainObject`, `str`, `extractText`, `parseModelJson`, `collectCitations`.

## Status (2026-07-02)
**Configured — subscription path live on local AND VPS.** `CLAUDE_CODE_OAUTH_TOKEN` (minted via
`claude setup-token`) is in local `.env.local` and the VPS `/opt/content-checkout-funnel/.env`;
VPS app container recreated with it. Local verified end-to-end (real `generateJson` call).
Deployed image confirmed subscription-capable (Agent SDK + musl CLI build present, non-root uid 1000).
Token is a secret — never commit; `.env*` is gitignored.

## `aiMode()` — picks ONE path at runtime (claudeBackend.js:16-20)
1. **`CLAUDE_CODE_OAUTH_TOKEN`** set → **"subscription"** (preferred; uses Claude Max/Pro via `@anthropic-ai/claude-agent-sdk`, **no per-token billing**).
2. else **`ANTHROPIC_API_KEY`** set → **"apiKey"** (pay-as-you-go; also the automatic fallback).
3. else **"off"** → clean `AiNotConfigured` error (features disabled, app still runs).

### Subscription path runtime requirement
- Spawns the **Claude Code CLI as a subprocess** (`subscriptionEnv()` strips `ANTHROPIC_API_KEY` to force subscription).
- The CLI must be installed **inside the app container** (Dockerfile installs it / ships node_modules) or use the API-key path.
- Setup: `npm i -g @anthropic-ai/claude-code` then `claude setup-token` to mint `CLAUDE_CODE_OAUTH_TOKEN`.

## Cost controls
- `LEAD_RESEARCH_MODEL` (default `claude-opus-4-8`).
- `LEAD_RESEARCH_MAX_WEB_SEARCHES` (default `8`).
- Research route `maxDuration = 120`.
- Tenant Builder model is hardcoded (no override).

## OpenAI (optional, separate)
`OPENAI_API_KEY` (+ `OPENAI_MODEL` default `gpt-4o-mini`) powers only `lib/enrichment/llmBrief.js`;
silently falls back to the deterministic brief if unset.

## Go-live (Phase 4)
Pick a path, set env, recreate the container, verify the CLI is in-container, smoke-test one Deep
Research + one Tenant Builder in `/admin`. See [[42-Go-Live-Plan]].

## Related
[[25-Lead-Research-AI]] · [[2A-Tenant-Builder]] · [[24-Enrichment]] · [[28-Telephony]] · [[43-Environment-Variables]]

Up: [[20-Modules-MOC]]
