# 09 · Brand kit, tiers, and creative direction

**Every pass surface follows the DGTL brand kit in [`engine/dgtl-brand-kit/`](../../../engine/dgtl-brand-kit/SKILL.md).**
That includes emails, Wallet passes, the holder pass page, the scanner and the admin tab. Read the
kit's `SKILL.md`, `references/brand-tokens.md`, `references/ui-components.md`,
`references/application-guide.md` and, for anything inside `platform/`,
`references/repo-surfaces.md`. This document is how the kit applies to passes. Where the two
disagree, the kit wins.

**Design targets** (generated from the reference code + the kit's own token file and assets, so they
can't drift):

| Surface | File | Generator |
|---|---|---|
| Emails (7) + SMS | [`previews/index.html`](previews/index.html) | `reference/email/preview.js` |
| Apple Wallet passes, stack, back, artwork | [`previews/wallet.html`](previews/wallet.html) | `reference/ui/mockups.js` |
| Holder pass page (active, scheduled, expired) | [`previews/pass-page.html`](previews/pass-page.html) | `reference/ui/mockups.js` |
| Door scanner (start, scanning, manual, 4 verdicts, offline) | [`previews/scanner.html`](previews/scanner.html) | `reference/ui/mockups.js` |
| Admin Passes tab (overview, live scans, issue + live preview) | [`previews/admin.html`](previews/admin.html) | `reference/ui/mockups.js` |

## The kit rules, applied to passes

| Kit rule | On passes |
|---|---|
| Black surfaces everywhere: `#000` → `#0a0a0a` → `#111`, elevation by `#2a2a2a` border + shadow | Emails, pass page, scanner and admin all sit on the ladder. **Every Wallet card's background is on the ladder too** (`#111` Day, `#0a0a0a` Monthly/Yearly, `#000` VIP). No coloured cards, no grey panels |
| Gold `#F0CF50` is an accent: the primary action, THE number, active state, brand marks, **one gold moment per view** | Email: the primary button. Pass page: the VIP chip. Scanner: "Start scanning →" and the VIP band. Admin: active nav, active tab underline, the headline KPI, "Issue pass →" |
| Kickers/eyebrows `#b3a06a` gold-tan, 11–12 px, uppercase, `0.15em` | Every eyebrow and section label, in every email and UI |
| Text ladder `#F0F0F0` → `#D0D0D0` → `#8a8a8a` | Headline → body → labels/meta, everywhere |
| Manrope everywhere (400–800) | Email `<link>` + `Manrope, -apple-system, 'Segoe UI', Helvetica, Arial` fallback; web surfaces via `next/font` in the platform |
| Radii: controls 7 px, cards 16 px, pills 9999 px, nothing else | Enforced by test: the email renderer may emit only those (plus their corner-split forms) |
| Primary button: gold, black text 700, 7 px, trailing `→` | Every pass email CTA ("Open my pass →", "Accept my VIP pass →"), every primary button in the UI |
| Functional colors `#7BC47F` / `#E8A33D` / `#E5484D` / `#6E9FDB`, tint + text | Status badges in admin and the pass page. **Scanner verdicts fill the screen in them** (with black text): the one place the kit's tint rule is bent, because a dark door needs an answer at arm's length |
| Atmosphere: the spark bolt at low opacity, vignettes, glassy bars | Pass page and scanner: spark watermark in the tier material + glass top bar. Wallet: the spark as strip/thumbnail art. Email: none (the kit says identity by ratio, not effects) |
| Logo: `logo-white-gold.svg` | Web: the SVG. Email + Wallet: [`assets/dgtl-wordmark@4x.png`](assets/dgtl-wordmark@4x.png), rasterized from the kit SVG (`#F0CF50` and `#FFFFFF` verified exact). It spells the name, so `logoIncludesName: true` removes Wallet's duplicate `logoText` |
| Arrows after CTAs | In the copy defaults, and `withArrow()` adds one if an override forgets |
| `platform/` spells gold `--blue` | Platform components use `var(--blue)`, never `var(--gold)` (it doesn't exist there). See the kit's `repo-surfaces.md` |
| Never hardcode a brand value | Renderers resolve every color from `resolveBrandKit` → `DGTL_TOKENS`, drift-tested against **all three** token files (kit `dgtl-tokens.css`, `journal/_shared/dgtl-editorial.css`, and the platform alias layer in `dgtl-admin.css`) |
| Never invent DGTL clients, stats or testimonials | Passes need none. All sample people, numbers and offers in previews are fictional and labelled |

## The brand kit contract (resolution)

Emails and Wallet can't read CSS variables, so `resolveBrandKit(tenant)`
([`reference/brand.js`](reference/brand.js)) resolves literal values:

```
DGTL_TOKENS (mirrors the kit; brand.test.js fails on drift from any of the three token files)
   ⟵ tenant.brand            name · logoText · primaryColor
   ⟵ tenant.passes.brandKit  theme · colors · logoUrl · logoIncludesName · fontStack · sender · legal
   = { theme, name, logoText, logoUrl, logoIncludesName,
       colors{background,surface,surfaceRaised,line,text,textMuted,textDim,kicker,accent,onAccent},
       fontStack, sender, legal }
```

- **DGTL is the default, never an assumption.** No overrides gives you the kit exactly. A tenant
  with `primaryColor: "#2459E0"` gets blue buttons and no DGTL gold anywhere (tested). A tenant
  whose own brand is light can set `theme: "light"`, which uses the **kit's light-mode exception**
  values (`#f7f6f2` paper, `#111` text, `#e5e2d9` borders). DGTL itself is always dark.
- `accent` is the brand's **action** color. `kicker` is gold-tan, contrast-adjusted on light kits.
- **Task P2.3:** add `--tier-steel`, `--tier-bronze` and `--tier-silver` to the kit's
  `assets/dgtl-tokens.css` **and** `journal/_shared/dgtl-editorial.css` (the kit requires the two
  to stay identical) **and** `platform/app/admin/dgtl-admin.css`. Then make `tiers.js`
  `TIER_MATERIALS` mirror them with the same drift test. Gold is already `--gold` / `--blue`.

## The tier ladder: Steel → Bronze → Silver → Gold

The ladder is material-coded because everyone reads it instantly. How it lives inside the kit:

1. **The pass carries the material, the button carries the brand.** Tier color appears on the pass
   itself: the Wallet labels and artwork, and the email pass-card band, chip, material label and
   callout rail. The primary action is always the brand accent, so a DGTL day pass still has a
   gold button. That is the kit's one gold moment, on every tier.
2. **Gold is the material of VIP only.** No lower tier's pass is gold. In Wallet that means gold
   labels and a gold spark strip on pure black: the black card.
3. **Same black, different metal.** In a Wallet stack every card is near-black, and the label
   color (steel, bronze, silver, gold) identifies the tier at a glance (see the stack in
   `previews/wallet.html`).

| Tier | Material | Accent (labels, band, art) | Wallet background | Wallet text | Wallet style | Artwork |
|---|---|---|---|---|---|---|
| Day | Steel | `#A9B4C2` | `#111111` (`--surface-2`) | `#F0F0F0` | eventTicket | strip 375×98: steel spark watermark + hairline |
| Monthly | Bronze | `#D29666` | `#0a0a0a` (`--surface-1`) | `#F0F0F0` | generic | thumbnail 90×90: bronze spark |
| Yearly | Silver | `#DCE1E8` | `#0a0a0a` (`--surface-1`) | `#F0F0F0` | generic | thumbnail 90×90: silver spark |
| VIP Lifetime | Gold | `#F0CF50` (`--gold`) | `#000000` (`--bg`) | `#F0F0F0` | storeCard | strip 375×144: gold spark at full strength + glow |

Contrast is enforced by test: Wallet text ≥ 4.5:1, labels ≥ 3:1, and every accent ≥ 4.5:1 as
text on the email surface. `useBrandAccent: true` swaps the tier material for the tenant's brand
color and drops the material label (a blue pass is never called "Bronze").

## Email creative direction

One layout system, built to the kit's email guidance: table-based, solid black, inline styles,
bulletproof gold button, hosted wordmark PNG, no effects. Per tier, what changes is **material,
warmth of voice, alignment and ceremony**:

| | Day | Monthly | Yearly | VIP Lifetime | VIP Onboarding |
|---|---|---|---|---|---|
| Job | Get them through the door tonight | Make Wallet the habit | Welcome them for the year | Make it feel owned | Make them feel *chosen* |
| Layout | left-aligned, QR-first | left, Wallet-first | left, Wallet-first | centered, muted-gold frame | centered, frame, offer card |
| Hero line | "You're in, {firstName}." | "A month of access starts now." | "Your year starts today." | "Access that doesn't expire." | "The list is short. You're on it." |
| QR in email | yes, dominant | yes | yes | yes | **no, a preview card instead** |
| Primary button | gold "Open my pass →" | gold | gold | gold "Open my VIP pass →" | gold "Accept my VIP pass →" |
| Sign-off | — | — | — | "Welcome in." | personal, from a named person |

All copy is a default in [`reference/email/copy.js`](reference/email/copy.js). Tenants override any
line per pass type (`pass_types.email.copy`). Every email ends with the tenant's postal address,
the reason line, help + preferences links, and `© {year} {brand}. All rights reserved.`

## Voice rules (apply to every tenant's overrides too; enforce in review)

The kit's voice is "confident, energetic, results-first", with arrows on CTAs. On passes that
becomes:

1. **Promise only what the system enforces.** "No expiry" is true because `valid_until` is null.
   "Skip the line" is only allowed if the tenant's perks say so. The default copy never claims a
   perk.
2. **One idea per sentence. No exclamation marks.** Confidence reads as premium, and volume reads
   as a promo.
3. **Warmer as the tier climbs.** Day is practical, Monthly is habitual, Yearly is welcoming, and
   VIP is personal and uses the first name in the subject.
4. **Scarcity must be real.** "The list is short" is only true if the tenant keeps it short. The
   Issue form shows the live VIP count next to the invitation toggle. An offer expiry is a real
   date, never a countdown reset.
5. **No emoji in SMS** (keeps GSM-7 and one segment). No ALL-CAPS body copy. Eyebrows are
   letter-spaced small caps, which is typography, not shouting.

## VIP onboarding: the strategy

The onboarding email is the one message designed to *market*, so it is built like a campaign, not
a receipt.

- **The hook.** An invitation, not a ticket: "By invitation", then "The list is short. You're on
  it." It makes one claim, about selection, and everything after supports it.
- **The offer.** One concrete welcome with a real code and a real end date, set per tenant
  (`passes.vipOffer`) or per issue. It renders only with consent on file
  ([08-messaging.md](08-messaging.md#compliance-gates)).
- **The reveal.** The email previews the pass but **does not print the QR**. The gold **Accept my
  VIP pass →** opens the pass page, where the QR and Wallet live. That keeps it an invitation,
  creates a measurable event (`first_viewed_at`), and lands the holder where they can opt in to
  offers in their own hand (`pass_page_optin`).
- **The perks.** Three at most, numbered in gold-tan, concrete, from the pass type.
- **The signature.** A real person's name and title (`passes.sender`).

**Measure it** (overview tiles, then the ledger):

| Metric | Source |
|---|---|
| Invitation accept rate | `first_viewed_at` not null ÷ onboarding deliveries sent |
| Wallet add rate | `.pkpass` downloads (log them) ÷ accepts. Phase 5b gives true registrations |
| Offer redemption | redemptions reported by the tenant (POS). Roadmap: redeem-at-door flag on scan |
| First visit | first `valid` scan ÷ accepts |
| Retention (monthly/yearly) | scans per active pass per week |

## Growth loops (roadmap, designed now so the data exists)

- **The guest perk is acquisition.** "Bring a guest" becomes a one-time guest pass issued from the
  VIP's pass page, with the guest's email captured. That is a new holder, with consent, from a
  referral.
- **Expiry is a renewal moment.** "Expiring in 7 days" feeds a renewal campaign through the
  existing human-approved outreach engine.
- **Status is social.** A "share I'm on the list" story card (1080×1920, kit tokens + spark, *no
  QR, no code*) gives VIPs something to post without leaking the credential.
