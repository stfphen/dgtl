# DGTL — Codex Instructions

This is the DGTL monorepo. It holds **four** surfaces under one brand:

1. **`platform/`** — the DGTL Growth Platform, a multi-tenant Next.js app: admin panel, lead
   pipeline, prospecting, batch builder, outreach engine, telephony, checkout, funding.
2. **The publishing operation** — `journal/` (Influence Journal creator packs), `pitches/`,
   `deploy/`, `skill-mods/`, `engine/`.
3. **`apps/`** — standalone products that are not the platform and not publishing. Currently
   `apps/dgtl-os/` (the terminal, its Cloudflare Worker API, and the Mac-local server).
4. **`sites/`** — per-client deliverables that aren't tenant funnels: static client websites and
   one-off client tools. Currently `sites/polishstone/` and `sites/on-home-decor/`.

They have different tooling and different release cadences. Know which surface you are in before
you edit, and do not blur them: no app code in `journal/`, no publication HTML in `platform/`, and
nothing from `apps/` or `sites/` importing out of `platform/`.

## This repo is authoritative. `content-checkout-funnel` is retired.

`stfphen/dgtl` supersedes `stfphen/content-checkout-funnel` for **all** work — platform and
publishing. Do not open, edit, or "sync back to" the old repo. It is kept only as an archive.

## The goal this repo serves

DGTL Growth Platform is being built into a **sellable B2B product**, not an internal tool. Every
decision should push toward that: tenant-generic architecture, nothing hardcoded to one client or
one grant source, and a funnel a prospect can buy through without a human in the loop. The
publishing half exists to feed it — the Influence Journal and pitch pages are the top of the
funnel, not a side project.

## Read first

- `README.md` — layout, both scale paths, brand tokens.
- `platform/README.md` — app quick start, admin surface, module map.
- `MIGRATION.md` — what came from `content-checkout-funnel`, what did not, and what is verified.
- `SETUP.md` — dev setup for both halves, the first-push commands, and the merge audit result.
- `brain/00-Index/00-Home.md` — the knowledge vault hub. Open only the notes relevant to the task.

## Brand (non-negotiable)

Black + gold, gold is `#F0CF50`, typeface is Manrope. Canonical tokens live in
`platform/app/admin/dgtl-admin.css` and `journal/_shared/dgtl-editorial.css`. Never hardcode a
brand value into a component, a page or a pack — reference the token. Both halves of the repo
share the palette on purpose.

### Web/app identity (non-negotiable)

Every **DGTL-owned** website, dashboard, tool, or standalone web app in this repo must present as
one product family in browser chrome and when installed to a phone/home screen.

- Browser/document titles start with **`DGTL -- `**, followed by the application/surface name.
  Examples: `DGTL -- Core`, `DGTL -- Admin`, `DGTL -- Creator Intake`, `DGTL -- OS`. Nested page
  titles may append context after that prefix, but must not move `DGTL --` to the end.
- This rule applies to DGTL-owned surfaces. Do **not** prepend DGTL to a client-owned/white-label
  tenant's public title unless that tenant explicitly uses DGTL branding.
- The canonical house icon pack is **`platform/public/assets/brand/icons/`**. It contains the
  approved favicon, Apple touch icon, standard PWA icons and maskable variants. Reuse that artwork
  or an intentionally approved variation; do not invent an unrelated app icon per project.
- Desktop favicon support alone is incomplete. Every deployable DGTL web app must support:
  1. browser favicon (`favicon.ico` and/or SVG/PNG favicon),
  2. **raster** `apple-touch-icon` for iPhone/iPad home-screen installs (SVG is not sufficient),
  3. a web app manifest with at least 192x192 and 512x512 PNG icons,
  4. maskable 192x192 and 512x512 icons when the app is installable/PWA-like,
  5. an Apple mobile web app title matching the `DGTL -- <App>` identity when the framework
     supports it.
