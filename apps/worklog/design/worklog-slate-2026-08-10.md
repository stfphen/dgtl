# office.dgtl.at — Skunkworks slate

**Date:** 2026-08-10 · **Ambition:** Extend · **Lenses:** all five · **Research:** competitor scan, complaint mine, capability scan
**Subject:** the DGTL Worklog at `apps/worklog/` — a self-hosted 2–6 person timer + tasks + projects + reports app, vanilla JS front end, Node + SQLite back end, ~5,600 LOC.
**Winning:** the team logs time reliably, and the numbers are trustworthy enough to invoice from.
**Binding constraint:** time — one or two people building this in evenings around client work.

Every number below came from the live database through the `dgtl-worklog` MCP bridge on 2026-08-10, and every code-line reference was independently re-verified against the repo by a fact-checking pass. Two claims from the source audit came back **PARTIAL** and are corrected in §6.

---

## 1 · The frame, and why it moved

The source audit (`alterations to dgtl.at.md`) is a good audit. It finds thirteen real things. But it audits the **Projects page**, and the Projects page is not where the damage originates — it is where the damage becomes visible. Reading the live data changes the ordering of the whole slate.

The single most consequential fact in the workspace is not the 453% budget bar. It is this row:

```
entry #8 · user 1 (DGTL Office) · project 2 (FlockaMG Music Video)
started_at  2026-08-09T18:58:23.568Z
ended_at    2026-08-10T17:36:23.929Z
minutes     1358          (22h 38m)
billable    1             (on a project whose billable flag is 0)
date        2026-08-09    (the whole interval booked to the start day)
source      timer
```

That is a timer left running overnight. It is **75.2% of every minute in the database** (1,358 of 1,805). It is why:

- the Projects page shows FlockaMG at 453% of budget,
- the day `2026-08-09` reports 1,363 minutes — a 22.7-hour calendar day,
- and the billable share is 13% on one screen and 100% on another.

The audit's finding 7 — "the over-budget bar clamps at 100%, so 453% looks like 101%" — is real, but the 453% is not a budget overrun. **It is a runaway timer wearing a budget costume.** Building a better overflow bar would have rendered a wrong number more legibly.

### What else the live data says

| Observation | Value | Where it came from |
|---|---|---|
| Total logged, all time | `30h 05m` across `9` entries on `3` distinct days | `worklog_report` |
| Days with any time logged, last 90 | `3` of `90` | `heatmap` |
| Entries with no project | `4` of `9` — `218 min`, 12% of everything | `worklog_list_entries` |
| Entries linked to a task | `0` of `9` | `worklog_list_entries` |
| Open tasks | `71` across 9 projects | `worklog_context` |
| Tasks ever completed | `3` | `worklog_report` |
| Users who have ever logged time | `2` of `6` | `byUser` |
| Billable share, as the MCP/Reports computes it | `100%` | `worklog_report` |
| Billable share, as the Projects page computes it | `13%` | `projects.js:62-67` |

The task half and the time half of this application share a database and nothing else. Seventy-one tasks are being authored and maintained by hand while zero time entries reference any of them.

---

## 2 · Evidence board

Full cards. Chat carried only the claim lines.

### ⌕ 1 — Harvest users name "forgot to stop the timer" as their top con inside five-star reviews, and the vendor's answer is a roadmap note
> "Sometimes, it can be difficult to remember to stop or start the timer. It would help if Harvest had better reminders. Harvest does have some type of reminder if it perceives the clock has run too long. But it doesn't always remind the user until it is way too late." — Luke E., Content Writer, five-star review
> Harvest official reply, 2025-06-05: "I've noted your interest in improved reminders on your running timers for the rest of the team."

Source: Capterra, Harvest reviews — https://www.capterra.com/p/75598/Harvest/reviews/ · 2025-04-03
Strength: **observed** · Feeds: ◉ Shadow
*Why it matters:* the complaint survives a five-star rating. It is priced in as unavoidable rather than treated as a defect — which is exactly the condition under which a small competitor can take it seriously.

