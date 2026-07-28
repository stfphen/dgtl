---
name: dgtl-brand-kit
description: The full DGTL Group brand kit and UI guide — black + gold (#F0CF50) Manrope design system, token stylesheet, component library (marketing sections AND app UI - dashboards, tables, sidebars, modals, forms, charts), 21 pre-processed white client/brand logos, and rules for applying the DGTL visual identity to ANY software or digital surface. Use this skill whenever the user wants anything built, styled, or restyled "in the DGTL style / DGTL branding / like dgtlgroup.io" — web apps, dashboards, admin panels, internal tools, SaaS UIs, prototypes, portals, client demos, email templates, widgets, docs sites, or full websites — or asks to "apply the DGTL brand kit", "make it match our branding", "DGTL-ify this", or to reskin an existing UI to DGTL. For dedicated pitch/offer LANDING pages specifically, prefer the dgtl-pitch-pages skill; use THIS skill for everything else DGTL-branded.
---

# DGTL Brand Kit & UI Guide

Apply the DGTL Group visual identity — extracted live from dgtlgroup.io — to any digital build: marketing sites, web apps, dashboards, internal tools, prototypes, or an existing UI being reskinned. The goal is always the same test: **someone who knows dgtlgroup.io should look at the result and think DGTL built it.**

This skill is deliberately unopinionated about page structure. It gives you the brand's atoms (tokens), molecules (components), and taste rules, and trusts you to compose them for whatever is being built.

## Bundled resources

1. `references/brand-tokens.md` — the source of truth: colors, type, radii, shadows, textures, logo assets, voice. Read this first, always.
2. `references/ui-components.md` — the component library: shared primitives (buttons, cards, forms, pills), marketing components (hero, marquee, stats, statement line), and app UI patterns (app shell, sidebar, tables, modals, charts, badges, empty states, auth). Read the sections relevant to your build.
3. `references/application-guide.md` — how to compose the kit per build type, restyling rules for existing UIs, common failure modes, and verification.
4. `references/repo-surfaces.md` — **read this first if the build is inside the DGTL monorepo.** The repo already has canonical token files, and `platform/` styles through a legacy alias layer where the gold accent is called `--blue`. Writing `var(--gold)` there silently does nothing.
5. `assets/dgtl-tokens.css` — drop-in stylesheet with every token as a CSS custom property plus base component classes. Inline it (or copy the variables) into any build as the starting point **outside** the repo; inside it, see `repo-surfaces.md` for which token file is canonical for that surface.
6. `assets/logos/` — DGTL logo, gold spark bolt, and 18 white client marks, pre-processed for dark backgrounds. Embed via `scripts/logo-data-urls.py` as data URLs; never hotlink client logos.
7. `scripts/verify-screenshots.mjs` — Playwright desktop+mobile screenshot capture for verification.

## Workflow

### 1. Understand the build

Establish what's being built (site, app, dashboard, component, reskin?), for whom (public visitors, clients, internal team?), and its functional requirements. The brand layer wraps the function — it never replaces figuring out what the thing needs to do. If the user is present and the build type is genuinely ambiguous, ask once; otherwise make the reasonable interpretation, state it, and proceed.

### 2. Load the kit

Read `references/brand-tokens.md` fully, then the relevant parts of `references/ui-components.md` and `references/application-guide.md`.

**If the build is inside the DGTL monorepo, read `references/repo-surfaces.md` now** and use the
canonical token file for that surface instead of inlining a fresh copy:

- `platform/` → `platform/app/admin/dgtl-admin.css`, through its alias layer (`--blue` *is* the gold
  accent; `--white` holds a near-black). Do not introduce `--gold` there.
- `journal/` → `journal/_shared/dgtl-editorial.css`. Never fork it into a pack.
- `pitches/` and one-off sends → inline `assets/dgtl-tokens.css`; these are self-contained by design.

Outside the repo, start every stylesheet from `assets/dgtl-tokens.css` — inline its contents rather than linking it, so builds stay self-contained.

Drift check: if there's evidence dgtlgroup.io was redesigned (user mentions new colors/fonts, or a fetch shows a different look), re-extract tokens from the live site instead of shipping a stale identity. Only fetch dgtlgroup.io URLs.

### 3. Compose, don't template

Design the UI the build actually needs, expressed entirely in DGTL tokens and components. The brand has a clear hierarchy of emphasis — near-black surfaces, restrained gold, quiet borders, one confident accent moment per view — described in `references/application-guide.md`. When you need a component the library doesn't define (a kanban card, a code block, a calendar), derive it from the primitives: dark surface, `#2a2a2a` border, 16px radius, Manrope, gold only for the interactive or important.

### 4. Build self-contained

Default deliverable: single-file HTML with inline CSS + vanilla JS, Google Fonts (Manrope) as the only external request, logos embedded as data URLs (`python3 scripts/logo-data-urls.py --list` for names). For multi-file projects (React apps, existing codebases), put the tokens in one CSS/theme file and import everywhere — see the application guide's restyle section.

For multiple independent surfaces, launch one general-purpose agent per surface in parallel; each agent prompt must include the paths to `brand-tokens.md`, `ui-components.md`, `application-guide.md`, and the tokens CSS, plus the build brief and the non-negotiables below.

### 5. Verify before delivering

Run `scripts/verify-screenshots.mjs` (chromium at `/opt/pw-browsers/chromium`) for desktop 1512px + mobile 390px captures, and actually look at them against the checklist in `references/application-guide.md`: gold is `#F0CF50` and used sparingly, buttons 7px radius, cards 16px with `#2a2a2a` borders, Manrope rendering, dark surfaces layered correctly, mobile usable. Validate structure: balanced tags, every base64 payload decodes. A build that fails the eyeball test is not done.

### 6. Deliver

Present the files. For deployable pages, offer a Netlify zip (`index.html` + `_headers` with `X-Content-Type-Options: nosniff`; zip root must contain index.html directly).

## Non-negotiables

- Gold `#F0CF50` is an **accent**, not a theme. Backgrounds stay black/near-black; gold marks the primary action, key numbers, and brand moments. A UI drowning in gold reads as a knockoff.
- Manrope everywhere, dark surfaces everywhere. No light mode unless the user explicitly demands one (and then it's a deliberate inversion per the application guide, not a default bootstrap look).
- Never invent DGTL clients, case studies, stats, or testimonials. Real DGTL facts live in `engine/dgtl-pitch-pages/references/brand-facts.md` and on dgtlgroup.io; anything else on a DGTL surface must come from the user or their material.
- **Never hardcode a brand value** into a component, page, pack or tenant config — reference the token. Inside the repo that means the surface's canonical token file (`references/repo-surfaces.md`), not a fresh copy of the palette.
- Client logos: only from `assets/logos/`, embedded as data URLs, white/grayscale on dark. Never hotlink, never recolor.
- Fully responsive, `prefers-reduced-motion` fallbacks, no browser-storage APIs in single-file artifacts.
