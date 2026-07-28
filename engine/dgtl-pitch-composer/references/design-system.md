# DGTL Group — Landing Page Design System (extracted live from dgtlgroup.io, July 2026)

Every landing page MUST use these exact tokens and components so all pages are pixel-consistent with dgtlgroup.io.

## Core tokens
- html/page background: `#000000` (pure black). Body text color `#F0F0F0`, muted text `#D0D0D0`, dimmed text `#8a8a8a`
- Accent gold: `#F0CF50` (rgb 240,207,80)
- Border color: `#2a2a2a` (1px solid) ; subtle white border: `rgba(255,255,255,0.08)`
- Radius: buttons/inputs `7px`, cards `16px`, pills `9999px`
- Font: Manrope everywhere. Load: `<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">` with fallback `ui-sans-serif, system-ui, -apple-system, sans-serif`
- Body: 16px/24px. H1 hero: 70px/77px, weight 700, letter-spacing -1.4px, white (clamp for mobile: `clamp(40px, 6vw, 70px)`)
- Section H2: ~40px, weight 700, white, centered
- Eyebrow/kicker above H2: 11-12px, uppercase, letter-spacing 0.15em, color `#b3a06a` (dim gold-tan) — e.g. "PORTFOLIO", "TESTIMONIALS"
- Background texture: black with a very subtle dark texture + faint gold diagonal lightning-bolt watermark. Recreate with: black base + `radial-gradient` vignettes + a huge, very-low-opacity (0.04–0.06) rotated copy of `/logos/spark.svg` positioned behind hero content. Keep it barely visible.

## Buttons
- Primary: background `#F0CF50`, black text, border-radius 7px, padding 15px 24px, font-weight 700, 16px, inline arrow `→` after label (small right arrow icon, gap 8px). Hover: slightly brighter/translate.
- Secondary: transparent bg, `1px solid rgba(255,255,255,0.4)`, white text, radius 7px, padding 15px 24px, weight 700, 16px.
- Text-link CTA: 14px, weight 500, color `#D0D0D0`, with `→` arrow; e.g. "Explore Services →".
- Full-width form submit: gold `#F0CF50`, black text, radius 7px, padding 14px, weight 700, arrow.

