export const FUNDING_LANES = [
  "digital_adoption",
  "ecommerce_growth",
  "export_marketing",
  "creative_tech",
  "clean_tech",
  "workforce_training",
  "public_procurement",
  "market_expansion"
];

export const FUNDING_LANE_LABELS = {
  digital_adoption: "Digital Adoption",
  ecommerce_growth: "Ecommerce Growth",
  export_marketing: "Export Marketing",
  creative_tech: "Creative Tech",
  clean_tech: "Clean Tech",
  workforce_training: "Workforce Training",
  public_procurement: "Public Procurement",
  market_expansion: "Market Expansion"
};

export const FUNDING_RECOMMENDED_OFFERS = {
  digital_adoption: "Digital adoption roadmap and implementation sprint",
  ecommerce_growth: "Ecommerce conversion and paid acquisition growth plan",
  export_marketing: "Export-ready content and market-entry campaign",
  creative_tech: "Creative technology prototype and launch package",
  clean_tech: "Clean technology commercialization readiness package",
  workforce_training: "Team training and enablement content system",
  public_procurement: "Procurement readiness and supplier profile package",
  market_expansion: "Market expansion funnel and lead-generation campaign"
};

/**
 * @typedef {typeof FUNDING_LANES[number]} FundingLane
 *
 * @typedef {Object} FundingFitInput
 * @property {string=} province
 * @property {string=} country
 * @property {string=} industry
 * @property {string[]=} goals
 * @property {string[]=} channels
 * @property {string[]=} currentCapabilities
 * @property {number=} annualRevenue
 * @property {number=} employeeCount
 * @property {boolean=} sellsOnline
 * @property {boolean=} exports
 * @property {boolean=} hasTrainingNeed
 * @property {boolean=} sellsToGovernment
 * @property {boolean=} usesCleanTech
 * @property {string=} availableProjectBudget
 *
 * @typedef {Object} FundingFitResult
 * @property {number} overallFit
 * @property {Record<FundingLane, number>} laneScores
 * @property {FundingLane} bestFundingLane
 * @property {string} recommendedOffer
 * @property {string[]} eligibilityGaps
 * @property {string[]} reasoning
 * @property {import("./programDatabase.js").FundingProgramMatch[]=} programMatches
 */
