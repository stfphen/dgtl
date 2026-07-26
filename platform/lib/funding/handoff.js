import { buildFundingProposalChecklist, fundingScanFromLead, scoreFundingLead } from "./admin.js";
import { buildReviewState } from "./review.js";

/**
 * Assemble a sales-closer handoff summary for a funding-scan lead.
 *
 * Pure assembly over existing helpers — no new scoring. Readable standalone
 * (copy/print), and always flags when human review is incomplete. This is a
 * triage summary, not an eligibility or funding-approval determination.
 */
export function buildCloserHandoff(lead = {}) {
  const score = scoreFundingLead(lead);
  const scan = fundingScanFromLead(lead);
  const review = buildReviewState(lead);
  const topMatch = score.programMatches?.[0] || null;

  const fitReasons = (topMatch?.matchedSignals?.length ? topMatch.matchedSignals : score.reasoning || []).slice(0, 4);
  const gaps = [...(score.eligibilityGaps || []), ...((topMatch?.reviewGaps) || [])].slice(0, 5);

  return {
    business: lead.businessName || lead.business || "Unknown business",
    contact: lead.contactName || "",
    email: lead.email || "",
    location: scan.location || [lead.city, lead.region, lead.country].filter(Boolean).join(", "),
    industry: scan.industry || lead.category || "",
    overallFit: score.overallFit,
    topLane: score.bestFundingLaneLabel,
    topProgram: topMatch
      ? {
          name: topMatch.program.name,
          provider: topMatch.program.provider,
          matchScore: topMatch.matchScore,
          confidence: topMatch.confidence,
          sourceUrl: topMatch.program.sourceUrl
        }
      : null,
    fitReasons,
    gaps,
    recommendedOffer: score.recommendedOffer,
    nextStep: topMatch?.recommendedNextStep
      || topMatch?.outreachAngle?.recommendedNextStep
      || topMatch?.outreachAngle?.serviceAngle
      || "Confirm the project scope, budget, and owner, then route to the right DGTL package.",
    proposalChecklist: topMatch ? buildFundingProposalChecklist(topMatch.program) : [],
    reviewStatus: review.status,
    reviewIncomplete: !review.isComplete,
    requiresHumanReview: true
  };
}
