import { companyDuplicateMatch, contactDuplicateMatch } from "../core/duplicateRules.js";

export function duplicateReviewState(normalized, { companies = [], contacts = [] } = {}, teamId) {
  const companyCandidates = companies.flatMap((candidate) => {
    const match = companyDuplicateMatch({ ...normalized.company, teamId }, candidate);
    return match ? [{ id: candidate.id, entityType: "company", displayName: candidate.displayName, ...match }] : [];
  });
  const exactCompany = companyCandidates.find((candidate) => candidate.rule === "normalized_domain");
  const companyId = exactCompany?.id || "";
  const contactCandidates = contacts.flatMap((candidate) => {
    const match = contactDuplicateMatch({ ...normalized.contact, companyId, teamId }, candidate);
    return match ? [{ id: candidate.id, entityType: "contact", displayName: candidate.fullName || candidate.email, ...match }] : [];
  });
  const candidates = [...companyCandidates, ...contactCandidates];
  if (!normalized.company.displayName && !normalized.company.normalizedDomain) {
    return { reviewState: "invalid", validationErrors: ["Company name or domain is required."], candidates };
  }
  if (!normalized.contact.fullName && !normalized.contact.normalizedEmail) {
    return { reviewState: "invalid", validationErrors: ["Contact name or email is required."], candidates };
  }
  if (normalized.contact.email && !/^\S+@\S+\.\S+$/.test(normalized.contact.normalizedEmail)) {
    return { reviewState: "invalid", validationErrors: ["Email address is invalid."], candidates };
  }
  if (companyCandidates.length > 1 || contactCandidates.length > 1) {
    return { reviewState: "conflicting_data", validationErrors: [], candidates };
  }
  if (candidates.some((candidate) => candidate.strength === "strong")) {
    return { reviewState: "exact_match", validationErrors: [], candidates };
  }
  if (candidates.length) return { reviewState: "probable_match", validationErrors: [], candidates };
  return { reviewState: "new", validationErrors: [], candidates: [] };
}
