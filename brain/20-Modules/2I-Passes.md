---
title: 2I · DGTL Pass (passes, tickets, verification)
type: module
tags: [module, passes, wallet, verification]
status: in-build
updated: 2026-10-01
---

# DGTL Pass

## Purpose
Issue branded, time-bound access passes (day, monthly, yearly, VIP lifetime) by email and SMS,
add them to Apple Wallet, and verify them at the door from a phone browser, with the database as
the only source of truth. It is a **platform module**, not a separate app: it reuses tenants/brand
config, teams/roles, sessions, audit, Resend, Twilio and Stripe. It sits after checkout in the
lead lifecycle. Once [[27-Checkout-Payments]] issues passes automatically, it becomes a sellable
feature (roadmap item R1 in the spec).

**Status: in build. Phase 1 (foundation) is built on `feat/pass-p1-foundation` (2026-10-01).**
The full spec, a tested reference core and the migration exist. The **DGTL brand kit**
(`engine/dgtl-brand-kit/`) is applied to every surface, and every pass is a **branded DGTL card**:
the DGTL⚡ PASS lockup and gold spark on every tier, plus a distinct tier colour (Steel blue, Bronze
copper, Silver platinum, VIP gold on black). Design targets are in `docs/specs/dgtl-pass/previews/`.
Launch plan: `docs/specs/dgtl-pass/17-launch-plan.md`. Phase 0 is covered by `main`'s
`core-release-gate.yml` (restored to green by PR #44).

Phase 1 delivered:
- migration 015
- the pure pass modules in `platform/lib/passes/`
- the pass-only roles `issuer` and `verifier`, refused centrally by `requireSession()`
- invite-only Google sign-in
- password-less staff accounts
- `/scan` as the pass-only landing page
- 77 new tests, including the T-R1 route sweep

`npm test` is 613/613.

## Key files
- Spec + handoff: `docs/specs/dgtl-pass/` (start at `README.md`; build agent prompt in `HANDOFF-PROMPT.md`)
- Reference core (tested, to port into `platform/lib/passes/`): `docs/specs/dgtl-pass/reference/`
  - `credentials.js`: HMAC-derived credential, stored as sha256 only; scan payload parser + host allow-list
  - `validity.js`: tenant-timezone windows, business-day cutoff, DST-safe
  - `verify.js`: pure admit/deny decision, derived status, PII-stripped scanner response
  - `repository.js`: `issuePass` / `verifyScan` / `revokePass` transactions (row lock + scan-id idempotency)
  - `brand.js` · `tiers.js` · `passJson.js` · `walletArt.js` · `email/render.js`: brand kit (drift-tested against all three token files), Steel/Bronze/Silver/Gold on the black ladder, Wallet fields + spark art, 5 emails + SMS
  - `ui/mockups.js`: generates the brand-kit design targets for Wallet, pass page, scanner and admin
- Draft migration: `docs/specs/dgtl-pass/migration/015_passes.sql`. New tables `pass_types`,
  `pass_holders`, `passes`, `pass_deliveries`, `pass_scans`, `pass_wallet_registrations`,
  `user_identities`. New roles `issuer`, `verifier`. `users.password_hash` becomes nullable.
- Design targets: `docs/specs/dgtl-pass/previews/` (`index.html` emails · `wallet.html` · `pass-page.html` · `scanner.html` · `admin.html`)
- Built (P1): `platform/migrations/015_passes.sql`; `lib/passes/{credentials,validity,verify,tiers,brandKit,config}.js`;
  `lib/oauth/{google,state,identities}.js` (PKCE + signed state cookie + jose JWKS, invite-only
  linking by Google `sub`); `app/api/auth/google/{start,callback}`; `app/scan` (signed-in landing,
  camera scanner in P3); pass roles + capability matrix in `lib/permissions.js`; `scripts/seed-passes-dev.js`.
- Target (not built): `app/p/[credential]`, `app/api/admin/passes/*`, `app/api/scan/*`,
  `lib/passes/repository.js`, and a Core routed module `/passes` (`app/(core)/passes`).

## Data flow
Admin issues (idempotent on `issue_request_id`) → the pass row stores the window + usage snapshot
+ `credential_hash` → deliveries render per tier and send via Resend/Twilio (the pass never
depends on delivery) → the holder opens `/p/<credential>` or Wallet → the verifier scans at
`/scan` → `POST /api/scan/verify` locks the row, runs `decideScan`, updates on admit, and writes
the ledger in one transaction.

## Config / env
New env: `PASS_PUBLIC_BASE_URL` (permanent once QR codes ship), `PASS_CREDENTIAL_SECRETS`,
`PASS_CREDENTIAL_ACTIVE_KEY`, `GOOGLE_OAUTH_*`, `OAUTH_STATE_SECRET`, `PASSKIT_*`,
`TWILIO_MESSAGING_SERVICE_SID`, `PASSES_*`. Full table in the spec's `15-config-and-accounts.md`.
The Google and `PASS_*` variables are in [[43-Environment-Variables]] and `platform/.env.example`. Tenant config gains a `passes` block (timezone,
cutoff, gates, brand kit, legal/postal address, VIP offer).

## ⚠️ Gotchas / open issues
- **Postgres-only.** No JSON file-store fallback, because redemption needs row locks
  (see the file-store race in [[53-Known-Issues]]).
- **iOS Safari has no `BarcodeDetector`.** The scanner uses `zxing-wasm`.
- **The pass host is permanent** once real QR codes exist. Decide it before Phase 2
  (recommended `pass.dgtl.ltd`).
- **External lead times:** Apple Developer (Pass Type ID cert), Twilio A2P/toll-free
  registration. Start in Phase 0.
- **Compliance:** every email needs a tenant postal address + preferences link or it is blocked;
  the VIP offer renders only with marketing consent (CASL). Not legal advice. Counsel confirms
  before the first commercial send.
- **Pass-only roles are denied by default.** Any new workspace route that checks only "signed in"
  must use `requireSession()`, never `getAdminSession()` directly. `tests/route-guard-sweep.test.js`
  fails if a route has no guard and isn't on its PUBLIC list, or if a verifier/issuer gets through.
- **Google-only accounts have `password_hash = null`.** `createAdminSession` runs a dummy bcrypt
  compare and refuses, so a password can never open them (and timing doesn't reveal which kind it is).
- Gated behind the release gate: Phase 0 makes `npm test` + `npm run build` required CI first
  ([[31-Current-Priorities]]).

## Related
[[21-Admin-Shell]] · [[26-Outreach]] · [[27-Checkout-Payments]] · [[28-Telephony]] · [[15-Multi-Tenancy]] · [[16-Design-System]] · [[52-Decision-Log]]

Up: [[20-Modules-MOC]]
