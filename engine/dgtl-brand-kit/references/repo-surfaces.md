# Applying the kit inside the DGTL monorepo

Outside this repo, `assets/dgtl-tokens.css` is the starting point: inline it and build. **Inside the
repo there are already canonical token files**, and adding a third copy is how a palette drifts.
Find out which surface you're on first.

## The three surfaces

| Surface | Canonical tokens | How to style |
|---|---|---|
| `platform/` — the Next.js app (Core OS, admin shell, login) | `platform/app/dgtl-tokens.css` | the canonical token layer, real names (`--gold`, `--text-primary`, …) |
| `journal/` — Influence Journal packs | `journal/_shared/dgtl-editorial.css` | reference the shared stylesheet; never fork it into a pack |
| `pitches/`, and anything sent as a one-off | this skill's `assets/dgtl-tokens.css` | inline it — these are self-contained by design |

The values in `assets/dgtl-tokens.css` and `journal/_shared/dgtl-editorial.css` are identical today
and must stay that way. If you change a brand value, change it in both **and** check the platform
alias layer below. There is no build step keeping them in sync — only this note.

## `platform/`: one canonical token layer

**Updated 2026-10-01.** Since 2026-08-17 every authenticated platform surface (Core OS, the legacy
admin shell, the login screen) loads `platform/app/dgtl-tokens.css`, which declares the kit's values
under their **real names**: `--gold`, `--gold-tan`, `--text-primary`, `--text-secondary`,
`--text-dim`, `--success`, `--warning`, `--error`, `--info`, `--r-control`, `--r-card`, `--r-pill`.
`platform/tests/brand-tokens.test.js` enforces the values, and forbids hex literals in `core.css`
and `dgtl-admin.css`.

The older alias layer in `platform/app/admin/dgtl-admin.css` (`--blue` holding the gold, `--white`
holding a near-black) still exists for legacy admin CSS. Don't write new code against it.

### Rules for platform work

1. **Use the canonical names** from `app/dgtl-tokens.css` in platform components: `var(--gold)`,
   not a literal, and not the legacy `--blue` alias.
2. **Never hardcode a brand value.** `#F0CF50` should not appear in a component, a page, or a tenant
   config. If a value you need isn't tokenised, add the token to `app/dgtl-tokens.css`.
3. **Gold is rationed** (CLAUDE.md): the primary action, the active nav item, brand moments. States
   use the functional palette, never gold.
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
