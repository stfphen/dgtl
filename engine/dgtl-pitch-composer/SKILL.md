---
name: dgtl-pitch-composer
description: Build DGTL Group pitch/offer landing pages that are ASSEMBLED from a block library instead of a single fixed template — so no two pages look the same, yet every page carries the exact dgtlgroup.io black + gold (#F0CF50) Manrope brand kit. A content-driven selection engine reads the offer's substance and picks the section blocks and layout variants (hero, proof, centerpiece, process, offer, stats, testimonial, FAQ, CTA) that fit THIS offer, then composes them with anti-monotony rhythm rules. Use whenever the user wants a DGTL landing page / pitch page / offer page / sales page / one-pager and wants VARIETY across pages — "make it not look like the same template", "vary the layout", "compose from blocks", "different structure each time" — while staying on-brand. For the fixed canonical 14-section layout use dgtl-pitch-pages instead; use THIS skill when layout variety per page is the point.
---

# DGTL Pitch Composer

Same brand, different architecture every time. Where `dgtl-pitch-pages` renders one proven 14-section template, this skill **composes** a page from a **block library** — each section type has 2–3 layout variants — and a **content-driven selection engine** chooses which blocks and variants fit the specific offer. The result: pages that look genuinely different from one another but are unmistakably DGTL (same tokens, nav, footer, buttons, spacing, logo marquee, voice).

The design system is identical to the parent skill and to `dgtl-brand-kit`. Only the *composition* varies — never the visual identity.

## Bundled resources — read in this order

1. `references/design-system.md` — exact tokens, nav/footer spec extracted from dgtlgroup.io. Verbatim. This is what keeps every variant native to the brand.
2. `references/brand-facts.md` — the only DGTL facts allowed on a page. Never invent clients, numbers, or results.
3. `references/block-library.md` — the section catalog: every block type and its 2–3 variants, plus the rhythm/anti-monotony rules.
4. `references/selection-engine.md` — the deterministic content-signals → block-plan logic. This is the heart of the skill.
5. `references/build-verify-deploy.md` — agent prompt template, editing rules, verification snippet, DGTL deploy + persistence. (Its "Section anatomy" list is the parent skill's fixed order — here it is **superseded** by the block plan; use it only for the agent-template/verify/deploy procedures.)
6. `references/repo-output.md` — **where the finished page has to land**: the `pitches/<slug>/` folder model, the `pitch.json` manifest, `pendingAssets`, the relative-link rule, cloning the `_templates/` offer pages for a named prospect, and the link check that gates completion. Read this before you build — the slug and the template-vs-compose decision come from it.
7. `assets/logos/` — pre-processed white brand marks (18 clients + DGTL + gold spark). Embed as base64 data URLs via `scripts/logo-data-urls.py`; never hotlink.

## Workflow

### 1. Frame the offer
Establish the offer (what's sold), the audience (who lands here), and whether it's **general** or **tailored** to a named prospect. If genuinely unclear and the user is present, ask once (AskUserQuestion). Translation mode (a handoff doc + a preview page in another style) works exactly as in the parent skill: mine the source for *content*, discard 100% of its design, rebuild on the DGTL system.

### 2. Ground in brand truth
Read `design-system.md` and `brand-facts.md`. For a new offer type or a tailored page, research first — WebFetch `https://dgtlgroup.io/services` and the 2–3 most relevant `https://dgtlgroup.io/work/<case>` pages (dgtlgroup.io URLs only). Do a drift check on the live site before building if a redesign is suspected.

### 3. Run the selection engine → produce a BLOCK PLAN
This is the step that makes this skill different. Read `block-library.md` and `selection-engine.md`, then:
- Extract the content signals (§Step 1 of the engine) from the framed offer + research.
- Resolve each block to a variant (§Step 2). Conditional blocks are omitted when their signal is absent — a thin offer yields a shorter page, a rich offer a longer one.
- Run the rhythm pass (§Step 3): no two same-motion blocks adjacent, one gold CTA per region, one count-up per page, minimum viable spine present, dense/calm alternation.
- Emit the **BLOCK PLAN manifest** (§Step 4) — an ordered list of `block.variant` ids WITH the reason each was chosen. Show this manifest to the user (or state it) before building; it's the contract and the proof that this page is composed, not templated.

### 4. Build from the block plan
Single self-contained HTML: inline CSS + vanilla JS, Google Fonts (Manrope) the only external request, logos as data URLs. Build the sections **in the manifest's order using the specified variants** — pull each variant's recipe from `block-library.md` and its exact values from `design-system.md`. For multiple pages, launch one agent per page in parallel using the agent prompt template in `build-verify-deploy.md`, but replace its fixed "Section order per page-blueprint.md" line with **"Build exactly the sections in this BLOCK PLAN, in order, using the named variants: <paste manifest>"**. Same hard-won rules apply: swap asset URLs inside existing tags; never hotlink client logos or case photos.

### 5. Verify before delivering
Run `scripts/verify-screenshots.mjs` for desktop 1512px + mobile 390px, then look: brand identity intact across whichever variants were chosen (gold #F0CF50 buttons 7px radius, nav 73px glassy, marquee/grid logos white, footer 4-column, mobile hamburger). Run the structural validation snippet in `build-verify-deploy.md` (balanced tags, every base64 payload decodes to a real PNG). Also confirm the page **matches its manifest** — the chosen variants actually rendered. A page that fails validation or drifts from its plan is not done.

### 6. Land it in the repo, then deliver

**A pitch that only exists as a delivered file is not shipped.** Write the page to
`pitches/<slug>/index.html`, write `pitch.json` beside it, register the slug in
`pitches/pitches.index.json`, and run `python3 tools/check-links.py` — `missing=0`,
`root_absolute=0`. Full contract in `references/repo-output.md`.

Save the **BLOCK PLAN manifest** into the pitch folder too (`pitches/<slug>/block-plan.md`) and
reference it from `pitch.json`'s `notes`. This is what lets a future session see how the page was
composed and extend it consistently instead of re-running the engine and getting a different shape.

Links inside the pitch folder stay **relative** (`teaser.html`, `media/…`); only a link to a
*different* pitch is absolute. Then flatten to a single self-contained HTML for upload to
**deploy.dgtlmedia.io**. Full deploy details in `build-verify-deploy.md`.

## Non-negotiables
- Every primary CTA is **"Book a Call →"** → `https://dgtlgroup.io/book-a-call`.
- Voice: confident, results-first, concrete numbers over adjectives, zero lorem ipsum. "Receipts, Not Promises."
- DGTL facts only from `brand-facts.md` or the live site; a tailored page may add the prospect's clearly-sourced public facts.
- Variety comes from *composition*, never from altering colors, fonts, spacing, or components. Every variant uses the same tokens.
- Fully responsive, `prefers-reduced-motion` fallbacks, IntersectionObserver reveals, no browser-storage APIs.
- The minimum viable spine is always present: nav, hero, marquee, offer, proof, cta-final, footer.
