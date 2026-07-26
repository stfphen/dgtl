---
title: 2D · Portfolio / References & Media Library
type: module
tags: [module, tenancy, ai, media]
status: living
updated: 2026-07-02
---

# Portfolio / References & Media Library

> **Status: P0 SHIPPED (2026-07-01, `feature/portfolio-p0`); P1 + editor slice of P3 SHIPPED
> (2026-07-02, `feature/funnel-design-control`); P2 (object storage + hardening) and P4 (AI
> tag-constrained selection) still PROPOSED.** Decision rationale in [[52-Decision-Log]]
> (2026-07-01 + 2026-07-02).
>
> **What P1 shipped (deviations from the plan below noted):** `media_assets` via migration `007`
> (+ ensureSchema mirror + `mediaAssets` file-store branch); `lib/media/` seam with the `local`
> provider writing `public/uploads/<teamId>/<id>.<ext>` (`MEDIA_UPLOAD_DIR` test seam) — uploads
> are **images only** with magic-byte sniffing (no SVG, 10 MB default), video/embed stay URL-based;
> `/api/admin/media` POST/GET/DELETE (delete does a tenant-reference check, `force` overrides);
> `mediaId` slots on `media.heroImageId`, `portfolio.items[]`, `references.logos[]` (sanitize keeps
> mediaId-only entries) resolved **server-side** by `resolveTenantMediaConfig` in `app/page.jsx` +
> `app/t/[slug]/page.jsx` — mediaId wins, direct `src` is the fallback, ids are stripped before the
> client component. Editor slice: `MediaPicker`/`MediaSlots` in the TenantEditor persist via the
> edit route's deterministic patch mode. **Index deviation:** plain `gin(tags)` + btree
> `(team_id, created_at desc)` instead of the composite gin (needs `btree_gin`). **Deploy:**
> `output:"standalone"` needs `public/uploads` as a volume until the S3 provider (P2).
>
> **2026-07-03 — YouTube hero media shipped:** `media.heroVideo` (video loop / ordered playlist
> loop / shuffled channel uploads) via `lib/media/youtube.js` (parser+sanitizer),
> `lib/media/youtubeResolve.js` + `/api/admin/media/youtube-resolve` (save-time resolution),
> `components/YouTubeHeroPlayer.jsx` (IFrame API, PLAYING-gated reveal, image fallback) and the
> `YouTubeHeroInput` editor slot. Config-direct, not a `media_assets` row ([[52-Decision-Log]]).
> **07-03 polish:** playing video fully replaces the poster (`data-video-playing` attribute fade);
> aspect-aware JS cover sizing (`coverSize()` + `heroVideo.aspect` from oEmbed) crops in-player
> bars for non-16:9 content, ResizeObserver-driven for mobile; watchdog waits for tab visibility.

## Purpose
Give each tenant funnel a **dynamic "Portfolio & References" section** that shows real work (video/image
case studies, client logos, testimonials, result metrics) chosen to be **relevant to that client's
business** — plus a **team-scoped Media Library** so assets are uploaded once and reused across tenants,
and an **easy admin editor** for the hero + funnel media/copy. Selection of which pieces appear is
**AI-assisted** (the [[2A-Tenant-Builder]] proposes a relevant set from the tagged library; a human
approves). Must honor the no-hardcoding invariant ([[15-Multi-Tenancy]]) — one library, tag-driven,
no single client/industry baked in.

Replaces/augments today's placeholder: the funnel's `output` section renders **text-only** tiles
(`output.tiles` = `["TALKING HEAD","UGC",…]`, an `aria-hidden` decorative grid in
`components/FunnelPage.jsx:270-283`). There is **no real portfolio media anywhere yet**.

## Scope (4 capabilities)
1. **Funnel section** — per-tenant `portfolio` + `references` config sections, rendered dynamically.
2. **Media Library** — real upload + reusable, tagged, team-scoped assets (new table + storage seam).
3. **AI-assisted selection** — extend Tenant Builder to pick relevant library assets by tag.
4. **Admin editor** — pick/reorder media + edit hero copy inline, with draft→publish + live preview.