### ⌕ 2 — The nudge that exists arrives at the wrong hour, which converts a forgotten timer into a memory-reconstruction problem
> "I don't like that it does not send you the 'did you leave your timer on' towards the end of my work day as a reminder to turn it off. Instead I get it at odd hours or the next morning and I have to figure out when I actually stopped working because the clock just keeps going." — Stephanie L., Compliance Specialist

Source: Capterra, Harvest reviews · 2025-12-29
Strength: **observed** · Feeds: ◉ Shadow, and cull fuel against the notification candidate
*Why it matters:* this is the strongest single card in the run. It says the fix is not a reminder. The user is not asking to be told sooner; they are asking not to have to reconstruct the stop time at all.

### ⌕ 3 — Six distinct Toggl users, July–December 2025, report timers that show stopped in the UI and keep running server-side; support's answer is "refresh before you press stop"
> "When i complete my job, i'm pressing the stop button. It turns black&white. But when i refresh the page, i'm seeing it still running." — Okan_Deneme, 2025-07-25
> "When I finish work, I make sure I stop the timer, but sometimes I get an e-mail hours later telling me that my timer is still running." — Marie_Pribylova, 2025-07-17

Source: Toggl Community — https://community.toggl.com/t/timer-keeps-running-even-after-i-switch-it-off/2632 · unresolved as of Dec 2025
Strength: **observed** · Feeds: ⊘ Inverter, ⬡ First Principles
*Why it matters:* an unfixed client/server truth problem in exactly the architecture DGTL is using — a browser holding a timer whose real state lives on a server. The lesson is that the server, not the client, must be the authority on when a timer ended.

### ⌕ 4 — Idle detection with a keep/discard/split prompt is table stakes in 2026 and ships free in an AGPL repo; no vendor advertises runaway-timer handling
Solidtime's desktop app shows: *"You were away from your computer · Idle duration 14m 32s · Idle start 10:53 · Activity resumed 11:08"* with **Keep idle time / Discard idle time / Discard & start new timer**. Toggl lists idle detection on the **Free** plan. Clockify lists "Idle detection & reminders". The only auto-stop observed anywhere is Everhour's *budget* protection mode — stops timers when the money runs out, not when a timer has run fourteen hours.

Source: https://solidtime.io/ (changelog 2026-04-28) · https://toggl.com/track/pricing/ · https://clockify.me/pricing
Strength: **observed** · Feeds: cull fuel + the copyable spec for rank 1
*Why it matters:* the three-way resolution prompt is the proven interaction pattern — copy it, do not invent one. But the *trigger* everyone uses is desktop idle, which requires an agent DGTL will not build. Runaway-timer handling as such is unclaimed.

### ⌕ 5 — Desktop activity capture crossed from premium differentiator to commodity inside twelve months
Toggl ships app/website timeline capture on the **Free** plan. Clockify ships "Auto tracker". Solidtime shipped local-only capture with a per-app breakdown on 2026-04-28. Timing and Memtime are entire products built on it.

Source: https://toggl.com/track/pricing/ · https://solidtime.io/ · https://timingapp.com/features · https://www.memtime.com/pricing
Strength: **observed** · Feeds: cull fuel
*Why it matters:* kills the capture-then-assign candidate at Extend. It is catch-up, and it is heavy.

### ⌕ 6 — Not one tracker in the category ships a surface the client actually visits
The strongest client-facing artefacts across four fetched vendor sites are a read-only report link (Solidtime), a PDF export, and an invoice (Harvest, $50B+ processed). "Approval" universally means manager-approves-employee, gated at Enterprise: Harvest $14/seat, Toggl Premium $14/seat. No shared status page, no client login, no client sign-off on scope.

Source: https://solidtime.io/ · https://www.getharvest.com/pricing · https://everhour.com/project-budgeting · https://clockify.me/pricing
Strength: **observed** (absence across four sites; Hubstaff and Tempo not fetched) · Feeds: ⊕ Recombinator
*Why it matters:* this is the white space, and DGTL is unusually placed to take it — the pitch deploy pipeline and the `dgtl-worklog-status-report` skill already exist in the same monorepo.

