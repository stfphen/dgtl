# Selection Engine — content signals → block choices

This is the deterministic logic that makes each page a **different composition** while staying on-brand. Run it *after* you've gathered the offer's content (research + brand facts), *before* you build. It reads signals from the content and outputs a **block plan**: an ordered list of `block.variant` ids. Same content → same plan (predictable); different content → different plan (variety emerges from the offer, not from a fixed template).

## Step 1 — Extract content signals

From the framed offer, the researched case studies, and `brand-facts.md`, score these signals (yes/no or a count):

| Signal | How to read it |
|---|---|
| `hero_number` | Is there ONE headline metric worth showing above the fold? (e.g. "3.2× ROAS", "40M views") |
| `premium_tone` | Is the offer luxury / brand-led / restraint-signals-quality? |
| `pain_count` | How many distinct audience pains does the framing name? |
| `dominant_pain_stat` | Is there a single quantifiable cost-of-inaction stat? |
| `deliverable_count` | How many distinct things are sold? |
| `deliverables_need_prose` | Does each deliverable need a sentence, not just pills? |
| `has_two_tracks` | Two contrasting paths / tiers / audiences? |
| `is_one_machine` | One coherent end-to-end process/system? |
| `is_differentiation_pitch` | Is the core argument "we're different from the alternative"? |
| `steps_need_explanation` | Do process steps need copy, or are they self-evident? |
| `case_count` | How many *relevant* verified case studies exist? |
| `flagship_case` | Is one case clearly the strongest? |
| `verifiable_numbers` | How many verified stats are available? |
| `strong_quotes` | How many strong verified testimonials? |
| `page_length_target` | short / standard / long |

## Step 2 — Resolve each block

Apply the rules top-to-bottom. Where several variants qualify equally, prefer the **default** listed in `block-library.md` (the engine is content-driven, not random — repeatability is a feature).

**hero**
- `hero_number` → `hero.split`
- else `premium_tone` → `hero.statement`
- else → `hero.centered`

**marquee**
- chosen hero is `hero.statement`, OR the page is short → `marquee.static-grid`
- else → `marquee.scroll`

**problem** *(conditional)*
- `pain_count == 0` and offer is self-evidently desirable → **omit**
- `dominant_pain_stat` and `pain_count <= 1` → `problem.split-stat`
- else → `problem.cards`

**offer** *(required content, variant chosen)*
- `deliverables_need_prose` → `offer.list-detailed`
- else `deliverable_count >= 4` → `offer.cards-4up`
- else → `offer.cards-3up`

**centerpiece** *(conditional — at most one)*
- `has_two_tracks` → `centerpiece.dual-track`
- else `is_differentiation_pitch` → `centerpiece.comparison`
- else `is_one_machine` → `centerpiece.flow-diagram`
- else → **omit** (don't force a weak centerpiece)

**process** *(conditional)*
- page is short AND centerpiece already shows the how → **omit**
- `steps_need_explanation`, OR centerpiece variant is a horizontal flow → `process.numbered-stack`
- else → `process.timeline-horizontal`

**proof** *(required)*
- `flagship_case` and `case_count <= 2` → `proof.spotlight`
- `case_count >= 4` → `proof.masonry`
- else → `proof.cards-row`

**stats** *(conditional)*
- `verifiable_numbers < 3` → **omit**
- proof variant is `proof.spotlight` (already shows inline metrics) → `stats.inline`
- else → `stats.band`

**statement** *(conditional)*
- `strong_quotes >= 1` and no dedicated testimonial block will run (short page) → `statement.quote`
- page is short → **omit**
- else → `statement.typewriter`

**testimonials** *(conditional)*
- `strong_quotes == 0` → **omit**
- `strong_quotes == 1` (or statement already used a quote) → `testi.single-large`
- else → `testi.cards`

**faq** *(conditional)*
- page is short → `faq.two-column` (or omit if fewer than 4 questions)
- else → `faq.accordion`

**cta-final**
- offer is call-only / high-ticket / low form appetite → `cta.banner`
- else → `cta.form`

## Step 3 — Apply the rhythm pass

Run the block plan through the anti-monotony rules in `block-library.md` (§Rhythm). Concretely:
1. Scan for adjacent same-axis motion; if found, swap one variant to its alternate or move it one slot.
2. Ensure only one count-up animation and one gold CTA per region.
3. Confirm the minimum viable spine is present (nav, hero, marquee, offer, proof, cta-final, footer).
4. Verify dense/calm alternation across the body.

## Step 4 — Emit the block plan

Output a short manifest the build agent will follow, e.g.:

```
BLOCK PLAN — <offer slug>
1. nav
2. hero.split            (hero_number: 3.2× ROAS)
3. marquee.scroll
4. problem.split-stat    (dominant pain: wasted ad spend)
5. offer.cards-3up
6. centerpiece.dual-track (low-ticket vs high-ticket)
7. process.numbered-stack (avoids 2nd horizontal rail)
8. proof.cards-row       (3 relevant cases)
9. stats.band
10. statement.typewriter
11. testi.cards
12. faq.accordion
13. cta.form
14. footer
RHYTHM NOTES: process switched to numbered-stack because centerpiece is a horizontal flow.
```

The manifest is the contract: it records *why* each variant was chosen, so a human can sanity-check the composition before the build, and so two different offers visibly produce two different pages.
