# 13 · Build plan

Eight phases on one integration branch, `feature/dgtl-pass`, with one small branch per task
merged into it (CLAUDE.md git workflow). Each phase ends at a **gate**: the stated commands pass
and the acceptance items are demonstrated, with output pasted into the PR. Do not start a phase
before the previous gate is green.

**The critical milestone is the end of Phase 3:** issue a pass → show its QR → scan it from an
iPhone → verified against the database → admitted/refused → logged. Everything after that is
distribution, branding and scale.

```
P0 Prereqs ─ P1 Foundation ─ P2 Pass engine ─ P3 Scanner ★ ─ P4 Delivery ─ P5 Wallet ─ P6 Hardening ─ LAUNCH
                                                                              └ P5b Wallet updates (post-launch OK)
```

---

## P0 · Prerequisites (≈ 0.5 day, plus external lead time)

The repo's current priority is stabilisation (CLAUDE.md). This phase makes the release gate real
**before** a large module lands on it, and starts everything with outside lead times.

**Status 2026-10-01 (updated):** `main` already carries the **DGTL Core release gate**
(`.github/workflows/core-release-gate.yml`), a superset of P0.1–P0.2: npm ci, `npm audit --omit=dev`,
the 001–014 migration rehearsal with repeat execution, `npm run migrate` on Postgres 16, every
platform suite, the full `npm test`, staged rehearsals and `npm run build`. The separate
`platform-ci.yml` written for P0 is therefore retired. The gate had gone red on `main` (a stale test
since #42, plus new advisories). [PR #44](https://github.com/stfphen/dgtl/pull/44) restores it. P0.3–P0.7
are Stephen's (external accounts and settings).

| # | Task | Output | Status |
|---|---|---|---|
| P0.1 | ~~Add required CI~~ superseded by `core-release-gate.yml`. Fix it (#44) and mark `Required DGTL Core checkpoint` required on `main`. Was: add required CI: `cd platform && npm ci && npm test && npm run build` on every PR (GitHub Actions). Mark it required on `main` | `.github/workflows/platform-ci.yml` job `test-and-build`; audit finding 1 closed | **Written.** A clean `git archive` of the tree + `npm ci` + `npm test` (356/356) + `npm run build` (exit 0) with no `.env` passed locally. **Stephen:** push, then mark the check required in branch protection |
| P0.2 | Add a **Postgres service** job to CI (`postgres:17`, `DATABASE_URL`): `npm run migrate`, a second run must report up to date, **every migration file re-executes cleanly**, then any `tests/*.pg.test.js` (T-C1 lands in P3) | same workflow, job `migrations-postgres` | **Written.** Re-executing all eight migrations twice was verified in PGlite. First real-Postgres run happens on push |
| P0.3 | Confirm the **pass host** (recommended `pass.dgtl.ltd`) and add the DNS record + Coolify label | decision logged in `brain/50-Audit-Log/52-Decision-Log.md` | Stephen |
| P0.4 | Start **Apple Developer** enrolment/verification if DGTL isn't enrolled (D-U-N-S can take days) | account ready by P5 | Stephen |
| P0.5 | Start **Twilio sender registration** (A2P 10DLC or toll-free verification) | approved by P4 | Stephen |
| P0.6 | Create the **Google OAuth client** (web) and consent screen | client id/secret in the secrets store | Stephen |
| P0.7 | Verify the pass sending domain in **Resend** (SPF, DKIM, DMARC `p=none` + rua) | green in Resend | Stephen |

**Gate P0:** CI green on `main` with both jobs; the four external tracks started (not necessarily
done).

---

## P1 · Foundation: schema, roles, Google sign-in (≈ 2 days)

| # | Task | Files |
|---|---|---|
| P1.1 | Copy `migration/015_passes.sql` → `platform/migrations/015_passes.sql`; update the migrations table in `platform/README.md` | migration, README |
| P1.2 | Port the pure modules unchanged: `credentials.js`, `validity.js`, `verify.js`, `tiers.js`, `brand.js` → `brandKit.js` (import `readableForeground` from `lib/branding.js`, exporting it there) | `lib/passes/*`, `lib/branding.js` |
| P1.3 | Port the reference tests to `platform/tests/passes-*.test.js` (fix import paths; the brand drift test reads the CSS via `process.cwd()`) | tests |
| P1.4 | Roles: add `issuer`, `verifier` to `ALL_ROLES`; add the capability lists + helpers (`canIssuePasses`, `canVerifyPasses`, …); `verifyPassword(pw, null) → false` | `lib/permissions.js` (or `lib/passes/permissions.js`), `lib/users.js` |
| P1.5 | Google OIDC start/callback per [10-auth-and-roles.md](10-auth-and-roles.md); extract a shared `createSessionForUser(user)` from `createAdminSession` | `lib/auth.js`, `lib/auth/google.js`, `app/api/auth/google/*` |
| P1.6 | Login page: add "Continue with Google" under the password form | `app/admin/login/page.jsx` |
| P1.7 | Team tab: allow the new roles; "Add staff" creates password-less users | Team tab components + `app/api/admin/users` |
| P1.8 | Verifier redirect: `app/admin/page.jsx` sends `verifier` to `/scan` | `app/admin/page.jsx` |
| P1.9 | `lib/passes/config.js`: parse and validate env at boot (secrets ≥ 32 bytes, base URL https in prod, allowed hosts); `passesEnabled()`, `walletEnabled()` | config |

**Gate P1:** `npm test` (existing 536 + new) and `npm run build` green; `npm run migrate` on a
fresh DB and again on the same DB (idempotent); a Google login for an invited verifier lands on
`/scan`, and an uninvited Google account is refused; a verifier session gets 403 from every
existing `/api/admin/*` route (T-R1).

---

## P2 · Pass engine: types, issue, holder page, QR (≈ 3 days)

| # | Task | Files |
|---|---|---|
| P2.1 | Port `repository.js` → `lib/passes/store.js`; add list/detail/overview queries (effective status in SQL, see [03](03-data-model.md#pass-lifecycle)); 23505 retry wrapper | `lib/passes/store.js` |
| P2.2 | Tenant config `passes` block: schema in `lib/tenantValidation.js`, defaults in `defaultTenant.js`, editor section in the tenant editor | tenant validation/editor |
| P2.3 | Tier tokens (`--tier-steel-*`, `--tier-bronze-*`, `--tier-silver-*`: accent, face, field) → the brand kit's `engine/dgtl-brand-kit/assets/dgtl-tokens.css` **and** `journal/_shared/dgtl-editorial.css` (kept identical, per the kit) **and** `platform/app/dgtl-tokens.css`; `tiers.js` `TIER_PALETTE` mirrors them with a drift test | CSS ×3, `lib/passes/tiers.js`, test |
| P2.4 | Pass types API + editor (presets → overrides → contrast warnings) | `app/api/admin/pass-types`, `components/passes/PassTypeEditor.jsx` |
| P2.5 | `POST /api/admin/passes` (issue, no delivery yet), `…/action` (revoke/suspend/reactivate/rotate/extend), `GET` list/detail/overview; all audit-logged | `app/api/admin/passes/*` |
| P2.6 | QR + Code 128 images: `qrcode` + `bwip-js`, `lib/passes/images.js`, routes `qr.png` / `barcode.png` | `lib/passes/images.js`, `app/p/[credential]/*` |
| P2.7 | Holder pass page `/p/[credential]` per [11](11-admin-dashboard.md#the-holder-pass-page-pcredential), **matching [`previews/pass-page.html`](previews/pass-page.html)** (brand kit theming, state layouts, headers) | `app/p/[credential]/page.jsx` |
| P2.8 | Passes **Core routed module** `/passes`: Overview, Issue (live preview via `POST /api/admin/passes/preview`), list + detail, Pass types; nav item in `CoreShell.jsx` behind `pass.view`. **Matching [`previews/admin.html`](previews/admin.html)** (kit app components on `core.css` + `dgtl-tokens.css`) | `app/(core)/passes/*`, `components/passes/*`, `components/core/CoreShell.jsx` |

**Every UI gate (P2, P3, P5) also runs the DGTL brand kit's verification checklist**
(`engine/dgtl-brand-kit/references/application-guide.md`): desktop + 390 px screenshots compared
against the matching design target, gold sampled at `#F0CF50` in only its intended places, 7 / 16 /
9999 px radii, Manrope actually rendering, no horizontal scroll at 390 px.

**Gate P2:** an admin creates the five preset types for a tenant in the Core `/passes` module, issues one pass of each, opens
each pass page on a phone, and sees the right tier, state and QR. Revoke → the page shows
"revoked" with no QR. Double-clicking Issue creates one pass. Tests T-U*, T-I*, T-S1..S4 green.

---

## P3 · Scanner ★ (≈ 3 days)

| # | Task | Files |
|---|---|---|
| P3.1 | `POST /api/scan/verify` → `store.verifyScan` inside a pg transaction; 23505 retry; rate limits; `GET /api/scan/session` | `app/api/scan/*` |
| P3.2 | `/scan` PWA shell: layout, manifest (scope `/scan`), icons, own CSS | `app/scan/*` |
| P3.3 | Scanner component: start button (gesture unlock), `zxing-wasm` worker (self-hosted wasm), debounce, verdict screens, sounds, haptics, wake lock, torch, recent strip, gate picker, **matching [`previews/scanner.html`](previews/scanner.html)** (verdict fills `var(--success)` / `var(--warning)` / `var(--error)`, black text) | `components/scan/*`, `public/scan/*` |
| P3.4 | Manual entry with lockout | `components/scan/ManualEntry.jsx` |
| P3.5 | Scans ledger at `/passes/scans` + live scans on the Passes overview | `app/(core)/passes/scans`, `components/passes/ScanLog.jsx` |
| P3.6 | Real-Postgres concurrency test T-C1, added as an explicit step in `core-release-gate.yml` (its Postgres 16 service) | `tests/passes.pg.test.js`, workflow step |

**Gate P3 (the milestone):** on production-like HTTPS, run the device matrix in
[06-scanner.md](06-scanner.md#device-test-matrix-launch-gate). The two-phone double scan admits
exactly once, and T-C1 is green in CI. Record a short screen capture of iPhone and Android scans
for the PR.

---

## P4 · Delivery: email + SMS (≈ 3 days)

| # | Task | Files |
|---|---|---|
| P4.1 | Port `reference/email/*` → `lib/passes/email/*`; tests | `lib/passes/email/*` |
| P4.2 | `lib/integrations/sms.js` seam + Twilio + mock; provider tests | `lib/integrations/sms.js`, `twilioSms.js` |
| P4.3 | `lib/passes/deliver.js`: render → gates → send → record; retries; `drainDueDeliveries()` with CAS claim; quiet hours for bulk SMS | `lib/passes/deliver.js` |
| P4.4 | Wire delivery into issue/resend; result card with per-channel status + retry | issue route + UI |
| P4.5 | Consent: issue-form attestation, pass-page opt-in, preferences page, one-click unsubscribe (reuse token signing), suppression checks | `app/p/[credential]/preferences`, `app/email/preferences`, `app/api/passes/unsubscribe` |
| P4.6 | CSV bulk import (dry run + real), cron drain route + token | `app/api/admin/passes/import`, `app/api/cron/passes/drain` |
| P4.7 | Webhooks: Resend (Svix) + Twilio (status + STOP) | `app/api/webhooks/*` |

**Gate P4:** to real inboxes (Gmail web, Gmail iOS, Apple Mail iOS, Outlook web): all five
templates render correctly, links work, the QR scans *from the email* on the scanner, the plain
text part is present, and there is no spam-folder placement for the test domain. SMS arrives in
one segment, and STOP stops the next send. A render with no postal address is refused with a
clear admin message. The offer is absent for a no-consent holder. A 200-row CSV import drains
fully.

---

## P5 · Apple Wallet (≈ 2 days, needs the P0.4 account)

| # | Task | Files |
|---|---|---|
| P5.1 | Certificates → env per [07](07-apple-wallet.md#certificates-and-identity); gitignore `*.p12`, `*.pem` | `.gitignore`, `.env.example` |
| P5.2 | Port `passJson.js` + `walletArt.js`; copy the kit's `spark.svg` into `platform/assets/brand/` with a byte-identical drift test; rasterize strip/thumbnail/icon @1x/@2x/@3x with `sharp` (already present); upload `assets/dgtl-wordmark@4x.png` as the DGTL tenant logo (`logoIncludesName: true`); `lib/passes/wallet/pkpass.js` with `passkit-generator`; image cache. Must match [`previews/wallet.html`](previews/wallet.html) | `lib/passes/wallet/*`, `platform/assets/brand/` |
| P5.3 | `GET /p/[credential]/wallet.pkpass`; hide Wallet UI when not configured | route, pass page, email links |
| P5.4 | Upload the official Apple badge; set `PASS_WALLET_BADGE_URL` | media / env |

**Gate P5:** each of the five presets installs in Wallet on a real iPhone from both the email and
the pass page. Colors match the tier table, and the Wallet QR scans valid. An expired pass greys
out. The `wallet_badge_placeholder` warning is gone.

---

## P5b · Wallet updates (≈ 2 days; may ship after launch)

The web service endpoints, registrations, `content_updated_at` tagging, and APNs empty pushes
over `node:http2`. **Gate:** revoke on the admin → the pass on a real iPhone shows voided within
60 s.

---

## P6 · Hardening + launch (≈ 2 days)

| # | Task |
|---|---|
| P6.1 | `/security-review` over the full branch diff; fix highs; log in `61-Security-Review.md` |
| P6.2 | Log redaction for `/p/<credential>`; headers test (T-S5) |
| P6.3 | Load check: 50 verifies/s for 60 s against staging, p95 < 120 ms server time |
| P6.4 | Backups: confirm the passes tables are in the nightly dump (`45-Database-Backups.md`) |
| P6.5 | Runbook: door-staff one-pager (sign in, gate, verdict colors, "no connection" = don't admit) |
| P6.6 | Brain: module note `2I-Passes.md` → status *live*; timeline; env vars (`43-Environment-Variables.md`); routes (`14-Routes-Map.md`); data model (`13-Data-Model.md`) |

## Launch acceptance

Launch acceptance is everything in [01-product.md § Definition of done](01-product.md#definition-of-done-for-the-mvp),
plus the following:

- [ ] CI required and green: `npm test` (all), `npm run build`, Postgres job (migrate + T-C1)
- [ ] Device matrix passed on iPhone Safari, iPhone home-screen app, Android Chrome
- [ ] Two-phone single-use test admits once (video in the PR)
- [ ] All five email templates verified in Gmail web, Gmail iOS, Apple Mail iOS, Outlook web
- [ ] Official Apple Wallet badge in place; five presets install on a real iPhone
- [ ] SMS sender registered; one-segment delivery; STOP honoured
- [ ] Postal address + preferences link present in every email; the offer only renders with consent
- [ ] Verifier role cannot reach any `/admin` route (T-R1)
- [ ] Cross-team scan reads `not_found` and never leaks a name (T-I4)
- [ ] Security review highs resolved; secrets in the rotation doc
- [ ] Door-staff one-pager printed for the first venue
- [ ] Brand kit checklist passed on every surface against its design target in `previews/`

## Effort

≈ 15–17 engineering days for P0–P6 (P5b + 2), excluding external approvals. The long poles are
external: Apple enrolment and Twilio registration. That's why they start in P0.
