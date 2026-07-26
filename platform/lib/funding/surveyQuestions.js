/**
 * Funding survey question schema + dynamic branching.
 *
 * The schema is the contract between the widget (Milestone 2) and the normalizer
 * (`surveyNormalize.js`). Branch conditions are pure functions of the answers so
 * the widget only shows relevant questions. Keep <= ~12 visible questions for
 * most users.
 *
 * Types: single_select | multi_select | text | url | number | boolean | email | phone
 */

export const FUNDING_SURVEY_QUESTIONS = [
  {
    id: "country",
    type: "single_select",
    label: "Where is your business based?",
    required: true,
    options: [
      { value: "Canada", label: "Canada" },
      { value: "United States", label: "United States" },
      { value: "Other", label: "Other / outside North America" }
    ],
    scoringTags: ["jurisdiction"]
  },
  {
    id: "province",
    type: "single_select",
    label: "Which province?",
    helper: "Used to match province-specific programs.",
    required: false,
    branchCondition: (a) => a.country === "Canada",
    options: [
      "Ontario", "British Columbia", "Alberta", "Quebec", "Manitoba", "Saskatchewan",
      "Nova Scotia", "New Brunswick", "Newfoundland and Labrador", "Prince Edward Island",
      "Yukon", "Northwest Territories", "Nunavut"
    ].map((p) => ({ value: p, label: p }))
  },
  {
    id: "incorporated",
    type: "single_select",
    label: "Is your business incorporated or registered?",
    required: true,
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "unsure", label: "Not sure" }
    ]
  },
  {
    id: "businessModel",
    type: "single_select",
    label: "Which best describes your business?",
    required: true,
    options: [
      { value: "creative_media", label: "Creative / media / entertainment" },
      { value: "ecommerce_retail", label: "Retail / DTC / e-commerce" },
      { value: "professional_services", label: "Professional services" },
      { value: "hospitality_local", label: "Hospitality / local business" },
      { value: "software_interactive", label: "Software / interactive media / XR / gaming" },
      { value: "manufacturing_product", label: "Manufacturing / product business" },
      { value: "other", label: "Other" }
    ],
    scoringTags: ["lane_trigger"]
  },
  { id: "employees", type: "number", label: "How many employees?", required: false },
  {
    id: "revenueRange",
    type: "single_select",
    label: "Annual revenue range",
    required: false,
    options: [
      { value: "pre_revenue", label: "Pre-revenue" },
      { value: "under_100k", label: "Under $100K" },
      { value: "100k_500k", label: "$100K–$500K" },
      { value: "500k_1m", label: "$500K–$1M" },
      { value: "1m_5m", label: "$1M–$5M" },
      { value: "5m_plus", label: "$5M+" }
    ]
  },
  {
    id: "availableProjectBudget",
    type: "single_select",
    label: "Available project / marketing budget",
    helper: "Used to estimate a realistic, cost-shared funding range.",
    required: false,
    options: [
      { value: "under_5k", label: "Under $5K" },
      { value: "5k_15k", label: "$5K–$15K" },
      { value: "15k_50k", label: "$15K–$50K" },
      { value: "50k_100k", label: "$50K–$100K" },
      { value: "100k_plus", label: "$100K+" }
    ]
  },
  {
    id: "growthGoals",
    type: "multi_select",
    label: "What are you trying to fund or improve?",
    helper: "Choose the upgrades you are seriously considering in the next 3–12 months.",
    required: true,
    options: [
      { value: "digital_adoption", label: "Digital systems / automation" },
      { value: "ecommerce", label: "E-commerce or online sales" },
      { value: "export_marketing", label: "Export-market sales materials" },
      { value: "creative_export", label: "Creative project or IP expansion" },
      { value: "interactive_media", label: "Game, XR, app, or interactive media project" },
      { value: "content_system", label: "Content production and campaign assets" },
      { value: "crm_automation", label: "CRM / automation / lead follow-up" }
    ],
    scoringTags: ["lane_trigger"]
  },
  {
    id: "digitalCapabilities",
    type: "multi_select",
    label: "Which of these are true today?",
    required: false,
    options: [
      { value: "outdated_website", label: "Website is outdated / missing conversion flow" },
      { value: "no_ecommerce", label: "No e-commerce or weak online store" },
      { value: "no_crm", label: "No CRM or automated follow-up" },
      { value: "inconsistent_content", label: "Content production is inconsistent" },
      { value: "no_analytics", label: "No analytics / attribution" },
      { value: "need_tools", label: "Need new digital tools or workflow automation" },
      { value: "need_funnel", label: "Need a customer acquisition funnel" }
    ]
  },
  // --- Branch: Ontario digital adoption ---
  {
    id: "completedDmap",
    type: "boolean",
    label: "Have you already completed a digital adoption plan (DMAP)?",
    required: false,
    branchCondition: (a) => a.province === "Ontario" && (asArray(a.growthGoals).includes("digital_adoption") || asArray(a.growthGoals).includes("crm_automation"))
  },
  // --- Branch: Retail / storefront / DTC ---
  {
    id: "physicalStorefront",
    type: "boolean",
    label: "Do you have a physical storefront or commercial location?",
    required: false,
    branchCondition: (a) => a.province === "Ontario" && (a.businessModel === "ecommerce_retail" || asArray(a.growthGoals).includes("ecommerce"))
  },
  {
    id: "directToConsumer",
    type: "boolean",
    label: "Do you sell direct-to-consumer?",
    required: false,
    branchCondition: (a) => a.businessModel === "ecommerce_retail" || asArray(a.growthGoals).includes("ecommerce")
  },
  // --- Branch: Export / CanExport-style fit ---
  {
    id: "interestedInExporting",
    type: "single_select",
    label: "Do you currently export or plan to enter a new market?",
    required: false,
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" }
    ],
    branchCondition: (a) => a.country === "Canada" && (asArray(a.growthGoals).includes("export_marketing") || asArray(a.growthGoals).includes("creative_export"))
  },
  {
    id: "exportMarkets",
    type: "text",
    label: "Which target market(s)?",
    required: false,
    branchCondition: (a) => a.interestedInExporting === "yes"
  },
  // --- Branch: Creative / interactive media IP ---
  {
    id: "ownsCreativeIp",
    type: "boolean",
    label: "Do you own or control the creative IP/work?",
    required: false,
    branchCondition: (a) => a.businessModel === "creative_media" || asArray(a.growthGoals).includes("creative_export")
  },
  {
    id: "canadianOwned",
    type: "boolean",
    label: "Is the project Canadian-owned / controlled?",
    required: false,
    branchCondition: (a) => a.businessModel === "software_interactive" || asArray(a.growthGoals).includes("interactive_media")
  },
  {
    id: "idmStage",
    type: "single_select",
    label: "What stage is the interactive media project?",
    required: false,
    branchCondition: (a) => a.businessModel === "software_interactive" || asArray(a.growthGoals).includes("interactive_media"),
    options: [
      { value: "concept", label: "Concept" },
      { value: "prototype", label: "Prototype" },
      { value: "production", label: "Production" },
      { value: "commercialization", label: "Commercialization" }
    ]
  },
  // --- Contact (captured after the teaser to unlock the full result) ---
  { id: "businessName", type: "text", label: "Business name", required: true, group: "contact" },
  { id: "name", type: "text", label: "Your name", required: true, group: "contact" },
  { id: "email", type: "email", label: "Email", required: true, group: "contact" },
  { id: "phone", type: "phone", label: "Phone (optional)", required: false, group: "contact" }
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

/** Questions visible for the current answers (branch conditions satisfied). */
export function getVisibleQuestions(answers = {}, { includeContact = true } = {}) {
  return FUNDING_SURVEY_QUESTIONS.filter((q) => {
    if (q.group === "contact" && !includeContact) return false;
    return typeof q.branchCondition === "function" ? q.branchCondition(answers) : true;
  });
}

/** Non-contact questions used to score the teaser. */
export function getSurveyQuestionIds() {
  return FUNDING_SURVEY_QUESTIONS.map((q) => q.id);
}
