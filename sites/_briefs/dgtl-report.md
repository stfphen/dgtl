# dgtl.report — placeholder-site brief

> Read [`README.md`](README.md) in this folder FIRST — it carries the brand-kit
> instructions, copy rules, page anatomy, output layout and git workflow that
> bind this brief. This file only adds what is specific to dgtl.report.

## Identity

| | |
|---|---|
| Domain | `dgtl.report` |
| Output | `sites/dgtl-report/index.html` (+ `assets/` per the README) |
| Tier | 3 · Publishing & delivery |
| Nav kicker | DGTL Report |
| Branch / PR | `feat/site-dgtl-report` → PR `feat(sites): dgtl.report placeholder` |

## Role (the one line everything derives from)

Client reporting — where retained clients will read their monthly progress and quarterly reviews.

## Hero direction

- Headline: **“The numbers, in writing.”** — use it verbatim or improve it *within the same
  register*; if you improve it, keep it under 6 words.
- Support sentence: The future home of DGTL client reporting: monthly progress and quarterly reviews, in one place. Until it opens, reports arrive from your account lead.
- CTA: mailto:hello@dgtlgroup.io.

## The supporting band

**Instruction band** — one callout: 'A DGTL client expecting a report? It comes directly from your account lead until this portal opens.' + contact.

## Specific notes

Trust tone — this will hold client data one day; the placeholder should already feel private and exact. No stats, no marquee.

## Definition of done

- Page matches the README anatomy, built with `/dgtl-brand-kit`, fully
  self-contained (Google Fonts only external request).
- Honesty constraint respected — nothing invented beyond this brief.
- `python3 tools/check-links.py` reports `missing=0`.
- Brand screenshot pass at 1512px and 390px.
- PR opened from `feat/site-dgtl-report` touching only `sites/dgtl-report/`.
