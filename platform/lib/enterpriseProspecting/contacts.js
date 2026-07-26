// Contact handling for the Gate-2 handoff into the existing lead pipeline.
// Pure functions: build the lead-input objects; the route persists them via the
// existing store.createLead (so contacts become normal team-scoped leads that the
// outreach engine — with its caps + suppression + human send approval — handles).

import { canFeedOutreach } from "./gates.js";

function asWebsite(domain) {
  if (!domain) return "";
  return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
}

// Contacts eligible to become leads: must have a name and a non-empty email that
// is at least pattern-known (never promote "unknown"-email rows).
export function promotableContacts(account = {}) {
  const committee = Array.isArray(account.buyingCommittee) ? account.buyingCommittee : [];
  return committee.filter((c) => c && c.name && c.email && c.emailStatus && c.emailStatus !== "unknown");
}

export function verifiedContacts(account = {}) {
  return promotableContacts(account).filter((c) => c.emailStatus === "verified");
}

/**
 * buildLeadInputsFromAccount({ account, teamId, tenantId, campaign }) -> [leadInput]
 * Maps promotable committee contacts to createLead inputs, tagged with the account
 * linkage in metadata. Unverified-email contacts are flagged needsVerification so
 * the pipeline/outreach surfaces them before a human approves the send (Gate 3).
 */
export function buildLeadInputsFromAccount({ account = {}, teamId, tenantId = "", campaign = null } = {}) {
  const website = asWebsite(account.domain);
  const city = account.firmographics?.hqGeo || "";
  const category = account.firmographics?.industry || "";

  return promotableContacts(account).map((contact) => ({
    teamId,
    tenantId,
    businessName: account.name,
    contactName: contact.name,
    email: contact.email,
    website,
    city,
    category,
    sourceType: "enterprise_prospect",
    metadata: {
      accountId: account.id || "",
      accountTier: account.tier ?? null,
      segment: account.segment || "",
      roleLabel: contact.roleLabel || "",
      title: contact.title || "",
      emailStatus: contact.emailStatus,
      needsVerification: contact.emailStatus !== "verified",
      contactSource: contact.source || "",
      contactConfidence: contact.confidence || "",
      campaignName: campaign?.name || "",
      campaignBudgetBand: campaign?.budgetBand || ""
    }
  }));
}

/**
 * Guard used by the Gate-2 route: refuse to promote contacts unless the account
 * has cleared Gate 2 (defense in depth alongside the queue's own check).
 */
export function assertCanFeedOutreach(account = {}) {
  if (!canFeedOutreach(account.gateStatus)) {
    const error = new Error("Account has not cleared Gate 2; contacts cannot enter outreach.");
    error.code = "GATE2_REQUIRED";
    error.status = 409;
    throw error;
  }
}
