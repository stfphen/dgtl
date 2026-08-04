# dgtl.college — placeholder-site brief

> Read [`README.md`](README.md) in this folder FIRST — it carries the brand-kit
> instructions, copy rules, page anatomy, output layout and git workflow that
> bind this brief. This file only adds what is specific to dgtl.college.

## Identity

| | |
|---|---|
| Domain | `dgtl.college` |
| Output | `sites/dgtl-college/index.html` (+ `assets/` per the README) |
| Tier | 4 · Commercial line |
| Nav kicker | DGTL College |
| Branch / PR | `feat/site-dgtl-college` → PR `feat(sites): dgtl.college placeholder` |

## Role (the one line everything derives from)

A commercial line of DGTL Group in build — education, on its own identity.

## Hero direction

- Headline: **“Learn the machine.”** — use it verbatim or improve it *within the same
  register*; if you improve it, keep it under 6 words.
- Support sentence: An education property from DGTL Group is being built at this address. Details when it opens.
- CTA: mailto:hello@dgtlgroup.io ('Ask about early access').

## The supporting band

**Teaser band** — single centered callout ('Teaching what the network practices — coming.') + contact CTA.

## Specific notes

May reference that DGTL runs a real creator network (link join.dgtlinfluence.com) but NO curriculum, pricing, cohort or date claims.

## Definition of done

- Page matches the README anatomy, built with `/dgtl-brand-kit`, fully
  self-contained (Google Fonts only external request).
- Honesty constraint respected — nothing invented beyond this brief.
- `python3 tools/check-links.py` reports `missing=0`.
- Brand screenshot pass at 1512px and 390px.
- PR opened from `feat/site-dgtl-college` touching only `sites/dgtl-college/`.
