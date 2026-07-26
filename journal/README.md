# DGTL Influence Journal — editorial asset templates

> **⚠️ Historical — pre-migration.** This README describes the old flat `influence-journal/`
> layout (`creators/`, `cases/`, `assets/`) as it existed in `content-checkout-funnel`. That
> structure was reshaped into the `journal/packs/<slug>/` pack model at the 2026-07-17 split.
> **For the current layout and the "add a creator" flow, see the repo-root `README.md`.**
> Kept here because the block-library and design-system notes below are still accurate.


A small, deployable **editorial publication** for framing the work of creators in the DGTL
network — built to read like a media outlet writing about your talent, and built for SEO.
Same black + gold (`#F0CF50`) Manrope identity as dgtlgroup.io.

These are **working page templates** (not a block catalog): real, populate-ready article
pages you can publish per creator or per case.

## What's in here

```
influence-journal/
├── index.html                     # Publication hub — lists articles, SEO internal-linking, newsletter
├── creators/
│   └── peter-mckinnon.html        # Flagship creator profile (person-led) — fully populated example
├── cases/
│   └── a-day-with-swae-lee.html   # Portfolio-as-editorial case study (work-led) — fully populated example
├── creator-feature-template.html  # BLANK fillable template — {{TOKENS}} + guidance comments
├── library.html                   # Creator Publication Kit — 20 reusable blocks, showcased live
├── assets/
│   ├── dgtl-editorial.css         # Shared design system (edit once, every page updates)
│   ├── dgtl-blocks.css            # Styles for the 20 Publication Kit blocks
│   ├── journal.js                 # Reveal-on-scroll, count-up, sticky CTA, demo forms
│   ├── blocks.js                  # Spotlight swap, TOC scrollspy, follow toggle
│   └── logos/                     # DGTL wordmark, spark, + 18 client marks (white-on-dark)
├── _headers                       # Netlify security header
└── README.md

## Block library — the Creator Publication Kit (`library.html`)

A showcase of **20 reusable, DGTL-branded blocks** for building creator publications and
portfolios — presented like dgtlgroup's block library, each block a live demo with number,
title, category and description. Three categories:

- **Editorial (01–08)** — magazine hero, byline & share bar, sticky table of contents, pull
  quote, key-takeaways/TL;DR, figure & caption, FAQ accordion, inline newsletter.
- **Portfolio (09–16, 20)** — creator profile header, stat bar, bento grid, featured-project
  spotlight (interactive), case-study result card, brand-collaboration wall, awards & press row,
  rate card / packages, hire-this-creator CTA.
- **Social (17–19)** — social post mock grid, showreel video band, metrics ticker.

Every block is parametric and built to be **populated** — swap the placeholder persona
(“Ava Reyes / @ava.reyes”), gradient tiles and sample figures for real, verified creator data.
Network figures and client logos shown are real DGTL facts. This is the asset set the
research-and-scrape populate workflow will fill per creator.
```

## The four block families (each template uses all four)

1. **Creator profile & feature headers** — eyebrow + headline (one gold accent word), dek,
   byline with share, hero media with gold play affordance, 4-cell creator stat bar.
2. **Long-form article layouts** — drop-cap lead, H2/H3, pull-quotes, inline figures,
   stat-over-image callouts, key-takeaways callout.
3. **Portfolio-as-editorial galleries** — an annotated hero-plus-supporting grid that frames
   the work as a feature. Swap the gradient tiles (`.ph` / `.ph-2` / `.ph-3`) for real stills.
4. **SEO structure blocks** — breadcrumbs, FAQ accordion, related-articles grid, tag chips,
   author bio card — plus the technical scaffolding below.

## DGTL brand components (from the brand kit)

Built on the real DGTL component library, not an approximation: glass nav with mobile
hamburger overlay, an **animated logo marquee** (18 verified client marks, edge fades,
pause-on-hover), **work/case cards** with a big ghost metric + `CATEGORY · YEAR` kicker,
the big **stats band** (48–64px gold, count-up on scroll), the signature **statement line**
(ghost text + gold finale with a typewriter cursor), a **testimonial card** with a verified
quote, the spark-bolt watermark + vignette atmosphere, and the 4-column footer with SVG
social icons. Gold stays an accent (headline word, key numbers, primary CTA) per the brand's
emphasis hierarchy.

## SEO built in (real, not cosmetic)

- Semantic HTML: `<article>`, `<figure>/<figcaption>`, heading hierarchy, `<nav aria-label>`.
- **JSON-LD** per page (validated): `Article` + `Person` + `BreadcrumbList` + `FAQPage`
  (+ `VideoObject` on the case study; `WebSite` + `Blog` + `Organization` on the hub).
- Full `<meta>` description/keywords, canonical, Open Graph + Twitter card tags.
- Internal linking between hub ⇄ articles ⇄ related, so the section builds topical authority.

> Test any page after editing at [Google Rich Results Test](https://search.google.com/test/rich-results)
> and [Schema.org validator](https://validator.schema.org/).

## Publishing a new creator (≈10 minutes)

1. Copy `creator-feature-template.html` into `/creators/` or `/cases/` and rename it.
2. Find-and-replace every `{{TOKEN}}` (full list is in the comment at the top of that file).
3. Replace gradient tiles with real `<img>` stills; add a real Open Graph image under `assets/og/`.
4. Add a card for it on `index.html` (copy an existing `.acard`), and point its `href` at the new file.
5. Delete the yellow TEMPLATE banner.

## Fact discipline (important)

The DGTL brand rule is: **never invent creators, stats, quotes, or client claims.** In these
files, every DGTL claim traces to verified facts (network: 80+ vetted creators · 350M+ reach ·
5B+ impressions · 60+ campaigns; Peter McKinnon is a verified network affiliate; the Swae Lee
"A Day With" details are from the verified case study). Peter's platform numbers are his public
figures. When you add a creator, keep the same discipline — real numbers only, or leave the slot
out.

## Preview & deploy

- **Preview locally:** open `index.html` in a browser (assets load via relative paths).
- **Deploy:** drop the `influence-journal/` folder onto Netlify (or any static host). The
  `_headers` file sets `X-Content-Type-Options: nosniff`. Suggested live path: `/journal/`
  on `pitch.dgtlmedia.io` — update the `canonical` / `og:url` / JSON-LD `@id` URLs if you host elsewhere.

---
© 2026 DGTL. Powered by DGTL Influence.
