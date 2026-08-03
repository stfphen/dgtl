# DGTL Pay: Strategy v4 + rebuilt project page + composed pitch funnel

> PR body for `feat/dgtl-pay-v4-and-pitch-funnel` → `main`. Committed here because the `gh` CLI
> is not installed on this machine, so the PR could not be opened programmatically.

---

Hardens the DGTL Pay / $DGTL concept into one canonical strategy document and five market-ready
surfaces. Four commits, one per deliverable.

**Nothing here is deployed.** No page links to a live URL that does not exist.

---

## 1 · Pressure-test kill list

Ran `/pressure-test` (Contrarian, First Principles, Outsider) on the v3 plan before writing v4.
Seated **one guest — the Physician** — because audit finding F-02 (HIGH) and v3 §5 both record the
programme as already fully committed with no named owner, which is that seat's exact trigger. No
second guest.

| # | Failure mode | Severity | Early warning |
|---|---|---|---|
| 1 | **The null hypothesis was never tested.** Paying faster from working capital, or a brand pre-funding an ordinary invoice, may buy the entire supply effect with no build and no compliance perimeter. Phase 0 priced three *payout vendors* and zero *non-technical* alternatives. | `likely × fatal` | Visible **now**, in the Phase 0 task list itself — no line item asks three brands to pre-fund, or costs the float on net-7 terms. |
| 2 | **The Phase 0 gate passes on a leading question.** "Would faster payment matter?" has never been answered no by someone who is owed money. A stated-preference gate returns yes, the build starts on a false positive, and the run-rate is real eighteen months before the thesis is disproven. | `likely × costly` | The interview script, the day it is written — if it asks what creators *want* rather than what they have *done*, the gate is already broken. |
| 3 | **Phase 0 slips under founder load until it is moot.** It does not fail loudly; it slips, and a Phase 0 that slips two quarters is indistinguishable from one that never ran, except it also blocks the decision it exists to unblock. | `possible × costly` | Items 1–3 — the `$0` arithmetic ones — not complete by `Aug 14 2026`. |

**SURVIVES IF** › a brand and a creator both change behaviour for escrow they can see — and neither
will do it for a faster bank transfer.

Findings 1 and 2 changed v4 materially: Phase 0 gains a null-hypothesis workstream (gate condition 3)
and the creator-interview gate is now revealed preference against a specific past brief (condition 2).
Finding 3 is only partially answered and v4 says so.

---

## 2 · Audit findings ledger — 15 closed, 1 deferred, 0 unaddressed

All three Critical findings are closed **in v4 itself**, as required.

| ID | Sev | Disposition |
|---|---|---|
| **A-01** no revenue model | Crit | **Closed** v4 §1 — no take rate; budget, not revenue target |
| **B-01** take-rate arithmetic fails | Crit | **Closed** v4 §1 (arithmetic reproduced); §3 substitutes CPRC |
| **F-01** no measurement baseline | Crit | **Closed** v4 §4 gate 1 · §9 item 1, sequenced first |
| A-02 volume gates measure wrong thing | High | Closed §5 — supply gates; volume recorded, never a gate |
| B-02 no build estimate or run-rate | High | Closed §7 — with a `$5K/month` pause ceiling |
| C-01 arbiter role untested by counsel | High | Closed §4 gate 4 · §8 kill criterion |
| C-02 no jurisdiction matrix | High | Closed §4 — Tier-1 named, all else out of scope |
| D-01 wallet onboarding unowned | High | Closed §2, §4 — tested on 3 creators pre-contract |
| F-02 no named owner | High | Closed §4 — engineering-free Phase 0; gate 4 names an owner or stops |
| A-03 no vendor rejected on record | Med | Closed §4 — **widened** to price non-technical alternatives too |
| B-03 compliance scales with corridors | Med | Closed §5 — one corridor at Phase 1 |
| C-03 disclosure not in signed artefact | Med | Closed §4 — election form drafted in Phase 0 |
| **E-01** no demand evidence for token utilities | Med | **DEFERRED to Phase 1.** Reason: Phase 0's six weeks establish whether the *rail* hypothesis holds, and a token whose rail is unproven is not yet a live question to put to a partner. Demand is tested by the existing 12-month kill criterion in §8 instead. Recorded as a decision, not an omission. |
| D-02 chain deferred to Phase 2 | Low | Sound — deferral retained |
| E-02 earned-only distribution | Low | Sound — held |
| F-03 public surfaces compliant | Low | Sound — **hardened**: the sweep is now `tools/check-compliance.py`, a wired release gate |

Full reasoning per finding in `docs/DGTL-Pay-Audit-Response.md`.

---

## 3 · BLOCK PLAN manifests

