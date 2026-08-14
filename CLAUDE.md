# DGTL — Claude Instructions

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

**Why `apps/` and `sites/` exist as their own top level:** DGTL OS is shipped as a standalone
product — not a tenant, not an admin feature (see the decision log) — and a client's static site is
not a pitch and not a funnel. Both were sitting untracked in the retired archive because there was
nowhere obvious to put them. Put new work of either kind here rather than at the repo root.

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

Product sequence, now that the migration build is verified: stabilise the admin shell → build the
**Funding Program / grant-opportunity engine** → connect funding opportunities to lead matching and
outreach → package the whole thing as a priced B2B offer.

## Current priority: stabilise the platform and its release gate

The migration build was verified on 2026-08-13. Address these audit findings before starting large
new features:

1. **Make the verified release gate mandatory.** `npm test` passes 356/356 and `npm run build`
   passes on Next 15.5.23. Add both to required CI and resolve the three remaining high production
   advisories before treating the platform as release-ready.
2. **Review Polish Stone content with the owner before publishing.** The three formerly untracked
   tenant modules were code-reviewed on 2026-08-13 and contain no credentials; the two legacy modules
   are compatibility re-exports. The live config still contains a `555` phone number and several
   pricing, portfolio, partner-logo, and testimonial claims whose provenance is not recorded.
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

## `apps/` — standalone products

`apps/<product>/`, self-contained, with its own README and deploy instructions. `apps/dgtl-os/` is
`terminal.html` + `api/` (Cloudflare Worker) + `local/` (Mac-local Node server).

- **Never commit a key.** DGTL OS reads its key from `api-key.txt`, which is gitignored at the repo
  root (`**/api-key.txt`) *and* by `apps/dgtl-os/local/.gitignore`. Only `.env.example` ships, with
  placeholders. The whole point of its three-mode design is that the key never reaches a client-side
  file — do not undo that.
- An app must not import from `platform/`. If they need shared code, that is a conversation, not a
  relative path.

## `sites/` — client deliverables

`sites/<client>/` holding a static site or a one-off client tool. No build step; served as files.

- **Each site deploys at its own domain root**, so root-absolute links (`/assets/site.css`) are
  correct here — unlike in `journal/` and `pitches/`, which are served from subfolders. The link
  checker knows the difference per scope; don't "fix" root paths in `sites/`.
- Deploy artifacts and staging copies are **not** committed. PolishStone arrived as four
  near-identical copies plus two zips; only the newest source lives here. If you generate a build,
  it belongs in a gitignored `dist/`, not beside the source with a suffix.

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
| `platform/` | `cd platform && npm test` (356 tests) **and** `npm run build` |
| `journal/`, `pitches/` | `python3 tools/check-links.py` — must report `missing=0` |
| a new pack | the link check, plus confirm `pack.json` exists and the journal index links it |
