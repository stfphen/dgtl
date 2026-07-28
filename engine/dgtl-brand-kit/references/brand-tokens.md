# DGTL Brand Tokens — source of truth (extracted live from dgtlgroup.io, July 2026)

Every DGTL-branded surface uses these exact values. `assets/dgtl-tokens.css` encodes all of them as CSS custom properties — start there and only reach back into this file for the reasoning and usage rules.

## Color

### Surfaces (dark, layered)
The brand lives on pure black, with elevation expressed as *slightly* lighter surfaces — never grey panels:
- `--bg` `#000000` — page/app background
- `--surface-1` `#0a0a0a` — inputs, wells, inset areas
- `--surface-2` `#111111` — raised panels, sidebars, table headers
- `--surface-card` `rgba(0,0,0,0.45)` — cards over textured/blurred contexts (the site's own card fill)
- Elevation is mostly communicated by **border + shadow**, not fill: border `#2a2a2a`, shadow `0 6px 6px rgba(0,0,0,.3), 0 0 20px rgba(0,0,0,.15)`

### Text
- `--text` `#F0F0F0` — primary
- `--text-muted` `#D0D0D0` — secondary, nav links, body-adjacent
- `--text-dim` `#8a8a8a` — captions, labels, metadata
- `--text-ghost` `#5a5a56` — oversized statement lines (with gold finale)
- `--gold-tan` `#b3a06a` — eyebrows/kickers, category lines (dim gold, uppercase, letterspaced)

### Accent
- `--gold` `#F0CF50` (rgb 240,207,80) — THE brand accent. Reserve it for: the primary action, key metrics/numbers, active/selected states, brand marks, one accent word in a headline. Tint for chips/pills: `rgba(240,207,80,0.08)` background with `#F0CF50` text.
- Gold on gold-bg text is always **black** (`#000`), weight 700.

### Borders & lines
- `--border` `#2a2a2a` (1px solid) — the default everywhere
- `--border-subtle` `rgba(255,255,255,0.08)` — hairlines on glassy bars
- `--border-strong` `rgba(255,255,255,0.4)` — secondary button outline

### Functional colors (app UI extension)
Derived to sit quietly on black — muted, used as tint + text pairs like the gold pill pattern:
- Success `#7BC47F` on `rgba(123,196,127,0.10)`
- Warning `#E8A33D` on `rgba(232,163,61,0.10)`
- Error `#E5484D` on `rgba(229,72,77,0.10)`
- Info `#6E9FDB` on `rgba(110,159,219,0.10)`
Gold stays reserved for brand/primary — do not use it as "warning yellow".

### Chart palette (in order)
`#F0CF50` (primary series), `#b3a06a`, `#F0F0F0`, `#6E9FDB`, `#7BC47F`, `#8a8a8a`. Grid lines `#1c1c1c`, axis labels `#8a8a8a` 11-12px. Fills under lines: gold at 0.06–0.12 opacity gradient to transparent.

## Typography
- **Manrope everywhere.** `<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">`, fallback `ui-sans-serif, system-ui, -apple-system, sans-serif`.
- Body 16px/24px `#F0F0F0`. Small/meta 12–14px.
- Display/hero H1: `clamp(40px, 6vw, 70px)`, weight 700, letter-spacing `-1.4px`, white; optionally last word(s) gold.
- Section H2: ~40px weight 700 white. App-context H2/panel titles: 20–24px weight 700.
- Eyebrow/kicker: 11–12px, uppercase, letter-spacing `0.15em`, color `#b3a06a`.
- Numbers get the drama: big metrics 48–64px weight 800 gold; tabular numbers in tables (`font-variant-numeric: tabular-nums`).

## Geometry
- Radius: buttons/inputs `7px` · cards/panels/modals `16px` · pills/badges/avatars `9999px`
- Control heights: buttons/inputs ~48px (padding 15px 24px / 12px 16px)
- Content column: max-width ~1120px, padding 0 24px (marketing). Apps may go fluid but keep 24px gutters.
- Card padding ~20–24px; grid gap 24px.

## Texture & atmosphere
Black is not flat black: add barely-visible radial-gradient vignettes and, on hero/empty surfaces, a huge rotated copy of the gold spark bolt (`assets/logos/spark.svg`) at 0.04–0.06 opacity behind content. Glassy bars (nav, app headers): `rgba(0,0,0,0.45)` + `backdrop-filter: blur(8px) saturate(1.8)` + bottom hairline `--border-subtle`.

## Motion
Subtle and confident: IntersectionObserver fade/translate reveals (~600ms ease), hover lift `translateY(-2px)` on cards/buttons, count-up on metrics, marquee 36–42s linear loop. Always guard with `@media (prefers-reduced-motion: reduce)`.

## Logo assets (`assets/logos/`)
- `logo-white-gold.svg` — DGTL wordmark (white + gold). Height 26px in nav contexts. Inline as `data:image/svg+xml;charset=utf-8,<urlencoded>`.
- `spark.svg` — gold lightning bolt mark. Watermark or standalone brand mark (favicon-ish, loading states).
- 18 client marks (PNG, white-filled/grayscale-lifted, trimmed, ≤300×96): on-running, canon, dji, epidemic-sound, mercedes-benz, anker, hyundai, six-senses-ibiza, arcteryx, audi, lexus, polarpro, ford, porsche, corona, guilds-garage, rotary, canadream (+ swae-lee-w). Embed as base64 data URLs via `scripts/logo-data-urls.py` (`--marquee`, `--single <name>`, `--list`, `--art-villas` for a text wordmark). Display ~28–34px tall, opacity .85, grayscale on dark. **Never hotlink; never recolor.**

## Voice (when the surface carries copy)
Confident, energetic, results-first. Action verbs (empower, unlock, elevate, scale). Concrete numbers over adjectives. Casual-professional. Microcopy in apps stays crisp: "Book a Call →", "View Work →", empty states encourage action ("Nothing here yet — create your first campaign"). Arrows `→` after CTAs are a brand tic — use them.

## Standard links (marketing surfaces)
Home https://dgtlgroup.io · /services · /work · /about · /contact · /book-a-call · /blog · /careers · /faq. Socials: facebook.com/dgtlgroup.io, instagram.com/dgtlgroup, x.com/dgtlgroup, linkedin.com/company/dgtlgroup. Footer line: `© 2026 DGTL. All Rights Reserved.`

## Fact discipline
This kit ships **style, not claims**. Do not state DGTL clients, case studies, stats, or testimonials from memory — verified facts live in the dgtl-pitch-pages skill and on dgtlgroup.io. App/tool UIs generally need no DGTL claims at all; use the user's own content or neutral sample data.
