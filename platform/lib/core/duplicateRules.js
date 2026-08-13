function clean(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeDomain(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return raw
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split(/[/?#]/)[0]
      .replace(/:\d+$/, "");
  }
}

export function normalizeEmail(value) {
  return clean(value);
}

export function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return "";
  return raw.startsWith("+") ? `+${digits}` : digits;
}

export function companyDuplicateMatch(left = {}, right = {}) {
  if (left.teamId && right.teamId && left.teamId !== right.teamId) return null;
  const leftDomain = normalizeDomain(left.normalizedDomain || left.website || left.websiteUrl);
  const rightDomain = normalizeDomain(right.normalizedDomain || right.website || right.websiteUrl);
  if (leftDomain && rightDomain && leftDomain === rightDomain) {
    return { strength: "strong", rule: "normalized_domain", requiresReview: true };
  }

  const leftName = clean(left.legalName || left.displayName || left.name);
  const rightName = clean(right.legalName || right.displayName || right.name);
  const leftLocation = [left.city, left.region, left.country].map(clean).filter(Boolean).join("|");
  const rightLocation = [right.city, right.region, right.country].map(clean).filter(Boolean).join("|");
  if (leftName && leftName === rightName && leftLocation && leftLocation === rightLocation) {
    return { strength: "review", rule: "name_and_location", requiresReview: true };
  }
  return null;
}
export function contactDuplicateMatch(left = {}, right = {}) {
  if (left.teamId && right.teamId && left.teamId !== right.teamId) return null;
  const leftEmail = normalizeEmail(left.normalizedEmail || left.email);
  const rightEmail = normalizeEmail(right.normalizedEmail || right.email);
  if (leftEmail && rightEmail && leftEmail === rightEmail) {
    return { strength: "strong", rule: "normalized_email", requiresReview: true };
  }

  const leftPhone = normalizePhone(left.phone);
  const rightPhone = normalizePhone(right.phone);
  if (leftPhone && rightPhone && leftPhone === rightPhone) {
    return { strength: "strong", rule: "normalized_phone", requiresReview: true };
  }

  const sameCompany = left.companyId && right.companyId && left.companyId === right.companyId;
  const leftName = clean(left.fullName || `${left.firstName || ""} ${left.lastName || ""}`);
  const rightName = clean(right.fullName || `${right.firstName || ""} ${right.lastName || ""}`);
  if (sameCompany && leftName && leftName === rightName) {
    return { strength: "review", rule: "company_and_name", requiresReview: true };
  }
  return null;
}
