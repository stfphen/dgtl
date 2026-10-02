# 08 · Email + SMS delivery

## Templates

| Template id | Channel | Sent for | Kind | Rendered by |
|---|---|---|---|---|
| `day` | email | day passes | transactional | `renderPassEmail` |
| `monthly` | email | monthly passes | transactional | `renderPassEmail` |
| `yearly` | email | yearly passes | transactional | `renderPassEmail` |
| `vip_lifetime` | email | VIP passes (standard) | transactional | `renderPassEmail` |
| `vip_onboarding` | email | VIP passes (invitation + offer) | **commercial** when the offer renders | `renderPassEmail` |
| `sms_standard` | SMS | any non-VIP pass | transactional | `renderPassSms` |
| `sms_vip` | SMS | VIP passes | transactional | `renderPassSms({ vip: true })` |

Rendered previews: [`previews/index.html`](previews/index.html). Regenerate with
`node docs/specs/dgtl-pass/reference/email/preview.js`. Creative direction and copy rules are in
[09-brand-and-tiers.md](09-brand-and-tiers.md).

## Pipeline

```
issue / resend / import
   └─ insert pass_deliveries (status queued, template, recipient, marketing flag)
        ├─ single issue: deliverNow(deliveryId)  (inline, after COMMIT)
        └─ bulk: /api/cron/passes/drain every 2 min → claim (CAS on claim_token) → deliverNow

deliverNow(delivery)
   1. load pass + holder + type + tenant (team-scoped)
   2. suppression checks
        email marketing  → holder.email_suppressed_at or outreach suppression list → drop the offer
        sms              → holder.sms_opted_out_at → status skipped (skip_reason sms_opted_out)
   3. render (email: renderPassEmail · sms: renderPassSms)
        render.sendable === false → status skipped, skip_reason "render_blocked:<blockers>"
   4. send through the provider seam
        email → lib/integrations/emailProvider.js (Resend | mock), headers from render.headers
        sms   → lib/integrations/sms.js (Twilio | mock)       ← new, same seam shape
   5. record provider id / error, attempts + 1, sent_at
        retry policy: 3 attempts, backoff 1 m → 10 m → 60 m, then failed
```

- **The pass never depends on delivery.** A failed send leaves an active pass and a visible
  "Resend" in the admin. The holder can always be given the link by hand.
- **Dry run everywhere.** `PASSES_DRY_RUN=true` (or `dryRun` on the request) routes both channels
  through mock providers. Demos and staging never message real people.
- The **email seam already exists**. `sendOutreachEmail(message, { dryRun })` takes
  `{ from, to, subject, html, text, headers }`. Add a thin `sendPassEmail` alias, or generalise the
  name, rather than calling Resend directly.
- **SMS seam (new):** `lib/integrations/sms.js` exports
  `sendSms({ to, body, statusCallback }, { dryRun })` and returns the standard provider envelope
  (`providerSuccess` / `providerFailure` / `providerNotConfigured`, from `providerResponse.js`).
  Twilio call: `POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json` with
  `MessagingServiceSid` (preferred over a raw `From`, because it handles number pools, STOP and
  compliance), `To` and `Body`. The platform already depends on `twilio`, so reuse the SDK, or use
  `fetch` with basic auth to keep the seam dependency-free like `resend.js`.

## Email: technical rules (implemented in `render.js`)

- **DGTL brand kit, "Email / constrained surfaces":** solid black, table layout, inline styles,
  Manrope first with a system fallback stack, the bulletproof primary button in the brand accent
  (black text, 7 px radius, `15px 24px`, 16 px/700, trailing `→`), gold-tan kickers, `0.15em` labels,
  16 px cards on `#2a2a2a`, 9999 px pills, and identity through the black/gold/white ratio rather
  than effects. The logo is the hosted wordmark PNG ([`assets/dgtl-wordmark@4x.png`](assets/dgtl-wordmark@4x.png),
  shown at 28 px tall). The tests enforce the button, kicker, headline weight, the three radii and
  the footer line.
- Table layout, inline styles, 600 px container, a mobile stack under 620 px, and `role=presentation`.
- **Images are hosted, never `data:` URIs.** Gmail strips `data:`. The QR is
  `/p/<credential>/qr.png`, and the logo is an https PNG. SVG is not used in email. Resend also
  supports CID inline images (`attachments[].content_id`). Use them only if hosted images prove
  unreliable for a tenant.
- **Web font is progressive.** Manrope via Google Fonts `<link>` works in Apple Mail and iOS Mail.
  Gmail and Outlook fall back to `Helvetica Neue / Helvetica / Arial`. The layout is designed to
  hold with the fallback.
