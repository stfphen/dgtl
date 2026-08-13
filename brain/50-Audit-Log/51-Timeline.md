---
title: 51 · Project Timeline
type: log
tags: [audit]
status: living
updated: 2026-08-13
---

# Project Timeline

Chronological history, reconstructed from repo docs + git. **Append newest entries at the top.**
Dates are from doc timestamps / commit themes; treat older "status" claims as point-in-time snapshots.

## 2026-08
- 2026-08-13 — **Full repository, branch, worktree and operating-platform audit completed.** The
  evidence and recommended target architecture are recorded in
  `docs/audits/2026-08-13-repository-and-platform-audit.md`. Consolidated tested local WIP into
  scoped commits: Worklog v2 (375/375 tests), creator-intake diagnostics (26/26 tests + PHP lint),
  DGTL Residency and Studios Maud pitches/audit, Piano Boutique's explicitly reconstructed findings
  ledger, DGTL Neon, the local ops automation spine, and a non-breaking Next 15 lock refresh. The
  publishing check improved from 19 to five root-absolute warnings and remains `missing=0`.
  Platform release confidence remains red: 351/356 tests pass and the five website-enrichment tests
  still fail under both restricted and network-permitted runs. **The migration build blocker is now
  cleared:** final `npm run build` on merged local `main` with Next 15.5.23 compiled, type-checked,
  generated 49/49 static pages, collected traces, and exited 0. Production dependency audit is down
  from eight advisories to three high advisories; the remaining npm-proposed fix is a breaking Next
  16 upgrade. The three formerly untracked tenant modules were reviewed: no credentials, two
  compatibility re-exports, but Polish Stone carries a `555` phone number and unproven commercial
  claims that require owner validation before publication. Integration then merged into local
  `main`; 17 fully merged local branches were deleted with `git branch -d`, stale rent-worktree
  metadata was pruned without deleting its branch, and both live worktrees were left clean after
  their remaining files were preserved in named stashes. No remote branch, PR, deployment, or push
  was changed.

- 2026-08-01 — **Creator-feature template un-rotted: new packs now validate clean without hand-editing paths.** The template still shipped pre-pack-model relative paths (`../assets/…`, `../index.html`, `../cases/…`) plus a related-card pointing at a `peter-mckinnon.html` that never existed — ~25 broken local refs in every pack built from it, each one hand-fixed after the fact. Fixed at both ends: the template is now authored at pack-hub depth (`../../_shared/…`), and `populate.py` gained `journal_depth()`/`reroot()` so a feature page one level deeper gets `../../../_shared/…` automatically. SKILL.md's path table is now true as written — the "shared CSS/JS" column is marked automatic, only the "own media" column is hand-written, and a feature-page populate example was added. Verified by building the example fields to both depths: `validate.py` → 9 ok / 1 warn (empty `og:image`, a fields-content placeholder) / **0 failures** at each, no manual path editing; `tools/check-links.py` → `checked=859 missing=0` (unchanged — it does not scan `engine/`, which is why this rotted unseen). [[53-Known-Issues]] · [[52-Decision-Log]]

## 2026-07
- 2026-07-28 — **VPS offboard consolidation** (branch `consolidate-vps`): audited `dgtl-offboard-20260721` against the monorepo. VPS app source = `fe2d78a` (nothing newer than `platform/`); decks rig identical. Imported the VPS-only material: 18 live pitch sites into `pitches/` (live-URL slugs kept; old escott draft → `escott-brand`; escott set documented as the portal-led pattern in `pitches/_templates/PORTAL-PATTERN.md`), deploy portal source → `deploy/portal/`, prod decks override, DGTL OS → `os/` (secrets stripped; folded into `apps/dgtl-os/` on 07-28 when the skill-integration branch landed with the 07-18 standalone-product layout — wiring notes now in `apps/dgtl-os/local/README.md`). assets.dgtlgroup.io confirmed stale → retired. Data/secrets remain only in the offline bundle. See MIGRATION.md addendum.

- **07-25 (c)** — **The last untracked work brought into `dgtl` as `apps/` and `sites/`.** Seven items
  existed *only* as untracked files in the retired archive — tracked in no repo at all. Now:
  `apps/dgtl-os/` (terminal.html + `api/` Cloudflare Worker + `local/` Mac server) and
  `sites/polishstone/` (13-page static site) + `sites/on-home-decor/seo-tracker.html`. Two new top-level
  surfaces because DGTL OS is a standalone product per the 07-18 decision and a client's static site is
  neither a pitch nor a tenant funnel; both had been homeless, which is why they were never committed.
  **`zilHu3WT` identified** — not mystery data, a 7.6 MB **zip** of the PolishStone site
  (`oakville-stone-tile/…`), same family as `polishstone-netlify-staging.zip`; both excluded as
  redundant build archives. PolishStone existed as **four** near-identical 7.9 MB copies; kept only the
  newest (`polishstone-site`, 21:30, vs 21:24/19:55/19:38) as the single source. Also de-duped an
  identical copy of the terminal inside `local/`.
  **Secret hygiene:** `dgtl-os-local/api-key.txt` was left behind deliberately — the product reads its
  key from that file and its own `.gitignore` forbids committing it. It currently holds only
  instructions, but the repo root `.gitignore` now carries `**/api-key.txt` so a real key can never
  land. Scan of everything new found one hit: the `sk-ant-xxxx…` placeholder in `.env.example`.
  `tools/check-links.py` now covers `sites/` too and is **scope-aware** about root-absolute links —
  a defect in `journal/`/`pitches/` (served from subfolders) but correct in `sites/` (each deploys at a
  domain root, and PolishStone's `404.html` legitimately uses them). 842 refs, `missing=0`; both
  positive and negative tests pass.
- **07-25 (b)** — **All pitches consolidated into `pitches/` on the pack model.** Six of the seven
  pitch artifacts were tracked in **no repo at all**: five sat under the gitignored `prototypes/pitches/`
  and THE CLIMB was a loose 344 KB file at the archive repo root. Now `pitches/<slug>/` with
  `index.html` + optional `teaser.html` + `media/` + `pitch.json`, registered in `pitches.index.json`:
  **escott** (concept, restructured via `git mv` to preserve history), **dmtv-bose** (client pitch —
  full became `index.html`, teaser beside it), **the-climb** (concept). The three generic
  "Your Brand × DGTL" offer pages (website overhaul, brand redesign kit, influencer activation) went to
  `pitches/_templates/` as clone-per-prospect starting points, not pitches. Deploy scheme
  `pitch.dgtlmedia.io/<slug>/`, confirmed from THE CLIMB's existing canonical tag.
  Fixes: the DMTV × Bose teaser's three "See the Full Pitch" buttons pointed at domain-absolute
  `/full/` — broken locally *and* under the `/<slug>/` scheme — now relative `index.html`; ESCOTT
  gained the meta description it lacked; ESCOTT's six `escott-media/` refs repointed after the folder
  rename. `tools/check-links.py` rewritten to cover `pitches/` as well as `journal/` (it previously
  watched only the journal, which is why none of this was caught), to flag root-absolute links as their
  own class, and to treat assets declared in a pitch's `pendingAssets` as *pending* rather than
  *missing* — so ESCOTT's three never-supplied photos are visible without leaving the check
  permanently red. Verified 746 refs, `missing=0`, and a negative test confirms it still fails on a
  real break.
- **07-25** — **Two parallel migration builds merged; this repo becomes authoritative and
  `content-checkout-funnel` is retired.** Two sessions had independently built a new-repo scaffold:
  `dgtl-repo-plan/dgtl` (publishing-only, prototypes via Git LFS, full app brain) and `dgtl-repo`
  (full consolidation incl. `platform/`, no LFS, hardened `.gitignore`, `MIGRATION.md`). Their
  `journal/`, `engine/`, `pitches/`, `skill-mods/` and `tools/` trees were verified **byte-identical**,
  so the merge was a scope decision rather than a content reconciliation. FAYELLA chose the
  consolidation architecture: **`stfphen/dgtl` supersedes `content-checkout-funnel` for all work**,
  publishing *and* platform. Merged in from the publishing build: the shane-boyer double-hub
  resolution (canonical `index.html` + DJI/YSL spoke cards recovered from the 2.4 MB inlined
  `hub.html`, backlink kit extracted to `backlink-kit.md`), the `a-day-with-swae-lee` relocation to
  `journal/cases/` with 5 inbound refs repaired, `hasMedia` corrections on three packs, and the
  `_headers` + journal `README.md` carry-over. `CLAUDE.md` rewritten for the consolidated goal:
  authority statement, the archive's two non-recoverable assets (~30 branches + PR #2, and
  `prototypes/`), the sellable-B2B-product framing, and **verify-the-migration-first** as the current
  priority ahead of the Funding Program build. `SETUP.md` gained the first-push commands and the merge
  audit result. Verified: link check **740/0**, secrets scan clean (all hits are prose about key
  prefixes), no committed `node_modules`/`.next`/zips/`.DS_Store`, no LFS needed — largest asset
  ~530 KB. **Nothing pushed yet:** blocked on stale git locks (below).
- **07-25** — **Stale `.git` locks found blocking both repos.** `dgtl-repo/.git/index.lock` +
  `HEAD.lock` (07-24 22:38) stranded this repo's bootstrap commit — `COMMIT_EDITMSG` shows the
  attempt was written but never landed, which is why `main` has **zero commits** despite a complete
  tree. Separately, `content-checkout-funnel/.git/index.lock` dates to **07-19 18:10** and has been
  blocking that repo for six days — it is the same lock the 07-19/07-20 auto-syncs reported, which is
  why the brain edits from those runs are still staged-but-uncommitted there. Third occurrence of this
  failure mode in this project; see [[53-Known-Issues]].
- **07-16 (auto-sync)** — **Overnight commit backlog logged.** Four commits landed *before* the 06:0x
  sweep recorded below (git locks were evidently cleared on the Mac; commits flowed 07-15 20:13 →
  07-16 06:36; tree now clean at `feature/platform-landing@61fd3bb`, branch unpushed):
  **`a1e65f5`** *feat(admin): DGTL reskin — shell, pipeline table + drawer, login, cross-tab polish* —
  the full refinement set from 07-12 (c–e)/07-13 (f–h) is now **committed**, closing the
  "uncommitted on the Mac" thread; **`0af5777`** *fix(store)*: **single-flight `ensureSchema`** — the
  admin page fires ~15 list queries via `Promise.all` and the old boolean-only guard let all of them
  run the CREATE/ALTER bootstrap concurrently → Postgres DDL deadlock; now memoized to one in-flight
  `bootstrapSchema()` promise, reset on failure so later requests retry (`lib/store.js`, +21);
  **`f9aaa71`** — the **entire previously-untracked `influence-journal/` microsite committed in one
  81-file commit** (hub, library, Peter McKinnon + Swae Lee flagships, full Shane Boyer partnership
  set + hub, **and** the Season-1 pages burns-twins/dom-vallie/patrick-gillett/season-1 — supersedes
  the "Shane set only, Season-1 later" plan in the 03:57 bullet below; ref
  `feature/dgtl-season1-creators` points here); **`0424b0b`** — **WIP snapshot** committing the rest
  of the untracked 07-12→07-15 work: `skills/dgtl-creator-features/`, `dgtl-deploy/` (blueprint +
  live-setup runbook + decks scaffold), the 07-14 brand-icon library + favicon/manifest/icon-route
  wiring, YouTube hero player + `lib/media/youtube.js` (+ new `tests/youtube-parser.test.js`),
  `dgtl-skill-mods/`, `docs/prompts/` (ref `feature/batch-email-sending` points here). Also on
  **`main`: `fe2d78a`** *feat(infra): make app.dgtlmedia.io the canonical host* — **pushed to
  `origin/main`** (twin ref `feature/app-dgtlmedia-domain`; ⚠️ deliberate `lib/defaultTenant.js`
  conflict with the platform branch — see [[53-Known-Issues]]). NOTE: `main` is registered as checked
  out in a second worktree (`.worktrees/app-domain`, created by another sandbox session) — don't prune
  blind; and a **live 0-byte `.git/index.lock` (06:36)** is again stranded, blocking the next git write
  until cleared on the Mac.
