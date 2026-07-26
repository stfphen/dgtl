# DGTL App Icon Library

Brand app icons for DGTL projects, generated from the **real** DGTL marks — the gold
spark bolt (`spark.svg`) and the DGTL wordmark (`logo-white-gold.svg`). Black + gold,
Manrope, accent gold locked to **`#F0CF50`**.

Open **`icons-preview.html`** in a browser for a visual contact sheet of everything below.

## Marks × treatments

|              | Black + gold (signature) | Gold + black (inverted) | Mono white |
|--------------|--------------------------|-------------------------|------------|
| **Spark**    | black bg · gold bolt     | gold bg · black bolt    | black bg · white bolt |
| **Monogram** | `DGTL` in gold on black  | `DGTL` in black on gold | `DGTL` in white on black |
| **Wordmark** | white `DGTL` + gold bolt | all-black on gold        | all-white on black |

Vector masters live in `svg/` (12 files, incl. `-rounded`, `-maskable`, `-macos` variants of
the primary). Everything else is rendered from these.

## What's here

```
favicon.ico              16/32/48 multi-res
favicon-16/32/48.png
apple-touch-icon.png     180×180
icon-192.png icon-512.png    PWA, purpose "any"
maskable-192/512.png         PWA, purpose "maskable" (safe-zone)
site.webmanifest             sample manifest (edit name/urls to taste)
svg/                         12 vector masters
png/                         full size ladder 16→1024, every variant + wide wordmarks
ios/AppIcon.appiconset/      Contents.json + all iOS sizes — drag into Xcode
android/                     mipmap densities, adaptive fg/bg + ic_launcher.xml, play-store 512
macos/                       DGTL.iconset + DGTL.icns
```

## Web / PWA usage

Files are served from `/assets/brand/icons/…` (this folder lives under `public/`). Add to `<head>`:

```html
<link rel="icon" href="/assets/brand/icons/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/icons/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/brand/icons/apple-touch-icon.png">
<link rel="manifest" href="/assets/brand/icons/site.webmanifest">
<meta name="theme-color" content="#000000">
```

> Note: this repo already serves a **per-tenant** icon + manifest via `app/branding/icon/route.js`
> and `app/manifest.webmanifest/route.js`, and the app-router defaults `app/icon.svg` /
> `app/favicon.svg` (still the legacy "Content Day" mark). This library is the DGTL house set —
> use it as the tenant fallback / DGTL-tenant icon, or swap `app/icon.svg` → `svg/spark-black-gold-rounded.svg`
> when you're ready to retire the old mark.

## iOS · Android · macOS

- **iOS** — drag `ios/AppIcon.appiconset` into your Xcode asset catalog.
- **Android** — copy `android/mipmap-*` and `mipmap-anydpi-v26/ic_launcher.xml` into `res/`.
- **macOS** — `DGTL.icns` is prebuilt; regenerate with `iconutil -c icns macos/DGTL.iconset`.

## Regenerating

Source scripts (in the build session): `build_icons.py` (masters + raster pack),
`build_preview.py` (contact sheet). Marks are the verbatim path data from the DGTL brand kit.
Never recolour the gold off `#F0CF50`.
