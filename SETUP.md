# Setup

Git is **already initialised** in this folder and `origin` is wired to
`github.com/stfphen/dgtl` — do not re-run `git init`. For the first push, see
[First push](#first-push) at the bottom.

## Platform

```bash
cd platform
npm install
cp .env.example .env      # fill in DATABASE_URL and whichever API keys you need
npm run migrate           # applies migrations/001–008
npm run create-owner      # pass OWNER_PASSWORD as a one-time env var
npm run dev               # http://localhost:8088 · admin at /admin/login
```

Verify before shipping:

```bash
npm test                  # expect 356 tests · 5 known network-dependent failures
npm run build             # verified 2026-08-13; still fetches Google Fonts during build
```

Postgres is optional for local work — with no `DATABASE_URL`, `lib/store.js` falls back to a
JSON file at `platform/data/app-store.json` (gitignored). `docker-compose.yml` brings up a local
Postgres if you want the real thing.

## Journal

Static HTML, no build step. Open `journal/index.html` or serve the folder.

```bash
python3 tools/check-links.py                 # expect: missing=0
```

Regenerate a standalone deploy artifact (gitignored, never hand-edited):

```bash
python3 engine/dgtl-creator-features/scripts/make-standalone.py journal/packs/<slug>/index.html
```

## Brain

`brain/` is an Obsidian vault. Open the `brain/` folder as a vault; start at
`brain/00-Index/00-Home.md`. Vendored plugin bundles are gitignored — Obsidian will offer to
reinstall them.

## First push

The remote is empty and this branch has no commits yet.

```bash
# 0. pre-flight — both must pass before you commit
python3 tools/check-links.py          # expect: missing=0
git status --short --branch           # confirm branch main, origin = stfphen/dgtl

# 1. stage
git add .

# 2. sanity-check BEFORE committing — nothing huge, no deps, no secrets
git diff --cached --stat | tail -3
git diff --cached --name-only | grep -E "node_modules|\.next/|\.env$|\.zip$" \
  && echo "STOP — cruft staged" || echo "clean"

# 3. commit + push
git commit -m "Initial DGTL monorepo: platform (Next.js app) + publishing (journal, pitches, engine, brain)"
git push -u origin main
```

Expect a fast push — ~8 MB tracked, excluding gitignored `node_modules/` and `.next/`.

## Audit result (2026-07-25)

This tree is the **merge of two parallel migration builds**. `journal/`, `engine/`, `pitches/`,
`skill-mods/` and `tools/` were verified byte-identical across both before merging. The platform
migration, the hardened `.gitignore` and `MIGRATION.md` came from this build; the journal audit
fixes below came from the other.

Verified clean:

- **Link integrity** — `checked=740 missing=0`.
- **Secrets** — no live credential committed; only `.env.example` placeholder prose. Scanned for
  `sk_live`, `sk_test_*`, `ghp_*`, Twilio `AC*` SIDs, Resend `re_*`, AWS keys, private-key blocks.
- **Platform parity** — byte-identical to the origin working tree across all 520 files in
  `app/ components/ lib/ migrations/ tests/ scripts/ public/`.
- **Platform tests** — 356 tests, 351 pass: one *better* than origin (350). All 5 failures are
  pre-existing in both repos and network-dependent.
- **Bloat** — no committed `node_modules/`, `.next/`, `*.zip` or `.DS_Store`. No LFS required.

Journal fixes merged in from the parallel build:

- `packs/shane-boyer/` had **two** hub pages. The 2.4 MB inlined `hub.html` violated the
  shared-design-system rule and the standalone-is-a-build-artifact rule — but it was the only page
  linking the **DJI** and **YSL** spokes and the only home of the backlink kit. Resolved:
  `index.html` is canonical, the two missing spoke cards were added to it, the kit was extracted to
  `backlink-kit.md`, `hub.html` dropped.
- `a-day-with-swae-lee.html` was filed as a template example but is **live** (real canonical URL,
  linked from the publication hub). Moved to `journal/cases/`, paths re-depthed, its dead
  `peter-mckinnon.html` related-link repointed at the sorisa pack, 5 inbound references repaired,
  and `tools/check-links.py` extended to scan the new directory.
- `hasMedia` corrected to `false` on `burns-twins`, `dom-vallie`, `patrick-gillett` — all three
  declared media with empty dirs.
- `sources-partnerships.md` added to `shane-boyer`'s manifest as `additionalSources`.
- `_headers` (Netlify security headers) and the journal `README.md` carried over; both were missed
  by the first migration pass. The README is banner-marked pre-migration.

## Notes

- **No Git LFS.** Keep large binaries out of this repo and reference hosted URLs instead.
- **On `prototypes/` (~556 MB of rendered video and netlify builds):** it is not here, and — worth
  being precise — it was never tracked in `content-checkout-funnel` either. That repo's
  `.gitignore` has excluded it since before this migration, because it contains a 184 MB zip that
  exceeds GitHub's 100 MB file limit. The renders exist **only on the Mac, with no backup**. If
  they matter, they need a deliberate home (LFS in an archive repo, or object storage) rather than
  silence. See `brain/50-Audit-Log/53-Known-Issues.md`.
- `MIGRATION.md` records what moved, what did not, what is verified, and the open follow-ups.
  The build and the three previously-untracked tenant modules were reviewed on 2026-08-13. Current
  release-gate and Polish Stone content risks are recorded in `CLAUDE.md` and the brain.
