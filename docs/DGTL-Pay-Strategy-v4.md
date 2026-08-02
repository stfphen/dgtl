# DGTL Pay + $DGTL — Strategy v4

**Canonical.** Supersedes `DGTL-Pay-Strategy-v3.md`, `v2` and `DGTL-Token-Strategy.md` — archived
under `docs/archive/`. Working document · August 2026 · findings ledger §10.

---

## 1 · What it is

> A non-custodial USDC settlement layer that pays DGTL's own creators faster and more visibly than a
> competing agency can — funded as a creator-supply programme with a budget, not as a payments
> product with a revenue target.

**There is no take rate and will not be one** (closes A-01). At a `2%` take, `$1M` of settled volume
yields `$20,000`; an agency's own annual payout volume is plausibly `$1–5M`, putting take-rate
revenue at `$20–100K/yr` against a compliance and audit run-rate that is not in that range — and the
fee level that would fix that is exactly the fee level a creator notices, which destroys the
mechanism the rail exists to create (closes B-01).

The return arrives as creator supply — reply rate, repeat bookings, retention. Priced as a fintech
this is a bad business. Priced as a retention programme it is a cheap moat, because *being the
agency that pays properly* cannot be copied in a quarter.

---

## 2 · The flow

![DGTL Pay non-custodial settlement flow](assets/dgtl-pay-flow.svg)

DGTL originates the invoice, sets escrow terms, verifies delivery, reconciles, and signs as one of
three on release. **DGTL holds `$0` of counterparty funds in transit — by architecture, not by
policy.** Fiat ramps are a licensed partner's product per corridor, under their licence and KYC.

The cost is honest: creators need a wallet, and that is the entire UX problem of Phase 1. Embedded
wallets with email recovery, tested on three real creators before the escrow contract is written —
never solved by holding funds to smooth onboarding.

---

## 3 · The one metric

```
        annual run-rate of DGTL Pay
CPRC = ───────────────────────────────────────────
       creators retained who would otherwise churn
```

`$60K/yr` holding `40` creators is `$1,500` each, measured against what it costs today to source,
vet, brief and onboard one creator of equal quality. Below sourcing cost it pays for itself; at
three times sourcing cost it is a hobby. **Two inputs, neither known today:** fully-loaded creator
sourcing cost, from existing records, Phase 0 week 2 — and the annual run-rate from §7, week 5.

Settled volume is recorded monthly and is **never** a gate. DGTL could route its own campaigns,
clear `$250K`, and not one creator would have changed which agency they answer.

---

## 4 · Phase 0 · Evidence — six weeks, no engineering

`Aug 3 – Sep 11 2026`. Engineering-free by design, so it runs against an already-committed
programme (closes F-02). The eight workstreams and their dates are the Monday table in §9.

### Gate to Phase 1 — all four must hold

| # | Condition | Threshold |
|---|---|---|
| 1 | Baseline captured for all four metrics | complete |
| 2 | Creators naming a **specific past brief** where payment terms changed what they did | `≥6 of 10` |
| 3 | No cheaper alternative — vendor, net-7 from float, or brand pre-funding — delivers escrow visible before delivery at acceptable cost | in writing |
| 4 | Counsel confirms the arbiter role is not custody in Tier-1, **and** an engineering owner is named who is not delivering the CRM, dashboard or terminal | both yes |

**Condition 2 is revealed preference on purpose** — asked whether faster payment would matter, a
person who is owed money says yes every time, and a question that cannot fail is not a gate.
**Condition 3 exists because the null hypothesis has never been priced:** if paying faster out of
working capital buys the same supply effect, there is no reason to build anything. If any of the
four fails, **stop** — nothing is lost but six weeks of asking questions.

---

## 5 · Phase 1 · One corridor

Escrow, delivery verification, reconciliation export and wallet onboarding for **one corridor** —
where DGTL already pays the most creators. DGTL's own campaigns only: no external agency, no
self-serve signup. One corridor, not four, because compliance obligations are per-market and
recurring: four corridors is four times the run-rate for no additional effect on the mechanism
being tested.

| Gate to Phase 2 — supply metrics | Threshold |
|---|---|
| Brief reply rate vs. Phase 0 baseline | `+15%` |
| Repeat-booking rate vs. Phase 0 baseline | `+10%` |
| Creators who would decline an equal-fee brief elsewhere to stay | `≥20` |
| Cost per retained creator vs. sourcing cost | below it |
| Disputes escalated outside the `2-of-3` process | `0` |

Phase 2 adds the second corridor and begins token definition — rights memo, audit, testnet,
closed-beta redemption. The chain decision is made there, once volume characteristics are
observable, and not before.

---

## 6 · The token

**$DGTL is proposed, not minted, not issued, not sold.** Gated to Phase 3; activates only if Phase 1
proves the supply effect and Phase 2's closed beta clears.

**The database test governs it and the list is closed.** If a feature can be a database row, DGTL
builds the row — free, instant, reversible — and ships it on the rail in Phase 1 with no token.
Discount tiers, booking priority, loyalty points and membership flags all failed. Five survived,
sharing one property: *a party outside DGTL's account system must hold or act on value.*

1. **Portable balance** — value a creator keeps after leaving the platform
2. **Cross-org redemption** — credit redeemable across DGTL and partner brands
3. **Partner-held balances** — an agency holds value without a DGTL account
4. **Creator-fund governance** — external contributors vote on grant allocation
5. **Programmable campaign incentives** — third parties can build on the primitive

