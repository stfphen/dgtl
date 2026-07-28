# Variance System — distinct pages, one identity

Teasers get made in batches — one per offer, one per prospect. If they all share the same hero, same grid, same rhythm, they read as a mail-merge and lose their punch. The fix isn't to reinvent the brand each time; it's to **vary the composition while holding the identity fixed.**

The rule of thumb: **tokens are constant, layout is variable.** Colors (`#000` / `#F0CF50`), Manrope, the logo, gold-as-accent, 7px/16px radii, the nav and footer — these never change; they're what makes it DGTL. What *does* change per page is the hero shape, how the portfolio is laid out, which accent motif recurs, and the background texture. Composed well, two teasers feel like two pieces from the same studio — not two runs of the same template.

## How to choose

Pick **one option from each of the four menus** below, and make the pick *fit the offer* rather than rolling dice:

1. a **Hero archetype**
2. a **Portfolio layout**
3. an **Accent motif** (used 2–3 times max across the page)
4. a **Texture treatment**

Then sanity-check for **coherence**: one confident idea per page. A full-bleed media hero (C) pairs naturally with cinematic bands (P5) and a quiet accent; a stark monument hero (A) wants a structured grid (P4) and a crisp motif. If two choices are both shouting, soften one. When you want determinism across a batch, seed the combination from the offer slug (e.g. hash → index into each menu) so re-runs are stable but neighbors differ.

Below, "media" means either the user's real provided frames or the premium abstract DGTL panels described in `teaser-blueprint.md`.

---

## Menu 1 — Hero archetypes

**A · Centered Monument.** Huge centered H1, lots of negative space, one sub-line, dual CTA below, faint spark watermark behind. The classic DGTL hero. Best when the *words* are the hook (a bold claim, a category-defining line). Calmest option — let the portfolio section bring the visuals.

**B · Split Editorial.** Headline + sub + CTAs in a left column; a compact media cluster (2–3 tiles or one tall frame) in the right column. Brings the work above the fold. Best for visual offers where seeing one frame sells the idea. On mobile, media stacks under the copy.

**C · Full-Bleed Showcase.** A large media panel or mosaic *is* the hero background, with a dark scrim and the headline + CTAs overlaid low-left or centered. The most cinematic, highest-impact opener. Best for hospitality, travel, film, fashion — anything where atmosphere is the pitch. Mind contrast: scrim must keep text AA-legible.

**D · Asymmetric Index.** Big left-aligned headline; a right-hand meta column with small labels (`01 — Concept`, `Category`, `Year`, a one-line note) and thin hairline rules. Reads like an art-director's index page. Best for software, systems, or "process/method" offers where structure signals rigor.

**E · Statement-First.** An oversized dim-grey statement line (`#5a5a56`, 56–72px) with the final word(s) in gold + typewriter cursor as the hero itself, tiny sub beneath, single CTA. Best when there's one quotable line worth the whole fold. Use sparingly — it's the loudest typographic move. With **hero rotation**, let each variant type/erase rather than cross-fade, or keep the typewriter on line 0 only and cross-fade the rest — never run both effects at once (honours "one confident accent moment per view").

## Menu 2 — Portfolio layouts

**P1 · Mosaic / Masonry.** Varied tile sizes (one large, several small) in an interlocking grid. Energetic, editorial. Great for 5–6 pieces of differing importance.

**P2 · Filmstrip Marquee.** A single auto-scrolling row of work thumbnails (pause on hover, edge fade masks), optionally two rows drifting opposite directions. Signals "a body of work" and motion. Great for many pieces or when individual titles matter less than volume.

**P3 · Spotlight + Thumbs.** One large featured piece with a row/column of smaller thumbnails beside it; clicking a thumb swaps the spotlight (vanilla JS). Best when one flagship case leads and others support.

**P4 · Editorial Grid.** A clean 2- or 3-column grid with vertical offset between columns and captions set beside, not under, the media. Structured, premium, calm. Pairs with hero A/D.

**P5 · Cinematic Bands.** Each work is a full-width band — wide media strip with the title/kicker overlaid or set alongside — stacked vertically. Immersive, scroll-driven. Pairs with hero C. Use for 3–4 hero-worthy pieces.

## Menu 3 — Accent motifs (pick one, use 2–3× max)

Gold is scarce; the motif is *where* it recurs so the page feels intentional.

- **Underline swipe** — a short gold underline that animates in under the accent word / section labels.
- **Corner brackets** — thin gold `⌐ ¬` brackets framing the hero or the featured tile.
- **Node / dot-grid** — small gold nodes on the concept beats or a faint gold dot-grid behind one section.
- **Index rule** — a vertical gold hairline + small number labels (`01/02/03`) down the concept or portfolio section.
- **Gradient sweep** — a soft gold radial bloom behind one key word or the featured media, nowhere else.

## Menu 4 — Texture treatments

- **Spark placement** — the `spark.svg` watermark at opacity 0.04–0.06, rotated/positioned differently (top-right, bleeding off left edge, centered-huge behind hero).
- **Vignette map** — radial black vignettes anchored to different corners to shift the visual weight.
- **Grain** — a subtle CSS/noise grain over dark surfaces on, or off for a cleaner look.
- **Hairline field** — a faint `#2a2a2a` hairline grid or single rules separating sections, vs. pure open black.

---

## Guardrails (what variance must NOT touch)

- **Never** change the palette, Manrope, the DGTL logo, or gold-as-accent. A teaser drowning in gold, or in a second color, stops being DGTL.
- **Never** restyle the nav or footer beyond the "slim footer" allowance in `teaser-blueprint.md` — they anchor the identity.
- **One** confident accent moment per view. Variance adds *variety of composition*, not *volume of effects*. If the page has three animations competing, remove two.
- Keep every archetype fully responsive with `prefers-reduced-motion` fallbacks. Cinematic and marquee options especially need a static, legible mobile form.

## Worked pairings (starting points, not rules)

- **Hospitality / destination / travel:** Hero **C** (full-bleed showcase) + **P5** (cinematic bands) + gradient-sweep accent + spark bleeding off one edge. Atmosphere-led.
- **Software / platform / systems:** Hero **D** (asymmetric index) + **P4** (editorial grid) + index-rule accent + hairline field. Rigor-led.
- **Influencer / creator / social:** Hero **B** (split editorial) + **P2** (filmstrip marquee) + node accent + grain on. Volume-and-motion-led.
- **DTC / ecommerce / product:** Hero **A** (monument) + **P3** (spotlight + thumbs) + underline-swipe accent + vignette map. Claim-led with one flagship result.
