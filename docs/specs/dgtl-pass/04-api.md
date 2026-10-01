# 04 · API contract

All routes live in `platform/app/`, run on the Node runtime (`export const runtime = "nodejs"`) and
return JSON. Admin and scan routes use the existing session cookie. Capability names refer to
[10-auth-and-roles.md](10-auth-and-roles.md).

**Error shape (everywhere):**

```json
{ "error": "Human-readable message.", "code": "machine_code", "field": "holder.email" }
```

| Status | When |
|---|---|
| 400 | validation (`code` names the rule, `field` the input) |
| 401 | no session (JSON callers, per `permissionDeniedResponse`) |
| 403 | role lacks the capability |
| 404 | not found **or** not in the caller's team (indistinguishable by design) |
| 409 | idempotency key reused by another team, or a state conflict (e.g. reactivating a revoked pass) |
| 429 | rate limited (`Retry-After` header) |
| 503 | `DATABASE_URL` unset (passes are Postgres-only) |

## Admin: passes

### `POST /api/admin/passes` — issue one pass · `pass.issue`

```json
{
  "tenantId": "tenant_dgtl",
  "passTypeId": "ptype_vip_lifetime_…",
  "holder": { "name": "Alex Rivera", "email": "alex@example.com", "phone": "+14165550100" },
  "startDate": "2026-10-03",
  "validFrom": null, "validUntil": null,
  "deliver": { "email": true, "sms": true, "template": "vip_onboarding" },
  "consent": { "basis": "express", "source": "issuer_attested", "note": "Signed up at the bar 2026-09-28" },
  "offer": { "title": "…", "body": "…", "code": "…", "expiresAt": "2026-10-31" },
  "issueRequestId": "form_7c1e…"
}
```

- `startDate` is required for day/month/year/lifetime types; `validFrom`/`validUntil` are required
  for `fixed` types and rejected otherwise.
- `deliver.template` is optional. It defaults to the pass type's `email.variant`, and
  `vip_onboarding` is allowed only for `is_vip` types.
- `consent` is optional and only recorded when `basis` is `implied` or `express`. It sets
  `pass_holders.marketing_consent*`. Without consent on file, a VIP invitation is still sent, but
  the offer is removed ([08-messaging.md](08-messaging.md)).
- `offer` is optional. It defaults to the tenant's `passes.vipOffer`.
- `issueRequestId` is required from the UI (generated per form render). Replaying it returns the
  original pass with `"replay": true` and sends nothing.

**201:**

```json
{
  "pass": { "id": "pass_…", "status": "active", "effectiveStatus": "active", "validFrom": "…", "validUntil": null,
            "shortCode": "V1PG-0LD8", "passTypeName": "VIP Lifetime", "holderName": "Alex Rivera" },
  "links": { "passPageUrl": "https://pass.…/p/…", "walletUrl": "https://pass.…/p/…/wallet.pkpass" },
  "deliveries": [
    { "channel": "email", "template": "vip_onboarding", "status": "sent", "marketing": true },
    { "channel": "sms", "template": "sms_vip", "status": "failed", "error": "Twilio: unverified number" }
  ],
  "warnings": ["wallet_badge_placeholder"],
  "replay": false
}
```

The response carries the pass **links** (so the admin can copy them) but never the raw credential
as a separate field. The link is the credential, so treat the response as sensitive: do not log it.

### `POST /api/admin/passes/preview` — render without issuing · `pass.issue`

Same body as issue, minus `issueRequestId`. Writes nothing. It returns
`{ email: { subject, preheader, html, blockers, warnings, marketing }, sms: { body, units, segments, encoding, warnings }, validity }`
from the real renderers, using a placeholder credential. The Issue form's live preview calls it
(debounced 400 ms). Render the HTML in an `<iframe sandbox>` with no `allow-scripts`.

### `GET /api/admin/passes` — list · `pass.view`

