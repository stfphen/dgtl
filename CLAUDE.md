# DGTL — Claude Instructions

This is the DGTL monorepo. It holds **two** things under one brand:

1. **`platform/`** — the DGTL Growth Platform, a multi-tenant Next.js app: admin panel, lead
   pipeline, prospecting, batch builder, outreach engine, telephony, checkout, funding.
2. **The publishing operation** — `journal/` (Influence Journal creator packs), `pitches/`,
   `deploy/`, `skill-mods/`, `engine/`.

They have different tooling and different release cadences. Know which half you are in before
you edit, and do not blur them: no app code in `journal/`, no publication HTML in `platform/`.

## This repo is authoritative. `content-checkout-funnel` is retired.

`stfphen/dgtl` supersedes `stfphen/content-checkout-funnel` for **all** work — platform and
publishing. Do not open, edit, or "sync back to" the old repo. It is kept only as an archive.

Two things you must know about what that archive holds, because they did **not** come across and
are not recoverable from this repo:

1. **History and unmerged branches.** This repo starts from a single squashed commit. The old repo
   holds ~30 branches, unpushed commits on `feature/platform-landing`, and an open PR #2 (AI
   prospect enrichment). If a feature seems missing, it is probably on a branch back there —
   read it out of the archive and re-apply it here as new work. Never re-point this repo's
   `origin` at the old one.
2. **`prototypes/`** — ~556 MB of rendered video and netlify builds, including a 184 MB zip.
   Never tracked in either repo (the old repo's `.gitignore` excluded it from the start), so it
   lives **only on the Mac with no backup**. See `brain/50-Audit-Log/53-Known-Issues.md`.

## The goal this repo serves

DGTL Growth Platform is being built into a **sellable B2B product**, not an internal tool. Every
decision should push toward that: tenant-generic architecture, nothing hardcoded to one client or
one grant source, and a funnel a prospect can buy through without a human in the loop. The
publishing half exists to feed it — the Influence Journal and pitch pages are the top of the
funnel, not a side project.

Product sequence, once the migration is verified (below): stabilise the admin shell → build the
**Funding Program / grant-opportunity engine** → connect funding opportunities to lead matching and
outreach → package the whole thing as a priced B2B offer.

## Current priority: finish verifying the migration

Do this before starting new features. From `MIGRATION.md`:

1. **`npm run build` has never been verified.** It could not run in the sandbox —
   `next/font/google` fetches six font families at build time and there was no outbound network.
   Run `cd platform && npm ci && npm run build` on a networked machine and record the result in
   the brain. Until this passes, treat the platform migration as unproven.
2. **Three tenant configs** (`platform/lib/tenants/polishStone.js`, `nowakStoneworks.js`,
   `dziuraStoneTile.js`) were untracked in the old repo despite `lib/store.js` importing them.
   They are committed here — so this repo boots and the old one does not — but nobody has ever
   reviewed them. Read them before trusting them.
3. **Canonical / OG URLs** in journal pages still point at old `…/journal/creators/<slug>.html`
   paths, and all six `pack.json` `canonicalUrl` fields are empty. Both wait on the deploy domain.

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
- A case study owned by one creator lives in that pack (`packs/<slug>/cases/`). An agency case
  not owned by a single creator lives in `journal/cases/` and is registered under the `cases`
  key in `journal/packs/packs.index.json`.
- `journal/_templates/examples/` holds worked reference pages only — nothing in there is live.
- Before marking publishing work complete: run `python3 tools/check-links.py` — it must report
  `missing=0`. If you added a pack, confirm `pack.json` exists and the journal index links it.

## Pitches — same model, one folder per pitch

`pitches/<slug>/` with `index.html` as the hub, `teaser.html` beside it when there is a short
front-of-funnel version, `media/` for its own assets, and a `pitch.json` manifest. Registered in
`pitches/pitches.index.json`. Deploy scheme is `https://pitch.dgtlmedia.io/<slug>/`.

- **`pitches/_templates/` holds the generic "Your Brand × DGTL" offer pages** — website overhaul,
  brand redesign kit, influencer activation. These are cloned per prospect; they are not pitches.
  Never send a `_templates/` page to a client, and never personalise one in place — copy it to a
  new `pitches/<slug>/` first.
- **Personalisation is by `data-slot`.** The offer templates carry a `DATA-SLOT MANIFEST` comment
  in their `<head>` listing every replaceable element. Replace by slot; leave the fixed content
  (DGTL contact details, proof stats, client logos, case studies) alone.
- **No domain-absolute links.** A teaser links its full pitch as `index.html`, not `/full/`. Root
  paths only resolve when served from the domain root, so they break both locally and under the
  `/<slug>/` deploy scheme. The link checker reports these as `root_absolute`.
- **Declare missing assets, don't leave them broken.** If a pitch ships before its photos arrive,
  list them in `pendingAssets` in `pitch.json`. The checker then reports them as `pending` instead
  of `missing`, so the check stays green and a real break is still visible. A permanently red check
  gets ignored, which is how the ESCOTT photos went unnoticed.
- Pitch pages are self-contained by design (inlined styles, often inlined images) — they are sent
  as one-off artifacts and must survive being served from anywhere. Do **not** refactor them onto
  `journal/_shared/`.
- Before marking pitch work complete: `python3 tools/check-links.py` must report `missing=0`, and
  any new pitch needs a `pitch.json` plus an entry in `pitches.index.json`.

## About `brain/`

Carried over wholesale from `content-checkout-funnel`. Because `platform/` lives here too, the
whole vault is in scope — the app notes (Admin-Shell, Lead-Pipeline, Checkout-Payments, Telephony,
Data-Model, Multi-Tenancy, Funding-Program) describe `platform/`, and the publishing notes
(`16-Design-System`, `2D-Portfolio-Media`, `63-Tenants-Catalog`) describe `journal/`.

**This copy is authoritative.** The old repo's vault is a frozen archive; entries in it dated after
the 2026-07-25 migration are stale by definition. Do not reconcile the two.

Read `brain/00-Index/00-Home.md` at the start of a session and open only what the task needs.
Keep it current after meaningful work: append a dated bullet to `brain/50-Audit-Log/51-Timeline.md`,
log decisions in `52-Decision-Log.md`, log bugs and risks in `53-Known-Issues.md`, and bump the
`updated:` date on any note whose facts changed. When a code change contradicts a documented fact,
fix the note in the same pass.

## Git workflow

- Never force-push, reset branches, delete worktrees, or remove files without explicit
  confirmation.
- Run `git status --short --branch` before editing.
- Small branches, small commits. One integration branch for merging feature work.
- Never edit the same files in two worktrees at once.
- **Never add `content-checkout-funnel` as a remote.** Pull code out of the archive by reading
  files, not by fetching — the two histories are unrelated and merging them would be a mess.

## Verification before marking work complete

Report the exact commands you ran and their output. Do not claim a check passed without showing it.

| Touched | Run |
|---|---|
| `platform/` | `cd platform && npm test` (356 tests; 5 known network failures) **and** `npm run build` |
| `journal/`, `pitches/` | `python3 tools/check-links.py` — must report `missing=0` |
| a new pack | the link check, plus confirm `pack.json` exists and the journal index links it |
