# DGTL Pass: MVP handoff package

**Status:** proposed · spec complete · reference core built and tested · **DGTL brand kit applied
to every pass surface** · Phase 0 (release-gate CI) written · no `platform/` code changed yet ·
2026-10-01

DGTL Pass issues branded day, monthly, yearly and VIP lifetime passes by email and SMS. It adds
them to Apple Wallet and verifies them at the door from any phone browser, with Google sign-in
for staff and the database as the only source of truth.

It is built as a **module of `platform/`**, not a new app: it reuses the platform's tenants, brand
config, roles, sessions, audit log, Resend, Twilio and Stripe. The reasons are in
[02-architecture.md](02-architecture.md#the-decision-a-platform-module-not-a-new-app).

## Start here

| If you are… | Read |
|---|---|
| the engineer or agent building it | [HANDOFF-PROMPT.md](HANDOFF-PROMPT.md), then [13-build-plan.md](13-build-plan.md) |
| deciding whether to build it | [01-product.md](01-product.md) · [02-architecture.md](02-architecture.md) |
| tracking the launch | [17-launch-plan.md](17-launch-plan.md) |
| reviewing the look and copy | [`previews/index.html`](previews/index.html) (emails) · [`wallet.html`](previews/wallet.html) · [`pass-page.html`](previews/pass-page.html) · [`scanner.html`](previews/scanner.html) · [`admin.html`](previews/admin.html) · [09-brand-and-tiers.md](09-brand-and-tiers.md) |

## Contents

| File | What it answers |
|---|---|
| [01-product.md](01-product.md) | Users, tiers, flows, scope, definition of done, metrics |
| [02-architecture.md](02-architecture.md) | Why a platform module · system map · module layout · request flows · hosts |
| [03-data-model.md](03-data-model.md) | Tables, lifecycle, invariants, tenant config additions, retention |
| [04-api.md](04-api.md) | Every route: body, response, capability, errors |
| [05-verification.md](05-verification.md) | Credential design · decision rules · the scan transaction · anti-passback · offline stance |
| [06-scanner.md](06-scanner.md) | The `/scan` PWA: iOS/Android constraints, screens, behaviour, device matrix |
| [07-apple-wallet.md](07-apple-wallet.md) | Styles per tier, certificates, `.pkpass` build, badge rules, update service |
| [08-messaging.md](08-messaging.md) | Delivery pipeline, email/SMS rules, deliverability, CASL/CAN-SPAM gates |
| [09-brand-and-tiers.md](09-brand-and-tiers.md) | Brand kit contract, Steel/Bronze/Silver/Gold ladder, voice, VIP onboarding strategy |
| [10-auth-and-roles.md](10-auth-and-roles.md) | Google OIDC (invite-only), `issuer` + `verifier` roles, capability matrix |
| [11-admin-dashboard.md](11-admin-dashboard.md) | The Passes module (Core shell), issue flow, detail, pass types, ledger, holder pass page |
| [12-security.md](12-security.md) | Threat model (20 threats → controls → tests), secrets inventory |
| [13-build-plan.md](13-build-plan.md) | Phases P0–P6 with tasks, files, gates, launch acceptance |
| [14-test-plan.md](14-test-plan.md) | What's tested already, what to write, test ids used by the gates |
| [15-config-and-accounts.md](15-config-and-accounts.md) | Env vars, Apple / Google / Twilio / Resend / DNS checklists, new dependencies |
| [16-roadmap.md](16-roadmap.md) | Selling passes, Google Wallet, renewals, photos, offline, … |
| [17-launch-plan.md](17-launch-plan.md) | **Current status, production timeline (target Fri Oct 30, 2026), readiness checklist, decisions needed** |
| [`migration/015_passes.sql`](migration/015_passes.sql) | Draft migration, validated against platform migrations 001–014 |
| [`reference/`](reference/) | Tested, dependency-free implementations to port into `platform/lib/passes/` |
| [`previews/`](previews/) | UI design targets built to the DGTL brand kit: 7 emails + SMS, Wallet passes, pass page, scanner, admin tab |
| [`assets/`](assets/) | `dgtl-wordmark@4x.png`, the kit wordmark rasterized for email and Wallet |

## The reference core (already working)

| Module | Does | Port to |
|---|---|---|
| `credentials.js` | HMAC-derived credential, hash, short codes, scan payload parsing + host allow-list | `lib/passes/credentials.js` |
| `validity.js` | Validity windows in the tenant's timezone, business-day cutoff, DST-safe, month/leap clamping | `lib/passes/validity.js` |
| `verify.js` | The pure admit/deny decision, derived status, scanner response (PII-stripped) | `lib/passes/verify.js` |
| `repository.js` | `issuePass` / `verifyScan` / `revokePass` transactions in real SQL | `lib/passes/store.js` |
| `brand.js` · `tiers.js` | Brand kit resolution (token-mirrored), tier presets, contrast enforcement | `lib/passes/brandKit.js` · `tiers.js` |
| `passJson.js` | Apple Wallet `pass.json` per tier style | `lib/passes/wallet/passJson.js` |
| `walletArt.js` | Wallet strip / thumbnail / icon art from the kit's spark (SVG → `sharp`) | `lib/passes/wallet/art.js` |
| `email/render.js` · `copy.js` | Five branded email variants + SMS, compliance gates, escaping | `lib/passes/email/` |

Verify it yourself:

```bash
node --test docs/specs/dgtl-pass/reference/*.test.js docs/specs/dgtl-pass/reference/email/*.test.js
```

```bash
npm i --prefix /tmp/pglite @electric-sql/pglite
```

```bash
PGLITE_PATH=/tmp/pglite/node_modules/@electric-sql/pglite node --test docs/specs/dgtl-pass/reference/repository.test.js
```

```bash
node docs/specs/dgtl-pass/reference/email/preview.js
```

```bash
node docs/specs/dgtl-pass/reference/ui/mockups.js
```

Results on 2026-10-01: **75/75 unit + 9/9 SQL integration pass.** The first command reports 84
tests with 9 skipped, because the SQL suite skips itself unless `PGLITE_PATH` is set. Previews regenerated with
real QR codes (`PREVIEW_QRCODE_PATH` pointed at a scratch `qrcode` install).

## Decisions made here (log in `brain/50-Audit-Log/52-Decision-Log.md`)

1. **Platform module, not a standalone Supabase app.** It reuses auth, tenancy, audit, email, SMS
   and Stripe. The first-draft Supabase plan is superseded.
2. **App-layer team scoping, not RLS** (the platform's existing model), proven by isolation tests.
   RLS is roadmap defence in depth.
3. **Passes are Postgres-only.** There is no JSON file-store fallback, because atomic redemption
   needs row locks.
4. **Credentials are HMAC-derived and only their hash is stored.** A DB leak alone doesn't yield
   working passes.
5. **Stored status is active | suspended | revoked. Expired, used and scheduled are derived**, so
   no cron flips states.
6. **Scanning is online-only and fails closed.** Offline is a separate security model (roadmap).
7. **The scanner is a PWA with `zxing-wasm`.** iOS Safari has no `BarcodeDetector`.
8. **One DGTL Apple Pass Type ID for all tenants.** `organizationName` is per tenant. Wallet push
   updates are Phase 5b, not a launch blocker.
9. **Google OAuth is invite-only** and linked by `sub`. There's no self-signup and no JIT
   provisioning.
10. **Every surface follows the DGTL brand kit** (`engine/dgtl-brand-kit/`), and every pass is a
    **branded DGTL card**. On every tier: the DGTL⚡ PASS lockup, the gold spark and a gold primary
    button. Per tier: its own deep face colour, art field and labels, in four distinct hues: Steel
    blue, Bronze copper, Silver platinum, and VIP gold on black. (Revised twice on 2026-10-01.)
11. **The VIP invitation previews the pass and reveals the QR on accept**, and the offer renders
    only with marketing consent on file.
12. **Every email is blocked without a postal address and a preferences link** (sender
    identification).

## Open questions for Stephen (none block Phase 1)

1. **Pass host.** `https://pass.dgtl.ltd` is recommended. It becomes permanent with the first
   real pass (P0.3).
2. **Apple Developer account.** Is DGTL enrolled as an organisation? If not, start now (P0.4).
3. **First tenant.** Which venue, club or community runs the pilot? Its timezone, cutoff hour and
   postal address go into config.
4. **`sales` role scope.** Should front-of-house sales staff issue and scan (the current default),
   or should only `issuer` do so?
