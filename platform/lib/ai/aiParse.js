// Shared, pure transport helpers for the Claude backends. No network, no SDK
// imports — safe to use from either the Messages-API or Agent-SDK path and
// unit-testable in isolation.

export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Concatenate the text blocks from a Messages-API response message.
export function extractText(message) {
  if (!message || !Array.isArray(message.content)) return "";
  return message.content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("")
    .trim();
}

// Parse JSON the model produced, tolerating code fences and surrounding prose.
export function parseModelJson(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("The model returned an empty response.");
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(unfenced.slice(start, end + 1));
    throw new Error("The model did not return valid JSON.");
  }
}

// Walk a content tree (Messages-API blocks or Agent-SDK message contents) for
// citation/source URLs from web search/fetch results and text-block citations.
export function collectCitations(content) {
  const out = [];
  const seen = new Set();
  const push = (url, title) => {
    const u = str(url);
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ url: u, title: str(title) || u });
  };
  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!isPlainObject(node)) return;
    if (node.url && (node.type === "web_search_result" || node.type === "web_fetch_result" || node.title)) {
      push(node.url, node.title);
    }
    // Citation annotations live on text blocks as `citations: [{ url, title }]`.
    if (Array.isArray(node.citations)) {
      node.citations.forEach((c) => push(c?.url, c?.title || c?.cited_text));
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value) || isPlainObject(value)) walk(value);
    }
  };
  walk(Array.isArray(content) ? content : []);
  return out;
}
