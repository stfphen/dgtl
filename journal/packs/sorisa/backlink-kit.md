# Sorisa — Backlink kit

Goal: the two-way link. DGTL links out to Sorisa's real profiles; Sorisa (and the people in
the story) link back to the feature. That's what earns the page real editorial backlinks and
sends traffic both ways.

## Live URLs (after deploy)

- Feature page: `https://pitch.dgtlmedia.io/journal/creators/sorisa/`
- The night he first took the stage: `https://pitch.dgtlmedia.io/journal/cases/sorisa-lees-palace-dom-corleo/`
- The Rise of Sorisa: `https://pitch.dgtlmedia.io/journal/cases/sorisa-the-rise/`
- Sorisa at Rolling Loud: `https://pitch.dgtlmedia.io/journal/cases/sorisa-rolling-loud/`

## For Sorisa (or his team) to post / add to link-in-bio

**Instagram / TikTok caption**
> Featured in the DGTL Influence Journal. They were shooting my first-ever set at Lee's Palace before any of this — full story ↓
> pitch.dgtlmedia.io/journal/creators/sorisa

**Story / link sticker text**
> DGTL Influence Journal — my feature →

**Press / "as seen in" line for a site or EPK**
> As featured in the DGTL Influence Journal → https://pitch.dgtlmedia.io/journal/creators/sorisa/

## For the people in the story (tag when sharing)

- Yves — [@luv.yves](https://www.instagram.com/luv.yves/)
- Wake Taylor — [@wake.taylor](https://www.instagram.com/wake.taylor/)
- Freem — Toronto artist on the Sept 23 bill

Suggested tag line for the Lee's Palace piece:
> The night Sorisa first hit the stage at Lee's Palace — @luv.yves and @wake.taylor were in the room. DGTL was too. → pitch.dgtlmedia.io/journal/cases/sorisa-lees-palace-dom-corleo

## For DGTL's own channels

**X / LinkedIn**
> New in the Influence Journal: Sorisa — Toronto's 16-year-old breakout. Bedroom SoundCloud → Atlantic Records → Rolling Loud → a sold-out Lee's Palace. We were shooting his first set before the world caught on. → pitch.dgtlmedia.io/journal/creators/sorisa

## Cross-links already wired (internal authority)

- Journal hub (`index.html`) → Sorisa is the **featured** article + a creator card + all 3 case cards.
- Feature page ⇄ all 3 articles (related cards, both directions).
- Existing "A Day With Swae Lee" case → links to the Sorisa Lee's Palace piece (music-to-music).
- Every page's canonical / og:url / JSON-LD `@id` set to the real pitch.dgtlmedia.io slug.

## Reminder

Media are on-brand gradient placeholders. Swapping DGTL's real Sept 23, 2025 Lee's Palace
frames into `assets/media/sorisa/` (and adding a `media` block to `sorisa.fields.json`, then
re-running `populate.py` + `make-standalone.py`) is what will make these pages truly yours —
and give the featured people a photo worth sharing back.
