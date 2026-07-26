# Hero Rotation — patch for `dgtl-pitch-pages` + `dgtl-pitch-teasers`

**Goal:** the hero H1 on every generated pitch page and teaser rotates through **3–5 strong
headline variants**, each held for **5–7 seconds scaled by how long the line takes to read**,
instead of showing one fixed headline.

**Why a patch and not a live edit:** the skill copies visible in a Cowork session are a read-only
cache — editing them there does not change your installed skill. Apply the edits below to wherever
you maintain the skill source (the plugin repo / marketplace you publish from), or manage installed
skills under **Settings → Capabilities**. `hero-rotator-demo.html` in this folder is the working
reference — open it to see the exact behaviour these edits produce.

The change is deliberately **token-safe**: colours, Manrope, gold-as-accent, the 70px H1, and the
nav/footer are untouched. Only the headline gains motion, so it stays unmistakably DGTL and works
with every hero archetype (A–E) in `variance-system.md`.

---

## 1. What changes, in one line

The single `<h1>…<span class="gold">word</span></h1>` becomes a small stack of 3–5 `<h1>`-level
variant lines. Line 0 is the strongest, safest headline and is the only one shown with JS off or
under `prefers-reduced-motion`; JS cross-fades through the rest on a reading-length timer.

---

## 2. Shared block — add to BOTH `references/design-system.md` files

Add this new subsection right after **"## Section patterns (match site rhythm)"** (it is identical
in both skills so the two stay in lockstep).

> ### Hero headline rotation (all archetypes)
>
> The hero H1 rotates through **3–5 variant lines**. Requirements:
> - **All variants live in the DOM** (crawlable + no-JS friendly). The first line is the strong
>   default and carries `.is-active`; the rest start with `aria-hidden="true"`.
> - **Each line keeps its own gold accent** via `<span class="gold">…</span>` — the accent word can
>   differ per line.
> - **No layout shift:** stack the lines in a single CSS grid cell so the box sizes to the tallest
>   line and cycling never nudges the page.
> - **Timing = reading length, clamped to 5–7s** (`dwellFor()` below).
> - **Accessible:** pause on hover/focus, pause on hidden tab, and a static first line under
>   `prefers-reduced-motion`.
>
> **Markup** (Centered-Monument example; the same `.hero-rot` wrapper drops into archetypes B–E):
>
> ```html
> <h1 class="hero-h1">
>   <span class="hero-rot" data-hero-rotator>
>     <span class="hero-rot__line is-active">Transforming brands with work people <span class="gold">remember</span>.</span>
>     <span class="hero-rot__line" aria-hidden="true">Content that <span class="gold">converts</span> — not just collects likes.</span>
>     <span class="hero-rot__line" aria-hidden="true">350M+ followers. 5B+ impressions. <span class="gold">Receipts, not promises.</span></span>
>     <span class="hero-rot__line" aria-hidden="true">We don't chase trends. We <span class="gold">set</span> them.</span>
>     <span class="hero-rot__line" aria-hidden="true">Your brand, <span class="gold">unforgettable</span>.</span>
>   </span>
> </h1>
> ```
>
> **CSS** (add to the hero rules; keep the existing H1 font/size tokens):
>
> ```css
> .hero-rot{display:grid}                     /* every line shares one grid cell → no reflow */
> .hero-rot__line{
>   grid-area:1 / 1;
>   opacity:0; transform:translateY(10px);
>   transition:opacity .6s ease, transform .6s ease;
>   pointer-events:none;
> }
> .hero-rot__line.is-active{opacity:1; transform:none; pointer-events:auto}
> @media (prefers-reduced-motion: reduce){
>   .hero-rot__line{transition:none; transform:none}
> }
> ```
>
> **Script** (once per page, near `</body>`):
>
> ```html
> <script>
> (function () {
>   var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
>   function dwellFor(text){                          // 5–7s scaled by line length
>     var words = text.trim().split(/\s+/).filter(Boolean).length;
>     return Math.min(7000, Math.max(5000, 2400 + words * 520));
>   }
>   document.querySelectorAll('[data-hero-rotator]').forEach(function (group) {
>     var lines = Array.prototype.slice.call(group.querySelectorAll('.hero-rot__line'));
>     if (lines.length < 2) return;
>     var i = 0, timer = null, paused = false;
>     function render(n){
>       lines.forEach(function (l, idx){
>         var on = idx === n;
>         l.classList.toggle('is-active', on);
>         if (on) l.removeAttribute('aria-hidden'); else l.setAttribute('aria-hidden','true');
>       });
>     }
>     function schedule(){ clearTimeout(timer); timer = setTimeout(advance, dwellFor(lines[i].textContent)); }
>     function advance(){ if (paused) return; i = (i + 1) % lines.length; render(i); schedule(); }
>     render(0);
>     if (reduce) return;                              // static first line, no cycling
>     schedule();
>     group.addEventListener('mouseenter', function(){ paused = true; clearTimeout(timer); });
>     group.addEventListener('mouseleave', function(){ paused = false; schedule(); });
>     group.addEventListener('focusin',   function(){ paused = true; clearTimeout(timer); });
>     group.addEventListener('focusout',  function(){ paused = false; schedule(); });
>     document.addEventListener('visibilitychange', function(){
>       if (document.hidden) clearTimeout(timer); else if (!paused) schedule();
>     });
>   });
> })();
> ```
>
> `dwellFor` gives ~5.0s at 5 words and ~7.0s at 9+ words; adjust the `2400` base and `520`
> per-word constants to taste. Keep variant lines in a **similar length band** so the rhythm feels
> even. Optional: a row of gold dot indicators — see `hero-rotator-demo.html`.

