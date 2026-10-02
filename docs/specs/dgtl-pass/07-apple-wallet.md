# 07 · Apple Wallet

## Hosted signing first: Wallet without an Apple Developer account (built 2026-10-02)

Every `.pkpass` must be signed with an Apple Pass Type ID certificate, and only a paid
Apple Developer Program membership can create one. There is no free or open way around
that. A hosted provider can sign with **its own** Pass Type ID, though. DGTL Pass ships
that path first, through **WalletWallet** (`lib/passes/wallet/walletwallet.js`):

- **What it costs.** Free is 1,000 creates + updates a month, with no card and no Apple
  account. Pro is $39/month (checked 2026-10-01). One POST returns the signed `.pkpass`, a
  Google Wallet save link and a hosted page. DELETE revokes it on both wallets.
- **How it is wired.** `GET /p/<credential>/wallet.pkpass` creates the Wallet copy on the
  first tap, stores the signed bytes and the provider serial (migration 016), and serves
  the stored copy after that. A row lock makes two taps create one pass.
  `GET /p/<credential>/google-wallet` uses the same copy. Revoke deletes it at the provider
  (best effort: the door already refuses the pass).
- **The barcode is our pass link.** The provider only stores the pass, so a Wallet copy
  can never admit anyone on its own. The scanner asks our database.
- **Branding by plan.**
  - Free: a colour preset per tier (Day blue, Monthly orange, Annual purple, VIP dark)
    plus "DGTL PASS" as text. Green and red are avoided because they are the scanner's
    verdict colours.
  - Pro (`WALLETWALLET_BRANDING=full`):
    - the same field layout as the DGTL-signed card (`walletLayout`);
    - the tier's exact face colour;
    - the brand-kit strip art (1080×360), the spark icon (120×120) and the wordmark, sent
      as data URIs (`lib/passes/wallet/images.js`).

    WalletWallet still picks the style (a strip makes it a store card) and the label
    colours. If the plan refuses Pro fields (400/402/403), the pass is issued on the free
    card with the reason in `wallet_error`.
  - The pass page in Safari is fully branded on every plan.
- **Data.** The holder's name and pass link reach the provider, which makes it a
  processor; put it in the privacy notice before real holders get passes this way. No
  email or phone is sent.

DGTL's own certificate (the design below) remains the launch recommendation: $99/year,
full strip art, and holder data stays first-party. `PASS_WALLET_PROVIDER` switches between
the two, so moving is configuration, not a rewrite. The demo runbook is
[18-iphone-demo.md](18-iphone-demo.md).

## What ships with DGTL's own certificate (Phase 5)

**Built 2026-10-02** (`lib/passes/wallet/{passJson,images,apple,zip}.js`):
- `pass.json` from `buildPassJson` (ported, tests ported);
- art rasterized with `sharp` at @1x/@2x/@3x;
- `manifest.json` with a SHA-1 per file;
- a detached CMS SignedData `signature` (SHA-256, RSA, signed attributes, signer + WWDR
  certificates), built with `pkijs` on Node's WebCrypto. `passkit-generator` was rejected:
  its pinned `joi` and `node-forge` carry three high advisories, and the release gate
  requires audit 0;
- a dependency-free ZIP writer.

The config checks the certificate at load: the key matches it, its UID is the Pass Type ID,
its OU is the team, the WWDR issued it, and it hasn't expired. `npm run passkit:setup` does
the CSR and the conversion. `tests/passes-wallet-signing.test.js` has OpenSSL verify every
tier's signature against Apple-shaped test certificates.

