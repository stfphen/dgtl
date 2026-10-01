import { normalizeDomain, normalizeEmail, normalizePhone } from "../core/duplicateRules.js";

const NULL_MARKERS = new Set(["", "-", "n/a", "na", "none", "null", "unknown"]);
const COUNTRY_CODES = new Map([
  ["ca", "CA"], ["canada", "CA"], ["can", "CA"],
  ["us", "US"], ["usa", "US"], ["united states", "US"], ["united states of america", "US"],
  ["uk", "GB"], ["gb", "GB"], ["united kingdom", "GB"],
  ["australia", "AU"], ["au", "AU"]
]);

export function blankToNull(value) {
  const trimmed = String(value ?? "").trim();
  return NULL_MARKERS.has(trimmed.toLowerCase()) ? null : trimmed;
}

export function normalizeCompanyName(value) {
  const raw = blankToNull(value);
  if (!raw) return "";
  return raw.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim();
}

export function normalizePersonName(value) {
  const raw = blankToNull(value);
  return raw ? raw.replace(/\s+/g, " ").trim() : "";
}

export function normalizeUrl(value) {
  const raw = blankToNull(value);
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function normalizeCountry(value) {
  const raw = blankToNull(value);
  if (!raw) return "";
  return COUNTRY_CODES.get(raw.toLowerCase()) || raw;
}

export function splitName(fullName) {
  const parts = normalizePersonName(fullName).split(" ").filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function normalizeMappedRow(mapped = {}) {
  const websiteUrl = normalizeUrl(mapped.website || mapped.domain);
  const fullName = normalizePersonName(mapped.contactName || `${mapped.firstName || ""} ${mapped.lastName || ""}`);
  const split = splitName(fullName);
  const priorityValue = blankToNull(mapped.priority);
  const score = Number(blankToNull(mapped.opportunityScore));
  return {
    company: {
      displayName: normalizeCompanyName(mapped.companyName),
      websiteUrl,
      normalizedDomain: normalizeDomain(mapped.domain || websiteUrl),
      industry: blankToNull(mapped.industry) || "",
      category: blankToNull(mapped.category) || "",
      location: blankToNull(mapped.location) || "",
      country: normalizeCountry(mapped.country),
      source: blankToNull(mapped.source) || "spreadsheet"
    },
    contact: {
      fullName,
      firstName: normalizePersonName(mapped.firstName) || split.firstName,
      lastName: normalizePersonName(mapped.lastName) || split.lastName,
      title: blankToNull(mapped.title) || "",
      role: blankToNull(mapped.role) || "",
      email: blankToNull(mapped.email)?.toLowerCase() || "",
      normalizedEmail: normalizeEmail(mapped.email),
      phone: normalizePhone(mapped.phone),
      linkedinUrl: normalizeUrl(mapped.linkedinUrl)
    },
    opportunity: {
      approachAngle: blankToNull(mapped.approachAngle) || "",
      offer: blankToNull(mapped.offer) || "",
      priority: priorityValue || "",
      score: Number.isFinite(score) ? score : null
    },
    research: [
      ["company_research", mapped.research],
      ["fit_rationale", mapped.whyDgtlFits],
      ["recent_signal", mapped.recentSignals]
    ].filter(([, value]) => blankToNull(value)).map(([signalCategory, value]) => ({
      signalCategory,
      content: blankToNull(value),
      sourceType: blankToNull(mapped.source) || "spreadsheet",
      sourceUrl: normalizeUrl(mapped.sourceUrl),
      verificationStatus: "unverified"
    }))
  };
}

export { normalizeDomain, normalizeEmail, normalizePhone };
