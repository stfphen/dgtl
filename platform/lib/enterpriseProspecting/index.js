// Enterprise Prospecting orchestration — public surface for routes/UI.
// Re-exports the pure modules and adds a few thin orchestration helpers that
// compose them. No persistence here (routes own store calls); these stay pure
// and testable.

export * from "./gates.js";
export * from "./accountFit.js";
export * from "./campaignScope.js";
export * from "./contacts.js";
export * from "./sourcing.js";
export { mockAccountSearch, mockResearchDossier } from "./mockSourcing.js";

import { mockAccountSearch, mockResearchDossier } from "./mockSourcing.js";
import { scoreAccountFit, recommendedGateAfterScore, DEFAULT_ICP } from "./accountFit.js";

/**
 * previewAccounts({ query, segment, icp }) -> [{...account, fit, recommendedNextGate}]
 * Sourcing + fit-scoring in one pass. Uses mock sourcing for the MVP; swap in
 * real provider/open-DB adapters behind the same shape later.
 */
export function previewAccounts({ query = "", segment = "", icp = DEFAULT_ICP, limit = 25 } = {}) {
  const found = mockAccountSearch({ query, segment, limit });
  return found.map((account) => {
    const fit = scoreAccountFit(account, icp);
    return {
      ...account,
      tier: fit.tier,
      fitScore: fit.fitScore,
      fitRationale: fit.rationale,
      fit,
      recommendedNextGate: recommendedGateAfterScore(fit)
    };
  });
}

/**
 * researchAccountOffline(account) -> { dossier, patch }
 * Offline research fallback (no AI keys). Returns a dossier and a field patch to
 * merge into the stored account (signals/committee/dataGaps/dossier).
 */
export function researchAccountOffline(account = {}) {
  const dossier = mockResearchDossier(account);
  const patch = {
    signals: dossier.signals,
    buyingCommittee: dossier.buyingCommittee,
    dataGaps: dossier.dataGaps,
    dossier
  };
  return { dossier, patch };
}

/**
 * dossierFromResearchLead(lead-style dossier) -> patch for a target account.
 * Adapter so a real researchLead() result (decisionMakers/signals/verifiedContacts)
 * maps onto the account's buyingCommittee/signals shape when AI is configured.
 */
export function patchFromResearchLeadDossier(dossier = {}) {
  const committee = (dossier.decisionMakers || []).map((dm) => ({
    roleLabel: "influencer",
    name: dm.name || "",
    title: dm.title || "",
    isPrimary: false,
    email: "",
    emailStatus: "unknown",
    source: dm.sourceUrl || "",
    confidence: dm.confidence || "low",
    profileUrl: dm.profileUrl || ""
  }));
  // Attach verified emails to matching committee members where possible.
  const emails = (dossier.verifiedContacts?.emails || []).map((e) => e.value).filter(Boolean);
  if (emails.length && committee[0]) {
    committee[0] = { ...committee[0], email: emails[0], emailStatus: "verified", isPrimary: true };
  }
  const signals = (dossier.signals || []).map((s) => ({
    type: s.type || "other",
    fact: s.detail || "",
    source: s.sourceUrl || "",
    whyItMatters: "",
    confidence: "medium"
  }));
  return {
    buyingCommittee: committee,
    signals,
    dossier,
    dataGaps: []
  };
}