Saved alongside each page as `<slug>-BLOCK-PLAN.md`, each with its full signal table.

**Every resolved variant differs between the two pages** — the engine produced two compositions from
two content profiles, not one template run twice.

| Slot | `dgtl-pay-for-brands` | `dgtl-pay-for-creators` |
|---|---|---|
| hero | `hero.split` (`$0` ghost metric) | `hero.centered` (no honest headline number exists) |
| marquee | `marquee.scroll` | `marquee.static-grid` (short page) |
| problem | `problem.cards` (4 pains) | `problem.split-stat` (before/after, no invented figure) |
| offer | `offer.list-detailed` (finance controls need prose) | `offer.cards-4up` (warmer) |
| centerpiece | `centerpiece.flow-diagram` (`is_one_machine`) | `centerpiece.comparison` (`is_differentiation_pitch`) |
| process | `process.numbered-stack` (avoids 2nd horizontal rail) | `process.timeline-horizontal` |
| proof | `proof.cards-row` (architectural) | `proof.spotlight` (one proof moment) |
| stats | **omitted** | **omitted** |
| statement | `statement.typewriter` | **omitted** (short page) |
| testimonials | **omitted** | **omitted** |
| faq | `faq.accordion` | `faq.two-column` |
| cta-final | `cta.banner` (call, not form) | `cta.form` (corridor check) |

**Teaser variance** — no shared choices:

| | brands teaser | creators teaser |
|---|---|---|
| Hero archetype | **D** asymmetric index | **B** split editorial |
| Portfolio layout | **P4** editorial grid | **P2** filmstrip marquee, two rows opposite drift |
| Accent motif | index rule | node / dot |
| Texture | hairline field | grain |

---

## 4 · The fabrication rule drove three omissions

DGTL Pay has settled nothing. Rather than work around that, the selection engine's own thresholds
removed the blocks that would have needed invented numbers:

- **`stats` omitted on both pages** — `verifiable_numbers` = 1 (the architectural `$0`); the engine
  omits below 3. Every other number would have had to be invented.
- **`testimonials` omitted on both** — `strong_quotes` = 0 *for DGTL Pay*. The two verified DGTL Group
  quotes are about content production; on a payments page they would read as an endorsement of a
  product that has not shipped.
- **`proof` substituted architectural guarantees for case studies** — `case_count` = 0. Both pages
  state in plain body copy that DGTL Pay has settled nothing and that operating results get published
  when Phase 1 has them.

The logo marquee is permitted (real DGTL Group clients) and is labelled as agency work **twice** on
every page carrying it — in the strip itself and again in the footer legal block. It does **not**
appear on the project webpage.

**One thing worth flagging:** the retired `for-creators.html` claimed creator fees "land with you in
minutes." That is a DGTL Pay performance claim for a product that has never run, and it violates the
fabrication rule. It is not carried into any new surface. The creators page and teaser now answer
"how fast does it land?" by saying plainly that no number exists yet.

---

## 5 · §7.3 decision — retire three, keep two

**`sites/dgtl-pay/` keeps `index.html` + `join.html` + `confirmed.html`.
`for-brands.html`, `for-creators.html` and `teaser.html` are retired.**

Those three are directly superseded by the composed pitch pages and the two teasers. Keeping both
would be two page-sets saying the same thing to the same reader, which is how the link graph and the
message drift apart. `join.html` / `confirmed.html` are a capture step nothing else provides, so they
stay, and every nav, footer and JS-set link that pointed at a retired page is re-pointed — zero
residual references.

The pitch pages are a **separate outbound funnel**, not part of the product site. Neither surface
links to the other by absolute URL, because neither is deployed yet.

---

## 6 · Deviations from the handoff, with reasons

**a · Teaser wiring is one slug with relative links, not two slugs with absolute
`pitch.dgtlmedia.io` URLs.** Three reasons:
1. `engine/dgtl-pitch-teasers/references/teaser-blueprint.md` and `engine/*/references/repo-output.md`
   both mandate it — *"one pitch with two entry points, not two slugs… the single most common mistake
   when generating from these skills."*
2. `deploy/vps/README-VPS-DEPLOY.md` (2026-07-28) records **`dgtlmedia.io` as not under DGTL's
   control** and every `*.dgtlmedia.io` URL as dead history; `pitches.index.json` gives the live
   scheme as `pitch.dgtlmag.com`. Absolute `dgtlmedia.io` links would have shipped dead buttons.
3. Relative links survive promotion to `dgtlgroup.io/pitch/<slug>/` unchanged.

