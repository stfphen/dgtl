---
title: 27 · Checkout & Payments
type: module
tags: [module, payments]
status: stable
updated: 2026-06-27
---

# Checkout & Payments (Stripe)

## Purpose
Real Stripe Checkout for service packages, with idempotent webhook fulfillment. Degrades gracefully
to Payment Links / lead capture when Stripe is unconfigured. Product priority #2 (checkout must not regress).

## Key files
- `lib/payments/stripe.js` — lazy Stripe client (null without `STRIPE_SECRET_KEY`):
  - `isStripeConfigured`, `packageHasStripePrice`, `buildCheckoutSessionParams`, `createCheckoutSession`.
  - `verifyWebhookEvent` (raw-body signature), `handleWebhookEvent` (idempotent fulfillment).
- API: `POST /api/checkout` (public; server-resolves tenant + package price, captures lead first), `POST /api/webhooks/stripe` (raw-body, force-dynamic, no auth by design).
- Per-package `stripe` config lives in tenant configs.

## Flow
1. Visitor selects a package → `POST /api/checkout`.
2. Server resolves the **price server-side** (never trusts the client), captures the lead, creates a Checkout Session, redirects to Stripe.
3. Stripe fires `checkout.session.completed` → `/api/webhooks/stripe` verifies signature → marks `metadata.order.status = paid` (idempotent; replays are no-ops).
4. **Fallback:** with `STRIPE_SECRET_KEY` absent, the funnel falls back to Payment Links / lead capture.

## Env / setup
- `STRIPE_SECRET_KEY` (`sk_test_` local / `sk_live_` prod), `STRIPE_WEBHOOK_SECRET` (`whsec_`), optional `STRIPE_PUBLISHABLE_KEY`.
- **Local:** `stripe login` → `stripe listen --forward-to localhost:8088/api/webhooks/stripe` → copy printed `whsec_`.
- **Prod:** Dashboard → Webhooks → add endpoint `https://dgtlmag.com/api/webhooks/stripe`, event `checkout.session.completed`, copy that endpoint's `whsec_` (differs from the CLI one).
- Test card `4242 4242 4242 4242`.
- See [[43-Environment-Variables]] / [[64-External-Services]].

## ⚠️ Roadmap
Current checkout handles one-time `payment` only. **Subscriptions** (`invoice.paid`, `customer.subscription.*`) for retainers + an admin orders view are a Sprint 2 / "do not start yet" item. [[33-Sprint-2-Productization]] / [[34-Do-Not-Start-Yet]]

## Related
[[22-Lead-Pipeline]] · [[29-Funding-Program]] (offer ladder) · [[64-External-Services]]

Up: [[20-Modules-MOC]]
