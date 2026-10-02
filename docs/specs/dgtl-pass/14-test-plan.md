# 14 · Test plan

Everything runs under the platform's existing runner: `node --test tests/*.test.js`. There's no
new framework. Test ids are referenced from the build plan gates.

## Already written (reference, 84 tests)

```bash
# 75 unit tests, no dependencies (the 9 SQL tests in the same folder report as skipped here)
node --test docs/specs/dgtl-pass/reference/*.test.js docs/specs/dgtl-pass/reference/email/*.test.js

# + 9 SQL integration tests (platform migrations 001–014 + draft 015 in PGlite)
npm i --prefix /tmp/pglite @electric-sql/pglite
PGLITE_PATH=/tmp/pglite/node_modules/@electric-sql/pglite node --test docs/specs/dgtl-pass/reference/repository.test.js
```

| Suite | Covers |
|---|---|
| `credentials.test.js` (9) | alphabet, secret parsing, derivation determinism and rotation, hashing, wallet token, normalisation, short codes, scan payload parsing incl. foreign host / insecure / junk |
| `validity.test.js` (11) | local-midnight windows, 4 am cutoff, multi-day, DST 25 h / 23 h days, ambiguous and skipped wall times, month/leap clamping, lifetime, fixed, bad input |
| `verify.test.js` (12) | every decision rule, half-open window, cooldown, derived status, admission patch, response PII stripping |
| `brand.test.js` (8) | **token drift vs all three token files** (brand kit `dgtl-tokens.css`, `dgtl-editorial.css`, and the `dgtl-admin.css` alias layer, where `--blue` is gold), kit radii, defaults (gold-tan kicker, black-on-gold, Manrope 400–800), overrides, fallbacks, kit light-mode values |
| `tiers.test.js` (11) | dark card faces (white text ≥ 7:1), **four tiers separated by colour** (RGB distance), gold brand mark on every tier but a tenant's own colour for tenants, action = brand accent, labels readable on their own face, VIP-only gold material, overrides, material label, warnings |
| `passJson.test.js` (6) | style per tier, identity fields, expiry/void, web service validation, wordmark suppresses `logoText`, no contact details |
| `walletArt.test.js` (5) | spark parsed from the kit file, branded strip (face + field + watermark + gold spark) per tier, VIP spotlight, Apple sizes, self-contained SVG |
| `email/email.test.js` (13) | **brand constants on every pass card** (wordmark ×2, PASS lockup, tier art), each tier's card face + labels in its own colour, five variants sendable, QR presence, **brand kit: gold 7 px button + arrow on every tier, gold-tan kicker, 700 headline, only the kit's radii, footer line, wordmark**, a light tenant's own button color with no DGTL gold leaking, tier colors + VIP frame, escaping, URL safety, compliance blockers, consent-gated offer + unsubscribe headers, copy overrides, badge warning, SMS segments |
| `repository.test.js` (9, PGlite) | migrations apply + idempotent, role constraint, issue→scan→used, scan replay, foreign-team `not_found` + ledger reason, team-scoped manual entry, issue idempotency + holder dedupe, cross-tenant pass type refused, revoked/expired/cooldown/junk, DB-level max-uses backstop |

## Written in Phase 1 (`platform/tests/`, 77 tests, all in `npm test`)

| Suite | Covers |
|---|---|
| `passes-{credentials,validity,verify,tiers,brand-kit}.test.js` (51) | the reference suites above, ported unchanged against `lib/passes/*` |
| `passes-foundation.test.js` (9, PGlite) | 001–015 re-run cleanly; live 015 equals the draft; role constraint; Google-only user has no password (**T-U1**); invite-only linking, sub match, link hijack and email reuse refused; disabled/teamless refused; session carries the role |
| `oauth-google.test.js` (7) | signed state tamper/expiry/weak secret, RFC 7636 PKCE vector, `next` allow-list (**T-U4**), authorize URL, redirect origin, ID token valid and rejected for aud/iss/nonce/unverified/expired/foreign key with a local RS256 JWKS (**T-U3**) |
| `passes-roles-config.test.js` (6) | capability matrix equals [10](10-auth-and-roles.md) (**T-U2**); pass-only roles hold no workspace rights; `requireSession` / `requirePassCapability`; pass config parsing |
| `route-guard-sweep.test.js` (4) | **T-R1** for `verifier` *and* `issuer` over **every** `app/api` route (not only `/api/admin`): 401/403/login, else listed on an explicit PUBLIC map with a reason; Core pages redirect pass-only staff to `/scan`. Mutation-tested: removing the central deny fails it with 14 leaking routes per role |

