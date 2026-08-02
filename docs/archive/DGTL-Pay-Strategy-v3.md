> **SUPERSEDED — archived v3.** This document is the supply-programme reframe. It is replaced in full by
> [`docs/DGTL-Pay-Strategy-v4.md`](../DGTL-Pay-Strategy-v4.md), which is canonical.
> Kept for reference only — do not act on anything below without checking it against v4.

---

# DGTL Pay + $DGTL — Strategy v3

**Supersedes:** DGTL-Pay-Strategy-v2.md (which superseded DGTL-Token-Strategy.md)
**Status:** working document · July 2026
**One line:** *DGTL Pay is not a payments company. It is how DGTL wins creators.*

---

## 0 · The reframe, and why it is the whole document

V2 fixed the sequencing: rail first, token as a gated Phase 3. That still holds. What v2 got wrong was **what the rail is for.**

V2 measured success in settled volume and implied — without ever stating it — that the rail would earn a take. The arithmetic doesn't support that, and once you do the arithmetic the entire project changes shape for the better.

**The arithmetic.** At a `2%` take, `$1M` of settled volume returns `$20,000`. An independent creator agency's own annual creator-payout volume is plausibly `$1–5M`. So the rail's own revenue, if DGTL charged a take rate at all, is `$20–100K/yr` — against a build, an audit, counsel reviews, ramp-partner minimums and dispute handling that are not in that range. And DGTL cannot raise the take rate, because a fee that a creator notices destroys the only thing the rail is actually good for.

**The conclusion is not "don't build it."** It's that the return arrives somewhere other than a revenue line:

> Creators are the scarce input to a creator agency. Payment speed is a **creator-acquisition and retention variable**. DGTL Pay's return shows up in brief reply rate, roster exclusivity, repeat bookings, and campaign margin — not in a take rate.

Priced as a fintech, this is a bad business. Priced as a retention program, it is one of the cheapest competitive moats available to a creator agency, because the thing it buys — being the place that pays properly — cannot be copied by a competitor in a quarter.

| V2 said | V3 says |
|---|---|
| Non-custodial architecture is the founding constraint | **Unchanged.** Still correct, still non-negotiable. |
| Database test governs token utility | **Unchanged.** Still the most credible thing in the concept. |
| No sale, earned-only distribution, fixed supply | **Unchanged.** |
| Comms rule + creator disclosure | **Unchanged, and now enforced in the election form.** |
| Phase 1 gate: `$250K` settled, `10` brands, `100` creators, `4` corridors | **Replaced.** Gates are now supply metrics. Volume becomes a secondary indicator. |
| Chain decision deferred to Phase 2 | **Unchanged.** Still right. |
| DGTL Pay as a product with its own P&L | **Deleted.** It is an internal operating layer. It has a budget, not a revenue target. |
| Corridors as the growth lever | **Deleted as a Phase 1 goal.** One corridor, done properly, beats four done thinly — and compliance cost scales with corridors, so four corridors is four times the run-rate for no additional supply effect. |

---

## 1 · What the project is now

**DGTL Pay** — an internal settlement layer that pays DGTL's own creators faster and more visibly than any competing agency can. Non-custodial: brand wallet → escrow → creator wallet, with DGTL as invoice originator, delivery verifier and 2-of-3 arbiter, never as custodian.

**$DGTL** — unchanged from v2. A proposed Phase 3 utility token, not minted, not sold, earned only, with five surviving utilities that a database genuinely cannot do.

**The claim being tested:** that a creator who has been paid in minutes, against escrow they could see before they started, will answer a DGTL brief ahead of an equal-fee brief from anyone else.

That claim is falsifiable, cheap to test, and currently untested. Everything in Phase 0 exists to test it.

---

## 2 · The number that governs the project

Not settled volume. **Cost per retained creator.**

```
        annual run-rate of DGTL Pay
CPRC = ───────────────────────────────────────────
       creators retained who would otherwise churn
```

If DGTL Pay costs `$60K/yr` all-in and holds `40` creators who would otherwise drift to another agency, that's `$1,500` per retained creator. Compare that to what it currently costs DGTL to source, vet, brief and onboard one new creator of equivalent quality. If CPRC comes in under sourcing cost, the program pays for itself and the debate is over. If it comes in at three times sourcing cost, the program is a hobby.

**Neither number is currently known.** Both are cheap to find out. That is Phase 0.

---

## 3 · Revised phases and gates

### Phase 0 · Evidence (Aug – Nov 2026) — new, and the most important phase
No build. The entire purpose is to find out whether the claim in §1 is true before anything is engineered.

| Workstream | What | Cost |
|---|---|---|
| Creator interviews | Ask `10` of DGTL's own creators: last payment wait, whether it changed who they answer, what they'd trade for speed | `$0` |
| Sourcing-cost baseline | Compute what it currently costs DGTL to source and onboard one creator | `$0` |
| Retention baseline | Trailing `12`-month creator repeat-booking rate — the number Phase 1 has to move | `$0` |
| One live payout | A single real USDC payout to a real creator, end to end, every friction written down | <`$200` |
| Vendor evaluation | Name, price and reject (or adopt) `3` off-the-shelf creator-payout vendors, on the record | `$0` |
| Counsel scoping | Non-custodial architecture and the 2-of-3 arbiter role, Tier-1 markets only | `$2–5K` |

**Gate to Phase 1 — all four must hold:**

| Condition | Threshold |
|---|---|
| Creators naming payment speed as a factor in which agency they answer | `≥6 of 10` |
| Counsel confirms the arbiter role does not constitute custody in Tier-1 markets | yes |
| No off-the-shelf vendor delivers escrow-visible-before-delivery at acceptable cost | confirmed on the record |
| A credible build estimate exists and is ≤ `18` months of current creator sourcing spend | yes |

