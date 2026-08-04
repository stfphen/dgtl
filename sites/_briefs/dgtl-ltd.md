# dgtl.ltd — placeholder-site brief

> Read [`README.md`](README.md) in this folder FIRST — it carries the brand-kit
> instructions, copy rules, page anatomy, output layout and git workflow that
> bind this brief. This file only adds what is specific to dgtl.ltd.

## Identity

| | |
|---|---|
| Domain | `dgtl.ltd` |
| Output | `sites/dgtl-ltd/index.html` (+ `assets/` per the README) |
| Tier | 0 · Corporate umbrella |
| Nav kicker | DGTL Group |
| Branch / PR | `feat/site-dgtl-ltd` → PR `feat(sites): dgtl.ltd placeholder` |

## Role (the one line everything derives from)

The corporate umbrella — who DGTL is and everything it owns.

## Hero direction

- Headline: **“One group. Every surface of digital.”** — use it verbatim or improve it *within the same
  register*; if you improve it, keep it under 6 words.
- Support sentence: The holding page for DGTL Group: the agency, the platform, the publishing arm and the products underneath one roof.
- CTA: Primary CTA links https://dgtlgroup.io/ ('Visit the agency'). Secondary: mailto contact.

## The supporting band

**Property index band** — a quiet 3-column card grid linking the live properties (dgtlgroup.io 'The agency', dgtlinfluence.com 'The Journal', join.dgtlinfluence.com 'The creator network'). Cards use `card-solid`, no images, role one-liners only. This page MAY use the four real network stats as a statband.

## Specific notes

This is the most permanent of the ten — it will grow into the corporate index, so keep the property grid semantic and easy to extend.

## Definition of done

- Page matches the README anatomy, built with `/dgtl-brand-kit`, fully
  self-contained (Google Fonts only external request).
- Honesty constraint respected — nothing invented beyond this brief.
- `python3 tools/check-links.py` reports `missing=0`.
- Brand screenshot pass at 1512px and 390px.
- PR opened from `feat/site-dgtl-ltd` touching only `sites/dgtl-ltd/`.
