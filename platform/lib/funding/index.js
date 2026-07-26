export {
  FUNDING_LANES,
  FUNDING_LANE_LABELS,
  FUNDING_RECOMMENDED_OFFERS
} from "./constants.js";
export { scoreFundingFit } from "./scoring.js";
export { fundedGrowthTenant } from "./tenant.js";
export {
  buildFundingFitInputFromLead,
  buildFundingOpportunityDashboard,
  buildFundingOpportunityOutreachAngle,
  buildFundingProgramLeadMatches,
  buildFundingProposalChecklist,
  fundingScanFromLead,
  isFundingScanLead,
  matchFundingProgramsForLead,
  scoreFundingLead
} from "./admin.js";
export {
  dedupeFundingOpportunities,
  normalizeFundingOpportunity,
  validateFundingOpportunity
} from "./ingestion.js";
// Category-triage engine (raw scan -> topMatches/weakMatches/disqualified).
export { matchFundingPrograms } from "./matching.js";
export { manualFundingProgramCategories } from "./programs.js";
// Program-database engine (normalized FundingFitInput + score -> ranked programs).
export {
  findFundingProgram,
  fundingOpportunityStatuses,
  listFundingProgramsForTenant,
  manualFundingPrograms,
  matchFundingProgramsForInput,
  validateManualFundingPrograms
} from "./programDatabase.js";
// Human review checklist + closer handoff summary.
export {
  FUNDING_REVIEW_ITEMS,
  FUNDING_REVIEW_ITEM_IDS,
  buildReviewPatch,
  buildReviewState,
  isReviewComplete
} from "./review.js";
export { buildCloserHandoff } from "./handoff.js";
// Jurisdiction parsing.
export { parseJurisdiction, canonicalCountry, canonicalProvince } from "./normalizeLocation.js";
// Funding survey engine (deterministic): schema -> normalize -> score -> result.
export { FUNDING_SURVEY_QUESTIONS, getVisibleQuestions, getSurveyQuestionIds } from "./surveyQuestions.js";
export { normalizeSurveyAnswers, midpointForRevenue, midpointForBudget } from "./surveyNormalize.js";
export { scoreSurvey, estimateFundingRange, checkRequirements, surveyConfidence } from "./surveyScoring.js";
export { buildSurveyResult, buildTeaserResult, buildSurveyPatch, SURVEY_DISCLAIMER } from "./surveyResults.js";
