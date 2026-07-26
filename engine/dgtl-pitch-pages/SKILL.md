---
name: dgtl-pitch-pages
description: Build production-ready DGTL Group pitch/offer landing pages that visually match dgtlgroup.io 1:1 — black + gold (#F0CF50) Manrope design system, real client-logo marquee, conversion copy grounded in verified DGTL case studies, multi-agent build orchestration, screenshot verification, and single-file deploy to the DGTL portal (deploy.dgtlmedia.io → pitch.dgtlmedia.io). Use this skill whenever the user asks for a landing page, pitch page, offer page, sales page, service one-pager, or client-tailored proposal page for DGTL / dgtlgroup.io — for ANY service offering (web design, custom software, influencer campaigns, brand activations, DTC ecommerce scaling, content, paid media, or a new offer), whether "general" or tailored to a specific prospect. Also use it when the user says things like "make another one of those pitch landing pages", "make a page for [offer/client]", or references the DTC scaling / influencer activation / web-software pages.
---

# DGTL Pitch Landing Pages

Build single-file HTML offer pages that are pixel-consistent with dgtlgroup.io and persuasive enough to close. This skill encodes a workflow that was executed and human-approved: extract the live design system once, ground every claim in verified brand facts, orchestrate research → copy → build with agents, verify renders with screenshots, and ship a single self-contained HTML for the DGTL deploy portal.

The three canonical pages built with this exact system: **dgtl-web-software.html** (Websites & Custom Software), **dgtl-influencer-activations.html** (Influencer Campaigns & Brand Activations), **dgtl-dtc-scaling.html** (Scaling DTC Ecommerce — low + high ticket funnels). Match their quality bar.

## Bundled resources — read in this order

1. `references/design-system.md` — the exact tokens, components, nav/footer spec extracted live from dgtlgroup.io. Follow it verbatim; this is what makes pages look native to the brand.
2. `references/brand-facts.md` — verified positioning, services, case studies, stats, clients, testimonials, voice. **The only facts allowed on a page.** Never invent clients, numbers, or results.
3. `references/page-blueprint.md` — section-by-section page anatomy, the agent prompt template, verification and export procedures.
4. `references/repo-output.md` — **where the finished page has to land**: the `pitches/<slug>/` folder model, the `pitch.json` manifest, `pendingAssets`, the relative-link rule, cloning the `_templates/` offer pages for a named prospect, and the link check that gates completion. Read this before you build, not after — the slug and the template-vs-scratch decision come from it.
5. `assets/logos/` — pre-processed white brand marks (18 client logos + DGTL logo + gold spark), sized for the marquee. Embed as base64 data URLs; never hotlink client logos (previews block external requests).

## Workflow

### 1. Frame the offer

Establish before building: the offer (what's being sold), the audience (who lands on this page), and whether it's a **general** offer page or **tailored** to a named prospect. If the user is present and any of these are genuinely unclear, ask once (AskUserQuestion) — audience changes the problem-framing section entirely. If unattended, make the reasonable interpretation, state it, and proceed.

Settle the **slug** here too, because everything else hangs off it. One pitch = one folder,
`pitches/<slug>/`, with `index.html` as the hub, `teaser.html` beside it if there's a short version,
`media/` for its own assets, and a `pitch.json` manifest. Check `pitches/pitches.index.json` first so
you don't collide with an existing slug or silently rebuild a pitch that already exists.

### 1b. Translation mode — when given a handoff doc and/or a preview page

The user may hand over source material: a handoff/brief markdown, a preview HTML in some other style, a deck, or notes. Treat these as **content, never as design**:

- The handoff doc is the source of truth for the offer's substance — what's being sold, to whom, the pitch angles, the client's own facts and numbers. Mine it for the hero promise, offer cards, FAQ themes, and centerpiece structure.
- A preview HTML/design in another style is a **structure and copy reference only**. Read it for what sections exist and what they say; discard 100% of its CSS, fonts, colors, imagery, and layout system. Do not port, adapt, or "harmonize" its styles — the output is always a fresh build on the DGTL design system in `references/design-system.md`. If its section flow conflicts with the blueprint, keep the blueprint's rhythm and slot the source's content into it.
- Facts from the handoff about the *client/prospect/offer* are usable as page content (they're the client's claims). Facts about *DGTL* still come only from `references/brand-facts.md` — a handoff written by someone else doesn't get to invent DGTL case studies or stats.
- Where the source material is thin (no proof, no process), fill the gaps from the blueprint's defaults and DGTL's verified proof, and flag to the user what was assumed.

The test for done: someone who saw the preview HTML recognizes the *story*; someone who knows dgtlgroup.io sees a *native DGTL page*.

### 1c. Tailored to a named prospect — clone the offer template, don't rebuild

`pitches/_templates/` holds the generic **"Your Brand × DGTL"** offer pages — website overhaul,
brand redesign kit, influencer activation. If the tailored page you've been asked for *is* one of
those offers, start from the template rather than from scratch: the fixed content in it (DGTL contact
details, proof stats, client logos, case studies) is already correct, and a from-scratch rebuild is
exactly what loses it.

- **Copy it to a new `pitches/<slug>/index.html` first.** A `_templates/` page is never sent to a
  client and is never personalised in place.
- **Personalise by `data-slot`.** Each template carries a `DATA-SLOT MANIFEST` comment in its
  `<head>` listing every replaceable element and what it wants. Replace the contents of those
  elements only — one slot can appear in several places (e.g. `brand-name`), so replace every
  instance of it.
- **Leave everything without a slot alone.** If a fact isn't slotted, it's DGTL's, and it's verified.

Templates are not pitches: they stay listed under `templates` in `pitches.index.json`, never under
`pitches`.

### 2. Ground in brand truth

Read `references/design-system.md` and `references/brand-facts.md`. For a new offer type not covered by the recorded facts, or for a tailored page, research first: WebFetch `https://dgtlgroup.io/services` and the relevant `https://dgtlgroup.io/work/<case>` pages for authentic language and proof points (only fetch dgtlgroup.io URLs). Select the 2–3 case studies most relevant to *this* offer — proof that doesn't match the offer reads as filler.

Drift check: if there's reason to think the site was redesigned (different hero, colors, or fonts than the design system describes), re-extract tokens from the live site before building rather than shipping a stale look.

### 3. Plan the page

Draft the outline per `references/page-blueprint.md`: hero promise, the problem/opportunity framing for this audience, 3–4 offer cards, a 5-step process, proof section mapped to chosen case studies, stats band, statement line, FAQ themes, final CTA. A distinctive centerpiece section is encouraged when the offer has natural structure (e.g., the DTC page's side-by-side low-ticket vs high-ticket funnel tracks with CSS flow diagrams) — one memorable custom section per page beats ten generic ones.

### 4. Build

For **multiple pages**, launch one general-purpose agent per page in parallel, each with the full agent prompt template from `references/page-blueprint.md` (it embeds the design-system path, the offer brief, and the guardrails). For a **single page**, build it inline following the same template. Either way the deliverable is one self-contained HTML file: inline CSS + vanilla JS, Google Fonts (Manrope) as the only external request, logos embedded as data URLs via `scripts/logo-data-urls.py`.

Two rules exist because they were learned the hard way: swap asset **URLs inside existing tags** rather than regenerating `<img>` tags (regenerating drops classes and corrupts markup), and never hotlink client logos or case-study photos (use the bundled logo library and abstract dark-gold gradient media panels).

Build it at its final home, `pitches/<slug>/index.html`, with any non-inlined assets in that pitch's
own `pitches/<slug>/media/`. Pitch pages are **self-contained by design** — inlined styles, often
inlined images — because they are sent as one-off artifacts and must survive being served from
anywhere. Do **not** refactor a pitch onto `journal/_shared/`; that shared stylesheet belongs to the
Influence Journal, not here.

If the page ships before some of its imagery arrives, don't leave the `<img>` pointing at nothing —
reference the intended path under `media/` and **declare it in `pendingAssets`** (step 6). A declared
gap reports as `pending`; an undeclared one reports as `missing` and turns the check red.

### 5. Verify before delivering

Run `scripts/verify-screenshots.mjs` (Playwright, chromium at `/opt/pw-browsers/chromium`) for desktop 1512px + mobile 390px captures, then actually look at them: marquee running with white logos, testimonial logos ~26px (not giant), gold buttons 7px radius, footer matching the site. Validate structure programmatically — balanced tags and every base64 payload decoding to a real PNG (`references/page-blueprint.md` has the validation snippet). A page that fails validation is not done.

Then run the repo-wide link check from the repo root — this is the gate that actually blocks
completion, and it is the only thing that catches a root-absolute link or an undeclared missing
image:

```bash
python3 tools/check-links.py     # must report missing=0 and root_absolute=0
```

`pending` is fine (those are declared). `missing` or `root_absolute` above zero means the page is
not done, regardless of how it looks in the screenshots.

### 6. Land it in the repo, then deliver

**A pitch that only exists as a delivered file is not shipped.** Write it into the repo first — see
*Repo output* below for the full contract. In short: `pitches/<slug>/index.html`, a `pitch.json`
beside it, the slug registered in `pitches/pitches.index.json`, and `python3 tools/check-links.py`
reporting `missing=0`.

Then deliver: send the HTML, and tell the user the slug it deploys under. Flatten to a **single
self-contained HTML** (inline all CSS/JS/images) for upload to **deploy.dgtlmedia.io**, which indexes
it and serves it at that slug. See *DGTL deploy* in `references/page-blueprint.md`.

Links inside the pitch folder (to its teaser, its own media) stay **relative** — see *Linking* below.
Only links to a *different* pitch or an external page are absolute.

## Repo output (summary — full contract in `references/repo-output.md`)

- **One folder per pitch:** `pitches/<slug>/index.html`, `teaser.html` beside it, `media/`, `pitch.json`.
  The teaser is **not** a separate slug.
- **Linking:** relative inside the folder (`teaser.html`, `media/x.jpg`). Never root-absolute
  (`/full/`) — that only resolves at a domain root and has broken a live teaser before. Absolute
  `https://pitch.dgtlmedia.io/<other-slug>/` only when pointing at a *different* pitch.
- **Manifest + register:** write `pitch.json`, add the slug to `pitches/pitches.index.json`.
- **Declare gaps:** missing photos go in `pendingAssets`, never left as broken `src`s.
- **Tailored to a named prospect?** Clone the matching `pitches/_templates/` offer page and replace by
  `data-slot` instead of generating from scratch. Never edit a template in place; never send one.
- **Gate:** `python3 tools/check-links.py` → `missing=0`, `root_absolute=0`.

## Non-negotiables

- Every primary CTA is **"Book a Call →"** linking to `https://dgtlgroup.io/book-a-call`.
- Copy voice: confident, energetic, results-first, concrete numbers over adjectives, zero lorem ipsum. Write like DGTL: "Receipts, Not Promises."
- Facts only from `references/brand-facts.md` or the live site. A tailored page may add the *prospect's* public facts, clearly sourced.
- Fully responsive, `prefers-reduced-motion` fallbacks, IntersectionObserver reveals, no browser-storage APIs.
