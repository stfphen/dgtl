---
name: dgtl-creator-features
description: >-
  Turn a creator or influencer's name and/or links (an Instagram/TikTok/YouTube
  post, a news article, or their profile) into a finished, SEO-optimized DGTL
  Influence Journal feature — real media, brand-voice copy, and schema built to
  rank for that person's name. Use whenever the user wants to profile, platform,
  feature, or write about a creator, influencer, artist, athlete or talent for the
  DGTL Influence Journal or publication: e.g. 'make a feature page for this
  creator', 'turn this post into a blog article', 'write an SEO piece about this
  person', 'populate a creator page from this link', or 'rank on Google for their
  name'. It populates the creator-feature-template from the Creator Publication
  Kit, captures screenshots of the creator's real posts and coverage, writes DGTL
  brand-voice copy, wires Article/Person/FAQ/Breadcrumb schema, and builds the
  backlink network so the page ranks and drives traffic to the featured person.
  Reach for it even when the user drops just a name and a link.
---

# DGTL Creator Features — research → populate → rank

Produce a **publishable editorial feature about a real creator** for the DGTL Influence
Journal by researching them, gathering their real media, writing DGTL-voice + SEO copy,
and populating `creator-feature-template.html`. The finished page is engineered to **rank
for the person's name** and to build a **two-way backlink network** — DGTL links out to the
creator's real profiles/work; the creator has a credible, on-brand page worth linking back to.

The whole point is a page that is *true, on-brand, and findable*. Getting real facts right and
real media in place matters more than volume of copy.

## Inputs you'll get (and what to do with each)

- **A name only** → research from scratch (web + socials) to find who they are, their platforms, notable work, and any press.
- **A name + direct link(s)** (a specific post, video, or article) → treat those as the spine of the piece; the linked work is usually the "why now." Still do a light background pass so the profile is well-rounded.
- **An angle** ("their Six Senses shoot", "their Canon launch") → lead the story there.

If you have only a name and nothing is findable, say so and ask for a link or a few facts rather than inventing anything.

## The workflow

### 1. Research & gather (the "scrape")

Goal: assemble enough **verified** fact to write truthfully. Work in parallel where you can.

