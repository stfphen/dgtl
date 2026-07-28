# Repo output — where a pitch actually lives

This file is identical across `dgtl-pitch-pages`, `dgtl-pitch-teasers` and `dgtl-pitch-composer`.
Edit it in `engine/` and copy to the other two so they stay in lockstep.

A generated page is not done when it looks right. It is done when it lives in the repo, carries a
manifest, is registered, and passes the link check. Everything below is enforced by
`tools/check-links.py` or by a human noticing it's missing — mostly the former.

## 1. One folder per pitch

```
pitches/
  pitches.index.json          # the register
  _templates/                 # generic offer pages — cloned, never sent, never edited in place
  <slug>/
    index.html                # the hub — the long/full pitch
    teaser.html               # optional short front-of-funnel opener, BESIDE the hub
    pitch.json                # the manifest
    media/                    # this pitch's own assets
```

**The teaser and the full pitch live in the same folder.** They are one pitch with two entry points,
not two slugs. This is the single most common mistake when generating from these skills.

## 2. Linking — relative inside the folder, always

| From | To | Write |
|---|---|---|
| `teaser.html` | the full pitch | `index.html` |
| `index.html` | the teaser | `teaser.html` |
| either | own media | `media/photo.jpg` |
| either | a *different* pitch | `https://pitch.dgtlmedia.io/<other-slug>/` |

**Never a root-absolute link** (`/full/`, `/media/x.jpg`). Those only resolve when the page is served
from a domain root, so they break locally *and* under the `/<slug>/` deploy scheme. This is not
theoretical: it is exactly how the DMTV × Bose teaser's "See the Full Pitch" button silently broke.
`check-links.py` reports them as `root_absolute` — that count must stay at 0.

Pitch pages are **self-contained by design** (inlined styles, often inlined images) because they get
sent as one-off artifacts and must survive being served from anywhere. Do not refactor them onto
`journal/_shared/`.

## 3. `pitch.json` — the manifest

```json
{
  "slug": "<slug>",
  "name": "<Client or offer name>",
  "type": "pitch",
  "client": "<Client>",
  "status": "draft",
  "hub": "index.html",
  "teaser": "teaser.html",
  "canonicalUrl": "",
  "media": "media/",
  "notes": "",
  "updated": "<YYYY-MM-DD>",
  "pendingAssets": []
}
```

- `teaser` — `null` when there isn't one.
- `type` — `pitch` for a real prospect, `concept` for a speculative or unsent idea.
- `status` — `draft` until it's been sent.
- `canonicalUrl` — leave `""` until the deploy URL is real. Don't invent one.

## 4. `pendingAssets` — declare gaps, don't ship them broken

If a pitch ships before its photos arrive, list the expected paths in `pendingAssets`:

```json
"pendingAssets": ["media/crew.jpg", "media/throw-it-back.jpg"]
```

`check-links.py` then reports them as `pending` instead of `missing`, so the check stays green and a
*real* break is still visible. This exists because a permanently red check gets ignored — which is
how the ESCOTT photos went unnoticed. Leave a `media/README.txt` saying what's needed and from where.

## 5. Register it

Add the slug to the `pitches` array in `pitches/pitches.index.json` and bump `updated`. The register
is also the slug registry — don't track slugs anywhere else.

## 6. Tailored pages: clone a template, don't rebuild

`pitches/_templates/` holds the generic "Your Brand × DGTL" offer pages — `website-overhaul.html`,
`brand-redesign-kit.html`, `influencer-activation.html`. When a prospect wants one of these offers,
**clone rather than generate from scratch**:

1. Copy the template to a new `pitches/<slug>/index.html`.
2. Read the `DATA-SLOT MANIFEST` comment in its `<head>` — it lists every replaceable element.
3. Replace **by slot only**. Leave the fixed content alone: DGTL contact details, proof stats, client
   logos, case studies. Those are verified and shared across every page.

Two hard rules: never send a `_templates/` page to a client, and never personalise a template in
place. Copy first, always.

Generate a page from scratch when the offer isn't one the templates cover, or when the pitch needs a
structure the template can't carry. Say which path you took and why.

## 7. The published URL is not fixed — don't bake one in

Default deploy is **deploy.dgtlmedia.io** → served at `https://pitch.dgtlmedia.io/<slug>/`.

But `skill-mods/migrate-to-main-domain/` exists to **promote** hand-picked pages onto
`https://dgtlgroup.io/pitch/<slug>/`, because a subdirectory of the established domain inherits its
authority while a separate subdomain does not. That is the single biggest ranking lever available,
and any page you build may be promoted later.

So:

- Leave `canonicalUrl` empty in `pitch.json` until the page is actually live somewhere.
- Set `canonical` / `og:url` to the page's **real** published URL — one address, consistently, or
  the ranking signal splits across two.
- Keep intra-folder links relative (§2). Relative links survive promotion unchanged; hardcoded
  `pitch.dgtlmedia.io` links have to be rewritten and one will be missed.

That last point is the practical reason the relative rule matters beyond the local-preview case.

## 8. Definition of done

Report the commands you ran. Do not claim a check passed without showing it.

1. `pitches/<slug>/index.html` exists (plus `teaser.html` if there is one, in the same folder).
2. `pitches/<slug>/pitch.json` exists and is accurate, with any gaps in `pendingAssets`.
3. The slug is in `pitches/pitches.index.json`, `updated` bumped.
4. `python3 tools/check-links.py` reports **`missing=0`** and **`root_absolute=0`**.
