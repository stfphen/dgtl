# DGTL OS — Knowledge layer

This is what gives DGTL OS *your* data instead of the model's guesses. Two levels,
both feeding the same thing: extra context added to the prompt on every `research`
and question.

## Level 1 — facts (`knowledge.json`)

Structured, authoritative facts: your agency overview, services, pricing, and a
record per client. The server injects the relevant bits (plus the **active client**,
if one is loaded via `client open …`) into every live answer.

Edit `knowledge.json`, then reload without a restart:

```
curl -X POST http://localhost:8787/api/kb/reload      # local
# on the VPS, it reloads on container restart, or hit the same endpoint internally
```

## Level 2 — documents (`docs/` → pgvector)

Drop real documents (`.md`/`.txt`) into `docs/`. `ingest.mjs` chunks them, embeds
each chunk with your local Ollama (`nomic-embed-text`, free), and stores them in
pgvector. On each query the server retrieves the most relevant chunks and adds them
to the prompt — so answers quote your actual material.

- Global docs: put files directly in `docs/`.
- Per-client docs: put them in `docs/<client-slug>/` (slug matches `knowledge.json`).

Build/rebuild the index (on the VPS):

```
docker compose exec dgtl-os node knowledge/ingest.mjs
```

## One-time setup on the VPS

Level 2 needs the embedding model pulled into your host Ollama:

```
ollama pull nomic-embed-text
```

pgvector runs as its own container (in `docker-compose.yml`), private to DGTL OS.

## How it behaves

- Level 1 is always on (no database needed).
- Level 2 turns on automatically when `PGVECTOR_URL` is set (it is, in the compose
  file). If the index is empty or the DB is unreachable, it silently falls back to
  Level 1 — nothing breaks.
- Check what's loaded: `curl http://localhost:8787/api/status` → `knowledge` field.

## What still doesn't have data

The scripted demo commands (`client`, `proposal`, `creator`, `campaign`) still use
the sample data baked into the page — they're UI demos. The *live* brain
(`research`, questions) is what this knowledge layer powers. Level 3 (live tools
into TwentyCRM / Plausible / MinIO / n8n) is the next step.
