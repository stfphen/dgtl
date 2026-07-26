---
title: 34 · Do Not Start Yet (gated work)
type: roadmap
tags: [roadmap, guardrails]
status: living
updated: 2026-06-27
source: NEXT_STEPS.md
---

# Do Not Start Yet (gated work)

Explicitly deferred. Each needs a prerequisite decision/plan before any code. Do not "helpfully" build these without sign-off.

| ❌ Item | Why gated | Gate / prerequisite |
|---|---|---|
| **Automated live funding-source ingestion** | Matching is intentionally manual/human-reviewed; scraping grant sites risks compliance + data-quality problems. | A data-quality plan + human-review gating. `lib/funding/ingestion.js` is the safe future boundary. [[29-Funding-Program]] |
| **Real outreach email sending at volume** | Deliverability + compliance risk. | Approved Resend domain (SPF/DKIM/DMARC) + reviewed suppression/unsubscribe path. [[26-Outreach]] |
| **LLM sales brief in production** | Cost / guardrails undecided (works + falls back safely today). | A cost/guardrail decision. [[24-Enrichment]] |
| **Stripe subscriptions** | Current checkout handles one-time `payment` only. | Subscription event handling (`invoice.paid`, `customer.subscription.*`) + orders view. [[27-Checkout-Payments]] |

## Also remember
- 🚫 Never auto-send outreach — human-approved only ([[CLAUDE-Operating-Rules]]).
- 🚫 Never auto-claim funding eligibility/approval ([[29-Funding-Program]]).
- 🚫 Don't fork effort into Repo 2 ([[02-Glossary]]).
- 🚫 Don't delete/force-push branches without explicit confirmation ([[47-Git-Workflow]]).

Up: [[30-Roadmap-MOC]]
