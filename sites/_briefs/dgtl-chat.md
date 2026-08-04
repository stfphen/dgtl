# dgtl.chat — placeholder-site brief

> Read [`README.md`](README.md) in this folder FIRST — it carries the brand-kit
> instructions, copy rules, page anatomy, output layout and git workflow that
> bind this brief. This file only adds what is specific to dgtl.chat.

## Identity

| | |
|---|---|
| Domain | `dgtl.chat` |
| Output | `sites/dgtl-chat/index.html` (+ `assets/` per the README) |
| Tier | 2 · Platform |
| Nav kicker | DGTL Chat |
| Branch / PR | `feat/site-dgtl-chat` → PR `feat(sites): dgtl.chat placeholder` |

## Role (the one line everything derives from)

A conversational surface of the DGTL platform — being built.

## Hero direction

- Headline: **“The conversation layer is coming.”** — use it verbatim or improve it *within the same
  register*; if you improve it, keep it under 6 words.
- Support sentence: A DGTL platform property in build. No product claims, no feature list — it does not exist publicly yet.
- CTA: mailto:hello@dgtlgroup.io ('Talk to us first').

## The supporting band

**Teaser band** — a single centered `card-callout` with one sentence ('Something conversational is being built on the DGTL platform.') and the contact CTA. Nothing else.

## Specific notes

STRICTEST honesty constraint of the set: the product is undefined. Do not imply AI, chatbots, support tooling or anything specific. Keep it to ~60 words visible copy.

## Definition of done

- Page matches the README anatomy, built with `/dgtl-brand-kit`, fully
  self-contained (Google Fonts only external request).
- Honesty constraint respected — nothing invented beyond this brief.
- `python3 tools/check-links.py` reports `missing=0`.
- Brand screenshot pass at 1512px and 390px.
- PR opened from `feat/site-dgtl-chat` touching only `sites/dgtl-chat/`.
