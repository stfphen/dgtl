/**
 * Human review checklist for funding-scan leads.
 *
 * Funding matches are triage signals only — a lead is never "review complete"
 * until a human confirms the required items below. State is stored on the lead
 * under metadata.fundingReview (no schema change; merged via mergeLeadMetadata).
 */

export const FUNDING_REVIEW_ITEMS = [
  {
    id: "province_confirmed",
    label: "Province / region confirmed",
    required: true
  },
  {
    id: "budget_confirmed",
    label: "Revenue and project budget confirmed",
    required: true
  },
  {
    id: "owner_identified",
    label: "Project owner / implementation capacity identified",
    required: true
  },
  {
    id: "need_validated",
    label: "Primary need (digital / ecommerce / export / automation) validated",
    required: true
  },
  {
    id: "source_checked",
    label: "Program / source rules reviewed before any client-facing claim",
    required: true
  },
  {
    id: "offer_confirmed",
    label: "Recommended DGTL offer confirmed",
    required: false
  }
];

export const FUNDING_REVIEW_ITEM_IDS = FUNDING_REVIEW_ITEMS.map((item) => item.id);

function reviewFromLead(lead = {}) {
  const metadata = lead.sourceMetadata || lead.metadata || {};
  return metadata.fundingReview || {};
}

/**
 * Build a normalized review state for a lead.
 * @returns {{ items: Record<string, boolean>, reviewer: string, updatedAt: string, status: string, isComplete: boolean }}
 */
export function buildReviewState(lead = {}) {
  const stored = reviewFromLead(lead);
  const storedItems = stored.items || {};
  const items = Object.fromEntries(FUNDING_REVIEW_ITEMS.map((item) => [item.id, Boolean(storedItems[item.id])]));
  const isComplete = isReviewComplete({ items });
  return {
    items,
    reviewer: stored.reviewer || "",
    updatedAt: stored.updatedAt || "",
    status: isComplete ? "complete" : stored.reviewer ? "in_review" : "pending",
    isComplete
  };
}

/**
 * A review is complete only when every REQUIRED item is checked.
 */
export function isReviewComplete(state = {}) {
  const items = state.items || {};
  return FUNDING_REVIEW_ITEMS.filter((item) => item.required).every((item) => Boolean(items[item.id]));
}

/**
 * Normalize a raw set of checked item ids (e.g. from a posted form) into the
 * stored review patch shape.
 */
export function buildReviewPatch({ checkedItemIds = [], reviewer = "", updatedAt = "" } = {}) {
  const checked = new Set(checkedItemIds);
  const items = Object.fromEntries(FUNDING_REVIEW_ITEM_IDS.map((id) => [id, checked.has(id)]));
  return {
    fundingReview: {
      items,
      reviewer: String(reviewer || "").trim(),
      updatedAt: updatedAt || ""
    }
  };
}
