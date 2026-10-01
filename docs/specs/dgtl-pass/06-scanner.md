# 06 · Scanner (PWA)

A web page at `/scan`, served by the platform. It installs to the home screen and works in
**iPhone Safari** and **Android Chrome**. There is no App Store, no Play Store and no native code.

## Hard technical facts that shape it

| Fact | Consequence |
|---|---|
| `getUserMedia` needs a secure context | HTTPS in every environment except `localhost` |
| **Safari (iOS 17 → 26) does not ship `BarcodeDetector`**; it is behind a flag, and broken there since iOS 18 | Decode with **`zxing-wasm`** (QR + Code 128) in a Web Worker on every platform. Use native `BarcodeDetector` only as an opt-in fast path where `getSupportedFormats()` includes `qr_code` (Chrome Android) |
| iOS needs a user gesture before audio plays | The scanner opens on a **"Start scanning"** button: one tap unlocks the camera and a WebAudio context |
| `navigator.vibrate` is not supported on iOS Safari | Use haptics on Android only. On iOS the full-screen color and the tone carry the verdict |
| Home-screen web apps on iOS may re-prompt for camera permission after a relaunch | Document it for door staff. A Safari tab bookmark is the fallback |
| Screens glare; Wallet boosts brightness but emails do not | The holder pass page shows "Turn brightness up" and uses a white QR tile with a 4-module quiet zone |

Dependencies: `zxing-wasm` (reader build only, loaded lazily on `/scan`). Pin a version and
self-host the `.wasm` from `/public/scan/` so the door never depends on a CDN.

## Screens

Design target: [`previews/scanner.html`](previews/scanner.html), built to the DGTL brand kit.
It shows start, scanning, manual entry, valid, VIP valid, recently used, used and offline.

The scanner is **DGTL platform chrome**, an internal tool, so it follows the kit's quietest
register: black ladder, glass top bar (logo · gate pill · online status), white viewfinder, and
gold only on the one primary action ("Start scanning →", "Check code →") and the VIP band. It is
not themed per tenant. Staff moving between venues see the same tool.

| Tone | Screen | Icon | Sound | Returns to camera |
|---|---|---|---|---|
| `admit` | full-screen **success** `#7BC47F`, black text | ✓ in a black ring | short rising chirp | automatically after 2.5 s (progress bar; tap to skip) |
| `warn` (`recently_used`, `not_yet_valid`) | full-screen **warning** `#E8A33D`, black text | ! | two low beeps | on tap only |
| `deny` (`used`, `expired`, `revoked`, `suspended`, `not_found`, `invalid_format`) | full-screen **error** `#E5484D`, black text | ✕ | one long low tone | on tap only |
| offline / timeout | **black**, error-outline icon, "Don't admit" error badge | wifi-off | one long low tone | Retry (same scan id) |

- The colors are the kit's **functional** set, already in the platform as `--success`, `--warn`
  and `--danger` in `dgtl-admin.css`. Elsewhere the kit uses them as tint + text. **The scanner is
  the one surface that fills the screen with them**, because a dark door needs an answer at arm's
  length. Black text passes AA on all three (≥ 5:1).
- **VIP admit** adds a black band above the green with the gold spark and "VIP · LIFETIME" in
  gold, letter-spaced. It's spotted in one glance, without turning the verdict itself gold (gold is
  never a status color in the kit).
- **Offline is not a verdict color.** It's a network problem, not a bad pass, so staff retry
  rather than refuse the guest. It still means don't admit.
- Never rely on color alone: icon + title + sound always accompany it. The verdict title is an
  `aria-live="assertive"` region.

## Behaviour

1. **Auth.** No session, or a session without `pass.verify`, redirects to
   `/api/auth/google/start?next=/scan`. After sign-in, a `verifier` lands straight on `/scan`
   (they have no `/admin`).
2. **Gate.** Chosen once from `GET /api/scan/session` (`gates` from tenant config), remembered in
   `localStorage` per device, shown in the header, and sent with every scan.
3. **Decode loop.** Throttle to ~8 frames/s, decode at 640 px, formats QR + Code 128 only. On a
   decode, the same text within 3 s is ignored (debounce), and the camera pauses while a verdict
   shows.
4. **Verify.** `scanId = crypto.randomUUID()` is generated once per decode.
   `POST /api/scan/verify` with a 6 s timeout. On a network error, retry with **the same
   `scanId`** (idempotent), up to 2 retries. Then show the black "No connection" screen with its
   "Don't admit" badge. **Never admit on error.**
5. **Manual entry.** "Enter code" opens a keypad for `XXXX-XXXX` (uppercase, auto-dash) or a full
   26-char code, sent as `inputKind: "manual"`. The lockout message appears after 10 misses.
6. **Recent strip.** The last 5 verdicts (name + icon + time) sit under the camera, so staff can
   confirm "did that one go through?" without rescanning.
7. **Torch.** When `track.getCapabilities().torch` exists (Android Chrome), a ⚡ toggle appears.
   iOS Safari doesn't expose it, so hide the button there.
8. **Wake lock.** `navigator.wakeLock.request("screen")` while scanning keeps the phone awake at
   the door. Re-acquire on `visibilitychange`.
9. **Session expiry** mid-shift (12 h TTL): the next verify returns 401, and the scanner shows
   "Signed out — sign in again", not a red verdict. Nobody mistakes an auth problem for a bad pass.

## PWA shell

- `app/scan/layout.jsx` with its own `manifest` (`scope: "/scan"`, `start_url: "/scan"`,
  `display: "standalone"`, `background_color: #000`), `apple-mobile-web-app-capable`, and an
  `apple-touch-icon` from `lib/branding/appIcon.js` (already renders tenant icons).
- No service-worker caching of API responses, ever. A cached verdict is a false admit. A service
  worker, if added, caches only the shell and the `.wasm`.
- The scanner UI uses its own small CSS (`app/scan/scan.css`) that reads the platform tokens from
  `dgtl-admin.css` (gold is `var(--blue)` there, per the kit's `repo-surfaces.md`; the verdict
  fills are `var(--success)`, `var(--warn)` and `var(--danger)`). It does not import `styles.css`
  and contains no hex values. Manrope via `next/font`, as in the admin layout.

## Accessibility

- The verdict title is an `aria-live="assertive"` region.
- Large type throughout: the name at ≥ 32 px and the title at ≥ 28 px.
- The whole verdict screen is the "continue" target.
- Respect `prefers-reduced-motion`: no flash animation, just a static color.

## Device test matrix (launch gate)

| Device | Browser | Must pass |
|---|---|---|
| iPhone 12 or newer, iOS 18+ | Safari tab | sign-in, camera, QR from Wallet, QR from email on another phone, Code 128, manual |
| same | Home-screen app | same + relaunch permission behaviour noted |
| Pixel 6 or newer / Samsung A-series | Chrome | same + torch + vibrate |
| Any | airplane mode mid-shift | red "can't verify", then recovery when back online |
| Two phones | same single-use pass, same second | exactly one ✓ |