### ⌕ 7 — Budget alerting is fully commoditised with a settled default
Everhour's own copy is the spec: *"Automatic email alerts at 75%, 90%, 100%. Auto-stop timers when budget exceeded."* Plus recurring budgets that auto-reset for retainers, and client-level budgets spanning projects. Clockify and Toggl both ship threshold alerts; Toggl's is on Starter at $9.

Source: https://everhour.com/project-budgeting · https://clockify.me/pricing · https://toggl.com/track/pricing/
Strength: **observed** · Feeds: cull fuel
*Why it matters:* any budget-alert candidate is catch-up by definition. The only non-obvious pieces are recurring retainer budgets and client-level budgets spanning multiple projects — which is exactly the shape of TPB · A/B/C/D under 111.

### ⌕ 8 — Classifying ~50 short worklog notes a day with a frontier-small model costs single-digit dollars per year
Claude Haiku 4.5 at `$1/MTok` input, `$5/MTok` output, cache hits `$0.10/MTok`, Batch API at a flat 50% discount. Fifty notes a day at ~100 effective input tokens and ~30 output ≈ **$4.50/yr**, or ≈ **$2.30/yr** batched overnight.

Source: https://platform.claude.com/docs/en/about-claude/pricing · 2026-08
Strength: **observed** (prices) / **inferred** (the arithmetic) · Feeds: ⊕ Recombinator
*Why it matters:* cost has stopped being a reason not to have the app write prose. The remaining constraint is trust in the output, which is a review-workflow problem, not a budget one.

### ⌕ 9 — MCP 2026-07-28 deprecates sampling, and the existing worklog MCP server predates the spec it would need
Multi-round-trip requests (SEP-2322) let a stateless server return `resultType: "input_required"` and resume — ordinary HTTP, no held-open stream. But sampling, roots and logging are formally deprecated (SEP-2577), so "have the user's Claude classify this for free" is dead. And `initialize` / `Mcp-Session-Id` are gone, so the existing server needs an SDK migration before it can elicit anything.

Source: https://modelcontextprotocol.io/specification/2026-07-28 · https://blog.modelcontextprotocol.io/posts/2026-07-28/
Strength: **observed** · Feeds: cull fuel — this is what kills the conversational-logging candidate on constraint

### ⌕ 10 — The market's described workaround is architectural: keep the billable-hours representation separate from the timer
> "my plan … is to build out the invoicing solution I need as a web app and then have it generate an internal representation of billable hours by importing csv files… If a time tracking becomes unsupported, I can swap to another one… and the important part (invoice handling, billing etc) is unaffected." — `stephenr`

Source: Hacker News — https://news.ycombinator.com/item?id=19922549
Strength: **observed** · Feeds: ⬡ First Principles
*Why it matters:* a described workaround is a feature spec written by the market. It says the durable asset is the billable-hours representation and the timer is swappable input — which is the exact argument for deriving billability rather than storing it at the moment of capture.

**Honesty note on recon.** The complaint mine could not reach Reddit (hard-blocked to the crawler), so habit-abandonment and tracker-vs-invoice disagreement are under-evidenced and rest on reasoning. The competitor scan could not fetch Kimai. The capability scan verified macOS activity access but not calendar, browser, Slack or Gmail access — treat any claim about those as unresearched.

---

## 3 · The lenses — full output, including culled candidates

### ⬡ FIRST PRINCIPLES

**› DERIVED BILLABILITY** — *survived, ranked 2*
**Billability stops being a column written at capture and becomes a function of the project computed at read time, so the two screens cannot disagree because there is only one rule left to disagree about.**
⌕ 10 · `strong × trivial` · *Convention deleted:* that billability is a property of a time entry rather than of the relationship between work and client.
The schema's own header comment, `schema.sql:5-7`, states the law: *"everything derived … is computed from time_entries at read time and NEVER stored. That rule is what keeps the numbers honest after an edit."* `billable` is the one derived thing that got stored, and it is the one number that went wrong. Three write paths default it to 1 independent of the project — `api.mjs:551` (timer start), `api.mjs:500` (manual entry), `api.mjs:585` (re-tag, which carries the old value forward without re-deriving). Replace the column with `billable_override INTEGER NULL`; derive from the project when null.

