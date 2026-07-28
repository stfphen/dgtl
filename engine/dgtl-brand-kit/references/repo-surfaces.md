# Applying the kit inside the DGTL monorepo

Outside this repo, `assets/dgtl-tokens.css` is the starting point: inline it and build. **Inside the
repo there are already canonical token files**, and adding a third copy is how a palette drifts.
Find out which surface you're on first.

## The three surfaces

| Surface | Canonical tokens | How to style |
|---|---|---|
| `platform/` — the Next.js admin app | `platform/app/admin/dgtl-admin.css` | through the existing alias layer (below) |
| `journal/` — Influence Journal packs | `journal/_shared/dgtl-editorial.css` | reference the shared stylesheet; never fork it into a pack |
| `pitches/`, and anything sent as a one-off | this skill's `assets/dgtl-tokens.css` | inline it — these are self-contained by design |

The values in `assets/dgtl-tokens.css` and `journal/_shared/dgtl-editorial.css` are identical today
and must stay that way. If you change a brand value, change it in both **and** check the platform
alias layer below. There is no build step keeping them in sync — only this note.

## `platform/` is a reskin, not a fresh theme

`platform/app/admin/dgtl-admin.css` does not define `--gold`, `--surface-card`, or `--r-card`. The
admin UI predates the DGTL identity and carries variables named for its old blue-on-white theme. The
reskin **remaps those names** rather than renaming them everywhere:

```css
--blue:  #F0CF50;   /* the accent -> gold; cascades to every derived token */
--blue-dark: #cbab35;
--on-blue: #000;
--white: #0a0a0a;   /* dark surface ladder: the "light" names hold dark values */
--soft:  #000000;
--black: #F0F0F0;   /* and the "dark" names hold light values */
--near-black: #e6e6e6;
--line: #2a2a2a;  --border: #2a2a2a;
--radius-sm: 7px; --radius: 16px; --radius-lg: 16px;
```

The tokens are scoped to `html .v2-admin-shell` and `html .admin-login` on purpose — the public
tenant funnels never carry those classes, so they are untouched. The dark surface ladder is scoped
further, to `[data-theme="dark"]`.

**Mapping, kit name → platform name:**

| Kit token | Platform equivalent | Note |
|---|---|---|
| `--gold` `#F0CF50` | `--blue` | yes, really — the accent slot |
| `--gold` hover | `--blue-dark` `#cbab35` | |
| text-on-gold | `--on-blue` `#000` | |
| `--bg` `#000000` | `--bg` / `--soft` | same name, same value |
| `--surface-1` `#0a0a0a` | `--surface` / `--white` | |
| `--surface-2` `#111111` | `--surface-2` / `--soft-2` | |
| `--text` `#F0F0F0` | `--fg` / `--black` | |
| `--text-dim` `#8a8a8a` | `--fg-muted` / `--muted` | |
| `--border` `#2a2a2a` | `--border` / `--line` | same name, same value |
| `--r-control` `7px` | `--radius-sm` / `--fp-radius-button` | |
| `--r-card` `16px` | `--radius` / `--radius-lg` | |

### Rules for platform work

1. **Use the platform's names in platform components.** Write `var(--blue)` for the gold accent in
   `platform/`, not `var(--gold)` — the latter doesn't exist there and silently falls back to
   nothing.
2. **Never hardcode a brand value.** `#F0CF50` should not appear in a component, a page, or a tenant
   config. If a value you need isn't tokenised, add the token to `dgtl-admin.css` and reference it.
3. **Don't rename the alias layer as a drive-by.** It cascades into a large amount of pre-existing
   admin CSS. Renaming `--blue` to `--gold` is a real refactor with real regression risk — propose it
   as its own change, don't fold it into a styling task.
4. **Stay tenant-generic.** DGTL is the *default* brand, never a hardcoded assumption in a runtime
   code path. A new client is config in `platform/lib/tenants/`, not a new stylesheet.
5. **Verify with the platform's own gates:** `cd platform && npm test` and `npm run build`.

## Journal work

Shared design lives **only** in `journal/_shared/dgtl-editorial.css`. If a pack needs a treatment
that doesn't exist, add it to the shared stylesheet — never fork CSS into
`journal/packs/<slug>/`. Packs reference it as `../../_shared/dgtl-editorial.css` from a hub and
`../../../_shared/…` from a feature page.

Gate: `python3 tools/check-links.py` → `missing=0`.

## Pitches and one-off artifacts

These stay fully self-contained (inline CSS/JS, logos as data URLs) because they get sent as single
files and must survive being served from anywhere. Inline `assets/dgtl-tokens.css` here — this is
the one place duplicating the tokens is correct. Do **not** refactor a pitch onto
`journal/_shared/`.
