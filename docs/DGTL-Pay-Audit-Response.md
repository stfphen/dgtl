# DGTL Pay — audit response ledger

Companion to [`DGTL-Pay-Strategy-v4.md`](DGTL-Pay-Strategy-v4.md). Every finding from the
**Concept & Feasibility Audit · DGTL Pay & $DGTL · v1.0 · 30 July 2026** (16 findings, six
categories), with its disposition and where in v4 it is answered.

This lives outside the strategy document on purpose. v4 answers five questions — what this is, who
it is for, what it costs, how we know it is working, and when we stop. An audit-response ledger
serves none of them; it is reference apparatus, and keeping it here is what lets v4 stay short. The
three Critical findings are closed inside v4 itself, not here.

**Status: 15 closed or recorded sound · 1 deferred with a reason · 0 unaddressed.**

## Critical

| ID | Finding | Disposition |
|---|---|---|
| **A-01** | Positioned as a settlement product but states no revenue model | **Closed — v4 §1.** The frame is stated outright: an internal creator-supply programme with a budget, not a revenue target. There is no take rate and will not be one. |
| **B-01** | Take-rate revenue at achievable volume does not cover a payments-product run-rate | **Closed — v4 §1, §3.** The arithmetic is reproduced in the document (`2%` of `$1M` = `$20,000`; `$1–5M` plausible annual volume ⇒ `$20–100K/yr`), and the governing number is replaced with cost per retained creator. |
| **F-01** | No measurement baseline exists for the outcome the project claims to improve | **Closed — v4 §4, §9.** Baseline capture is Phase 0 workstream 1, Monday item 1, and gate condition 1 — sequenced first precisely because it cannot be captured correctly once anything ships. |

## High

| ID | Finding | Disposition |
|---|---|---|
| **A-02** | Phase gates measure settled volume, not the outcome the rail is built for | **Closed — v4 §5.** Gates are supply metrics: reply rate `+15%`, repeat bookings `+10%`, `≥20` creators who would decline an equal-fee brief elsewhere, CPRC below sourcing cost, `0` escalated disputes. Volume is recorded monthly and is never a gate. |
| **B-02** | No build estimate or ongoing run-rate has been produced | **Closed — v4 §7.** Order-of-magnitude lines for engineering, audit, counsel, ramp partner and ongoing run-rate, plus a stated pause ceiling of `$5,000/month` before any external creator is onboarded. |
| **C-01** | The 2-of-3 arbiter role is asserted non-custodial without counsel review | **Closed — v4 §4 gate 4, §8.** Counsel scoping is a Phase 0 workstream limited to Tier-1 markets, it is half of gate condition 4, and a custody determination in `≥2 of 3` markets is a named kill criterion. |
| **C-02** | No jurisdiction matrix exists; target markets unenumerated | **Closed — v4 §4.** Naming the `3–4` Tier-1 markets is a Phase 0 workstream, with every other market recorded out of scope rather than left unbounded. |
| **D-01** | Creator wallet onboarding named as the principal UX risk with no solution attached | **Closed — v4 §2, §4.** Embedded wallets with email recovery, tested on three real creators before the escrow contract is written, with completion rate and time to first payout as the acceptance criterion. |
| **F-02** | The build has no named owner and the wider programme is already fully committed | **Closed — v4 §4.** Phase 0 is engineering-free by design so it runs against existing commitments, and gate condition 4 requires a named engineering owner who is not delivering the CRM, dashboard or terminal — or the project does not start. |

## Medium

| ID | Finding | Disposition |
|---|---|---|
| **A-03** | No incumbent payout vendor evaluated and rejected on the record | **Closed — v4 §4, widened.** Three vendors are priced and rejected in writing, *and* a null-hypothesis workstream prices the non-technical alternatives the original finding did not reach: net-7 payment from working capital, and asking three brands to pre-fund an ordinary invoice. Gate condition 3 turns on both. |
| **B-03** | Compliance cost scales with corridors, while corridors are the Phase 1 growth lever | **Closed — v4 §5.** Phase 1 is one corridor — the one where DGTL already pays the most creators. Additional corridors move to Phase 2, gated on the supply effect. |
| **C-03** | Creator endorsement-disclosure requirement not carried in any signed artefact | **Closed — v4 §4.** The compensation election form is drafted during Phase 0, with the disclosure clause and a plain-language risk statement, though no token exists to elect. |
| **E-01** | No demand evidence exists for any of the five surviving token utilities | **Deferred to Phase 1 — reason stated.** The audit recommends asking three partner organisations during Phase 0. v4 does not. Phase 0's six weeks are spent establishing whether the *rail* hypothesis holds, and a token whose rail has not been proven is not yet a live question to put to a partner. Demand is instead tested by the existing kill criterion — fewer than `3` partner orgs wanting portable balances after `12` months of Phase 1 kills the token and keeps the rail. Recorded as a deferral, not an omission. |

## Low — recorded sound

| ID | Finding | Disposition |
|---|---|---|
| **D-02** | Chain selection deliberately deferred to Phase 2 | **Sound — retained, v4 §5.** The deferral holds and the recommendation to resist announcing a chain for marketing reasons is carried forward. |
| **E-02** | Earned-only distribution with no sale materially reduces securities exposure | **Sound — held, v4 §6.** Fixed supply, locked mint authority, no sale of any kind, distribution only against verified activity. v4 records *why* it is written down: this decision comes under pressure the first time the project needs capital. |
| **F-03** | Public-facing surfaces are compliant, consistent and evidence-checked | **Sound — hardened, v4 §6.** The audit recommended keeping the sweep as a release gate. It is now `tools/check-compliance.py`, run against every DGTL Pay surface, and extended to cover posts by token-compensated creators. |
