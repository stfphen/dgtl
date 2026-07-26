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

Social posts, reels and news articles are JavaScript-heavy and often need a real rendered browser, so **use the Chrome browser tools** (`mcp__claude-in-chrome__navigate` then a screenshot) to capture them — that renders the page the way a human sees it. For batch screenshots of simple public URLs you can use `scripts/capture_media.mjs` (headless helper). Save everything to `influence-journal/assets/media/<slug>/`.

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

```bash
python3 scripts/populate.py \
  --template assets/creator-feature-template.html \
  --fields <slug>.fields.json \
  --out <path-to>/influence-journal/creators/<slug>.html
```

`fields.json` shape (full reference in `references/field-guide.md`):
```json
{
  "tokens": { "TITLE": "...", "HEADLINE_A": "...", "HEADLINE_GOLD": "...", "...": "..." },
  "media": {
    "hero": { "src": "../assets/media/<slug>/hero.jpg", "alt": "<Name> — ..." },
    "pf1":  { "src": "../assets/media/<slug>/work-1.jpg", "alt": "..." }
  }
}
```
Paths in `media` are written **as they must appear in the final page** (i.e. relative to `creators/`, so `../assets/...`). Any hero/pf slot you omit keeps its on-brand gradient placeholder.

### 5. Validate

```bash
python3 scripts/validate.py --file <path-to>/influence-journal/creators/<slug>.html --name "<Creator Name>"
```
This fails loudly on the things that quietly break SEO or the page: leftover `{{TOKENS}}`, invalid JSON-LD, broken local links, `<img>` missing alt text, a title/description that's too long or too short, or an H1 that doesn't contain the creator's name. Fix anything it flags and re-run.

### 6. Verify it looks right

Screenshot the finished page (desktop + mobile) and actually look at it — real images seated correctly, gold used as an accent, nothing overflowing on mobile. Validate the schema against Google's Rich Results Test (paste the JSON-LD) when you can. A page that fails the eyeball test isn't done.

### 7. Wire it into the network & deliver

- Add a card for the new piece to `influence-journal/index.html` (copy an existing `.wcard`, point it at `creators/<slug>.html`, give it a ghost metric). This is an internal backlink and how the hub passes authority to the new page.
- Cross-link: from the new page's "More from the Journal" cards, point at 2 existing pieces; add the new piece to those pages' related cards where it fits. Dense, relevant internal linking is the backbone of ranking.
- Deliver to the user: the page, the `Sources` list, and a short **backlink kit** (per `references/seo-and-backlinks.md`) — a ready-to-post caption/snippet the featured creator can share that links back to the page. The two-way link (you link to their work, they link to their feature) is the mechanism that builds traffic and authority for both sides.

### 8. Build the deploy artifact (standalone) & ship

DGTL hosts **one self-contained HTML per slug** (see *Deploy & connectivity* below), so the multi-file page must be flattened into a single file before it goes live. Run:

```bash
python3 scripts/make-standalone.py \
  --file influence-journal/creators/<slug>.html \
  --out  influence-journal/creators/<slug>.standalone.html \
  --page-url https://pitch.dgtlmedia.io/journal/creators/<slug>.html
```

This inlines the CSS/JS/logos/images **and** rewrites the cross-page links to absolute
`pitch.dgtlmedia.io` URLs, so the page renders anywhere (double-click, preview) *and* connects
to the rest of the build. The `.standalone.html` is the exact file you upload to the portal.

Present **both** the editable multi-file page and the `.standalone.html`, plus the `Sources`
list and the **backlink kit**. Tell the user: upload the standalone to **deploy.dgtlmedia.io**,
note the slug, and hand the creator the backlink kit.

## Where things live

This skill produces pages **inside the DGTL Influence Journal project** (the folder containing `influence-journal/index.html`, `creators/`, and `assets/dgtl-editorial.css`). The editable page and its shared assets live there; the **deploy artifact** is the flattened `.standalone.html`. If that project isn't present, create the piece there or tell the user you need the Journal project to publish into.

## Deploy & connectivity (DGTL VPS)

DGTL does **not** use Netlify. Publishing goes through the DGTL portal at **deploy.dgtlmedia.io**:
upload the finished **single self-contained HTML** (the `.standalone.html`), which the portal
indexes and serves at a slug under **https://pitch.dgtlmedia.io/<slug>**. One file per slug — so
the deploy artifact must inline everything (no sibling folders); `scripts/make-standalone.py` is
what produces it.

Because every DGTL page — teaser, full pitch, and creator feature — lives at its own
pitch.dgtlmedia.io slug, **cross-page links must be absolute** `https://pitch.dgtlmedia.io/…`
URLs, and pages should link to **each other** so the VPS indexes a connected graph, not orphan
pages:

- Creator feature ⇄ **Journal hub** — the hub card is the primary inbound link; the feature links back to the hub and related creators.
- Creator feature ⇄ **the teaser / full pitch** the creator appears in — link both ways, so a prospect on a pitch can meet the creators, and a creator's fans can find the offer.
- Set `canonical`, `og:url`, and every JSON-LD `@id` to the page's real pitch.dgtlmedia.io slug (already absolute in `fields.json`).
- Keep a simple **slug registry** (offer / creator → slug) so links stay consistent as the build grows. When you feature a creator who appears in an existing pitch, add a link from that pitch to the new feature, and vice-versa. This two-way indexing is the point — it compounds across future builds.

## Guardrails (read `references/sourcing-and-rights.md` for the full version)

- Only publish verifiable facts; cite sources; attribute quotes to a named source, kept short.
- Don't fabricate metrics, awards, quotes, clients, or DGTL-network membership.
- Screenshots are editorial reference, attributed; never bypass logins, paywalls, or CAPTCHAs.
- The creator's `sameAs` / outbound links must be their real, verified accounts.
- Write for people; let ranking follow from a genuinely good, well-sourced page — no keyword stuffing, cloaking, or link schemes (search engines penalize them, per `references/seo-and-backlinks.md`).
