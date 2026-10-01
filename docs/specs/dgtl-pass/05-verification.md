# 05 · Verification

> The QR code is a credential, not a claim. It never says "valid". It says "look me up". The
> server decides, every time.

## Credential

Implemented and tested in [`reference/credentials.js`](reference/credentials.js).

```
credential = CrockfordBase32( HMAC-SHA256( secret[keyId], "dgtl-pass:v1:" + passId + ":" + version ) )[0..26]
stored     = sha256(credential)  →  passes.credential_hash (unique)
             keyId               →  passes.credential_key_id
             version             →  passes.credential_version
QR         = <PASS_PUBLIC_BASE_URL>/p/<credential>
Code 128   = <credential>                  (26 chars, uppercase alphanumerics)
Manual     = short_code, shown as XXXX-XXXX (40 bits, staff-only lookup)
```

| Property | Why it matters |
|---|---|
| 130 bits of entropy | Unguessable. There is no enumeration surface |
| No PII, no expiry, no tier in the code | Screenshots and leaked links reveal nothing; changing a pass never changes its code |
| Only the hash is stored | A database leak alone cannot produce working QR codes (needs `PASS_CREDENTIAL_SECRETS` too) |
| Derivable, not random | The server can re-render any email, QR or `.pkpass` without storing the secret code |
| Verification never needs the secret | `/api/scan/verify` hashes what it was given and looks it up. The secret stays on the rendering path |
| Crockford alphabet (no I/L/O/U) | Survives being read aloud or typed; `normalizeCode` folds O→0, I/L→1 |
| QR is a URL | A holder who scans it with their camera lands on their own pass page. Staff scanners parse it |
| Host allow-list | A QR on any other host is rejected before it touches the database (`parseScannedPayload`) |

**Rotation** (`action: rotate`) bumps `credential_version`, so the code and hash change and the old
QR stops resolving immediately. A Wallet copy updates via the Phase 5b push, or the holder is
resent.
**Key rotation:** add `k2` to `PASS_CREDENTIAL_SECRETS`, set `PASS_CREDENTIAL_ACTIVE_KEY=k2`. New
passes use `k2`, and old passes keep rendering with `k1`. Never delete a key while passes
reference it, or they can no longer be re-rendered (they still *verify*, since that only needs the
hash).

## The decision

`decideScan({ pass, now, scannerTeamId })` in [`reference/verify.js`](reference/verify.js) is
pure. Rules run in this order and the first match wins:

| # | Condition | Result | Admit | Tone |
|---|---|---|---|---|
| 1 | no pass matched the hash / short code | `not_found` | ✗ | deny |
| 2 | pass belongs to another team | `not_found` (+ `internalReason: foreign_team`) | ✗ | deny |
| 3 | `status = revoked` | `revoked` | ✗ | deny |
| 4 | `status = suspended` | `suspended` | ✗ | deny |
| 5 | unknown stored status | `not_found` (+ `unknown_status`) — fail closed | ✗ | deny |
| 6 | `now < valid_from` | `not_yet_valid` | ✗ | warn |
| 7 | `valid_until` set and `now ≥ valid_until` | `expired` | ✗ | deny |
| 8 | `max_uses` set and `use_count ≥ max_uses` | `used` (+ last used at/gate) | ✗ | deny |
| 9 | cooldown > 0 and `now − last_used_at < cooldown` | `recently_used` (+ retry after) | ✗ | warn |
| 10 | otherwise | `valid` | ✓ | admit |

Unparseable input never reaches the lookup. It is recorded as `invalid_format` with the parser's
reason: `foreign_host`, `insecure_url`, `bad_path`, `unrecognized`, `too_long` or `empty`.

**Why revoked outranks expired:** a revoked pass at the door is a signal (chargeback, fraud,
ejection) that staff should see, even if it has also expired.
**Why foreign passes read as `not_found`:** tenants are separate customers. Telling a verifier
"this pass is valid at a different venue" leaks the existence of another tenant's holder.
**Why `now` is the database's:** phones have wrong clocks, and scanners across a venue must agree.
The server takes `select now()` inside the transaction.

## The transaction

Implemented in [`reference/repository.js`](reference/repository.js) `verifyScan` and exercised
against real SQL in `repository.test.js`:

