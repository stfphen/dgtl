# Skill Integration Audit — 2026-07-25

Checked the five installed DGTL skills against this repo at `ee1dc2d`.

**Verdict: one of five is integrated, and only structurally. The other four are pure context —
the repo doesn't reference them and they don't know the repo's conventions exist.**

Evidence: grepping all five skills (excluding `assets/`) for every convention `CLAUDE.md` treats
as mandatory — `check-links`, `pitch.json`, `pitches.index`, `pendingAssets`, `pack.json`,
`packs.index`, `_shared`, `data-slot`, `_templates`, `brain/` — returns **zero hits**. The only
repo-adjacent strings any skill knows are the two deploy domains.

---

## 1. `dgtl-creator-features` — vendored, but describes the pre-migration layout

The good case: `engine/dgtl-creator-features/` is tracked (11 files) and **byte-identical** to the
installed skill (`diff -rq` clean). `CLAUDE.md`, `SETUP.md`, `README.md` and `MIGRATION.md` all
reference it. That is real integration at the file level.

Its *instructions* are still the old ones:

| Skill says | Repo actually uses |
|---|---|
| `influence-journal/creators/<slug>.html` | `journal/packs/<slug>/index.html` |
| `influence-journal/assets/media/<slug>/` | `journal/packs/<slug>/media/` |
| `assets/dgtl-editorial.css` | `journal/_shared/dgtl-editorial.css` |
| hero path `../assets/media/<slug>/hero.jpg` | `media/…` from a hub, `../media/…` from a feature |
| hub card on `influence-journal/index.html` | `journal/index.html` |
| `CANONICAL_URL = https://pitch.dgtlmedia.io/journal/creators/<slug>/` | the stale path `CLAUDE.md` lists as an open migration item |

Also missing entirely from the skill:

- **`pack.json`** — `CLAUDE.md`: "keep `pack.json` accurate — the index, sitemap and cross-links
  are generated from the manifests." The skill never writes one.
- **`packs.index.json`** — new packs must be registered. The skill never registers.
- **`tools/check-links.py`** — the mandatory gate before publishing work is complete. Not mentioned.

**Broken doc, verified:** `SETUP.md:40` documents

```bash
python3 engine/dgtl-creator-features/scripts/make-standalone.py journal/packs/<slug>/index.html
```

The script requires `--file` and `--out`. Running it as documented errors out:
`make-standalone.py: error: the following arguments are required: --file, --out`.

---

## 2. `dgtl-pitch-pages`, `dgtl-pitch-teasers`, `dgtl-pitch-composer`, `dgtl-brand-kit` — absent

Not in the repo. No `engine/dgtl-pitch-*`, no `engine/dgtl-brand-kit`, no `.claude/` directory, no
settings, no hooks. The only mentions anywhere are `skill-mods/hero-rotation-skill-patch.md` and a
passing line in `CLAUDE.md`.

### 2a. Output never lands in the repo

All three pitch skills end with: SendUserFile → "persist as a desktop artifact" → "save into the
attached project." The repo requires `pitches/<slug>/index.html`, a `pitch.json`, and an entry in
`pitches.index.json`. Nothing connects the two. Every skill run produces an orphan file someone has
to hand-place and hand-manifest.

### 2b. Teaser architecture directly contradicts the repo

`dgtl-pitch-teasers` deploys the teaser and the full pitch as **two separate slugs**, cross-linked
by absolute `https://pitch.dgtlmedia.io/<slug>` URLs.

`CLAUDE.md` and the actual tree (`pitches/dmtv-bose/index.html` + `teaser.html`) put both in **one
folder**, and the rule is explicit: *"No domain-absolute links. A teaser links its full pitch as
`index.html`, not `/full/`."*

Following the skill as written produces exactly the layout the repo forbids — and that rule exists
because "the DMTV x Bose teaser's 'See the Full Pitch' button silently broke" (`check-links.py`
docstring).

