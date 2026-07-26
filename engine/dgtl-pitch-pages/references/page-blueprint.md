# Page Blueprint — anatomy, agent orchestration, verification, export

## Section anatomy (the proven order)

1. **Fixed nav** — per design-system spec, identical on every page. Links go to the live dgtlgroup.io pages.
2. **Hero** — pill kicker (gold dot + uppercase offer name), H1 that **rotates through 3-5 headline variants** (each with its own `.gold` accent span), cross-fading every **5-7s scaled by reading length** - see *Hero headline rotation* in `design-system.md`; line 0 is the canonical headline, shown with JS off / reduced motion, 2–3 line muted sub, dual CTA (gold "Book a Call →" + outline secondary that smooth-scrolls to proof/system section, no arrow on secondary), scroll-mouse indicator, faint rotated spark watermark (opacity ~0.05) over radial vignettes.
3. **Client logo marquee** — label "Trusted by industry leaders and innovators worldwide", 18-logo set duplicated ×2, CSS `translateX(-50%)` loop 36–42s, grayscale/brightness filter, edge fade masks, pause on hover.
4. **Problem / opportunity framing** — 3 cards naming the audience's pains, optionally a gold-bordered "The Opportunity" callout grounded in a real outcome.
5. **Offer cards** — 3–4 cards: gold icon chip, what-you-get, gold tag pills of concrete deliverables/stack.
6. **Centerpiece (optional but encouraged)** — one custom section that makes THIS page memorable. Precedents: DTC page's two parallel track cards ("Impulse Engine" vs "Conviction Pipeline") with numbered gold-node CSS flow diagrams and a floating VS badge; web page's dual-transformation case pairing. Design it from the offer's natural structure.
7. **Process timeline** — 5 steps, gold nodes, horizontal desktop / vertical mobile rail (e.g., Audit → Map → Sprint → Launch → Scale).
8. **Proof / work cards** — 2–5 case-study cards matched to the offer: abstract dark-gold gradient media panel with a big ghost metric, kicker `CATEGORY · YEAR`, white title, muted description, tag pills. Client logo overlay (class `media-logo`, ~22px) only where a mark exists in the library.
9. **Stats band** — 3–4 large gold numbers (JS count-up on scroll) with small muted labels. Use only verified numbers.
10. **Big statement** — dim grey (#5a5a56) 56–64px line, final word(s) gold with typewriter + blinking cursor, triggered on scroll-into-view.
11. **Testimonials** — the two verified quotes; brand logo (~26px, class `t-logo`/`testi-logo`), quote, divider, initials avatar + name + role.
12. **FAQ** — 5 questions specific to the offer (fit, process, timeline, ownership/rights, differentiation). Plausible generic answers, no invented prices. One-open accordion.
13. **Final CTA + contact form** — pitch + gold button; form (name/email/company or website/message) with client-side validation and a success state that re-routes to book-a-call. Labels 12px, inputs #0a0a0a with #2a2a2a borders.
14. **Footer** — exact 4-column site footer from the design system.

Page title: `<Offer Name> — DGTL Group`. Include a meta description written for the offer.

## Agent prompt template (one agent per page)

```
You are building a high-converting offer landing page for DGTL Group (dgtlgroup.io).
THE OFFER: <offer name + one-line framing>.
AUDIENCE: <who lands here and what they need to believe>.

STEP 1 — Read <skill path>/references/design-system.md, brand-facts.md, and page-blueprint.md.
Follow the tokens and component specs EXACTLY. Use only verified facts.

STEP 2 — Research (dgtlgroup.io URLs only): WebFetch <the case-study pages relevant to this offer>.

STEP 3 — Build a COMPLETE single-file HTML page at <output path>:
- Inline CSS + vanilla JS; only external request = Google Fonts (Manrope).
- Embed logos as data URLs: run `python3 <skill path>/scripts/logo-data-urls.py --marquee` for the
  marquee block and `--single <name>` for testimonial/overlay marks.
- Section order per page-blueprint.md; centerpiece idea: <one sentence, or "your call">.
- Conversion copy in DGTL voice; write **3-5 rotating hero H1 variants** (one strong line 0 + 2-4 alternates, each with a gold accent word, similar length); NO lorem ipsum.
- Every primary CTA: "Book a Call →" → https://dgtlgroup.io/book-a-call.
- Responsive + IntersectionObserver reveals + prefers-reduced-motion fallbacks.
- Validate before finishing: balanced tags, all base64 payloads decode, no placeholder text.

Do NOT use SendUserFile. Final message: page outline, headline copy chosen, research used, file path.
```

Launch agents for multiple pages in a single message so they run in parallel. The parent session (you) owns verification and delivery.

## Editing existing pages — hard-won rules

- To change an asset, replace the **URL inside the existing `<img>` tag** (string-substitute the src value). Do not regenerate or re-insert whole tags with regex across the file — a past attempt dropped classes and spliced neighboring tags.
- When batch-editing with a script, recompute match offsets after every mutation (or rebuild the string in one pass); stale offsets from a pre-mutation `finditer` corrupted three pages once.
- After ANY scripted edit, rerun the validation snippet below.

## Verification (required before delivery)

```bash
node <skill path>/scripts/verify-screenshots.mjs <page.html> ...   # desktop+mobile PNGs into shots/
```
Look at the screenshots. Check: marquee logos white and ~30px; testimonial logos ~26px; buttons gold #F0CF50 radius 7px; nav 73px glassy; footer 4 columns; mobile hamburger works.

Structural validation (python):
```python
import re, base64
from html.parser import HTMLParser
h = open(f).read()
bad = sum(1 for m in re.finditer(r'data:image/png;base64,([A-Za-z0-9+/=]+)', h)
          if not base64.b64decode(m.group(1)).startswith(b'\x89PNG'))
# plus a tag-balance HTMLParser pass (voids: img, br, hr, input, meta, link, svg children)
assert bad == 0
```

## DGTL deploy (deploy.dgtlmedia.io) — and what stays relative

DGTL no longer uses Netlify. Flatten the page to a **single self-contained HTML** (inline CSS/JS/images — no sibling files), then upload it to **deploy.dgtlmedia.io**; the portal indexes it and serves it at **https://pitch.dgtlmedia.io/<slug>/**. The editable source stays in the repo at `pitches/<slug>/` — the flattened file is a deploy artifact, not the source. See `references/repo-output.md`.

**Connectivity is the point — but not every link is absolute.** A pitch and its teaser are one slug
with two entry points (`index.html` + `teaser.html` in the same folder), so they link to each other
with **plain relative hrefs**. Only a link to a *different* pitch or a creator feature is absolute
(`https://pitch.dgtlmedia.io/<other-slug>/`).

Never write a root-absolute path (`/full/`, `/media/x.jpg`). Those resolve only at a domain root, so
they break locally and under the `/<slug>/` deploy scheme — this is how the DMTV x Bose teaser's
"See the Full Pitch" button silently broke. `tools/check-links.py` reports them as `root_absolute`;
that count must be 0.

Pages should still point at *each other*: this pitch -> its teaser and any creator features shown;
those -> back to this pitch. Set `canonical`/`og:url` to the page's real published URL once it
exists, and leave `canonicalUrl` empty in `pitch.json` until then. `pitches/pitches.index.json` is
the slug registry — don't keep a second one.

## Persistence

- SendUserFile the HTML (render) and the zip (attach).
- Desktop artifact id `dgtl-pitch-<slug>`; if create fails with "already exists", update_artifact instead.
- Save the HTML into the attached project (`landing-pages/<file>.html`) and note it in the project README so any future session can find and edit it.

## Translation mode — mapping foreign source pages onto the blueprint

When rebuilding from a handoff MD + preview HTML in another style, map source sections to blueprint sections rather than mirroring the source layout:

| Source has...                        | Becomes...                                    |
|--------------------------------------|-----------------------------------------------|
| Hero / headline block                | §2 Hero (rewrite headline in DGTL voice, gold accent word) |
| Feature/benefit lists                | §5 Offer cards with gold tag pills            |
| Pricing tables / package tiers       | Centerpiece §6 as parallel track cards (like the DTC page) — keep prices ONLY if the user confirms |
| "How it works" / steps               | §7 Process timeline (compress/expand to 5)    |
| Client's own case studies/metrics    | §8 Proof cards (kicker = CATEGORY · YEAR), clearly the client's claims |
| Their testimonials                   | §11 Testimonial cards (their quotes replace or join DGTL's two) |
| Long feature prose                   | §4 Problem framing + FAQ answers              |
| Their logo/assets                    | Ask for files or pull from their live site; process to white marks like assets/logos (trim → resize ≤300x96 → white-fill single-color marks, grayscale-lift multi-tone) |

Always rebuild from the blueprint skeleton — never edit the foreign HTML in place. Update the agent prompt template's STEP 2 to "Read the handoff at <path> and the preview at <path>; extract content per translation mode" when in this mode.
