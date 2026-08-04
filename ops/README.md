# ops/ — internal agency automation

The **internal ops node harness**: the DGTL agency spine (prospect → audit → pitch → teaser →
deploy → reports) as an importable n8n workflow, plus the three ComfyUI render templates it calls.
This is *internal tooling only* — n8n's Sustainable Use License permits internal business use but
forbids reselling or white-labeling it, so nothing in here ships inside DGTL OS or any client
deliverable. The resellable canvas is `apps/dgtl-os/` (React Flow), a separate build.

## Layout

```
ops/
  n8n/dgtl-agency-spine.json     # import into n8n — the full agency spine
  comfyui/dgtl-brand-plate.json  # ComfyUI (UI import) — SDXL hero backgrounds, black + gold
  comfyui/dgtl-upscale.json      # ComfyUI (UI import) — 4x upscale for logos/screenshots
  comfyui/dgtl-broll-i2v.json    # ComfyUI (UI import) — image→video b-roll (SVD baseline)
```

## The spine (n8n)

Mirrors the architecture mockup one-to-one:

- **Prospect Intake** — n8n form trigger (URL, business name, notes) → **Job Config** derives the
  slug and holds constants (repo path, ComfyUI host, gold `#F0CF50`).
- **Client Audit / Pitch Composer / Teaser Build / Client Reports** are Execute Command nodes that
  invoke `claude -p` with the corresponding repo skills (`dgtl-client-audit`,
  `dgtl-pitch-composer`, `dgtl-pitch-teasers`, `dgtl-client-reports`). The agent harness *is*
  Claude Code; n8n only sequences it.
- **Comfy · Brand Plate** POSTs an API-format SDXL graph to `POST /prompt`, waits, then fetches
  `GET /history/<prompt_id>`. The render runs in parallel with the audit; a Merge node joins both
  before the pitch composer.
- **Link Check Gate** runs `python3 tools/check-links.py` — the same completion gate CLAUDE.md
  requires; a failing exit code halts the run before anything stages.
- **Stage to Decks** copies `pitches/<slug>/` into `deploy/decks/site/pitch/<slug>/` and rebuilds
  the gallery index. **Deploy to VPS ships disabled** — going live is `git push` + `./deploy.sh`
  on the VPS, and that stays a human decision.
- **Monthly Report Trigger** (1st of the month, 09:00) → `dgtl-client-reports` — the QBR loop from
  the mockup's dashed edge.

Live URL pattern is **`https://pitch.dgtlmag.com/<slug>/`** — the mockup's `pitch.dgtlmedia.io`
and `deploy.dgtlmedia.io` are dead (domain lost, Hostinger box offboarded 2026-07-21; see
`deploy/decks/README.md`).

### Import & host requirements

1. Run n8n **on the Mac, not in Docker** — the Execute Command nodes need the `claude` CLI, this
   repo checkout, and Python: `npx n8n`.
2. n8n → Workflows → *Import from File* → `ops/n8n/dgtl-agency-spine.json`.
3. ComfyUI must be listening on `http://127.0.0.1:8188` (edit Job Config if not).
4. Open the form trigger's test URL to feed a prospect in.

Execute Command nodes run whatever the workflow says with your user's permissions — treat edits to
this file like code review, and keep n8n bound to localhost.

## The render templates (ComfyUI)

Drag any of the three JSON files onto the ComfyUI canvas (or *Workflow → Open*). Checkpoints they
expect (swap in the loader node if yours differ):

| Template | Model | Notes |
|---|---|---|
| brand-plate | `sd_xl_base_1.0.safetensors` | 1920×1088 black + gold hero, prompt carries the brand language |
| upscale | `4x-UltraSharp.pth` (upscale_models/) | logos and site screenshots for pitch pages |
| broll-i2v | `svd_xt_1_1.safetensors` | SVD baseline, 25 frames @ 8fps WEBP; swap for Wan/LTX if installed |

The n8n spine embeds its own API-format copy of the brand-plate graph, so edits to the ComfyUI
file do **not** automatically flow into the spine — change both, or better, re-export the API
format (*Workflow → Export (API)*) and paste it into the HTTP node's JSON body.

## v2 hardening (what's built in)

- **Render poll loop** — `POST /prompt` → wait 20s → `GET /history/<id>` → done? → loop until the
  render exists, then the output filename is extracted and handed to the pitch composer.
- **Audit PDF pickup** — a `find` node locates the newest PDF matching the slug (last 6h) and the
  path lands in the Run Summary.
- **Failure path** — if `check-links.py` exits non-zero, the run branches to a macOS notification
  ("link check FAILED") and nothing stages.
- **macOS notifications** (osascript, credential-free) on run complete, link-check failure, and
  monthly reports ready.
- **Retries** on both ComfyUI HTTP calls (3 tries, 5s apart); `executeOnce` on every node after
  the merge so a multi-item payload can never double-run a Claude skill.

## Known gaps (deliberate)

- **Upscale and b-roll are not yet wired into the spine** — they follow the same
  `POST /prompt` → poll pattern as the brand plate when needed; import their `ops/comfyui/`
  templates for manual runs.
- **No stall guard on the poll loop** — if ComfyUI hangs forever the run loops until cancelled;
  ComfyUI errors still resolve (history records failures), so this only bites if the server dies
  mid-job.

## If every Claude node shows "?" after import

You imported into **n8n Cloud**, where Execute Command does not exist (and never will — it runs
arbitrary shell). This workflow is Mac-local by design: run `npx n8n`, import there instead.
