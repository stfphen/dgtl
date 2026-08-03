# BLOCK PLAN — dgtl-pay-for-creators

Emitted by `dgtl-pitch-composer` → `references/selection-engine.md`, Step 4.
Audience: a working creator, not a crypto person.
The one thing it must land: the fee is visible before the shoot, it is released when delivery is
checked, their country stops setting their fee — and there is nothing to buy.

## Content signals (Step 1)

| Signal | Value | Source |
|---|---|---|
| `hero_number` | **no** | there is no number here that isn't a fabricated result — "45 days" is an unsourced industry claim, so it stays off the page |
| `premium_tone` | no | plain-language register |
| `pain_count` | 1 dominant | the wait — everything else is downstream of it |
| `dominant_pain_stat` | no stat, **but a before/after contrast** | the variant explicitly allows a contrast in place of a stat |
| `deliverable_count` | 4 | see the fee · released on delivery · country stops setting it · nothing to buy |
| `deliverables_need_prose` | no | cards read warmer and shorter than a dense list |
| `has_two_tracks` | no | one audience |
| `is_one_machine` | no | the pitch is not a system description |
| `is_differentiation_pitch` | **yes** | the whole argument is "this vs how it usually goes" |
| `steps_need_explanation` | **no** | four steps and the creator already does three; wallet honesty moves to the FAQ |
| `case_count` | **0** | DGTL Pay has paid nobody |
| `verifiable_numbers` | **1** | only the architectural `$0` |
| `strong_quotes` | **0** | no creator has used it |
| `page_length_target` | **short** | brief calls for warmer and shorter |

## Resolved plan (Steps 2–3)

| # | Block | Reason |
|---|---|---|
| 1 | `nav` | required, no variants |
| 2 | `hero.centered` | no `hero_number`, no `premium_tone` → the default centered hero |
| 3 | `marquee.static-grid` | `page_length_target` = short → static grid, calmer and tighter than the scroll loop |
| 4 | `problem.split-stat` | one dominant pain rendered as a numbered **before/after contrast** — the variant's non-numeric form, which needs no invented figure |
| 5 | `offer.cards-4up` | `deliverable_count` 4 and prose not required → 4 cards |
| 6 | `centerpiece.comparison` | `is_differentiation_pitch` — "getting paid the usual way" vs "on the rail", gold checks against muted crosses |
| 7 | `process.timeline-horizontal` | steps are self-evident, and a horizontal rail is a new motion axis after a two-column centerpiece |
| 8 | `proof.spotlight` | one architectural guarantee carries it — the `$0`. One proof moment, not a wall |
| — | ~~`stats`~~ | **omitted** — `verifiable_numbers` (1) < 3 |
| — | ~~`statement`~~ | **omitted** — page is short |
| — | ~~`testimonials`~~ | **omitted** — `strong_quotes` = 0 for DGTL Pay |
| 12 | `faq.two-column` | short page — hiding answers behind an accordion adds friction for a reader who is already unsure about the crypto part |
| 13 | `cta.form` | creators want to be told when their corridor opens; three fields, and the success state routes to Book a Call |
| 14 | `footer` | required, no variants |

## Rhythm notes (Step 3)

- `problem.split-stat` (two-column) and `centerpiece.comparison` (two-column) are separated by `offer.cards-4up` (grid) — no adjacent same-axis motion.
- `centerpiece.comparison` (dense, two-column) → `process.timeline-horizontal` (open, horizontal) → `proof.spotlight` (calm, full-width) — density and axis both alternate.
- One gold CTA per region: `hero.centered` and the `cta.form` submit.
- No count-up and no typewriter on this page; the only motion is the reveal observer and the scroll hint.
- Minimum viable spine present: nav · hero · marquee · offer · proof · cta-final · footer.

## How this differs from `dgtl-pay-for-brands`

Every resolved variant differs — the engine produced two genuinely different compositions from two
different content profiles, not one template run twice.

| Slot | brands | creators |
|---|---|---|
| hero | `split` | `centered` |
| marquee | `scroll` | `static-grid` |
| problem | `cards` | `split-stat` |
| offer | `list-detailed` | `cards-4up` |
| centerpiece | `flow-diagram` | `comparison` |
| process | `numbered-stack` | `timeline-horizontal` |
| proof | `cards-row` | `spotlight` |
| statement | `typewriter` | omitted (short page) |
| faq | `accordion` | `two-column` |
| cta-final | `banner` | `form` |

## Fabrication controls

No payout time, creator count, corridor count or fee-saving figure appears on this page — there are
none. The FAQ answers "how fast does it actually land?" by saying plainly that no number exists yet
and explaining what structurally removes the delay instead. The logo grid is labelled *"Brands DGTL
Group has made work for"* and the footer repeats that those are agency clients, not DGTL Pay users.
The spotlight states the honest cost of non-custody: the creator is responsible for their own account
recovery.
