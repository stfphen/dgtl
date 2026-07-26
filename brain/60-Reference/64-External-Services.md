---
title: 64 · External Services
type: reference
tags: [reference, ops]
status: stable
updated: 2026-06-27
source: API_KEYS.md
---

# External Services

Every third-party service, what it powers, its dashboard, and account notes. All integrations
**degrade gracefully** (missing key → "not configured", app keeps running). Env var names: [[43-Environment-Variables]].

| Service | Powers | Code wrapper | Dashboard | Notes |
|---|---|---|---|---|
| **Anthropic (Claude)** | AI Tenant Builder, Deep Research, Fill-missing, call summaries | `lib/ai/claudeBackend.js` | console.anthropic.com / `claude setup-token` | Two paths: subscription (`CLAUDE_CODE_OAUTH_TOKEN`) or API key. [[2B-AI-Backend]] |
| **OpenAI** | Optional LLM sales brief only | `lib/enrichment/llmBrief.js` | platform.openai.com/api-keys | Optional; deterministic fallback. Default model `gpt-4o-mini`. |
| **Stripe** | Checkout + webhooks | `lib/payments/stripe.js` | dashboard.stripe.com | Test (`sk_test_`) vs live (`sk_live_`); webhook `whsec_` differs CLI vs dashboard. [[27-Checkout-Payments]] |
| **Twilio** | Telephony (calls, recording) | `lib/telephony/twilioProvider.js` | twilio.com console | Buy +1 voice number; webhook URLs byte-exact. [[28-Telephony]] |
| **Deepgram** | In-app call transcription (primary) | `lib/telephony/transcribeRecording.js` | deepgram.com | `DEEPGRAM_MODEL` default `nova-3`; Whisper (OpenAI) fallback. |
| **Resend** | Outreach email sending | `lib/integrations/resend.js` | resend.com | Needs verified sender domain (SPF/DKIM/DMARC on dgtlmag.com) to inbox. [[26-Outreach]] |
| **Google Places** | Prospecting search | `lib/integrations/googlePlaces.js` | console.cloud.google.com | Needs billing + Places permission; restrict key to Places API + IP 62.72.16.32. |
| **Hunter** | Lead domain/email enrichment | `lib/integrations/hunter.js` | hunter.io | Free plan = 50 searches/mo. |
| **Apollo** | People / decision-maker search | `lib/integrations/apollo.js` | app.apollo.io | People API; may return partial contacts. |
| **Hostinger VPS** | Hosting | — | hpanel / SSH `root@62.72.16.32` | Ubuntu + Docker + Traefik. [[41-Deployment-Runbook]] |
| **LetsEncrypt** | TLS | (Traefik resolver `letsencrypt`) | — | Auto-renew (verify in Phase 12). |

## What needs FAYELLA's hands
Issuing/pasting live secrets cannot be automated: Stripe live keys + webhook, Anthropic token, Twilio
number purchase + SID/token, Resend domain DNS verification, provider key rotations. [[42-Go-Live-Plan]]

## Rotation
All keys + procedure: [[44-Secrets-And-Rotation]]. The four provider keys (Resend/Google/Hunter/Apollo) appeared in session logs → rotate.

Up: [[60-Reference-MOC]]