**› ENTRIES AS INTERVALS** — *folded into rank 1*
**A time entry stops being a number attached to a day and becomes an interval that gets projected onto days at write time, so no calendar day can report more than twenty-four hours.**
— · `strong × trivial` · *Convention deleted:* that a unit of work belongs to exactly one date.
`api.mjs:158` dates the row with `localDate(new Date(t.started_at))`, so an interval crossing midnight books entirely to the start day. This is not folded in for tidiness — it is the same commit as rank 1, because both are about what the stop handler writes.

**› CAPTURE THEN ASSIGN** — ✕ **CULLED**
**The day is recorded automatically as a raw timeline and the human assigns blocks afterwards, so nothing depends on remembering to press a button.**
⌕ 5 · `transformative × heavy` · *Convention deleted:* that time must be classified at the moment it is spent.
✕ Failed **novelty at Extend** and **constraint**. Toggl ships it on the Free plan; Solidtime shipped it AGPL on 2026-04-28. It is catch-up. And it needs a desktop agent — the capability scan's own honesty note says macOS app-usage data is a consent-gated read of an undocumented `knowledgeC.db` schema, not an integration. Wrong shape for evenings.

### ⇄ THE ANALOGIST

The subject's hardest problem, abstracted: **an unattended process must be bounded when the operator disappears, and the record it produces must be trustworthy enough to bill from.**

**› DEAD-MAN'S TIMER** — *parent of the rank-1 fusion*
**Presence is proven rather than absence detected: any authenticated request from that user stamps the running timer, so on stop the server knows the last moment the person was demonstrably there.**
⌕ 3 · `strong × trivial` · *Stolen from:* rail vigilance control, where the driver must periodically acknowledge or the train brakes — the system assumes absence unless presence is proven, and the failure mode is safe. — *breaks if:* the browser tab is not where the work happens. Someone spending the evening in Figma with the worklog closed looks identical to someone asleep. **This disanalogy is real and it is why the candidate cannot stand alone.**

**› PROVISIONAL UNTIL ATTESTED** — *parent of the rank-1 fusion*
**Entries land in a provisional state and reach no KPI, budget bar or invoice until a human signs them, so a wrong number can exist in the database without being able to lie on a screen.**
— · `strong × moderate` · *Stolen from:* clinical charting, where an unsigned note is provisional and cannot bill. — *breaks if:* the person who logs is the person who signs, which in a two-person shop it is. Attestation degrades into a rubber stamp.

**› METERED MAXIMUM** — ✕ **CULLED**
**No timer may exceed a per-project ceiling, so the ceiling is a property of the meter rather than a thing you have to remember.**
— · `marginal × trivial` · *Stolen from:* parking meters, which will not sell you twenty-two hours. — *breaks if:* long legitimate sessions exist.
✕ Failed **so-what**. DGTL shoots music videos. The ceiling would have to be set above the longest legitimate shoot day, which is precisely the range the runaway lives in. It fires on the sessions you want and misses the one you don't.

### ⊘ THE INVERTER

**› DELETE THE KPI ROW** — *survived, ranked 5*
**Three of the audit's seven data-correctness defects live inside seventeen lines of KPI code that answer questions eight visible table rows already answer, so deleting the row removes the defects instead of fixing them.**
— · `marginal × trivial` · *Who wins:* whoever maintains this file. Audit findings 1, 2 and 3 are all in `projects.js:51-67` — one KPI reads the wrong flag, one ignores the archived filter the other three obey, and one silently changes meaning when you press an unrelated toggle. There are eight projects. Nobody needs a computed count of them.

**› THE APP OPENS ON THE EXCEPTION** — *parent of the rank-3 fusion*
**The home screen stops being a dashboard that always shows something and becomes a queue that is empty when nothing is wrong, so attention goes to decisions rather than to numbers.**
— · `strong × moderate` · *Who wins:* Stephen, holding 71 open tasks across 9 projects with 17 of them on Strashin alone. The source audit reached the edge of this itself: *"What you actually wanted from this screen was 453% at the top — that's an exceptions view, not a sort."*