---

## 3. `dgtl-pitch-teasers/references/teaser-blueprint.md` — §2 Hero

**Replace** the sentence *"H1 with the last word(s) in gold."* in item **2. Hero — the ONE idea.**
with:

> H1 that **rotates through 3–5 headline variants** (each a complete hook with its own gold accent
> word), cross-fading every **5–7s scaled by reading length** — see *Hero headline rotation* in
> `design-system.md`. Line 0 is the strongest single line and is what shows with JS off or under
> reduced motion. The rotation is the hook working harder; it does **not** license a second idea —
> every variant sells the same one promise from a different angle.

---

## 4. `dgtl-pitch-pages/references/page-blueprint.md` — §2 Hero

**Replace** *"H1 with the last word(s) in gold (`.h1-gold`/`.gold` span)"* in item **2. Hero** with:

> H1 that **rotates through 3–5 headline variants** (each with its own `.gold` accent span),
> cross-fading every **5–7s scaled by reading length** — see *Hero headline rotation* in
> `design-system.md`. Line 0 is the canonical headline (shown with JS off / reduced motion).

**Also** update the agent-prompt template (STEP 3) line
*"Conversion copy in DGTL voice; hero H1 punchy with gold accent word; NO lorem ipsum."* to:

> Conversion copy in DGTL voice; write **3–5 rotating hero H1 variants** (one strong line 0 + 2–4
> alternates, each with a gold accent word, similar length); NO lorem ipsum.

---

## 5. Copy rules for the variants (add under "Copy rules")

- **3–5 lines, one promise.** Every variant sells the same core idea from a different angle —
  benefit, outcome/proof, provocation, category line, short promise. Never introduce a second offer.
- **Line 0 is the anchor:** the strongest, most self-explanatory line — because it is what shows
  with JS off, under reduced motion, and to crawlers.
- **Similar length band** (aim ~4–9 words each) so cycling feels even and each lands in the 5–7s
  window. One punchy short line among longer ones is fine for rhythm.
- **Each line carries exactly one gold accent** on the word that matters; vary which word is gold.
- **Real facts only** (`brand-facts.md` or the prospect's sourced facts). A proof-flavoured variant
  ("350M+ followers. 5B+ impressions.") must use verified numbers.

**Worked set (DGTL house):** `Transforming brands with work people **remember**.` ·
`Content that **converts** — not just collects likes.` ·
`350M+ followers. 5B+ impressions. **Receipts, not promises.**` ·
`We don't chase trends. We **set** them.` · `Your brand, **unforgettable**.`

---

## 6. Archetype notes (`variance-system.md`)

Rotation is compatible with all five hero archetypes; the `.hero-rot` wrapper goes around the
headline wherever that archetype places it. For **E · Statement-First** (typewriter), let each
variant type/erase rather than cross-fade, or keep the typewriter on line 0 only and cross-fade the
rest — don't run both effects at once (honours the "one confident accent moment per view" guardrail).

---

## 7. Apply checklist

- [ ] Add the shared block (§2) to **both** `design-system.md` files.
- [ ] Patch teaser `teaser-blueprint.md` §2 (§3 here).
- [ ] Patch pages `page-blueprint.md` §2 + agent prompt (§4 here).
- [ ] Add copy rules (§5) and archetype note (§6).
- [ ] Republish the skill from your source, or update via **Settings → Capabilities**.
- [ ] Regenerate one page + one teaser and confirm the headline cycles 5–7s and holds line 0 under
      reduced motion.

---

## APPLIED — 2026-07-25

Applied to the skill sources in `engine/`, which is now the source of truth (see `engine/README.md`).
This patch is kept as the record of *why* the change was made; do not re-apply it.

- [x] Shared block (§2) added to `design-system.md` in `dgtl-pitch-pages`, `dgtl-pitch-teasers` **and
      `dgtl-pitch-composer`** — the composer did not exist when this patch was written but shares the
      same design system, so it was included to keep the three in lockstep.
- [x] Teaser `teaser-blueprint.md` §2 Hero patched.
- [x] Pages `page-blueprint.md` §2 Hero + agent prompt (STEP 3) patched; the same agent-prompt line in
      the composer's `build-verify-deploy.md` patched too.
- [x] Copy rules (§5) folded into the shared block rather than kept separate, so they travel with the
      markup they govern.
- [x] Archetype E note (§6) added to `variance-system.md`.
- [ ] **Re-export to the installed skills** — `python3 tools/export-skills.py --all --to <dir>`.
- [ ] **Regenerate one page + one teaser** and confirm the headline cycles 5–7s and holds line 0
      under reduced motion. Not yet done — the rotation ships untested against a real build.
