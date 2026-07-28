# Field guide — every token in `fields.json`

Build one `fields.json`, then run `scripts/populate.py`. Two objects:
`tokens` (text that replaces `{{TOKEN}}`) and `media` (images injected into the hero + gallery).

```json
{
  "tokens": { "TITLE": "...", "...": "..." },
  "media":  { "hero": {"src": "...", "alt": "..."}, "pf1": {"src":"...","alt":"..."} }
}
```

Any token you leave out stays as a visible `{{TOKEN}}` — `validate.py` will catch it, so fill them all
(or delete the element from your working copy if a section genuinely doesn't apply). Any `media` slot you
omit keeps its on-brand gradient placeholder — fine when you don't have that image.

## Head / SEO tokens

| Token | What to write | Length |
|---|---|---|
| `TITLE` | Title tag. **Name first**, then a hook. | ≤ ~60 chars |
| `META_DESCRIPTION` | Search snippet. Name in first ~10 words + hook + one association. | 120–160 chars |
| `KEYWORDS` | Comma list: name, aliases, associated brands/works, "creator profile", "influencer marketing". | — |
| `CANONICAL_URL` | The real published URL for this pack. Used in canonical, OG, Twitter, and every JSON-LD `@id`. **The scheme is unsettled — ask the user rather than guessing**; see *Deploy & connectivity* in `SKILL.md`. Mirror whatever you use into `pack.json`'s `canonicalUrl`. | — |
| `OG_IMAGE` | Absolute URL to the share image (usually the hero, once hosted). | — |
| `PUBLISH_ISO` / `MODIFIED_ISO` | ISO 8601 with offset, e.g. `2026-07-15T09:00:00-04:00`. | — |
| `PUBLISH_DATE` | `YYYY-MM-DD` (used in `<time datetime>`). | — |
| `PUBLISH_HUMAN` | Human date, e.g. `July 15, 2026`. | — |
| `SECTION` | `Creators` (or `Case Studies`). | — |
| `CATEGORY_LABEL` | The kicker pill, e.g. `Creator Profile`. | — |
| `READ_TIME` | e.g. `7 min read`. Estimate ~200 wpm. | — |

## Header / hero

| Token | What to write |
|---|---|
| `HEADLINE_A` | Plain part of the H1. Must contain the name **or** be unambiguously about them. Also used as the `Person` schema `name` — so if the H1 doesn't literally contain the name, set `HEADLINE_A` to the name and carry the phrase in `HEADLINE_GOLD`. |
| `HEADLINE_GOLD` | The gold accent phrase — the emotional punch. |
| `DEK` | 1–2 sentence standfirst; promise the payoff, name an association. |
| `HERO_BADGE` | Small chip on the hero, e.g. `Feature`, `Profile`, `Reel · 00:38`. |
| `HERO_CAPTION` | Caption under the hero image — **credit + source** (per sourcing rules). |
| `GHOST_METRIC` | Big faint number behind the hero (their headline figure, e.g. `6M+`). Shown only when no hero image is injected. |

> **Person schema note:** `HEADLINE_A` feeds `Person.name` and the breadcrumb. Keep it the actual name
> (e.g. `Peter McKinnon`) and let `HEADLINE_GOLD` carry the rest of the sentence.

## Creator stat bar (4 cells)

`STAT1_NUM`…`STAT4_NUM` + `STAT1_LABEL`…`STAT4_LABEL`, and `STAT_FOOTNOTE`.
- Use **verified** figures only, with an as-of date in the footnote (e.g. "Platform figures as of July 2026").
- Mix creator metrics (followers, avg views, engagement) with a network/collab metric if relevant.
- To animate a number, the template's cells accept plain text; if you want count-up, write the number as
  a `<span data-count="6" data-suffix="M+">6M+</span>` inside the token value.

## Body

| Token | What to write |
|---|---|
| `LEAD` | Opening paragraph; **name in the first sentence**; why they matter. |
| `BODY_1` | Second paragraph; set up the thesis. |
| `H2_1` | First section heading (the value/craft angle). |
| `BODY_2` | 1–2 paragraphs under H2_1. |
| `PULLQUOTE` | One crystallising line. Editorial/unattributed is fine. |
| `PULLQUOTE_CITE` | Attribution, e.g. `— The DGTL Influence view`. Only name a real person if they said it. |
| `H2_2` | Second section heading (context: the campaign / network / method). |
| `BODY_3` | 1–2 paragraphs under H2_2. |
| `CALLOUT_TITLE` | Key-takeaways card title, e.g. `Why it matters`. |
| `CALLOUT_1..4` | 3–4 scannable bullets (snippet bait). |
| `BODY_4` | Closing paragraph. |
| `STATCALLOUT_NUM` | Big stat for the mid-body callout (verified). |
| `STATCALLOUT_CAP` | Caption for it; `<b>bold lead-in.</b>` supported. |

## Portfolio gallery (6 tiles)

`GALLERY_INTRO` (section heading), then per tile `PFn_CHIP`, `PFn_KICK`, `PFn_TITLE`, `PFn_NOTE` (n = 1..6).
- `CHIP` = corner tag (e.g. `Cinematic`), `KICK` = category · year, `TITLE` = the piece, `NOTE` = one line.
- Fill with the creator's **real** work. Inject the matching image via `media.pfN` (below).

## SEO scaffolding

- `FAQ_Q1..Q4` / `FAQ_A1..A4` — the questions people search about this person (see `seo-and-backlinks.md §3`).
- `TAG_1..4` — filed-under chips (name, category, associated brand, "DGTL Influence").
- `PERSON_JOBTITLE` — e.g. `Filmmaker, Photographer & Content Creator`.
- `PERSON_DESC` — one-sentence factual bio for `Person` schema.
- `PERSON_URL` — their primary real profile/site (canonical identity URL).
- `SAMEAS_1..3` — their **real, verified** profile URLs (YouTube / Instagram / TikTok / X / site). Wrong or
  guessed URLs here hurt more than help — omit a slot rather than guess (delete the array item if unused).

## Media injection

`populate.py` swaps a slot's gradient for a real `<img>` when you provide it:

| Slot key | Where it lands | src path is relative to |
|---|---|---|
| `hero` | The hero figure (removes the ghost metric) | the page being written |
| `pf1`…`pf6` | Portfolio tiles 1–6 in order | same |

Each slot is `{ "src": "...", "alt": "..." }`. **alt is required** and should describe the image and
include the creator's name where natural. Write `src` exactly as it must appear in the final page,
which depends on where that page sits in the pack:

| Page being populated | own media | shared CSS/JS | pack hub |
|---|---|---|---|
| `journal/packs/<slug>/index.html` | `media/hero.jpg` | `../../_shared/…` | — |
| `journal/packs/<slug>/features/<x>.html` | `../media/hero.jpg` | `../../../_shared/…` | `../index.html` |

Media always lives inside the pack's own `media/` folder — never a shared asset pool.

## Example

See `examples/fields.example.json` for a complete, realistic (placeholder-creator) `fields.json` you can
copy and adapt.
