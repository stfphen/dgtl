# DGTL brand voice — for creator features

DGTL sounds **confident, energetic, results-first**. Concrete numbers over adjectives.
Casual-professional — the register of a sharp trade publication, not a press release.
The reader should feel the writer knows the work and respects the creator.

## Principles

- **Lead with the real thing.** Open on a specific, true detail (a project, a number, a moment), not a generic windup. "Peter McKinnon didn't chase a trend to six million subscribers — he taught." beats "In today's fast-paced creator economy…".
- **Numbers are the drama.** A verified figure ("12M+ views", "45→86", "one day, two venues") carries more than a pile of adjectives. Use the numbers you actually have; don't manufacture them.
- **Respect the subject.** These are features *about* creators, meant to platform them. Admiring but not fawning; specific praise grounded in the work, never invented quotes in their mouth.
- **Active verbs.** Empower, unlock, elevate, scale, build, ship, move. Trim hedges and filler.
- **Arrows on CTAs.** "Book a Call →", "See the work →" — a brand tic. Keep them.
- **Gold-word headlines.** The H1 splits into plain text + one accent phrase (`HEADLINE_GOLD`). Put the emotional punch in the gold phrase.

## Headline formulas (name-forward, on-voice, SEO-safe)

The `<title>` and H1 must contain the creator's name (it's the primary keyword). Patterns that work:

- **Name + what they did:** "Peter McKinnon: The Educator Who Turned Craft Into an Audience"
- **The work as the hook:** "One Day With Swae Lee. A Whole Campaign in the Can."
- **The number as the hook:** "How <Name> Turned One Shoot Into 12M Views"
- **The claim, then the receipt:** "<Name> Doesn't Chase Trends. <gold>He Builds Trust.</gold>"

For the H1 tokens, split so the gold phrase is the punch:
`HEADLINE_A` = "The educator who turned " · `HEADLINE_GOLD` = "craft into an audience."
Keep the *title tag* (`TITLE`) name-first and ≤ ~60 characters; the on-page H1 can be a touch more expressive.

## Dek / standfirst (the `DEK`)

One or two sentences under the headline that promise the payoff and name the association (brand, work, platform). Muted, confident. Example shape: "<Name> didn't <easy path> — <what they actually did>. Inside <the value>, and why <the bigger point>."

## Body

- **Lead paragraph** states who they are and why they matter, with the name in the first sentence.
- **Two H2 sections**: one on the value/craft, one on the context (the campaign, the network, the method). Sub-claims backed by real detail.
- **Pull-quote**: an editorial line that crystallises the point — *unattributed editorial* is fine ("— The DGTL Influence view"). Only put words in a real person's mouth if they actually said them and you can cite it.
- **Key-takeaways callout**: 3–4 scannable bullets — doubles as featured-snippet bait.
- **FAQ**: see `seo-and-backlinks.md` — phrased as the questions people actually search about this person.

## Don'ts

- No invented quotes, awards, or stats. No "in the fast-paced world of…". No emoji in body copy (a verified testimonial that contains one is fine, quoted exactly).
- Don't overclaim the DGTL relationship. If the user hasn't said the creator is in the network, write them as a creator DGTL is *featuring/covering*, not a signed member.
- Don't drown the page in gold or in the keyword. Write it so a smart reader enjoys it; the ranking follows.