- **07-16** — **WIP sweep committed on `feature/platform-landing` (push pending from Mac — sandbox has no GitHub creds):** `f6c98f9` admin logo-only login, `b98226f` brain docs, `fb2ec8f` Escott pitch page, `b8554ec` **Traefik router fix — rule now includes `app.dgtlmedia.io`** (platform host previously 404'd at the proxy; DNS A record `app.dgtlmedia.io → [retired-vps]` still required). V2 repo git-initialized, `main` @ `94a6c93` (no remote yet). Sandbox gate: 45/51 suites → **334 tests, 333 pass**; single fail = `EPERM unlink data/app-store.json` (mount blocks deletes — passes locally); 6 network-bound enrichment/website suites excluded as before; `platform-template` 8/8. Local `npm test && npm run build` remains the pre-deploy hard gate. NOTE: sandbox couldn't delete git lockfiles — inert `*.orphan*`/`*.done*`/`tmp_obj_*` files stranded under `.git/` in both repos; safe to delete on the Mac.
- **07-16** — **ESCOTT prospect concept page built** (`pitches/escott/escott-concept.html`, single-file static). Brand-concept landing (not DGTL-styled) for a cannabis-operator prospect's family brand around his son "Lucas Jr.": youth Ride Line (dirt bikes/fishing, "Throw the phone back" hook from his own reference media) + adult ESCOTT Family Workwear line (pressed-leaf epoxy panels, numbered 50-piece batches, Jack Daniel's-style heritage positioning) with an explicit youth/adult separation wall (Cannabis Act youth-marketing compliance framed as brand structure). Photo slots auto-swap from `pitches/escott/escott-media/` (crew.jpg, throw-it-back.jpg, workwear.jpg — user must export from iMessage; uploads didn't persist). DGTL credit footer → Book a Call. Verified via Chrome injection (Playwright CDN blocked in sandbox): desktop 1512 + 390px iframe emulation, tag balance + external-request audit clean.
- **07-16** — **V2 repo (`~/Claude/Projects/content-checkout-funnel`): DGTL brand kit applied to all three tenant funnels** with per-tenant accent variations on the shared black/Manrope base — DGTL gold `#F0CF50`, Northbeat seafoam `#4FD1C5`, Meridian ice-blue `#7FADE3` (all `brandFgRgb` black). Implementation follows the V2 theming spec: a scoped `.funnel-dark` class in `app/globals.css` re-points the semantic tokens (`ink/muted/dim/surface/line/page`) + radii (`--r-control: 7px`, `--r-card: 16px`) inside the tenant layout only; accents stay in `lib/mock/tenants.ts` via `brandStyle()`. Admin + public home untouched (still light). Tenant components restyled (hero w/ accent-word headline + per-tenant spark watermark, glassy sticky header, package cards w/ hover lift, DGTL forms); Manrope `<link>` added in root layout. Gate: `npm run lint` ✓, `tsc --noEmit` ✓, `next build` ✓ (13/13 routes; sandbox needed a clean `@next/swc-linux-x64-gnu` reinstall — truncated binary caused silent SIGBUS exits). Desktop+mobile screenshots of all three funnels eyeballed against the kit checklist.
- **07-16** — **DGTL Growth Platform marketing funnel replaces Content Day on the canonical app host** —
  committed `e8b3166` on `feature/platform-landing`. New built-in tenant `dgtl-platform`
  (`lib/tenants/dgtlPlatform.js`) is the **sole claimant of `app.dgtlmedia.io`**; new `"platform"`
  template (`components/platform/*`, 5th registry entry) renders a marketing-first B2B-software page
  in the DGTL brand kit (black, gold `#F0CF50`, Manrope via `--font-manrope` preload:false): hero +
  verified agency stats, 18-logo white marquee (`public/assets/brand/logos/`, from the dgtl-brand-kit
  asset library), problem grid, six module pillars, gold pipeline-rail centerpiece, onboarding steps,
  live-funnel proof (`/t/dmtv-studio`, `/t/elixr`, `/t/on-home-decor`) + 400 Market case, FAQ, and a
  **Register access-request form → `/api/leads`** (`category: platform-registration`,
  `packageId: platform-access` — an honest `capture` package; self-serve signup stays Sprint-2).
  Content Day keeps `dgtlmag.com` + local dev hosts. **Root page gained host-resolved
  `generateMetadata`** (was titling every custom-domain tenant "Content Day").
  `tests/platform-template.test.js` (8 tests) locks passthrough, validation, tagging, roster slugs,
  logo assets, and **exclusive ownership of app.dgtlmedia.io**. Gate: 351/356 (5 sandbox-network
  fails in enrichment/website suites; core 30/30), compile clean; full local `npm test && npm run build`
  still required before deploy. ⚠️ Branch bases off `feature/batch-email-sending` tip and **supersedes
  `main@fe2d78a`'s `lib/defaultTenant.js` domain line — on merge, keep this branch's version** (see
  [[53-Known-Issues]]).
- **07-16** — **Admin login stripped to logo-only DGTL card** (`feature/platform-landing`). Removed the
  "Admin" eyebrow, "Content Funnel Control" h1, and marketing copy from `app/admin/login/page.jsx`;
  panel now shows only the centered DGTL wordmark (34px, gold bolt), email/password, and the gold
  sign-in button. Kept an `sr-only` h1 "Sign in to DGTL" for a11y (utility added to
  `app/admin/dgtl-admin.css` login section; dead eyebrow/h1/p rules removed). Auth flow untouched.
  Matches `docs/PLAN_ADMIN_LOGIN_BRANDING.md` step 3 (simplify content); the loginBrand tenant seam
  remains future work.
- **07-16** — **Shane Boyer brand-partnership feature set (5 pages) + hub — committed to `influence-journal/`.**
  Extended the microsite with five SEO features via the `dgtl-creator-features` skill:
  `creators/shane-boyer-{polaroid,ray-ban-meta,canada-goose,ysl,dji}.html`. Each is name-first
  (title/H1/slug/meta/first-paragraph/`alt`/`Person` schema), ships Article+Person+FAQ JSON-LD, and now
  carries a hero **plus 2 inline `figure.inline` body visuals plus a 6-tile gallery**, with outbound links
  to Shane's verified profiles and the **actual TikTok posts** (Polaroid `#PolaroidPartner` ×3, Ray-Ban
  Meta `#RayBanMetaPartner` ×2, Canada Goose `#partner` ×1). New verified facts added to `sameAs`:
  IG `@shaneboyer_` (~235K), YouTube `@MrShaneBoyer`. **Fact discipline:** YSL FW23 (as a discrete
  campaign) and the DJI partnership are flagged **client-asserted** in-page/sources — no public post or
  campaign fabricated. Pipeline per page: `<slug>.fields.json` → `scripts/populate.py` → `scripts/validate.py`
  (**all 10 ok · 0 fail**) → `scripts/make-standalone.py`. Cross-linked all five ⇄ the main
  `shane-boyer.html` profile ⇄ each other; added a **"Brand Partnerships" section** (6 cards) to
  `influence-journal/index.html` and repointed the main profile's related cards at the new pieces. Added a
  self-contained **hub** `creators/shane-boyer-hub.html` (all imagery inlined; links all six pages + a
  backlink kit + sources) and `creators/shane-boyer-partnerships.sources.md`. Per review feedback, the 2
  inline body figures per article use library images **not** already in that page's hero/gallery so they add
  new imagery rather than repeat. Committed the **Shane Boyer set + shared assets only** (css/js/logos +
  `index.html`) on `feature/batch-email-sending`; the other untracked Season-1 creator pages were left for a
  later commit. Follow-up for the skill itself (bake inline body-figure slots into the template/`populate.py`)
  must be done via **Settings → Capabilities** — the skill cache is read-only from a session.
