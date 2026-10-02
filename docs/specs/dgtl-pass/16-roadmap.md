# 16 · After the MVP

Ordered by value to the "sellable B2B product" goal. Each item notes what the MVP already did to
make it cheap.

| # | Item | Why | Already in place |
|---|---|---|---|
| R1 | **Sell passes: Stripe checkout → automatic issuance** | Turns the module into revenue for tenants and a feature DGTL can price | `passes.source = 'checkout'`, `source_ref` (session id), `issue_request_id` idempotency = the webhook's event id; Stripe checkout + webhook fulfilment already exist in `lib/payments/stripe.js` |
| R2 | **Google Wallet** | Parity for Android holders | Tier colors and fields map 1:1 to Google generic/event-ticket classes; credential URL is the barcode value |
| R3 | **Renewals** | Monthly/yearly retention | "Expiring in 7 days" is already a filter; route it through the existing human-approved outreach engine |
| R4 | **Holder photo** on pass + scanner | Kills sharing of reusable passes | `generic` Wallet style has the `thumbnail` slot; scanner response has room for a signed photo URL |
| R5 | **Rotating QR on the pass page** (30 s TOTP over the credential) | High-value tiers where screenshots matter | Credential format is versioned; verification is server-side, so the scanner changes nothing |
| R6 | **Guest passes from a VIP's pass page** | Referral acquisition loop ([09](09-brand-and-tiers.md#growth-loops-roadmap-designed-now-so-the-data-exists)) | Holders, consent and issuance APIs exist; add a `parent_pass_id` |
| R7 | **Offline scanning** | Venues with no signal | Credential is versioned (`v1`); a signed `v2` + synced revocation list can coexist |
| R8 | **Per-tenant vanity pass hosts** (`pass.<tenant>.com`) | White-label polish | Scan host is already an allow-list |
| R9 | **Per-tenant Apple Pass Type IDs** | Enterprise tenants on their own Apple account | Signer config is isolated in `lib/passes/config.js` |
| R10 | **Audited "admit anyway" override** | Door edge cases (a VIP whose code was rotated) | Ledger exists; add `override_by` + reason |
| R11 | **Analytics** | Accept/Wallet/redemption funnels per tier | `first_viewed_at`, delivery rows and the ledger are the raw data |
| R12 | **Invite emails for staff; Sign in with Apple/Microsoft** | Onboarding polish | `user_identities.provider` already allows `apple`, `microsoft` |
| R13 | **Public API + API keys** (`source = 'api'`) | Partners and POS systems issue passes | Issuance is one function with idempotency |
| R14 | **RLS as defence in depth** | Belt and braces on tenant isolation | Every table already has `team_id`; add `set local app.team_id` per request + policies |
| R15 | **"I'm on the list" story card** | Social proof without leaking the QR | Brand kit renderer; a 1080×1920 variant of the pass card |
| R16 | **NFC** | Tap-to-enter | Needs an Apple NFC pass entitlement (application + approval) and NFC readers; a separate track |