## Written in Phases 2–3 (`platform/tests/`, 34 more; 647 in `npm test`, 3 skip without Postgres)

| Suite | Covers |
|---|---|
| `passes-store.test.js` (7, PGlite) | Store behaviour on real SQL: |
| | • preset install is idempotent, and team-scoped |
| | • issue is idempotent; another team's type → 404; holder validation |
| | • door rules: single use, replay, cooldown warn, foreign host, a miss reveals nothing; the ledger count |
| | • http QR only from the dev host |
| | • holder lookup stamps `first_viewed_at`; revoke is terminal and team-scoped |
| | • list carries no credential; overview tier counts equal the Active KPI |
| | • Wallet copy columns + check constraint |
| `passes-walletwallet.test.js` (7) | WalletWallet, against a fake provider: |
| | • request carries our link as the barcode, and no email or phone |
| | • free presets stay distinct and never use green or red; Pro face colour |
| | • expiry rounding; bearer auth |
| | • `.pkpass` ZIP check; 429, 504 and foreign Google-link handling; revoke 404 = gone |
| | • **two taps → one provider pass**; a provider failure is recorded, not thrown |
| `passes-routes.test.js` (10) | **T-R2**: every pass route × every role against the capability matrix, plus a guard that a new pass route must join the matrix. No session → 401 |
| `passes-art.test.js` (3) | Spark byte-identical to the kit; gold spark on every tier's card art; the self-hosted `zxing_reader.wasm` hash equals the package's `ZXING_WASM_SHA256` |
| `passes.pg.test.js` (3, real Postgres) | **T-C1** 20 parallel scans → 1 admit; **T-C2** one scan id ×10 → 1 ledger row; **T-C3** one issue id ×10 → 1 pass. Needs `PASSES_PG_TEST_URL`; runs in the release gate |
| additions | Config: LAN base URL in dev only, WalletWallet provider config. Credentials: `insecureHosts`. `brand-tokens.test.js`: no hex in pass CSS; the scanner never makes a verdict gold |

## Written for Wallet branding (Phase 5 + WalletWallet Pro)

| Suite | Covers |
|---|---|
| `passes-pass-json.test.js` (6), `passes-wallet-art.test.js` (5) | The reference suites, ported unchanged |
| `passes-wallet-signing.test.js` (5) | DGTL-signed passes, with OpenSSL as the independent check:<br>• config refuses a wrong Pass Type ID, team, key or WWDR, and junk input<br>• all four tiers: manifest SHA-1s match, `openssl cms -verify` passes, `pass.json` has the tier face and labels, our link as the barcode, no email<br>• Apple's image sizes at @1x/@2x/@3x<br>• a tampered manifest fails<br>• the Wallet route signs on demand and records the first add |
| `passes-walletwallet.test.js` (+2) | Pro request: layout, tier face, strip 1080×360, icon 120×120, logo within 480×150, each image < 1 MB, body < 2 MB. A key not on Pro falls back to the free card and records why; an outage does not silently downgrade |

SQL tests use `@electric-sql/pglite` (devDependency) through `tests/support/migrated-pglite.js`.
Route handlers are imported directly via `tests/support/next-resolve-hook.mjs`.

## To write during the build

### Unit (T-U)

