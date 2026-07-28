# DGTL

The DGTL monorepo — the platform we run on and everything we publish, under one brand.

Two halves, one identity:

- **`platform/`** — the DGTL Growth Platform: a multi-tenant Next.js app with the admin panel,
  lead pipeline, prospecting, batch builder, outreach engine, telephony, checkout and funding
  modules.
- **`journal/`, `pitches/`, `deploy/`, `engine/`** — the publishing operation: Influence Journal
  creator packs, pitch and offer pages, deploy runbooks, and the tooling that generates them.

Built to scale on both sides. Every creator is a self-contained, manifest-described **pack** and
every pitch a **pitch folder**, so adding talent or a proposal is one folder from a template. Every
client is a **tenant**, so adding a funnel is config, not code.

> Consolidated out of `stfphen/content-checkout-funnel`, which is now retired to an archive. See
> `MIGRATION.md` for what moved, what did not, and what is verified — and `CLAUDE.md` for the two
> things the archive still holds that did not come across.

## Layout

```
dgtl/
├── platform/                   # the Next.js app: admin panel + sales tooling
│   ├── app/                    # routes: public funnels /t/[slug], /admin, /api/**
│   ├── components/  lib/       # UI and domain logic (tenants, store, outreach, enrichment)
│   ├── migrations/  tests/     # schema 001–008 · 356 tests
│   └── data/                   # JSON fallback store (gitignored runtime state)
│
├── journal/                    # the Influence Journal publication
│   ├── index.html              # publication hub
│   ├── _shared/                # editorial design system — edit once, every page updates
│   ├── _templates/             # blank creator template, block library, worked examples
│   ├── cases/                  # agency case studies not owned by one creator
│   └── packs/<slug>/           # ← the scalable unit: hub, features/, cases/, media/, pack.json
│
├── pitches/                    # pitch + offer pages
│   ├── _templates/             # generic "Your Brand × DGTL" offers, cloned per prospect
│   └── <slug>/                 # index.html, optional teaser.html, media/, pitch.json
│
├── engine/                     # the pack-generating skill, versioned with its output
├── deploy/                     # domain + deploy blueprints, runbooks, the decks hosting rig + deploy portal
├── os/                         # DGTL OS assistant: terminal UI + RAG knowledge (VPS-consolidated)
├── skill-mods/                 # hero-rotation patch, migrate-to-main-domain scripts
├── tools/                      # check-links.py
└── brain/                      # Obsidian knowledge vault (authoritative copy)
```

## Quick start

```bash
# platform
cd platform && npm install && cp .env.example .env && npm run migrate && npm run dev

# publishing — static, no build step
python3 tools/check-links.py      # expect: missing=0
```

Full setup, the verification commands, and the migration audit are in `SETUP.md`.

## Adding things

**A creator:** copy `journal/_templates/creator-feature-template.html` to
`journal/packs/<slug>/index.html`, put media in `packs/<slug>/media/`, write `pack.json`, register
in `journal/packs/packs.index.json`.

**A pitch:** copy the relevant `pitches/_templates/*.html` to `pitches/<slug>/index.html`, replace
by `data-slot`, write `pitch.json`, register in `pitches/pitches.index.json`. Never personalise a
template in place.

**A tenant:** add a module in `platform/lib/tenants/` and register it in `platform/lib/store.js`.
No new components.

Both publishing sides are checked by `tools/check-links.py` — it must report `missing=0`. Assets you
know are not yet supplied go in `pendingAssets` in the manifest so they read as *pending* rather
than leaving the check red.

## Current pitches

| Slug | What | Type | Status |
|---|---|---|---|
| `dmtv-bose` | DMTV × Bose partnership — teaser + full | client pitch | delivered |
| `escott` | ESCOTT — a family brand concept | concept | draft |
| `the-climb` | THE CLIMB — DGTL Originals documentary | concept | draft |

Deploy scheme: `https://pitch.dgtlmedia.io/<slug>/`.

## Brand

Black + gold, gold is `#F0CF50`, typeface is Manrope. Tokens live in
`platform/app/admin/dgtl-admin.css` and `journal/_shared/dgtl-editorial.css`. Reference the token;
never hardcode a brand value. Conventions and rules for agents are in `CLAUDE.md`.
