# 09 · Brand kit, tiers, and creative direction

## The brand kit contract

Emails and Wallet passes can't read CSS variables, so the pass renderer resolves literal values
from one function, `resolveBrandKit(tenant)` ([`reference/brand.js`](reference/brand.js)):

```
DGTL_TOKENS  (mirrors journal/_shared/dgtl-editorial.css; brand.test.js fails on drift)
   ⟵ tenant.brand            name · logoText · primaryColor
   ⟵ tenant.passes.brandKit  theme · colors · logoUrl · fontStack · sender · legal
   = { theme, name, logoText, logoUrl, colors{background,surface,surfaceRaised,line,text,textMuted,textDim,accent,onAccent}, fontStack, sender, legal }
```

- **DGTL is the default, never an assumption.** With no overrides you get black `#000000`, gold
  `#F0CF50` and Manrope, the canonical tokens. A tenant with `primaryColor: "#2459E0"` and
  `theme: "light"` gets its own look from the same templates with zero code (see
  `previews/monthly-light-tenant.html`).
- Every color is validated (`#RRGGBB`), and an invalid value falls back to the default, so a typo
  can't produce an invisible email.
- Button text color is computed (`readableForeground`, same rule as the funnel). Accent *text* is
  nudged until it passes 4.5:1 on the surface (`ensureContrast`), which matters on light kits.
- **Task P2.3:** add the tier tokens below to `journal/_shared/dgtl-editorial.css` and
  `platform/app/admin/dgtl-admin.css` as `--tier-steel`, `--tier-bronze`, `--tier-silver`
  (gold is `--gold` / `--blue`). Make `tiers.js` mirror them with the same drift test `brand.js`
  uses. Until then they live only in `tiers.js`, and nowhere else.

## The tier ladder: Steel → Bronze → Silver → Gold

The ladder is material-coded because everyone already reads it: bronze < silver < gold needs no
explanation at the door, in the inbox, or in a Wallet stack. The rules are:

1. **Gold is earned.** `#F0CF50` is the DGTL signature, and in the default ladder only VIP wears
   it. A day pass that looked gold would spend the brand's most valuable signal on its cheapest
   product.
2. **Each tier is recognisable at arm's length.** In a Wallet stack the cards differ in
   background, not just accent: graphite, bronze, silver, and the black card.
3. **The VIP card is the brand at full strength.** Pure black with gold labels, a gold hairline
   frame on the email, a centered editorial layout, and personal sign-off.

| Tier | Material | Email accent | Wallet background | Wallet text | Wallet labels | Wallet style |
|---|---|---|---|---|---|---|
| Day | Steel | `#A9B4C2` | `#16191E` graphite | `#F0F0F0` | `#A9B4C2` | eventTicket |
| Monthly | Bronze | `#D29666` | `#7A4B2A` bronze | `#FFF4EA` | `#F2C9A5` | generic |
| Yearly | Silver | `#DCE1E8` | `#C7CDD4` silver | `#111418` | `#4A525C` | generic |
| VIP Lifetime | Gold | `#F0CF50` (token) | `#000000` (token) | `#F0F0F0` (token) | `#F0CF50` (token) | storeCard |

Contrast is enforced by test, not by eye. Every Wallet text/background pair is ≥ 4.5:1, every
label ≥ 3:1, and every email accent ≥ 4.5:1 as text on the dark surface.
Tenants can override any value per pass type. `useBrandAccent: true` swaps the tier accent for the
tenant's brand color and drops the material label (so a blue pass is never called "Bronze").

## Email creative direction

One layout system, deliberately not five designs. What changes per tier is **accent, warmth of
voice, alignment, and ceremony**:

