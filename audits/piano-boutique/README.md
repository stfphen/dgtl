# The Piano Boutique — findings ledger

Client: The Piano Boutique (Michael Ierullo), Toronto.
Site: https://www.thepianoboutique.com/ — Squarespace.
Correct address: 501 Alliance Ave, Suite 405B, Toronto M6N 2J1.

`ledger.json` is the durable record for this account. It is read by
`dgtl-client-reports` to build monthly progress reports and QBRs.

## ⚠️ This ledger was reconstructed, not imported

The original audit run is **not in this repo.** `probe_site.py` output and the
audit's own `findings-evidence.json` could not be found under `dgtl/`, and the
audit PDF referenced by `engagement.audit_document` does not exist here either.
A status report was deployed to `dgtl.report/piano-boutique-status-v1/` on
2026-08-10, so the source exists somewhere — it just is not in this working copy.

The 12 findings were therefore reconstructed from the audit codes embedded in the
DGTL worklog task notes (projects `111-A`, `111-B`, `111-C`, `111-D`).

**What that means in practice:**

- **IDs, categories and titles are reliable** — they come straight from the task
  notes, which cite the codes explicitly.
- **`severity`, `effort` and `phase` are inferred.** They are DGTL's read of the
  notes, not the audit's own ratings. Reconcile them against the PDF.
- **Every `baseline_evidence` field is prefixed `RECONSTRUCTED`.** These must be
  replaced with the verbatim Evidence row from the audit document before the
  first report ships. The before/after card compares against this string — a
  paraphrase makes the comparison a claim rather than a fact.

Do the reconciliation pass before marking anything `resolved`.

## The measurement baseline is still not captured

Worklog task **#12** (due 2026-08-11) is unstarted. It needs Search Console, GA4
and GBP Insights — all logged-in surfaces. The site is client-rendered, so a
headless fetch returns an empty document; the technical half of the baseline also
needs a real browser session.

This matters and it is time-critical: **once the metadata is rewritten the
"before" is gone permanently.** Do not start A-01 through A-04 until the baseline
is captured and date-stamped.

## Findings

| ID | Sev | Title | Status |
|---|---|---|---|
| A-01 | Critical | Meta descriptions empty across the site | open |
| A-02 | Critical | /pianotuning meta description empty on the highest-value page | open |
| A-03 | High | Title tags carry no service term and no city | open |
| A-04 | Medium | OG/Twitter image URLs served over http | open |
| A-05 | High | No structured data anywhere on the site | open |
| B-01 | Critical | Three conflicting business addresses across the citation index | open |
| C-01 | High | Copy contradicts the current product line and location | open |
| C-02 | Medium | Blog posts bylined "Guest User" | open |
| D-01 | Medium | All six footer social links broken or malformed | open |
| E-01 | Critical | Unlicensed artist press photos used commercially | open |
| F-01 | Low | Existing six-question tuning FAQ — healthy, preserve | accepted |
| F-02 | Critical | No measurement layer — no GA4, no verified Search Console | open |

## Commands

```bash
S=/path/to/skills/dgtl-client-reports/scripts/ledger.py

python3 $S stats    --ledger ledger.json
python3 $S validate --ledger ledger.json

# never hand-edit a status — it breaks the history and --as-of then lies
python3 $S set --ledger ledger.json --id A-04 --status resolved \
  --verified-by probe --observed "og:image now https://…" --on 2026-08-13
```

`resolved` is refused without verification evidence. That rule is the whole
reason a client believes the second document after believing the first one.
