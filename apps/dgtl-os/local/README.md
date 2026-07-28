# Run DGTL OS locally on your Mac

Everything runs on your machine. Pick one engine:

- **Local & free (recommended)** — an open-source model via **Ollama**. No key, no cost.
- **Cloud** — the Anthropic API (needs an `sk-ant-api03` key with a little credit).

The server auto-detects: if Ollama is running, it uses it; otherwise it uses an
Anthropic key if you've added one. Your key (cloud mode) never reaches the browser.

## Prerequisite (one time)

**Node.js 18+** — check with `node --version`; install from <https://nodejs.org> if missing.

---

## Option A — Local & free with Ollama

1. Install **Ollama**: go to <https://ollama.com>, download for macOS, open the `.dmg`,
   drag **Ollama** into Applications, and open it once. It runs quietly in the menu bar.
   (No Terminal needed.)
2. Double-click **`start.command`**.
3. First run only: the server downloads a light model (`llama3.2`, ~2 GB) for you —
   you'll see progress in the black window. When it says **local model ready**, the
   engine pill in the browser reads **live · api** and `research Ledger` runs on your
   Mac, free.

Want a different model? Set it in `.env` (create the file if needed):

```
MODEL=qwen2.5:3b      # or gemma2:2b (lighter), llama3.1:8b (heavier/better), etc.
```

Nothing leaves your machine in this mode.

---

## Option B — Cloud with an Anthropic key

1. Get a key at <https://console.anthropic.com> (add a few dollars of credit under
   Billing). It starts with `sk-ant-api03-`.
2. Open **`api-key.txt`**, paste the key on its own line, save.
3. Double-click **`start.command`**.

> Note: a `sk-ant-oat01-…` token (from Claude Code / a Claude subscription) is **not**
> an API key and won't work here — you need an `sk-ant-api03-…` key from the Console.

---

## Run / stop

Double-click **`start.command`** to start (it auto-stops any previous run first).
Press **Ctrl-C** or close the window to stop. First launch, macOS may warn about an
unidentified developer — right-click `start.command` → **Open** → **Open** once.

## What's what

- `server.mjs` — zero-dependency server: serves the terminal + proxies model calls,
  auto-injects the local endpoint, auto-downloads the local model.
- `dgtl-os-terminal.html` — the terminal (self-contained copy).
- `start.command` — double-click launcher.
- `api-key.txt` / `.env` — only needed for cloud mode.

## Notes

- **Offline commands** (`client`, `proposal`, `creator`, `campaign`, previews) work
  with no engine at all. Only `research` and freeform questions call the model.
- **Local quality:** small models are quick but less sharp than the cloud model —
  bump `MODEL` to `llama3.1:8b` if your Mac has the RAM and you want better answers.
- **Not for public exposure:** no auth. To host DGTL OS online, use `../dgtl-os-api/`.
