/**
 * DGTL OS — knowledge ingest (Level 2 RAG)
 * ------------------------------------------------------------
 * Reads every .md / .txt file under knowledge/docs/, splits it into chunks,
 * embeds each with your local Ollama, and stores them in pgvector so research
 * and questions can retrieve your real documents.
 *
 * Per-client scoping: a file in  knowledge/docs/<client-slug>/...  is tagged with
 * that client (matches the slugs in knowledge.json). Files directly in docs/ are
 * global (available to every client).
 *
 * Run inside the container (has pg + network + Ollama):
 *   docker compose exec dgtl-os node knowledge/ingest.mjs
 *
 * Needs env: PGVECTOR_URL, OLLAMA_URL, EMBED_MODEL (all set in docker-compose.yml).
 * Re-run any time you add/change docs — it rebuilds the index.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';
const PGVECTOR_URL = process.env.PGVECTOR_URL;
const DOCS = path.join(__dirname, 'docs');

if (!PGVECTOR_URL) { console.error('!! PGVECTOR_URL is not set.'); process.exit(1); }

function chunk(text, size = 900, overlap = 150) {
  const clean = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const out = []; let i = 0;
  while (i < clean.length) { out.push(clean.slice(i, i + size)); i += size - overlap; }
  return out.filter(c => c.trim().length > 30);
}
async function embed(t) {
  const r = await fetch(OLLAMA_URL + '/api/embeddings', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: t.slice(0, 8000) }),
  });
  const d = await r.json();
  if (!r.ok || !d.embedding) throw new Error(d.error || 'embed failed — is the embed model pulled? (ollama pull ' + EMBED_MODEL + ')');
  return d.embedding;
}
function walk(dir, base = '') {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name); const rel = path.join(base, e.name);
    if (e.isDirectory()) files.push(...walk(p, rel));
    else if (/\.(md|markdown|txt|text)$/i.test(e.name)) files.push({ p, rel });
  }
  return files;
}

const pool = new pkg.Pool({ connectionString: PGVECTOR_URL });
async function main() {
  const dim = (await embed('dimension probe')).length;
  console.log('embed model: ' + EMBED_MODEL + ' (dim ' + dim + ')');
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await pool.query(`CREATE TABLE IF NOT EXISTS dgtl_knowledge (
    id bigserial PRIMARY KEY, client text, source text, chunk text, embedding vector(${dim}))`);
  await pool.query('TRUNCATE dgtl_knowledge');

  const files = walk(DOCS);
  if (!files.length) {
    console.log('No documents in knowledge/docs/. Add .md/.txt files (optionally in per-client subfolders) and re-run.');
    await pool.end(); return;
  }
  let n = 0;
  for (const f of files) {
    const client = f.rel.includes(path.sep) ? f.rel.split(path.sep)[0].toLowerCase() : null;
    for (const ch of chunk(fs.readFileSync(f.p, 'utf8'))) {
      const emb = await embed(ch);
      await pool.query(
        'INSERT INTO dgtl_knowledge (client, source, chunk, embedding) VALUES ($1,$2,$3,$4)',
        [client, f.rel, ch, '[' + emb.join(',') + ']']);
      n++; process.stdout.write('\r  embedded ' + n + ' chunks…   ');
    }
  }
  console.log('\nDone — indexed ' + n + ' chunks from ' + files.length + ' file(s).');
  await pool.end();
}
main().catch(e => { console.error('\n' + e.message); process.exit(1); });