- Framework convention: Next.js App Router surfaces should express this through `metadata`,
  `icons.apple`, `appleWebApp`, and the manifest route/file. Static HTML apps should include the
  equivalent `<title>`, favicon links, `<link rel="apple-touch-icon">`, manifest link and Apple
  mobile-web-app meta tags in `<head>`.
- `apps/` and `sites/` stay self-contained and must not runtime-import assets from `platform/`.
  When a standalone DGTL app needs the house icons, copy/export the approved icon files into that
  app's own public/assets directory while keeping `platform/public/assets/brand/icons/` as the
  visual source of truth.
- When adding a new DGTL web surface, treat title + desktop favicon + iOS touch icon + manifest as
  part of the definition of done, not follow-up polish.

## Platform rules

- **Stay tenant-generic.** DGTL is the *default* brand, never a hardcoded assumption in a runtime
  code path. Do not hardcode one client, one grant source, or one service path.
- Keep admin navigation working. Preserve lead pipeline, prospecting, outreach, batch builder,
  and checkout.
- Prefer mock data first, then real integrations.
- Tenants are config: a module in `platform/lib/tenants/` registered in `platform/lib/store.js`.
  Adding a client should not require new components.
- Before marking platform work complete: run `npm test` and `npm run build` from `platform/`,
  and report the exact commands and results.

## The pack model (the publishing rule)

Every creator is a self-contained folder `journal/packs/<slug>/` described by `pack.json`. When
you add or change a creator, keep the pack self-contained and keep `pack.json` accurate —
the index, sitemap and cross-links are generated from the manifests.

- Shared design lives ONLY in `journal/_shared/`. Never fork CSS/JS into a pack.
- `.standalone.html` files are generated build artifacts (git-ignored). Regenerate them with
  `engine/dgtl-creator-features/scripts/make-standalone.py`; never hand-edit them.
- Relative paths from a hub: `../../_shared/…`, own media `media/…`. From a feature or case:
  `../../../_shared/…`, own media `../media/…`, hub `../index.html`.
- Before marking publishing work complete: run `python3 tools/check-links.py` — it must report
  `missing=0`.

## Pitches — same model, one folder per pitch

`pitches/<slug>/` with `index.html` as the hub, `teaser.html` beside it when there is a short
front-of-funnel version, `media/` for its own assets, and a `pitch.json` manifest. Registered in
`pitches/pitches.index.json`. Deploy scheme is `https://pitch.dgtlmedia.io/<slug>/`.

- Pitch pages are self-contained by design. Do **not** refactor them onto `journal/_shared/`.
- Before marking pitch work complete: `python3 tools/check-links.py` must report `missing=0`.

## `apps/` — standalone products

`apps/<product>/`, self-contained, with its own README and deploy instructions.

- **Never commit a key.** Only `.env.example` ships, with placeholders.
- An app must not import from `platform/`. If it needs shared code or brand assets at runtime,
  that is a conversation, not a relative path. Copy approved static brand exports instead.

## `sites/` — client deliverables

`sites/<client>/` holding a static site or a one-off client tool. No build step; served as files.

- Each site deploys at its own domain root, so root-absolute links are valid here.
- Deploy artifacts and staging copies are **not** committed.

## About `brain/`

This copy is authoritative. Read `brain/00-Index/00-Home.md` at the start of a session and open
only what the task needs. Keep it current after meaningful work.

## Git workflow

- Never force-push, reset branches, delete worktrees, or remove files without explicit
  confirmation.
- Run `git status --short --branch` before editing.
- Small branches, small commits. One integration branch for merging feature work.
- Never edit the same files in two worktrees at once.
- **Never add `content-checkout-funnel` as a remote.**

## Verification before marking work complete

Report the exact commands you ran and their output. Do not claim a check passed without showing it.

| Touched | Run |
|---|---|
| `platform/` | `cd platform && npm test` and `npm run build` |
| `journal/`, `pitches/` | `python3 tools/check-links.py` — must report `missing=0` |
