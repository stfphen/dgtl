# SEO & backlinks — ranking a creator feature for their name

The objective: when someone searches the creator's **name** (or a thing they were involved in),
this page ranks. Google ranks genuinely useful, well-structured, well-sourced pages about an
**entity** (a person). So we do two things well: (1) make the page unmistakably *about that person*,
technically clean; (2) build real links in and out. No tricks — see "What not to do."

## 1. Put the name where it counts

The creator's name is the primary keyword. It must appear, naturally, in **all** of these:

| Element | Token / place | Notes |
|---|---|---|
| Title tag | `TITLE` | Name first, ≤ ~60 chars, then a hook. e.g. "Peter McKinnon: The Educator Who Built an Audience" |
| H1 | `HEADLINE_A` + `HEADLINE_GOLD` | The visible headline; contains the name or is unambiguously about them |
| URL slug | output filename `<slug>.html` | `firstname-lastname.html`, lowercase, hyphens, no stop-words |
| Meta description | `META_DESCRIPTION` | 120–160 chars, name in the first ~10 words, includes the hook + one association |
| First paragraph | `LEAD` | Name in the opening sentence |
| Image alt | `media.*.alt` | At least one image's alt contains the name + what's shown |
| Person schema | `PERSON_*`, `SAMEAS_*` | `name`, `jobTitle`, `description`, and `sameAs` → their real profiles |
| Keywords + OG | `KEYWORDS`, OG tags | Name + top associations (brands, works, category) |

Also weave in the **entity associations** — the brands, artists, works, or events they're known for.
Searchers use those ("<name> Canon", "<name> Six Senses"); Google uses them to disambiguate the person.

## 2. Structured data (already wired in the template — fill it correctly)

The template ships JSON-LD for `Article` + `Person` + `Organization` + `BreadcrumbList` + `FAQPage`.
- **Person** is what helps you rank for the name. `sameAs` must list the person's **real, verified**
  profile URLs (YouTube, Instagram, TikTok, X, personal site). This ties the page to the known entity.
- **FAQPage** wins "People also ask" real estate — see §3.
- If the feature centres on a video, consider adding a `VideoObject` (name, thumbnail, uploadDate, a real embed URL). Only if it's real.
- After building, paste the JSON-LD into Google's Rich Results Test and fix any error/warning.

## 3. FAQ = the questions people actually search

Write the four FAQ entries as the literal questions someone Googles about this person, with tight,
factual answers (2–4 sentences, sourced). Good patterns:
- "Who is <Name>?" (identity + what they're known for)
- "What did <Name> do for <Brand/Project>?" (the association searchers look up)
- "Where can I see <Name>'s work?" (answer links to their real channels)
- "Is <Name> part of the DGTL Influence network?" (only if verified/provided)

These map 1:1 to the template's `FAQ_Q1..Q4` / `FAQ_A1..A4` and the FAQPage schema.

## 4. Internal links — the authority backbone

A new page ranks faster when the site points at it:
- **Add a hub card** on `influence-journal/index.html` linking to the new page (copy a `.wcard`).
- **Cross-link** the new page's "More from the Journal" cards to 2 existing pieces, and add the new
  piece to those pieces' related cards where relevant.
- Use the creator's **name as anchor text** for at least one internal link to the page.
- **Link across the funnel** — connect the feature to the teaser and/or full pitch the creator appears
  in, both ways (a prospect reading a pitch can meet the creators; a creator's audience can find the offer).
Dense, relevant internal linking spreads authority and helps everything rank — it's the highest-leverage,
fully-in-your-control SEO move.

> **DGTL hosting note.** Pages are published one-per-slug on **pitch.dgtlmedia.io** via
> **deploy.dgtlmedia.io** (not Netlify). Because each page is its own slug, all cross-page links must be
> **absolute** `https://pitch.dgtlmedia.io/<slug>` URLs — relative paths won't connect across slugs.
> `scripts/make-standalone.py --page-url …` inlines assets and absolutises these links for the deploy file.

## 5. Outbound links + the two-way backlink network

This is how the page drives traffic *to the featured person* and earns links *back*:
- **Link out** to the creator's real profiles and the specific work you reference (their post, the brand
  campaign, the press). Linking to authoritative, relevant sources is good SEO and good citizenship.
- **Give the creator a reason and a way to link back.** Deliver a short **backlink kit** with the page:
  - the page URL,
  - a ready-to-post caption the creator can drop on their socials / link-in-bio ("Featured in the DGTL
    Influence Journal → <url>"),
  - a one-line suggested link text for their site's press/as-seen-in section.
  When the subject shares their own feature, you get a real, editorial backlink — the kind that actually
  moves rankings — and they get traffic and a credible third-party page about them. Everyone wins.
- If DGTL has partner/brand relationships relevant to the piece, note where a contextual link from those
  sites would be natural (the user pursues those relationships; you just flag the opportunity).

## 6. Performance & crawlability basics

- Compress captured screenshots (aim < ~300 KB each; the template lazy-loads below-fold images).
- Descriptive `alt` on every image (validate.py enforces non-empty alt).
- One `<h1>`, logical `<h2>`/`<h3>` order, semantic landmarks (already in the template).
- `canonical`, `og:*`, and `twitter:*` set to the real published URL (`CANONICAL_URL`).
- Keep the slug stable once published — changing URLs sheds ranking.

## What not to do (these get pages demoted or de-indexed)

- **No keyword stuffing** — repeating the name unnaturally, hidden text, or lists of misspellings.
- **No cloaking** — showing search engines something different from users.
- **No link schemes** — buying links, private blog networks, mass reciprocal-link swaps, or auto-generated
  link pages. Google's link-spam systems discount or penalise these.
- **No fabricated content to chase a query.** A page that's accurate and genuinely useful is the durable
  ranking strategy; anything else is a short-term risk to the whole domain.
