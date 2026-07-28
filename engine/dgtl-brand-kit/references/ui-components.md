# DGTL UI Component Library

Recipes for expressing any interface in the DGTL identity. Three tiers: **primitives** (used everywhere), **marketing components** (public-facing pages), **app components** (dashboards, tools, product UI). All values come from `brand-tokens.md` / `assets/dgtl-tokens.css`.

When a component you need isn't here, derive it: dark layered surface, `#2a2a2a` border, 16px radius (7px if it's a control), Manrope, `#D0D0D0`/`#8a8a8a` for secondary text, gold only where attention must land. Match the quietness of the rest of the system.

## Primitives

### Buttons
- **Primary**: bg `#F0CF50`, black text, radius 7px, padding 15px 24px, weight 700, 16px, trailing `→` (gap 8px). Hover: brightness ~1.06 + `translateY(-1px)`. App-scale variant: padding 10px 18px, 14px.
- **Secondary**: transparent, `1px solid rgba(255,255,255,0.4)`, white text, same geometry, no arrow.
- **Ghost/tertiary**: no border, `#D0D0D0` text, weight 500; hover white. Text-link CTA: 14px `#D0D0D0` + `→`.
- **Destructive** (app): transparent, `1px solid rgba(229,72,77,0.4)`, `#E5484D` text; confirm-state fills `rgba(229,72,77,0.12)`.
- **Icon button** (app): 36px square, radius 7px, transparent, `#8a8a8a` icon; hover `--surface-2` + white icon.
- One primary (gold) action per view region. Everything else is secondary/ghost.

### Cards / panels
bg `rgba(0,0,0,0.45)` (or `#0a0a0a`–`#111` in dense app layouts), border `1px solid #2a2a2a`, radius 16px, shadow `0 6px 6px rgba(0,0,0,.3), 0 0 20px rgba(0,0,0,.15)`, padding 20–24px. Optional hover: border lightens to `#3a3a3a` + lift. Gold left-border (3px) variant for highlighted/callout cards.

### Pills, tags, badges
- Tag pill: `rgba(240,207,80,0.08)` bg, `#F0CF50` text, radius 9999px, 11px, padding 2px 8px.
- Status badge: same shape using the functional tint+text pairs (success/warning/error/info from brand-tokens).
- Filter pill: active = white bg/black text; inactive = transparent, border `#2a2a2a`, `#D0D0D0`; radius 9999px, 14px, padding 8px 20px.
- Count badge: gold bg, black text, 11px weight 800, radius 9999px, min-width 18px.

### Forms & inputs
Inputs/textarea/select: bg `#0a0a0a`, border `1px solid #2a2a2a`, radius 7px, padding 12px 16px, text `#F0F0F0`, placeholder `#6a6a6a`. Label above: 12px `#D0D0D0` (weight 600). Focus: border-color `#F0CF50` + `box-shadow: 0 0 0 3px rgba(240,207,80,0.15)` (this ring is the universal focus style). Error state: border `#E5484D` + 12px error line. Checkbox/radio: accent gold (`accent-color: #F0CF50`). Toggle: track `#2a2a2a` → gold when on, black knob.

### Iconography
Simple line icons (inline SVG, `stroke: currentColor`, 1.5–2px stroke, 16–20px). Icon chip (feature/offer cards): 40–44px rounded square (radius 10px), `rgba(240,207,80,0.08)` bg, gold icon.

## Marketing components

- **Fixed nav**: height 73px, `rgba(0,0,0,0.45)` + `backdrop-filter: blur(8px) saturate(1.8)`, bottom hairline `rgba(255,255,255,0.08)`. DGTL logo left (26px, links to dgtlgroup.io), 14px/500 links right (`#D0D0D0`, current/hover white), content column 1120px. Mobile: hamburger → full-black overlay menu.
- **Hero**: centered, clamp-scaled H1 (last word(s) gold), 2–3 line muted sub (max-width 640px), dual CTA row, generous padding (~180px/120px), spark watermark + vignettes behind.
- **Logo marquee**: 11px uppercase letterspaced `#8a8a8a` label, then infinite CSS `translateX(-50%)` loop of the 18 white logos (~28–34px, opacity .85, gap 72px, duplicate set ×2, 36–42s, pause on hover, edge fade masks).
- **Stats band**: 3–4 gold numbers 48–64px weight 800 (JS count-up on scroll), small muted labels.
- **Statement line**: 56–64px weight 700 centered in `#5a5a56`, final word(s) gold with typewriter + blinking `|` cursor.
- **Testimonial card**: dark card, small brand logo (~26px) top, 14px `#D0D0D0` quote, `#2a2a2a` divider, 36px avatar + 13px bold name + 12px `#8a8a8a` role.
- **Work/case card**: media area top (abstract dark-gold radial-gradient panel with a big ghost metric — never hotlinked photos), kicker `CATEGORY · YEAR` in `#b3a06a`, white title, muted description, gold tag pills.
- **FAQ accordion**: one-open, border-separated rows, gold `+`/`×` indicator.
- **Footer**: 4 columns (logo | Quick Links | Connect With Us | Stay Connected w/ inline SVG social icons), headings 16px bold white, links 14px `#D0D0D0` line-height 2, bottom line `© 2026 DGTL. All Rights Reserved.` 12px `#8a8a8a`, top padding ~80px.

