# 07 · Apple Wallet

## What ships in the MVP

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

| Tier | Style | Why | Images |
|---|---|---|---|
| Day | `eventTicket` | Time-bound, date in the header, `relevantDate` puts it on the lock screen that day | `icon`, `logo`, optional `strip` (375×98 pt) |
| Monthly / Yearly | `generic` | Apple's intended style for memberships; room for a `thumbnail` (90×90), later the holder photo | `icon`, `logo`, optional `thumbnail` |
| VIP Lifetime | `storeCard` | A wide `strip` (375×144 pt) gives the gold VIP artwork its hero moment: the black card | `icon`, `logo`, `strip` |

Image specs live in `WALLET_IMAGE_SPECS` (points; ship @2x and @3x). `icon.png` is **required**
and a pass without it fails to install. Strip/thumbnail artwork is a media-library asset id on
the pass type (`design.wallet.imageAssetId`), with a per-tier default generated from the brand
kit (solid tier background + logo) so a tenant with no artwork still gets a clean pass.

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
