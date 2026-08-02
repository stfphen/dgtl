# 5a1ive — feature cluster + backlink kit

## What was built (4 pages, one cluster)

| Page | Slug | Editable | Deploy (upload this) |
|---|---|---|---|
| Main profile (hub) | `5a1ive` | creators/5a1ive.html | creators/5a1ive.standalone.html |
| The crystal G-Shock craft | `5a1ive-gshock` | creators/5a1ive-gshock.html | creators/5a1ive-gshock.standalone.html |
| Wire-wrapped eyewear | `5a1ive-eyewear` | creators/5a1ive-eyewear.html | creators/5a1ive-eyewear.standalone.html |
| Worn by the scene | `5a1ive-scene` | creators/5a1ive-scene.html | creators/5a1ive-scene.standalone.html |

The four pages link to each other, the hub is linked from the Journal index, and each page links out to
@5a1ive and 55555stuff.com. Person schema `sameAs` points at the real Instagram + store.

## Deploy

Upload each `*.standalone.html` to **deploy.dgtlmag.com**. They publish at:

- https://pitch.dgtlmag.com/journal/creators/5a1ive.html
- https://pitch.dgtlmag.com/journal/creators/5a1ive-gshock.html
- https://pitch.dgtlmag.com/journal/creators/5a1ive-eyewear.html
- https://pitch.dgtlmag.com/journal/creators/5a1ive-scene.html

Keep the slugs stable once live (changing a URL sheds ranking).

## Backlink kit — hand this to 5a1ive

**Ready-to-post caption (IG / story / link-in-bio):**
> Featured in the DGTL Influence Journal — the full write-up on the custom crystal G-Shocks + the
> 55555stuff eyewear line. → https://pitch.dgtlmag.com/journal/creators/5a1ive.html

**Link-in-bio / press ("as seen in") line:**
> As seen in the DGTL Influence Journal → https://pitch.dgtlmag.com/journal/creators/5a1ive.html

**Suggested anchor text for any site linking back:** `5a1ive in the DGTL Influence Journal`

When 5a1ive shares the feature, that's a real editorial backlink — the two-way link (you link to his work,
he links to his feature) is what actually moves rankings for his name and drives traffic both ways.

## Ranking note

Primary keyword is the name **5a1ive** (and **55555stuff**), placed in each title, H1, URL slug, meta
description, first paragraph, image alt, and Person schema. Titles run ~5 characters over Google's ~65-char
display width because the template appends " | DGTL Influence Journal" — the name still leads, so this only
trims the tail hook in search results. Shorten the `TITLE` token in the fields.json and re-run if you want it
fully inside the limit.