```sql
BEGIN;
  -- 1. idempotent replay: the scanner retries with the same scanId on a flaky network
  SELECT team_id, response FROM pass_scans WHERE id = $scanId;      -- hit → return stored response
  -- 2. one clock
  SELECT now();
  -- 3. find + lock
  SELECT * FROM passes WHERE credential_hash = $hash FOR UPDATE;     -- or: team_id = $team AND short_code = $code
  -- 4. decideScan(...) in JS
  -- 5. only on admit
  UPDATE passes SET use_count = $n, first_used_at = $f, last_used_at = now(), last_used_gate = $gate WHERE id = $id;
  -- 6. always
  INSERT INTO pass_scans (id, team_id, pass_id, verifier_id, result, internal_reason, admitted, …, response) VALUES (…);
COMMIT;
```

**Double admission is impossible.** Two phones scan the same single-use pass in the same
millisecond. Both transactions reach step 3, and one gets the row lock while the other blocks.
The first admits, increments `use_count` to 1 and commits. The second then reads the *committed*
row (`use_count = 1`), and rule 8 returns `used`. `check (use_count <= max_uses)` is the database
backstop if application code is ever wrong (tested).

**Double submission is harmless.** The same scan id arriving twice returns the stored verdict,
because `pass_scans.id` is the primary key. If both arrive concurrently, the second `INSERT` hits
the primary key after the first commits and raises 23505. The route catches 23505, re-runs, and
step 1 returns the stored response.

**What the scanner sees** is `scanResponse(...)`: result, tone, holder *name*, pass type, tier, VIP
flag, validity label, use counts, and last used at/gate. It never includes email, phone,
credential, short code or `internalReason`. This is tested.

## Anti-passback (re-entry cooldown)

A reusable pass (monthly, yearly, day re-entry) could be handed back through the fence to a
friend. `reentry_cooldown_seconds` (preset: 300 for re-entry types, 0 for VIP) returns
`recently_used` with the gate and time of the last admit. The scanner shows amber: "Scanned 2 min
ago at Main door". The cooldown counts from the last *admit*, so a denied scan does not reset it.
MVP has no "admit anyway" override. Door staff escalate to an admin, who can see the ledger. An
audited override is roadmap.

## Screenshots and sharing

A static QR can be screenshotted. This is inherent in every email and Wallet ticket, and the
design limits the damage:

- **Single-use passes** admit once. A copy is worth nothing after the first scan.
- **Reusable passes** have the cooldown, and the scanner shows the **holder's name** so staff can
  check ID for VIP or suspicious scans. Wallet sets `sharingProhibited`.
- **Roadmap:** holder photo on the pass and scanner (the Wallet `thumbnail` slot already exists on
  generic passes), and a rotating QR on the pass page (TOTP-style, 30 s) for high-value tiers. Both
  are additive: the credential model does not change.

## Offline

**MVP scanning is online-only and fails closed.** No network means the scanner shows "No
connection — can't verify" in red and admits nobody. This is deliberate. An offline mode needs
signed, self-validating codes (e.g. an Ed25519-signed payload with an expiry) plus a revocation
list synced to the device, and reconciliation of double-admits after the fact. That is a different
security model with real failure modes, and venues with bad signal can use venue Wi-Fi. It is
roadmap, and the credential format is versioned (`dgtl-pass:v1`) so a signed `v2` can sit
alongside.

## Rate limits and abuse

| Surface | Limit | Store |
|---|---|---|
| `POST /api/scan/verify` | 60/min per verifier, 600/min per team | `lib/rateLimit.js` (in-process; fine for the single-container VPS, move to Redis if scaled out) |
| `/p/[credential]*` | 30/min per IP per credential, 300/min per IP | same |
| Manual short-code entry | 10 misses per 10 min per verifier → 15 min lockout on manual entry | same |

Short-code math: 40 bits is about 1.1 × 10¹² codes. A team with 10,000 live passes gives each
blind guess a ~1-in-10⁸ chance. The lockout caps an authenticated verifier at under 1,000
guesses a day, so the expected time to hit *any* pass is roughly three centuries, and every miss
is in the ledger. Credentials are 130 bits and are not guessable at all.
