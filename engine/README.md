# `engine/` — the DGTL skill source of truth

The five DGTL skills are **maintained here**, in this repo, versioned next to the output they
produce. The copies you see inside a Cowork or Claude session are a **read-only cache** — editing
them there changes nothing and is lost on the next sync.

> **The rule:** every change to a DGTL skill is made in `engine/<skill>/` first, committed, and then
> re-exported to the installed copy. Never the other way round.

This exists because it didn't before: `skill-mods/hero-rotation-skill-patch.md` sat unapplied
because there was nowhere to apply it. See `docs/skill-integration-audit.md` for the full history.

## The five skills

| Skill | Produces | Writes into |
|---|---|---|
| `dgtl-creator-features` | Influence Journal creator packs | `journal/packs/<slug>/` |
| `dgtl-pitch-pages` | the long 14-section pitch page | `pitches/<slug>/index.html` |
| `dgtl-pitch-teasers` | the short front-of-funnel opener | `pitches/<slug>/teaser.html` |
| `dgtl-pitch-composer` | a block-composed pitch page (layout varies per offer) | `pitches/<slug>/index.html` |
| `dgtl-brand-kit` | any other DGTL-branded surface | wherever the build lives |

`dgtl-pitch-pages` and `dgtl-pitch-composer` are alternatives, not a sequence: fixed proven layout
vs. composed-per-offer layout. Pick one per pitch.

## Repo conventions every skill must honour

These are the repo rules from `CLAUDE.md`. They are now written into each skill's workflow, but
they are restated here because they are what "integrated" means:

1. **Output lands in the repo**, not only in a chat attachment. A page that exists solely as a
   delivered file is not shipped.
2. **Every artifact carries a manifest** — `pack.json` for a creator pack, `pitch.json` for a pitch
   — and is **registered** in `journal/packs/packs.index.json` or `pitches/pitches.index.json`.
   The index, sitemap and cross-links are generated from the manifests.
3. **Links inside a pitch folder are relative** (`index.html`, `teaser.html`, `media/…`). Never
   root-absolute (`/full/`) — those only resolve at a domain root and silently broke the DMTV × Bose
   teaser once already.
4. **Shared journal design lives only in `journal/_shared/`.** Never fork CSS/JS into a pack.
5. **Missing assets are declared, not left broken** — `pendingAssets` in `pitch.json`, so the link
   checker reports them as `pending` instead of `missing` and the check stays readable.
6. **`python3 tools/check-links.py` must report `missing=0`** before any publishing or pitch work is
   called complete.

## Re-exporting to the installed skill

After editing here, push the change to the installed copy so sessions actually pick it up:

```bash
python3 tools/export-skills.py --list          # what's here and whether it matches installed
python3 tools/export-skills.py --check         # non-zero exit if repo and installed have drifted
python3 tools/export-skills.py <skill> --to <installed-skills-dir>
```

If you publish these through a plugin marketplace instead, export into that repo's `skills/`
directory and publish from there — same direction, repo → installed.

## Layout of a skill

```
engine/<skill>/
  SKILL.md              # the workflow — frontmatter name + description drive when it triggers
  references/*.md       # the detail the workflow defers to; read on demand, not all upfront
  scripts/*             # deterministic helpers (populate, validate, flatten, screenshot)
  assets/               # templates, tokens CSS, logo library
```

Each skill bundles its own `assets/logos/` so it stays self-contained and exportable on its own —
the four pitch/brand skills therefore carry duplicate copies of the same 21 logos (~200 KB each).
That duplication is deliberate; do not dedupe it behind a shared folder, or an exported skill
breaks.