### 2c. `_templates/` data-slot model is invisible to the skills

`pitches/_templates/` holds three generic offer pages cloned per prospect via a `DATA-SLOT MANIFEST`
in each `<head>`. This is the repo's personalisation model. No skill knows about it, so a skill run
rebuilds a page from scratch rather than cloning and slot-filling — losing the fixed content the
manifest is designed to protect.

### 2d. `pendingAssets` is invisible to the skills

The `pendingAssets` mechanism exists specifically so a known content gap reports as `pending`
instead of `missing` ("which is how the ESCOTT photos went unnoticed"). No skill emits it. Skill
output shipped before its photos arrive turns the check red — reintroducing the exact failure mode.

### 2e. `dgtl-brand-kit` vs `platform/`

Token values in `dgtl-brand-kit/assets/dgtl-tokens.css` match `journal/_shared/dgtl-editorial.css`
value-for-value. No drift there **yet**.

`platform/app/admin/dgtl-admin.css` is a different naming scheme — a legacy alias layer:

```
--blue: #F0CF50;   --white: #0a0a0a;   --black: #F0F0F0;   --near-black: #e6e6e6;
```

The skill's component recipes reference `var(--gold)`, `var(--r-card)`, `var(--surface-card)` — none
of which exist in `platform/`. So "apply the DGTL brand kit to the platform" either silently fails
or gets hardcoded, which `CLAUDE.md` calls non-negotiable ("Never hardcode a brand value into a
component — reference the token").

There are now **three** copies of the palette (skill, journal, platform) with no sync mechanism.
They agree today. Nothing keeps them agreeing.

---

## 3. The structural cause: no skill source of truth in the repo

`skill-mods/hero-rotation-skill-patch.md` is the tell. It is a patch written *for*
`dgtl-pitch-pages` and `dgtl-pitch-teasers`, and it says so directly:

> the skill copies visible in a Cowork session are a read-only cache — editing them there does not
> change your installed skill. Apply the edits below to wherever you maintain the skill source.

**That patch has never been applied.** Neither skill mentions hero rotation. Same story for
`skill-mods/migrate-to-main-domain/`, which moves the deploy target to `dgtlgroup.io/pitch/<slug>/`
— all four pitch skills still hardcode `pitch.dgtlmedia.io/<slug>`.

So the repo is accumulating skill changes with no channel to deliver them. `engine/` holds one
vendored copy, `skill-mods/` holds undelivered patches, and the installed skills are maintained
nowhere.

---

## 4. Current check state (baseline, for reference)

```
$ python3 tools/check-links.py
checked=746 missing=0 pending=3 root_absolute=0
```

Green. The three pending are the declared ESCOTT photos. Nothing here is broken *today* — the risk
is that the next skill-generated page breaks it, because the skill has no idea the check exists.

---

## 5. What "integrated" would mean

Ordered by payoff per unit of work:

1. **Vendor all five skills into `engine/`** as the source of truth, so `skill-mods/` patches have
   somewhere to land and the installed copies are re-exported from the repo, not edited in place.
2. **Rewrite `dgtl-creator-features` paths** to the pack model (`journal/packs/<slug>/`), add
   `pack.json` + `packs.index.json` registration, and add the `check-links.py` gate to its workflow.
3. **Add repo-output steps to the three pitch skills**: write to `pitches/<slug>/`, emit
   `pitch.json` (incl. `pendingAssets`), register in `pitches.index.json`, use relative intra-pitch
   links, run `check-links.py`.
4. **Teach the pitch skills the `_templates/` data-slot clone path** for prospect-tailored pages.
5. **Reconcile `platform/`'s alias layer** with the canonical token names, or document the mapping
   in `dgtl-brand-kit` so the skill can target the platform correctly.
6. **Fix `SETUP.md:40`** — the documented `make-standalone.py` invocation does not run.
7. **Apply the two pending `skill-mods/` patches** (hero rotation, main-domain deploy target) once
   there is a source of truth to apply them to.
