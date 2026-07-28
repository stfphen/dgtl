/**
 * DGTL OS — local runner (zero dependencies, Node 18+)
 * ------------------------------------------------------------
 * Serves the terminal page AND proxies model calls. Two engines, auto-detected:
 *
 *   • LOCAL / FREE  — Ollama (open-source models on your Mac, no key, no cost).
 *                     If Ollama is running, it's used automatically and the
 *                     light model is downloaded for you on first run.
 *   • CLOUD         — Anthropic API (needs an sk-ant-api03 key in api-key.txt).
 *
 * Priority: forced PROVIDER  ›  Ollama if running  ›  Anthropic if key present.
 *
 * RUN:  double-click start.command   —or—   node server.mjs
 *
 * No key ever touches the browser. Local mode needs no key at all.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- .env loader (optional) ---
(() => {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
})();

// --- Anthropic key from api-key.txt (grab sk-ant token anywhere, ignore placeholder) ---
if (!process.env.ANTHROPIC_API_KEY) {
  const keyFile = path.join(__dirname, 'api-key.txt');
  if (fs.existsSync(keyFile)) {
    const raw = fs.readFileSync(keyFile, 'utf8');
    const tokens = raw.match(/sk-ant-[A-Za-z0-9_\-]{20,}/g) || [];
    const key = tokens.find(t => !/x{6,}/i.test(t));
    if (key) process.env.ANTHROPIC_API_KEY = key;
  }
}

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || '0.0.0.0';           // prod: 127.0.0.1 (behind reverse proxy)
const RATE_PER_MIN = Number(process.env.RATE_PER_MIN || 0); // 0 = off (local); set in prod
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MAX_TOKENS = Number(process.env.MAX_TOKENS || 700);   // cap response length so it stays snappy
const HTML_PATH = path.join(__dirname, 'dgtl-os-terminal.html');
const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

// ================= Knowledge layer =================
// Level 1: structured facts from knowledge/knowledge.json (always on, no deps)
// Level 2: document RAG from pgvector (on when PGVECTOR_URL is set; embeds via Ollama)
const KB_PATH = path.join(__dirname, 'knowledge', 'knowledge.json');
const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';
const PGVECTOR_URL = process.env.PGVECTOR_URL || '';
const RAG_TOPK = Number(process.env.RAG_TOPK || 5);
let KB = { org: {}, clients: {}, services: [], pricing: [] };
function loadKB() {
  try {
    KB = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
    console.log('  knowledge: ' + Object.keys(KB.clients || {}).length + ' clients loaded from knowledge.json');
  } catch { /* no KB file yet — fine */ }
}
loadKB();

function findClient(name) {
  if (!name || !KB.clients) return null;
  const key = String(name).toLowerCase().trim();
  for (const [k, v] of Object.entries(KB.clients)) {
    if (k.toLowerCase() === key || (v && (v.name || '').toLowerCase() === key)) return { slug: k, ...v };
  }
  for (const [k, v] of Object.entries(KB.clients)) {
    if (k.toLowerCase().includes(key) || (v.name || '').toLowerCase().includes(key)) return { slug: k, ...v };
  }
  return null;
}

// Level 1 — authoritative facts injected into every live answer
function kbContext(clientName) {
  const parts = [];
  if (KB.org && KB.org.name) {
    parts.push(`ABOUT DGTL: ${KB.org.name}. ${KB.org.about || ''}`.trim());
    const svc = KB.org.services || KB.services;
    if (svc && svc.length) parts.push('DGTL services: ' + (Array.isArray(svc) ? svc.join(', ') : svc) + '.');
    if (KB.pricing && KB.pricing.length)
      parts.push('Pricing/packages: ' + KB.pricing.map(p => typeof p === 'string' ? p : `${p.name} ${p.price || ''}`.trim()).join(' · ') + '.');
  }
  const c = findClient(clientName);
  if (c) {
    const bits = Object.entries(c).filter(([k]) => k !== 'slug')
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
    parts.push(`ACTIVE CLIENT — ${c.name || c.slug}: ` + bits.join('; '));
  }
  return parts.length ? '\n\nDGTL KNOWLEDGE (authoritative — prefer this over guesses):\n' + parts.join('\n') : '';
}

