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
| Passes module in the Core shell (overview, live scans, issue + live preview) | [`previews/admin.html`](previews/admin.html) | `reference/ui/mockups.js` |

## The kit rules, applied to passes

| Kit rule | On passes |
|---|---|
| Black surfaces everywhere: `#000` → `#0a0a0a` → `#111`, elevation by `#2a2a2a` border + shadow | Emails, pass page, scanner and admin all sit on the ladder. **The pass card itself is a deep tier tint** (navy, deep copper, slate, black), dark enough that white text reads at ≥ 11:1 (tested), so it stays inside "dark surfaces" while each tier is its own colour |
| Gold `#F0CF50` is an accent: the primary action, THE number, active state, **brand marks**, one gold moment per view | **The gold DGTL spark is the brand mark on every pass** (Wallet art, email card, pass page). The only gold *control* in a view is the primary button. Gold as a tier colour (face glow, labels, band) is VIP-only. Admin: active nav, active tab, the headline KPI, "Issue pass →" |
| Kickers/eyebrows `#b3a06a` gold-tan, 11–12 px, uppercase, `0.15em` | Every eyebrow and section label, in every email and UI |
| Text ladder `#F0F0F0` → `#D0D0D0` → `#8a8a8a` | Headline → body → labels/meta, everywhere |
| Manrope everywhere (400–800) | Email `<link>` + `Manrope, -apple-system, 'Segoe UI', Helvetica, Arial` fallback; web surfaces via `next/font` in the platform |
| Radii: controls 7 px, cards 16 px, pills 9999 px, nothing else | Enforced by test: the email renderer may emit only those (plus their corner-split forms) |
| Primary button: gold, black text 700, 7 px, trailing `→` | Every pass email CTA ("Open my pass →", "Accept my VIP pass →"), every primary button in the UI |
| Functional colors `#7BC47F` / `#E8A33D` / `#E5484D` / `#6E9FDB`, tint + text | Status badges in admin and the pass page. **Scanner verdicts fill the screen in them** (with black text): the one place the kit's tint rule is bent, because a dark door needs an answer at arm's length |
| Atmosphere: the spark bolt at low opacity, vignettes, glassy bars | The pass art: a giant tier-colour spark watermark behind the crisp gold spark. Pass page + scanner: spark watermark + glass top bar. Email: the art strip PNG only (no CSS effects) |
| Logo: `logo-white-gold.svg` | Web: the SVG. Email + Wallet: [`assets/dgtl-wordmark@4x.png`](assets/dgtl-wordmark@4x.png), rasterized from the kit SVG (`#F0CF50` and `#FFFFFF` verified exact). With `walletLogoText: "PASS"` it forms the **DGTL⚡ PASS lockup** on every card. `logoIncludesName` stops a second "DGTL" |
| Arrows after CTAs | In the copy defaults, and `withArrow()` adds one if an override forgets |
| Platform tokens live in `platform/app/dgtl-tokens.css` (CLAUDE.md) | Platform components use the canonical names, `var(--gold)`, `var(--text-primary)`, `var(--success)` etc., from the one token layer every authenticated surface loads. `tests/brand-tokens.test.js` enforces it. (The older `--blue` alias in `dgtl-admin.css` is legacy) |
| Never hardcode a brand value | Renderers resolve every color from `resolveBrandKit` → `DGTL_TOKENS`, drift-tested against **all three** token files (kit `dgtl-tokens.css`, `journal/_shared/dgtl-editorial.css`, and `platform/app/dgtl-tokens.css`) |
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
  to stay identical) **and** `platform/app/dgtl-tokens.css`. Then make `tiers.js`
  `TIER_PALETTE` mirror them with the same drift test. Gold is already `--gold` in all three.

## The pass card: brand constants + tier colour

Revised 2026-10-01 after review ("the passes don't look DGTL"). Every pass is now a **branded card
system**, built the way premium membership cards are: the brand is constant and the colour says the
tier.

| Brand constants (every pass, every tier) | Tier variables (one per pass type) |
|---|---|
| The **DGTL⚡ PASS lockup**: the wordmark at full Wallet logo size + `walletLogoText` "PASS" | The **card face**: a deep tint of the tier hue (Wallet `backgroundColor`, email and pass-page card) |
| The **gold DGTL spark** as the hero mark, crisp, right side of the art | The **art field**: the tier hue glowing in from the right behind the spark |
| White Manrope values, `0.15em` uppercase labels, gold primary button | The **accent**: labels, card band, chip, giant spark watermark, base hairline |
| The same art PNG in Wallet, the email and the pass page | Wallet style: eventTicket (Day) or storeCard (memberships, VIP) |

| Tier | Hue | Accent | Face | Field | Wallet style | Strip |
|---|---|---|---|---|---|---|
| Day | Steel blue | `#8DB4E8` | `#13294A` | `#2A5A99` | eventTicket | 375×98 |
| Monthly | Bronze / copper | `#E0A170` | `#3A1F0C` | `#9A521D` | storeCard | 375×144 |
| Yearly | Silver / platinum | `#DCE1E8` | `#2A3039` | `#76818F` | storeCard | 375×144 |
| VIP Lifetime | Gold on black | `#F0CF50` (`--gold`) | `#000000` (`--bg`) | `#1A1403` + gold spotlight | storeCard | 375×144 |

Enforced by test ([`reference/tiers.test.js`](reference/tiers.test.js),
[`walletArt.test.js`](reference/walletArt.test.js),
[`email/email.test.js`](reference/email/email.test.js)):
- **Separation:** every pair of tiers differs by ≥ 25 (faces) and ≥ 50 (accents) in RGB distance.
- **Darkness:** white text on every face ≥ 7:1 (actual: 11–21:1), and labels on their own face ≥ 4.5:1.
- **Brand constants:** every tier's art carries the gold spark, every email pass card carries the
  wordmark and the PASS lockup, and Wallet gets `logoText: "PASS"`.
- **White-label safety:** a tenant's brand mark is its own accent. No DGTL gold reaches another
  tenant's pass.

Why Steel moved from grey to blue: grey Steel and grey Silver were too close to tell apart in a
Wallet stack. Steel blue / copper / platinum / black-and-gold are four different hues.
Memberships moved from `generic` to `storeCard` so their strip can carry the branded art. Roadmap
R4 (holder photo) moves them back to `generic` + thumbnail when photos ship.

`useBrandAccent: true` derives the whole palette (face, field, accent) from the tenant's brand
colour and drops the material label (a blue pass is never called "Bronze").

## Email creative direction

One layout system, built to the kit's email guidance: table-based, solid black, inline styles,
bulletproof gold button, hosted wordmark PNG, no effects. The centre of every email is **the pass
card**, drawn exactly as it appears in Wallet (tier face, DGTL⚡ PASS lockup, the tier art strip PNG,
tier labels, QR). Per tier, what changes is **colour, warmth of voice, alignment and ceremony**:

| | Day | Monthly | Yearly | VIP Lifetime | VIP Onboarding |
|---|---|---|---|---|---|
| Job | Get them through the door tonight | Make Wallet the habit | Welcome them for the year | Make it feel owned | Make them feel *chosen* |
| Layout | left-aligned, QR-first | left, Wallet-first | left, Wallet-first | centered, muted-gold frame | centered, frame, offer card |
| Pass card | steel-blue face + art | copper face + art | platinum face + art | black card, gold art | black card preview (no QR) |
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
