# dgtl.mov — placeholder-site brief

> Read [`README.md`](README.md) in this folder FIRST — it carries the brand-kit
> instructions, copy rules, page anatomy, output layout and git workflow that
> bind this brief. This file only adds what is specific to dgtl.mov.

## Identity

| | |
|---|---|
| Domain | `dgtl.mov` |
| Output | `sites/dgtl-mov/index.html` (+ `assets/` per the README) |
| Tier | 3 · Publishing & delivery |
| Nav kicker | DGTL Mov |
| Branch / PR | `feat/site-dgtl-mov` → PR `feat(sites): dgtl.mov placeholder` |

## Role (the one line everything derives from)

Video delivery — where clients and creators will receive finished motion work.

## Hero direction

- Headline: **“Motion, mastered and handed over.”** — use it verbatim or improve it *within the same
  register*; if you improve it, keep it under 6 words.
- Support sentence: The future home of DGTL video delivery: final cuts and masters, handed over cleanly. Until it opens, delivery continues by direct link.
- CTA: mailto:hello@dgtlgroup.io ('Question about a delivery?').

## The supporting band

**Instruction band** — same pattern as dgtl-pics: one callout ('Expecting a cut? Your producer will send a direct link until this portal opens.') + contact.

## Specific notes

Sibling of dgtl-pics — intentionally the same anatomy so the two read as one delivery system; differentiate with copy only, not layout.

## Definition of done

- Page matches the README anatomy, built with `/dgtl-brand-kit`, fully
  self-contained (Google Fonts only external request).
- Honesty constraint respected — nothing invented beyond this brief.
- `python3 tools/check-links.py` reports `missing=0`.
- Brand screenshot pass at 1512px and 390px.
- PR opened from `feat/site-dgtl-mov` touching only `sites/dgtl-mov/`.