| | Day | Monthly | Yearly | VIP Lifetime | VIP Onboarding |
|---|---|---|---|---|---|
| Job | Get them through the door tonight | Make Wallet the habit | Welcome them for the year | Make it feel owned | Make them feel *chosen* |
| Layout | left-aligned, QR-first | left, Wallet-first | left, Wallet-first | centered, gold frame | centered, gold frame, offer card |
| Hero line | "You're in, {firstName}." | "A month of access starts now." | "Your year starts today." | "Access that doesn't expire." | "The list is short. You're on it." |
| QR in email | yes, dominant | yes | yes | yes | **no, a preview card instead** |
| Sign-off | — | — | — | "Welcome in." | personal, from a named person |

All copy is a default in [`reference/email/copy.js`](reference/email/copy.js). Tenants override any
line per pass type (`pass_types.email.copy`).

## Voice rules (apply to every tenant's overrides too; enforce in review)

1. **Promise only what the system enforces.** "No expiry" is true because `valid_until` is null.
   "Skip the line" is only allowed if the tenant's perks say so. The default copy never claims a
   perk.
2. **One idea per sentence. No exclamation marks.** Confidence reads as premium, and volume reads
   as a promo.
3. **Warmer as the tier climbs.** Day is practical, Monthly is habitual, Yearly is welcoming, and
   VIP is personal and uses the first name in the subject.
4. **Scarcity must be real.** "The list is short" is only true if the tenant keeps it short. The
   admin UI shows the live VIP count next to the invitation toggle, so the claim stays honest. An
   offer expiry is a real date the system enforces, never a countdown reset.
5. **No emoji in SMS** (keeps GSM-7 and one segment). No ALL-CAPS body copy. The eyebrow labels are
   letter-spaced small caps, which is typography, not shouting.

## VIP onboarding: the strategy

The onboarding email is the one message in the system designed to *market*, so it is built like a
campaign, not a receipt.

**The hook.** An invitation, not a ticket: "By invitation", then "The list is short. You're on it."
It makes one claim, about selection, and every element after it supports that claim.

**The offer.** One concrete welcome with a real code and a real end date, set per tenant
(`passes.vipOffer`) or per issue. Example: "Your first night is on us". The offer is optional, and
it only renders with consent on file ([08-messaging.md](08-messaging.md#compliance-gates)).

**The reveal.** The email previews the pass (name, tier, "Never expires") but **does not print the
QR**. The primary action is **Accept my VIP pass**, which opens the pass page where the QR and
Wallet button live. This does three things:
- it keeps the moment an invitation rather than a ticket;
- it creates a measurable event (`first_viewed_at`), which is the accept rate;
- it puts the holder on a page where they can opt in to offers in their own hand
  (`pass_page_optin`), turning issuer-attested consent into express consent.

**The perks.** Three at most, numbered, and concrete. They come from the pass type, not the
template.

**The signature.** A real person's name and title (`passes.sender`). A VIP list that feels
curated by someone converts better than one sent by a brand.

**Measure it** (overview tiles, then the ledger):

| Metric | Source |
|---|---|
| Invitation accept rate | `first_viewed_at` not null ÷ onboarding deliveries sent |
| Wallet add rate | `.pkpass` downloads (log it) ÷ accepts. Phase 5b gives true registrations |
| Offer redemption | offer code redemptions reported by the tenant (POS). Roadmap: redeem-at-door flag on scan |
| First visit | first `valid` scan ÷ accepts |
| Retention (monthly/yearly) | scans per active pass per week |

## Growth loops (roadmap, designed now so the data exists)

- **The guest perk is acquisition.** A VIP perk like "bring a guest" becomes a one-time guest
  pass issued from the VIP's own pass page, with the guest's email captured. That is a new holder,
  with consent, from a referral.
- **Expiry is a renewal moment.** The overview's "expiring in 7 days" tile becomes a renewal
  campaign through the existing outreach engine (human-approved, per platform policy).
- **Status is social.** A "share I'm on the list" story card (1080×1920, brand kit, *no QR, no
  code*) generated from the pass page gives VIPs something to post without leaking the credential.
  It is a Journal-style asset feeding the top of the funnel.