- Search the web for the creator: identity, role, location, the platforms they're on, signature work, brands/artists they've worked with, and any news/press. Prefer primary sources (their own channels, the brand's site, reputable press).
- Fetch every link the user gave you and pull the concrete facts: what the piece is, when, for whom, any on-the-record quotes, the media in it.
- Find their **real profile URLs** (Instagram, YouTube, TikTok, X, personal site). You'll need these for `sameAs` schema and outbound links — they must be the person's actual, verified accounts, not guesses.
- Capture **real, current metrics** only if you can verify them (subscriber/follower/view counts from the platform or a reputable tracker). Note the as-of date. If you can't verify a number, leave that stat slot out — an empty slot beats a fabricated one.
- Keep a running **Sources** list (URL + one-line what-it-supports). You'll deliver it and cite from it.

Read `references/sourcing-and-rights.md` before writing anything — it defines fact discipline, how to handle quotes, and the rules for screenshots and third-party media. This is non-negotiable: **never invent stats, quotes, clients, or that someone is "in the DGTL network"** unless the user provided it or you verified it.

### 2. Capture the media

The page is only as good as its images. Prefer, in order: (1) media the user supplied, (2) official embeds / oEmbed thumbnails, (3) **screenshots of public pages**.

Social posts, reels and news articles are JavaScript-heavy and often need a real rendered browser, so **use the Chrome browser tools** (`mcp__claude-in-chrome__navigate` then a screenshot) to capture them — that renders the page the way a human sees it. For batch screenshots of simple public URLs you can use `scripts/capture_media.mjs` (headless helper). Save everything into the pack's own media folder, `journal/packs/<slug>/media/`.

Rules that keep this clean and lawful (details in `references/sourcing-and-rights.md`):
- Screenshots are **editorial reference** — always attribute (creator handle + link to the source) in the caption/alt.
- Do **not** log in, bypass a paywall, or defeat a CAPTCHA to get media. If a post is private/gated, ask the user for the asset.
- Crop to the content; avoid capturing unrelated UI, other users' comments, or personal data.

For each captured image, note the **alt text** you'll use — descriptive, includes the creator's name where natural (alt text is both accessibility and SEO).

### 3. Compose — DGTL voice, engineered for search

Write the copy now, from the researched facts. Two references drive this:
- `references/brand-voice.md` — how DGTL sounds (confident, results-first, concrete numbers, arrow CTAs) plus headline formulas that stay on-voice *and* carry the creator's name.
- `references/seo-and-backlinks.md` — where the name has to appear (title tag, H1, URL slug, meta description, first paragraph, image alt, Person schema), how to shape FAQ entries to win "People also ask" for the person, and the backlink playbook.

The single most important SEO move: **the person's name is the primary keyword.** It goes in the `<title>`, the `<h1>` (`HEADLINE_A`), the slug, the meta description, the opening sentence, at least one image's alt text, and the `Person` schema `name`. Write for a human first — Google rewards genuinely useful, well-sourced pages about an entity — but make sure the name and their notable associations (brands, works, the thing they're known for) are unmistakably present.

### 4. Assemble the fields, then populate deterministically

Don't hand-edit 40 placeholders — you'll miss one. Instead build a `fields.json` (every token is a key; see `references/field-guide.md` for what each one wants and how long it should be), then run the populate script. It replaces text tokens **and** injects your captured images into the hero and portfolio slots.

Keep the `fields.json` inside the pack (`journal/packs/<slug>/media/<slug>.fields.json`) — every
existing pack does, and it's what makes a page rebuildable a year later.

```bash
python3 engine/dgtl-creator-features/scripts/populate.py \
  --template engine/dgtl-creator-features/assets/creator-feature-template.html \
  --fields journal/packs/<slug>/media/<slug>.fields.json \
  --out    journal/packs/<slug>/index.html
```

`fields.json` shape (full reference in `references/field-guide.md`):
```json
{
  "tokens": { "TITLE": "...", "HEADLINE_A": "...", "HEADLINE_GOLD": "...", "...": "..." },
  "media": {
    "hero": { "src": "media/hero.jpg", "alt": "<Name> — ..." },
    "pf1":  { "src": "media/work-1.jpg", "alt": "..." }
  }
}
```

Paths in `media` are written **as they must appear in the final page**, so they depend on where the
page sits in the pack:

| Page | shared CSS/JS | own media | pack hub |
|---|---|---|---|
| hub — `packs/<slug>/index.html` | `../../_shared/…` | `media/…` | — |
| feature — `packs/<slug>/features/<x>.html` | `../../../_shared/…` | `../media/…` | `../index.html` |

Any hero/pf slot you omit keeps its on-brand gradient placeholder.

### 5. Validate

```bash
python3 engine/dgtl-creator-features/scripts/validate.py \
  --file journal/packs/<slug>/index.html --name "<Creator Name>"
```
This fails loudly on the things that quietly break SEO or the page: leftover `{{TOKENS}}`, invalid JSON-LD, broken local links, `<img>` missing alt text, a title/description that's too long or too short, or an H1 that doesn't contain the creator's name. Fix anything it flags and re-run.

Then run the repo-wide link check, which is the gate that actually blocks completion:

```bash
python3 tools/check-links.py        # must report missing=0
```

### 6. Verify it looks right

Screenshot the finished page (desktop + mobile) and actually look at it — real images seated correctly, gold used as an accent, nothing overflowing on mobile. Validate the schema against Google's Rich Results Test (paste the JSON-LD) when you can. A page that fails the eyeball test isn't done.

### 7. Write the manifest and register the pack

**A pack that isn't manifested and registered does not exist.** The journal index, the sitemap and
the cross-links are all generated from the manifests — skipping this is how a page ends up live but
orphaned.

Write `journal/packs/<slug>/pack.json`:

```json
{
  "slug": "<slug>",
  "name": "<Creator Name>",
  "type": "creator",
  "status": "published",
  "hub": "index.html",
  "features": ["features/<brand>.html"],
  "cases": [],
  "sources": "sources.md",
  "backlinkKit": "backlink-kit.md",
  "hasMedia": true,
  "updated": "<YYYY-MM-DD>",
  "canonicalUrl": ""
}
```

- `features` — brand/partnership pieces owned by this creator, as paths relative to the pack.
- `cases` — a case study **owned by this creator** lives in `packs/<slug>/cases/` and is listed
  here. An agency case not owned by one creator goes in `journal/cases/` and is registered under the
  `cases` key of `packs.index.json` instead.
- `sources` / `backlinkKit` — `null` if absent. Both should exist for a page you actually publish.
- `canonicalUrl` — leave `""` until the deploy domain is settled (see *Deploy* below). Do not
  invent one; every existing pack has this empty on purpose.

Then add the slug to the `packs` array in `journal/packs/packs.index.json` and bump its `updated`
date.

### 8. Wire it into the network & deliver

- Add a card for the new piece to `journal/index.html` (copy an existing `.wcard`, point it at
  `packs/<slug>/index.html`, give it a ghost metric). This is an internal backlink and how the hub
  passes authority to the new page.
- Cross-link: from the new page's "More from the Journal" cards, point at 2 existing packs; add the new piece to those pages' related cards where it fits. Dense, relevant internal linking is the backbone of ranking.
- Write `sources.md` into the pack, and a `backlink-kit.md` (per `references/seo-and-backlinks.md`) — a ready-to-post caption/snippet the featured creator can share that links back to the page. The two-way link (you link to their work, they link to their feature) is the mechanism that builds traffic and authority for both sides.
- Deliver to the user: the pack path, the `Sources` list, and the backlink kit.

### 9. Build the deploy artifact (standalone) & ship

DGTL hosts **one self-contained HTML per slug** (see *Deploy & connectivity* below), so the
multi-file pack page must be flattened into a single file before it goes live. Run:

```bash
python3 engine/dgtl-creator-features/scripts/make-standalone.py \
  --file journal/packs/<slug>/index.html \
  --out  journal/packs/<slug>/index.standalone.html \
  --page-url <the page's real published URL>
```

This inlines the CSS/JS/logos/images **and** rewrites cross-page links to absolute URLs, so the page
renders anywhere (double-click, preview) *and* connects to the rest of the build.

`.standalone.html` files are **generated build artifacts**. They are git-ignored, never hand-edited,
and always regenerated from the pack — if you find yourself editing one, edit the pack and re-run.

Present the pack, the standalone, the `Sources` list and the backlink kit. Tell the user which slug
to upload it under, and hand the creator the backlink kit.

## Where things live — the pack model

Every creator is a **self-contained pack**: `journal/packs/<slug>/`, described by `pack.json`.

```
journal/
  index.html                      # the hub — carries a .wcard per pack
  _shared/                        # dgtl-editorial.css, journal.js, logos — the ONLY design source
  cases/                          # agency cases not owned by one creator
  packs/
    packs.index.json              # the register: every pack slug + agency cases
    <slug>/
      index.html                  # the pack hub
      pack.json                   # the manifest
      media/                      # this pack's images + its <slug>.fields.json
      features/<brand>.html       # optional brand/partnership pieces
      cases/<case>.html           # optional, owned by this creator
      sources.md
      backlink-kit.md
```

Two rules that break things when ignored:

- **Shared design lives only in `journal/_shared/`.** Never fork or copy CSS/JS into a pack. If a
  pack needs a new visual treatment, add it to the shared stylesheet.
- **A pack is self-contained otherwise.** Its media lives in its own `media/`, never in a global
  asset pool.

## Deploy & connectivity

Publishing goes through the DGTL portal at **deploy.dgtlmedia.io**: upload the finished
**single self-contained HTML** (the `.standalone.html`), which the portal indexes and serves at a
slug. One file per slug — so the deploy artifact must inline everything (no sibling folders);
`scripts/make-standalone.py` is what produces it.

**The published URL scheme is not settled — do not hardcode one.** Journal pages historically sat at
`pitch.dgtlmedia.io/journal/creators/<slug>.html`, which no longer matches the pack layout, and
`skill-mods/migrate-to-main-domain/` moves ranking pages to `dgtlgroup.io/pitch/<slug>/` for the SEO
authority. Until that migration lands:

- Leave `canonicalUrl` empty in `pack.json` and ask the user for the real URL at publish time.
- Set `canonical`, `og:url`, and every JSON-LD `@id` to that URL — one address, consistently, or
  Google splits the signal.
- Pass the same URL to `make-standalone.py --page-url`.

Pages should link to **each other** so the host indexes a connected graph, not orphan pages:

- Creator pack ⇄ **Journal hub** — the hub `.wcard` is the primary inbound link; the pack links back to the hub and related packs.
- Creator pack ⇄ **the pitch** the creator appears in — link both ways, so a prospect on a pitch can meet the creators, and a creator's fans can find the offer.
- `packs.index.json` and `pitches/pitches.index.json` **are** the slug registry — keep them accurate rather than tracking slugs anywhere else. When you feature a creator who appears in an existing pitch, add a link from that pitch to the new pack, and vice-versa. This two-way indexing is the point — it compounds across future builds.

## Definition of done

Do not call a pack finished until all five are true, and report the commands you actually ran:

1. `journal/packs/<slug>/index.html` exists and `validate.py` passes on it.
2. `journal/packs/<slug>/pack.json` exists and is accurate.
3. The slug is listed in `journal/packs/packs.index.json`, whose `updated` date is bumped.
4. `journal/index.html` carries a `.wcard` pointing at the pack.
5. `python3 tools/check-links.py` reports **`missing=0`**.

## Guardrails (read `references/sourcing-and-rights.md` for the full version)

- Only publish verifiable facts; cite sources; attribute quotes to a named source, kept short.
- Don't fabricate metrics, awards, quotes, clients, or DGTL-network membership.
- Screenshots are editorial reference, attributed; never bypass logins, paywalls, or CAPTCHAs.
- The creator's `sameAs` / outbound links must be their real, verified accounts.
- Write for people; let ranking follow from a genuinely good, well-sourced page — no keyword stuffing, cloaking, or link schemes (search engines penalize them, per `references/seo-and-backlinks.md`).