| Id | Test |
|---|---|
| T-U1 ✅ P1 | `verifyPassword(any, null)` is false, including `""` |
| T-U2 ✅ P1 | capability matrix: every role × capability matches [10](10-auth-and-roles.md#roles-and-capabilities) |
| T-U3 ✅ P1 | OAuth: state mismatch, nonce mismatch, `email_verified: false`, wrong `aud`, expired token each rejected (stub JWKS) |
| T-U4 ✅ P1 | `next` allow-list: `//evil.com`, `https://evil.com`, `/admin/../x` rejected |
| T-U5 | tenant `passes` config validation: bad timezone, cutoff out of range, missing postal address → blocker |
| T-U6 | SMS provider seam: not configured → envelope, dry run → mock, Twilio error mapping |
| T-U7 | delivery gates: opted-out SMS skipped; suppressed holder gets no offer; render blocked → skipped with reason |
| T-U8 | quiet hours: bulk SMS scheduled at 22:30 local waits until 09:00 |
| T-U9 | CSV import: header variants, bad email/phone rows reported, 501 rows → 413 |

### Integration (T-I, PGlite or the CI Postgres job)

| Id | Test |
|---|---|
| T-I1 | admin of team A: list/detail/action on team B's pass → 404 |
| T-I2 | issue with team A session + team B `tenantId` → 404 |
| T-I3 | revoke/suspend/rotate/extend audit rows carry `metadata.teamId` |
| T-I4 | scan response for a foreign pass contains no `holderName` (API level) |
| T-I5 | overview counts use the tenant business day (cutoff 4 → a 02:00 scan counts for yesterday) |
| T-I6 | rotate: old credential → `not_found`, new → valid, serial unchanged |
| T-I7 | delivery drain: two concurrent drains never send one delivery twice (claim CAS) |

### Concurrency (T-C, real Postgres only; CI service container)

| Id | Test |
|---|---|
| T-C1 ✅ P3 | 20 parallel `verifyScan` calls (separate pool clients) on one single-use pass → exactly 1 `valid`, 19 `used`, `use_count = 1`, 20 ledger rows |
| T-C2 ✅ P3 | 10 parallel calls with the **same** scan id → 1 ledger row, all responses identical |
| T-C3 ✅ P3 | 10 parallel issues with the same `issueRequestId` → 1 pass |

### Routes and security (T-R, T-S)

| Id | Test |
|---|---|
| T-R1 ✅ P1 | **verifier sweep:** a verifier session against every `/api/admin/*` route handler → 403 (enumerate the `app/api/admin` tree so new routes are covered automatically) |
| T-R2 ✅ P2 | issuer session: pass routes allowed per matrix; tenants/users/outreach routes 403 |
| T-S1 (manual ✓ 2026-10-02, automate) | `/p/<unknown>` and `/p/<rotated>` return identical 404 bodies |
| T-S2 (manual ✓ 2026-10-02, automate) | `/p/*` sets `noindex`, `no-store`, `no-referrer`; title never contains the holder name |
| T-S3 | `/p/<revoked>` renders no QR and no image route serves it (qr.png → 404 for revoked/expired/used) |
| T-S4 | rate limits: 31st request/min on one credential → 429 |
| T-S5 | request logs redact `/p/<credential>` |
| T-S6 | webhooks with a bad signature → 401, no state change |

### Manual (release)

The device matrix is in [06-scanner.md](06-scanner.md#device-test-matrix-launch-gate). The email
client matrix is Gmail web, Gmail iOS, Apple Mail iOS, Apple Mail macOS and Outlook web, in light
and dark modes. The Wallet matrix is the five presets on an iPhone, plus expiry greying and void
after Phase 5b.

## Rules

- Tests that need Postgres are gated on `PASSES_TEST_DATABASE_URL` (or PGlite) and **skip with a
  reason** otherwise, so `npm test` stays green on a laptop with no database. CI runs them.
- Keep the existing suite count in CLAUDE.md honest. Update the platform test count in CLAUDE.md to the new total in the
  PR that changes it.
- No test sends a real email or SMS. The mock providers and `PASSES_DRY_RUN` exist for that.