If any fails, **stop.** The rail is not built and nothing is lost but six weeks of asking questions.

### Phase 1 · One Corridor (2027)
Build the non-custodial escrow, delivery verification, reconciliation export and wallet onboarding — for **one corridor only**, chosen as the corridor where DGTL already pays the most creators. Ship it into DGTL's own campaigns. Nobody external touches it.

**Gate to Phase 2 — supply metrics, not volume:**

| Condition | Threshold |
|---|---|
| Creator brief reply rate vs. Phase 0 baseline | `+15%` |
| Repeat-booking rate vs. Phase 0 baseline | `+10%` |
| Creators who would decline an equal-fee brief elsewhere to stay on DGTL Pay | `≥20` |
| Cost per retained creator vs. sourcing cost | below it |
| Disputes escalated outside the 2-of-3 process | `0` |

*Settled volume is recorded but is not a gate.* It is a lagging indicator of the thing that matters.

### Phase 2 · Second Corridor + Token Definition (2027–28)
Only after Phase 1's supply effect is proven. Add the second corridor. In parallel: token rights memo, audit, testnet, closed-beta redemption. Chain decision made here.

### Phase 3 · Utility Activation
Unchanged from v2. Mainnet, earned distribution only, redemption and creator-fund governance live. Gate: `≥200` closed-beta redemptions, `≥3` partner orgs holding balances, zero outstanding high/critical audit findings.

### Phase 4 · Open Network — conditional, not planned
Public liquidity and external agencies on the rail. **This phase is not on the roadmap.** It activates only if the tripwire in §6 fires.

---

## 4 · Budget, stated honestly

No figure below is a quote. They are the order-of-magnitude estimates the project needs in order to be evaluated at all, and the first Phase 0 task is to replace them with real ones.

| Line | Phase 0 | Phase 1 (one corridor) |
|---|---|---|
| Engineering | `$0` | contract escrow + verification + reconciliation UI |
| Contract audit | `$0` | one full audit, one re-audit after fixes |
| Counsel | `$2–5K` scoping | Tier-1 jurisdiction opinion + token rights memo |
| Ramp partner | `$0` | integration + any monthly minimum |
| Ongoing run-rate | `$0` | counsel retainer, monitoring, dispute handling, re-audits |

**The line that decides the project is the ongoing run-rate, not the build.** A build is a one-off an agency can absorb. A monthly compliance and partner run-rate is a permanent claim on cash flow, and it does not shrink if the project underperforms. Estimate it before the build, not after.

---

## 5 · Who does the work

Per the DGTL consolidation plan, DGTL is concurrently scaffolding two repos, a dashboard, a terminal, a CRM with email and Twilio automation, and a media-generation layer built on five existing skills. Adding a settlement product to that list without naming an owner means the owner is whoever is left, at 11pm.

**Phase 0 has no engineering, deliberately.** It is six weeks of interviews, arithmetic and one counsel call — work a founder can do alongside everything else. Phase 1 requires a named engineering owner who is not also building the CRM. If that person does not exist and cannot be hired or contracted, Phase 1 does not start, regardless of what the Phase 0 gate says.

---

## 6 · Tripwires

**The revenue frame reopens if:** an external agency asks to run its own creator payouts on the rail. At that point the Expansionist's industry-rail case is live evidence rather than speculation, the reference class changes, and this document is too small. Revisit immediately — do not wait for a phase boundary.

**The project pauses if:** the ongoing run-rate estimate exceeds `$5K/month` before a single external creator is onboarded, or Tier-1 counsel returns a custody determination on the arbiter role.

**The token dies (rail survives) if:** fewer than `3` partner orgs want portable balances after `12` months of Phase 1 operation.

---

## 7 · What did not change, and shouldn't

Five things from v2 survive intact and should be treated as settled:

1. **Non-custodial architecture.** The moment DGTL holds funds in transit, the compliance perimeter swallows the project.
2. **The database test.** Only utilities that a database genuinely cannot perform get a token. Five survived; that list is not to be extended for marketing reasons.
3. **No sale, no presale, earned-only distribution, fixed supply, locked mint authority.**
4. **The communications rule** and its named reviewer, binding on founders, staff and token-compensated creators.
5. **The elective compensation menu** — cash price first and unchanged, optional election, bonus for illiquidity only, vesting, written disclosure requirement.

---

## 8 · Monday

| # | Action | By | Cost |
|---|---|---|---|
| 1 | Ask `10` DGTL creators the three Phase 0 questions | `Aug 7 2026` | `$0` |
| 2 | Compute current cost to source and onboard one creator | `Aug 14 2026` | `$0` |
| 3 | Pull the trailing `12`-month repeat-booking rate — this is the baseline Phase 1 must move | `Aug 14 2026` | `$0` |
| 4 | Stand up the Safe multisig; run one live USDC payout end to end | `Aug 21 2026` | <`$200` |
| 5 | Price and formally reject or adopt `3` off-the-shelf payout vendors, in writing | `Aug 28 2026` | `$0` |
| 6 | Counsel scoping call — arbiter role and custody, Tier-1 only | `Sep 4 2026` | `$2–5K` |
| 7 | Name the Phase 1 engineering owner, or record that there isn't one | `Sep 11 2026` | `$0` |

Items 1–3 cost nothing and settle the question the entire project rests on. Nothing should be built until they are done.

---

## 9 · Minority report, preserved

🔻 **The Contrarian, still standing:**

> The compliance run-rate does not care what you call the project. A supply program still needs counsel, ramp partners, audits and dispute handling, and those bills arrive monthly whether the retention number moves or not. Reframing the return does not reframe the cost.

This is the strongest surviving objection and it is why §4's run-rate line, not the build estimate, is the number that decides.