**No sale of any kind** — not public, not private, not to insiders ahead of launch, no SAFT. Fixed
supply `1,000,000,000`, mint authority renounced or permanently multisig-locked, distribution only
against verified activity. This removes the largest category of securities risk at the design level
rather than managing it with language, and it will come under pressure the first time the project
needs capital — which is why it is written down now. The allocation split is a **Phase 2 draft for
counsel review**, labelled as such wherever it appears.

**Compensation stays elective:** cash price quoted first and unchanged; optional election up to
`50%` in $DGTL; `10–20%` bonus on the elected portion only, disclosed as an illiquidity premium;
`6`-month cliff, `12`-month vest; written FTC disclosure signed at election.

**The communications rule is a release gate, not a guideline** — `tools/check-compliance.py` runs
before any surface ships, including posts by token-compensated creators.

---

## 7 · Budget and the run-rate ceiling

No figure here is a quote. These are order-of-magnitude estimates so the project can be evaluated at
all; replacing them with real ones is a Phase 0 deliverable.

| Line | Phase 0 | Phase 1 · one corridor |
|---|---|---|
| Engineering | `$0` | escrow contract + verification + reconciliation UI |
| Contract audit | `$0` | one full audit, one re-audit after fixes |
| Counsel | `$2–5K` | Tier-1 opinion; token rights memo at Phase 2 |
| Ramp partner | `$0` | integration + any monthly minimum |
| **Ongoing run-rate** | `$0` | counsel retainer · monitoring · disputes · re-audits |

> **The ceiling.** If the estimated ongoing run-rate exceeds `$5,000/month` before a single external
> creator is onboarded, the project **pauses** — not re-scopes — and the estimate goes to the board.

The run-rate decides this project, not the build. A build is a one-off an agency absorbs; a monthly
compliance run-rate is a permanent claim on cash flow that does not shrink when performance
disappoints.

---

## 8 · Kill criteria

**Kill the rail** if CPRC exceeds sourcing cost for `2` consecutive quarters · the §7 ceiling is
breached · Tier-1 counsel issues a custody determination on the arbiter role in `≥2 of 3` markets ·
or disputes exceed `10%` of campaigns, because then the product is arbitration, not payments.

**Kill the token, keep the rail** if fewer than `3` partner orgs want portable balances after `12`
months of Phase 1 · counsel advises "no marketing without registration" in `≥2` of the three largest
markets · or closed-beta redemption sits below `5%` of distributed balance for `2` quarters.

**Tripwire the other way.** If an external agency asks to run its own payouts on the rail, the
Expansionist's case below stops being speculation and this document is too small. Revisit
immediately — do not wait for a phase boundary.

---

## 9 · Monday — the whole of Phase 0

No engineering in any row.

| # | Action | By | Cost | Closes |
|---|---|---|---|---|
| 1 | Pull the four baseline numbers from existing records — reply rate, repeat bookings, churn, creator sourcing cost | `Aug 7 2026` | `$0` | F-01 |
| 2 | Write the interview script as **revealed preference**; have someone try to answer it dishonestly | `Aug 7 2026` | `$0` | F-01 |
| 3 | Interview `10` creators against that script | `Aug 14 2026` | `$0` | E-01 |
| 4 | Price net-7 from working capital; ask `3` brands whether they would pre-fund an ordinary invoice | `Aug 21 2026` | `$0` | A-03 |
| 5 | Price and reject `3` payout vendors in writing, naming the capability each fails | `Aug 21 2026` | `$0` | A-03 |
| 6 | Name the Tier-1 markets; run one live USDC payout end to end, recording every friction | `Aug 28 2026` | <`$200` | C-02 |
| 7 | Onboard `3` creators to an embedded wallet; draft the compensation election form | `Aug 28 2026` | `$0` | D-01 · C-03 |
| 8 | Counsel scoping call — arbiter role and custody, Tier-1 only | `Sep 4 2026` | `$2–5K` | C-01 |
| 9 | Name the Phase 1 engineering owner, or record that there isn't one | `Sep 11 2026` | `$0` | F-02 |

Item 1 is first because it is the only one that becomes impossible to capture correctly later —
once anything ships there is no honest *before*. Item 4 precedes any build decision because it can
cancel the entire engineering budget for two days of work.

---

## 10 · Findings ledger

All 16 audit findings (30 July 2026) are dispositioned in
[`DGTL-Pay-Audit-Response.md`](DGTL-Pay-Audit-Response.md): **15 closed or recorded sound, 1
deferred, 0 unaddressed.** The three Critical findings are closed here — A-01 and B-01 in §1, F-01
in §4 and §9.

**One is deferred rather than closed, and that is a decision, not an omission.** E-01 — no demand
evidence for the five token utilities — is not tested in Phase 0, because those six weeks establish
whether the *rail* hypothesis holds and a token whose rail is unproven is not yet a live question to
put to a partner. Demand is tested by the `12`-month kill criterion in §8 instead.

---

## 11 · Minority reports

Both survive this revision. Neither is hedged, and neither has been answered.

▲ **The Expansionist:**

> You're building this as a DGTL feature when the same work is an industry rail. Three competing
> agencies would use a working creator-payout rail before one would hold your token.

🔻 **The Contrarian:**

> The compliance run-rate doesn't care what you call the project. Counsel, ramp partners, audits and
> dispute handling bill monthly whether retention moves or not.