Query parameters: `tenantId`, `passTypeId`, `status` (effective status), `q` (name/email/phone/short
code), `expiringWithinDays`, `cursor`, `limit` (≤ 100). Returns rows without links. Links are
fetched per pass from the drawer (`GET /api/admin/passes/detail`) to keep list payloads free of
credentials.

### `GET /api/admin/passes/detail?passId=` · `pass.view`

Pass, holder (with consent state), type, deliveries, the last 50 scans, links, and the audit trail
for the pass.

### `POST /api/admin/passes/action` · capability per action

```json
{ "action": "revoke", "passId": "pass_…", "reason": "chargeback" }
```

| `action` | Capability | Effect |
|---|---|---|
| `revoke` | `pass.revoke` | status → revoked (terminal), `content_updated_at` bumped |
| `suspend` / `reactivate` | `pass.revoke` | reversible hold; reactivating a revoked pass is 409 |
| `resend` | `pass.issue` | new delivery rows for `{ email, sms, template }`, sent inline |
| `rotate` | `pass.revoke` | `credential_version + 1`. The old QR dies at once. Optionally resend |
| `extend` | `pass.revoke` | new `valid_until` (≥ current), `content_updated_at` bumped |

Every action writes `logAudit({ action: "pass.<action>", targetType: "pass", targetId, metadata: { teamId, … } })`.

### `POST /api/admin/passes/import` — bulk · `pass.issue`

`multipart/form-data` with `file` (CSV) + `tenantId`, `passTypeId`, `startDate`, `deliver`,
`dryRun`. Columns: `name,email,phone,start_date?`. Up to 500 rows (413 above). `dryRun: true`
returns per-row validation without writing. The real run issues all valid rows in one transaction
per 50 rows, enqueues deliveries (`scheduled_at = now()`), and returns counts. The cron drain sends
them. Reuses `lib/csv.js`.

### `GET /api/admin/passes/overview?tenantId=` · `pass.view`

```json
{ "active": 1284, "issuedToday": 147, "scansToday": 892, "admitsToday": 861, "deniesToday": 31,
  "expiringIn7Days": 42, "byTier": { "day": 610, "monthly": 402, "yearly": 219, "vip_lifetime": 53 },
  "recentScans": [ { "at": "…", "holderName": "…", "passTypeName": "…", "result": "valid", "gate": "Main door" } ] }
```

"Today" is the tenant's business day (timezone + cutoff), not UTC.

### `GET /api/admin/passes/scans` · `pass.view` · and `GET /api/admin/passes/export` · `pass.export`

Ledger with filters (`result`, `verifierId`, `gate`, `from`, `to`). CSV export of passes or scans.
Exports are audit-logged.

## Admin: pass types

`GET /api/admin/pass-types?tenantId=` · `pass.view`
`POST /api/admin/pass-types` · `pass.configure`:

```json
{ "action": "create", "tenantId": "…", "presetId": "monthly", "overrides": { "name": "Monthly — Student", "validity": { "count": 1 }, "design": { "useBrandAccent": true }, "email": { "copy": { "headline": "…" }, "perks": [] } } }
```

`action` ∈ `create | update | archive | reorder`. Updates never touch issued passes (invariant
I5). The response includes `resolvePassDesign` warnings (contrast) so the editor can show them.

## Scanner

### `GET /api/scan/session` · `pass.verify`

`{ user: { name, email }, team: { id, name }, tenants: [{ id, name }], gates: ["Main door", "VIP entrance"], allowedHosts: [...] }`.
Gates come from tenant config `passes.gates` (free text list). The scanner never needs anything else.

### `POST /api/scan/verify` · `pass.verify`

```json
{ "scanId": "scan_01J…", "raw": "https://pass.…/p/…", "inputKind": "qr", "gate": "Main door", "deviceLabel": "Door iPhone 2" }
```

**200** (always 200 for a verdict, including denials):