## Key files (planned)
- Config shape / defaults: `lib/defaultTenant.js` — add `portfolio` + `references` sections + normalize them.
- Validation: `lib/tenantValidation.js` — add `["portfolio","items"]` + `["references","testimonials"]` /
  `["references","logos"]` to `ARRAY_PATHS`; per-item sanitize (id, kind, alt, tags, caption, link).
- Media data layer: `lib/store.js` — `media_assets` CRUD (team-scoped) + JSON-file fallback parity.
- Storage seam: `lib/media/` — `getStorageProvider()` (mirrors telephony's `getProvider`): `local`/`data-url`
  MVP → S3-compatible / DO Spaces / Supabase Storage in prod. Every path **degrades to URL/embed only**.
- AI selection: `lib/tenantBuilder/generateTenant.js` — extend `TENANT_OUTPUT_SCHEMA` so the model returns
  **references to existing `mediaId`s** + captions (retrieval, not fabricated URLs). Shares [[2B-AI-Backend]].
- API: `POST /api/admin/media` (multipart upload), `POST /api/admin/media/url` (register URL/embed),
  `GET /api/admin/media` (list/filter by tag), `DELETE /api/admin/media` (by `mediaId` in body — matches the
  leads/accounts body-param convention). All `requireRole` + team-scoped + audit-logged ([[21-Admin-Shell]]).
- UI: `components/admin/MediaLibrary.jsx` (grid, drag-drop upload, tag editor, filter) +
  `components/admin/FunnelContentEditor.jsx` (hero copy + hero image + portfolio picker, draft→publish,
  live `FunnelPage` preview). Funnel render: new `<PortfolioSection>` in `components/FunnelPage.jsx`.
- Data: new table `media_assets` (migration `007`) → [[13-Data-Model]].

## Data model (planned)
**`media_assets`** (migration `007`, team-scoped like everything else — [[15-Multi-Tenancy]]):
`id`, `team_id NOT NULL`, `kind` (`image`|`video`|`embed`), `url`/`storage_key`, `mime`, `bytes`,
`width`/`height`/`duration`, `thumbnail_url`, `title`, `alt`, `tags` (jsonb: `industry[]`, `format[]`,
`client`), `source` (`upload`|`url`|`embed`), `created_by`, timestamps. Indexed on `(team_id, tags)`.

**Config additions** (stored in `tenants.config` jsonb, draft→publish via `saveTenantDraftConfig` /
`publishTenantConfig`):
- `portfolio`: `{ eyebrow, headline, body, items:[{ mediaId, caption, client, result, tags }] }`
- `references`: `{ eyebrow, headline, testimonials:[{ quote, name, company, mediaId? }], logos:[mediaId] }`

**Key rule — assets live in `media_assets`, referenced by `mediaId` from config; never inline the bytes.**
The config JSON stays lean; only small icons keep the existing data-URL pattern (`brand.appIcon` ≤512KB,
`lib/branding/appIcon.js`). This avoids bloating every tenant config (the store is 82KB `lib/store.js` +
`data/app-store.json` fallback).

## Data flow
```
Admin uploads/links media ─► /api/admin/media ─► storage seam ─► media_assets (team-scoped, tagged)
                                                                        │
Tenant Builder (AI) reads brief + library ─► proposes portfolio.items[mediaId] by tag match ─┐
Admin edits/reorders in FunnelContentEditor ─► saveTenantDraftConfig ─► publishTenantConfig ──┤
                                                                                              ▼
Visitor hits funnel ─► getTenantForHost/BySlug ─► FunnelPage ─► PortfolioSection resolves mediaId→asset
```

## AI-assisted selection
The model is given the client brief **plus the team's tagged library** and returns which `mediaId`s fill
`portfolio.items` (industry + format relevant to the client) with draft captions/section copy. It
**selects from existing assets** — it does not invent URLs. Human reviews in draft, then publishes (keeps
the human-approval pattern used across outreach/funding). Fallbacks: library empty or AI not configured →
tag auto-match or manual pick. Tag taxonomy (`industry`, `format`) is data-driven, not hardcoded.

## Storage seam / env (planned)
Provider-neutral, mock/local-first (the project invariant — every integration degrades to "not
configured"): dev = local disk under `public/uploads/<team>/…` or small-image data-URL; prod = S3-compatible
object store (**DO Spaces fits the deploy target** — [[41-Deployment-Runbook]]) via signed uploads. New env
(→ [[43-Environment-Variables]]): `MEDIA_STORAGE_PROVIDER`, `MEDIA_BUCKET`, `MEDIA_*_KEY`, size/mime caps.
Without them configured, only URL/embed registration works.

## ⚠️ Gotchas / open issues → [[53-Known-Issues]]
- **New upload surface amplifies open security gaps.** Must ship with: mime/type allowlist + magic-byte
  check (not just extension), size caps, **team-scoped IDOR checks** (cf. H2), rate limiting (cf. H1),
  path-traversal-safe storage keys, and **SSRF guards** on any server-side URL fetch/thumbnailing (cf. C2).
- **Do not point `next/image` at arbitrary uploaded remote hosts** — precedent set 2026-06-30
  ([[52-Decision-Log]]): local `/`-prefixed → `next/image`; remote → plain `<img>`/own-domain/signed URL.
- **Accessibility:** the current `output` tiles are `aria-hidden` decorative; a real portfolio must be
  accessible — require `alt` on every asset, real captions, keyboard-navigable media/embeds.
- **Design contracts:** section must be mobile-first (`min-width` pattern), AA against any tenant accent,
  and reuse `Reveal`/`Stagger` motion — [[16-Design-System]]. Brand-token contract untouched.
- **Video cost/egress:** MVP prefers embeds (Vimeo/YouTube) + uploaded poster; native video upload waits
  for the object-store phase.

## Phases (each additive, mock-first, behind an approval gate; tests + build green before merge)
- ✅ **P0 — Config + render.** SHIPPED 2026-07-01 on `feature/portfolio-p0`: `portfolio`/`references`
  sections + empty-array defaults (`lib/defaultTenant.js`), per-item sanitization + `ARRAY_PATHS`
  (`lib/tenantValidation.js`), `PortfolioSection`/`ReferencesSection` in `components/FunnelPage.jsx`
  (render only when populated; falls back to `output.tiles`), mobile-first CSS, `tests/portfolio-config.test.js`.
  **P0 deviation from the planned shape:** items carry a **direct `src`/`thumbnail`** (root-relative or
  http(s), like `media.heroImage`) instead of `mediaId` — the `mediaId` indirection arrives with P1's
  `media_assets` table. 208/208 tests + build green. No new infra.
- **P1 — Media Library (no object store).** `media_assets` + admin manager with URL/embed + small data-URL
  upload only; works offline, degrades gracefully.
- **P2 — Real storage + security.** Object-storage seam, real file/video upload, thumbnailing, + the security
  hardening above (SSRF/rate-limit/IDOR/type-sniffing).
- **P3 — Editor + funnel polish.** `FunnelContentEditor` (hero copy + hero image picker + portfolio
  picker/reorder) with live preview; mobile/AA/motion polish on the section.
- **P4 — AI-assisted selection.** Tag-constrained retrieval in the Tenant Builder + captions.

## Related
[[2A-Tenant-Builder]] · [[2B-AI-Backend]] · [[15-Multi-Tenancy]] · [[13-Data-Model]] · [[16-Design-System]] ·
[[21-Admin-Shell]] · [[33-Sprint-2-Productization]] · [[53-Known-Issues]] · [[61-Security-Review]] · [[63-Tenants-Catalog]]

Up: [[20-Modules-MOC]]
