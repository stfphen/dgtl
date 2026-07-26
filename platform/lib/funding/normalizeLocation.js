/**
 * Jurisdiction parsing for funding eligibility.
 *
 * Critical rule: NEVER default unknown or foreign locations to Canada. A funding
 * match against a Canadian program must only happen when Canada (and, for
 * province-gated programs, the province) is explicitly identified. Unknown or
 * foreign input returns null so the scorer can disqualify it rather than guess.
 */

const CA_PROVINCES = [
  { name: "Ontario", patterns: [/\bontario\b/, /\bon\b/] },
  { name: "British Columbia", patterns: [/\bbritish columbia\b/, /\bbc\b/] },
  { name: "Alberta", patterns: [/\balberta\b/, /\bab\b/] },
  { name: "Quebec", patterns: [/\bquebec\b/, /\bquébec\b/, /\bqc\b/] },
  { name: "Manitoba", patterns: [/\bmanitoba\b/, /\bmb\b/] },
  { name: "Saskatchewan", patterns: [/\bsaskatchewan\b/, /\bsk\b/] },
  { name: "Nova Scotia", patterns: [/\bnova scotia\b/, /\bns\b/] },
  { name: "New Brunswick", patterns: [/\bnew brunswick\b/, /\bnb\b/] },
  { name: "Newfoundland and Labrador", patterns: [/\bnewfoundland\b/, /\blabrador\b/, /\bnl\b/] },
  { name: "Prince Edward Island", patterns: [/\bprince edward\b/, /\bpei\b/, /\bpe\b/] },
  { name: "Yukon", patterns: [/\byukon\b/, /\byt\b/] },
  { name: "Northwest Territories", patterns: [/\bnorthwest territories\b/, /\bnwt\b/, /\bnt\b/] },
  { name: "Nunavut", patterns: [/\bnunavut\b/, /\bnu\b/] }
];

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function matchProvince(text) {
  for (const province of CA_PROVINCES) {
    if (province.patterns.some((pattern) => pattern.test(text))) return province.name;
  }
  return null;
}

/**
 * Canonicalize an explicit country value to "Canada" | "United States" | null.
 * Foreign or unrecognized values return null (treated as "not Canada").
 */
export function canonicalCountry(value = "") {
  const text = normalizeText(value);
  if (!text) return null;
  if (text.includes("canada")) return "Canada";
  if (text.includes("united states") || text.includes("usa") || text === "us" || text.includes("u.s.") || text.includes("america")) {
    return "United States";
  }
  return null;
}

/**
 * Canonicalize an explicit province value to a full Canadian province name or null.
 */
export function canonicalProvince(value = "") {
  const text = normalizeText(value);
  if (!text) return null;
  return matchProvince(text);
}

/**
 * Resolve a jurisdiction from a free-text location and/or explicit country/province.
 * @returns {{ country: "Canada"|"United States"|null, province: string|null, confidence: "high"|"medium"|"unknown" }}
 */
export function parseJurisdiction(locationText = "", { country, province } = {}) {
  const text = normalizeText(locationText);

  // Province: explicit value, else a Canadian province token in the text.
  const resolvedProvince = canonicalProvince(province) || matchProvince(text);

  // An explicit but unrecognized (foreign) country means "not Canada" — stop.
  const explicitCountryRaw = normalizeText(country);
  let resolvedCountry = canonicalCountry(country);
  if (explicitCountryRaw && !resolvedCountry) {
    return { country: null, province: null, confidence: "unknown" };
  }

  // Country: explicit, else implied by a Canadian province, else from the text.
  if (!resolvedCountry) {
    if (resolvedProvince) resolvedCountry = "Canada";
    else if (text.includes("canada")) resolvedCountry = "Canada";
    else resolvedCountry = canonicalCountry(text); // "United States" or null
  }

  if (!resolvedCountry && !resolvedProvince) {
    return { country: null, province: null, confidence: "unknown" };
  }

  const confidence = resolvedProvince ? "high" : "medium";
  return { country: resolvedCountry || null, province: resolvedProvince || null, confidence };
}
