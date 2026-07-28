# Teaser Blueprint — the concise page, media-forward, wired to the full pitch

A teaser is not a small pitch — it's a *hook*. It has one job: earn the click into the full page. Every decision below serves that. When in doubt, cut. The full `dgtl-pitch-pages` page is where depth lives; this page trades completeness for speed and desire.

Read `design-system.md` for the exact tokens/components (nav, footer, buttons, cards, colors, type) and `variance-system.md` for the layout choices. This file is about *what goes on the short page and how the funnel is wired*.

## Length target

A busy decision-maker should get the idea in **~30–60 seconds** — roughly **one to two-and-a-half viewport scrolls**. That's about **5 sections**, not 14. If you're reaching for a sixth heavy section, you've drifted back toward the full page.

## Section anatomy (keep only these)

1. **Nav** — the standard DGTL fixed nav from `design-system.md` (logo left; Home · Services · Work · About · Contact to the live site). Keep it; it's part of the identity. On the far right, the nav CTA is **"Full Pitch →"** (not "Book a Call") — the teaser's whole point is forward motion.

2. **Hero — the ONE idea.** Pill kicker (gold dot + uppercase offer name). H1 that **rotates through 3-5 headline variants** (each a complete hook with its own gold accent word), cross-fading every **5-7s scaled by reading length** - see *Hero headline rotation* in `design-system.md`. Line 0 is the strongest single line and is what shows with JS off or under reduced motion. The rotation is the hook working harder; it does **not** license a second idea - every variant sells the same one promise from a different angle. A **single** sub-line (one sentence, ~12–22 words) — not a paragraph. Dual CTA: primary gold **"See the Full Pitch →"** (→ `index.html`, the full pitch beside it in the same folder), secondary outline **"Book a Call"**. Apply the chosen hero archetype from `variance-system.md`. The hero may itself carry portfolio media (archetypes B/C) — encouraged for visual offers.

3. **Concept in brief — one beat.** The idea made concrete in **one** compact row: either three micro-steps (e.g. *You host → We produce → You keep the library*) or three tight value bullets, one line each. A single framing sentence above is allowed. No card should hold more than ~15 words. This is the only "explanation" the teaser gets; the full page explains properly.

4. **Portfolio showcase — the centerpiece.** This is the emotional core of a teaser and the section that most rewards care. Show the **3–6 sourced, relevant works** big and beautiful, using the chosen portfolio layout from `variance-system.md`. Each tile: the media, a small `CATEGORY · YEAR` kicker, a short white title, and a client-logo overlay where a mark exists in the library. A one-line section label above ("Selected work", "Proof in pictures") and nothing more — let the work talk. See **Media treatments** below.

5. **One proof moment.** Pick *one*: a tight stat band (2–3 gold count-up numbers), OR a single verified testimonial card, OR one oversized ghost-metric line ("5 shooting days.", "12M+ views."). Resist adding a second proof block — scarcity of proof here is deliberate; it sends the curious to the full page for the rest.

6. **Closing CTA.** Restate the promise in one line, then the primary **"See the Full Pitch →"** (→ `index.html`) with "Book a Call" secondary. This is the second and final ask; make the forward button the loud one.

7. **Slim footer.** A condensed footer, not the full four-column site footer: DGTL logo, a single row of 4–5 live-site links (Work · Services · About · Contact · Book a Call), socials optional, and `© 2026 DGTL. All Rights Reserved.` Keep it quiet — the CTA above it is the last loud thing.

Page `<title>`: `<Offer Name> — DGTL Group`. Add a meta description written as the offer's one-line promise.

## Media treatments — make the work the hero

The teaser lives or dies on how the portfolio reads. Two honest ways to source it:

- **Real media provided by the user** — if they hand over stills, poster frames, or thumbnails, embed them as base64 data URLs and show them at full quality. This is the best case; a teaser with real frames of the actual work is unbeatable. Video: use a poster frame image, not an embedded player.
- **No real media (default)** — build **premium abstract media panels** in the DGTL house style rather than hotlinking client photos (which is not allowed and breaks in previews). A panel that looks expensive: a near-black base, **layered gold radial gradients** off-axis, a faint large ghost metric or word, a subtle grain/hairline, the client-logo mark (white, ~22px) in a corner, and the `CATEGORY · YEAR` kicker. Vary gradient angle and ghost content per tile so the wall has rhythm. Done well these read as art-directed, not as placeholders.