**› NO UNTAGGED TIME** — ✕ **CULLED**
**A timer cannot be stopped into an entry without a project, so the 12% of the record that is currently unattributable stops accumulating.**
— · `marginal × trivial` · *Who wins:* whoever invoices — you cannot bill a line called "Unassigned".
✕ Failed **so-what**. It buys tagged data at the cost of the one genuinely good design principle in the codebase. `quick.js:3`: *"starting the clock must never wait on a decision."* Stopping is the same moment wearing a different hat, and the person who forgot to stop for twenty-two hours will not be rescued by a required field. Fix it at read time on the Exception Desk, not at write time in the user's way.

### ⊕ THE RECOMBINATOR

**› THE CLIENT-FACING LEDGER** — *survived, ranked 4*
**The worklog's task graph and time entries feed the pitch-deploy pipeline that already exists in this monorepo, producing a URL the client visits — which no tracker in the category ships, and which turns a weekly chore into an artifact that sells the next engagement.**
⌕ 6, ⌕ 8 · `transformative × moderate` · *Emerges from:* the 71 hand-authored, client-legible task titles + the `pitch.dgtlmedia.io` deploy pipeline + `dgtl-worklog-status-report` — *reached for when:* Michael asks what he is paying for.
The pull evidence is inside DGTL's own database. Tasks `#5` and `#6` are both titled **"Weekly progress note to Michael"**, due `2026-08-14` and `2026-08-21`. The workaround is not described in a forum — it is scheduled, recurring, and manual, in the very system that could generate it. ⌕ 8 removes the cost objection to having the app write the prose.

**› LOG BY CONVERSATION** — ✕ **CULLED** *(and named as the Sleeper)*
**The MCP server stops being read-only and starts asking: Claude surfaces the 218 unassigned minutes on Monday and writes the answers back, so reconciliation happens in a chat the user is already in rather than on a screen they have to visit.**
⌕ 9 · `strong × heavy` · *Emerges from:* the working MCP bridge + SEP-2322 multi-round-trip input — *reached for when:* Monday morning, before the week's first invoice.
✕ Failed **constraint**. The existing server was written against a stateful spec; `initialize` and `Mcp-Session-Id` are gone as of 2026-07-28, so elicitation implies an SDK migration first. There is no cheap probe that saves it — the migration *is* the work.

**› THE WORKLOG PAYS THE PITCH** — ✕ **CULLED**
**An unsold workstream already modelled as a project auto-generates its own pitch page from the tasks scoped inside it.**
— · `marginal × moderate` · *Emerges from:* `TPB · Branding (UNSOLD)` — project 8, code `111-D`, 9 open tasks, zero logged — + the pitch templates — *reached for when:* the branding tier follow-up falls due on 2026-08-21.
✕ Failed **so-what**. Elegant, and it does not move "the team logs time reliably and the numbers are invoiceable" by a single minute.

### ◉ THE SHADOW

**› THE MONDAY RECONCILE** — *parent of the rank-3 fusion, near-term*
**One screen listing only the entries missing a project, a task or a note, fixable inline in a single pass, so the untagged 12% gets resolved while it is still remembered.**
*Struggle:* four of nine entries carry `projectId: null` with notes `""`, `""`, `""` and `"Q"`. The largest is 187 minutes. Nothing in the app ever asks about them again.
— · `strong × trivial` · *near-term*

**› TASK-ANCHORED TIMER** — *survived, ranked 6, near-term*
**Starting a timer from a task binds `task_id`, so the 71 hand-authored tasks stop being a parallel universe and start accumulating the effort data that makes estimates and per-workstream budgets possible.**
*Struggle:* 71 open tasks, 0 of 9 entries linked to any of them. And `api.mjs:579` silently drops the task tag when project and task disagree, returning 200 — so a user who did tag can be told it worked when it did not.
— · `strong × trivial` · *near-term*

