# Block Library — the DGTL section catalog (2–3 variants each)

Instead of one fixed 14-section template, a Composer page is **assembled from blocks**. Every block below is a section type; each has 2–3 **variants** that render the same content in a visually distinct layout. All variants share the same tokens, nav, footer, buttons, and spacing rhythm from `design-system.md` and the brand-kit component recipes — only the *composition* changes, so any combination still reads as one native DGTL page.

**How to read this file:** pick ONE variant per block you include (per `selection-engine.md`). Some blocks are **required** (always present), some **conditional** (included only when the content justifies them). Variant ids are stable — the engine and the build agent refer to them by id (e.g. `hero.split`, `proof.masonry`).

Two hard rules inherited from the parent skill, unchanged:
- Swap asset **URLs inside existing `<img>` tags**; never regenerate tags.
- Never hotlink client logos or case photos — use the bundled logo library + abstract dark-gold gradient media panels.

---

## Required blocks (every page has exactly one variant of each)

### `nav` — fixed navigation
No variants. Always the design-system nav verbatim (73px, glassy, DGTL logo left, links right, mobile hamburger). Identical on every page — consistency here is what lets the body vary.

### `hero` — above the fold
- **`hero.centered`** — the classic: centered pill kicker, clamp H1 (last word gold), 2–3 line muted sub, dual CTA, scroll indicator, spark watermark + vignettes. The safe default; best when the promise is a single punchy line.
- **`hero.split`** — two-column: copy left (kicker, H1, sub, dual CTA), a right-hand visual panel (abstract dark-gold gradient with a floating ghost metric, or a stacked mini-proof card). Best when there's a headline *number* worth showing immediately (e.g. "3.2× ROAS"). Collapses to stacked on mobile.
- **`hero.statement`** — oversized editorial: no pill, a very large 2-line H1 with gold accent word, minimal sub, single primary CTA. Best for premium/brand-led offers where restraint signals quality.

### `marquee` — client logo proof strip
- **`marquee.scroll`** — the infinite `translateX(-50%)` loop of 18 white logos, edge-fade masks, pause on hover. Default.
- **`marquee.static-grid`** — a centered 5–6-per-row static grid of ~10 logos, no animation, tighter and calmer. Best right under `hero.statement` or when a page already has a lot of motion. Respects `prefers-reduced-motion` for free.

### `cta-final` — closing conversion block
- **`cta.form`** — pitch line + gold button + contact form (name/email/company/message), client-side validation, success state that routes to book-a-call. Default for lead capture.
- **`cta.banner`** — full-width centered pitch + single large "Book a Call →", no form, faint spark watermark. Best when the whole page funnels to a call and a form would add friction.

### `footer` — site footer
No variants. Exact 4-column design-system footer.

---

## Conditional blocks (include only when content justifies — see selection-engine.md)

### `problem` — problem / opportunity framing
- **`problem.cards`** — 3 cards naming the audience's pains, optional gold-bordered "The Opportunity" callout. Default.
- **`problem.split-stat`** — pain narrative on one side, a single stark stat or "before/after" contrast on the other. Best when there's one dominant pain with a quantifiable cost.

### `offer` — what you get
- **`offer.cards-3up`** — 3 cards, gold icon chip, what-you-get, gold tag pills. Default.
- **`offer.cards-4up`** — 4 cards, same recipe, 2×2 on tablet. Use when there are genuinely 4 distinct deliverables.
- **`offer.list-detailed`** — vertical list of 3–5 rows, each = icon chip + title + one-line + tag pills, more room per item. Best when each deliverable needs a sentence of explanation, not just pills.

