# Portal-led pitch sets — the escott pattern

For in-depth pitches, don't ship one page — ship a **set of sibling slugs fronted by a portal**
that leads the client through the discovery process. Recovered from the live VPS set (Jul 2026);
marked for reuse on future deep pitches.

## The escott instance

| Slug | Role |
|---|---|
| `escott-portal/` | Discovery portal — "Brand Direction Preview". The entry URL you send; walks the client through the set (SPA). |
| `escott/`, `escott2/` | Full concept-site samples (ERYTHROX), two different treatments of the same concept. |
| `escott-report/` | Market research report backing the concept. |
| `escott-brand/` | Earlier family-brand concept draft (never live; renamed from `pitches/escott` when the live slug was recovered). |

## Mechanics

- Each piece is its own folder/slug on the pitch host — individually shareable URLs, deployed
  one zip each via `deploy/portal/`.
- SPA pieces carry a zero-byte `.spa` marker (or a `_redirects` line `/* /index.html 200`);
  the deploy portal reads it and enables index.html fallback. `_headers` holds cache rules.
- The portal links to siblings by relative URL (`../escott/`), so the set survives any re-host.

## Reuse recipe

1. Slugs: `<client>-portal` + `<client>` (+ numbered/named variants) + `<client>-report`.
2. Build the samples and report first; build the portal last so it links to final slugs.
3. Register every slug in `pitches.index.json`; use each `pitch.json` `notes` to tie the set together.