**Not verified until the real certificate exists:** an install on an iPhone (iOS checks
the chain to Apple's root).

- A signed `.pkpass` generated on demand at `GET /p/<credential>/wallet.pkpass`.
- An "Add to Apple Wallet" badge in every email and on the pass page (iOS/macOS Safari).
- Tier-specific layout and colors from [`reference/passJson.js`](reference/passJson.js) and
  [`reference/tiers.js`](reference/tiers.js).
- `expirationDate` (Wallet greys the pass after expiry), `voided` on revoke (visible on the next
  fetch), and `sharingProhibited`.

**Phase 5b, not launch-blocking:** the Apple web service + APNs push, so Wallet copies update
themselves (revoke, extend, rotate, rename). Without it, a revoked pass still **fails at the
door**, because the scanner asks the server, not the pass. What it lacks is the "Revoked" label in
the holder's Wallet.

## Pass styles per tier

Design target: [`previews/wallet.html`](previews/wallet.html) (the five presets, the Wallet stack,
the back of the pass and every artwork file, rendered from `buildPassJson` + `walletArt.js`).

| Tier | Style | Face (`backgroundColor`) | Labels (`labelColor`) | Why | Images |
|---|---|---|---|---|---|
| Day | `eventTicket` | `#13294A` steel blue | `#8DB4E8` | Time-bound, date in the header, `relevantDate` puts it on the lock screen that day | `icon`, `logo`, `strip` (375×98 pt) |
| Monthly / Yearly | `storeCard` | `#3A1F0C` copper / `#2A3039` platinum | `#E0A170` / `#DCE1E8` | Apple's membership/loyalty style; the wide strip carries the branded art. Roadmap R4 (holder photo) moves them to `generic` + thumbnail | `icon`, `logo`, `strip` (375×144 pt) |
| VIP Lifetime | `storeCard` | `#000000` | `#F0CF50` | The black card: gold spotlight + gold spark on pure black | `icon`, `logo`, `strip` |

Every card carries the **DGTL⚡ PASS lockup**: `logo.png` is the wordmark, and `logoText` is
`brandKit.walletLogoText` ("PASS"). It also carries the **gold spark** in its strip. The tier is its
face colour, label colour and art field, so a Wallet stack reads blue / copper / platinum /
black-gold at a glance. `foregroundColor` is always `#F0F0F0`.

Image specs live in `WALLET_IMAGE_SPECS` (points; ship @2x and @3x). `icon.png` is **required**
and a pass without it fails to install.

### Artwork (generated from the brand kit)

[`reference/walletArt.js`](reference/walletArt.js) draws every image as SVG from the kit's spark bolt
(`engine/dgtl-brand-kit/assets/logos/spark.svg`, parsed, never retyped):

| File | Composition |
|---|---|
| `strip.png` | ① tier face, ② tier field glowing in from the right, ③ giant tier-accent spark watermark (rotated, cropped), ④ **the crisp gold DGTL spark**, right-aligned at 80% height, ⑤ 2-pt tier-accent hairline at the base. The left ~55% stays calm for Wallet's primary-field text. VIP swaps the field for a gold spotlight |
| `thumbnail.png` | (generic style only) the gold spark on the tier face, tier ring |
| `icon.png` | The gold spark on black, on every tier. For a tenant, its app icon from `lib/branding/appIcon.js` instead |
| `logo.png` | The tenant logo PNG. For DGTL, [`assets/dgtl-wordmark@4x.png`](assets/dgtl-wordmark@4x.png) (rasterized from the kit SVG). `logoIncludesName: true` + `walletLogoText: "PASS"` gives the lockup |

Phase 5 rasterizes the SVGs with **`sharp`**, which is already in the platform tree through
`next`. No new dependency is needed, and the pipeline is proven on this machine:
`sharp(Buffer.from(stripSvg(…))).png()` produced all four branded 750×288 strips cleanly. The same
PNG is served publicly per pass type at `/passes/art/<passTypeId>@2x.png` (no credential in the
URL, long cache) for the email and pass-page card. Render @1x, @2x and @3x per pass type and cache them in memory. Copy `spark.svg` into
`platform/assets/brand/`, since the platform image can't read `engine/` at runtime, and add a test
that it is byte-identical to the kit's. A tenant can replace the generated art with its own upload
(`design.wallet.imageAssetId`, a media-library id).

Field layout per style is fixed in `buildPassJson`:

| Slot | eventTicket (Day) | generic (Monthly/Yearly) | storeCard (VIP) |
|---|---|---|---|
| header | VALID → date | TIER → BRONZE / SILVER | TIER → VIP |
| primary | PASS → name | MEMBER → holder | ACCESS → Lifetime |
| secondary | HOLDER · ENTRY | PASS · VALID THROUGH | MEMBER · EXPIRES Never |
| auxiliary | FROM · UNTIL | MEMBER SINCE · ENTRY | MEMBER SINCE |
| back | help · terms · pass page link · code · pass ID | same | same |

Dates are pre-formatted strings in the **tenant's** timezone. Wallet would otherwise localise an
ISO date to the device's zone and show "Oct 30, 12:00 AM" for a pass that is valid "through
Oct 29".

## Certificates and identity

One Apple Developer account (DGTL's), one **Pass Type ID** for all tenants in the MVP
(e.g. `pass.io.dgtl.passes`). `organizationName` is per pass (the tenant's brand name), so holders
see the tenant, not DGTL. Per-tenant Pass Type IDs (enterprise tenants on their own Apple account)
are roadmap. The signer config just becomes tenant-scoped.

Setup checklist (in [15-config-and-accounts.md](15-config-and-accounts.md)):

1. Apple Developer Program membership (organisation, D-U-N-S).
2. Identifiers → **Pass Type IDs** → register `pass.io.dgtl.passes`.
3. Create a **Pass Type ID certificate** from a CSR, then download the `.cer`.
4. Export cert + private key (`.p12`) from Keychain, then convert to PEM:
   `openssl pkcs12 -in pass.p12 -clcerts -nokeys -out signerCert.pem` and
   `openssl pkcs12 -in pass.p12 -nocerts -out signerKey.pem`.
5. Download **Apple WWDR G4** intermediate, then convert to `wwdr.pem`.
6. Base64 each PEM into env (`PASSKIT_SIGNER_CERT_B64`, `PASSKIT_SIGNER_KEY_B64`,
   `PASSKIT_SIGNER_KEY_PASSPHRASE`, `PASSKIT_WWDR_CERT_B64`) + `PASSKIT_TEAM_ID`,
   `PASSKIT_PASS_TYPE_ID`. They are server-only and must never reach a client bundle or the repo
   (`**/*.pem`, `**/*.p12` added to `.gitignore` in Phase 5).
7. Calendar reminder: the Pass Type ID certificate expires. Renewing it doesn't invalidate issued
   passes, but new signing fails the day it lapses. Put the expiry date in
   [`brain/40-Operations/44-Secrets-And-Rotation.md`](../../../brain/40-Operations/44-Secrets-And-Rotation.md).

## Building the `.pkpass`

Library: **`passkit-generator`** (v3.x, MIT). It handles `manifest.json` SHA-1 hashes, the
detached PKCS#7 `signature`, and zipping. We supply `pass.json` fields + image buffers.

```js
// lib/passes/wallet/pkpass.js (shape, not final code)
import { PKPass } from "passkit-generator";
import { buildPassJson } from "./passJson.js";

export async function buildPkpass({ pass, passType, holder, brandKit, design, validity, links, issuedLabel, walletConfig, certs, images }) {
  const json = buildPassJson({ pass, passType, holder, brandKit, design, validity, links, wallet: walletConfig, issuedLabel });
  const pkpass = new PKPass(
    { "pass.json": Buffer.from(JSON.stringify(json)), ...images },   // icon.png, icon@2x.png, logo.png, strip.png…
    certs                                                             // { wwdr, signerCert, signerKey, signerKeyPassphrase } from lib/passes/config.js
  );
  return pkpass.getAsBuffer();                                       // → Response(body, { headers: { "Content-Type": "application/vnd.apple.pkpass" } })
}
```

Rules:

- **Generate on request, don't store.** It's deterministic from DB state plus the brand kit. Cache
  rendered images per pass type in memory, and never cache the signed pass across a
  `content_updated_at` change.
- `serialNumber = passes.id`. It never changes. Rotation changes the barcode, not the serial, so
  Wallet treats it as the same pass.
- The barcode message is the full credential URL, and `altText` is the short code for manual entry.
- Serve with `Content-Type: application/vnd.apple.pkpass`,
  `Content-Disposition: attachment; filename="<brand>-<tier>.pkpass"`, and `Cache-Control: no-store`.
- If Apple env is missing, return 404 and hide every Wallet button (`walletEnabled()` in
  `lib/passes/config.js`). The email renderer receives `walletUrl: ""` and the badge disappears.

## The badge

Apple requires its official **"Add to Apple Wallet"** badge artwork (Apple Wallet marketing
guidelines). Do not recreate it in HTML or CSS. Download the badge set from Apple's marketing
resources, upload a 2× PNG to the media library or `/public/assets/wallet/`, and set
`PASS_WALLET_BADGE_URL`. The email renderer draws it 48 px tall. Set the `width` attribute in
`walletBadge()` (`reference/email/render.js`) to the artwork's real aspect ratio. Until then, the renderer shows a
neutral text placeholder and returns the warning `wallet_badge_placeholder`. Launch acceptance
requires that warning to be gone.

Show the badge only where it works: always in email (the recipient may open it on an iPhone), and
on the pass page only when the user agent is iOS/iPadOS/macOS Safari. On Android the pass page
shows "Save this page" plus the Google Wallet roadmap slot.

## Phase 5b — web service + push updates

1. Add `webServiceURL = <PASS_PUBLIC_BASE_URL>/api/wallet` and
   `authenticationToken = deriveWalletAuthToken(passId)` (32 chars, derived, never stored) to
   `buildPassJson` input. The builder already validates both.
2. Implement the five endpoints in [04-api.md](04-api.md#apple-wallet-web-service-phase-5b)
   against `pass_wallet_registrations`. The update tag is `max(content_updated_at)` as epoch
   seconds.
3. On any Wallet-visible change (revoke, extend, rotate, holder rename, pass type rename), bump
   `content_updated_at`, then send an **empty-payload APNs push** to each registered `push_token`
   using the Pass Type ID certificate (topic = Pass Type ID). Use HTTP/2 to `api.push.apple.com`.
   `node:http2` is sufficient, so no dependency is needed.
4. Log `/v1/log` bodies at warn level, truncated to 2 KB, rate limited.
5. Test with a real device: revoke, and the Wallet pass flips to "Voided" within a minute.

## Google Wallet (roadmap, not MVP)

Android holders get the pass page and email, which verify identically. Google Wallet needs a
Google Pay & Wallet Console issuer account, a service-account key, and JWT "Save to Google
Wallet" links (generic or event-ticket classes). The tier design maps to Google's class/object
colors. It is a Phase 7 item. The data model already carries everything it needs.
