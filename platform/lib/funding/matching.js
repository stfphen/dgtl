import { manualFundingProgramCategories } from "./programs.js";

/**
 * Match Funding Fit Scan answers to broad manual opportunity categories.
 *
 * This is a deterministic triage helper. It does not check live program
 * availability, eligibility, deadlines, funder rules, or award amounts.
 */
export function matchFundingPrograms(fundingScan = {}, programs = manualFundingProgramCategories) {
  const context = buildScanContext(fundingScan);
  const matches = programs
    .map((program, index) => ({
      ...program,
      match: scoreProgramMatch(context, program),
      originalIndex: index
    }))
    .sort((a, b) => b.match.score - a.match.score || a.originalIndex - b.originalIndex)
    .map(({ originalIndex, ...match }) => match);

  const topMatches = matches.filter((match) => match.match.label === "Potential fit").slice(0, 3);
  const weakMatches = matches.filter((match) => match.match.label === "Weak signal");
  const disqualified = matches.filter((match) => match.match.label === "Not enough information");
  const usableTopMatches = topMatches.length ? topMatches : matches.slice(0, 3);
  const gaps = buildGlobalGaps(context);

  return {
    topMatches: usableTopMatches,
    weakMatches,
    disqualified,
    reasons: usableTopMatches.flatMap((match) => match.match.reasons).slice(0, 6),
    gaps,
    recommendedNextAction: buildRecommendedNextAction(usableTopMatches, gaps),
    requiresHumanReview: true,
    allMatches: matches
  };
}

function scoreProgramMatch(context, program = {}) {
  const reasons = [];
  const gaps = [];
  let score = 0;

  const signalMatches = matchKeywords(context.haystack, program.matchSignals || []);
  if (signalMatches.length) {
    score += Math.min(36, signalMatches.length * 12);
    reasons.push(`Matched scan language: ${signalMatches.slice(0, 3).join(", ")}`);
  }

  if (program.lane === "ecommerce_growth" && context.hasEcommerceSignal) {
    score += 24;
    reasons.push("E-commerce needs were provided.");
  }
  if (program.lane === "digital_adoption" && context.hasDigitalSignal) {
    score += 18;
    reasons.push("Digital needs were provided.");
  }
  if (program.lane === "export_marketing" && context.hasExportSignal) {
    score += 30;
    reasons.push("Export activity or export interest was provided.");
  }
  if (program.lane === "workforce_training" && context.employeeCount > 0) {
    score += context.employeeCount >= 5 ? 16 : 8;
    reasons.push("Employee count was provided for capacity review.");
  }
  if (program.lane === "public_procurement" && hasAny(context.haystack, ["procurement", "government", "rfp", "public sector"])) {
    score += 28;
    reasons.push("Procurement or public-sector language appeared in the scan.");
  }
  if (program.lane === "clean_tech" && hasAny(context.haystack, ["clean tech", "cleantech", "climate", "energy", "sustainability", "carbon"])) {
    score += 28;
    reasons.push("Clean technology or sustainability language appeared in the scan.");
  }
  if (program.lane === "market_expansion" && context.mainGrowthGoal) {
    score += 14;
    reasons.push("A growth goal was provided.");
  }

  const disqualificationSignals = matchKeywords(context.haystack, program.disqualificationSignals || []);
  if (disqualificationSignals.length) {
    score -= 20;
    gaps.push(`Review possible disqualification signal: ${disqualificationSignals[0]}`);
  }

  if (context.hasBudget) {
    score += 8;
    reasons.push("Project budget was provided for review.");
  } else {
    gaps.push("Confirm available project budget.");
  }

  if (context.hasRevenue) {
    score += 6;
    reasons.push("Revenue traction was provided.");
  } else {
    gaps.push("Confirm revenue traction or self-funded project capacity.");
  }

  if (!context.industry) gaps.push("Confirm industry.");
  if (!context.location) gaps.push("Confirm operating location.");
  if (!context.mainGrowthGoal) gaps.push("Clarify the main growth goal.");
  if (!reasons.length) reasons.push("Insufficient scan detail for a strong category signal.");

  const normalizedScore = clamp(score);
  return {
    score: normalizedScore,
    label: labelForScore(normalizedScore, context),
    whyItMayMatch: reasons[0],
    reasons,
    gaps,
    requiresHumanReview: true
  };
}

function labelForScore(score, context) {
  if (!context.hasMinimumProfile) return "Not enough information";
  if (score >= 50) return "Potential fit";
  if (score >= 20) return "Weak signal";
  return "Not enough information";
}

function buildScanContext(scan = {}) {
  const digitalNeeds = cleanText(scan.digitalNeeds);
  const ecommerceNeeds = cleanText(scan.ecommerceNeeds);
  const automationNeeds = cleanText(scan.crmAutomationNeeds);
  const mainGrowthGoal = cleanText(scan.mainGrowthGoal);
  const industry = cleanText(scan.industry);
  const location = cleanText(scan.location);
  const haystack = [industry, location, digitalNeeds, ecommerceNeeds, automationNeeds, mainGrowthGoal].join(" ");
  const hasMinimumProfile = Boolean(industry && location && mainGrowthGoal);

  return {
    industry,
    location,
    digitalNeeds,
    ecommerceNeeds,
    automationNeeds,
    mainGrowthGoal,
    haystack,
    employeeCount: Number(scan.employeeCount || 0),
    hasMinimumProfile,
    hasBudget: Boolean(scan.availableProjectBudget && scan.availableProjectBudget !== "under_5k"),
    hasRevenue: Boolean(scan.revenueRange && !["pre_revenue", "under_100k"].includes(scan.revenueRange)),
    hasExportSignal: scan.currentlyExporting === "yes" || scan.interestedInExporting === "yes",
    hasEcommerceSignal: hasSubstantiveNeed(ecommerceNeeds),
    hasDigitalSignal: hasSubstantiveNeed(digitalNeeds),
    hasAutomationSignal: hasSubstantiveNeed(automationNeeds)
  };
}

function buildGlobalGaps(context) {
  const gaps = [];
  if (!context.industry) gaps.push("Confirm industry.");
  if (!context.location) gaps.push("Confirm operating location.");
  if (!context.mainGrowthGoal) gaps.push("Clarify the main growth goal.");
  if (!context.hasBudget) gaps.push("Confirm available project budget.");
  if (!context.hasRevenue) gaps.push("Confirm revenue traction or self-funded project capacity.");
  return gaps;
}

function buildRecommendedNextAction(topMatches, gaps) {
  if (gaps.length >= 3) {
    return "Collect missing scan details before recommending a funding pathway.";
  }
  const [firstMatch] = topMatches;
  if (!firstMatch) return "Human review required before recommending a next step.";
  return `Human review required: evaluate ${firstMatch.name} against current funder or program administrator rules.`;
}

function matchKeywords(haystack = "", keywords = []) {
  return keywords.filter((keyword) => hasKeyword(haystack, keyword));
}

function hasAny(haystack = "", keywords = []) {
  return keywords.some((keyword) => hasKeyword(haystack, keyword));
}

function hasKeyword(haystack = "", keyword = "") {
  const target = cleanText(keyword);
  if (!target) return false;
  if (target.includes(" ")) return haystack.includes(target);
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(target)}([^a-z0-9]|$)`).test(haystack);
}

function hasSubstantiveNeed(value = "") {
  return Boolean(value) && !["none", "no", "n/a", "na", "not applicable"].includes(value);
}

function cleanText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function escapeRegExp(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

