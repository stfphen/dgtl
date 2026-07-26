# Applying the Kit — composition, restyling, verification

## The brand's emphasis hierarchy (why builds read as "DGTL" or don't)

DGTL surfaces feel expensive because attention is rationed. In descending order of visual loudness:
1. **One gold moment per view** — the primary CTA, the hero's accent word, or THE metric. Not three of them.
2. **Big white type** — headlines and key values carry weight (700–800) and tight letter-spacing.
3. **Muted supporting text** — `#D0D0D0` then `#8a8a8a`; most pixels on screen are quiet.
4. **Near-invisible structure** — `#2a2a2a` borders and layered near-blacks do the layout work; no bright dividers, no grey panels.
5. **Atmosphere** — vignettes, spark watermark, glassy bars; felt, not seen.

If a draft feels off, it's almost always a ratio problem: too much gold, borders too bright, or text insufficiently muted. Fix ratios before redesigning.

## Composition by build type

**Marketing/landing page** — hero → logo marquee (if client proof belongs) → content sections in 3-col card grids → stats → statement line → CTA → footer, composed per what the page needs. For dedicated DGTL pitch/offer pages, hand off to the dgtl-pitch-pages skill (it carries verified brand facts and a proven blueprint).

**Dashboard/analytics** — app shell; KPI row (3–4 metric cards) up top; charts in panels below; table last. THE headline number of the screen may be gold; everything else white. Sample data must look plausible and self-consistent.

**SaaS/product UI** — app shell + the product's own screens from app components. Primary workflow action = the gold button; the rest ghost/secondary. Density: app scale (14px body, 10px-padding buttons) rather than marketing scale.

**Internal tool/admin** — same as SaaS but even quieter: gold may appear only in the sidebar-active state and the primary action. Function over flourish; skip marquees and statement lines entirely.

**Client-facing portal/demo** — DGTL chrome (shell, tokens) with the client's content. Their logo may sit in the top bar processed to white; DGTL mark can sit in footer ("Built by DGTL"). Never fabricate the client's data.

**Docs/content site** — glassy nav, content column ~720px for prose, code blocks per kbd/code recipe, right-rail TOC with gold active link.

**Prototype/single component** — still start from the tokens CSS; a lone component ships with enough context (a dark stage) to be judged on-brand.

## Restyling an existing UI ("DGTL-ify this")

1. Read the existing code first; map its current theme variables/classes before touching anything.
2. **Change skin, not skeleton**: keep the DOM/layout and functionality; replace colors, fonts, radii, shadows with tokens. Resist "improving" structure unless asked.
3. Centralize: introduce the token variables at `:root` (or the framework's theme file — Tailwind config theme colors, MUI palette, CSS modules vars) and repoint existing styles to them, rather than scattering hex values.
4. Load Manrope and set it as the base family; kill competing display fonts.
5. Sweep for light-mode leftovers: white backgrounds, black-on-white text, default-blue links/buttons/focus rings, stock shadcn/bootstrap greys. Replace links with `#F0CF50` or white+underline; focus rings → gold ring recipe.
6. Re-map the old palette semantically: old primary → gold (sparingly — if old primary was everywhere, most instances become white/ghost); old greys → the black-ladder surfaces; old success/warn/error → the functional set.
7. Verify interactive states (hover/focus/active/disabled) got themed, not just resting states.

## Light-mode exception
Only if the user explicitly requires it: invert to `#ffffff`/`#f7f6f2` paper, near-black `#111` text, keep gold `#F0CF50` for primary actions (black text on gold still), borders `#e5e2d9`, and keep the weight-contrast typography. Confirm before building — dark is the identity.

## Common failure modes (each observed in practice)
- Gold flood: gold headings + gold icons + gold borders everywhere → knockoff. Ration it.
- Grey drift: `#333`/`#444` panels instead of near-black ladder → generic dark theme, not DGTL.
- Wrong yellow: `#FFD700`/`#FFC107` is not `#F0CF50`.
- Default font fallback silently rendering (typo'd Manrope link) — check the render.
- Radius soup: sharp corners or 24px+ blobs. 7px controls / 16px panels / 9999px pills, that's it.
- Recolored or hotlinked client logos; logos on light chips.
- Regenerating `<img>` tags when swapping assets (drops classes, corrupts markup) — swap the URL **inside** the existing tag.
- Batch edits with stale regex offsets — recompute after every mutation or rebuild the string in one pass.
- Blue default focus rings surviving a restyle.

## Verification checklist (look at real screenshots)
Run `node scripts/verify-screenshots.mjs <file.html> ...` (Playwright, chromium at `/opt/pw-browsers/chromium`) → desktop 1512px + mobile 390px PNGs. Then check:
- [ ] Gold sampled at `#F0CF50`, appearing in ≤ a handful of intentional places per view
- [ ] Manrope actually rendering (compare a weight-800 headline against system font)
- [ ] Buttons 7px radius / cards & modals 16px / pills round; borders `#2a2a2a`
- [ ] Surface ladder correct (no mid-grey panels); glassy bars blurring content behind
- [ ] Text hierarchy: white → `#D0D0D0` → `#8a8a8a` all present, nothing pure-grey-on-grey unreadable
- [ ] Mobile: nav/sidebar collapses, tables scroll or stack, tap targets ≥40px
- [ ] Motion present but subtle; page usable with `prefers-reduced-motion`
- [ ] All base64 payloads decode (PNG magic bytes), tags balanced, zero placeholder/lorem text

Structural check snippet:
```python
import re, base64
h = open(f).read()
bad = sum(1 for m in re.finditer(r'data:image/png;base64,([A-Za-z0-9+/=]+)', h)
          if not base64.b64decode(m.group(1)).startswith(b'\x89PNG'))
assert bad == 0
```

## Delivery
Single-file builds: present the HTML. Deployable pages: also offer a Netlify zip — folder with `index.html` + `_headers` containing `/*\n  X-Content-Type-Options: nosniff`, zipped so index.html is at the zip root; deploys via drag onto app.netlify.com/drop.
