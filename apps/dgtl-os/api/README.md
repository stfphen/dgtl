# DGTL OS — Live Engine (backend proxy)

The terminal (`dgtl-os-terminal.html`) auto-detects how to fire live:

1. **Inside Cowork** → it calls `window.cowork.askClaude` directly. No backend, no keys. Works immediately.
2. **Deployed / opened as a normal web page** → it POSTs to a small backend that holds your API key and talks to the model. That backend is what's in this folder.

You only need this folder for path #2 (e.g. `terminal.dgtlmedia.io`). A client-side page can't hold an API key safely, so the key lives on the server.

## What the proxy does

The terminal sends:

```json
POST /  { "prompt": "...", "system": "..." }
```

The proxy adds your key, calls the Anthropic Messages API, and returns:

```json
{ "text": "...model answer..." }
```

That's the entire contract. Two ready-to-deploy versions are included.

## Option A — Cloudflare Workers (`worker.js`)

Matches the Cloudflare-fronted stack in the DGTL OS architecture.

```bash
npm i -g wrangler
wrangler login
wrangler deploy worker.js --name dgtl-os-llm
wrangler secret put ANTHROPIC_API_KEY      # paste your key when prompted
wrangler secret put MODEL                  # optional, e.g. claude-haiku-4-5-20251001
```

Endpoint: `https://dgtl-os-llm.<your-subdomain>.workers.dev`

## Option B — Vercel / Next.js (`api/llm.js`)

Put the file at `api/llm.js` (Vercel) or `pages/api/llm.js` (Next.js), then in
**Project → Settings → Environment Variables** set:

- `ANTHROPIC_API_KEY` = `sk-ant-...`
- `MODEL` = `claude-haiku-4-5-20251001` *(optional)*

Endpoint: `https://<project>.vercel.app/api/llm`

## Point the terminal at it

Open the terminal and run:

```
config endpoint https://dgtl-os-llm.your-subdomain.workers.dev
```

The engine pill (top-right) flips to **live · api**, and `research <org>` plus any
plain-English question now stream real model output. The endpoint is remembered
in the browser (localStorage). Check status any time with `config`, verify with
`config test`, and remove it with `config clear`.

## Notes

- **CORS**: both files default to `Access-Control-Allow-Origin: *` so you can test
  fast. In production change `ALLOW_ORIGIN` to your real origin
  (e.g. `https://terminal.dgtlmedia.io`).
- **Model**: defaults to a fast, low-cost model. Swap the `MODEL` value for a larger
  one when you want deeper research answers.
- **Streaming**: this proxy returns the full completion; the terminal animates it
  with a typewriter effect. If you later want true token streaming, switch the
  upstream call to `"stream": true` (SSE) and pipe it through.
- **Never** put the API key in the HTML or any client-side file. It stays in the
  Worker secret / Vercel env var only.
