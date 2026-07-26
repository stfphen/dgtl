import { FUNDING_LANES, FUNDING_LANE_LABELS } from "./constants.js";
import { scoreSurvey } from "./surveyScoring.js";

/**
 * User-facing survey result builders. Conservative by construction: ranges are
 * capped by program rules, foreign/unknown jurisdictions yield no Canadian
 * matches, and every result carries a human-review disclaimer.
 */

export const SURVEY_DISCLAIMER =
  "This is a preliminary match indicator, not a funding guarantee. Program eligibility, intake dates, and eligible expenses must be verified before applying.";

const OVERALL_FROM_CONFIDENCE = {
  high: "high",
  medium: "medium",
  exploratory: "exploratory",
  not_enough_information: "not_enough_information",
  not_a_fit: "not_enough_information"
};

const CONFIDENCE_RANK = { high: 4, medium: 3, exploratory: 2, not_enough_information: 1, not_a_fit: 0 };

function bestLanes(fundingScore, limit = 3) {
  const scores = fundingScore.laneScores || {};
  return [...FUNDING_LANES]
    .map((lane) => ({ id: lane, label: FUNDING_LANE_LABELS[lane] || lane, score: scores[lane] || 0 }))
    .filter((lane) => lane.score > 0)
    .sort((a, b) => b.score - a.score || FUNDING_LANES.indexOf(a.id) - FUNDING_LANES.indexOf(b.id))
    .slice(0, limit);
}

export function buildSurveyResult(normalizedInput = {}) {
  const { fundingScore, programMatches } = scoreSurvey(normalizedInput);
  const qualified = programMatches.filter((m) => m.confidence !== "not_a_fit");
  const top = [...qualified].sort((a, b) => (CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence]) || b.score - a.score);

  let overallFit = top.length ? OVERALL_FROM_CONFIDENCE[top[0].confidence] : "not_enough_information";
  // Cap by general lane fit so a niche high-confidence program can't read as a
  // strong overall signal when the business's lane fit is weak.
  const fitCap = fundingScore.overallFit >= 50 ? "high" : fundingScore.overallFit >= 30 ? "medium" : "exploratory";
  if ((CONFIDENCE_RANK[overallFit] || 0) > CONFIDENCE_RANK[fitCap]) overallFit = fitCap;
  const rangeSource = top.find((m) => m.estimatedRange && (m.estimatedRange.max || m.estimatedRange.label));
  const estimatedFundingRange = rangeSource ? rangeSource.estimatedRange : null;

  const reviewGaps = [...(fundingScore.eligibilityGaps || [])];
  if (normalizedInput.jurisdictionConfidence === "unknown") {
    reviewGaps.unshift("Confirm business country and province — jurisdiction was not clearly identified.");
  }
  if (!qualified.length) {
    reviewGaps.unshift("No current program matches for the identified jurisdiction. Confirm location and project details.");
  }

  return {
    overallFit,
    fitScore: fundingScore.overallFit,
    estimatedFundingRange,
    bestLanes: bestLanes(fundingScore),
    topProgramMatches: top.slice(0, 4),
    reviewGaps: reviewGaps.slice(0, 6),
    requiresHumanReview: true,
    disclaimer: SURVEY_DISCLAIMER
  };
}

/**
 * Teaser shown before contact capture: fit + lanes only, no program names or
 * dollar figures.
 */
export function buildTeaserResult(normalizedInput = {}) {
  const full = buildSurveyResult(normalizedInput);
  return {
    overallFit: full.overallFit,
    fitScore: full.fitScore,
    bestLanes: full.bestLanes,
    qualifiedProgramCount: full.topProgramMatches.length,
    teaser: true,
    disclaimer: SURVEY_DISCLAIMER
  };
}

/**
 * Lead metadata patch: a serializable survey snapshot plus the backward-compatible
 * fundingScan (so existing admin scoring/handoff/review work unchanged).
 */
export function buildSurveyPatch({ answers = {}, normalizedInput = {}, result = null, fundingScan = {}, completedAt = "" } = {}) {
  return {
    fundingScan,
    fundingSurvey: {
      version: "funding-survey-v1",
      completedAt,
      answers,
      normalizedInput,
      result: result || buildSurveyResult(normalizedInput)
    }
  };
}
