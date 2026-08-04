# Placeholder-site briefs — shared guidelines for every build agent

One brief per new `dgtl.*` domain. Each brief hands one agent one page to build.
Read THIS file fully, then your assigned `<slug>.md`, then build. Nothing in
here is optional.

## What you are building

A single, self-contained, brand-true **placeholder page**: the domain's first
impression while its real property is built. It must look like DGTL built it
on purpose — a positioned landing, not a parked domain. One `index.html` per
site, no build step, served at the domain root on Hostinger shared hosting.

## The one skill you must use

Invoke the **`/dgtl-brand-kit`** skill (`anthropic-skills:dgtl-brand-kit`)
before writing any markup, and follow it exactly:

- Start your stylesheet from `engine/dgtl-brand-kit/assets/dgtl-tokens.css`
  (inline it — the page must be fully self-contained).
- Fonts: Manrope from Google Fonts — the ONLY permitted external request.
- Wordmark + spark: copy `engine/dgtl-brand-kit/assets/logos/logo-white-gold.svg`
  and `spark.svg` into your site's `assets/` folder. Wordmark at 26px in the
  nav; spark as favicon and as a rotated ~0.05-opacity hero watermark.
- Gold `#F0CF50` is an accent, never a theme. Near-black surfaces, `#2a2a2a`
  borders, 7px button radius, 16px card radius.
- Client logos (if your brief calls for them): data-URLs via
  `python3 engine/dgtl-brand-kit/scripts/logo-data-urls.py` only. Never hotlink.

## Copy rules — the honesty constraint

These domains' business lines are **not all defined yet**. You must NOT invent
DGTL facts: no made-up stats, client names, testimonials, launch dates,
pricing, or product claims. Allowed building blocks:

- The role line given in your brief (verbatim or lightly rephrased).
- "A DGTL Group property" / "Part of the DGTL ecosystem" framing.
- The real, verifiable network stats ONLY if your brief says so:
  80+ vetted creators · 350M+ combined reach · 5B+ impressions · 60+ campaigns.
- A single contact CTA: `mailto:hello@dgtlgroup.io` (until told otherwise).
- Links to live properties: https://dgtlgroup.io/ · https://dgtlinfluence.com/
  · https://join.dgtlinfluence.com/

Tone: confident, sparse, editorial. A placeholder that reads like a teaser,
not an apology. 60–120 words of visible copy total is the target.

## Required page anatomy

1. Minimal glass nav: wordmark + kicker (the property name from your brief),
   right side one link to dgtlgroup.io.
2. Hero: eyebrow (tier/role), one `h-display` headline per your brief's
   direction, one supporting sentence, one CTA (contact or a live-property link).
   Spark watermark + subtle gold radial vignette per the kit.
3. One quiet supporting band — your brief specifies which variant.
4. Footer: © 2026 DGTL Group · Toronto + links to the live properties.

SEO head: real `<title>` and meta description from your brief's role line,
`<link rel="canonical" href="https://<domain>/">`, OG basics,
`robots: index, follow` (these are permanent URLs, not throwaways).
JSON-LD: one `WebSite` node + the shared `Organization` node
(`"@id":"https://dgtlgroup.io/#organization"` — copy the shape from
`apps/creator-intake/site/index.html`).

Accessibility: real landmarks, one h1, visible focus states, AA contrast,
`prefers-reduced-motion` respected (the tokens file handles most of this).

## Output layout (exact)

```
sites/<slug>/
  index.html          # everything inline except Google Fonts + assets/
  assets/
    logo-white-gold.svg
    spark.svg
```

Root-absolute links are permitted in `sites/` (each site deploys at its own
domain root) but pointless on a one-pager — use relative `assets/…` paths.

## Git — how each agent commits

- Branch: `feat/site-<slug>` off current `main`. One site per branch/PR.
- Touch ONLY `sites/<slug>/`. Do not edit shared files, other sites, the
  briefs, or `tools/` — the deploy pipeline maps folders to deploy branches
  centrally and is not your concern.
- Before opening the PR, run `python3 tools/check-links.py` — must report
  `missing=0` — and verify with the brand kit's screenshot checklist
  (desktop 1512 + mobile 390: wordmark 26px, gold sparse, Manrope rendering,
  cards/buttons on token radii, mobile usable).
- PR title: `feat(sites): <domain> placeholder`. Body: one screenshot of the
  hero + the check-links line.

## The ten briefs

| Brief | Domain | Tier (architecture map) |
|---|---|---|
| [dgtl-ltd.md](dgtl-ltd.md) | dgtl.ltd | 0 · Corporate umbrella |
| [dgtl-chat.md](dgtl-chat.md) | dgtl.chat | 2 · Platform |
| [dgtl-wiki.md](dgtl-wiki.md) | dgtl.wiki | 3 · Publishing & delivery |
| [dgtl-gallery.md](dgtl-gallery.md) | dgtl.gallery | 3 · Publishing & delivery |
| [dgtl-pics.md](dgtl-pics.md) | dgtl.pics | 3 · Publishing & delivery |
| [dgtl-mov.md](dgtl-mov.md) | dgtl.mov | 3 · Publishing & delivery |
| [dgtl-report.md](dgtl-report.md) | dgtl.report | 3 · Publishing & delivery |
| [dgtl-rent.md](dgtl-rent.md) | dgtl.rent | 4 · Commercial line |
| [dgtl-college.md](dgtl-college.md) | dgtl.college | 4 · Commercial line |
| [dgtl-at.md](dgtl-at.md) | dgtl.at | 4 · Commercial line |
