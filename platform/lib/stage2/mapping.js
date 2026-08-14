const FIELD_ALIASES = Object.freeze({
  companyName: ["company", "company name", "business", "business name", "organization", "account"],
  website: ["website", "company website", "url", "site"],
  domain: ["domain", "company domain"],
  industry: ["industry"],
  category: ["category", "vertical"],
  contactName: ["contact", "contact name", "name", "person"],
  firstName: ["first name", "firstname", "given name"],
  lastName: ["last name", "lastname", "surname"],
  title: ["job title", "title", "position"],
  role: ["role", "contact role"],
  email: ["email", "email address", "work email"],
  phone: ["phone", "phone number", "telephone"],
  linkedinUrl: ["linkedin", "linkedin url", "linkedin profile"],
  research: ["research", "company research", "notes", "research notes"],
  whyDgtlFits: ["why dgtl fits", "why dgtl fit", "fit rationale"],
  recentSignals: ["recent signals", "signals", "observed signals"],
  approachAngle: ["recommended approach angle", "pitch angle", "approach angle"],
  offer: ["offer angle", "relevant products", "relevant product/service", "recommended offer", "entry offer"],
  priority: ["priority", "tier"],
  opportunityScore: ["opportunity score", "score", "lead score"],
  location: ["location", "city", "address"],
  country: ["country", "country code"],
  source: ["source", "lead source", "provenance"],
  sourceUrl: ["source url", "research url"]
});

export const CANONICAL_IMPORT_FIELDS = Object.freeze(Object.keys(FIELD_ALIASES));

export function canonicalHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function suggestColumnMapping(headers = []) {
  const suggestions = {};
  const used = new Set();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const match = headers.find((header) => !used.has(header) && aliases.includes(canonicalHeader(header)));
    if (match) {
      suggestions[field] = match;
      used.add(match);
    }
  }
  return suggestions;
}

export function applyColumnMapping(raw = {}, mapping = {}) {
  return Object.fromEntries(CANONICAL_IMPORT_FIELDS.map((field) => [field, raw[mapping[field]] ?? ""]));
}

export function parseDelimited(input, { delimiter } = {}) {
  const text = String(input || "").replace(/^\uFEFF/, "");
  const separator = delimiter || (text.split(/\r?\n/, 1)[0]?.includes("\t") ? "\t" : ",");
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { field += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === separator && !quoted) { row.push(field); field = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((value) => String(value).trim())) rows.push(row);
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((value, index) => String(value).trim() || `Column ${index + 1}`);
  return {
    headers,
    records: rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])))
  };
}
