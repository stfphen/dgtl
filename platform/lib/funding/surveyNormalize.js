import { parseJurisdiction } from "./normalizeLocation.js";

/**
 * Normalize raw funding-survey answers into:
 *  - `normalizedInput`: the deterministic scoring input (consumed by scoreFundingFit
 *     + matchFundingProgramsForInput), and
 *  - `fundingScan`: the backward-compatible metadata.fundingScan shape so existing
 *     admin scoring/handoff/review keep working unchanged.
 *
 * Pure + deterministic. No LLM.
 */

const REVENUE_MIDPOINTS = {
  pre_revenue: 0,
  under_100k: 50000,
  "100k_500k": 250000,
  "500k_1m": 750000,
  "1m_5m": 2500000,
  "5m_plus": 5000000
};

const BUDGET_MIDPOINTS = {
  under_5k: 2500,
  "5k_15k": 10000,
  "15k_50k": 32500,
  "50k_100k": 75000,
  "100k_plus": 150000
};

const BUSINESS_MODEL_INDUSTRY = {
  creative_media: "creative media entertainment",
  ecommerce_retail: "retail ecommerce consumer",
  professional_services: "professional services",
  hospitality_local: "hospitality local business",
  software_interactive: "software interactive media technology",
  manufacturing_product: "manufacturing product",
  other: ""
};

const GOAL_LABELS = {
  digital_adoption: "Digital systems and automation modernization",
  ecommerce: "E-commerce and online sales growth",
  export_marketing: "Export-market sales materials and international expansion",
  creative_export: "Creative project or IP international expansion",
  interactive_media: "Interactive media, game, XR, or app product",
  content_system: "Content production and campaign assets",
  crm_automation: "CRM, automation, and lead follow-up"
};

const CAPABILITY_LABELS = {
  outdated_website: "Website is outdated or missing a conversion flow",
  no_ecommerce: "No e-commerce or weak online store",
  no_crm: "No CRM or automated follow-up",
  inconsistent_content: "Content production is inconsistent",
  no_analytics: "No analytics or attribution",
  need_tools: "Needs new digital tools or workflow automation",
  need_funnel: "Needs a customer acquisition funnel"
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function yes(value) {
  return value === "yes" || value === true;
}

export function midpointForRevenue(range) {
  return REVENUE_MIDPOINTS[range] ?? 0;
}

export function midpointForBudget(bucket) {
  return BUDGET_MIDPOINTS[bucket] ?? 0;
}

export function normalizeSurveyAnswers(answers = {}) {
  const location = answers.location || [answers.city, answers.province, answers.country].filter(Boolean).join(", ");
  const jurisdiction = parseJurisdiction(location, { country: answers.country, province: answers.province });

  const goals = asArray(answers.growthGoals);
  const capabilities = asArray(answers.digitalCapabilities);
  const businessModel = answers.businessModel || "";
  const industry = (answers.industry || BUSINESS_MODEL_INDUSTRY[businessModel] || "").trim();

  const goalLabels = goals.map((g) => GOAL_LABELS[g] || g);
  const capabilityLabels = capabilities.map((c) => CAPABILITY_LABELS[c] || c);
  const mainGrowthGoal = answers.mainGrowthGoal || goalLabels[0] || "";

  const exports =
    yes(answers.currentlyExporting) ||
    yes(answers.interestedInExporting) ||
    goals.includes("export_marketing") ||
    goals.includes("creative_export");

  const sellsOnline =
    businessModel === "ecommerce_retail" ||
    yes(answers.directToConsumer) ||
    goals.includes("ecommerce");

  const normalizedInput = {
    country: jurisdiction.country || "",
    province: jurisdiction.province || "",
    jurisdictionConfidence: jurisdiction.confidence,
    industry,
    businessModel,
    goals: [mainGrowthGoal, ...goalLabels].filter(Boolean),
    channels: capabilityLabels.filter((c) => /ecommerce|online|funnel/i.test(c)),
    currentCapabilities: capabilityLabels,
    annualRevenue: midpointForRevenue(answers.revenueRange),
    revenueRange: answers.revenueRange || "",
    employeeCount: Number(answers.employees || answers.employeeCount || 0),
    yearsOperating: Number(answers.yearsOperating || 0),
    availableProjectBudget: midpointForBudget(answers.availableProjectBudget),
    availableProjectBudgetBucket: answers.availableProjectBudget || "",
    sellsOnline,
    exports,
    hasTrainingNeed: goals.includes("content_system") && Number(answers.employees || 0) >= 5,
    sellsToGovernment: /government|procurement|rfp/i.test(mainGrowthGoal),
    usesCleanTech: /clean|sustainab|climate|energy/i.test(`${industry} ${mainGrowthGoal}`),
    // branch-specific eligibility signals
    incorporated: yes(answers.incorporated),
    ownsCreativeIp: yes(answers.ownsCreativeIp),
    interactiveDigitalMedia:
      businessModel === "software_interactive" || goals.includes("interactive_media") || yes(answers.interactiveMedia),
    canadianOwned: yes(answers.canadianOwned),
    directToConsumer: yes(answers.directToConsumer),
    physicalStorefront: yes(answers.physicalStorefront),
    completedDmap: yes(answers.completedDmap),
    exportMarkets: asArray(answers.exportMarkets)
  };

  // Backward-compatible fundingScan snapshot (consumed by lib/funding/admin.js).
  const fundingScan = {
    industry,
    location,
    country: jurisdiction.country || "",
    province: jurisdiction.province || "",
    companyWebsite: answers.companyWebsite || answers.website || "",
    revenueRange: answers.revenueRange || "",
    employeeCount: String(answers.employees || answers.employeeCount || ""),
    yearsOperating: String(answers.yearsOperating || ""),
    incorporated: answers.incorporated || "",
    currentlyExporting: answers.currentlyExporting || "",
    interestedInExporting: answers.interestedInExporting || "",
    availableProjectBudget: answers.availableProjectBudget || "",
    digitalNeeds: capabilityLabels.join("; "),
    ecommerceNeeds: capabilities.includes("no_ecommerce") ? "Needs e-commerce / online store" : "",
    crmAutomationNeeds: capabilities.includes("no_crm") ? "Needs CRM / automated follow-up" : "",
    mainGrowthGoal
  };

  return { normalizedInput, fundingScan };
}
