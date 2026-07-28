---
name: dgtl-pitch-teasers
description: Build a short, media-forward DGTL "teaser" landing page — the concise front-of-funnel page that opens a pitch, communicates the ONE core idea fast, showcases the most relevant portfolio work, and hands off to the full dgtl-pitch-pages page via a "See the Full Pitch" button. Same black + gold (#F0CF50) Manrope DGTL identity as dgtlgroup.io, distilled to a ~30–60 second skim, with built-in design variance so no two teasers look copy-pasted, a bundled two-page deploy, and pluggable interest tracking. Use whenever the user wants the SHORT version of a pitch — a teaser, concept, preview, intro, "top of funnel", or one-idea page, or a landing page that links into a longer pitch. Especially use it right AFTER dgtl-pitch-pages ("now make the short/teaser version", "condense this pitch", "make the front page that links to the full one", "make a quick concept page for [offer/prospect]"). Reuses the full pitch's research and the DGTL brand kit.
---

# DGTL Pitch Teasers

Build the **front of the funnel**: a short, striking, media-led page whose only job is to make a busy decision-maker *want the full pitch*. It carries the same DGTL identity as the detailed page but says one thing, shows the best work, and pushes forward — "See the Full Pitch →" — into the full `dgtl-pitch-pages` page, which sits one click away as `index.html` in the same pitch folder.

Think of the pair as a funnel. The teaser is a hook you can send cold or share in a DM; the full page is where a warmed-up prospect goes deep. Because the two are bundled together, a visit to the full page's path *is* the click-through signal — so the teaser doubles as a cheap interest gauge: who opened it, who went deeper, whether it got forwarded around the org.

## Where this sits relative to the other DGTL skills

- **dgtl-pitch-pages (v1)** builds the long, 14-section pitch. Run it first. Its research (chosen case studies, the offer's real promise, brand facts) is exactly what this skill condenses — don't redo it.
- **dgtl-brand-kit** is the identity source of truth (tokens, components, voice). This skill is fully consistent with it and bundles the same tokens.
- **This skill** builds the short opener and wires it to the full page. It never replaces v1; it feeds it.

The test for "done": someone who knows dgtlgroup.io sees a *native DGTL page*; someone busy gets the idea in one skim and clicks through; and the page doesn't look like a shrunk clone of the last teaser you made.

## Bundled resources — read in this order

1. `references/teaser-blueprint.md` — the concise page anatomy (what to keep, what to cut), the media-forward portfolio treatments, the funnel CTA + analytics wiring, and the two-page bundle/deploy layout.
2. `references/variance-system.md` — the menu of hero archetypes, portfolio layouts, accent motifs, and textures. Pick one coherent combination per page so teasers stay distinct while unmistakably DGTL.
3. `references/design-system.md` — the exact DGTL tokens and components (copied from v1 so this skill stands alone). Colors, type, nav, footer, cards, buttons. Never deviate from these.
4. `references/brand-facts.md` — the only DGTL facts allowed on a page. Never invent clients, numbers, or results.
5. `assets/logos/` — pre-processed white brand marks; embed as base64 data URLs via `scripts/logo-data-urls.py`. Never hotlink client logos (previews block external requests).
6. `references/repo-output.md` — **where the finished teaser has to land**: the one-folder-per-pitch model, the `pitch.json` manifest, `pendingAssets`, the relative-link rule, and the check that gates completion. Read this before you build.
7. `scripts/bundle-funnel.py` — optional bundler for hosts that serve sub-paths from one upload.
8. `scripts/verify-screenshots.mjs` — Playwright desktop + mobile capture for the eyeball check.

## Workflow

### 1. Start from the full pitch — don't re-research

This skill runs on the back of `dgtl-pitch-pages`. The heavy lifting (which case studies matter, the real promise, the audience's pain) is already done. Pull from that context and settle three things:

- **The one idea.** If the prospect remembers a single sentence, what is it? This becomes the hero. Everything that isn't this idea or proof of it belongs on the full page, not here.
- **The 3–6 portfolio pieces** most relevant to this offer — the sourced work you'll *show*, not just name. On a teaser, the work is the argument, so choose pieces a viewer will recognize as "this is exactly the thing I want."
- **The one proof moment** — a single stat, ghost metric, or verified quote that earns the click. One. The wall of proof lives on the full page.

If you're building a teaser without a full page yet, you can still proceed — just build the full page with `dgtl-pitch-pages` too (or leave the "Full Pitch" link pointed at a placeholder and tell the user to swap it).

### 2. Pick a variance combination

Open `references/variance-system.md` and choose **one hero archetype + one portfolio layout + one accent motif + one texture treatment** that suit *this* offer. This is the step that keeps a batch of teasers from looking copy-pasted. Variance lives in layout, rhythm, and accent — never in the tokens: colors, type, logo, gold-as-accent stay fixed so every page still reads as DGTL. Seed the choice from the offer (e.g. a media-heavy hospitality offer wants a full-bleed showcase hero; a software offer wants a split editorial hero) rather than at random, and keep the combination coherent — one confident idea per page, not four loud ones.

### 3. Build the concise page

Follow `references/teaser-blueprint.md`. One self-contained HTML file: inline CSS + vanilla JS, Google Fonts (Manrope) as the only external request, logos embedded as data URLs. Keep it to a ~30–60 second skim — roughly the essential sections only (hero, a one-line concept beat, the portfolio showcase, one proof moment, the forward CTA, a slim footer). Ruthless copy: if a sentence isn't the hook or proof of it, cut it. Lead with the media — the portfolio showcase is the centerpiece here, not a footnote.

### 4. Wire the funnel + interest tracking

The primary action is **"See the Full Pitch →"**, linking to the full pitch as **`index.html`** — a
plain relative link, because the teaser and the full pitch live in the **same folder**
(`pitches/<slug>/teaser.html` and `pitches/<slug>/index.html`). See `references/repo-output.md`.

> **Do not** write `/full/`, `/index.html`, or an absolute `https://pitch.dgtlmedia.io/<slug>` URL
> here. Root-absolute links only resolve when served from a domain root, so they break locally *and*
> under the `/<slug>/` deploy scheme — this is exactly how the DMTV × Bose teaser's "See the Full
> Pitch" button silently broke. `tools/check-links.py` reports them as `root_absolute`.

Keep DGTL's **"Book a Call →"** as the secondary action. Add the pluggable analytics slot and the `track()` helper from the blueprint, and fire `view_full_pitch` / `book_a_call` events on those clicks. Pageviews on the full pitch are the click-through metric; giving each prospect its own tracked link turns forwarding into visible repeat traffic.

### 5. Verify before delivering

Run `scripts/verify-screenshots.mjs` for desktop 1512px + mobile 390px, then actually look: gold used sparingly (accent, not theme), Manrope rendering, buttons 7px radius / cards 16px with `#2a2a2a` borders, the portfolio media reading as premium, the page skimmable in one or two scrolls, mobile usable, the "Full Pitch" button obvious. Validate structure: balanced tags and every base64 payload decoding to a real PNG. A page that fails the eyeball test isn't done.

### 6. Land it in the repo, then deliver

Write the teaser to **`pitches/<slug>/teaser.html`** — the same folder as the full pitch's
`index.html`, not a folder or slug of its own. Then:

- Update the pitch's `pitch.json`: set `"teaser": "teaser.html"` and bump `updated`. If the full
  pitch doesn't exist in the repo yet, create the folder and manifest now and note the hub as
  pending — a teaser with nothing to click through to is a dead end.
- List any not-yet-supplied photos in `pendingAssets` rather than leaving broken `src`s.
- Run `python3 tools/check-links.py` — it must report **`missing=0`** and **`root_absolute=0`**.

Full contract in `references/repo-output.md`.

Then deliver: flatten the teaser to a **single self-contained HTML** (inline CSS/JS/images) for
upload to **deploy.dgtlmedia.io**. Present the teaser HTML and the screenshots, and say which slug
the pair deploys under — visitors land on `…/<slug>/teaser.html` and click through to
`…/<slug>/index.html`, so the interest signal is a pageview on the hub within the same slug.

## Non-negotiables

- **It stays a teaser.** No FAQ, no five-step process, no stats wall, no long problem section — those are the full page's job. If you're adding a sixth heavy section, you've drifted. Concise is the product.
- **The work is the hero.** Show the sourced portfolio pieces prominently and beautifully; don't bury them under copy.
- **Forward the funnel.** Primary CTA is "See the Full Pitch →" to the full pitch as the relative `index.html`; "Book a Call →" (https://dgtlgroup.io/book-a-call) is secondary. Both tracked.
- **Unmistakably DGTL, never a clone.** Same tokens and identity as `design-system.md`; visible variance via `variance-system.md`. Gold `#F0CF50` is an accent, backgrounds stay black/near-black, Manrope everywhere.
- **Real facts only**, from `brand-facts.md` or the live dgtlgroup.io site (a tailored teaser may add the prospect's own public facts, clearly sourced). Never invent clients, numbers, or results.
- Fully responsive, `prefers-reduced-motion` fallbacks, IntersectionObserver reveals, no browser-storage APIs, client logos only from `assets/logos/` embedded as data URLs.
