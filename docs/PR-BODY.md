# Consolidate the last DGTL work: vendored skills, `apps/`, `sites/`

Closes the DGTL consolidation. Everything DGTL-related that was still loose in
`content-checkout-funnel` now has a home, and the tools that *produce* DGTL work live next to
the work they produce.

## What this adds

### `engine/` — the five DGTL skills become repo-owned

Before this, only `dgtl-creator-features` was vendored, and its instructions still described the
**pre-migration** layout: flat `influence-journal/creators/<slug>.html` files,
`assets/media/<slug>/`, no `pack.json`, no `packs.index.json`, no link-check gate. Grepping all
five skills for every convention `CLAUDE.md` calls mandatory — `pack.json`, `packs.index`,
`pitch.json`, `pitches.index`, `pendingAssets`, `data-slot`, `_shared`, `_templates`,
`check-links` — returned **zero hits**. They were context, not integration.

Now:

| Skill | Writes | Knows |
|---|---|---|
| `dgtl-creator-features` | `journal/packs/<slug>/` | emits `pack.json`, registers in `packs.index.json`, gates on `check-links.py` |
| `dgtl-pitch-pages` | `pitches/<slug>/index.html` | clones from `_templates/`, replaces by `data-slot`, emits `pitch.json` |
| `dgtl-pitch-teasers` | `pitches/<slug>/teaser.html` | links the hub relatively, never `/full/` or an absolute URL |
| `dgtl-pitch-composer` | `pitches/<slug>/` | emits `pitch.json` + `block-plan.md`, registers the slug |
| `dgtl-brand-kit` | wherever the build lives | points at the canonical token stylesheets instead of restating hex values |

The three pitch skills share a `references/repo-output.md` so the convention has one source
rather than three drifting copies.

`tools/export-skills.py` re-exports `engine/` to the installed skill copies. That makes "edit in
the repo first, never the other way round" enforceable instead of aspirational —
`skill-mods/hero-rotation-skill-patch.md` sat unapplied because there was nowhere to apply it.

`docs/skill-integration-audit.md` records the gap analysis this closes.

### `apps/dgtl-os/` — the DGTL OS product

Terminal, Mac-local Node server, and API worker, migrated from three loose directories at the
root of `content-checkout-funnel`. DGTL OS is a standalone product per the 07-18 decision — not
a tenant, not an admin feature — so it gets its own top-level surface.

### `sites/polishstone/` — client static sites get a home

A client's static site is neither a pitch nor a tenant funnel. Both `apps/` and `sites/` were
homeless, which is why neither had ever been committed anywhere.

## Verification

- **Links:** `python3 tools/check-links.py` → `checked=842 missing=0 pending=3 root_absolute=0`.
  The 3 pending are the declared ESCOTT photos, tracked in `pitch.json` under `pendingAssets`.
- **Secrets:** scanned every tracked file for Anthropic, Stripe, GitHub, Twilio, Resend, AWS keys
  and private-key blocks. One hit — the placeholder in `apps/dgtl-os/local/.env.example`. No live
  credential is committed. Root `.gitignore` now blocks `**/api-key.txt`, `__pycache__/` and the
  DGTL OS local knowledge file.
- **Bloat:** 938 tracked files, largest is a 1.7 MB PNG — nothing near GitHub's 100 MB limit, no
  LFS needed. No `node_modules/`, `.next/`, `__pycache__/`, `*.zip` or `.DS_Store` staged.
- **Excluded as redundant:** `polishstone-netlify-staging.zip` and three near-identical staging
  copies (only the newest source is tracked); a duplicate `terminal.html`; and `zilHu3WT`, which
  turned out to be a 7.6 MB zip of the PolishStone site rather than unknown data.

## Not verified here

`npm run build` in `platform/` still has not been run — `next/font/google` fetches six font
families at build time and the build sandbox has no outbound network. This PR does not touch
`platform/`, but the gap remains open from the initial migration. Run
`cd platform && npm ci && npm run build` on a networked machine before relying on the platform
half. See `MIGRATION.md`.