- **Dark by design.** `color-scheme: dark` meta so Apple Mail doesn't invert. Light tenant kits
  emit `light`.
- **Size.** Rendered HTML is 10–15 KB, far under Gmail's ~102 KB clipping threshold.
- **Preheader + plain-text part** are always generated. The text part contains every link.
- **Escaping.** Every interpolated value is HTML-escaped, and every URL goes through `safeUrl`
  (https, or http on localhost). Tested with a `<script>` holder name.

## Email: sending identity and deliverability

- **Send from a dedicated subdomain** per sending domain, e.g. `passes@mail.<tenant-domain>` or
  `passes@mail.dgtlmag.com` for DGTL-default tenants. It keeps pass mail reputation separate from
  outreach mail. Tenant sender = `passes.brandKit.sender.fromEmail`. It must be on a domain
  verified in Resend, and falls back to the platform default (`PASSES_DEFAULT_FROM`) otherwise.
- DNS per sending domain: Resend's SPF include + DKIM CNAMEs, **DMARC** at least `p=none` with
  reporting before launch, then `quarantine`. Checklist in
  [15-config-and-accounts.md](15-config-and-accounts.md).
- **Reply-To** is the tenant's `sender.replyTo` or `legal.supportEmail`, so holders reach a human.
- Bounce and complaint webhooks (`/api/webhooks/resend`) mark the delivery. A **complaint
  suppresses marketing** for that holder immediately.

## Compliance gates

*This is a product-design requirement set, not legal advice. Have counsel confirm before the first
commercial send. DGTL and its first tenants are in Canada, so CASL is the strictest regime in
play. CAN-SPAM (US) is satisfied by the same controls.*

| Message | CASL class | Consent needed? | Must include |
|---|---|---|---|
| Pass delivery emails (`day`, `monthly`, `yearly`, `vip_lifetime`) | s.6(6) transactional: delivers something the recipient is entitled to | **No** | sender identification + contact info + an unsubscribe/preferences mechanism (the CRTC's reading) |
| `vip_onboarding` **with offer** | commercial electronic message | **Yes**: express, or valid implied (e.g. an existing business relationship within 2 years) | the above + one-click unsubscribe, honoured within 10 business days |
| `vip_onboarding` **without offer** | transactional invitation + pass | No | the above |
| Pass SMS | transactional | No (carrier rules still apply) | brand name; STOP handling |

How the product enforces it:

1. **Every email** needs `passes.brandKit.legal.postalAddress` and a preferences URL, or
   `render.sendable` is false and nothing is sent (tested). The admin sees *which* field to fill.
2. **The offer renders only when `marketingAllowed`**: `pass_holders.marketing_consent` is
   `express`, or `implied` and not past `marketing_consent_expires_at`, **and** the holder is not
   suppressed. Otherwise the same invitation goes out without the offer or unsubscribe link, and
   the delivery records `marketing = false` (tested both ways).
3. **Consent capture:**
   - `issuer_attested`: the issue form's "This person agreed to receive offers" checkbox, with a
     required note. Recorded with the issuer's user id in the audit log.
   - `pass_page_optin`: the holder ticks "Send me VIP offers" on their pass page. This is express
     consent in their own hand, and the preferred source.
4. **Unsubscribe:** a signed token URL (reuse `lib/outreach/unsubscribe.js`) plus
   `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers (RFC 8058,
   and what Gmail and Yahoo bulk-sender rules expect). Unsubscribing sets `email_suppressed_at`.
   Future *transactional* pass emails still send, but the offer is removed.
5. **Audit trail:** every delivery row records `template` and `marketing`, every consent change
   is audit-logged, and implied consent carries its expiry.

## SMS specifics

- **One segment.** Copy is GSM-7 with no emoji. With a ~50-character link it stays under 160
  characters (`renderPassSms` counts segments and warns). This is tested with a real-length URL.
- **Opt-out line** on the first SMS to a number ("Reply STOP to opt out."). Twilio Advanced
  Opt-Out on the Messaging Service handles STOP/START/HELP. The inbound webhook mirrors it into
  `sms_opted_out_at`, so the platform never tries again.
- **Sender registration** is a launch dependency with lead time, so start it in Phase 0. US
  numbers need **A2P 10DLC** brand + campaign registration (days to weeks), or a **verified
  toll-free** number. Canadian long codes have their own carrier rules. Register the campaign as
  "account notifications / ticket delivery", and never send marketing from the transactional
  campaign.
- **Quiet hours for bulk:** the cron drain sends queued SMS only between 09:00 and 21:00 in the
  tenant's timezone. Single issues send immediately, since the holder is usually standing there.
- **Links** are on the tenant's pass host, never a public shortener (carrier filters penalise
  them).
