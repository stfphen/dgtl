# DGTL Web App Branding Standard

This is the source-of-truth rule for browser and installed-app identity across DGTL-owned web surfaces.

## Titles

Every DGTL-owned website, dashboard, tool, or web app must begin its document/browser title with:

`DGTL -- <Application Name>`

Examples: `DGTL -- Core`, `DGTL -- Admin`, `DGTL -- Creator Intake`, `DGTL -- OS`.

Nested pages may append context after the application name, but `DGTL --` stays first. This rule does not override client/tenant white-label titles.

## Canonical icon artwork

The approved house icon exports live in:

`platform/public/assets/brand/icons/`

That pack contains favicon sizes, `apple-touch-icon.png`, 192/512 PWA icons, maskable icons, and platform-specific exports. Reuse this artwork or an intentionally approved variation. Do not invent an unrelated icon for each DGTL project.

Standalone apps must remain self-contained: copy/export approved icon files into the app's own public/assets directory rather than runtime-importing from `platform/`.

## Required web metadata

A deployable DGTL web surface is not complete until it has all applicable identity metadata:

- Browser favicon: `.ico`, SVG, and/or PNG.
- Raster Apple touch icon for iPhone/iPad. Do not rely on SVG for `apple-touch-icon`.
- Web app manifest with at least 192x192 and 512x512 PNG icons.
- Maskable 192x192 and 512x512 icons for installable/PWA surfaces.
- Apple mobile web app title using `DGTL -- <Application Name>`.
- Theme/background colours aligned with the DGTL black/gold brand unless the surface is intentionally using an approved variation.

## Framework implementation

### Next.js App Router

Use framework metadata rather than hand-written head tags:

- `metadata.title`
- `metadata.icons`
- `metadata.icons.apple`
- `metadata.appleWebApp`
- `metadata.manifest` or a manifest route/file
- `viewport.themeColor` where applicable

### Static HTML

Include equivalent tags in `<head>`:

- `<title>DGTL -- ...</title>`
- favicon `<link>` entries
- `<link rel="apple-touch-icon" ...>` pointing to a raster PNG
- `<link rel="manifest" ...>`
- Apple mobile web app capable/title/status-bar meta tags when the surface is intended to install like an app

## Definition of done

When creating or modifying a DGTL-owned web surface, verify browser title, desktop favicon, iPhone/iPad home-screen icon, manifest identity, and installed-app label together. A desktop Chrome favicon alone is not considered complete branding.
