# 14 · Test plan

Everything runs under the platform's existing runner: `node --test tests/*.test.js`. There's no
new framework. Test ids are referenced from the build plan gates.

## Already written (reference, 84 tests)

```bash
# 75 unit tests, no dependencies (the 9 SQL tests in the same folder report as skipped here)
node --test docs/specs/dgtl-pass/reference/*.test.js docs/specs/dgtl-pass/reference/email/*.test.js

# + 9 SQL integration tests (platform migrations 001–008 + 009 in PGlite)
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

## To write during the build

### Unit (T-U)

| Id | Test |
|---|---|
| T-U1 | `verifyPassword(any, null)` is false, including `""` |
| T-U2 | capability matrix: every role × capability matches [10](10-auth-and-roles.md#roles-and-capabilities) |
| T-U3 | OAuth: state mismatch, nonce mismatch, `email_verified: false`, wrong `aud`, expired token each rejected (stub JWKS) |
| T-U4 | `next` allow-list: `//evil.com`, `https://evil.com`, `/admin/../x` rejected |
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
| T-C1 | 20 parallel `verifyScan` calls (separate pool clients) on one single-use pass → exactly 1 `valid`, 19 `used`, `use_count = 1`, 20 ledger rows |
| T-C2 | 10 parallel calls with the **same** scan id → 1 ledger row, all responses identical |
| T-C3 | 10 parallel issues with the same `issueRequestId` → 1 pass |

### Routes and security (T-R, T-S)

| Id | Test |
|---|---|
| T-R1 | **verifier sweep:** a verifier session against every `/api/admin/*` route handler → 403 (enumerate the `app/api/admin` tree so new routes are covered automatically) |
| T-R2 | issuer session: pass routes allowed per matrix; tenants/users/outreach routes 403 |
| T-S1 | `/p/<unknown>` and `/p/<rotated>` return identical 404 bodies |
| T-S2 | `/p/*` sets `noindex`, `no-store`, `no-referrer`; title never contains the holder name |
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
- Keep the existing suite count in CLAUDE.md honest. Update "356 tests" to the new total in the
  PR that changes it.
- No test sends a real email or SMS. The mock providers and `PASSES_DRY_RUN` exist for that.
