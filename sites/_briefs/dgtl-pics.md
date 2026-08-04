# dgtl.pics — placeholder-site brief

> Read [`README.md`](README.md) in this folder FIRST — it carries the brand-kit
> instructions, copy rules, page anatomy, output layout and git workflow that
> bind this brief. This file only adds what is specific to dgtl.pics.

## Identity

| | |
|---|---|
| Domain | `dgtl.pics` |
| Output | `sites/dgtl-pics/index.html` (+ `assets/` per the README) |
| Tier | 3 · Publishing & delivery |
| Nav kicker | DGTL Pics |
| Branch / PR | `feat/site-dgtl-pics` → PR `feat(sites): dgtl.pics placeholder` |

## Role (the one line everything derives from)

Photo delivery — where clients and creators will receive finished stills.

## Hero direction

- Headline: **“Your frames, delivered here.”** — use it verbatim or improve it *within the same
  register*; if you improve it, keep it under 6 words.
- Support sentence: The future home of DGTL photo delivery: finished stills, handed over cleanly. Until it opens, delivery continues by direct link.
- CTA: mailto:hello@dgtlgroup.io ('Question about a delivery?').

## The supporting band

**Instruction band** — one `card-callout`: 'Expecting a delivery? Your producer will send a direct link until this portal opens.' plus contact CTA.

## Specific notes

Utility tone — calm, minimal, service-flavoured. No portfolio content here (that's dgtl.gallery's job).

## Definition of done

- Page matches the README anatomy, built with `/dgtl-brand-kit`, fully
  self-contained (Google Fonts only external request).
- Honesty constraint respected — nothing invented beyond this brief.
- `python3 tools/check-links.py` reports `missing=0`.
- Brand screenshot pass at 1512px and 390px.
- PR opened from `feat/site-dgtl-pics` touching only `sites/dgtl-pics/`.
