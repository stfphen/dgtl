/**
 * DGTL OS — live LLM proxy (Vercel / Next.js serverless function)
 * ------------------------------------------------------------
 * Drop this at /api/llm.js in a Vercel project (or Next.js pages/api/llm.js).
 * It holds your API key server-side and proxies the terminal's requests
 * to the Anthropic Messages API. Terminal POSTs { prompt, system } → { text }.
 *
 * DEPLOY:
 *   1. Put this repo (with api/llm.js) on Vercel.
 *   2. Project → Settings → Environment Variables:
 *        ANTHROPIC_API_KEY = sk-ant-...
 *        MODEL             = claude-haiku-4-5-20251001   (optional)
 *   3. Deploy. Your endpoint is https://<project>.vercel.app/api/llm
 *   4. In the terminal:  config endpoint https://<project>.vercel.app/api/llm
 *
 * SECURITY: origins are DENIED unless allowlisted. Set ALLOWED_ORIGINS as an
 * environment variable (comma-separated, e.g.
 * "https://terminal.dgtlmedia.io"). With no ALLOWED_ORIGINS configured the
 * proxy refuses every browser origin, so a deployed-but-unconfigured proxy
 * cannot spend the API key for arbitrary sites.
 */

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  const allowed = String(process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
  const origin = req.headers.origin || "";
  if (!allowed.includes(origin)) {
    return res.status(403).json({ text: "Origin not allowed. Configure ALLOWED_ORIGINS." });
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ text: "POST only" });

  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(500).json({ text: "Server missing ANTHROPIC_API_KEY env var." });

  const { prompt, system } = (typeof req.body === "string" ? safeParse(req.body) : req.body) || {};
  if (!prompt) return res.status(400).json({ text: "Missing 'prompt'" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.MODEL || DEFAULT_MODEL,
        max_tokens: 900,
        system: system || "You are a helpful assistant.",
        messages: [{ role: "user", content: String(prompt) }],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = data?.error?.message || `Anthropic error ${r.status}`;
      return res.status(502).json({ text: "Upstream error: " + msg });
    }
    const text = data?.content?.[0]?.text || "(empty response)";
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ text: "Proxy error: " + (e?.message || e) });
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
