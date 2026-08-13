# Migration — `content-checkout-funnel` → `stfphen/dgtl`

Copy-only consolidation. Nothing was deleted from `content-checkout-funnel`; this repo is a
parallel, self-contained build. Cleanup of the origin repo is a separate, later decision.

## What moved

| Destination | Source | Contents |
|---|---|---|
| `platform/` | `app/ components/ lib/ migrations/ tests/ scripts/ public/` + root configs | The Next.js app: admin panel, lead pipeline, prospecting, batch builder, outreach, telephony, checkout, funding, tenant builder |
| `journal/packs/<slug>/` | `influence-journal/creators/ cases/ assets/media/` | 6 creator packs, reshaped from flat files into self-contained folders with `pack.json` manifests |
| `journal/_shared/` | `influence-journal/assets/` | Editorial design system: CSS, JS, logos |
| `journal/_templates/` | `influence-journal/_templates/` | Blank creator template, block library, worked examples |
| `pitches/` | `pitches/` | DGTL pitch / offer landing pages |
| `deploy/` | `dgtl-deploy/` | Domain + deploy blueprints, runbooks, decks |
| `skill-mods/` | `dgtl-skill-mods/` | Hero-rotation patch, migrate-to-main-domain scripts |
| `engine/dgtl-creator-features/` | `skills/dgtl-creator-features/` | The pack-generating skill, versioned next to its output |
| `brain/` | `brain/` | Obsidian knowledge vault |
| `tools/` | — | `check-links.py` |

## What did not move, and why

- **`prototypes/`** — ~556 MB of rendered video, netlify builds and a 184 MB zip that exceeds
  GitHub's 100 MB file limit. Nothing in this repo imports from it. Because of this, **Git LFS is
  not used here** — the largest tracked asset is a 1.7 MB PNG, well under the limit.
  Correction to an earlier draft of this file: `prototypes/` does **not** "stay in
  `content-checkout-funnel`" in any tracked sense — that repo's `.gitignore` has excluded it since
  before the migration, so the renders live only on the Mac with no backup. Logged as risk M1 in
  `brain/50-Audit-Log/53-Known-Issues.md`.
- **`platform/data/app-store.json`** — 1.5 MB of runtime state for the JSON fallback store, not
  source. Gitignored, same as in the origin repo. Recreated by `npm run migrate` / the seed
  scripts.
- **`public/uploads/`** — runtime media-library uploads. Gitignored.
- **`.env`, `.env.local`** — secrets. Only `.env.example` ships, and it contains placeholders
  only (verified by scan).
- **`brain/.obsidian/plugins/`** — 1.5 MB of vendored third-party plugin bundles. Gitignored;
  vault config and appearance are still tracked.
- **`.next/`, `node_modules/`, `*.zip`, `.DS_Store`** — build output and cruft.

## Structural changes made during the move

1. **Flat creator files became packs.** `influence-journal/creators/shane-boyer-dji.html`
   became `journal/packs/shane-boyer/features/dji.html`; the redundant slug prefix is dropped
   because the folder carries the identity. Media moved from `assets/media/<slug>/` into
   `packs/<slug>/media/`. Sources and backlink kits moved into the pack.
2. **`pack.json` manifests generated** for all 6 packs, plus `journal/packs/packs.index.json`.
   The publication index, sitemaps and cross-links can now be generated from manifests rather
   than hand-maintained.
3. **`.standalone.html` demoted to build artifact.** Previously both the linked page and a
   standalone twin were committed, doubling the file count and inviting drift. Standalone files
   are now gitignored and produced on demand by
   `engine/dgtl-creator-features/scripts/make-standalone.py`.
4. **Template examples separated from live content.** `peter-mckinnon` and `season-1` moved to
   `journal/_templates/examples/` — they are reference pages, not creators.
5. **App renamed, architecture unchanged.** `package.json` name is now `dgtl-platform`. No
   route, import path, env var, database name or code identifier was renamed. The app remains
   multi-tenant; DGTL is the default brand, not a hardcoded assumption.

## Verification

**Journal** — all 746 internal asset and link references across the 24 migrated pages resolve on
disk. 0 broken. Re-run with `python3 tools/check-links.py`.

**Platform file parity** — the migrated tree is byte-identical to the origin working tree across
all 520 files in `app/ components/ lib/ migrations/ tests/ scripts/ public/`. The only diff is
two stray `.DS_Store` files, deliberately excluded.