## App components

- **App shell**: fixed sidebar (240–260px, bg `#0a0a0a`, right border `#2a2a2a`) + glassy top bar (56–64px, same recipe as marketing nav) + main content on `#000` with 24–32px padding. Mobile: sidebar collapses to overlay drawer.
- **Sidebar nav item**: 14px/500 `#D0D0D0`, radius 7px, padding 10px 12px, line icon left. Hover `#111` + white. **Active: `rgba(240,207,80,0.08)` bg, gold text/icon, optional 2px gold left rail.** Section labels: 11px uppercase letterspaced `#8a8a8a`. User chip bottom: avatar + name + role, top hairline.
- **Top bar**: page title (16–18px/700 white) or breadcrumbs (`#8a8a8a` / white current), right cluster of icon buttons + avatar. Search input: pill or 7px radius, `#0a0a0a` bg, magnifier icon, placeholder `#6a6a6a`.
- **Metric/KPI card**: label 12px `#8a8a8a` uppercase-ish, value 32–40px weight 800 white (gold for THE number of the screen), delta as tiny success/error badge (`▲ 12%`), optional sparkline in gold.
- **Data table**: header row bg `#111`, 11–12px uppercase letterspaced `#8a8a8a` headings; body rows on `#000`/`#0a0a0a` with `#1c1c1c`—`#2a2a2a` row hairlines; 14px `#F0F0F0` cells, secondary cells `#8a8a8a`; numbers right-aligned tabular; row hover `#0f0f0f`; status as badges; row actions as icon buttons appearing on hover. Wrap the table in a panel (16px radius, `#2a2a2a` border, overflow hidden). Pagination: ghost prev/next + `#8a8a8a` count; active page pill gold-on-black text or white.
- **Modal/dialog**: overlay `rgba(0,0,0,0.7)` + slight blur; panel `#0a0a0a`, border `#2a2a2a`, radius 16px, max-width 480–640px, padding 24px; title 18px/700 white; footer right-aligned [ghost Cancel · primary Confirm]. Danger modals use destructive button, never gold.
- **Drawer**: same skin sliding from right, full-height, 400–480px.
- **Toast**: bottom-right, `#111` bg, `#2a2a2a` border, radius 10px, 14px text, colored 3px left rail per status; auto-dismiss with reduced-motion respect.
- **Tabs**: text tabs 14px/600, inactive `#8a8a8a`, active white with 2px gold underline. Segmented control: pill container `#0a0a0a` + border, active segment `#2a2a2a`-filled white text (gold text if it's the primary mode).
- **Charts**: palette + grid per brand-tokens. Dark tooltip (`#111`, border `#2a2a2a`, radius 7px). Bars radius 4px top. Donut center metric white/gold. Legends 12px `#8a8a8a`. Keep grids faint — the data glows, the chrome doesn't.
- **Empty state**: centered, spark bolt or line icon at low opacity, 16px/700 white line, 14px `#8a8a8a` sub, primary or secondary CTA. Encouraging voice.
- **Loading**: skeleton blocks `#111` shimmer to `#1a1a1a` (radius matches target), or gold spark pulse for full-screen.
- **Auth screens**: centered card (max-width 400px) on textured black (vignettes + faint spark watermark), DGTL or client logo top, form per primitives, gold submit with `→`. Divider `#2a2a2a` with 12px `#8a8a8a` "or".
- **Avatars**: circle, `#2a2a2a` bg, gold or white initials 12px/700; stack with -8px overlap + black ring.
- **Tooltips**: `#111`, border `#2a2a2a`, radius 7px, 12px, white text; no arrow needed.
- **Kbd/code** (docs/tools): `#0a0a0a` bg, `#2a2a2a` border, radius 4–7px, `ui-monospace` 13px, `#D0D0D0`; syntax accents may use the chart palette.

## Email / constrained surfaces
Table-based layout, solid `#000` bg, inline styles, system-font fallback stack declared with Manrope first, logo as hosted-or-attached image (data URLs don't work in most clients), gold buttons as bulletproof table cells. Keep the identity via black/gold/white ratio and typography weight contrast rather than effects (no backdrop-filter, no animations).
