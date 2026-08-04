# dgtl.gallery — placeholder-site brief

> Read [`README.md`](README.md) in this folder FIRST — it carries the brand-kit
> instructions, copy rules, page anatomy, output layout and git workflow that
> bind this brief. This file only adds what is specific to dgtl.gallery.

## Identity

| | |
|---|---|
| Domain | `dgtl.gallery` |
| Output | `sites/dgtl-gallery/index.html` (+ `assets/` per the README) |
| Tier | 3 · Publishing & delivery |
| Nav kicker | DGTL Gallery |
| Branch / PR | `feat/site-dgtl-gallery` → PR `feat(sites): dgtl.gallery placeholder` |

## Role (the one line everything derives from)

The showcase surface — campaign work and creator media, curated.

## Hero direction

- Headline: **“The work, on the wall.”** — use it verbatim or improve it *within the same
  register*; if you improve it, keep it under 6 words.
- Support sentence: A curated gallery of DGTL campaign and creator work is being hung. Until the doors open, the roster shows who is in it.
- CTA: Link to https://dgtlinfluence.com/roster.html ('Meet the roster').

## The supporting band

**Roster pointer band** — 3 `card-solid` cards linking live Journal profiles exactly as apps/creator-intake/site/index.html's proof row does (Shane Boyer, Casper, Sorisa — copy that block's structure and real copy).

## Specific notes

This page may use the client-logo marquee from the brand kit (data-URLs, kit sizing: 30px, .85 opacity) — it is a showcase property, the marquee IS the point.

## Definition of done

- Page matches the README anatomy, built with `/dgtl-brand-kit`, fully
  self-contained (Google Fonts only external request).
- Honesty constraint respected — nothing invented beyond this brief.
- `python3 tools/check-links.py` reports `missing=0`.
- Brand screenshot pass at 1512px and 390px.
- PR opened from `feat/site-dgtl-gallery` touching only `sites/dgtl-gallery/`.