// Level 2 — embed the query, pull the most relevant document chunks from pgvector
async function embed(text) {
  const r = await fetch(OLLAMA_URL + '/api/embeddings', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: String(text).slice(0, 8000) }),
  });
  const d = await r.json();
  if (!r.ok || !d.embedding) throw new Error(d.error || 'embed failed');
  return d.embedding;
}
let _pgPool = null;
async function pg() {
  if (!PGVECTOR_URL) return null;
  if (_pgPool) return _pgPool;
  try {
    const { default: pkg } = await import('pg');
    _pgPool = new pkg.Pool({ connectionString: PGVECTOR_URL });
    return _pgPool;
  } catch (e) { console.log('  RAG off (pg module not available): ' + (e?.message || e)); return null; }
}
async function ragContext(query, clientName) {
  const pool = await pg();
  if (!pool) return '';
  try {
    const vec = await embed(query);
    const lit = '[' + vec.join(',') + ']';
    const c = findClient(clientName);
    const params = [lit, RAG_TOPK];
    let where = '';
    if (c) { where = 'WHERE client = $3 OR client IS NULL'; params.push(c.slug); }
    const { rows } = await pool.query(
      `SELECT source, chunk FROM dgtl_knowledge ${where} ORDER BY embedding <=> $1::vector LIMIT $2`, params);
    if (!rows.length) return '';
    return '\n\nRELEVANT DGTL DOCUMENTS:\n' + rows.map(r => `— (${r.source}) ${r.chunk}`).join('\n');
  } catch (e) { console.log('  RAG query error: ' + (e?.message || e)); return ''; }
}
// ===================================================

// simple per-IP rate limiter for /api/llm (protects the box when public)
const _hits = new Map();
function rateLimited(req) {
  if (!RATE_PER_MIN) return false;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'x';
  const now = Date.now();
  const arr = (_hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); _hits.set(ip, arr);
  return arr.length > RATE_PER_MIN;
}

let PROVIDER = 'none';
let MODEL = '';
let modelReady = false;
let pullStatus = '';

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// ---------- Ollama helpers (local, free) ----------
async function ollamaUp() {
  try { const r = await fetch(OLLAMA_URL + '/api/tags', { signal: AbortSignal.timeout(4000) }); return r.ok; }
  catch { return false; }
}
async function ollamaHasModel(m) {
  try {
    const r = await fetch(OLLAMA_URL + '/api/tags', { signal: AbortSignal.timeout(4000) });
    const d = await r.json();
    const base = m.split(':')[0];
    return (d.models || []).some(x => x.name === m || x.name === m + ':latest' || x.name.startsWith(base + ':'));
  } catch { return false; }
}
async function ollamaPull(m) {
  try {
    console.log('  downloading local model "' + m + '" (one-time)…');
    const r = await fetch(OLLAMA_URL + '/api/pull', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: m, stream: true }),
    });
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        try {
          const j = JSON.parse(line);
          if (j.error) { console.log('  pull error: ' + j.error); return; }
          if (j.status) {
            pullStatus = j.status;
            if (j.completed && j.total) pullStatus = j.status + ' ' + Math.round(100 * j.completed / j.total) + '%';
            process.stdout.write('\r  ' + pullStatus + '                              ');
          }
        } catch { /* ignore partial */ }
      }
    }
    modelReady = true;
    pullStatus = 'ready';
    console.log('\n  local model ready: ' + m + '\n');
  } catch (e) {
    console.log('  pull failed: ' + (e?.message || e));
  }
}
async function askOllama(prompt, system) {
  const r = await fetch(OLLAMA_URL + '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: String(prompt) },
      ],
      stream: false,
    }),
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || ('ollama ' + r.status));
  return d?.message?.content || '(empty response)';
}
// streams tokens straight to the HTTP response as they generate — keeps the
// connection alive so slow CPU generations never hit the proxy/Cloudflare timeout.
async function streamOllama(prompt, system, res) {
  let upstream;
  try {
    upstream = await fetch(OLLAMA_URL + '/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: String(prompt) }],
        stream: true,
        keep_alive: '30m',                    // keep the model warm between queries
        options: { num_predict: MAX_TOKENS },
      }),
    });
  } catch (e) { return json(res, 502, { text: 'Engine error: ' + (e?.message || e) }); }
  if (!upstream.ok) { let d = {}; try { d = await upstream.json(); } catch { } return json(res, 502, { text: 'Engine error: ' + (d.error || upstream.status) }); }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
  try {
    const reader = upstream.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        try { const j = JSON.parse(line); if (j.message && j.message.content) res.write(j.message.content); } catch { }
      }
    }
  } catch { /* client or upstream dropped mid-stream */ }
  res.end();
}

// ---------- Anthropic (cloud) ----------
async function askAnthropic(prompt, system) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 900,
      system: system || 'You are a helpful assistant.',
      messages: [{ role: 'user', content: String(prompt) }],
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || ('anthropic ' + r.status));
  return d?.content?.[0]?.text || '(empty response)';
}