```json
{ "scanId": "scan_01J…", "result": "valid", "admit": true, "tone": "admit", "title": "Valid pass",
  "holderName": "Alex Rivera", "passTypeName": "VIP Lifetime", "tier": "vip_lifetime", "vip": true,
  "validUntil": null, "validityLabel": "Never expires", "useCount": 14, "maxUses": null,
  "lastUsedAt": null, "lastUsedGate": null, "retryAfterSeconds": null, "replay": false }
```

`result` ∈ `valid · recently_used · used · expired · not_yet_valid · revoked · suspended ·
not_found · invalid_format`. `not_found` and `invalid_format` carry only the first five fields.
Rate limit: 60 requests/minute per verifier and 600/minute per team. Beyond that the response is
429, and the scanner shows "Slow down".

## Public (holder)

| Route | Returns | Notes |
|---|---|---|
| `GET /p/[credential]` | HTML pass page | 404 on unknown; `noindex`, `no-store`, `no-referrer`; stamps `first_viewed_at` |
| `GET /p/[credential]/qr.png` | PNG, 600×600, QR level M, 4-module quiet zone | `Cache-Control: private, max-age=300` |
| `GET /p/[credential]/barcode.png` | PNG, Code 128 of the credential | same |
| `GET /p/[credential]/wallet.pkpass` | `application/vnd.apple.pkpass` | 404 when Apple is not configured; `Content-Disposition: attachment; filename="<brand>-pass.pkpass"` |
| `POST /p/[credential]/preferences` | `{ ok }` | holder opt-in to marketing from the pass page (sets express consent, source `pass_page_optin`) |
| `GET /email/preferences?t=` · `POST /api/passes/unsubscribe` | page / `{ ok }` | signed token (reuse `lib/outreach/unsubscribe.js` signing), one-click POST per RFC 8058 |

All public routes: 30 requests/minute per IP per credential prefix, and 300/minute per IP overall.

## Auth

| Route | Notes |
|---|---|
| `GET /api/auth/google/start?next=/scan` | sets a short-lived signed `oauth_tx` cookie (state, nonce, PKCE verifier, next); 302 to Google |
| `GET /api/auth/google/callback` | verifies state, exchanges code, verifies the ID token, links or rejects, creates the session, 303 to `next` (allow-listed paths only) |

## Cron and webhooks

| Route | Auth | Notes |
|---|---|---|
| `POST /api/cron/passes/drain` | bearer `PASSES_CRON_TOKEN` (constant-time, like `OUTREACH_CRON_TOKEN`) | sends due deliveries; `{ limit, dryRun }`; idempotent via claim CAS |
| `POST /api/webhooks/resend` | Svix signature (`RESEND_WEBHOOK_SECRET`) | delivered / bounced / complained → `pass_deliveries.status`; a complaint suppresses marketing |
| `POST /api/webhooks/twilio/sms` | `X-Twilio-Signature` | status callbacks + inbound STOP/START → `pass_holders.sms_opted_out_at` |

## Apple Wallet web service (Phase 5b)

Base: `webServiceURL = <PASS_PUBLIC_BASE_URL>/api/wallet`. Apple's paths, all under `/v1`:

| Method + path | Auth | Does |
|---|---|---|
| `POST /v1/devices/{deviceId}/registrations/{passTypeId}/{serial}` | `ApplePass <token>` | upsert registration (201 new, 200 existing) |
| `DELETE /v1/devices/{deviceId}/registrations/{passTypeId}/{serial}` | `ApplePass <token>` | remove registration |
| `GET /v1/devices/{deviceId}/registrations/{passTypeId}?passesUpdatedSince=` | none | serials updated since tag (204 if none) |
| `GET /v1/passes/{passTypeId}/{serial}` | `ApplePass <token>` | latest signed `.pkpass` (304 with `If-Modified-Since`) |
| `POST /v1/log` | none | log device errors (rate limited, truncated) |

The token is `deriveWalletAuthToken(passId)`, compared with `safeEqual`. Details in
[07-apple-wallet.md](07-apple-wallet.md).
