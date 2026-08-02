# BLOCK PLAN — dgtl-pay-for-brands

Emitted by `dgtl-pitch-composer` → `references/selection-engine.md`, Step 4.
Audience: marketing lead or finance controller at a brand; agency ops manager.
The one thing it must land: escrow they fund from their own wallet, delivery verified against agreed
terms, reconciliation they can hand to finance — and DGTL holding `$0` in transit.

## Content signals (Step 1)

| Signal | Value | Source |
|---|---|---|
| `hero_number` | **yes** — `$0` held in transit | architectural fact, safe to state |
| `premium_tone` | no | operational register, not luxury |
| `pain_count` | 4 | settlement time · cost by distance · no shared truth · manual close |
| `dominant_pain_stat` | **no** | DGTL Pay has no measured numbers |
| `deliverable_count` | 4 | the finance controls |
| `deliverables_need_prose` | **yes** | a controller needs a sentence per control, not a pill |
| `has_two_tracks` | no | one audience, one path |
| `is_one_machine` | **yes** | the 5-stage settlement flow is one coherent system |
| `is_differentiation_pitch` | no | the substance is the machine, not a comparison |
| `steps_need_explanation` | yes | pilot stages need copy |
| `case_count` | **0** | DGTL Pay has settled nothing |
| `verifiable_numbers` | **1** | only the architectural `$0` |
| `strong_quotes` | **0** | no testimonial exists about DGTL Pay |
| `page_length_target` | standard | CFO-facing, denser |

## Resolved plan (Steps 2–3)

| # | Block | Reason |
|---|---|---|
| 1 | `nav` | required, no variants |
| 2 | `hero.split` | `hero_number` present → split, with the `$0` as the right-hand ghost metric |
| 3 | `marquee.scroll` | hero is not `statement` and page is not short → default scroll |
| 4 | `problem.cards` | `pain_count` 4 with no `dominant_pain_stat` → cards; 3 cards + the gold "opportunity" callout carrying the fourth pain |
| 5 | `offer.list-detailed` | `deliverables_need_prose` → list, not cards |
| 6 | `centerpiece.flow-diagram` | `is_one_machine` — 5 gold-node stages, terms → funded → verified → released → reconciled |
| 7 | `process.numbered-stack` | rhythm rule 1: centerpiece is a horizontal rail, so process must not be a second one |
| 8 | `proof.cards-row` | **architectural proof, not case studies** — `case_count` is 0, so the three cards are the guarantees the system makes structurally (`$0` held · 2-of-3 release · one record source) |
| — | ~~`stats`~~ | **omitted** — `verifiable_numbers` (1) < 3. A thin stats band reads as filler, and every other number would have to be invented |
| 10 | `statement.typewriter` | page is standard length and `strong_quotes` is 0, so no quote to elevate → slogan |
| — | ~~`testimonials`~~ | **omitted** — `strong_quotes` = 0 for DGTL Pay. The two verified DGTL Group quotes are about content production and would imply an endorsement of a product that has not shipped |
| 12 | `faq.accordion` | standard-length page with 5 objections → accordion |
| 13 | `cta.banner` | the ask is "bring one live campaign" — a call, not a form. High-consideration, low form appetite |
| 14 | `footer` | required, no variants |

## Rhythm notes (Step 3)

- `centerpiece.flow-diagram` (horizontal rail) → `process.numbered-stack` (vertical) — motion axes alternate, no two rails back to back.
- `offer.list-detailed` (dense) → `centerpiece.flow-diagram` (open) → `process.numbered-stack` (dense) → `proof.cards-row` (grid) → `statement.typewriter` (calm) — density alternates.
- One gold CTA per region: `hero.split` and `cta.banner` only; body blocks use secondary or none.
- One scripted animation on the page: the statement typewriter. No count-up, because there is no stats band and the only number is `$0`.
- Minimum viable spine present: nav · hero · marquee · offer · proof · cta-final · footer.

## Fabrication controls

No settled volume, creator count, brand count, corridor count, payout time, fee saving or retention
figure appears anywhere on this page — there are none. The `$0` is architectural, not a result. The
logo marquee is labelled *"DGTL Group client work"* in the strip itself and again in the footer legal
block. The proof section states in plain text that DGTL Pay has not settled a campaign and that
operating results will be published when Phase 1 has produced them.
