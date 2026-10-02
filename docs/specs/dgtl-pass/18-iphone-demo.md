# 18 · iPhone demo (no Apple Developer account)

How to show DGTL Pass end to end on a real iPhone, on the Mac's Wi-Fi, today. Built and
verified 2026-10-02 on `feat/pass-p2-p3-demo`.

## What you can show

| Step | Where | What happens |
|---|---|---|
| Issue | Mac: `http://localhost:8090/passes` (owner) | Pick a tier, type a name, **Issue pass →**. A QR of the pass link appears beside the form |
| Receive | iPhone camera on that QR | The branded DGTL pass opens in Safari: tier colour, DGTL⚡ PASS lockup, gold spark, live QR, short code |
| Wallet | iPhone: **Add to Apple Wallet** | Shown only when `WALLETWALLET_API_KEY` is set. The signed `.pkpass` opens Apple's Add sheet |
| Admit | Mac: `http://localhost:8090/scan` (door staff), webcam | Full-screen green **Valid pass**, VIP band for VIP, visit count |
| Refuse | Scan it again / revoke it in `/passes` | Single entry → red **Pass already used**; Day pass → amber **Already scanned** (re-entry cooldown); revoked → red **Pass revoked** |
| Second phone | `http://<Mac's Wi-Fi IP>:8090/scan` | Live camera needs HTTPS, so on plain Wi-Fi the scanner uses **Take a photo of the code**. Same verdicts |

## Run it

```bash
cd platform
npm run demo:passes
```

The script starts a Postgres 16 container just for the demo (`dgtl-passes-demo` on
`127.0.0.1:54329`, volume `dgtl-passes-demo-data`), runs every migration, seeds the demo
team, accounts, DGTL tenant and the five pass types, and starts the platform on port 8090
bound to the Wi-Fi address. It prints the URLs. Your normal dev database is never touched.

- **Logins:** `owner@passes-demo.test` (issues, revokes) and `door@passes-demo.test`
  (scanner only). The password is `PASSES_DEMO_PASSWORD` in `platform/data/passes-demo.env`,
  generated on first run and git-ignored.
- **Stop:** Ctrl-C stops the app and the container. Data stays in the volume.
- **Start over:** `npm run demo:passes -- --reset`.
- **Wrong Wi-Fi address detected:** `DEMO_HOST=192.168.x.y npm run demo:passes`.

## Turn on Apple Wallet (free, about 2 minutes)

1. Sign up at [walletwallet.dev/signup](https://www.walletwallet.dev/signup/). It's free
   for 1,000 passes a month, with no card and no Apple Developer account.
2. Put the key in `platform/.env`, which is git-ignored. Never put it in a committed file:

   ```
   WALLETWALLET_API_KEY=ww_live_…
   ```
3. Restart `npm run demo:passes`. The Passes header then reads **Apple Wallet · walletwallet (free)**.

**How it works.** WalletWallet signs each pass with its own Apple Pass Type ID. Our server
creates the Wallet copy the first time the holder taps **Add to Apple Wallet**, stores it,
and serves the stored copy after that, so a second tap doesn't bill a second pass. The
pass's barcode is **our** pass link, so the door still asks our database. Revoking in
`/passes` also deletes the Wallet copy at WalletWallet.

**Free-plan limits.** The free plan allows a colour preset and text only: no DGTL logo
image, no strip art, no exact tier colours. Tiers map to presets so they stay apart:

| Tier | Free preset |
|---|---|
| Day (Steel) | blue |
| Monthly (Bronze) | orange |
| Annual (Silver) | purple |
| VIP | dark |

The lockup is spelled out as "DGTL PASS" text. Green and red are avoided because they are
the scanner's verdict colours. The pass page in Safari is fully branded on every plan; only
the Wallet copy is plain. WalletWallet Pro ($39/month, `WALLETWALLET_BRANDING=full`) sends
the exact tier face colour (and a logo URL when the tenant has one).

## Known demo limits

- **HTTP on Wi-Fi.** The demo serves plain http on the LAN. That is allowed only outside
  production (`lib/passes/config.js`), and http QR codes are accepted only from the demo's
  own address. A live-camera scanner on a phone needs HTTPS: use the photo button, or the
  Mac's webcam on `localhost`.
- **No email or SMS yet** (Phase 4). The admin opens the pass on the phone from the QR.
- **Issuers** (`issuer` role) still land on `/scan`. Opening the Core `/passes` module to
  pass-only staff is a follow-up. Owners and admins issue in the demo.
- **Holder data reaches WalletWallet** (name, pass link) when Wallet is used. Fine for a
  demo; real holders need it in the privacy notice (a processor).

## For launch: own certificate vs hosted signing

| | WalletWallet Free | WalletWallet Pro | DGTL's own Apple certificate (Phase 5) |
|---|---|---|---|
| Cost | $0, 1,000 passes/month | $39/month | $99/year Apple Developer Program |
| DGTL branding on the Wallet card | Preset + text | Tier colour + logo | Full: strip art, logo, tier colours (`reference/walletArt.js`) |
| Holder data | Leaves to a processor | Leaves to a processor | Stays first-party |
| Wallet updates (revoke greys out) | Via provider | Via provider | Phase 5b web service |
| Lead time | None | None | D-U-N-S + enrolment (days) |

**Recommendation.** Demo now on WalletWallet Free. Keep the Apple Developer enrolment
(P0.4) on the launch path: it is cheaper than Pro within four months, and it keeps holder
data first-party. The provider seam (`lib/passes/wallet/`) means switching is configuration,
not a rewrite.