> Note: three tenant configs (`lib/tenants/polishStone.js`, `nowakStoneworks.js`,
> `dziuraStoneTile.js`) and their `public/assets/` images were **untracked** in the origin repo
> despite `lib/store.js` importing them. They are committed and were code-reviewed on 2026-08-13.
> The latter two are compatibility re-exports; the Polish Stone config contains no credentials but
> still needs owner verification of its phone number, pricing, portfolio, partner, and testimonial
> claims before publication. The retired repo remains frozen and must not be changed.

**Platform tests** — `npm test` from `platform/`:

| | tests | pass | fail |
|---|---|---|---|
| origin `content-checkout-funnel` | 356 | 350 | 6 |
| migrated `platform/` at migration | 356 | 351 | 5 |
| migrated `platform/` after 2026-08-13 audit fix | 356 | 356 | 0 |

The five inherited failures stubbed `fetch` but still performed real DNS through the SSRF guard,
so the mock was never reached. The enrichment path now accepts an injectable DNS lookup for tests;
production still uses the real SSRF-validated resolver. The full suite is deterministic and green.

**Platform build — VERIFIED 2026-08-13.** On the merged local `main`, Next 15.5.23 compiled,
type-checked, generated all 49 static pages, collected traces, and exited 0:

```bash
cd platform && npm ci && npm run build
```

**Secrets** — scanned for `sk_live`, `sk_test_*`, `ghp_*`, Twilio `AC*` SIDs and Resend `re_*`
keys. The only hit is `.env.example`, and it is prose in a comment explaining which prefix to
use where. No live credential is committed.

## Follow-ups after merge

1. Add `npm run build` as required CI and consider self-hosting fonts so success does not depend on
   Google font endpoints.
2. Update canonical / OG / social-share URLs inside journal pages — they still point at the old
   `…/journal/creators/<slug>.html` paths. They are absolute, so local rendering is unaffected.
3. Decide the deploy domain for `journal/` and regenerate the index from the pack manifests.
4. Replace the Polish Stone `555` phone number and verify all pricing, portfolio, partner-logo, and
   testimonial claims with the owner before publication.
5. Consider `lib/integrations/secEdgar.js` — its default `SEC_EDGAR_USER_AGENT` still carries an
   origin-repo contact string. Changing it is a behaviour change, so it was left alone.

---

## Addendum — VPS offboard bundle → monorepo (2026-07-28)

The origin VPS was offboarded 2026-07-21 into the checksummed `dgtl-offboard-20260721` bundle
(kept offline; it remains the cold archive for data + secrets). Audit against this repo found the
VPS app source clean at `fe2d78a` (= archived `content-checkout-funnel` HEAD, `platform/` here is
strictly newer) and the decks rig byte-identical to `deploy/decks/`. What existed only on the VPS
was imported on branch `consolidate-vps`:

| Destination | Source | Contents |
|---|---|---|
| `pitches/<slug>/` ×18 | `opt-dgtl-decks/site/pitch/` | Live pitch sites: auckland247, cottage, elixr, gold, gold-teaser, hotels, india, india-gov, main1, mainone, modern-sense, nfc, titan, projects-landing-page, escott, escott2, escott-portal, escott-report. Slugs preserve live URLs; `.spa`/`_headers` kept (deploy-functional). Prior `pitches/escott` draft renamed to `escott-brand`. Escott set = portal-led pattern → `pitches/_templates/PORTAL-PATTERN.md`. |
| `deploy/portal/` | `opt-dgtl-deploy/` | deploy.dgtlmedia.io service (server.js, Dockerfile, compose). `.env` stripped (`DEPLOY_TOKEN` in bundle), `server.js.bak` dropped. |
| `deploy/decks/docker-compose.override.yml` | `opt-dgtl-decks/` | Production bind-mount config. |
| `os/` → folded into `apps/dgtl-os/` (2026-07-28, per the 07-18 standalone-product decision) | `dgtl-os-local/` | DGTL OS assistant + terminal + knowledge ingest + hosting kit. `api-key.txt` excluded; `.env`/`api-key.txt` gitignored. Brain/data wiring documented in `os/README.md`. |

**Not imported:** `creators`, `library`, `blog`, `mag-sample` live builds (regenerable from
`journal/_templates` + engine), the pitch hub `index.html` (generated by the portal's
`reindex()`), `hello` (test), `nastya` (personal demo — excluded per owner), `dgtl-assets`
(assets.dgtlgroup.io is stale: dgtlgroup.io serves everything from its own domain; favicons
duplicate the platform brand set), `env/*.env` + `db-dumps/*.sql` + funnel `uploads/` +
`backups/*.dump` (data/secrets — bundle only; restore steps in the bundle README).
