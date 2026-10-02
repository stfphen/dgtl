# 15 · Configuration and external accounts

## Environment variables (add to `platform/.env.example` with placeholders, per phase)

| Variable | Phase | Required | Example / format | Notes |
|---|---|---|---|---|
| `PASS_PUBLIC_BASE_URL` | P2 | yes | `https://pass.dgtl.ltd` | **Permanent once passes ship**; encoded in every QR |
| `PASS_ALLOWED_SCAN_HOSTS` | P2 | no | `pass.dgtl.ltd,localhost` | defaults to the host of `PASS_PUBLIC_BASE_URL`; keep old hosts here forever |
| `PASS_CREDENTIAL_SECRETS` | P1 | yes | `k1:<base64 ≥32 bytes>` | `openssl rand -base64 48`; comma-separate for rotation |
| `PASS_CREDENTIAL_ACTIVE_KEY` | P1 | yes | `k1` | key id new passes use |
| `PASSES_DRY_RUN` | P4 | no | `true` | mock both channels (staging, demos) |
| `PASSES_DEFAULT_FROM` | P4 | yes | `DGTL Passes <passes@mail.dgtlmag.com>` | used when a tenant has no verified sender |
| `PASSES_CRON_TOKEN` | P4 | yes | random 32+ chars | bearer for `/api/cron/passes/drain` |
| `RESEND_API_KEY` | P4 | exists | — | already used by outreach |
| `RESEND_WEBHOOK_SECRET` | P4 | yes | `whsec_…` | Svix signing secret |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | P4 | exists | — | already used by telephony |
| `TWILIO_MESSAGING_SERVICE_SID` | P4 | yes | `MG…` | Messaging Service with Advanced Opt-Out on |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | P1 | yes | — | Web application client |
| `OAUTH_STATE_SECRET` | P1 | yes | random 32+ bytes | signs the `oauth_tx` cookie |
| `PASSKIT_TEAM_ID` | P5 | for Wallet | `ABCDE12345` | Apple Team ID |
| `PASSKIT_PASS_TYPE_ID` | P5 | for Wallet | `pass.io.dgtl.passes` | |
| `PASSKIT_SIGNER_CERT_B64` / `PASSKIT_SIGNER_KEY_B64` | P5 | for Wallet | base64 PEM | server-only |
| `PASSKIT_SIGNER_KEY_PASSPHRASE` | P5 | if the key is encrypted | — | |
| `PASSKIT_WWDR_CERT_B64` | P5 | for Wallet | base64 PEM (WWDR G4) | |
| `PASS_WALLET_BADGE_URL` | P5 | for launch | https PNG | official Apple badge |
| `PASSES_TEST_DATABASE_URL` | tests | CI | `postgres://…` | enables T-C* |

Validation at boot lives in `lib/passes/config.js`. A **missing optional provider disables that
feature**, so the UI hides Wallet and SMS shows "not configured". A **malformed** value
(short secret, `http://` base URL in production) **throws**, so the misconfiguration is caught at
deploy, not at the door.

## External accounts (start in P0; lead times noted)

### Apple Developer: Wallet (lead time: days, if enrolling)
- [ ] Apple Developer Program, organisation account (requires a D-U-N-S number)
- [ ] Pass Type ID `pass.io.dgtl.passes` (or DGTL's reverse domain)
- [ ] Pass Type ID certificate from a CSR, exported `.p12`, converted to PEM, base64 into env
- [ ] Apple WWDR G4 intermediate certificate
- [ ] Record the certificate expiry in `44-Secrets-And-Rotation.md`
- [ ] Download the official "Add to Apple Wallet" badge artwork (Apple Wallet marketing resources)

### Google Cloud: OAuth (lead time: an hour; longer if the consent screen needs verification)
- [ ] Project + OAuth consent screen (External; scopes `openid email profile` only; no sensitive
      scopes, so no Google verification review should be needed)
- [ ] Web client with authorized redirect URIs:
      `http://localhost:8088/api/auth/google/callback`, staging, production

### Twilio: SMS (lead time: days to weeks)
- [ ] Messaging Service with Advanced Opt-Out (STOP/START/HELP) enabled
- [ ] Sender: **A2P 10DLC** brand + campaign (US numbers), or **toll-free verification**; check
      current Canadian carrier requirements for the sender type chosen
- [ ] Campaign use case: account notifications / ticket delivery (transactional only)
- [ ] Status callback + inbound webhook → `/api/webhooks/twilio/sms`

### Resend: email (lead time: DNS propagation)
- [ ] Sending domain verified (SPF include, DKIM CNAMEs) for `mail.dgtlmag.com` and each tenant
      domain that sends as itself
- [ ] DMARC record: start `p=none; rua=mailto:…`, move to `quarantine` after 2 clean weeks
- [ ] Webhook → `/api/webhooks/resend` (delivered, bounced, complained); copy the signing secret

### DNS + hosting
- [ ] `pass.<domain>` A/CNAME → the VPS; Coolify/Traefik label on the platform container for the
      new host (same container, no new service)
- [ ] HTTPS certificate issued (the scanner camera will not start without it)
- [ ] Host crontab: `*/2 * * * * curl -fsS -XPOST -H "Authorization: Bearer $PASSES_CRON_TOKEN" https://<app host>/api/cron/passes/drain`

## New dependencies (all MIT/BSD/Apache, justified)

| Package | Where | Why not hand-roll |
|---|---|---|
| `qrcode` | server (`lib/passes/images.js`) | QR encoding + error correction |
| `bwip-js` | server | Code 128 rendering |
| `passkit-generator` | server | manifest hashing + PKCS#7 signing + zip, maintained against Apple's format |
| `jose` | server | ID-token signature/claims verification against JWKS |
| `zxing-wasm` | client, `/scan` only, lazy | QR + Code 128 decoding on iOS Safari, which lacks `BarcodeDetector` |
| `@electric-sql/pglite` | **devDependency** | in-process Postgres for SQL tests without Docker |

Add them in the phase that needs them, not all at once.