### `centerpiece` — the one memorable custom section
- **`centerpiece.dual-track`** — two parallel track cards with numbered gold-node CSS flow diagrams and a floating VS badge (the DTC "Impulse Engine vs Conviction Pipeline" pattern). Use when the offer has TWO contrasting paths/audiences/tiers.
- **`centerpiece.flow-diagram`** — a single left-to-right (desktop) / vertical (mobile) pipeline of 4–6 gold-node stages showing how the system works end to end. Use when the offer is one coherent process/machine.
- **`centerpiece.comparison`** — "them vs us" or "old way vs DGTL way" two-column table with gold checks and muted X's. Use when the pitch is fundamentally a differentiation argument.
- Omit the centerpiece entirely for thin/simple offers rather than forcing a weak one.

### `process` — how the engagement runs
- **`process.timeline-horizontal`** — 5 gold-node steps on a horizontal rail (desktop) / vertical (mobile). Default.
- **`process.numbered-stack`** — big gold numerals (01–05) in a vertical stack, more copy room per step. Best when steps need explanation, or when the page already has a horizontal flow diagram in the centerpiece (avoid two horizontal rails back to back).

### `proof` — case-study / work cards
- **`proof.cards-row`** — 2–3 work cards in a row: dark-gold gradient media panel, ghost metric, `CATEGORY · YEAR` kicker, title, description, tag pills, optional `media-logo`. Default.
- **`proof.masonry`** — 4–5 cards in a staggered masonry grid, mixed heights. Best when there are several strong, varied case studies.
- **`proof.spotlight`** — ONE case study given a full-width feature treatment (large gradient panel + narrative + 2–3 inline metrics). Best when a single flagship result carries the pitch.

### `stats` — numbers band
- **`stats.band`** — 3–4 large gold numbers with JS count-up on scroll, muted labels. Default. Verified numbers only.
- **`stats.inline`** — a slim 3-up row embedded directly under the hero or proof (smaller numerals), when a dedicated band would over-repeat.
- Omit if there are fewer than 3 verifiable numbers — a thin stats band reads as filler.

### `statement` — big typographic line
- **`statement.typewriter`** — 56–64px dim-grey line, final word(s) gold with typewriter + blinking cursor on scroll-in. Default.
- **`statement.quote`** — the same slot used for an oversized pull-quote from a testimonial instead of a slogan. Use when a verified quote is punchier than any slogan.

### `testimonials` — social proof quotes
- **`testi.cards`** — the two verified quote cards (brand logo ~26px, quote, divider, avatar + name + role). Default.
- **`testi.single-large`** — one quote blown up to feature scale with big brand logo. Best when only one quote is strong or when paired with `statement.quote` elsewhere (don't duplicate).

### `faq` — objection handling
- **`faq.accordion`** — one-open accordion, 5 offer-specific questions, gold +/× indicator. Default.
- **`faq.two-column`** — 4–6 Q/A laid out in two static columns (no accordion). Best on shorter pages where hiding answers adds friction.

---

## Rhythm & anti-monotony rules (enforced at composition time)

These keep a *varied* page from feeling random:

1. **Never place two blocks with the same primary layout motion back-to-back** (e.g. no `centerpiece.flow-diagram` immediately followed by `process.timeline-horizontal` — both are horizontal rails). Alternate motion axes.
2. **Alternate surface density.** Follow a dense/detailed block (offer.list-detailed, proof.masonry) with a calm one (statement, marquee.static-grid, stats.inline).
3. **Exactly one primary gold CTA per viewport region.** Hero and cta-final own the gold buttons; body blocks use secondary/ghost or none.
4. **One count-up per page.** If `stats.band` uses count-up, don't also animate numbers in the hero or proof.
5. **Order is not free.** Use the canonical spine as the backbone and only reorder within reason: nav → hero → marquee → [problem] → [offer] → [centerpiece] → [process] → [proof] → [stats] → [statement] → [testimonials] → [faq] → cta-final → footer. Conditional blocks may be dropped, and a block may move at most one slot to satisfy the rhythm rules above.
6. **Minimum viable page:** nav, hero, marquee, offer, proof, cta-final, footer. Everything else earns its place via `selection-engine.md`.
