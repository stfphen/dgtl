---
title: 11 · Tech Stack
type: reference
tags: [architecture]
status: stable
updated: 2026-06-27
source: package.json, README.md
---

# Tech Stack

## Runtime & frameworks
- **Next.js `^15.0.0`** (App Router), **React `^19.0.0`** / `react-dom ^19`.
- **ESM project** (`"type": "module"`). Package version `0.2.0`, private.
- **Node `--test`** runner for the test suite.

## Key dependencies
| Package | Version | Used for |
|---|---|---|
| `@anthropic-ai/sdk` | `^0.105.0` | Claude Messages API (apiKey path) — AI features |
| `@anthropic-ai/claude-agent-sdk` | `^0.3.183` | Claude subscription path (OAuth token, no per-token billing) |
| `pg` | `^8.13.1` | Postgres client (`lib/store.js`) |
| `stripe` | `^22.2.2` | Checkout sessions + webhooks ([[27-Checkout-Payments]]) |
| `twilio` | `^6.0.2` | Telephony provider ([[28-Telephony]]) |
| `bcryptjs` | `^3.0.3` | Password hashing (cost 12) |
| `framer-motion` | `^12.40.0` | Scroll reveals, stagger, admin tab transitions |
| `lucide-react` | `^1.21.0` | Admin icons |

External (no SDK, via `fetch` in `lib/integrations/`): **Resend**, **Google Places**, **Hunter**, **Apollo**. Optional **OpenAI** + **Deepgram** for LLM brief / transcription.

## npm scripts
| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev -p 8088` | Local dev (port **8088**) |
| `dev:clean` | `rm -rf .next && next dev -p 8088` | Dev with clean cache |
| `build` | `next build` | Production build (gate before deploy) |
| `start` | `next start -p 3000` | Prod server (port **3000**) |
| `migrate` | `node scripts/migrate.js` | Run SQL migrations |
| `create-owner` | `node scripts/create-owner.js` | Seed first owner (one-time `OWNER_PASSWORD` env) |
| `seed:funding-demo` | `node scripts/seed-funding-demo.js` | Idempotent funded-growth demo leads |
| `seed:tenants` | `node scripts/seed-tenants.js` | Seed built-in tenant configs |
| `test` | `node --test tests/*.test.js` | Full test suite ([[62-Testing]]) |

> ⚠️ There is **no `lint` script** despite the mobile-first prompt referencing `npm run lint`. Use `npm run build` as the lint gate, or add a lint script if needed.

## Infra
- **Docker**: `Dockerfile` (non-root node user so the Claude Agent SDK CLI works) + `docker-compose.yml` (app `content-funnel` + private `content-funnel-postgres`).
- **Traefik** reverse proxy on the VPS (`traefik-public` network, LetsEncrypt resolver). See [[41-Deployment-Runbook]].

Up: [[10-Architecture-MOC]]