## Nav (identical on every page)
- Fixed top, height 73px, background `rgba(0,0,0,0.45)`, `backdrop-filter: blur(8px) saturate(1.8)`, border-bottom `1px solid rgba(255,255,255,0.08)`
- Logo left: `<img src="https://dgtlgroup.io/logos/logo-white-gold.svg" alt="DGTL Group" style="height:26px">` linking to https://dgtlgroup.io
- Links right, 14px weight 500: Home (https://dgtlgroup.io) · Services (https://dgtlgroup.io/services) · Work (https://dgtlgroup.io/work) · About Us (https://dgtlgroup.io/about) · Contact Us (https://dgtlgroup.io/contact). Current/hover = white; rest `#D0D0D0`.
- Max content width ~1120px centered (site uses ~1090–1120px column), padding 0 24px.

## Cards
- Card: background `rgba(0,0,0,0.45)`, border `1px solid #2a2a2a`, border-radius 16px, box-shadow `0 6px 6px rgba(0,0,0,.3), 0 0 20px rgba(0,0,0,.15)`, padding ~20px (text cards) or image-top layout (work cards).
- Work/case-study card: image top (rounded top corners, ~200px h, object-fit cover, dark overlay + white title bottom-left of image area optional), then in body: kicker line `CATEGORY · YEAR` (10-11px uppercase letter-spaced, color `#b3a06a`), bold white title 15-16px, muted 13px description, then tag pills.
- Tag pill: background `rgba(240,207,80,0.08)`, color `#F0CF50`, radius 9999px, font 11px, padding 2px 8px, display inline-flex, gap 6px between pills.
- Filter pill (if used): active = white bg/black text; inactive = transparent, `1px solid #2a2a2a`, `#D0D0D0` text; radius 9999px, 14px, padding 8px 20px.
- Testimonial card: dark card as above, brand logo (small, white/grey) top, quote 14px `#D0D0D0`, thin divider `1px solid #2a2a2a`, then avatar (36px circle) + name (13px bold white) + role/company (12px `#8a8a8a`).

## Section patterns (match site rhythm)
1. Hero: centered, huge H1, 2-3 line muted sub-paragraph (14-16px, max-width ~640px), dual CTA row (primary gold "Book a Call →" + secondary outline), generous vertical padding (~180px top / 120px bottom), scroll-mouse indicator optional.
2. Logo marquee: tiny uppercase letter-spaced label `TRUSTED BY INDUSTRY LEADERS AND INNOVATORS WORLDWIDE` (11px, #8a8a8a) then an infinite CSS marquee of client logos (grayscale/white, height ~28-34px, opacity .85, gap ~72px). Duplicate the row for seamless loop.
3. Content sections: centered H2 (optionally with eyebrow kicker above), muted sub-line, then grid of cards (3-col desktop, 1-col mobile, gap 24px).
4. Big statement section: 56-64px, weight 700, centered, color `#5a5a56` (dim), with the final word(s) in gold `#F0CF50` + blinking cursor `|` (CSS animation) — mimics the site's typewriter line.
5. Stats band: large gold numbers (e.g. 350m+, 5b+, 60+) 48-64px weight 800, small muted labels below.
6. Newsletter/CTA: centered H2 + sub + inline row [email input + gold button]. Input: bg `#0a0a0a`, border `1px solid #2a2a2a`, radius 7px, padding 12px 16px, color #F0F0F0, ::placeholder `#6a6a6a`.
7. Contact form: labels 12px `#D0D0D0` above inputs; inputs/textarea dark as above; full-width gold Submit.
8. Footer (identical on every page): 4 columns — [logo img] | "Quick Links" (Home, Services, Work, About Us, Contact Us, Privacy Policy, Terms of Use) | "Connect With Us" (Book a call with us → https://dgtlgroup.io/book-a-call, Blog → /blog, Join our team → /careers, FAQs → /faq) | "Stay Connected" (Facebook facebook.com/dgtlgroup.io, Instagram instagram.com/dgtlgroup, X x.com/dgtlgroup, LinkedIn linkedin.com/company/dgtlgroup with simple inline SVG icons). Column headings 16px bold white; links 14px `#D0D0D0`, line-height 2. Bottom line: `© 2026 DGTL. All Rights Reserved.` 12px `#8a8a8a`. Footer sits on black, top padding ~80px.


### Hero headline rotation (all archetypes)

The hero H1 rotates through **3–5 variant lines**. Requirements:

- **All variants live in the DOM** (crawlable + no-JS friendly). The first line is the strong
  default and carries `.is-active`; the rest start with `aria-hidden="true"`.
- **Each line keeps its own gold accent** via `<span class="gold">…</span>` — the accent word can
  differ per line.
- **No layout shift:** stack the lines in a single CSS grid cell so the box sizes to the tallest
  line and cycling never nudges the page.
- **Timing = reading length, clamped to 5–7s** (`dwellFor()` below).
- **Accessible:** pause on hover/focus, pause on hidden tab, and a static first line under
  `prefers-reduced-motion`.

**Markup** (Centered-Monument example; the same `.hero-rot` wrapper drops into archetypes B–E):

```html
<h1 class="hero-h1">
  <span class="hero-rot" data-hero-rotator>
    <span class="hero-rot__line is-active">Transforming brands with work people <span class="gold">remember</span>.</span>
    <span class="hero-rot__line" aria-hidden="true">Content that <span class="gold">converts</span> — not just collects likes.</span>
    <span class="hero-rot__line" aria-hidden="true">350M+ followers. 5B+ impressions. <span class="gold">Receipts, not promises.</span></span>
    <span class="hero-rot__line" aria-hidden="true">We don't chase trends. We <span class="gold">set</span> them.</span>
    <span class="hero-rot__line" aria-hidden="true">Your brand, <span class="gold">unforgettable</span>.</span>
  </span>
</h1>
```

**CSS** (add to the hero rules; keep the existing H1 font/size tokens):

```css
.hero-rot{display:grid}                     /* every line shares one grid cell -> no reflow */
.hero-rot__line{
  grid-area:1 / 1;
  opacity:0; transform:translateY(10px);
  transition:opacity .6s ease, transform .6s ease;
  pointer-events:none;
}
.hero-rot__line.is-active{opacity:1; transform:none; pointer-events:auto}
@media (prefers-reduced-motion: reduce){
  .hero-rot__line{transition:none; transform:none}
}
```

**Script** (once per page, near `</body>`):

```html
<script>
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function dwellFor(text){                          // 5-7s scaled by line length
    var words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.min(7000, Math.max(5000, 2400 + words * 520));
  }
  document.querySelectorAll('[data-hero-rotator]').forEach(function (group) {
    var lines = Array.prototype.slice.call(group.querySelectorAll('.hero-rot__line'));
    if (lines.length < 2) return;
    var i = 0, timer = null, paused = false;
    function render(n){
      lines.forEach(function (l, idx){
        var on = idx === n;
        l.classList.toggle('is-active', on);
        if (on) l.removeAttribute('aria-hidden'); else l.setAttribute('aria-hidden','true');
      });
    }
    function schedule(){ clearTimeout(timer); timer = setTimeout(advance, dwellFor(lines[i].textContent)); }
    function advance(){ if (paused) return; i = (i + 1) % lines.length; render(i); schedule(); }
    render(0);
    if (reduce) return;                              // static first line, no cycling
    schedule();
    group.addEventListener('mouseenter', function(){ paused = true; clearTimeout(timer); });
    group.addEventListener('mouseleave', function(){ paused = false; schedule(); });
    group.addEventListener('focusin',   function(){ paused = true; clearTimeout(timer); });
    group.addEventListener('focusout',  function(){ paused = false; schedule(); });
    document.addEventListener('visibilitychange', function(){
      if (document.hidden) clearTimeout(timer); else if (!paused) schedule();
    });
  });
})();
</script>
```

`dwellFor` gives ~5.0s at 5 words and ~7.0s at 9+ words; adjust the `2400` base and `520`
per-word constants to taste. Keep variant lines in a **similar length band** so the rhythm feels
even.

**Copy rules for the variants**

- **3–5 lines, one promise.** Every variant sells the same core idea from a different angle —
  benefit, outcome/proof, provocation, category line, short promise. Never introduce a second offer.
- **Line 0 is the anchor:** the strongest, most self-explanatory line — because it is what shows
  with JS off, under reduced motion, and to crawlers.
- **Similar length band** (aim ~4–9 words each) so cycling feels even and each lands in the 5–7s
  window. One punchy short line among longer ones is fine for rhythm.
- **Each line carries exactly one gold accent** on the word that matters; vary which word is gold.
- **Real facts only** (`brand-facts.md` or the prospect's sourced facts). A proof-flavoured variant
  ("350M+ followers. 5B+ impressions.") must use verified numbers.

Worked set (DGTL house): `Transforming brands with work people **remember**.` ·
`Content that **converts** — not just collects likes.` ·
`350M+ followers. 5B+ impressions. **Receipts, not promises.**` ·
`We don't chase trends. We **set** them.` · `Your brand, **unforgettable**.`

## Real asset URLs (hotlink these — they are DGTL's own)
- Logo (white+gold): https://dgtlgroup.io/logos/logo-white-gold.svg
- Gold bolt mark: https://dgtlgroup.io/logos/spark.svg
- Client logos: https://dgtlgroup.io/logos/clients/on-running.webp, guilds.webp, canon.png, swae-lee.webp, gamestop.png, walmart.svg, dji.png, polarpro.png, rotary.png, epidemic-sound.png, art-villas.png

## Voice
Confident, energetic, results-first. Action verbs (empower, unlock, elevate, scale). Concrete numbers over adjectives. Casual-professional. Primary CTA is always "Book a Call →" → https://dgtlgroup.io/book-a-call.

## Verified DGTL facts to draw from (do not invent clients or numbers beyond these)
- Positioning: full-service digital marketing agency; "Transforming Brands with Innovative Creative Solutions"; strategy, technology, creative design, and data.
- Services: Content Creation; Social Media Marketing; Influencer Marketing (via DGTL Influence subsidiary); Web Design & Development; Graphics Design; Advertising (Google, Meta and beyond).
- DGTL Influence network: 80+ creators, 350M+ combined followers, 5B+ impressions, 60+ successful campaigns. Peter McKinnon among affiliates.
- Case studies: The 400 Market website rebuild (40-year-old market → modern platform on Next.js + Payload CMS, Stripe, CRM integration, marketing automation, AI, live data; 2026) ; 400 Market Performance/SEO lift (Lighthouse 45 → 86, doubled organic traffic; closed security holes, rebuilt CDN/image pipeline; 2025) ; Canon R10 launch campaign (2024) ; Epidemic Sound "Sounds of the City" cinematic film (2024) ; Epidemic Sound creator-led TikTok relaunch (15–17s native edits, three repeatable pillars, 12M+ views organic + paid; 2023) ; Anker Nebula projector content campaign (photo/video/UGC; 2024) ; Lil Tjay Calgary live recap (2024) ; Swae Lee "A Day With" documentary (Cabana & Rebel Toronto; 2024) ; Six Senses Ibiza content campaign + influencer activation (photography, videography, FPV drone; 2024).
- Clients: On Running, Guilds, Canon, Swae Lee, GameStop, Walmart, DJI, PolarPro, Rotary, Epidemic Sound, Art Villas, Six Senses, Anker.
- Testimonials: Jelena Ljubinkovic, Social Media Channel Manager, Epidemic Sound — "Guys!!! WOW! This is awesome 😍 I love it 💖 So happy to see the results!" ; Filip Žák, Founder, Art Villas Costa Rica — "It's rare to find such young and passionate professionals. I am privileged to work with them... Their creativity, work ethic, skills and drive are exceptional. Just look at what they did for Art Villas in only 5 shooting days!"

## Asset embedding (supersedes the hotlink note above)
Conversation previews and some hosts block external image requests, so pages must be self-contained:
- DGTL logo + spark bolt: inline as `data:image/svg+xml;charset=utf-8,<urlencoded>` from `assets/logos/logo-white-gold.svg` and `spark.svg`.
- Client logos: embed the pre-processed white PNGs in `assets/logos/` as `data:image/png;base64,...` (use `scripts/logo-data-urls.py`). They are already trimmed, white-filled or grayscale-lifted, and sized ≤300×96 — total ≈100KB for all 18.
- Marquee set order: on-running, canon, dji, epidemic-sound, mercedes-benz, anker, hyundai, six-senses-ibiza, arcteryx, audi, lexus, polarpro, ford, porsche, corona, guilds-garage, rotary, canadream. Duplicate the full set twice for the seamless -50% loop.
- Testimonial marks: epidemic-sound.png (class-sized ~26px); Art Villas has no bitmap — use a white SVG text wordmark ("ART VILLAS" serif bold + "COSTA RICA" letterspaced small).
- Case-study/media imagery: never hotlink photos; build abstract dark panels with gold radial gradients + a big ghost metric ("45 → 86", "12M+").
