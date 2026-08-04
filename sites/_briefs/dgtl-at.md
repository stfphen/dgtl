# dgtl.at — placeholder-site brief

> Read [`README.md`](README.md) in this folder FIRST — it carries the brand-kit
> instructions, copy rules, page anatomy, output layout and git workflow that
> bind this brief. This file only adds what is specific to dgtl.at.

## Identity

| | |
|---|---|
| Domain | `dgtl.at` |
| Output | `sites/dgtl-at/index.html` (+ `assets/` per the README) |
| Tier | 4 · Commercial line |
| Nav kicker | DGTL At |
| Branch / PR | `feat/site-dgtl-at` → PR `feat(sites): dgtl.at placeholder` |

## Role (the one line everything derives from)

A short, sharp DGTL address — its exact role lands with the ecosystem build-out.

## Hero direction

- Headline: **“The shortest way to DGTL.”** — use it verbatim or improve it *within the same
  register*; if you improve it, keep it under 6 words.
- Support sentence: This address joins the DGTL ecosystem shortly. For now, the front door is the agency.
- CTA: Primary link to https://dgtlgroup.io/.

## The supporting band

**Redirect-style band** — one callout linking https://dgtlgroup.io/ prominently ('Head to the agency →').

## Specific notes

Shortest page of the set (~50 words). It must still be fully branded — never a bare redirect page.

## Definition of done

- Page matches the README anatomy, built with `/dgtl-brand-kit`, fully
  self-contained (Google Fonts only external request).
- Honesty constraint respected — nothing invented beyond this brief.
- `python3 tools/check-links.py` reports `missing=0`.
- Brand screenshot pass at 1512px and 390px.
- PR opened from `feat/site-dgtl-at` touching only `sites/dgtl-at/`.