- **07-15** — **DGTL Influence Journal launched + `dgtl-creator-features` skill authored** (both
  untracked/additive on `feature/batch-email-sending`; no app/tenant code touched). New **editorial
  microsite** `influence-journal/` (33 files): a publication hub (`index.html`) + two fully-populated
  flagship pieces — `creators/peter-mckinnon.html` (person-led profile) and
  `cases/a-day-with-swae-lee.html` (work-led case study) — a blank `{{TOKEN}}`
  `creator-feature-template.html`, and `library.html` = a **Creator Publication Kit of 20 reusable
  DGTL-branded blocks** (editorial / portfolio / social). Shared design system in
  `assets/dgtl-editorial.css` + `dgtl-blocks.css` (black + gold `#F0CF50` Manrope, real client-logo
  marquee), reveal/count-up/scrollspy JS, Netlify `_headers`. Real SEO baked in: per-page JSON-LD
  (`Article`/`Person`/`BreadcrumbList`/`FAQPage`, `VideoObject` on the case study), OG/Twitter meta,
  hub⇄article internal linking. Suggested deploy path `/journal/` on `pitch.dgtlmedia.io`. Paired with a
  new repo skill **`skills/dgtl-creator-features/`** (SKILL.md + references/scripts/examples/assets) that
  turns a creator name/link into a finished feature: research → screenshot real media (Chrome tools) →
  DGTL-voice + SEO copy → `fields.json` → `scripts/populate.py` (token + image injection) →
  `scripts/validate.py` (fails on leftover tokens, invalid JSON-LD, missing `alt`, or an H1 without the
  creator's name) → wire into the hub's backlink network. Engineered to **rank for the person's own
  name** + build a two-way backlink loop; hard fact-discipline (never fabricate stats/quotes/clients or
  "in the DGTL network"). See [[52-Decision-Log]]. **Not committed** — the stale `.git/*.lock` still
  blocks sandbox commits (see [[53-Known-Issues]]).
- **07-14 (b)** — **DGTL icons wired as the published default** (`feature/batch-email-sending`,
  additive — 5 files). Repointed the app's icon fallback chain to the new house set:
  `app/icon.svg` + `app/favicon.svg` swapped from the legacy "DM" / blue-camera marks to the gold
  spark; added `app/favicon.ico` (16/32/48). `app/branding/icon/route.js` no-custom-icon fallback now
  redirects to `/assets/brand/icons/apple-touch-icon.png` (was `/icon.svg` — **iOS ignores SVG
  apple-touch icons**, so the old default gave iPhones no home-screen icon). `app/manifest.webmanifest/route.js`
  fallback icons → DGTL PNGs (`icon-192/512` + `maskable-512`); `theme_color` fallback `#0071e3`→`#000000`;
  `background_color` `#ffffff`→`brand.backgroundColor || #000000`. **Multi-tenant override preserved** —
  tenants that set `brand.appIcon` are unchanged; only the house default moved to DGTL. Verified:
  `node --check` both routes, SVG/ICO well-formed, `tests/branding.test.js` 4/4 green. Full `next build`
  not run (exceeds sandbox exec window) — run `npm run build` locally before deploy.
- **07-14 (a)** — **DGTL brand app-icon library added** (`public/assets/brand/icons/`). New
  additive asset set built from the real DGTL marks (spark bolt + wordmark, gold locked to
  `#F0CF50`): **3 marks** (spark / DGTL monogram / wide wordmark) × **3 treatments** (black+gold
  signature, gold+black inverted, mono-white) = 12 SVG masters, plus a full multi-platform raster
  pack — `favicon.ico` (16/32/48), `apple-touch-icon` 180, PWA `icon-192/512` + `maskable-192/512`,
  PNG ladder 16→1024, `ios/AppIcon.appiconset` (+`Contents.json`), `android/` mipmap densities +
  adaptive fg/bg + `ic_launcher.xml` + play-store 512, `macos/DGTL.iconset` + `DGTL.icns`, sample
  `site.webmanifest`, `README.md`, and a self-contained `icons-preview.html` contact sheet. 115
  files; all PNGs verified (magic bytes + dims), gold sampled exactly `#F0CF50`. **Purely
  additive/untracked** — does NOT touch the per-tenant icon route (`app/branding/icon/route.js`) or
  the legacy `app/icon.svg` (README notes it as the swap-in when retiring the old "Content Day"
  mark, which still uses wrong-yellow `#E9C24A`). Built via the `dgtl-brand-kit` skill.
- **07-13 (h)** — **DGTL admin reskin — cross-tab POLISH pass.** After confirming every tab already
  inherits the dark+gold token treatment (no hardcoded-color breakage found, no charts), did a
  dedicated polish pass in `app/admin/dgtl-admin.css` for the tab-specific widgets: shared `admin-form`
  labels/inputs/hints/errors/checks (used by Outreach/Tenants/Prospecting/Funding); Outreach cards +
  `outreach-metrics` stat blocks + builder rows + `ui-empty` empty state; Tenants summary cards +
  `tenant-editor__section`/diff (before=strikethrough-muted, after=gold) + media-picker dropzone; Calls
  **dial pad** (real bug fixed — `.dialpad__key` used `var(--soft)` = #000 in dark, invisible → now
  `--surface-2` keys w/ gold hover) + `calls-table` DGTL table skin + destructive button styling;
  Prospecting batch/preview cards (were near-transparent → `--surface`); Accounts research groups; and a
  toast fix (`color:var(--white)` would've gone dark-on-dark inside the shell). Preview:
  `prototypes/dgtl-reskin/admin-tabs-preview.html`. All additive CSS, no markup changes. Still
  uncommitted on the Mac; drawer z-index bug (nav was z-1000) also fixed in (g).
- **07-13 (g)** — **Drawer glitch fixed (user screenshots).** The CSS-only lead drawer rendered broken:
  detail text collapsed to one char/line (the detail's own 2-col grid squished inside the narrow drawer)
  and the panel mispositioned (drawer z-index 60 sat under the nav's z-index:1000). Fixed in
  `dgtl-admin.css`: drawer/scrim/header z-index → 1100/1110/1120 (above the nav), detail forced to a
  single full-width column (`display:block`, contact-rows/facts to sane columns), and `name="lead-drawer"`
  added to the lead `<details>` in `page.jsx` so only one opens at a time.
- **07-13 (f)** — **DGTL admin reskin — lead detail DRAWER (CSS-only) + comprehensive rewrite finished.**
  The lead detail now opens as a right-side slide-over driven purely by the native `<details open>`
  state — `.lead-card[open] > summary` becomes the fixed drawer header (with a ✕), `> .lead-detail-grid`
  the fixed right panel over a `::before` scrim — all in `app/admin/dgtl-admin.css`, NO markup/JS change
  to the ~325-line detail block (LeadCallPanel/enrichment/research forms untouched). This resolves the
  drawer that (e) had deferred as risky. **Uncommitted refinements on top of `4d12dfe`** (all in the
  working tree, ready to commit on the Mac): the comprehensive POC-exact `app/admin/dgtl-admin.css`
  rewrite, `components/admin/AdminTabbedShell.jsx` shell restructure, `app/admin/login/page.jsx` reskin,
  and `app/admin/page.jsx` (navCounts/user props + `.lead-table-head`). Admin reskin is now
  feature-complete; next = build/test these on the Mac + a second commit.
- **07-13 (daily sync)** — **DGTL admin reskin base layer COMMITTED.** The first real commit of the
  reskin landed: `4d12dfe` *feat(admin): DGTL brand reskin (scoped token layer + Manrope)* (authored by
  FAYELLA on the Mac, 07-12 23:10) on `feature/batch-email-sending`, adding the two additive files
  `app/admin/dgtl-admin.css` (118 lines, token override layer) + `app/admin/layout.jsx` (26 lines, loads
  Manrope via next/font scoped over `/admin`). This is only the **Phase-1/2 base** (see 07-12 (b)); the
  later refinements — the comprehensive `dgtl-admin.css` rewrite, the `AdminTabbedShell.jsx` Phase-A
  shell restructure, the login reskin, and the lead-table head in `app/admin/page.jsx` (07-12 c–e) —
  remain **uncommitted in the working tree**. The stale `.git/index.lock` that had blocked commits since
  07-04 is now **gone** — commits are flowing again on the Mac (see [[53-Known-Issues]]). This sync also
  clears the backlog of 07-07→07-12 brain edits the lock had held up.
- **07-12 (e)** — **DGTL admin reskin — comprehensive stylesheet + Phase B/C.** User found the Phase-A
  light-override result "messy" (styles.css bled through). Fix: **rewrote `app/admin/dgtl-admin.css`
  as a comprehensive, POC-exact stylesheet** that fully owns the admin look (shell + pipeline
  components specified to the POC's values with `html .v2-admin-shell` specificity, no reliance on
  styles.css bleed). User confirmed the shell now looks right. Then Phase B/C safe wins: added a formal
  **lead table header** (`.lead-table-head`, additive markup in `page.jsx`) with the summary grid
  pinned to matching fixed columns → the lead list reads as a bordered data table (rows still native
  `<details>`, expand in place, all forms intact); reskinned the **login screen** (`app/admin/login/page.jsx`
  + CSS: DGTL wordmark, dark textured card, gold submit). Previews: `prototypes/dgtl-reskin/admin-live-preview.html`
  + `login-preview.html`. **Deferred (by design):** the true side-**drawer** for lead detail — it needs
  moving ~325 lines of interactive detail (LeadCallPanel, enrichment, research forms) into a client
  drawer, which is unsafe to do blind in-sandbox (can't compile; risks core lead tools). Recommended
  doing it as a focused, Mac-tested step. Not built/committed in-sandbox.
- **07-12 (d)** — **DGTL admin reskin — full-POC-match, Phase A (shell chrome).** User escalated from
  hybrid to a 1:1 POC match (markup restructure, not just tokens). Phase A edits `AdminTabbedShell.jsx`
  + `dgtl-admin.css` + one prop-passing line in `app/admin/page.jsx`: sidebar now has the DGTL wordmark
  (desktop-only), a "Workspace" label, nav count badges (quiet, gold on the active tab), and a user chip
  (avatar + name + role + theme + logout) pinned to the sidebar foot; the big header became a glassy
  sticky top bar (tab title + `· Admin` crumb + search) over a view-head (eyebrow + label + description).
  New shell props `navCounts`/`user` are optional with graceful fallbacks; page passes real counts
  (`leads`/`callbackTasks`/`tenants`/`outreachQueue`) + `session.user`. All desktop-only `display`
  rules are scoped INSIDE the `>=1024px` query so the mobile bottom-bar nav is untouched. Verified:
  JSX brackets/tags balanced, CSS braces balanced; static real-CSS preview rebuilt
  (`prototypes/dgtl-reskin/admin-live-preview.html`). Phase B (leads TABLE + detail DRAWER — user's
  pick — plus KPI deltas, funding callout cards, pagination) and Phase C (login + other tabs) still to
  come. Not built/committed in-sandbox (macOS SWC + FUSE limits) — validate on Mac.
- **07-12 (c)** — **DGTL admin reskin — hybrid upgrade pass (still CSS-only).** After previewing the
  token-only reskin against the real `styles.css`, user chose "hybrid": added high-impact POC elements
  to `app/admin/dgtl-admin.css` without any markup change — KPI metric cards as a DGTL grid with a gold
  hero number (`.v2-metrics-scroll` → grid; first `.v2-metric-count` = gold), a formal DGTL data-table
  skin (`.team-users-table`/`.metric-table`: `#2a2a2a` frame, `--surface-2` head row, `#1c1c1c` row
  hairlines, `#0f0f0f` hover, gold `.lead-score`), flat cards (killed soft shadows, hairlines carry
  structure), and a **control-radius fix** (the `--radius:16` for cards had over-rounded `.lead-filters`
  inputs that read `--radius` directly → controls pinned to `--radius-sm`/7px). Rebuilt the real-CSS
  live preview (`prototypes/dgtl-reskin/admin-live-preview.html`) showing the Lead Pipeline as a formal
  table. NOTE: the live app's Lead Pipeline is still expandable `.lead-card`s in markup — showing it as
  a table in the app needs a small `app/admin/page.jsx` change (offered, not yet done).
- **07-12 (b)** — **DGTL admin reskin — Phase 1–2 (admin only), additive + scoped.** Reskinned the
  admin shell + login to the DGTL identity (black + gold `#F0CF50`, Manrope) as **two NEW files**,
  zero edits to `styles.css`: `app/admin/dgtl-admin.css` (token override layer) + `app/admin/layout.jsx`
  (loads Manrope via next/font, imports the CSS, scoped over `/admin` + `/admin/login`). Approach:
  the app already themes via semantic vars, and the admin accent derives entirely from `--blue`, so
  overriding `--blue → gold` cascades to every derived accent token (active nav, focus ring, primary
  button, tints, bg vignette) automatically. Dark block repoints the primitive ladder to pure-black
  surfaces + `#2a2a2a` hairlines + `#F0F0F0/#8a8a8a` text; buttons get 7px / cards 16px via existing
  radius hooks; primary button text forced black on gold; `--info` kept blue, functional set → DGTL.
  **Tenant funnels untouched** (they never carry `.v2-admin-shell`/`.admin-login`) per the "admin only"
  decision. Preceded by a standalone POC at `prototypes/dgtl-reskin/admin-pipeline-poc.html` (passed
  27 brand/structural checks). Verified in-sandbox: CSS valid + DGTL checklist pass; unit suite 342/348
  (the 6 failures are sandbox-only — FUSE `unlink` EPERM + blocked outbound network, unrelated to the
  reskin). **NOT built/committed in-sandbox:** this Linux env has macOS SWC binaries (no linux SWC,
  network blocked) so `next build`/`dev` can't run; and the workspace FUSE mount blocks file deletion
  so git branch-switch/commit can't clear stale locks. Handed the user a branch+commit sequence to run
  on their Mac. Branch ref `feature/dgtl-admin-reskin` was created (points at `bf69c62`) but HEAD not
  switched. Stale `.git/HEAD.lock` + `.git/index.lock` (dated 07-04) present — must be `rm`'d on the Mac.
- **07-12** — **Domain tree + self-hosted deck deploy system planned & scaffolded** (`dgtl-deploy/`).
  Decision: keep the existing hand-managed Traefik as the single edge proxy; adopt Coolify as a
  Phase-2 control plane (maintenance window) rather than letting its bundled proxy fight the live
  app for 80/443. Designed the domain tree (hub `dgtlgroup.io`; `app.`/`api.`/`*` wildcard tenant
  subdomains; brand domains media/influence/mag; ops `deploy.`/`status.`) and wired decks into the
  funnel (deck slug = client slug = UTM campaign; CTA → `app.dgtlgroup.io/checkout`). Built a
  standalone `dgtl-decks` repo scaffold: nginx:alpine static host + Traefik labels
  (`traefik-public`, `websecure`, certresolver `letsencrypt`, priority 100) routing
  `(Host(dgtlgroup.io)||www) && PathPrefix(/pitch)` → `dgtlgroup.io/pitch/{client}`. Mirrors the
  app's GitHub-source-of-truth `deploy.sh` pattern; `new-deck.sh`/`build-index.sh`/`preview.sh`
  helpers. Verified in-sandbox: scripts lint clean, compose YAML valid, placeholders fill, served
  200 for decks+gallery / 404 for miss. Deliverables: blueprint + LIVE-SETUP-RUNBOOK. Phase 1
  (decks live) is zero-risk to `dgtlmag.com`; not yet executed on the VPS (awaiting user).
- **07-11 (f)** — **Tower v3: UX + Toronto realism pass** (user feedback: floors too sparse/dark,
  scroll not sticky, wants tap-to-advance; wants Google-Maps-grade city accuracy). Core: scroll
  magnet-snap to stage centers (debounced, never fights active scrolling), gold next-floor arrow
  button, lighter copy scrim, camera pulled closer with downward look, face mullions removed,
  brighter materials/fog/ambient fills, portrait-aware hero curves (CN Tower framed on mobile).
  Google 3D tiles ruled out (ToS forbids baking meshes; streaming needs API key + heavy) and
  Overpass/OSM unreachable from sandbox → hand-modeled real geography instead: CN Tower repositioned
  + LED strips at true 158u scale, Rogers Centre dome, financial-district landmarks (FCP, TD trio,
  Scotia, Commerce Court, Bay Adelaide, Brookfield, L Tower) at true relative positions with identity
  highlights. All 8 floors densified by sequential agents (parallel agents on the mounted folder
  silently lost writes — only first-in-batch landed; sequential fixed it): dolly track + lighting
  grid, code wall, creator set + vanity, war table + ticker band, gantry crane + welding sparks,
  L-conveyor + scan gate, lobby spark sculpture + elevator lanterns, rooftop fire table + bar.
  Suite: 26,479 tris / 1,614 meshes, all 18 modules pass harness; bundle 106 KB; zip 184 KB.
- **07-11 (e)** — **Real-time 3D "DGTL Tower — Toronto" built and swarm-detailed** at
  `prototypes/dgtl-scroll-world-3d/` (user pivoted the concept to an office tower in the Toronto
  skyline; no Higgsfield dependency). Core scroll-scrubbed Three.js engine (world3d.js: chrome +
  camera CatmullRom path + module registry with `build(ctx)->{group,animate(t,u)}` contract,
  proximity-reactive lighting) + 18 parallel subagents: 8 floor modules (lobby→rooftop, each ≤9k-tri
  budget, animated tallies/conveyors/tickers/string-lights) and 10 skyline modules (downtown core,
  detailed CN Tower w/ blinking aviation beacons, Rogers Centre + harbour wheel, background depth
  bands, midground fill, broadcast masts + night flight, Lake Ontario w/ cruising ferry, street grid
  w/ moving traffic, moon/stars/clouds, layered haze + hero-tower dust + exterior/plaza). All 18
  verified by headless budget harness (`spec/check_module.cjs`; repo-root ESM forced the .cjs): total
  17,774 tris / 1,098 meshes. esbuild bundle `app.min.js` 75 KB; deploy zip
  `prototypes/dgtl-tower-3d-netlify.zip` **174 KB** (vs 193 MB video build). Audit + plan at
  `spec/audit-plan.md`. Pending: live Chrome QA on deployed URL (camera framing tune).
- **07-11 (d)** — Higgsfield connector reconnected and re-verified: account STILL `free`/10 cr,
  0 transactions, generation refused ("Requires basic plan or higher") — trial fulfillment
  confirmed broken on Higgsfield's side. Next action is on the user: escalate to Higgsfield
  support/Discord with the receipt; do not re-pay. See [[53-Known-Issues]] +
  `prototypes/dgtl-scroll-world/spec/journey.md` NEXT STEP.
- **07-11 (c)** — **Procedural animated preview shipped (no Higgsfield needed):** all 8 flight legs
  rendered in-sandbox (`spec/preview_render.py`, PIL/numpy one-point-perspective gold-wireframe rooms,
  1080p/24fps/8s each) with frame-identical gold-wash seams (measured mean|diff| = 0.0 at all 7 seams),
  encoded to scrub spec (crf20 g8 + 720p g4 mobile siblings, 196 MB), posters regenerated from frames.
  Full Netlify zip rebuilt (`prototypes/dgtl-scroll-world-netlify.zip`, 193 MB, 27 entries). The page is
  now a complete working scroll-world; Higgsfield footage remains a drop-in file swap per journey.md.
- **07-11 (b)** — **Scroll-world generation pipeline switched to the Higgsfield MCP connector and
  checkpointed.** Sandbox allowlist is boot-fixed (CLI/API/upload/result-CDN all blocked; background
  procs killed between bash calls), so generation runs host-side via MCP; frame handoffs + result
  downloads go through the Chrome extension (canvas frame-extract → presigned PUT; one user drag for
  final mp4s). Costs preflighted: stills 7 cr (2k high), legs 72/36/28 cr (1080p std / 720p std /
  720p fast) → full run ≈ 632 cr + buffer. Account verified (Fayella / fayellamusic@gmail.com,
  free plan, 10 cr). **Blocked at checkpoint:** 3-day Plus trial (100 MCP-only credits) checkout
  completed via Apple Pay ($0 card-setup) but Higgsfield's `payment-success` page 404s and the trial
  never activated (plan free, transactions empty, trial_status pending); connector session then
  invalidated → needs reconnect + re-verify. Nothing generated, zero credits spent. Full resume
  runbook: `prototypes/dgtl-scroll-world/spec/journey.md` (NEXT STEP section).
- **07-11** — **DGTL "Walk the Studio" scroll-world directory page scaffolded** at
  `prototypes/dgtl-scroll-world/` (standalone, not wired into the app, not committed): scroll-scrubbed
  continuous camera flight through a photoreal black+gold DGTL studio — lobby + 6 department scenes
  (content, web/software, influencer/social, paid media, activations, DTC ecomm) + boardroom finale,
  each department linking out (currently the aesthetic-semolina Netlify pitch page). Engine
  (`scrub-engine.js`) + DGTL-themed `index.html` + placeholder stills working now; AI scene/video
  generation (Higgsfield, 8 stills + 8 sequential legs, architecture A, seedance_2_0, mobile-beta
  encodes) is specced in `spec/journey.md` + `spec/prompts.sh` + `spec/generate.sh` but **blocked in
  this session: sandbox network allowlist denies higgsfield.ai (fixed at boot; needs new session after
  widening network access)**. Ops gotchas (no surviving background procs → submit+poll; hf CLI via
  curl from GH releases) documented in journey.md.
- **07-09** — **Three generalized pitch-page templates built** at `prototypes/pitches/` (single-file
  HTML, not wired into the app, not committed): `pitch-influencer-activation.html` (influencer/UGC
  brand activation, organic + paid), `pitch-website-overhaul.html` (full website redesign + digital
  infrastructure modernization for legacy corporations), `pitch-brand-redesign-kit.html` (full
  rebrand + branding development kit incl. print/signage/NFC). All match the Modern Sense × DGTL
  reference pitch (dark/gold editorial style, numbered sections, pillar structure) and carry
  `data-slot` attributes + top-of-file manifests so the app can personalize them per prospect.
  Note: the Modern Sense pitch source itself is NOT in the repo (lives only on Netlify).
- **07-07** — **DGTLMag "Living Issue" BookShell concept prototyped.** New standalone single-file
  interactive prototype at `prototypes/dgtlmag-living-issue.html` (not wired into the app, no PR):
  closed-cover landing → 3D open animation → spine menu drawer, right-edge page tabs, contents
  spread as home, index-as-marketplace with live search, profiles-as-pages with marginalia actions
  (follow/save/share/feature), drops as loose inserts, back-cover submit form, bookmark ribbon +
  saved drawer, keyboard nav, mobile single-page fallback, faux URL chip showing the underlying
  `/profiles/*`-style routes. Fonts follow the design-direction set (Fraunces + Space Grotesk).
  Decision pending: whether this replaces the dgtlmag.com homepage (would be a new branch, not a
  revision of an existing PR).
- **07-04 (daily sync)** — Brain doc catch-up for the batch-email work: [[26-Outreach]] rewritten for
  the send engine/drip/signed unsubscribe, [[13-Data-Model]] gained migration 008, [[14-Routes-Map]]
  gained `queue/approve` + `/api/cron/outreach/drain` + the fixed unsubscribe row, [[00-Home]] status
  refreshed (branch `feature/batch-email-sending@33273d0`, prod = `main@32c9f73`, dgtl-group merged
  but undeployed). Dev-work bullets below were written in-flight by the day's commits.
- **07-04** — **Batch email sending BUILT (`feature/batch-email-sending`, off `main`).** Made outreach
  batch sending work end-to-end + added automations. **Shipped:** shared send engine
  `lib/outreach/sendQueue.js` (`sendApprovedItems`) that both the manual route and a new scheduled
  drain call; **claim CAS** (`claimOutreachQueueItem`, approved→sending) that closes the
  **double-send race** (audit open item); **dry-run/mock provider seam**
  (`lib/integrations/{emailProvider,mockEmailProvider}.js`, opt-in via `OUTREACH_DRY_RUN`/campaign
  `testMode`, never auto in prod — mirrors telephony); **scheduled sends** via token-authed
  `POST /api/cron/outreach/drain` (`OUTREACH_CRON_TOKEN`, host-cron trigger) over
  `listDueQueueItems`; **follow-up drip** (a sent intro schedules an approved `step=1` row the drain
  later sends; stop-checks on reply/booked/opt-out + eager cancel in the events route); the
  **queued→approved** transition + "Pending Approval" UI (queued items were dead-ends before);
  campaign UI for follow-up template / delay / test mode. **Compliance:** real signed
  (`lib/outreach/unsubscribe.js`) one-click unsubscribe link + `List-Unsubscribe` headers, and the
  **H4 fix** — `/api/unsubscribe` now requires a token and writes a **team/tenant-scoped**
  suppression (no more `tenant_id=NULL` global row). Migration **008** (campaign
  follow_up_template_id/follow_up_delay_days/test_mode + queue.step). New `scripts/seed-outreach-demo.js`
  (`npm run seed:outreach-demo`). **Verified:** 348/348 tests (14 new in `tests/outreach-send.test.js`),
  build clean; seed→dry-run send→drip→drain driven end-to-end in the file store. Left the hero WIP
  untouched. See [[26-Outreach]] / [[53-Known-Issues]].
- **07-04** — **DGTL Group agency page MERGED: `main` @ `4abc81f`** (fast-forward of
  `claude/dgtl-group-agency-page-87s280`, 5 commits). Local gate on the merged tip: 334/334 tests,
  clean build, `seed:tenants --only dgtl-group` upserted the row, all 7 tenant routes 200 (incl.
  the new `/t/dgtl-group`), compliance disclaimer verified in SSR HTML. **Not yet deployed to the
  VPS** — prod deploy needs the runbook + `--only dgtl-group` seed; dgtlgroup.io DNS still doesn't
  point at the platform. A parallel local implementation of the same brief exists on
  `feature/dgtl-group-page` (pushed, fully verified, PR never opened) — **superseded by this merge;
  do not also merge it** (same tenant id/slug/domains + registry/seed edits would collide).
- **07-04** — **DGTL Group agency page BUILT on `claude/dgtl-group-agency-page-87s280`: new tenant
  `dgtl-group` + fourth template `agency`.** The agency's own brand page at `/t/dgtl-group`
  (config `lib/tenants/dgtlGroup.js`, id `tenant_dgtl_group`, domains `dgtlgroup.io`/`www`), rendered
  by the new `components/agency/` template (`template: "agency"` in the registry; own
  `Agency.module.css` on isolated `--ag-*` vars — dark locked, gold `#F0CF50` single accent, Geist
  Mono numerals). Sections: hero (75+ campaigns / $1M+ revenue / 250M+ reach), Content Day offer
  ladder (canonical ids), verified results wall (Guild's Garage + DMTV numbers, artist/brand name
  marquee), white-label roster linking `/t/dmtv-studio` `/t/elixr` `/t/on-home-decor`, Growth
  Platform rail, compliance-safe funding band → `/t/funded-growth`, about, FAQ, Start-a-project +
  Join-DGTL forms. All 4 lead categories verified end-to-end tenant-scoped (`project-inquiry`+packageId,
  `funding-interest`+`funding-fit-scan`, `whitelabel-inquiry`, `team-application-<track>`+contactTitle).
  Gate: 333/333 tests, clean build, SSR + sibling regression green, desktop/390px screenshots.
  **Also fixed a real reduced-motion a11y bug in shared `components/motion/Reveal.jsx`/`Stagger.jsx`**
  (divergent client branch stranded the server's inline `opacity:0` after hydration — showcase +
  agency content was permanently invisible under `prefers-reduced-motion`; now same markup both
  modes with zero-duration transitions). No founder name printed (public "Will Giroux" vs internal
  "Stephen" unresolved). NOTE: the `new-tenant-page` skill referenced in the goal brief does not
  exist in-repo; substituted template-library-expander conventions + DMTV Studio precedent.
- **07-04** — **Template library MERGED + DEPLOYED: dgtlmag.com runs `main` @ `32c9f73`.**
  Fast-forward merge of `feature/template-library` (11 commits) after a full local gate (326/326
  tests, clean build, 22-tenant smoke matrix + 4 generated tenants all green on the mechanical
  pre-flight). Operator ran the runbook (backup → wipe-preserving-.env/uploads/backups → extract →
  build → migrate no-op → **no seeding**). **External smoke green:** `/`, `/t/dmtv`,
  `/t/dmtv-studio`, `/t/elixr` all 200; `/t/dmtv` still renders the fallback path
  (`data-direction="premium-agency"`, zero `--fp-*` inline vars — the zero-drift promise held);
  showcase content intact; new variant CSS (`package-compare`) confirmed in the compiled chunk.
  Feature branch pushed to origin for history.
- **07-03/04** — **Template & Asset Library BUILT on `feature/template-library`** (9 commits, executes the
  master prompt end-to-end). New: `lib/tenantBuilder/verticalPresets.js` (4 research-backed verticals:
  agency, pro-services B2B, SaaS/ecom, local/trades; closed key shape, **no default preset** — absence =
  pre-preset behavior) + `lib/tenantBuilder/sectionVariants.js` (closed variant registry: hero 3,
  packages 3, references 5; precedence explicit > preset > direction > default); `resolveDesign` composes
  both (preset wins sectionOrder). Funnel Hero/Packages/References extracted to
  `components/funnel/sections/` with per-section VARIANTS maps; 6 new compositions (comparison,
  single-offer, logo-wall, stat-band, case-strip, testimonial-editorial). **Third archetype `authority`**
  (`components/authority/`, long-form credibility page) registered in the template registry; themes via
  the same `--fp-*` tokens in module CSS. Generator accepts operator-chosen `verticalPreset` (never
  model-authored), injects copyFrames/proofPattern + tightened COPY_RULES (em-dash ban, eyebrow rationing,
  3-5-word hero headline); TenantBuilder gained a vertical picker (affinity pre-selects direction).
  Research: `docs/design-research/` (4 vertical notes + asset prompt sheet). Verified: 22-tenant smoke
  matrix (`scripts/seed-smoke-tenants.js`), mechanical pre-flight green, browser visual audit (fixes:
  tokenized `.portfolio-card`/`.testimonial`/`.package__badge`, authority output tiles, configurable
  checkout labels), showcase isolation proven (zero direction-token leak), **324/324 tests + build clean**;
  frozen `resolveDesign` snapshots prove zero drift for existing tenants.
- **07-03 (night)** — **DMTV Studio showcase MERGED + DEPLOYED: dgtlmag.com runs `main` @ `44ea917`.**
  Merged `claude/dmtv-website-redesign-7xlpzn` (`52a86e6`, cloud ultraplan build) into `main`
  (`5736377`; brain-doc conflicts resolved as chronological union), added `--only <slug,…>` to
  `scripts/seed-tenants.js` (`44ea917`) so prod seeding can add a tenant without overwriting
  Tenant-Editor edits on existing rows. 295/295 + build green on the merged tip. Operator ran the
  runbook (backup → wipe-preserving-.env/uploads/backups → extract → build → migrate no-op →
  `seed-tenants.js --only dmtv-studio`). **Smoke green:** `/`, `/t/dmtv`, `/t/dmtv-studio` all 200;
  showcase content + new-code marker (`youtube-resolve` 405) verified; visible package prices render
  single-`$` (the `$$` in the RSC flight payload is React's escaping for `$`-prefixed strings —
  documented here so nobody "fixes" it). Existing 5 tenant rows untouched.
- **07-03** — Authored **template-library master prompt** (`docs/prompts/template-library-master-prompt.md`)
  + companion skill (`.agents/skills/template-library-expander/`): phased, quality-gated plan to expand to a
  15-template matrix (3 archetypes × 5 directions), add `verticalPresets.js` + section-variant registry +
  vertical asset packs across 4 verticals (agency, pro-services B2B, SaaS/ecom, local/trades). Sourcing:
  original reference-informed only (white-label-safe). No code changes yet — build runs from the prompt.
- **07-03 (evening)** — **DEPLOYED: dgtlmag.com now runs `main` @ `44187af`** (YouTube hero feature +
  polish; operator ran scp + ssh with the pre-built clean bundle — first bundle to correctly
  **exclude `.env`/`.env.local`**, and **no `seed:tenants`** so Tenant-Editor edits on prod rows
  survive). Cutover watched externally: new-code marker (`/api/admin/media/youtube-resolve`)
  flipped 404→405 at 18:02 with zero downtime (site 200 throughout). **Post-deploy smoke green:**
  all 5 funnels + www/TLS + admin login 200; youtube-resolve returns 401 JSON unauthenticated;
  default funnel pixel-stable (0 `--fp-*` vars); hero image LCP intact. `YOUTUBE_API_KEY` verified
  locally (Data API path); operator to confirm it's in the VPS `.env`. → `docs/DEPLOY_NEXT.md`.
- **07-03 (later)** — **YouTube hero polish (`fix/youtube-hero-polish` → `main`).** (1) A playing video
  now **replaces** the hero image outright: iframe at full opacity, poster fades to 0 via a
  `data-video-playing` attribute the player stamps on the hero container (chose the attribute over
  `:has()` — Chrome 149 showed a dynamic-invalidation quirk, and attributes survive React re-renders
  + old Safari). Shade gradient stays for headline legibility. (2) **True cover scaling**: cq-unit CSS
  replaced by JS sizing (`coverSize()` in `lib/media/youtube.js`, unit-tested; ResizeObserver for
  rotation/mobile) that is **content-aspect-aware** — oEmbed dims are captured at resolve time into
  `heroVideo.aspect`, so 4:3 classics/verticals get YouTube's in-player bars cropped, not letterboxed
  (verified live: oEmbed reports 1.3333 for a 4:3 video). (3) **Hidden-tab bug fixed**: the playback
  watchdog now waits for `visibilitychange → visible` before its clock starts — previously a
  background-tab visitor would arrive to a killed video. (4) `YOUTUBE_API_KEY=` added to
  `.env.example`. 289/289 + build green; CSS/geometry verified in-browser (transition-free computed
  checks; window occlusion pauses transitions). **Correction to yesterday's note:** the "googlevideo
  blocked" diagnosis was wrong — the automation Chrome window was merely occluded
  (`visibilityState: hidden` pauses embeds/autoplay/transitions); nothing is blocked on this network.
- **07-03** — **DMTV Studio showcase page BUILT (`claude/dmtv-website-redesign-7xlpzn`).** A second,
  independent DMTV tenant (`dmtv-studio`, `lib/tenants/dmtvStudio.js`) rendered by a NEW bespoke
  template: `components/showcase/ShowcasePage.jsx` ("Broadcast Underground" — dark theme, DMTV
  yellow accent, Bricolage/Space Grotesk display, CSS module `Showcase.module.css`). Renderer
  selection is generic via a new top-level tenant config field `template` +
  `components/templates/registry.js` (fallback = funnel; `/t/dmtv` byte-identical, verified by
  screenshot). Sections per the DMTV team's brief: video hero (Underground Showcase loop via
  `YouTubeHeroPlayer`), packages scroll-snap carousel + inquiry strip, video wall, A Minute of
  Music (real reel links + submission form), live concert band, about, short-films strips, FAQ,
  brand partnering, team applications (SALES/PRODUCTION/CASTING). All four forms post to
  `/api/leads` tagged via `category`/`packageId`/`contactTitle` (live-verified: 4 leads landed
  tenant-scoped in the store). Real media: YouTube `T_xIf3tkGls` + `HrPVuOFeL2Y`, IG reels as
  designed link cards. **292/292 tests + build green** (6 new tests in
  `tests/tenant-template.test.js`). ⚠️ Sandbox blocked img.youtube.com/picsum so thumbnails
  need an eyeball check on an unblocked network; short-film strips use placeholder photography
  until the team supplies stills.
- **07-03** — **YouTube hero media SHIPPED (`feature/youtube-hero` → merged to `main`).** Tenant hero
  can now loop a **single video**, a **playlist in order**, or a **channel's uploads shuffled**
  (uploads playlist `UU…`, 200-item embed cap), configured in the Tenant Editor media slots:
  paste link → Detect (`/api/admin/media/youtube-resolve`; handles resolve via optional
  `YOUTUBE_API_KEY` or SSRF-guarded page fetch — live-verified against real YouTube incl.
  `@handle → UU…`) → video-vs-playlist choice for dual URLs → save via the audited edit-route
  media patch. Config: `media.heroVideo {url,kind,videoId,playlistId}` (sanitize coerces invalid
  to empty; media block now sanitized for the first time). Render: `YouTubeHeroPlayer` (IFrame API
  all kinds, reveal only on PLAYING, idle-deferred so the image stays LCP/poster, watchdog+onError
  → silent image fallback, reduced-motion = image only), wired into full-bleed (under the shade)
  and split hero variants; `.hero__video` cq-unit cover CSS. **286/286 tests + build green.**
  ⚠️ Verification note: this Mac's network/Chrome blocks googlevideo.com media delivery (even
  youtube.com itself can't play), so live playback could not be eyeballed locally — instead the
  blocked environment proved the graceful-degradation path end-to-end (player ready → no media →
  watchdog → image stays, zero errors). Playback needs an eyeball check on an unblocked network
  after deploy. Draft previews seeded: `/t/verify-yt-{video,playlist,channel}?preview=draft`.
- **07-03** — **REDEPLOYED: dgtlmag.com now runs `main` @ `14a746b`** — the consolidated tip is fully
  in production (security fixes C2/H1/H2/M1/M2, admin Dark Command-Center, funnel design control +
  media library). Pre-deploy: added the missing `./uploads:/app/public/uploads` compose mount
  (`14a746b`; standalone output snapshots `public/` at build time) with `chown 1000:1000` for the
  non-root `node` user; wipe now preserves `.env` + `uploads/` + `backups/`. VPS run clean end-to-end:
  DB backup → migration **007** applied → **seed:tenants 5/5** (the `upsertTenantConfig` slug fix
  proved out on the previously-colliding `on-home-decor`) → container recreated → local 200.
  **External smoke green:** all 5 funnels + `/admin/login` 200; hero via `/_next/image`; default funnel
  pixel-stable (0 `--fp-*` vars in served HTML). Note: `data-theme="dark"` only renders on the authed
  admin shell (`AdminTabbedShell`), not the login page — eyeball the dark command-center at next login.
  Remaining ops: C1 key rotation + H3 strong `POSTGRES_PASSWORD` (operator deferred, "later"),
  Stripe webhook registration, uptime monitor. → [[41-Deployment-Runbook]] · [[53-Known-Issues]].
- **07-02 (night)** — **DEPLOYED: dgtlmag.com now runs `main` @ `814f861`** (first production sync since
  the months-old snapshot — ships the UI overhaul, Portfolio P0, enterprise MVP, migration 006). Operator
  ran the tar-bundle sequence (runbook Path A; DB backed up first, `.env` preserved). Two failed attempts
  first: (1) `seed:tenants` hit `tenants_slug_key` — prod already had an `on-home-decor` row under a
  different id; **fixed in `lib/store.js` `upsertTenantConfig`** (PG path now resolves by `(team_id, slug)`
  before the id-keyed insert, matching file-store semantics; verified against a decoy collision on local
  pg; 208/208 + build) — and the `&&` chain meant `up -d --build` never ran; (2) second run's paste showed
  fully-cached layers + `curl` connection-reset, which was just boot timing. **External smoke green:** all
  5 tenant funnels + `/admin/login` 200, `www` 200/TLS, new-build hero via `/_next/image`, funded-growth
  funding markup, portfolio section correctly absent (no tenant populated). Unverified from outside:
  whether the VPS `seed:tenants` re-run used the fixed image (tenants render from built-ins either way).
  **VPS is one deploy behind current `main`** — the `716e5b2` redeploy (migrations 007, uploads volume)
  is the next ship. → [[41-Deployment-Runbook]] · `docs/DEPLOY_NEXT.md` · [[53-Known-Issues]].
- **07-02 (late)** — **Repo CONSOLIDATED: everything merged to `main` @ `716e5b2` and PUSHED; redeploy-ready.**
  Sequence: committed the audit tree's doc WIP + a chore commit tracking the taste-skill pack /
  audit docs / brand asset (root `.obsidian/` + `.claude/worktrees/` gitignored) → merged
  `audit/2026-07-02` (`718e472`, clean) → merged `feature/funnel-design-control` (`716e5b2`; only
  the two brain logs conflicted, resolved as chronological unions — styles.css/store.js/16-Design-System
  auto-merged). **Gates: 272/272 tests (208 base + 26 audit + 38 funnel), clean build, migration 007
  applied to local pg, runtime smoke green** (default funnel pixel-stable with 0 `--fp-*` vars, DB
  tenants render, dark-cinematic preview correct, admin login 200). Removed a stale clean `/tmp`
  deploy-main worktree (operator-approved) that was blocking the main checkout. `npm audit` = 2
  moderate, **accepted as L6** (postcss via next; no non-breaking fix). `docs/DEPLOY_NEXT.md`
  refreshed for `716e5b2` (migrations 006+007, seed:tenants, **`public/uploads` volume**, MEDIA_*
  vars, dark-first admin note). Remaining before/at redeploy: operator SSH deploy, C1/H3 rotations,
  H4 unsubscribe, pg dedupe parity; PR #2 (`origin/feature/prospect-enrichment-integration`) still
  open on GitHub. Historical `backup/*`/`wip/*`/`rescue/*` branches untouched per the 07-01 decision.
- **07-02** — **Funnel Design Control upgrade SHIPPED on `feature/funnel-design-control`** (per
  `docs/PROMPT_FUNNEL_DESIGN_CONTROL.md`; worked in an isolated worktree off `main` to avoid the
  admin-command-center WIP in the main tree). All four features: **(1) design directions** — 5
  data-driven token specs (`lib/tenantBuilder/designDirections.js`), `design` block in config,
  `--fp-*` CSS layer with per-literal fallbacks, FunnelPage section registry + hero variants
  (full-bleed/split/typographic), picker cards in TenantBuilder, 4 new `next/font` display faces
  (preload:false); **(2) tenant editing** — `lib/tenantBuilder/editTenant.js` (allowlist merge,
  clobber-proof via schema, defaultPackageId repair) + `configDiff.js`, `/api/admin/tenants/edit`
  (NL + deterministic patch modes, GET draft), TenantEditor panel (prompt box, changed-paths diff,
  per-section forms, direction switcher, publish/republish); **(3) copy limits** —
  `copyLimits.js` single table → schema maxLength/min-maxItems + advisory warnings (no truncation),
  SYSTEM_PROMPT rewritten (benefit-led, char budgets, no fabricated media URLs); **(4) media
  library** — migration `007_media_assets` (+ ensureSchema mirror + file-store branch), `lib/media/`
  local provider behind `getStorageProvider()`, magic-byte upload validation (no SVG, 10MB),
  `/api/admin/media` (POST/GET/DELETE + reference check), `mediaId` slots (hero/portfolio/logos)
  resolved server-side by `resolveTenantMediaConfig` in both public page routes, MediaPicker wired
  to every slot. **Verified:** `npm test` 246/246, `npm run build` green; dev-server render checks —
  all 5 direction previews show correct `data-direction`/hero variant/section order, mediaId hero
  resolves through next/image, default tenant renders with **zero** `--fp-*` vars (pixel-stable).
  Decisions in [[52-Decision-Log]]; docs: [[16-Design-System]] · [[14-Routes-Map]] ·
  [[2D-Portfolio-Media]] · [[43-Environment-Variables]]. **Merged to `main` 2026-07-02** together
  with `audit/2026-07-02` (this entry resolved as a chronological union in that merge).
- **07-02** — **Admin "Dark Command-Center" reskin Phases B–D shipped** (on `audit/2026-07-02`:
  `97f1252`, `35916a2`, `3e935bb`; the former uncommitted admin WIP is now committed). Admin-only —
  funnel + all contracts untouched, no logic/route/data changes. **Phase B:** admin is now
  **dark-first** (`useAdminTheme` defaults dark; toggle + light still work) with a deep
  command-center palette (`--bg #08080b` + accent tint, layered surfaces) and new accent/glow/
  elevation tokens (`--accent-fg/-tint/-line`, `--focus-glow`, `--glow`, `--card-grad`,
  `--card-shadow/-hi`) derived from `--blue` so any tenant accent works, AA. **Phase C:** bolder
  shell header + accent eyebrow, glowing sidebar active rail, KPI pills → elevated Geist-Mono metric
  cards. **Phase D:** panels/cards elevated (`--card-grad` + `--border-strong` + `--card-shadow`),
  inset inputs with glowing focus ring, uppercase table headers + row hover, hairline pill borders.
  SSR fix (`35916a2`): shell emits `data-theme="dark"` server-side so admin paints pre-JS (was
  hidden until the client resolved the theme; no hydration mismatch). Phase-A preview:
  `docs/specs/admin-command-center-preview.html`. Build clean + node tests green per commit;
  Phases C–D verified in-browser in **both dark + light** (elevated cards, glowing input focus,
  KPI header, readable pills); the **public funnel confirmed untouched** (no `.v2-admin-shell`, stays
  light, tenant accent `#C9A9A6` intact). ⚠️ Local dev-server was flaky — an environmental Next.js
  dev-tools/RSC bug (`segment-explorer-node`, cleared by a clean `.next`) + `output:standalone` vs
  `next start` mismatch + very slow hydration (cold loads need an interaction to reveal panels here;
  fine in prod). Build clean + `node --test` **234/234**. See [[16-Design-System]] / [[21-Admin-Shell]].
- **07-02** — **Full codebase audit + security fixes (branch `audit/2026-07-02`, off `195c143`).**
  Ran the `docs/prompts/codebase-audit.md` sweep with 10 parallel area auditors. Baseline was
  healthy: `npm test` 208/208, `npm run build` clean, SQL-injection surface clean, secrets never
  git-committed. **Fixed (all with tests; 234/234 green, build clean):**
  - **C2 SSRF** — new `lib/enrichment/ssrfGuard.js` (scheme allowlist + private/reserved/metadata
    IP block + per-redirect-hop revalidation via `safeFetch`); wired into `website.js`. See [[24-Enrichment]].
  - **H2 + cross-team lead IDOR** (broader than catalogued) — `getLeadById`/`updateLeadResearch`
    now take `{ teamId }` and filter on both backends; enrich/enrich-batch/research/fill-missing/
    research-from-query/funding-review routes all pass session team; enrich routes upgraded from
    bare `getAdminSession` to `requireRole`. New: cross-team `updateUserStatus` lockout closed
    (team-membership guard). See [[21-Admin-Shell]] / [[15-Multi-Tenancy]].
  - **M1/M2** — `sanitizePublicLeadInput()` whitelists public fields on `POST /api/leads` **and**
    `/api/checkout` (checkout had the same hole, uncatalogued); teamId/status/score/assignee no
    longer client-forgeable.
  - **H1** — in-process login rate limiter (`lib/rateLimit.js`, 10/min/IP) + bcrypt-timing
    equalizer on the user-miss path.
  - **Pipeline correctness (new)** — `updateLeadStatus` validates against `pipelineStatuses`
    (was silently corrupting/resetting); buying-committee promotion no longer collapses to one lead
    (email now distinguishes people in `shouldSkipReliableDuplicate`). See [[2C-Enterprise-Prospecting]].
  - **L1** — `permissionDeniedResponse` returns 401 JSON to fetch/XHR callers (redirect only for
    navigations); added admin `error.jsx`/`loading.jsx` boundaries.
  Open items written up in [[53-Known-Issues]] (M3 unsubscribe amplification, Stripe idempotency,
  file-store write race, DB indexes/dedupe parity, outreach double-send). Full report:
  `docs/audits/2026-07-02-codebase-audit.md`. C1/H3 (key rotation, DB password) remain ops-side.
- **07-02** — **Claude AI auth CONFIGURED (subscription path) — local + VPS.** Root cause of all
  AI features failing was simply no credentials: `aiMode()` was `"off"` everywhere. Minted a
  long-lived `CLAUDE_CODE_OAUTH_TOKEN` via `claude setup-token`; added to local `.env.local`
  (smoke-tested: `aiMode()` → `"subscription"`, real `generateJson` round-trip passed) and appended
  to the VPS `/opt/content-checkout-funnel/.env` by the operator over SSH, app container recreated.
  Deployed image verified subscription-capable (`@anthropic-ai/claude-agent-sdk` + musl build in
  node_modules, running as uid 1000 non-root). Prod smoke test (Deep Research in `/admin`) pending
  operator confirmation. See [[2B-AI-Backend]].
- **07-02** — **All five tenant funnels now live as DB rows.** Local `tenants` table previously held
  only `dgtlmag`/`dmtv`/`elixr`; added `fundedGrowthTenant` to `scripts/seed-tenants.js` and re-ran
  `npm run seed:tenants` — upserted all 5 (`dgtlmag`, `dmtv`, `elixr`, `on-home-decor`,
  `funded-growth`) into `team_default`. Verified each `/t/<slug>` renders its own branding from
  Postgres; `npm test` 208/208. In-code configs stay as seed source + fresh-DB fallback.
  ⚠️ Production (VPS) must re-run `npm run seed:tenants` at deploy for parity — see
  [[41-Deployment-Runbook]]. Catalog updated: [[63-Tenants-Catalog]].
- **07-02** — **`feature/portfolio-p0` MERGED to `main` (`a87a714`) and pushed (`be7babb`); deploy
  pending operator SSH.** The active line (UI overhaul Phases 0–5 + deferred-items pass + Portfolio P0 +
  AccountCard surfacing + brain/vault work) merged `--no-ff`; single conflict in this timeline resolved
  as a chronological union. Hard gate re-run **on the merged tip**: `npm test` 208/208 + `npm run build`
  green. `docs/DEPLOY_NEXT.md` refreshed for the new tip. Deploy blocked from the Mac: VPS
  `root@[retired-vps]` rejects key auth (password only — no key for it in `~/.ssh`), so the runbook
  sequence must be run interactively by the operator. Pre-verified: DNS `@`/`www` → `[retired-vps]` ✅,
  live site currently 200 on the old snapshot ✅. See [[41-Deployment-Runbook]] / `docs/DEPLOY_NEXT.md`.
- **07-02** — **Narrow-breakpoint QA of populated Pipeline/Calls PASSED — ui-overhaul before-merge
  checklist complete.** Recreated the iframe harness (temporary `public/qa-harness.html`, same-origin so
  the admin cookie flows; deleted after), reset the `qa-owner` login via `create-owner` upsert, and seeded
  12 leads + 10 calls into `qa-team` via a scratch script over `lib/store.js` (no calls seeder exists;
  `seed-funding-demo` hard-wires `team_default`). At 360/375/414: no horizontal document overflow on
  either tab (JS `scrollWidth` probe + screenshots); lead cards stack 1-col with ellipsis truncation and
  usable accordions; calls table stacks into `data-label` cards; Recording (play + Transcribe) and
  Outcome rows fit — the outcome `<select>` saves on change (no confirm-button crowding; Delete is
  owner-email-gated away). **No CSS changes needed.** Local migration 006 applied as a side effect
  (`npm run migrate`). → [[16-Design-System]] checklist closed; branch merge-ready.
- **07-02** — **Vault dashboard + product map added** (via the newly installed Obsidian skills):
  `00-Index/Vault-Dashboard.base` (Bases views over note frontmatter — living working set, stale radar
  grouped by status, modules, all-notes-by-folder, with a computed `days_stale`) and
  `00-Index/Product-Map.canvas` (JSON Canvas module map: acquisition → lead lifecycle → platform groups,
  file nodes linked to module notes, status-colored — green stable / yellow 2C MVP / orange 2D phased).
  Replaced the empty `Untitled.base`/`Untitled.canvas` strays. Home checklist now points to both; Home
  "status at a glance" refreshed to the `feature/portfolio-p0` active line; `01-How-To-Use-This-Vault`
  gained its missing `status: living`.
- **07-01 (late)** — **Repo CONSOLIDATED and PUSHED; deploy-ready.** `main` fast-forwarded from
  `83ea5d6` → **`cd0597e`** (enterprise-prospecting MVP + full UI/UX overhaul + brain syncs +
  funding-program docs merge) and **pushed to `origin/main`** — the delta since the last
  verified-green build (`13457df`, 202/202 tests) was proven docs/brain-only. Cleanup (conservative,
  per operator): full **all-refs backup bundle** at `~/content-funnel-backup-2026-07-01.bundle`;
  deleted 6 git-verified-merged branches (`integration/ui-overhaul`, `feature/ui-overhaul`,
  `feature/mobile-first`, `feature/per-tenant-app-icon`, `feat/enterprise-prospecting-mvp`,
  `feature/funding-program-docs`); removed the `funding-program-docs` worktree after merging;
  **kept** all `backup/*`/`*-wip`/`rescue/*`/divergent branches and all remotes.
  `feature/portfolio-p0` (active concurrent session) untouched — its portfolio work merges later.
  Deploy prep: `docs/DEPLOY_NEXT.md` records gate status, migration-006 requirement, new env vars
  (`SEC_EDGAR_USER_AGENT`, `OPENCORPORATES_API_TOKEN`), and the exact VPS sequence. Roadmap item 1
  (repo recovery) **done**; item 2 (sync VPS) is next. See [[31-Current-Priorities]] · [[41-Deployment-Runbook]].
- **07-01** — **Enterprise AccountCard: research + campaign-scope now surfaced (`8b550fe`, `feature/ui-overhaul`).** User flagged that the Accounts tab showed no UI connection to research/campaign scopes. Root cause = two things: (a) all demo accounts sat at `gate1_approved` (pre-research), so the gated research/scope UI hadn't triggered; and (b) a real gap — the card computed & persisted a full research dossier + a 9-field campaign concept but rendered only 3 (`name/budgetBand/bigIdea`). Fix (`components/admin/AccountsPanel.jsx`, pure render of existing round-tripped data — no new logic/routes): added a **Research summary** block (dossier `businessProfile.summary` + source/confidence/date/public-data note) and **expanded the campaign block** (status pill, deliverables list, budget + rationale, success metric, outreach opener). Verified in-browser on a scoped account in admin dark mode. Enterprise-prospecting data path confirmed intact: `account_campaigns` columns → `mapAccountCampaignRow` → panel props all carry the fields. [[2C-Enterprise-Prospecting]]
- **07-01** — **UI overhaul deferred-items pass STARTED on `feature/ui-overhaul`** (Phase-0 re-run: repo already had Phases 0–5 committed; user chose "finish the deferred items"). First surface done + verified in browser (light + admin-dark, non-default `on-home-decor` accent): **(1) found & fixed a real pre-existing dark-mode token bug** — the Phase-2 derived tokens (`--*-bg/-fg`, `--border-subtle/-strong`, `--fg-subtle`, `--hover-fill/-active-fill`, `--accent-band/-soft`) are `color-mix()` over `--surface/--fg/--border` but declared **only at `:root`**, so they baked in the LIGHT primitives and inherited into the dark shell unchanged (state banners/fills/bands rendered light-on-dark). Fix: re-declare the same expressions inside `.v2-admin-shell[data-theme="dark"]` so they re-resolve against the dark primitives (percentages nudged for dark legibility); light mode + brand contract untouched. This **corrects the earlier "auto-adapt in dark mode" claim** in [[16-Design-System]] / the 06-30 entry below. **(2) Funding review notice reposition** (the long-open deferred item): `.admin-notice` is now a **sticky (top:12px), dismissible** banner (accessible close button — `role=status`, aria-label, 40px hit target, focus-visible ring), tokenized via new `--info-bg/-fg/-border` (removed hardcoded `rgba(0,113,227,…)`). Commit `f3f7eef`; **build green, `node --test` 208/208**. **(3) Table/panel reskin — QA-first, `78970d9`:** a DOM-luminance audit of **all 8 admin tabs in dark mode** (plus visual spot-checks) found the token fix had already made tables/panels cohesive — **no blanket reskin needed**. Only two light-baked spots remained: `.research-pill--*` (hardcoded Tailwind emerald/amber/red hex → re-mapped to the adaptive `--success/-warn/-danger` trios; ~9 stray hex removed) and browser `-webkit-autofill` (pale-blue fill on dark inputs → dark-scope autofill override). QA harness notes: admin is DB-auth-gated (seeded a throwaway `qa-owner` owner + enterprise demo data into `qa-team`); browser window can't shrink below ~500px so narrow breakpoints are tested via a same-viewport **iframe harness** (media queries respond to iframe width); the automation tab drops intermittently. **(4) CSS consolidation — dead-code prune, `cdd529d`:** ran a PostCSS transform cross-referenced against all component/app/lib source (literal + dynamic `base--${x}` usage) to remove **66 fully-dead rules** (legacy `.v2-table*`/`.v2-cell-business`/`.v2-status-select`/`.v2-action-button`, an old `.tenant-builder__*` structure superseded by the current `__result/__warnings/__actions/__hint`, `.repeatable-list*`/`.package-editor*`, `.lead-table*`, and the never-wired-in `.ui-card/.ui-badge/.ui-eyebrow/.ui-display/.ui-skeleton/.ui-error` primitives) + **9 grouped rules trimmed** (16 dead selector-parts dropped, all live selectors kept) + emptied `@media` blocks. **styles.css 94,809 → 86,135 B (−8.7 kB; net −2.5 kB vs the 88.7 kB Phase-0 baseline** despite the dark-token + banner additions). Dead-code only (unused selectors can't affect rendering); build green, `node --test` 208/208, admin dark shell/panels verified intact in-browser. **(5) Admin code-split — `c3425aa`:** the six off-default-tab panels (`AccountsPanel`, `CallsTable`, `OutreachQueueBuilder`, `TenantBuilder`, `TenantBrandingSettings`, `TenantPhoneSettings`) now load via `next/dynamic({ssr:false})`. Because `AdminTabPanel` unmounts inactive tabs, their chunks fetch on tab-open, not first paint. `ssr:false` isn't allowed in the server admin page, so the wrappers live in a new **client module `components/admin/lazyPanels.jsx`** (fixed-height card fallback → no CLS). Pipeline-tab panels stay eager. **/admin first-load JS 169 kB → 151 kB (−18 kB); route-specific 26.9 kB → 9.16 kB.** Build green, 208/208; verified in-browser that Accounts + Tenants load their deferred chunks and render fully, nav intact. **This resolves the build-plan's "admin first-load JS unchanged" gap.** Remaining (not blocking): a narrow-breakpoint pass over *populated* Pipeline/Calls tables. See [[16-Design-System]].
- **07-01** — **Portfolio P0 (config + render) SHIPPED** on `feature/portfolio-p0` (branched from
  `feature/ui-overhaul`). Per-tenant `portfolio` + `references` config sections with empty-array defaults
  (`lib/defaultTenant.js`), per-item sanitization (`lib/tenantValidation.js`: `src`/`thumbnail`/`link`
  limited to root-relative or http(s) — protocol-relative `//` rejected; `mediaType` allowlisted
  image|video|embed; tags coerced to string arrays; unusable entries dropped) + 3 new `ARRAY_PATHS`
  entries. Funnel renders new `PortfolioSection`/`ReferencesSection` between output and packages **only
  when populated** — empty tenants fall back to the `output.tiles` grid unchanged (verified via an
  isolated `APP_STORE_PATH` dev run: populated tenant shows both sections in order with local images via
  `next/image` + responsive embed iframe; emptied tenant renders no new markup). Real headings/alt (not
  the `aria-hidden` tile pattern), Reveal/Stagger motion, mobile-first `min-width` CSS on semantic tokens.
  Tests **208/208** + build green (`tests/portfolio-config.test.js` added). Direct `src` only — the media
  library/`mediaId` indirection is P1 → [[2D-Portfolio-Media]].
- **07-01** — **Portfolio / references + media library DESIGNED (not built).** Planned a per-tenant funnel
  "Portfolio & References" section (real video/image case studies, client logos, testimonials, result
  metrics) that today has no equivalent — the funnel's `output` section renders only `aria-hidden`
  **text tiles** (`components/FunnelPage.jsx:270-283`). Operator chose: (1) a **real upload + team-scoped
  media library** (new `media_assets` table / migration `007`, storage-provider seam mirroring telephony,
  mock/URL-first with graceful degradation) with **assets referenced by `mediaId` — never inlined into
  `tenants.config`** to keep configs lean; (2) **AI-assisted selection** — extend [[2A-Tenant-Builder]]'s
  `TENANT_OUTPUT_SCHEMA` to pick relevant library assets by `industry`/`format` tags (retrieval of existing
  `mediaId`s, not fabricated URLs; human-approved via draft→publish); (3) a **plan-only** deliverable
  captured in the brain. New config sections `portfolio` + `references` + validation `ARRAY_PATHS` entries;
  new admin `MediaLibrary` + `FunnelContentEditor` (the first direct hero/media/copy editor — today copy is
  only AI-regenerated or JSON-imported). 5-phase additive rollout, gated behind repo stabilization. Flagged
  that the new upload surface amplifies open security gaps (SSRF C2, rate-limit H1, IDOR H2, type-sniffing).
  Plan of record: [[2D-Portfolio-Media]]. See [[52-Decision-Log]] · [[33-Sprint-2-Productization]].

## 2026-06
- **06-30** — **UI/UX overhaul prompt revised to add a Phase 0 preflight gate** (uncommitted working-tree change to `docs/prompts/ui-ux-overhaul.md`, on `feature/ui-overhaul`). The overhaul workflow now opens with **Phase 0 — Preflight / Repo-State Report**: before touching code the executor must inventory `git status`/`stash`/`log`/`diff`, bucket every change by effort (enterprise-prospecting, mobile, brain, this UI work) as committed/uncommitted/stashed, flag collisions on shared files (`styles.css`, `AdminTabbedShell.jsx`, `app/admin/page.jsx`), capture a build+test baseline, and recommend a safe starting branch — then stop for approval. Also strengthens guardrails: explicit "no app code until Phase 0 + 1 approved," all perf baselines re-anchored to the **Phase-0** numbers (was "Phase 1"), `git stash` added to the hard-stop list, and the Accounts tab folded into the surface inventory. Effectively documents the gate the already-shipped build followed. See [[16-Design-System]].
- **06-30** — **UI/UX overhaul executed end-to-end (Phases 0–5) on `feature/ui-overhaul`.** Approved to run all phases to completion (off a new `integration/ui-overhaul` that first **committed the enterprise-prospecting MVP** `87f94a6`, clearing the dirty-tree blocker). Shipped in small commits, **build + 202 tests green throughout**: (1) token foundation + `.ui-*` primitives — **implemented via `color-mix` over the semantic tokens** (state-color trios, `--surface-3`/`--fg-subtle`/`--border-subtle/-strong`, `--ring/--hover-fill/--active-fill/--overlay`, `--accent-band/-soft`), **not** a literal `--n0…--n950` ramp (that lived only in the throwaway preview/spec); new tokens auto-adapt in admin dark mode, brand tokens untouched; (2) admin shell editorial refinement (accent nav active + eyebrows); (3) admin component states (`RecordingButton` error note, `OutreachQueueBuilder` `.ui-empty`); (4) funnel + funding-widget cohesion (accent eyebrows on light sections, funding CTA `--on-blue`/`--danger`); (5) **perf headline — hero `<img>` (1.74 MB) → `next/image`**, taking funnel **Lighthouse desktop 86→100 (LCP 2.6s→0.7s), mobile 75→92 (LCP 15.7s→3.1s)**, CLS held at 0. **Honest gaps (need browser visual-regression QA before merge):** deep per-surface reskin of tables + remaining admin panels not exhaustive (they inherit tokens only); funding review-banner reposition not done; admin first-load JS unchanged (`next/dynamic` with SSR gave no cut — needs `ssr:false` client tab-panels, reverted); CSS consolidation deferred (foundation *added* ~6 kB → 88.7 kB). Final results recorded in `docs/specs/ui-overhaul-build-plan.md`. See [[16-Design-System]] · [[52-Decision-Log]].
- **06-29 (late)** — **UI/UX overhaul moved from proposal → BUILD; brain re-verified.** On branch `feature/ui-overhaul`, Phases 1–3 of the overhaul are now implemented (was "planning only" earlier today): **Phase 1** = audit + design language + throwaway preview (`docs/specs/ui-overhaul-audit.md`, `docs/specs/ui-preview.html`) and the Phase-1 gate **chose Direction C — "Editorial brand-forward"** ([[52-Decision-Log]]); **Phase 2** = token foundation + primitives per `docs/specs/ui-overhaul-build-plan.md` (see the corrected 06-30 entry above — implemented via `color-mix` over the semantic tokens, **not** the `--n0…--n950` ramp this line originally described); **Phase 3** = admin shell editorial refinement + admin component states (`OutreachQueueBuilder`, `RecordingButton`). **Typeface swapped to Geist + Geist Mono** (`app/layout.jsx` now imports `Geist`/`Geist_Mono`; `--font-display` aliases `--font-sans`) — replaces the prior Inter/Sora pairing. Per-tenant brand-token contract, admin-scoped dark mode, and mobile-first `min-width` pattern all preserved. (Funnel reskin + perf pass have since shipped — see the 06-30 entry above.) See [[16-Design-System]]. — **Enterprise-prospecting MVP is now COMMITTED** (`87f94a6`); the stale `.git/*.lock` files are gone and git ref ops work again, clearing two operational items in [[53-Known-Issues]]. Brain refreshed via the setup-project-brain skill (notes reconciled to current `feature/ui-overhaul` reality; stray empty `Untitled.*` Obsidian artifacts removed).
- **06-29** — **Full UI/UX + performance overhaul prompt engineered** (planning only — no app code): authored `docs/prompts/ui-ux-overhaul.md`, a gated multi-phase task-completion workflow to reskin the **entire** product (admin shell + all tabs/components + public funnel/checkout) to a modern-SaaS standard and cut CSS/bundle weight. Direction is **aesthetic-agnostic** (measurable quality bars; the executor proposes the look for human approval at the Phase-1 gate); **scope = admin + funnel**; **contracts preserved** — per-tenant brand tokens (`--blue/--accent`), admin-scoped dark mode, mobile-first `min-width` pattern, `next/font` Inter/Sora. Phases: audit + design language → token foundation → admin reskin → funnel reskin → perf pass, each behind an approval gate. Status **proposed**, gated behind repo stabilization ([[31-Current-Priorities]]). See [[16-Design-System]] · [[52-Decision-Log]].
- **06-29** — **Enterprise prospecting: REAL data sourcing wired** (was mock-only). New adapters `lib/integrations/secEdgar.js` (free, no key) + `lib/integrations/openCorporates.js` (token optional); `lib/enterpriseProspecting/sourcing.js` composes EDGAR + OpenCorporates + Google Places for **search** (deduped, fit-scored, **mock fallback**) and Apollo + Hunter + EDGAR-firmographics + Claude for **research** (Gate-1-gated). Search route now async/real; research action enriches real contacts. +10 tests (mocked fetch: adapter mapping, degradation, fallback) → **31 feature tests, full suite 201/202** (1 pre-existing EPERM). `.env.example` adds `SEC_EDGAR_USER_AGENT`, `OPENCORPORATES_API_TOKEN`. Outreach still manual/human-approved.
- **06-29** — **Enterprise prospecting (ABM) MVP BUILT** (working tree, on `main`; uncommitted — see Known Issues re: stale git lock). Account-based motion implemented end-to-end and runs offline with zero keys: migration 006 + team-scoped store CRUD (`target_accounts`, `account_campaigns`) with JSON-fallback parity; `lib/enterpriseProspecting/` (gate state machine, deterministic ICP fit-scoring/tiering, campaign-concept builder, mock sourcing, Gate-2→lead promotion); 3 API routes (`/api/admin/accounts{,/search,/action}`, all `requireRole` + team-scoped + audit-logged); Accounts admin tab (`AccountsPanel.jsx`); demo seed (`npm run seed:enterprise-demo`). **21 new tests pass; full suite 191/192** (the 1 fail is a pre-existing sandbox EPERM in `core.test.js`, unrelated). Ultra-reviewed by 3 parallel agents (security/guardrails/JSX); applied security hardening (team-context guards, import cap, tenant-access validation). Contacts feed the **existing human-approved** outreach — no auto-send. ⚠️ Run `npm run migrate` + `npm run build` on a real machine (sandbox lacks Linux SWC).
- **06-29** — **Enterprise prospecting (ABM) designed (not built):** authored an account-based motion for high-ticket creative campaigns targeting enterprise (1000+) + mid-market (200–1000). Deliverables: engineered master prompt (`docs/prompts/enterprise-prospecting-master-prompt.md`), strategy playbook (`docs/specs/enterprise-prospecting-playbook.md`), module design spec (`docs/specs/enterprise-prospecting-module-spec.md`), brain note [[2C-Enterprise-Prospecting]]. Extends Batch Builder + Deep Research + Outreach (no fork); proposes 2 tables (`target_accounts`, `account_campaigns`) + `leads.account_id`; **3 approval gates** before the human-approved queue. Sources = open DBs + Apollo/Hunter + SEO/intent; **LinkedIn no-scrape** (official API + manual only). Status **proposed** — gated behind repo stabilization ([[31-Current-Priorities]]).
- **06-29** — **Mobile funnel bugfix:** brandbar `Log in` button was stretching full-width and overflowing on phones (≤560px). Root cause: the global `.button { width:100% }` mobile rule (intended for stacked hero CTAs) also matched `.brandbar__login`. Fixed in `styles.css` by resetting `.brandbar__login` to `width:auto; flex:0 0 auto` inside the ≤560px query, and hiding the secondary tagline at ≤370px so the logo + login sit cleanly on one row.
- **06-27** — **ON Home Decor** onboarded as a built-in tenant: `onHomeDecorTenant` wired into `builtInTenants()` (`lib/store.js`) and the `npm run seed:tenants` list. Toronto/GTA interior-design + paint funnel migrated from a standalone Lovable site; `$200` *Curated Paint Selection* entry offer (`curated-paint-selection`) laddering up to room styling, kitchen/bath, and full-home renovation design. See [[63-Tenants-Catalog]].
- **06-27** — Added [[Architecture]] overview note (single-page map: components, tenant system, admin dashboard) under `10-Architecture/`; linked from [[10-Architecture-MOC]].
- **06-27** — 🧠 Built this Obsidian knowledge vault (`brain/`) consolidating all project context.
- **~06-26** — **Mobile-first UI overhaul** merged to `main` (audit U1–U5): bottom nav capped at ≤5 + "More" sheet, admin tables → stacked cards, advanced lead fields collapsed, funding review checklist pinned, funnel grids mobile-first with `minmax` guards. Phase 1 audit → `docs/specs/mobile-audit.md`.
- **~06-25** — Telephony deepening: Calls-tab dialpad for ad-hoc calls; **owner-gated call delete** (email-gated to `stephen@dgtlgroup.io`); in-app **Deepgram transcription + Claude summary** (no Twilio CI dependency) with manual Transcribe button; authenticated recording proxy so Twilio recordings play in-browser; Twilio Conversational Intelligence + Claude summaries.
- **~06-24/25** — Telephony foundation: **mock provider + simulated call lifecycle**, real recording + consent webhook, recording player UI. Provider seam (`getProvider`) for twilio/telnyx/mock.
- **06-22** — Dockerfile updated (non-root node user so the Claude Agent SDK CLI works in-container).
- **06-21** — **Go-live progress (RESUME_HERE):** Live **502 fixed** — root cause Next.js 15 bound to container-id hostname instead of `0.0.0.0`; fixed via `HOSTNAME=0.0.0.0` in `docker-compose.yml`; site returns 200. GitHub set as source of truth (`origin/main`). Branch hygiene: 9 local + 7 remote merged branches pruned (recoverable bundle kept). Diagnosed VPS running a months-old snapshot (`9e11b81`) with no unique work — ready to fast-forward.
- **06-20** — **Go-Live Plan authored** (12 phases). Branding: per-tenant app icon + DM lightning default. `.env.example` expanded.
- **06-18** — **PROJECT_STATUS snapshot:** `main` stable with PR #2 (AI prospect enrichment) merged. `feature/funding-program-v1` adds Funding Program V1 + real Stripe checkout, verified on local Postgres (**101/101 tests**, clean build). Worktree cleanup: removed 10 redundant enrichment worktrees/branches (backup retained). Production status observed: DNS/TLS healthy but `https://dgtlmag.com/` returning **502** (app container down).
- **06-17** — Demo flow documented. Funding admin engine ported from `project-worker-2`.
- **~06-09 to 06-16** — Project foundation: Next.js SaaS scaffold, tenant funnels, admin login, lead pipeline V1, prospecting batch builder, outreach sequence V1, CSV import, migrations 001–005, Docker/Traefik setup, design-system reskin (Inter/Sora + framer-motion).

- **07-15** — **DGTL Season 1, Phase 1 — creator features built.** Ran the `dgtl-creator-features` skill for the first three Influence Journal Season 1 profiles: **Dom Vallie** (`creators/dom-vallie.html`), **The Burns Twins** (`creators/burns-twins.html`, one shared duo page), **Patrick Gillett** of Down with Webster (`creators/patrick-gillett.html`). Each: verified research + `.fields.json` → `populate.py` → validate (all **10 ok · 0 fail**) → `.standalone.html` deploy artifact → `.sources.md`. Real hero + gallery imagery via official YouTube/VEVO thumbnails (oEmbed source). Added three "DGTL Season 1" cards to `influence-journal/index.html`. Corrected name spelling to **Gillett** (two t's). Then added a **Season 1 creator index/hub** (`creators/season-1.html` + standalone) listing all three with links, cross-linked hub ⇄ each profile, and linked the main journal index to it (CollectionPage + ItemList schema).

## How to read the snapshots
PROJECT_STATUS (06-18) and RESUME_HERE (06-21) reference branches (`feature/funding-program-v1`,
`project-worker-2`) that have since been merged/superseded — current `main` already contains funding +
Stripe + telephony + mobile-first. Always re-confirm with `git log` ([[47-Git-Workflow]]).

Up: [[50-Audit-Log-MOC]]

- 2026-07-17 — Built 5a1ive (@5a1ive / 55555stuff) DGTL Influence Journal feature cluster: main profile hub + 3 articles (crystal G-Shock craft, wire-wrapped eyewear, worn-by-the-scene). Real media screenshot-captured from 55555stuff.com, cross-linked, hub added to index, validated (0 failures), standalone deploy files built. See creators/5a1ive*.html + 5a1ive.sources.md.

- 2026-07-17 — Built Sorisa DGTL Influence Journal feature cluster: main profile (`creators/sorisa.html`) + 3 articles (`cases/sorisa-the-rise`, `sorisa-rolling-loud`, `sorisa-lees-palace-dom-corleo`). 16-yr-old Toronto electropop breakout (brokeboyhappy → Atlantic Records, Feldman Agency, Rolling Loud Orlando, sold-out Lee's Palace). Facts verified via Wikipedia/Billboard Canada/CBC; the Sept 23 2025 Dom Corleo/Lee's Palace night (Freem on bill; Yves + Wake Taylor in crowd) is DGTL primary coverage. Media = gradient placeholders per user (real archive to be swapped later). Featured on hub, cross-linked, validated (0 failures), standalones built. See creators/sorisa.sources.md + sorisa.backlink-kit.md.

- 2026-08-01 — Built **Casper** (`@caspertheghos7`) Influence Journal pack — `journal/packs/casper/` (hub only, no feature pages). Started from a prior `dgtl-creator-features` capture sitting outside the repo at `~/Downloads/dgtl-influence-journal/creators/casper/`, whose `feature.json` was `status: assets_only` — raw media, **zero** researched facts. Extracted the 13 JPEGs out of `casper-media.bundle` (JSON manifest line + concatenated blobs, hence the earlier "not valid UTF-8 JSON"), then researched from scratch: resolved the IG shortcodes to recover the handle, then the profile for 162K followers, Toronto base, the `@casperthefriendlytattooer` second account, MXDVS, `GHOST20`. Validate 10 ok · 0 fail; `check-links.py` `checked=894 missing=0`. Also added `deploy/journal/` (nginx-on-Coolify static host for `dgtlinfluence.com`, mirrors `deploy/decks/`). Pack is `draft`, not `live` — Casper has not been contacted. See `journal/packs/casper/sources.md`.

- **2026-08-01** — **`dgtlinfluence.com` live** — Influence Journal deployed via `deploy/journal/` (nginx container on the Coolify proxy, `docker compose up -d --build` from `/opt/dgtl/deploy/journal`; no Coolify dashboard resource needed). LetsEncrypt cert `CN=dgtlinfluence.com` issued. Verified: apex + `www` return 200 with ETag matching the container, `dgtlmag.com` (307) and `pitch.dgtlmag.com` (200) unaffected. The apparent "site isn't live" was a stale resolver cache — the parked A record had a ~4h TTL, while the authority and 8.8.8.8/1.1.1.1 all already returned the new IP.
- **2026-08-01** — **Stale VPS IP swept out of the deploy + ops docs.** The live VPS is **`37.27.198.189`** (Hetzner, host `DGTLapps`, Coolify edge, `coolify` network); the docs still told you to deploy to **`[retired-vps]`** (Hostinger) in ~20 places, despite `64-External-Services.md` already recording that box as offboarded 2026-07-21 — which is how a deploy got aimed at the wrong IP. Fixed the current-state docs (`40-Operations-MOC`, `41-Deployment-Runbook`, `42-Go-Live-Plan`, `44-Secrets`, `43-Environment-Variables`, `02-Glossary`, `00-Home`, `64-External-Services`, `deploy/decks/README.md`, `deploy/journal/README.md`) and put **SUPERSEDED banners** on `deploy/LIVE-SETUP-RUNBOOK.md` and `deploy/DGTL-Domain-and-Deploy-Blueprint.md` rather than find-and-replacing IPs into documents whose whole premise (`dgtlmedia.io`, hand-managed Traefik on `traefik-public`) is dead. Audit-log history left untouched. **Found in passing:** the `GOOGLE_PLACES_API_KEY` IP allowlist still names `[retired-vps]`, so Places prospecting fails from production until it is repointed — flagged in all four notes that mention it.
- 2026-08-03 — Built the **DGTL Creator & Brand Intake** system (`apps/creator-intake/`) from the council-verdict build brief: five-step resumable application (one record, creator/brand branching), magic-link resume, direct-to-R2 presigned uploads (hand-rolled SigV4, proven against AWS doc vectors), PHP+MySQL backend targeting the **Hostinger shared plan** at `join.dgtlinfluence.com`, PHP-rendered admin review queue (approve / reject / request-more, export JSON), and brand-kit front-end (landing, apply, thanks + pending badge, terms). Journal side: `pack.json` enriched across all 7 packs (canonicalUrl backfilled), `tools/build-roster.py` → `journal/roster.html` (first manifest-driven page; drafts excluded), creator-feature template gained the rel="me" + dofollow Official-links block, and `engine/dgtl-creator-features/scripts/intake-to-pack.py` bridges the admin export into a pack skeleton with a hard TODO editorial gate. Verified: 26 unit tests, HTTP smoke all green, `check-links.py missing=0`, roster `--check` current, browser pass at desktop + 390px. Deploy runbook in `apps/creator-intake/README.md`; provisioning (DNS/MySQL/mailbox/R2/.env) is the remaining launch work.

- 2026-08-03 — **Creator intake deployed to staging** on the Hostinger shared plan (Business) at `mediumaquamarine-jellyfish-271195.hostingersite.com` — temp domain because `dgtlinfluence.com`'s zone lives in the other Hostinger account. Deployed via File Manager (SSH still `nologin` on u111775448 — retry or support-chat later; `deploy.sh` now takes a domain arg). MySQL `u111775448_join_dgtl` live, `.env` above webroot, `.htaccess`/headers verified, TRUST_XFF=1 for the un-disableable temp-domain CDN, mailer degrades gracefully with SMTP unconfigured. Full curl smoke against production: draft→saves→409→submit→immutable, all green. Deferred: mailbox (other account), R2 uploads, cron, domain cutover to `join.dgtlinfluence.com`.

- 2026-08-04 — **Fleet prep for the ten new `dgtl.*` domains** (blocked ~96h by the registration/account-move lock): wrote one `/dgtl-brand-kit` placeholder-site brief per domain in `sites/_briefs/` (shared rules in its README; agents build into `sites/<slug>/` on `feat/site-<slug>` branches, honesty constraint — no invented business facts); built the **deploy pipeline** `.github/workflows/deploy-sites.yml` (subtree-splits every `sites/<name>/` + `apps/creator-intake/site/` into `deploy/…` branches; Hostinger per-site Git deployment pulls via webhook — runbook in `sites/_briefs/DEPLOY-PIPELINE.md`); wrote the fleet inventory `brain/60-Reference/65-Domain-Fleet.md`. Surfaced from the Aug-2 architecture map: **dgtlmag.com expires 2026-08-28 with auto-renew OFF** (also off: dgtlinfluence.com, on-homedecor.com, dgtlneon.com) — flagged to Stephen as fix-today. Purged the retired VPS IP repo-wide to `[retired-vps]` per Stephen's instruction.

- 2026-08-04 — **Placeholder fleet built: all ten `dgtl.*` landing pages shipped as PRs #13–#22** via a 10-agent workflow swarm (one worktree-isolated agent per `sites/_briefs/` brief, ~750k tokens, ~4.5 min wall clock, zero failures). Each PR carries exactly `sites/<slug>/{index.html, assets/logo-white-gold.svg, assets/spark.svg}` on its `feat/site-<slug>` branch: inlined `dgtl-tokens.css`, Manrope the only external request, brief-verbatim hero headlines with a single gold accent, the brief's supporting-band variant (property index + statband on dgtl-ltd; roster proof row + client-logo marquee on dgtl-gallery; instruction bands on pics/mov/report; teaser bands on chat/rent/college; redirect band on dgtl-at), full SEO head + WebSite/Organization JSON-LD, honesty constraint held (no invented facts). Every agent ran `check-links.py` → `missing=0` (pending=3 / root_absolute=19 are the pre-existing pitches/ items). Browser spot-check passed on dgtl-ltd (1512 + 390), dgtl-gallery and dgtl-chat; full per-site 1512/390 screenshot pass is flagged as pending in each PR body. Next: merge the PRs → `deploy-sites.yml` cuts the `deploy/site-<slug>` branches → one-time hPanel GIT hookup per domain once the registration lock clears.

- 2026-08-04 — **Internal ops node harness scaffolded under new top-level `ops/`** (import-ready, not yet run): `ops/n8n/dgtl-agency-spine.json` — the agency workflow spine (form intake → `dgtl-client-audit` → parallel ComfyUI brand-plate render → merge → `dgtl-pitch-composer` → `dgtl-pitch-teasers` → `tools/check-links.py` gate → stage into `deploy/decks/site/pitch/<slug>/` → **disabled** VPS-deploy human gate → live URL `pitch.dgtlmag.com/<slug>/`; plus a monthly `dgtl-client-reports` schedule trigger). Claude skills are invoked via `claude -p` Execute Command nodes — n8n sequences, Claude Code is the agent harness. Plus three ComfyUI UI-importable templates in `ops/comfyui/` (SDXL brand plate 1920×1088 black+gold, 4x-UltraSharp upscale, SVD b-roll i2v). All JSON validated (syntax + n8n connection graph + ComfyUI link arrays). Known gaps flagged in `ops/README.md`: audit-PDF pickup is a NoOp placeholder, upscale/b-roll not yet wired into the spine, fixed 60s render wait. Stack decision context: n8n chosen for internal ops only (Sustainable Use License allows internal use, forbids resale); DGTL OS product canvas stays React Flow per `DGTL-OS-Stack-Decision.md`.
  - **v2 same day:** spine hardened after first import — render wait became a real poll loop (`/history` + IF + loop-back), audit-PDF locator (`find` by slug), render-filename extraction feeding the composer prompt, link-check failure branch + macOS osascript notifications (done / failed / reports ready), HTTP retries, `executeOnce` on all post-merge nodes, sticky-note documentation on the canvas. Diagnosed Stephen's "?" nodes: he imported into **n8n Cloud**, which has no Execute Command node — the spine is Mac-local by design (`npx n8n`); noted in `ops/README.md`.

- 2026-08-04 — **DGTL Neon site landed as [PR #23](https://github.com/stfphen/dgtl/pull/23)** (`feature/dgtlneon-site`, one commit off `origin/main` @ f375443): `sites/dgtlneon/` — single-file black+gold funnel for dgtlneon.com (custom commercial neon as a DGTL product line, plus event rentals and corporate workshops) with a research-brief README. Built in a separate local-agent session and handed off as a `git format-patch` package; patch applied clean via `git am`, HTML security-scanned (one inline script, no external JS, no fetch/XHR; external hosts limited to Squarespace CDN portfolio images + Google Fonts + DGTL/social links), `check-links.py` → `missing=0`. Content is licensed white-label from Fuse Neon + Neon Fun Club, rewritten first-party, no partner names on-page. Follow-ups tracked in the PR: re-host portfolio images at deploy, wire the quote form to an endpoint, dgtlneon.com DNS hookup.

- 2026-08-04 — **Creator intake gained a live self-check: `/admin/status.php`** (`apps/creator-intake/site/admin/status.php` + `site/lib/diagnostics.php`), built after Stephen reported that submissions at **dgtl.press** may not be reaching the database and were definitely not emailing him. Discovered in the process that the app is **deployed at `dgtl.press`** while the README, `deploy.sh` default and every canonical/OG tag in `site/*.html` still say `join.dgtlinfluence.com` — which matters beyond cosmetics, because `require_json_post()` rejects any browser call whose Origin host ≠ `APP_URL`'s host with `403 bad_origin`, killing every draft save and submit before a row is written. The status page reports, live and without SSH: `APP_ENV` (the one setting that silently swaps MySQL for the dev SQLite file *and* diverts mail to `dev-mail/*.eml`), APP_URL-vs-served-host, the driver + database name actually being written to, an INSERT/DELETE write probe, schema presence, TOKEN_PEPPER/TERMS_VERSION, a real TLS+`AUTH LOGIN` SMTP probe, `ADMIN_NOTIFY_EMAIL`, R2, admin creds, cron freshness — plus submission stats (status/type counts, 24h/7d/30d, 30-day started-vs-submitted sparkline, drafts-stalled-by-step) and the last 20 audit rows. Also: `smtp_submit()` now records the exact failing SMTP stage via `mail_last_error()` instead of returning a bare `false` into the error log, a CSRF-guarded "send test email" button exercises the real mail path, and the queue page carries headline counts. Verified: 26/26 unit tests pass, `php -l` clean across all 35 PHP files, and both admin pages rendered end-to-end against a seeded SQLite fixture — checks confirmed to flip OK↔FAIL with config (APP_URL match, pepper, admin hash), SMTP probe fails fast on DNS/creds without hanging, password masked in output, bad CSRF rejected, bad email rejected, dev-mode banner correct.

- 2026-08-10 — **Client reporting deploy stack built for `dgtl.report`** — a second Netlify-style deploy pair modeled on `deploy/portal` + `deploy/decks` (dgtlmag): new `deploy/report-portal/` (deploy.dgtl.report — one portal, Report/Audit destination toggle, token-auth html/zip deploy, API `/api/sites…?target=report|audit`) and `deploy/report-host/` (one nginx container, `map $host` → `dgtl.report/<slug>/` serves `/data/reports`, `audit.dgtl.report/<slug>/` serves `/data/audits`). Purpose: hosting `/dgtl-worklog-status-report` pages (reports) and `/dgtl-client-audit` pages (audits). Privacy: no hub index is ever generated — both apexes serve a baked-in branded placeholder, `robots.txt` disallows all, every response carries `X-Robots-Tag: noindex,nofollow`. Verified in sandbox: `node --check` + live server exercise (deploy/list/zip/delete/bad-token/bad-slug to both targets, no root index written) and `nginx -t` + live curl matrix (placeholder on both apexes, host separation confirmed — audit host 404s a report-only slug, branded 404, headers). Runbook §5b added to `deploy/vps/README-VPS-DEPLOY.md`; env template `report-portal.env.example` (new token, never reuse the dgtlmag one). Not yet deployed — needs DNS A records (apex, www, audit, deploy → VPS) and `docker compose up` on the box.

- 2026-08-10 — Added `pitches/dgtl-residency/` via dgtl-pitch-composer: "The DGTL Residency" services-for-accommodation offer for Toronto rental operators (3/6-month dual-track exchange, $0 invoiced). Includes BLOCK-PLAN.md, sourced market stats (CMHC/Rentals.ca/Urbanation), and prospects.md dossier (14 ranked operators + decision-makers, verified-vs-pattern contacts). Registered in pitches.index.json; check-links missing=0. Screenshot verify skipped (no browser in sandbox); structural validation passed.
  - **Went live same day (2026-08-10 evening):** DNS A records (apex/www/audit/deploy → 37.27.198.189) set at the registrar; both stacks up on the VPS from `feat/report-deploy`. Two hiccups, both resolved: (1) debug port 8091 was already bound by `dgtl-journal`, so `dgtl-report-host` sat in Created — moved to 8092 (committed); (2) the Let's Encrypt cert for the report-host router failed its first issuance while the container was down — a `--force-recreate` retriggered ACME and `dgtl.report` now serves a valid LE cert. First real deploy confirmed end-to-end: `dgtl.report/piano-boutique-status-v1/` (Piano Boutique status report via the portal). Recurring unrelated ACME error for `dgtlinfluence.com` observed in coolify-proxy logs — logged in Known Issues.

- 2026-08-10 — **New sixth surface `audits/` opened, and the first pair of deliverables for the 20 Maud studio venture shipped.** Target: a working Toronto sound engineer (name not yet supplied) who owns a full recording/mixing/mastering chain but no room, considering **Unit B3, lower level, 20 Maud Street** — the unit beside Archive Threads / "20 Maud" (B1/B2) — from Strashin Developments. Deal shape as briefed: he signs the lease and keeps the gear, the engineering and his existing clients; DGTL brings brand, website + booking, client pipeline and DGTL Records as the rights back end, paid on originated work plus a build fee.
  - `pitches/dgtl-studios-maud/index.html` (+ `pitch.json`, registered in `pitches.index.json`) — built with `dgtl-pitch-pages`. Single self-contained file, 14-section blueprint plus a **"What We're Not Claiming"** section that is load-bearing and must not be removed. Centerpiece is "Two Engines" (billable hours vs. rights). Four `data-slot`s: `engineer-name`, `studio-name`, `unit`, `start-date`. `check-links.py` → `missing=0`; structural validation passed (tag balance, all 39 base64 payloads decode); **screenshot verification skipped — no browser in sandbox.**
  - `audits/dgtl-studios-maud/DGTL-PartnerFit-Audit-20-Maud-Studio.pdf` (25pp) + `audit.html` + `build_audit.py` — built with `dgtl-partner-fit-audit`. **23 findings across six categories, 6 Critical.** Four research lanes: Toronto studio market, the Archive Threads adjacency thesis, publishing/rights economics, and the building record. All 25 page PNGs reviewed.
  - Three findings gate everything and each is a single phone call: **A-01** the operator has not been assessed (no name/entity/credits supplied), **B-01** the Strashin tenant roll records B3 as occupied by Alexandra Harcourt and no below-grade vacancy at 20 Maud is publicly listed at any rate, **C-01** the footfall version of the adjacency thesis is unsupported — two research passes found no case anywhere of a studio attributing bookings to a neighbouring shop, and the brand-funded in-store studio (Converse Rubber Tracks, Red Bull, House of Vans) has closed everywhere it was tried.