**› STOP-AT-THE-DOOR NUDGE** — ✕ **CULLED**
**A push notification when a running timer crosses the person's usual sign-off hour, so the forgotten timer is caught the same evening.**
⌕ 2 · `marginal × moderate` · *Struggle:* verbatim — *"I get it at odd hours or the next morning and I have to figure out when I actually stopped working."*
✕ Failed the **evidence test**. The card that motivates it also kills it: the incumbent's nudge *is* the complaint. Users are not asking to be told sooner, they are asking not to have to reconstruct the time. It is also downstream of rank 1 — if the server can truncate to proven presence, the phone is not needed — and it needs a home-screen-installed web app before iOS will deliver anything.

**› OVERFLOW BUDGET BAR + THRESHOLD ALERTS** — ✕ **CULLED**
**The budget bar gains a second track past 100% and the app emails at 75/90/100%, so a 453% overrun stops looking like 101%.**
⌕ 7 · `marginal × trivial` · *Struggle:* audit finding 7 — `projects.js:108` clamps with `Math.min(100, pct)`.
✕ Failed **novelty** (⌕ 7: Everhour's copy is literally the spec, Toggl ships it at $9) **and so-what** — the sharpest cull in this run. FlockaMG's 453% is not a budget overrun. It is one forgotten timer. Ship the overflow segment as a two-line change inside rank 5's commit; do not let it become an item, and above all do not build alerting on top of numbers that are currently wrong.

---

## 4 · Collision

```
✕ CULLED — Capture then assign        — novelty at Extend (⌕5) + constraint: needs a desktop agent
✕ CULLED — Metered maximum            — so-what: the ceiling must sit above a real shoot day
✕ CULLED — No untagged time           — so-what: costs the codebase its one good principle (quick.js:3)
✕ CULLED — Log by conversation        — constraint (⌕9): SDK migration is the work, no cheap probe
✕ CULLED — The worklog pays the pitch — so-what: moves nothing in the frame
✕ CULLED — Stop-at-the-door nudge     — evidence (⌕2): the incumbent's nudge IS the complaint
✕ CULLED — Overflow bar + alerts      — novelty (⌕7) + so-what: it renders a wrong number more legibly

⊕ FUSED  — Dead-man's timer + Provisional until attested → THE HONEST STOP
⊕ FUSED  — Monday reconcile + App opens on the exception → THE EXCEPTION DESK
```

**Why the fusions are legitimate.** Dead-man's timer alone dies on its own disanalogy — the browser tab is not where the work happens, so absence of heartbeat is not absence of work, and auto-truncation would quietly delete real hours. Attestation alone dies on so-what in a two-person shop, where the signer is the logger and the signature becomes reflex. Fused, each fixes the other: the server does not decide, it *presents* — "this ran 22h 38m, you were last seen at 23:12, here are your four options" — so the rubber stamp has something specific and alarming to stamp, and the truncation has a human behind it. Neither parent could do that.

The second fusion is the same trick. A missing-data filter is not novel; every tracker has one. A reordered home screen is not worth an evening. Fused into a queue of *conditions requiring a human decision, each carrying what it costs to ignore it, each resolvable inline and each disappearing when settled* — that is neither a filter nor a dashboard, and it is where the source audit's own reasoning was pointing.

---

## 5 · The slate

### 1 · THE HONEST STOP — `transformative × moderate`
The stop handler becomes the place the app tells the truth. `timers` gains `last_seen_at`, stamped by any authenticated request from that user while their timer runs. On stop, if the gap between last proven presence and the stop time exceeds a threshold, the entry is written `state = 'provisional'` and the human is handed four options: truncate to proven presence, keep it all and sign, discard, or leave provisional. Intervals crossing local midnight split into one row per day.

*Why now:* three independent complaint cards (⌕ 1, ⌕ 2, ⌕ 3), and a live 1,358-minute instance in the database that is 75% of all logged time and already broke two other numbers on screen. ⌕ 4 supplies the proven three-way resolution pattern to copy, and confirms the runaway case itself is unclaimed. And the app already knows a 1,358-minute entry is invalid — `api.mjs:498` bounds manual entries at `24*60`. A value the form would reject walks in through the timer.
*First probe:* run two queries — every entry where `ended_at − started_at > 8h` or the interval crosses local midnight, and the last 14 days of `sessions.last_seen`. If session data cannot reconstruct a plausible stop time for entry #8, the presence half dies and only the ceiling-and-split half ships. Costs `30 min`, by `2026-08-12`.

### 2 · DERIVED BILLABILITY — `strong × trivial`
Drop `time_entries.billable` as a written column; add `billable_override INTEGER NULL`. Derive from the project at read time when null. Rewrite the Projects KPI, `buildReport()` and the MCP report against the one rule. Ships in the same commit as rank 1.

*Why now:* the two screens disagree today — 13% against 100% — and the MCP bridge, which is how DGTL now reads its own numbers, sits on the 100% side. ⌕ 10 is the market saying the billable-hours representation is the durable asset. `schema.sql:5-7` is the codebase saying derived values are never stored. Both were already right.
*First probe:* compute billable share three ways over the same range — project flag, entry flag, derived — and count how many rows flip. If fewer than five rows flip, the finding is smaller than the audit implies and this drops below rank 3. Costs `20 min`, by `2026-08-11`.

### 3 · THE EXCEPTION DESK — `strong × moderate`
The home screen becomes a queue of conditions requiring a human decision: provisional entries, untagged time, projects whose delete would orphan tasks, over-budget projects, days with no time logged. Each row carries what it costs to ignore, each resolves inline, each disappears when settled. Empty is the goal.

*Why now:* it needs `state` from rank 1 to have a queue worth showing, and it is where the source audit's own finding 8 was pointing when it said the sort you wanted was an exceptions view. There are already six real conditions sitting in the database.
*First probe:* the static version is already built — `design/exception-desk-prototype.html`, seeded from the six real conditions. Send it to Colin and Stephen and watch whether any of the six get fixed within a week without further prompting. Costs `0`, by `2026-08-11`; read the result `2026-08-18`.

### 4 · THE CLIENT-FACING LEDGER — `transformative × heavy`
A per-client URL, generated from tasks and entries through the existing pitch-deploy pipeline, showing what was done, what is next, what is blocked on them, and where the retainer stands.

*Why now:* ⌕ 6 — not one tracker in the category ships a surface the client visits, and DGTL owns the pipeline that would. The pull evidence is inside their own to-do list: tasks `#5` and `#6`, both "Weekly progress note to Michael", recurring weekly, done by hand. ⌕ 8 kills the cost objection to the app writing the prose. **Gated on ranks 1 and 2** — publishing 13%-or-100% and a 22.7-hour day to Michael is worse than publishing nothing.
*First probe:* do not build it. Task `#5` falls due `2026-08-14`. Send that week's note as a link to a one-off generated page instead of an email body, and watch whether Michael opens it and replies to it rather than to the email. Costs `2 hours`, by `2026-08-14`.

### 5 · DELETE THE KPI ROW — `marginal × trivial`
Remove `projects.js:51-67`. Add the overflow segment to the budget bar, `role="progressbar"`, `scope="col"`, a `<caption>`, `aria-pressed` on the swatches, and replace the eight hardcoded hexes with the tokens they already are. All in one commit.

*Why now:* it deletes three audit defects rather than fixing them, and it carries the accessibility and brand-token repairs at zero marginal cost. All eight `SWATCHES` hexes at `projects.js:14` map to existing tokens; `ring()` at `ui.js:176-177` hardcodes `#1c1c1c` and `#F0CF50` inside an `innerHTML` string, and that helper is the one the paired rings would reuse, so it gets fixed on the way in.
*First probe:* comment out the KPI grid for a week. If nobody mentions it, it stays deleted. Costs `5 min`, by `2026-08-11`.

### 6 · TASK-ANCHORED TIMER — `strong × trivial`
Starting a timer from the Tasks view binds `task_id`. Fix `api.mjs:579`, which silently drops the tag on a project/task mismatch and returns 200.

*Why now:* 71 open tasks, 0 of 9 entries linked. Until entries carry a task, per-workstream budgets across `111-A` through `111-D` and any estimate-accuracy number are uncomputable — and the client ledger at rank 4 gets much thinner, because "what we did" reads as project names instead of the task titles Michael already recognises.
*First probe:* attach a task by hand to the next ten timers and see whether anyone looks at the resulting per-task number. If nobody does, the ledger does not need it and this drops off the slate. Costs `0`, by `2026-08-17`.

---

## 6 · Corrections to the source audit

Two claims in the source audit came back **PARTIAL** on independent verification, and one framing needs revising.

**Finding 9 (row actions invisible on touch) — PARTIAL.** `app.css:278-279` is confirmed: `.table .actions{opacity:0}` revealed on `tr:hover` / `tr:focus-within`. But `app.css:479-480` is a horizontal-scroll rule (`.table-wrap{overflow-x:auto}` / `.table{min-width:600px}`), not a stacked mobile layout — the audit reads it as evidence the table is "meant to be used there", which overstates it. More importantly, the audit understates the severity: `opacity:0` leaves the buttons **hit-testable**. On touch they are not merely unreachable, they are invisible and tappable. A stray tap can fire *Log time* or *Edit project* with no visible target. That is worse than the audit says.

**Finding on overdue counting — REVISED.** There are three definitions of "overdue" in the codebase, not two. `tasks.js:17` filters inclusively (`dueDate <= today`); `tasks.js:96` badges exclusively (`dueDate < today`); `api.mjs:241` counts `due_date < ?` bound to the **report range end**, not to today (`api.mjs:243`). In the default case the range end is today, so a task due today is not counted overdue — but pick a past range end and the divergence grows rather than shrinks. This is why `worklog_report` returns `overdue: 0` while task `#3` is due today.

**Finding 5 (the CLIENT column holds contact names) — CONFIRMED, and the conclusion stands.** `Michael`, `Max Gregan`, `Elliot`, `Internal`. `ui.js:145-147` builds every dropdown label as `${p.name} · ${p.client}`. Add a real `contact` field; leave `client` doing the job it is already doing. Renaming an occupied column in place is the one move to avoid.

**Finding 6 (the hierarchy already exists in `code`) — CONFIRMED.** `111` · `111-A` · `111-B` · `111-C` · `111-D` · `222` · `333`. `api.mjs:352` uppercases free text, so the dashes survive. Group on the prefix; defer `parent_id`.

**Three defects the audit did not reach**, all in `server/api.mjs`, all affecting data correctness:

1. `api.mjs:500` — the manual entry route also defaults `billable` to 1 independent of the project. The billability defect is on **every** write path, not just the timer.
2. `util.js:97` — the client's `today()` is UTC while the server files entries in `APP_TIMEZONE` (`config.mjs:46`). Client and server disagree about what day it is for part of every day in any non-UTC zone, and the app runs in `America/Toronto`.
3. `api.mjs:239` — the report's `done` count compares `date(t.done_at)`, a UTC timestamp, against `from`/`to`, which are local calendar dates. Tasks completed near midnight land in the wrong week.

---

## 7 · The verdict

**Build first** — **Ship The Honest Stop and Derived Billability as one commit.**

**Why** — Rung 1 genuinely tied. The Honest Stop and the Client Ledger both carry real pull: three verbatim complaint cards and a live 1,358-minute row for one, and a recurring hand-written task inside DGTL's own database for the other. **Rung 2 broke the tie** — `transformative × moderate` against `transformative × heavy`, and the Ledger is downstream: it publishes to a client the numbers the Honest Stop makes true.

**Watch** — If a second timer entry over eight hours appears before the fix ships, rank 1 was under-ranked and the ceiling half should ship the same day, ahead of the presence work. If Michael asks in writing where the hours went first, the Ledger takes rank 1 and everything else waits — because at that point the constraint stops being data quality and starts being the client relationship.

**Sleeper** — **Log by conversation.** Culled on constraint, and it is the highest-variance discard in this run. DGTL is the rare shop where the MCP bridge is already load-bearing — this entire analysis was run through it. If that SDK migration happens for any other reason, elicitation turns the Exception Desk from a screen you have to remember to visit into a Monday-morning conversation you were having anyway, and rank 3 evaporates as a separate build. The cull is on sequencing, not on merit.
