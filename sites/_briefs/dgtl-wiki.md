# dgtl.wiki — placeholder-site brief

> Read [`README.md`](README.md) in this folder FIRST — it carries the brand-kit
> instructions, copy rules, page anatomy, output layout and git workflow that
> bind this brief. This file only adds what is specific to dgtl.wiki.

## Identity

| | |
|---|---|
| Domain | `dgtl.wiki` |
| Output | `sites/dgtl-wiki/index.html` (+ `assets/` per the README) |
| Tier | 3 · Publishing & delivery |
| Nav kicker | DGTL Wiki |
| Branch / PR | `feat/site-dgtl-wiki` → PR `feat(sites): dgtl.wiki placeholder` |

## Role (the one line everything derives from)

The knowledge surface of the DGTL ecosystem — playbooks and reference, opening up over time.

## Hero direction

- Headline: **“What we know, written down.”** — use it verbatim or improve it *within the same
  register*; if you improve it, keep it under 6 words.
- Support sentence: DGTL's public knowledge surface: the playbooks, standards and references behind the work. Opening progressively.
- CTA: Link to https://dgtlinfluence.com/ ('Read the Journal meanwhile').

## The supporting band

**Editorial pointer band** — one wide `card-callout` pointing readers at the Influence Journal (dgtlinfluence.com) as the place DGTL publishes today.

## Specific notes

Feels adjacent to the Journal's editorial identity — sparser, reference-flavoured, no marketing pressure.

## Definition of done

- Page matches the README anatomy, built with `/dgtl-brand-kit`, fully
  self-contained (Google Fonts only external request).
- Honesty constraint respected — nothing invented beyond this brief.
- `python3 tools/check-links.py` reports `missing=0`.
- Brand screenshot pass at 1512px and 390px.
- PR opened from `feat/site-dgtl-wiki` touching only `sites/dgtl-wiki/`.
