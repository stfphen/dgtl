---
title: 33 · Sprint 2 — Productization
type: roadmap
tags: [roadmap, funding, payments]
status: living
updated: 2026-07-01
source: NEXT_STEPS.md, docs/funding-program-offer-positioning.md
---

# Sprint 2 — Productization (sellable B2B offer)

The north star: turn the platform into a sellable, white-label B2B offer.

## Engineering workstreams
1. **Multi-tenant self-serve onboarding** — tenant/brand setup flow; **resolve the built-in-tenant /
   team association** so new teams own their tenants without the `team_default` workaround. (This is
   the #1 architectural debt — see [[15-Multi-Tenancy]].)
2. **Stripe hardening** — subscriptions for retainers (`invoice.paid`, `customer.subscription.*`), an
   admin payments/orders view (optional `orders` table), receipt/fulfillment emails. [[27-Checkout-Payments]]
3. **Provider hardening** (Google/Hunter/Apollo/Resend) — retries, rate limits, quota handling. [[23-Prospecting]]
4. **Outreach at scale via Resend** — approved domains, suppression, unsubscribe compliance. [[26-Outreach]]
5. **Reporting/dashboards** — pipeline conversion, outreach metrics, funding-match + payment outcomes.
6. **Funding opportunity ingestion** — activate `lib/funding/ingestion.js` with human-review gating
   (gated — see [[34-Do-Not-Start-Yet]]). [[29-Funding-Program]]
7. **Portfolio / references + media library** — per-tenant proof section with a reusable, tagged, AI-selected
   media library and a hero/media editor; strengthens the "every client gets a branded funnel" pitch.
   Plan of record: [[2D-Portfolio-Media]] (proposed; gated behind stabilization).

## Go-to-market (from the positioning doc)
- **Offer ladder:** free Funding Fit Scan → Fundable Project Blueprint → Application Support → Funded Growth Execution → Monthly Opportunity Intelligence.
- **4 buyer segments:** SMBs; agencies/consultants; economic-development/industry partners; advisors/finance pros.
- **8 outreach angles by vertical** with subject ideas + message angles.
- **White-label positioning** — every client gets a branded funnel + admin.
- **Copy guardrails:** use "may qualify / likely lane / readiness signals / potential pathway"; avoid "you qualify / guaranteed funding / approved grant / free government money". See [[29-Funding-Program]].

Up: [[30-Roadmap-MOC]]