Whichever source, the *layout* comes from `variance-system.md` (mosaic, filmstrip, spotlight+thumbs, editorial grid, cinematic bands) — that's a big part of why two teasers won't look alike. Give tiles generous size; hover can lift/scale slightly and reveal the caption. Never stretch or hotlink; never recolor a client logo.

## Funnel wiring + interest tracking

The teaser and the full page are **one pitch with two entry points**, living in the same folder `pitches/<slug>/` as `teaser.html` and `index.html`. They link to each other with plain relative hrefs. Only a link to a *different* pitch is absolute (`https://pitch.dgtlmedia.io/<other-slug>/`).

**Links:**
- Every "See the Full Pitch →" → `href="index.html"`. Never `/full/` or a root-absolute path: those only resolve at a domain root and are exactly how the DMTV x Bose teaser button silently broke. `tools/check-links.py` flags them as `root_absolute`.
- "Book a Call" → `https://dgtlgroup.io/book-a-call`.
- Link **back** from the full pitch to the teaser, and from both to any creator features shown, so the funnel is a connected graph.

**Pluggable analytics slot.** Put this near the top of `<head>`. It's tool-agnostic: the user pastes ONE provider tag (Plausible, Fathom, or GA4) — or none, and the page still works.

```html
<!-- ═══ ANALYTICS — paste ONE provider tag below, or leave empty to disable ═══
     Plausible: <script defer data-domain="YOURDOMAIN" src="https://plausible.io/js/script.js"></script>
     Fathom:    <script src="https://cdn.usefathom.com/script.js" data-site="ABCDEFGH" defer></script>
     GA4:       <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
                <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-XXXX')</script>
     ══════════════════════════════════════════════════════════════════════════ -->
<script>
  // Fires a named event into whatever provider is present; no-ops if none.
  window.track = function (name, props) {
    try {
      if (window.plausible)      window.plausible(name, { props: props || {} });
      else if (window.fathom)    window.fathom.trackEvent(name);
      else if (window.gtag)      window.gtag('event', name, props || {});
    } catch (e) {}
  };
</script>
```

Wire the CTAs (don't block navigation):
```html
<a href="index.html" class="btn-primary" onclick="track('view_full_pitch')">See the Full Pitch →</a>
<a href="https://dgtlgroup.io/book-a-call" class="btn-secondary" onclick="track('book_a_call')">Book a Call</a>
```

**What the user learns from this, and why the design supports it:**
- **Did anyone look?** — pageviews on the teaser (`teaser.html`).
- **Did they get interested?** — pageviews on the full pitch (`index.html`, same slug) plus the `view_full_pitch` event fired on the button. Because both pages sit under one slug, the click-through is simply hits on `/<slug>/` versus hits on `/<slug>/teaser.html`.
- **Was it forwarded around the org?** — give each prospect a **unique tracked link**. Repeat visits and multiple referrers on a single-recipient link are the forwarding signal; a spike on the full pitch says it's being passed to decision-makers.

Keep tracking honest and light: named events on the two CTAs, nothing that fingerprints visitors. Privacy-friendly providers (Plausible/Fathom) fit DGTL better than heavyweight tags.

## Deploy (deploy.dgtlmedia.io — one slug, two entry points)

Both pages flatten to **single self-contained HTML** files and deploy under the same slug: the teaser at `pitch.dgtlmedia.io/<slug>/teaser.html`, the full pitch at `pitch.dgtlmedia.io/<slug>/`. The relative `index.html` link resolves in both places — locally and on the host — which is the whole reason it stays relative. `pitches/pitches.index.json` is the slug registry; keep creator features they showcase cross-linked from there.

(`scripts/bundle-funnel.py` remains for hosts that need the pair bundled into one upload.)

## Copy rules (tighter than the full page)

- One promise, stated once, in the hero. Don't re-explain it three ways.
- Concrete over adjective; numbers over hype; zero lorem ipsum; DGTL voice ("Receipts, Not Promises").
- No prices unless the user confirms them. No invented metrics — proof comes from `brand-facts.md` or the prospect's own sourced facts.
- Buttons say what happens: "See the Full Pitch →", "Book a Call". The forward button is always the visually dominant one.
