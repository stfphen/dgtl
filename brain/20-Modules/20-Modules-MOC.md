---
title: 20 · Modules MOC
type: moc
tags: [moc, module]
updated: 2026-06-27
---

# 🧩 Modules MOC

One deep note per subsystem. Each follows [[Module-Note-Template]]: purpose, key files, data flow,
config/env, gotchas, related.

## The lead lifecycle (how modules connect)
```
        ┌─────────── PROSPECTING ──────────┐
        │ (Google/Hunter/Apollo → leads)   │
funnel ─┤                                   ├─► LEAD PIPELINE ─► ENRICHMENT ─► DEEP RESEARCH (AI)
survey ─┤                                   │        │                              │
inbound ┘                                   │        ├─► OUTREACH (human-approved) ─┘
                                            │        ├─► TELEPHONY (calls)
                                            │        ├─► FUNDING REVIEW + matching
                                            │        └─► CHECKOUT (Stripe)
```

## Modules
| # | Module | One-liner |
|---|---|---|
| [[21-Admin-Shell]] | Admin shell, auth, RBAC, audit | The operator cockpit + security layer. |
| [[22-Lead-Pipeline]] | Lead pipeline | Capture, score, dedupe, filter/sort, CSV. |
| [[23-Prospecting]] | Prospecting / batch builder | Import prospects from Google/Hunter/Apollo. |
| [[24-Enrichment]] | Lead enrichment | Website/social/contact/signals + sales brief. |
| [[25-Lead-Research-AI]] | AI deep research | Claude web-research dossier + fill-missing. |
| [[26-Outreach]] | Outreach sequence | Templates → queue → Resend (human-approved). |
| [[27-Checkout-Payments]] | Checkout & payments | Stripe checkout + idempotent webhook. |
| [[28-Telephony]] | Telephony | Inbound routing, click-to-call, recording, transcription. |
| [[29-Funding-Program]] | Funding Program engine | Grant-readiness funnel, scoring, matching, review. |
| [[2A-Tenant-Builder]] | AI tenant builder | Generate a tenant config from a prompt. |
| [[2B-AI-Backend]] | AI backend | Shared Claude transport (subscription / apiKey). |
| [[2C-Enterprise-Prospecting]] | Enterprise prospecting (ABM) | **MVP built.** Account-based motion: accounts → committee → campaign, 3 gates → outreach. |
| [[2D-Portfolio-Media]] | Portfolio / references & media library | **Proposed.** Per-tenant portfolio section + reusable media library + AI-assisted selection + hero/media editor. |

Up: [[00-Home]]
