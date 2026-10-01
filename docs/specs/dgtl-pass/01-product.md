# 01 · Product

## One sentence

DGTL Pass lets a tenant issue branded, time-bound access passes (day, monthly, yearly, VIP lifetime)
by email and SMS. It puts them in Apple Wallet and verifies them at the door from any phone browser,
with the server as the only source of truth.

## Why it exists (the business case)

- **For DGTL:** a second sellable module on the Growth Platform. It fits the platform's direction:
  tenant-generic, config-driven, and a funnel a buyer can go through without a human (CLAUDE.md
  "The goal this repo serves"). Pass issuance is also the first product where a tenant's *customer*,
  not just their lead, lives on the platform.
- **For a tenant (a venue, studio, club, community or event):** memberships and tickets that look
  like their brand and never look like a generic ticketing app. The VIP tier becomes a retention
  and referral lever rather than just a discount code.
- **For the holder:** one tap into Wallet, no app to install, no account to create.

## Users

| User | Where | What they do |
|---|---|---|
| **Tenant owner / admin** | `/admin` → Passes | Set up pass types and the brand kit, issue and revoke, manage staff, read the scan ledger |
| **Issuer** (front desk, promoter) | `/admin` → Passes (issue only) | Issue and resend passes |
| **Verifier** (door staff) | `/scan` on their own phone | Sign in with Google, scan, get admit/deny |
| **Holder** | Email, SMS, `/p/<credential>`, Apple Wallet | Receive, open, add to Wallet, show at the door |

## Pass tiers (the default ladder)

| Preset | Tier | Validity | Entry | Wallet style | Material | Email |
|---|---|---|---|---|---|---|
| Single Entry | day | 1 day (tenant-local, optional late cutoff) | once | eventTicket | Steel | Day |
| Day Pass | day | 1 day | re-entry, 5-min cooldown | eventTicket | Steel | Day |
| Monthly Pass | monthly | 1 calendar month | re-entry, 5-min cooldown | generic | Bronze | Monthly |
| Annual Pass | yearly | 1 calendar year | re-entry, 5-min cooldown | generic | Silver | Yearly |
| VIP Lifetime | vip_lifetime | never expires | unlimited | storeCard | Gold (brand) | VIP Lifetime or VIP Onboarding |

"Different varieties" means a tenant can create any number of **pass types** per tier, such as
"Day Pass — Weekend", "Monthly — Student" or "3-Day Festival". Each type has its own name,
validity count, entry rule, colors, copy and perks. Presets in [`reference/tiers.js`](reference/tiers.js)
are starting points. A `fixed` validity kind covers one-off events with an explicit start and end.

## Core flows

1. **Set up** (one-time, admin): enable Passes on a tenant → confirm the brand kit (logo, colors,
   postal address, sender) → create pass types from presets.
2. **Issue** (admin/issuer): pick tenant + pass type → holder name + email and/or phone → start
   date → delivery (email, SMS, and "send as VIP invitation" for VIP types) → **Issue & send**.
   The result screen offers View pass, Copy link, Resend and Revoke.
3. **Bulk issue** (admin): CSV upload (≤ 500 rows) → preview + validation → queue → cron drains it.
4. **Receive** (holder): a tier-styled email with QR, code, **Add to Apple Wallet** and **Open my
   pass**. An SMS carries the pass link. The VIP invitation shows the offer and a pass preview,
   and the QR is revealed on **Accept**.
5. **Verify** (verifier): open `/scan` → Google sign-in (once per 12 h shift) → point at QR → a
   full-screen green, amber or red verdict with name, tier and validity → auto-return to the camera.
6. **Manage** (admin): search passes, revoke/suspend/reactivate, resend, rotate credential,
   read the scan ledger, export CSV.

## MVP scope

**In:**
- Pass types from presets.
- Single and CSV issuance.
- Email (5 variants) and SMS delivery.
- Holder pass page.
- QR plus a Code 128 fallback.
- Signed Apple Wallet `.pkpass` download.
- PWA scanner with Google OAuth.
- Verification ledger.
- Revoke, suspend and resend.
- Issuer and verifier roles.
- Consent capture and unsubscribe for the VIP offer.
- Overview dashboard.

**Out** (see [16-roadmap.md](16-roadmap.md)):
- Public selling. Checkout wiring is designed for, not built.
- Google Wallet.
- Live Wallet push updates (Phase 5b, not launch-blocking).
- Offline scanning.
- Holder photo on pass.
- Rotating/dynamic QR.
- NFC.
- Per-tenant Apple certificates.
- Renewal automation.
- Analytics beyond the overview.

## Definition of done for the MVP

The product is proven when, on production hardware:

1. An admin issues a VIP pass and a Day pass from the dashboard.
2. Both holders receive a correctly branded email and an SMS.
3. The VIP holder adds the pass to Apple Wallet on an iPhone.
4. A verifier signs in with Google on an **iPhone (Safari)** and an **Android phone (Chrome)** and
   scans both passes, from Wallet and from the email, and both are admitted.
5. A second scan of the Single Entry pass is refused as `used`. Two phones scanning it in the same
   second admit exactly once.
6. A revoked pass is refused, and a pass from another team reads as `not_found`.
7. Every scan is in the ledger, and every issue, revoke and resend is in `audit_logs`.
8. `npm test` and `npm run build` pass in `platform/`.

The acceptance checklist in [13-build-plan.md](13-build-plan.md#launch-acceptance) expands this.

## Success metrics (first 90 days after launch)

| Metric | Target | Why |
|---|---|---|
| Median scan-to-verdict time | < 600 ms on 4G | The door is the product |
| Wallet add rate (Apple devices) | > 60 % of iOS holders | Wallet is the retention surface |
| VIP invitation accept rate (pass page first view) | > 70 % | Measures the onboarding hook |
| Email delivery rate | > 98 % | Deliverability hygiene |
| False admits | 0 | Non-negotiable |
