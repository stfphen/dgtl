import {
  FUNDING_LANES,
  FUNDING_RECOMMENDED_OFFERS
} from "./constants.js";

const laneKeywords = {
  digital_adoption: ["digital", "automation", "crm", "website", "software", "online"],
  ecommerce_growth: ["ecommerce", "e-commerce", "shopify", "online sales", "conversion", "paid ads"],
  export_marketing: ["export", "international", "us market", "global", "trade"],
  creative_tech: ["creative", "content", "media", "video", "ar", "vr", "interactive"],
  clean_tech: ["clean", "energy", "climate", "sustainability", "carbon", "retrofit"],
  workforce_training: ["training", "hiring", "upskill", "enablement", "onboarding"],
  public_procurement: ["procurement", "government", "rfp", "supplier", "public sector"],
  market_expansion: ["market expansion", "new market", "lead generation", "sales", "growth"]
};

const industrySignals = {
  digital_adoption: ["professional services", "retail", "manufacturing", "health", "construction"],
  ecommerce_growth: ["retail", "consumer", "food", "beauty", "apparel"],
  export_marketing: ["manufacturing", "food", "technology", "clean tech", "software"],
  creative_tech: ["media", "creative", "technology", "software", "education"],
  clean_tech: ["clean tech", "energy", "manufacturing", "construction", "transportation"],
  workforce_training: ["manufacturing", "construction", "health", "hospitality", "professional services"],
  public_procurement: ["construction", "technology", "professional services", "clean tech"],
  market_expansion: ["retail", "professional services", "technology", "manufacturing", "health"]
};

function normalizeList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.map(normalizeText).filter(Boolean) : [normalizeText(value)].filter(Boolean);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesKeyword(haystack, keyword) {
  if (keyword.includes(" ")) return haystack.includes(keyword);
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}([^a-z0-9]|$)`).test(haystack);
}

function addKeywordScore({ lane, haystack, reasons }) {
  let score = 0;
  for (const keyword of laneKeywords[lane]) {
    if (matchesKeyword(haystack, keyword)) {
      score += 12;
      reasons.push(`${lane}: +12 matched "${keyword}"`);
      break;
    }
  }
  return score;
}

function addIndustryScore({ lane, industry, reasons }) {
  if (!industrySignals[lane].some((term) => industry.includes(term))) return 0;
  reasons.push(`${lane}: +10 industry fit`);
  return 10;
}

function rankLanes(laneScores) {
  return [...FUNDING_LANES].sort((a, b) => {
    const scoreDelta = laneScores[b] - laneScores[a];
    return scoreDelta || FUNDING_LANES.indexOf(a) - FUNDING_LANES.indexOf(b);
  });
}

/**
 * Deterministic scaffold for ranking likely funding lanes.
 *
 * This is intentionally rule-based: it gives the app a stable production-safe
 * domain boundary without adding scraping, external calls, or eligibility claims.
 *
 * @param {import("./constants.js").FundingFitInput} input
 * @returns {import("./constants.js").FundingFitResult}
 */
export function scoreFundingFit(input = {}) {
  const province = normalizeText(input.province);
  const country = normalizeText(input.country);
  const industry = normalizeText(input.industry);
  const goals = normalizeList(input.goals);
  const channels = normalizeList(input.channels);
  const capabilities = normalizeList(input.currentCapabilities);
  const annualRevenue = Number(input.annualRevenue || 0);
  const employeeCount = Number(input.employeeCount || 0);
  const haystack = [industry, ...goals, ...channels, ...capabilities].join(" ");
  const reasoning = [];
  const eligibilityGaps = [];

  const laneScores = Object.fromEntries(FUNDING_LANES.map((lane) => [lane, 0]));

  for (const lane of FUNDING_LANES) {
    laneScores[lane] += addKeywordScore({ lane, haystack, reasons: reasoning });
    laneScores[lane] += addIndustryScore({ lane, industry, reasons: reasoning });
  }

  if (province === "ontario") {
    for (const lane of ["digital_adoption", "ecommerce_growth", "export_marketing", "workforce_training"]) {
      laneScores[lane] += 8;
    }
    reasoning.push("Ontario location: +8 to common provincial business-growth lanes");
  }

  if (country === "canada") {
    laneScores.public_procurement += 6;
    laneScores.export_marketing += 6;
    reasoning.push("Canada location: +6 to procurement and export readiness");
  }

  if (input.sellsOnline) {
    laneScores.ecommerce_growth += 20;
    laneScores.digital_adoption += 8;
    reasoning.push("Sells online: ecommerce and digital adoption signals");
  }

  if (input.exports) {
    laneScores.export_marketing += 24;
    laneScores.market_expansion += 8;
    reasoning.push("Exports or plans to export: export marketing signal");
  }

  if (input.hasTrainingNeed || employeeCount >= 5) {
    laneScores.workforce_training += 16;
    reasoning.push("Training need or team size: workforce training signal");
  }

  if (input.sellsToGovernment) {
    laneScores.public_procurement += 24;
    reasoning.push("Government sales target: public procurement signal");
  }

  if (input.usesCleanTech || industry.includes("clean tech")) {
    laneScores.clean_tech += 26;
    reasoning.push("Clean technology signal");
  }

  if (annualRevenue >= 100000) {
    for (const lane of FUNDING_LANES) laneScores[lane] += 4;
    reasoning.push("Revenue traction: +4 baseline readiness");
  } else {
    eligibilityGaps.push("Document revenue traction or growth budget before application work.");
  }

  if (input.availableProjectBudget && input.availableProjectBudget !== "under_5k") {
    for (const lane of FUNDING_LANES) laneScores[lane] += 3;
    reasoning.push("Project budget signal: +3 baseline readiness");
  } else if (input.availableProjectBudget === "under_5k") {
    eligibilityGaps.push("Confirm whether the available project budget can support a funding-backed scope.");
  }

  if (!goals.length) eligibilityGaps.push("Add 1-3 growth goals to improve funding lane confidence.");
  if (!input.sellsOnline && laneScores.ecommerce_growth >= 40) {
    eligibilityGaps.push("Confirm ecommerce sales channel and platform readiness.");
  }
  if (!input.exports && laneScores.export_marketing >= 40) {
    eligibilityGaps.push("Confirm target export market and current export activity.");
  }
  if (!employeeCount) {
    eligibilityGaps.push("Add employee count to validate workforce and scale-readiness assumptions.");
  }

  for (const lane of FUNDING_LANES) {
    laneScores[lane] = clampScore(laneScores[lane]);
  }

  const [bestFundingLane] = rankLanes(laneScores);
  const overallFit = clampScore(laneScores[bestFundingLane]);

  return {
    overallFit,
    laneScores,
    bestFundingLane,
    recommendedOffer: FUNDING_RECOMMENDED_OFFERS[bestFundingLane],
    eligibilityGaps,
    reasoning
  };
}
