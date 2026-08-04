# dgtl.rent — placeholder-site brief

> Read [`README.md`](README.md) in this folder FIRST — it carries the brand-kit
> instructions, copy rules, page anatomy, output layout and git workflow that
> bind this brief. This file only adds what is specific to dgtl.rent.

## Identity

| | |
|---|---|
| Domain | `dgtl.rent` |
| Output | `sites/dgtl-rent/index.html` (+ `assets/` per the README) |
| Tier | 4 · Commercial line |
| Nav kicker | DGTL Rent |
| Branch / PR | `feat/site-dgtl-rent` → PR `feat(sites): dgtl.rent placeholder` |

## Role (the one line everything derives from)

A commercial line of DGTL Group in build — rental, on its own identity.

## Hero direction

- Headline: **“Built to be borrowed.”** — use it verbatim or improve it *within the same
  register*; if you improve it, keep it under 6 words.
- Support sentence: A new DGTL commercial line is being built at this address. Details when it opens.
- CTA: mailto:hello@dgtlgroup.io ('Ask about it early').

## The supporting band

**Teaser band** — single centered callout ('A DGTL Group venture, opening at this address.') + contact CTA. Nothing else.

## Specific notes

Line of business undefined publicly — do NOT specify what is rented (no equipment/studio/space claims). Headline stays abstract.

## Definition of done

- Page matches the README anatomy, built with `/dgtl-brand-kit`, fully
  self-contained (Google Fonts only external request).
- Honesty constraint respected — nothing invented beyond this brief.
- `python3 tools/check-links.py` reports `missing=0`.
- Brand screenshot pass at 1512px and 390px.
- PR opened from `feat/site-dgtl-rent` touching only `sites/dgtl-rent/`.