**b · The 16-finding ledger lives in a companion doc, not inside v4.** The handoff requires v4 to be
materially shorter than v3 *and* to disposition all 16 findings; the ledger costs ~330 words and
serves none of the five questions v4's own simplification test names. The three Critical findings are
closed inside v4 as specifically required; the rest are in `docs/DGTL-Pay-Audit-Response.md`.

**c · The kill list is in this PR only**, per the handoff — not in the strategy document.

**d · The creators teaser keeps the "forty-five" line but grounds it.** It is used as a reference to
**net-45**, a real standard invoice term, and the sub-line says so. It is not presented as a measured
statistic and it is not a DGTL Pay metric.

**e · `sites/dgtl-pay/` is a proposed path.** DGTL Pay is DGTL's own product rather than a client
deliverable, so `sites/` is the closest existing fit — static, no build step, served at its own domain
root, and already covered by `check-links.py`'s `sites` scope (where root-absolute links are correct).
Happy to move it if you'd rather it lived elsewhere.

---

## 7 · Verification — what actually ran

| Check | Result |
|---|---|
| `python3 tools/check-compliance.py` | **8/8 clean** — 0 banned terms, disclaimer verbatim on all 7 pages |
| `python3 tools/check-links.py` | **`checked=915 missing=0 pending=3 root_absolute=19`** |
| root_absolute baseline on `main` | **`19`** — identical, all pre-existing in other pitches, none mine |
| Screenshots, 1512px + 390px | **7/7 PASS**, captures reviewed |
| Base64 payloads | **46/46** decode with valid PNG magic bytes |
| Brand audit (computed styles) | gold sampled `#F0CF50` only · buttons 7px · cards 16px · borders `#2a2a2a` · Manrope · full `#F0F0F0 → #D0D0D0 → #8a8a8a` ladder present on every page |
| Mobile at 390px | no horizontal scroll, nav collapses, all tap targets ≥40px |
| Render vs BLOCK PLAN | confirmed against captures — hero split/centered, flow-diagram vs comparison, numbered-stack vs timeline-horizontal all render as planned |

Playwright's chromium download was **not** needed — an existing Chrome for Testing build
(`chromium-1228`) was already on the machine and the script was pointed at it. Visual verification is
real, not skipped.

### Defects found by verification and fixed

Seven, four of them pre-existing in the inherited pages:

1. **Nav + mobile-menu CTAs painted `#D0D0D0` on gold** — invisible text on three pages.
   `.nav-links a` (0,1,1) outranks `.btn-primary` (0,1,0). No screenshot-free check would have caught
   this; a contrast assertion is now wired into the audit.
2. **`.hero` had `overflow:hidden` but no `position`**, so it never clipped its own
   absolutely-positioned vignettes — document `scrollWidth` hit 730px at a 390px viewport.
   (`body{overflow-x:hidden}` doesn't help: body overflow propagates to the viewport.)
3. Same class of overflow bug on the new project page — 460px at 390px.
4. Footer, social and nav-logo tap targets under 40px on mobile.
5. Teaser nav CTA at 36px — teasers keep it visible at 390px by design, so unlike the other pages it
   is genuinely reachable and had to meet the minimum.
6. Off-token `#3a3a3a` timeline dot.
7. Creators H1 had half the headline in gold; cut to a three-word accent.

The compliance gate also caught **4 banned terms in v4's own first draft** — including `presale`
inside the sentence prohibiting presales, which is exactly the kind of hit a human sweep misses.

### Not verified

- `npm test` / `npm run build` were **not** run. This branch touches no `platform/` code.
- No page has been deployed; no live URL was fetched. `canonicalUrl` is `""` in both `pitch.json`
  files, per repo convention.

---

## 8 · Assumptions

1. **`pitch.dgtlmag.com` is the live scheme**, per `pitches.index.json` and the 2026-07-28 deploy
   README. `CLAUDE.md` still says `pitch.dgtlmedia.io` and is stale — I did not change it, but it
   should be corrected in a separate pass.
2. **Phase names, statuses and timings are verbatim** from the handoff's §3.4 table. Phase 0 is shown
   *in addition*, since v4 makes it the gate on Phase 1 — the four phases' own wording is untouched.
3. **The Phase 1 → 2 gate numbers come from v4, not from `_kit/BRIEF.md`.** BRIEF.md carries the old
   volume gate (`$250K`/10 brands/100 creators/4 corridors), which audit finding A-02 rejects and v4
   replaces with supply metrics. v4 is canonical.
4. **`pitch.json` `type` is `concept`**, not `pitch` — these are speculative offer pages, not a pitch
   to a named prospect.
5. Portfolio pieces on both teasers come only from `engine/*/references/brand-facts.md`.
6. The analytics slot is left empty; the user pastes one provider tag before deploying.
