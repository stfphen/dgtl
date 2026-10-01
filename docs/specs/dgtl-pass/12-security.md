# 12 · Security

## Principles

1. **The server decides.** A QR is a lookup key. Nothing on the phone, in the pass or in the email
   can make a pass valid.
2. **Team is the boundary.** Every query that touches pass data filters on the session's
   `team_id`. There are no exceptions and no "system" shortcuts in request paths.
3. **Fail closed.** Unknown status, a network error, a missing config or a blocked render all mean
   deny, don't send, don't show.
4. **Store the least.** No credential plaintext, no raw IPs, no contact details in scanner
   responses or Wallet passes.
5. **Secrets stay server-side.** Apple keys, credential secrets, OAuth secrets, provider keys:
   env only, never a client bundle, never the repo, never a log line.

## Threats and controls

| # | Threat | Control | Verified by |
|---|---|---|---|
| T1 | Forged QR / guessed credential | 130-bit HMAC-derived code; lookup by hash only | credentials tests; no enumeration endpoint exists |
| T2 | Database dump turned into working passes | Only `sha256(credential)` stored; derivation needs `PASS_CREDENTIAL_SECRETS` | invariant I8; code review |
| T3 | Screenshot / forwarded pass | Single-use admits once; cooldown on reusable passes; holder name on scanner; `sharingProhibited`; roadmap photo + rotating QR | verify tests |
| T4 | Two scanners admit the same single-use pass | `FOR UPDATE` row lock + `use_count <= max_uses` check | PGlite test + real-PG concurrency test T-C1 |
| T5 | Replayed or double-submitted scan admits twice | Scan id primary key + stored response | repository test |
| T6 | Verifier at tenant A reads tenant B's holders | `decideScan` team check → `not_found`; short-code lookup team-filtered in SQL; response has no PII beyond name | repository + verify tests |
| T7 | Admin of team A issues/revokes in team B | Every admin route derives `team_id` from the session; pass type selected by `(id, team_id, tenant_id)`; revoke `where team_id = $team` | isolation tests T-I1..I5 |
| T8 | Verifier escalates into `/admin` | New roles absent from every existing `can*` list; admin page redirects verifier; route sweep test | T-R1 |
| T9 | Malicious QR at the door (phishing URL, injection payload) | `parseScannedPayload`: host allow-list, https only, path shape, length cap; rejected before any query | credentials tests |
| T10 | XSS via holder name in email / pass page / admin | Renderer escapes every value (tested); React escapes by default; no `dangerouslySetInnerHTML` except the email preview iframe (`sandbox` attribute, no scripts) | email tests + review |
| T11 | Open redirect via OAuth `next` | Allow-list of paths only | auth tests |
| T12 | OAuth CSRF / code injection / token replay | `state` + PKCE + `nonce` in a signed, 10-min, path-scoped cookie; ID token verified with JWKS, `aud`, `iss`, `exp`, `email_verified` | auth tests with a stub IdP |
| T13 | Google account takeover of a staff member | Identity matched by `sub` after first link; staff removal ends access at the next request; sessions 12 h | auth tests |
| T14 | Brute-force of short codes | Staff-only, team-scoped, 10 misses / 10 min lockout, every miss in the ledger | rate-limit tests |
| T15 | Credential leak via Referer / logs / analytics | `Referrer-Policy: no-referrer` on `/p/*`; request logging strips `/p/<credential>` to `/p/[redacted]`; no analytics scripts on `/p/*` or `/scan` | header test; log review |
| T16 | Email spoofing of a tenant | Send only from Resend-verified domains; SPF + DKIM + DMARC per domain | launch checklist |
| T17 | Cached verdict shown as fresh | No service-worker caching of API calls; `Cache-Control: no-store` on verify; every verdict carries its `scanId` | scanner review |
| T18 | Apple signing key exfiltration | Env only (base64 PEM); key passphrase separate; `**/*.p12`, `**/*.pem` gitignored; never logged; the pkpass route returns the pass, never errors containing config | review + secret scan |
| T19 | Webhook forgery (delivery status, STOP) | Svix signature (Resend), `X-Twilio-Signature` (Twilio), constant-time compare, reject on missing secret | webhook tests |
| T20 | Marketing sent without consent | Offer renders only with `marketingAllowed`; render is the gate, not the UI; `marketing` flag on every delivery | email tests |

## Secrets inventory (new)

| Secret | Used by | Rotation |
|---|---|---|
| `PASS_CREDENTIAL_SECRETS` (`k1:<b64>,…`) | credential + wallet token derivation | add a new key id and switch `PASS_CREDENTIAL_ACTIVE_KEY`; keep old keys while passes reference them |
| `PASSKIT_SIGNER_KEY_B64` + `PASSKIT_SIGNER_KEY_PASSPHRASE` | `.pkpass` signing, APNs | yearly with the Pass Type ID certificate |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth code exchange | on staff turnover with console access |
| `OAUTH_STATE_SECRET` | signs the `oauth_tx` cookie | any time (in-flight logins fail once) |
| `PASSES_CRON_TOKEN` | `/api/cron/passes/drain` | any time |
| `RESEND_WEBHOOK_SECRET`, Twilio auth token | webhooks + sends | per provider policy |

Add each to [`brain/40-Operations/44-Secrets-And-Rotation.md`](../../../brain/40-Operations/44-Secrets-And-Rotation.md) and `platform/.env.example`
(placeholders only) in the phase that introduces it.

## Security review gate

Before launch, run the repo's `/security-review` over the full pass branch diff and resolve
everything rated high. Record the result in `brain/60-Reference/61-Security-Review.md`.
