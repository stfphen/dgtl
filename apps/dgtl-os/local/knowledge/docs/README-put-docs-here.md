# Put your real documents here

Anything you drop in this folder becomes searchable by `research` and by plain
questions (Level 2 RAG). Supported: `.md` and `.txt`.

- Files **directly in `docs/`** are **global** — available for every client.
  Example: `docs/dgtl-services.md`, `docs/pricing.md`, `docs/case-studies.md`.
- Files in a **subfolder named after a client slug** are scoped to that client
  (the slug must match a key in `knowledge.json`). Example:
  `docs/example-client/brief.md`, `docs/example-client/brand-guide.md`.

After adding or changing files, rebuild the index:

```
docker compose exec dgtl-os node knowledge/ingest.mjs
```

Tips: paste in real briefs, brand guides, past proposals, meeting notes,
positioning docs. Bigger + more specific = better answers. Delete this file once
you've added your own.
