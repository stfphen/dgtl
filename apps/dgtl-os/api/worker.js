/**
 * DGTL OS — live LLM proxy (Cloudflare Worker)
 * ------------------------------------------------------------
 * Holds your API key server-side and proxies the terminal's
 * research / question requests to the Anthropic Messages API.
 *
 * The terminal (dgtl-os-terminal.html) POSTs { prompt, system }
 * and expects { text } back. That's all this does.
 *
 * DEPLOY (2 minutes):
 *   1. npm i -g wrangler && wrangler login
 *   2. wrangler deploy worker.js --name dgtl-os-llm
 *   3. wrangler secret put ANTHROPIC_API_KEY   (paste your key)
 *   4. (optional) set a model:  wrangler secret put MODEL
 *   5. In the terminal, run:  config endpoint https://dgtl-os-llm.<you>.workers.dev
 *
 * SECURITY: origins are DENIED unless allowlisted. Set the allowed origins as
 * a Worker variable before deploying:
 *   wrangler secret put ALLOWED_ORIGINS   (comma-separated, e.g.
 *   "https://terminal.dgtlmedia.io,https://dgtl-os.example")
 * With no ALLOWED_ORIGINS configured the worker refuses every browser origin —
 * a deployed-but-unconfigured worker can no longer spend the API key for
 * arbitrary sites. This proxy is legacy DGTL OS demo infrastructure; the
 * DGTL Core platform's /chat NEVER routes through it (Core talks to the
 * provider server-side via its own Stage 6 boundary).
 */

const DEFAULT_MODEL = "claude-haiku-4-5-20251001"; // fast + cheap; swap for a larger model if you want

function allowedOrigin(request, env) {
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
  const origin = request.headers.get("Origin") || "";
  return allowed.includes(origin) ? origin : null;
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (!origin) {
      return json({ text: "Origin not allowed. Configure ALLOWED_ORIGINS on the worker." }, 403, {});
    }
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST")
      return json({ text: "POST only" }, 405, cors);

    if (!env.ANTHROPIC_API_KEY)
      return json({ text: "Server missing ANTHROPIC_API_KEY. Run: wrangler secret put ANTHROPIC_API_KEY" }, 500, cors);

    let body;
    try { body = await request.json(); }
    catch { return json({ text: "Invalid JSON body" }, 400, cors); }

    const { prompt, system } = body || {};
    if (!prompt) return json({ text: "Missing 'prompt'" }, 400, cors);

    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: env.MODEL || DEFAULT_MODEL,
          max_tokens: 900,
          system: system || "You are a helpful assistant.",
          messages: [{ role: "user", content: String(prompt) }],
        }),
      });

      const data = await r.json();
      if (!r.ok) {
        const msg = (data && data.error && data.error.message) || ("Anthropic error " + r.status);
        return json({ text: "Upstream error: " + msg }, 502, cors);
      }
      const text = (data.content && data.content[0] && data.content[0].text) || "(empty response)";
      return json({ text }, 200, cors);
    } catch (e) {
      return json({ text: "Proxy error: " + (e && e.message ? e.message : e) }, 500, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
