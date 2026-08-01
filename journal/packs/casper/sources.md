# Casper (@caspertheghos7) — sources & fact discipline

Companion to `journal/packs/casper/index.html`. Everything asserted on the hub page traces to an
entry below. If it is not here, it is not on the page.

Research date: **2026-08-01**. Re-check the follower figure before any re-publish.

## Primary sources

- **Instagram — @caspertheghos7** — identity, display name "Casper🖤", **162K followers**,
  1,202 following, bio linking `@casperthefriendlytattooer`, merch link with the code `GHOST20`,
  story highlights including "Exclusive" and "MXDVS":
  https://www.instagram.com/caspertheghos7/
- **Instagram — @casperthefriendlytattooer** — second account, page title reads
  "CASPER TATTOOS TORONTO" (supports: tattoo artist, Toronto). Profile body is behind a login wall,
  so nothing beyond the account title and the bio link from the main profile is claimed:
  https://www.instagram.com/casperthefriendlytattooer/
- **MXDVS** — the Antwerp atelier whose catalogue is knitted balaclavas, incl. the E18 Balaclava 2.0.
  Supports only the description of what the brand *is*: https://store.mxdvs.co/

## Posts used (media + captions)

All hero/gallery images are frames from Casper's **own public Instagram posts**, captured via a
prior `dgtl-creator-features` run and used as editorial reference with attribution
(see `references/sourcing-and-rights.md`). Shortcode → file in `media/`:

| Post | File | What it supports |
|---|---|---|
| `DbLqWFYAAbq` | `hero-chrysler-spire.jpg` | New York; Chrysler Building |
| `DbLh6ZRAIK2` | `frame-chrysler-ledge.jpg` | New York; Chrysler Building |
| `Da77fPwgHyo` | `frame-eiffel-night.jpg` | Paris; Eiffel Tower rooftop at night |
| `Da4BL2cgTqz` | `frame-catacombs.jpg` | Paris; catacombs / ossuary |
| `Da5gW1zDw3g` | `frame-toronto-rooftop.jpg` | Toronto rooftop (CN Tower in frame) |
| `DbRBjQuxa8p` | `frame-toronto-ledge.jpg` | Toronto (Rogers Centre dome in frame) — held, not published |
| `DapNYN0yY78` | `frame-wind-turbine.jpg` | Wind-turbine nacelle; white balaclava |
| `DbR1r9JgGAk` | `frame-balaclavas.jpg` | The masked signature |
| `PROFILE` | `casper-profile.jpg` | Avatar (150×150) |

Captions confirmed by fetching the post pages directly:

- `DZitMq4BhRA` — "Third times a charm" · `#urbex #nyc #adrenaline #rooftops #explore` · 2026-06-13
- `DOTjmAVACPr` — "Taste the ☁️ Hoodie by @darkjayheartx" · `#urbex #windmill #clouds`
- `DPrgxSSgYb-` — "Miss you forever" · 2025-10-11
- own reel `DDSm2tLvlm4` — `#urbex #toronto #explore #rooftop` (supports Toronto as home base)

Three captured frames (`DYkPfhtAnVW`, `DZitMq4BhRA`, `DPrgxSSgYb-`) were reviewed but not published —
two are stored rotated 90° from a vertical-video capture, and one added nothing the published set
does not already cover.

## Known limitation — image resolution

Every frame in `media/` came out of the capture bundle at **thumbnail resolution** — the hero is
361×640, the largest is 480×640, and the avatar is 150×150. The hero slot renders full-bleed at
~1100px wide, so it is being upscaled and looks soft on a desktop viewport.

This is good enough for a `draft` and for the card on the Journal index, but **get higher-resolution
originals from Casper before moving the pack to `live`** — that request belongs in the same
conversation as the review ask in `backlink-kit.md`. Do not re-scrape at higher resolution as a
substitute for asking.

## Verified vs. NOT claimed (fact discipline)

**Verified and used on the page:**
162K Instagram followers (as of 2026-08-01, read from the profile); the handles
`@caspertheghos7` and `@casperthefriendlytattooer`; Toronto as home base; documented work in
Toronto, New York and Paris; the balaclava as the account's signature; the `GHOST20` merch code;
that Casper wears MXDVS and keeps an "MXDVS" story highlight; that she is a tattoo artist.

**Deliberately NOT claimed** — no source, so nothing was written:

- **Real identity.** Casper works anonymously. DGTL made no attempt to establish who she is and
  will not publish it if it surfaces. The FAQ says so explicitly.
- **Any paid brand partnership.** She *wears* MXDVS and has tagged `@darkjayheartx` for a hoodie.
  Neither is a disclosed deal. The page says a brand appears "because Casper posted it, not because
  a deal was disclosed to us." Do not upgrade this to "partner" without a `#ad`/`#partner` post or
  written confirmation.
- **TikTok / YouTube / any non-Instagram figure.** Not verified, so no other platform is mentioned
  and only the two Instagram URLs are in the `sameAs` schema.
- **Engagement rate, reach, view counts.** None captured, none published.
- **A follower count of 115K**, which appears in third-party search results. It is stale against
  the profile itself; the live profile reading was used instead.
- **Motive for the mask.** She has not stated one publicly. The FAQ says exactly that rather than
  guessing.

## Editorial note — subject matter

This is rooftopping: trespass in most jurisdictions where it happens, and fatal in some. The page
profiles the audience-building and the craft, states the risk plainly in the closing section, and
carries no route, access method, or encouragement to imitate. Keep it that way on any edit. Any
brand introduced to a creator in this category has a duty-of-care question to answer first.

## Status

`pack.json` status is **`draft`** — the page is factually clean and validates, but Casper has not
been contacted and has not reviewed it. Move to `live` once she has seen it (see `backlink-kit.md`)
and once `canonicalUrl` resolves to a served domain.
