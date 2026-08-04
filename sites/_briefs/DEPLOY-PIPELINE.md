# Fleet deploy pipeline — how a site goes from merged PR to live on Hostinger

Two halves: a GitHub Action that maintains one deploy branch per site, and
Hostinger's per-site Git deployment that pulls it. After one-time hookup per
site, deploys are just merged PRs.

## Half 1 — automatic (already built)

`.github/workflows/deploy-sites.yml` runs on every push to `main` and splits:

| Source folder | Deploy branch |
|---|---|
| `apps/creator-intake/site/` | `deploy/creator-intake` |
| `sites/<name>/` (every non-`_` folder, automatically) | `deploy/site-<name>` |

Each deploy branch contains ONLY that folder's files at its root — exactly the
shape a webroot wants. New site folder merged to main ⇒ its branch appears on
the next run with zero pipeline changes.

## Half 2 — one-time hPanel hookup, per site (~2 min)

Prereq: the website exists in hPanel with its domain connected, and
`public_html` is EMPTY (Hostinger refuses to clone into a non-empty directory
— for a site previously deployed by File Manager, delete `public_html`
contents first; anything above the webroot, like `.env`, is untouched).

1. hPanel → the website → **Advanced → GIT**.
2. Repository: `https://github.com/stfphen/dgtl` (public — no keys needed).
3. Branch: the site's deploy branch from the table above.
4. Directory: leave empty (= `public_html`).
5. Create — Hostinger clones immediately. Confirm the site serves.
6. **Auto-deploy**: copy the **Webhook URL** hPanel shows → GitHub repo →
   Settings → Webhooks → Add webhook → paste URL, content type
   `application/json`, "Just the push event" → Add.

From then on: merge to main → Action refreshes the branch → webhook fires →
Hostinger pulls → live. (The webhook fires on every push to any branch;
Hostinger just re-pulls its own branch — harmless.)

## PHP sites that need config (creator-intake pattern)

Secrets NEVER ride the pipeline. The `.env` lives one level ABOVE
`public_html` (`~/domains/<domain>/.env`), uploaded once by hand (File Manager
or scp) and edited in place. Databases are created once in hPanel and referenced
from that `.env`. Static placeholder sites need none of this.

## Manual trigger / verification

- Re-run without a code change: repo → Actions → deploy-sites → Run workflow.
- Verify branches: `git ls-remote origin 'refs/heads/deploy/*'`
- A site's branch content: `git fetch origin deploy/site-dgtl-ltd &&
  git ls-tree -r --name-only FETCH_HEAD`
