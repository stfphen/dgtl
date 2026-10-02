---
title: 2I · DGTL Pass (passes, tickets, verification)
type: module
tags: [module, passes, wallet, verification]
status: in-build
updated: 2026-10-02
---

# DGTL Pass

## Purpose
Issue branded, time-bound access passes (day, monthly, yearly, VIP lifetime) by email and SMS,
add them to Apple Wallet, and verify them at the door from a phone browser, with the database as
the only source of truth. It is a **platform module**, not a separate app: it reuses tenants/brand
config, teams/roles, sessions, audit, Resend, Twilio and Stripe. It sits after checkout in the
lead lifecycle. Once [[27-Checkout-Payments]] issues passes automatically, it becomes a sellable
feature (roadmap item R1 in the spec).

**Status: in build. Phases 1–3 are built and demo on a real iPhone (2026-10-02).** Phase 1
(foundation) is on `feat/pass-p1-foundation`. Phases 2–3 (pass engine, holder page, scanner,
Apple Wallet through WalletWallet) are on `feat/pass-p2-p3-demo`. Run it with
`npm run demo:passes`; the runbook is `docs/specs/dgtl-pass/18-iphone-demo.md`.
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

Phases 2–3 delivered:
- **Core `/passes`:** issue, with an "open on your phone" QR; recent passes with QR and
  revoke; tier bars; live scans.
- **`/p/[credential]`:** the branded pass page in all four tier colours. Dead states hide the
  QR; every miss gets one 404.
- **`/scan`:** `zxing-wasm` (self-hosted, hash-pinned); full-screen verdicts; manual entry;
  a photo fallback for plain-http Wi-Fi.
- **Apple and Google Wallet via WalletWallet.** No Apple Developer account is needed;
  migration 016 stores the copy.
- **`npm run demo:passes`:** its own Postgres 16 container, seeded, LAN-reachable.

Verified on real Postgres 16: 20 parallel scans of one single-use pass → exactly 1 admit
(T-C1, now a release-gate step). `npm test` 647 (644 pass, 3 real-Postgres tests skip
locally without `PASSES_PG_TEST_URL`; 3/3 pass against the demo database).

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
- Built (P2–P3):
  - `lib/passes/store.js` (the reference transactions, plus list, overview, holder lookup and
    Wallet copy)
  - `settings.js` (tenant `passes` block), `holderView.js`, `http.js`, `art.js` + the generated
    `brandAssets.js` (kit spark), `qr.js`
  - `wallet/{index,walletwallet}.js`
  - `app/p/*`, `app/(core)/passes`, `app/api/admin/{passes,pass-types}/*`, `app/api/scan/*`
  - `components/{passes,scan}/*`
  - `scripts/demo-passes.mjs`
- Target (not built):
  - pass-type editor; suspend / rotate / extend / resend
  - delivery (P4)
  - the official Wallet badges (P5.4); the Apple web service for updates (P5b)
  - `/passes/scans` ledger; scanner PWA manifest + Worker decode

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
- **Matching the design in Wallet (2026-10-02).** On WalletWallet's free plan, Stephen's live
  test showed a plain card. Two ways to the DGTL card, both built:
  - **WalletWallet Pro** (`WALLETWALLET_BRANDING=full`): our layout, tier face, strip art,
    icon and wordmark. A plan refusal falls back to the free card and records why.
  - **DGTL's own certificate** (`PASS_WALLET_PROVIDER=apple`): the exact design, signed in
    `lib/passes/wallet/apple.js` (pkijs CMS + sharp art + our ZIP). Setup is
    `npm run passkit:setup`.

  Decision: Pro now, Apple later.
- **Wallet without Apple, and its limits.** WalletWallet signs with its own Pass Type ID.
  The Free plan gives a colour preset and text only (Day blue, Monthly orange, Annual
  purple, VIP dark; never green or red). The holder's name and pass link go to a processor.
  The barcode stays our link, so the door still decides. Own certificate (P5) remains the
  launch recommendation; switching is `PASS_WALLET_PROVIDER`.
- **A tenant's `brand.primaryColor` is the pass brand mark.** Without one, tenant
  normalisation fills the legacy funnel blue (`#0071e3`) and the spark turns blue. The
  demo seed sets it from the gold token.
- **LAN http is development-only.** `PASS_PUBLIC_BASE_URL` may be `http://<private IP>` outside
  production, and the scanner then accepts http QR codes from that host only. Live camera
  still needs HTTPS (photo fallback otherwise).
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