// ---------- pick the engine ----------
async function detectProvider() {
  const forced = (process.env.PROVIDER || '').toLowerCase();
  const up = await ollamaUp();
  if (forced === 'ollama' || forced === 'local') PROVIDER = 'ollama';
  else if (forced === 'anthropic' || forced === 'cloud') PROVIDER = 'anthropic';
  else if (up) PROVIDER = 'ollama';          // prefer free local when it's running
  else if (HAS_KEY) PROVIDER = 'anthropic';
  else PROVIDER = 'ollama';                  // default target; will guide to install

  if (PROVIDER === 'ollama') {
    MODEL = process.env.MODEL || 'llama3.2';
    if (!up) {
      console.log('  ⚠  Ollama not detected. Install it (free) from https://ollama.com,');
      console.log('     open the app, then double-click start.command again.');
    } else if (await ollamaHasModel(MODEL)) {
      modelReady = true;
    } else {
      ollamaPull(MODEL); // background; /api/llm reports progress until ready
    }
  } else {
    MODEL = process.env.MODEL || 'claude-haiku-4-5-20251001';
  }
}

// ---------- HTTP ----------
const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    let html;
    try { html = fs.readFileSync(HTML_PATH, 'utf8'); }
    catch { res.writeHead(500); return res.end('dgtl-os-terminal.html not found next to server.mjs'); }
    html = html.replace('<script>', '<script>window.DGTL_LLM_ENDPOINT="/api/llm";</script>\n<script>');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  if (req.method === 'GET' && url === '/api/status') {
    return json(res, 200, { provider: PROVIDER, model: MODEL, ready: PROVIDER === 'anthropic' ? HAS_KEY : modelReady, pullStatus,
      knowledge: { clients: Object.keys(KB.clients || {}).length, rag: !!PGVECTOR_URL } });
  }

  if (req.method === 'POST' && url === '/api/kb/reload') {
    loadKB();
    return json(res, 200, { ok: true, clients: Object.keys(KB.clients || {}).length });
  }

  if (req.method === 'POST' && url === '/api/llm') {
    if (rateLimited(req)) return json(res, 429, { text: 'Rate limit — give it a few seconds and try again.' });
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      let prompt, system, client;
      try { ({ prompt, system, client } = JSON.parse(body || '{}')); }
      catch { return json(res, 400, { text: 'Invalid JSON body' }); }
      if (!prompt) return json(res, 400, { text: "Missing 'prompt'" });
      try {
        // enrich with DGTL knowledge: Level 1 facts + Level 2 document RAG
        let sys = system || '';
        sys += kbContext(client);
        sys += await ragContext(prompt, client);
        if (PROVIDER === 'ollama') {
          if (!(await ollamaUp()))
            return json(res, 503, { text: "Local model runtime (Ollama) isn't running. Install it free from https://ollama.com, open the app, and reload." });
          if (!modelReady)
            return json(res, 503, { text: 'Local model is still downloading' + (pullStatus ? ' (' + pullStatus + ')' : '') + ' — one-time setup, try again in a moment.' });
          return streamOllama(prompt, sys, res);           // stream tokens live
        }
        if (PROVIDER === 'anthropic') {
          if (!HAS_KEY) return json(res, 500, { text: 'No API key set, and no local model running.' });
          const text = await askAnthropic(prompt, sys);
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end(text);
        }
        json(res, 500, { text: 'No engine configured.' });
      } catch (e) {
        json(res, 502, { text: 'Engine error: ' + (e?.message || e) });
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// Listen FIRST so the port is always open; detect the engine in the background.
server.listen(PORT, HOST, () => {
  console.log('\n  DGTL OS listening on ' + HOST + ':' + PORT + ' — detecting engine…');
});
detectProvider().then(() => {
  const line = '─'.repeat(52);
  console.log('\n' + line);
  console.log('  DGTL OS — engine ready');
  console.log('  →  http://localhost:' + PORT);
  console.log(line);
  if (PROVIDER === 'ollama') {
    console.log('  engine: LOCAL / FREE  ·  Ollama  ·  model: ' + MODEL);
    console.log('  ' + (modelReady ? 'ready ✓' : 'preparing model — the page works now; research/questions go live once it finishes.'));
  } else {
    console.log('  engine: CLOUD  ·  Anthropic  ·  model: ' + MODEL + (HAS_KEY ? '  (key loaded)' : '  ⚠ no key'));
  }
  console.log('  Stop with Ctrl-C.\n');
}).catch(e => console.log('  detect error: ' + (e?.message || e)));
