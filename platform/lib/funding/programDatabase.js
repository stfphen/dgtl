import {
  FUNDING_LANE_LABELS,
  FUNDING_LANES
} from "./constants.js";
import { scoreFundingFit } from "./scoring.js";

/**
 * @typedef {Object} FundingProgramMatch
 * @property {typeof manualFundingPrograms[number]} program
 * @property {number} matchScore
 * @property {"high" | "medium" | "low"} confidence
 * @property {{ id: string, label: string, score: number }[]} matchedLanes
 * @property {string[]} matchedSignals
 * @property {string[]} reviewGaps
 */

const BASE_PROGRAMS = [
  {
    id: "canexport-smes",
    name: "CanExport SMEs",
    provider: "Government of Canada",
    fundingType: "Export marketing",
    statusLabel: "Manual review",
    sourceUrl: "https://www.tradecommissioner.gc.ca/funding-financement/canexport/sme-pme/index.aspx",
    lastVerifiedOn: "2026-06-17",
    intakeStatus: "verify_current_intake",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: [] },
    lanes: ["export_marketing", "market_expansion"],
    industries: ["manufacturing", "technology", "software", "food", "consumer goods", "clean tech"],
    targetBusinessLabels: ["Export-ready SMEs", "Manufacturers", "Technology companies"],
    projectTypes: ["export marketing", "international market development", "trade shows", "market research"],
    eligibleProjectExamples: ["International campaign assets", "Market-entry landing pages", "Export sales collateral"],
    servicePackageIds: ["fundable-project-blueprint", "application-support", "funded-growth-execution"],
    minEmployees: 1,
    maxEmployees: 500,
    minAnnualRevenue: 100000,
    fitNotes: "Potential fit for Canadian SMEs planning new export market development."
  },
  {
    id: "ontario-dmap",
    name: "Digital Modernization and Adoption Plan",
    provider: "Government of Ontario / Ontario Centre of Innovation",
    fundingType: "Digital adoption",
    statusLabel: "Manual review",
    sourceUrl: "https://news.ontario.ca/en/release/1007481/ontario-investing-5-million-to-help-small-businesses-adopt-digital-technologies",
    lastVerifiedOn: "2026-06-17",
    intakeStatus: "verify_current_intake",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: ["Ontario"] },
    lanes: ["digital_adoption", "ecommerce_growth", "market_expansion"],
    industries: ["manufacturing", "retail", "professional services", "technology", "construction"],
    targetBusinessLabels: ["Ontario SMEs", "Retailers", "Service businesses", "Manufacturers"],
    projectTypes: ["digital adoption plan", "technology planning", "automation", "ecommerce"],
    eligibleProjectExamples: ["Digital adoption roadmap", "E-commerce plan", "CRM and automation plan"],
    servicePackageIds: ["fundable-project-blueprint", "application-support"],
    minEmployees: 1,
    minAnnualRevenue: 50000,
    fitNotes: "Potential fit for Ontario businesses preparing a technology adoption plan."
  },
  {
    id: "strategic-agri-food-processing-fund",
    name: "Strategic Agri-Food Processing Fund",
    provider: "Government of Ontario",
    fundingType: "Modernization",
    statusLabel: "Manual review",
    sourceUrl: "https://www.ontario.ca/page/strategic-agri-food-processing-fund",
    lastVerifiedOn: "2026-06-17",
    intakeStatus: "verify_current_intake",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: ["Ontario"] },
    lanes: ["digital_adoption", "clean_tech", "market_expansion"],
    industries: ["food", "agri-food", "agriculture", "manufacturing"],
    targetBusinessLabels: ["Food processors", "Agri-food manufacturers", "Ontario producers"],
    projectTypes: ["processing capacity", "modernization", "automation", "facility expansion"],
    eligibleProjectExamples: ["Modernization narrative", "Operational content system", "Expansion project assets"],
    servicePackageIds: ["fundable-project-blueprint", "application-support", "funded-growth-execution"],
    minEmployees: 1,
    minAnnualRevenue: 100000,
    fitNotes: "Potential fit for Ontario agri-food processors with modernization or capacity projects."
  },
  {
    id: "irap",
    name: "NRC IRAP",
    provider: "National Research Council Canada",
    fundingType: "Innovation",
    statusLabel: "Manual review",
    sourceUrl: "https://nrc.canada.ca/en/support-technology-innovation",
    lastVerifiedOn: "2026-06-17",
    intakeStatus: "verify_current_intake",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: [] },
    lanes: ["creative_tech", "clean_tech", "digital_adoption"],
    industries: ["technology", "software", "clean tech", "manufacturing", "life sciences"],
    targetBusinessLabels: ["Technology SMEs", "Product companies", "Innovative manufacturers"],
    projectTypes: ["research and development", "prototype", "technology commercialization", "innovation"],
    eligibleProjectExamples: ["Prototype go-to-market assets", "Technical commercialization plan", "Pilot project narrative"],
    servicePackageIds: ["fundable-project-blueprint", "application-support", "funded-growth-execution"],
    minEmployees: 1,
    maxEmployees: 500,
    fitNotes: "Potential fit for Canadian SMEs developing or commercializing innovative technology."
  },
  {
    id: "canexport-innovation",
    name: "CanExport Innovation",
    provider: "Government of Canada",
    fundingType: "Export innovation",
    statusLabel: "Manual review",
    sourceUrl: "https://ised-isde.canada.ca/site/canadian-intellectual-property-office/en/global-affairs-canada-canexport-innovation",
    lastVerifiedOn: "2026-06-17",
    intakeStatus: "verify_current_intake",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: [] },
    lanes: ["export_marketing", "creative_tech", "clean_tech"],
    industries: ["technology", "software", "clean tech", "advanced manufacturing", "education"],
    targetBusinessLabels: ["R&D teams", "Technology exporters", "Clean-tech companies"],
    projectTypes: ["international r&d partnership", "technology validation", "co-development", "prototype"],
    eligibleProjectExamples: ["Partnership pitch materials", "International validation narrative", "Project scope deck"],
    servicePackageIds: ["fundable-project-blueprint", "application-support"],
    minEmployees: 1,
    fitNotes: "Potential fit for organizations pursuing international technology R&D partnerships."
  },
  {
    id: "canada-summer-jobs",
    name: "Canada Summer Jobs",
    provider: "Government of Canada",
    fundingType: "Workforce",
    statusLabel: "Seasonal",
    sourceUrl: "https://www.canada.ca/en/employment-social-development/services/funding/canada-summer-jobs.html",
    lastVerifiedOn: "2026-06-17",
    intakeStatus: "verify_current_intake",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: [] },
    lanes: ["workforce_training"],
    industries: ["retail", "hospitality", "nonprofit", "professional services", "manufacturing", "technology"],
    targetBusinessLabels: ["Hiring businesses", "Seasonal operators", "Growing teams"],
    projectTypes: ["youth hiring", "summer jobs", "training", "team capacity"],
    eligibleProjectExamples: ["Marketing assistant role plan", "Content operations training", "Digital coordinator scope"],
    servicePackageIds: ["application-support", "monthly-opportunity-intelligence"],
    minEmployees: 1,
    fitNotes: "Potential fit when the growth project includes youth hiring or seasonal team capacity."
  },
  {
    id: "canada-digital-adoption-program-bybt",
    name: "Canada Digital Adoption Program - Boost Your Business Technology",
    provider: "Government of Canada",
    fundingType: "Digital adoption",
    statusLabel: "Historical benchmark",
    sourceUrl: "https://ised-isde.canada.ca/site/atip-services/en/ised-info-source-updates/info-source-2025-update",
    lastVerifiedOn: "2026-06-17",
    intakeStatus: "concluded_verify_successor",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: [] },
    lanes: ["digital_adoption", "ecommerce_growth"],
    industries: ["retail", "manufacturing", "professional services", "construction", "technology"],
    targetBusinessLabels: ["Digitizing SMEs", "Retailers", "Service businesses"],
    projectTypes: ["digital adoption plan", "software implementation", "ecommerce", "automation"],
    eligibleProjectExamples: ["Successor-program readiness", "Digital plan retrofit", "Implementation budget narrative"],
    servicePackageIds: ["fundable-project-blueprint", "monthly-opportunity-intelligence"],
    minEmployees: 1,
    minAnnualRevenue: 100000,
    fitNotes: "Historical digital adoption benchmark; verify successor or equivalent provincial programs before positioning."
  },
  {
    id: "ontario-procurement-readiness",
    name: "Ontario Public Procurement Readiness",
    provider: "Manual advisory lane",
    fundingType: "Funded contracts",
    statusLabel: "Advisory",
    sourceUrl: "https://www.ontario.ca/page/selling-ontario-government",
    lastVerifiedOn: "2026-06-17",
    intakeStatus: "advisory_only",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: ["Ontario"] },
    lanes: ["public_procurement"],
    industries: ["construction", "technology", "professional services", "clean tech", "manufacturing"],
    targetBusinessLabels: ["Government-ready suppliers", "B2B service firms", "Contractors"],
    projectTypes: ["supplier profile", "rfp readiness", "government sales", "procurement"],
    eligibleProjectExamples: ["Supplier profile", "RFP response assets", "Capability statement"],
    servicePackageIds: ["fundable-project-blueprint", "funded-growth-execution"],
    minEmployees: 1,
    fitNotes: "Advisory match for businesses preparing to sell to government; not a grant program."
  }
];

export const PROGRAM_STATUSES = ["active", "verify_intake", "invite_only", "advisory", "closed", "historical"];

// Richer, range-capable fields layered onto the base records by id. Kept separate
// so base scoring magnitudes (and their tests) stay unchanged. lastVerified +
// requiresManualVerification reflect that these are manual, human-review-only.
const PROGRAM_ENRICHMENT = {
  "canexport-smes": {
    status: "verify_intake",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    funding: { maxFunding: 50000, minFunding: 10000, currency: "CAD", costSharePercent: 0.5, amountLabel: "$10K–$50K, up to ~50% of eligible costs" },
    requirements: { forProfit: true, incorporatedOrRegistered: "required", employeeMin: 3, employeeMax: 500, revenueMin: 300000, provinceRequired: null, countryRequired: "Canada" },
    eligibleActivityNotes: ["Market-specific promotional materials", "Trade-show assets", "Translated/adapted website materials", "B2B meeting facilitation", "Market research"],
    ineligibleActivityNotes: ["Broad advertising", "SEO", "Generic social media", "Online store development", "SaaS tools", "Cold email campaigns", "Photography", "Ongoing marketing operations"],
    outreachAngle: { serviceAngle: "Export Market Content Kit", recommendedNextStep: "Confirm target export markets and CanExport-eligible activity types before pitching export-market content assets.", caution: "Min 3 full-time employees and $300K+ revenue; many generic marketing expenses are not eligible." }
  },
  "ontario-dmap": {
    status: "verify_intake",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    funding: { maxFunding: 15000, currency: "CAD", costSharePercent: null, amountLabel: "up to $15K in DMAP support" },
    requirements: { forProfit: true, incorporatedOrRegistered: "preferred_or_required", employeeMin: 1, employeeMax: 499, revenueMin: null, provinceRequired: "Ontario", countryRequired: "Canada" },
    eligibleActivityNotes: ["Digital modernization planning", "Custom digital adoption plan with an approved consultant"],
    ineligibleActivityNotes: [],
    outreachAngle: { serviceAngle: "Digital Adoption Roadmap", recommendedNextStep: "Verify Ontario SME criteria and position a Digital Modernization & Adoption Plan strategy call.", caution: "Confirm current intake and whether an approved consultant/vendor is required." }
  },
  "strategic-agri-food-processing-fund": {
    status: "verify_intake",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    requiresIndustryMatch: true,
    funding: { maxFunding: null, currency: "CAD", costSharePercent: null, amountLabel: "Project support; verify current envelope and cost-share" },
    requirements: { forProfit: true, provinceRequired: "Ontario", countryRequired: "Canada" },
    eligibleActivityNotes: ["Modernization narrative", "Operational content system", "Expansion project assets"],
    ineligibleActivityNotes: [],
    outreachAngle: { serviceAngle: "Modernization Project Content", recommendedNextStep: "Confirm the Ontario agri-food processing project scope and capital plan before positioning content support.", caution: "Verify current intake and eligible cost categories." }
  },
  "irap": {
    status: "verify_intake",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    funding: { maxFunding: null, currency: "CAD", costSharePercent: null, amountLabel: "Advisory + project funding; varies by ITA assessment" },
    requirements: { forProfit: true, employeeMax: 500, countryRequired: "Canada" },
    eligibleActivityNotes: ["Commercialization narrative", "Go-to-market content"],
    ineligibleActivityNotes: ["General marketing without an R&D/innovation project"],
    outreachAngle: { serviceAngle: "Commercialization Content & GTM", recommendedNextStep: "Confirm R&D/commercialization stage and ITA engagement before positioning go-to-market assets.", caution: "IRAP funds R&D/innovation, not general marketing." }
  },
  "canexport-innovation": {
    status: "verify_intake",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    funding: { maxFunding: 75000, currency: "CAD", costSharePercent: 0.75, amountLabel: "R&D partnership support; verify current terms" },
    requirements: { forProfit: true, countryRequired: "Canada" },
    eligibleActivityNotes: ["International partnership pitch materials", "Project validation narrative"],
    ineligibleActivityNotes: ["General export advertising"],
    outreachAngle: { serviceAngle: "Partnership Pitch Materials", recommendedNextStep: "Confirm the international R&D partner and project scope before positioning pitch materials.", caution: "For international technology R&D partnerships, not general export marketing." }
  },
  "canada-summer-jobs": {
    status: "verify_intake",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    funding: { maxFunding: null, currency: "CAD", costSharePercent: null, amountLabel: "Wage subsidy for eligible youth hires" },
    requirements: { countryRequired: "Canada" },
    eligibleActivityNotes: ["Fundable marketing/content/digital coordinator role plan"],
    ineligibleActivityNotes: [],
    outreachAngle: { serviceAngle: "Marketing/Content Role Plan", recommendedNextStep: "Confirm a fundable youth role (marketing/content/digital coordinator) and the seasonal intake timing.", caution: "Seasonal wage subsidy, not project funding." }
  },
  "canada-digital-adoption-program-bybt": {
    status: "closed",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    funding: { maxFunding: null, currency: "CAD", costSharePercent: null, amountLabel: "Closed to new Boost Your Business Technology applicants (Feb 19, 2024)" },
    requirements: { countryRequired: "Canada" },
    eligibleActivityNotes: [],
    ineligibleActivityNotes: ["Not accepting new applicants — reference only"],
    outreachAngle: { serviceAngle: "Digital Plan (successor programs)", recommendedNextStep: "Treat as a historical benchmark only; verify a current successor or provincial stream before positioning.", caution: "CDAP Boost Your Business Technology stopped accepting new applications on Feb 19, 2024." }
  },
  "ontario-procurement-readiness": {
    status: "advisory",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    funding: { maxFunding: null, currency: "CAD", costSharePercent: null, amountLabel: "Advisory lane; not a grant program" },
    requirements: { provinceRequired: "Ontario", countryRequired: "Canada" },
    eligibleActivityNotes: ["Supplier profile", "Capability statement", "RFP response assets"],
    ineligibleActivityNotes: [],
    outreachAngle: { serviceAngle: "Procurement Readiness Package", recommendedNextStep: "Confirm target government buyers and build a supplier profile + capability statement.", caution: "Advisory lane, not a funding program." }
  }
};

// New programs from the 2026-06-19 research seed (manual, verify before client claims).
const NEW_PROGRAMS = [
  {
    id: "ontario-dcc-tdp",
    name: "Technology Demonstration Program (TDP)",
    provider: "Ontario Centre of Innovation / Digitalization Competence Centre",
    fundingType: "Digital adoption implementation",
    statusLabel: "Manual review",
    sourceUrl: "https://www.oc-innovation.ca/programs/digital-competence-centre/",
    lastVerifiedOn: "2026-06-19",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    intakeStatus: "verify_current_intake",
    status: "verify_intake",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: ["Ontario"] },
    lanes: ["digital_adoption", "ecommerce_growth"],
    industries: ["manufacturing", "retail", "professional services", "technology", "construction"],
    targetBusinessLabels: ["Ontario SMEs implementing a DMAP", "Manufacturers", "Service businesses"],
    projectTypes: ["technology implementation", "digital adoption", "automation", "ecommerce"],
    eligibleProjectExamples: ["Implementation content system", "Automation rollout assets", "Adoption change-management content"],
    servicePackageIds: ["fundable-project-blueprint", "funded-growth-execution"],
    minEmployees: 1,
    maxEmployees: 499,
    minAnnualRevenue: 750000,
    funding: { maxFunding: 50000, currency: "CAD", costSharePercent: null, amountLabel: "up to $50K to implement DMAP recommendations" },
    requirements: { forProfit: true, incorporatedOrRegistered: "required", employeeMin: 1, employeeMax: 499, revenueMin: 750000, provinceRequired: "Ontario", countryRequired: "Canada", requiresCompletedDmap: true },
    eligibleActivityNotes: ["Implementation of approved DMAP recommendations"],
    ineligibleActivityNotes: ["Work outside the approved adoption plan"],
    outreachAngle: { serviceAngle: "Adoption Implementation Content", recommendedNextStep: "Confirm a completed DMAP and $750K+ revenue, then scope the implementation content and rollout.", caution: "TDP typically requires a completed DMAP and revenue thresholds — verify current rules." },
    fitNotes: "Potential fit for Ontario SMEs implementing a completed digital adoption plan."
  },
  {
    id: "ontario-dcc-rmpg",
    name: "Retail Modernization Project Grant (RMPG)",
    provider: "Ontario Centre of Innovation / Digitalization Competence Centre",
    fundingType: "Retail modernization",
    statusLabel: "Manual review",
    sourceUrl: "https://www.oc-innovation.ca/programs/digital-competence-centre/",
    lastVerifiedOn: "2026-06-19",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    intakeStatus: "verify_current_intake",
    status: "verify_intake",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: ["Ontario"] },
    lanes: ["ecommerce_growth", "digital_adoption"],
    industries: ["retail", "consumer goods", "food", "beauty", "apparel", "hospitality"],
    targetBusinessLabels: ["Ontario DTC storefronts", "Retailers", "Local brands"],
    projectTypes: ["retail modernization", "ecommerce", "pos", "online store", "booking"],
    eligibleProjectExamples: ["Storefront-to-online content", "Product storytelling kit", "Conversion-ready landing pages"],
    servicePackageIds: ["fundable-project-blueprint", "funded-growth-execution"],
    minEmployees: 1,
    minAnnualRevenue: 100000,
    funding: { maxFunding: 5000, currency: "CAD", costSharePercent: null, amountLabel: "up to $5K for qualifying retail modernization" },
    requirements: { forProfit: true, directToConsumer: true, physicalStorefront: true, employeeMin: 1, revenueMin: 100000, yearsOperatingMin: 1, provinceRequired: "Ontario", countryRequired: "Canada" },
    eligibleActivityNotes: ["Direct-to-consumer storefront modernization", "E-commerce/content for a physical retailer"],
    ineligibleActivityNotes: ["Pure online resellers without a storefront (verify)"],
    outreachAngle: { serviceAngle: "Retail E-commerce Conversion Sprint", recommendedNextStep: "Confirm an Ontario DTC storefront, 1+ year operating, and $100K+ revenue, then scope a retail modernization content sprint.", caution: "Smaller grant; verify storefront and DTC eligibility." },
    fitNotes: "Potential fit for Ontario direct-to-consumer storefront retailers modernizing online."
  },
  {
    id: "creative-export-canada-export-ready",
    requiresIndustryMatch: true,
    name: "Creative Export Canada — Export-Ready",
    provider: "Canadian Heritage",
    fundingType: "Creative export",
    statusLabel: "Manual review",
    sourceUrl: "https://www.canada.ca/en/canadian-heritage/services/funding/creative-export-canada.html",
    lastVerifiedOn: "2026-06-19",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    intakeStatus: "verify_current_intake",
    status: "verify_intake",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: [] },
    lanes: ["creative_tech", "export_marketing", "market_expansion"],
    industries: ["music", "media", "creative", "audiovisual", "publishing", "design", "entertainment"],
    targetBusinessLabels: ["Creative IP owners", "Studios", "Labels", "Export-ready creative businesses"],
    projectTypes: ["creative export", "international audience growth", "market expansion", "discoverability"],
    eligibleProjectExamples: ["Media kit / pitch deck", "International audience growth campaign", "Partnership assets"],
    servicePackageIds: ["fundable-project-blueprint", "funded-growth-execution"],
    minEmployees: 1,
    funding: { maxFunding: null, currency: "CAD", costSharePercent: null, amountLabel: "Project support; verify current terms" },
    requirements: { forProfit: true, ownsCreativeIp: true, exportFocus: true, countryRequired: "Canada" },
    eligibleActivityNotes: ["International creative-market campaign assets", "Export-ready media kit"],
    ineligibleActivityNotes: ["Purely domestic marketing"],
    outreachAngle: { serviceAngle: "Creative Export Readiness Brief", recommendedNextStep: "Confirm Canadian creative IP ownership and an international target market, then scope export-ready media assets.", caution: "Requires owned/controlled creative IP and an export market focus." },
    fitNotes: "Potential fit for Canadian creative businesses with owned IP and international market goals."
  },
  {
    id: "creative-export-canada-export-development",
    requiresIndustryMatch: true,
    name: "Creative Export Canada — Export Development",
    provider: "Canadian Heritage",
    fundingType: "Creative export",
    statusLabel: "Manual review",
    sourceUrl: "https://www.canada.ca/en/canadian-heritage/services/funding/creative-export-canada.html",
    lastVerifiedOn: "2026-06-19",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    intakeStatus: "verify_current_intake",
    status: "verify_intake",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: [] },
    lanes: ["creative_tech", "export_marketing"],
    industries: ["music", "media", "creative", "audiovisual", "publishing", "design", "entertainment"],
    targetBusinessLabels: ["Early export-stage creative businesses", "Artists with commercial growth plans"],
    projectTypes: ["creative export development", "market research", "audience development"],
    eligibleProjectExamples: ["Market-entry content strategy", "Audience development campaign", "Partner/tour assets"],
    servicePackageIds: ["fundable-project-blueprint", "application-support"],
    minEmployees: 1,
    funding: { maxFunding: null, currency: "CAD", costSharePercent: null, amountLabel: "Early-stage export development support; verify terms" },
    requirements: { forProfit: true, ownsCreativeIp: true, exportFocus: true, countryRequired: "Canada" },
    eligibleActivityNotes: ["Early export development assets", "Market-entry content strategy"],
    ineligibleActivityNotes: ["Purely domestic marketing"],
    outreachAngle: { serviceAngle: "Creative Market-Entry Strategy", recommendedNextStep: "Confirm IP ownership and an early export-development goal, then scope a market-entry content strategy.", caution: "For earlier-stage creative export development; verify stream eligibility." },
    fitNotes: "Potential fit for Canadian creative businesses in early international development."
  },
  {
    id: "cmf-innovation-experimentation",
    requiresIndustryMatch: true,
    name: "Canada Media Fund — Innovation & Experimentation",
    provider: "Canada Media Fund",
    fundingType: "Interactive digital media",
    statusLabel: "Manual review",
    sourceUrl: "https://cmf-fmc.ca/program/innovation-experimentation-program/",
    lastVerifiedOn: "2026-06-19",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    intakeStatus: "verify_current_intake",
    status: "verify_intake",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: [] },
    lanes: ["creative_tech", "digital_adoption"],
    industries: ["interactive media", "software", "media", "technology", "gaming", "xr"],
    targetBusinessLabels: ["Canadian interactive digital media projects", "Game/XR/app studios"],
    projectTypes: ["interactive digital media", "innovation", "experimentation", "prototype", "commercialization"],
    eligibleProjectExamples: ["Product demo content system", "Discoverability and commercialization plan", "Investor/partner pitch materials"],
    servicePackageIds: ["fundable-project-blueprint", "funded-growth-execution"],
    minEmployees: 1,
    funding: { maxFunding: null, currency: "CAD", costSharePercent: null, amountLabel: "Project support; verify current program terms" },
    requirements: { forProfit: true, canadianOwned: true, interactiveDigitalMedia: true, countryRequired: "Canada" },
    eligibleActivityNotes: ["Interactive media commercialization/discoverability content"],
    ineligibleActivityNotes: ["General marketing without an interactive media / IP project"],
    outreachAngle: { serviceAngle: "IDM Commercialization Content", recommendedNextStep: "Confirm Canadian-owned interactive media / IP and project stage, then scope a discoverability + commercialization plan.", caution: "Only for Canadian creative IP / interactive digital media — not a general marketing grant." },
    fitNotes: "Potential fit for Canadian-owned interactive digital media projects."
  },
  {
    id: "cmf-prototyping",
    requiresIndustryMatch: true,
    name: "Canada Media Fund — Prototyping",
    provider: "Canada Media Fund",
    fundingType: "Interactive digital media",
    statusLabel: "Manual review",
    sourceUrl: "https://cmf-fmc.ca/program/prototyping-program/",
    lastVerifiedOn: "2026-06-19",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    intakeStatus: "verify_current_intake",
    status: "verify_intake",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: [] },
    lanes: ["creative_tech"],
    industries: ["interactive media", "software", "gaming", "xr", "technology"],
    targetBusinessLabels: ["Canadian IDM prototype-stage projects", "Game/XR/app studios"],
    projectTypes: ["prototype", "interactive digital media", "concept", "production"],
    eligibleProjectExamples: ["Prototype launch assets", "Product demo content", "Pitch materials"],
    servicePackageIds: ["fundable-project-blueprint"],
    minEmployees: 1,
    funding: { maxFunding: null, currency: "CAD", costSharePercent: null, amountLabel: "Prototype-stage support; verify current terms" },
    requirements: { forProfit: true, canadianOwned: true, interactiveDigitalMedia: true, projectStage: "prototype", countryRequired: "Canada" },
    eligibleActivityNotes: ["Prototype launch and demo content"],
    ineligibleActivityNotes: ["Non-IDM marketing"],
    outreachAngle: { serviceAngle: "Prototype Launch Assets", recommendedNextStep: "Confirm a Canadian-owned IDM prototype-stage project, then scope prototype launch + demo content.", caution: "Prototype-stage interactive media only — verify ownership and stage." },
    fitNotes: "Potential fit for Canadian interactive media projects at prototype stage."
  },
  {
    id: "ontario-creates-interactive-digital-media-ip-fund",
    requiresIndustryMatch: true,
    name: "Ontario Creates — Interactive Digital Media Fund",
    provider: "Ontario Creates",
    fundingType: "Interactive digital media",
    statusLabel: "Manual review",
    sourceUrl: "https://www.ontariocreates.ca/investment-programs/content-creation/idm-fund",
    lastVerifiedOn: "2026-06-19",
    lastVerified: "2026-06-19",
    requiresManualVerification: true,
    intakeStatus: "verify_current_intake",
    status: "verify_intake",
    tenantIds: ["*"],
    jurisdictions: { countries: ["Canada"], provinces: ["Ontario"] },
    lanes: ["creative_tech", "digital_adoption"],
    industries: ["interactive media", "software", "media", "gaming", "xr", "cultural"],
    targetBusinessLabels: ["Ontario interactive digital media companies", "Cultural software/media producers"],
    projectTypes: ["interactive digital media", "production", "commercialization", "cultural content"],
    eligibleProjectExamples: ["Product demo content system", "Discoverability plan", "Partner pitch materials"],
    servicePackageIds: ["fundable-project-blueprint", "funded-growth-execution"],
    minEmployees: 1,
    funding: { maxFunding: null, currency: "CAD", costSharePercent: null, amountLabel: "Project support; verify current program terms" },
    requirements: { forProfit: true, canadianOwned: true, interactiveDigitalMedia: true, provinceRequired: "Ontario", countryRequired: "Canada" },
    eligibleActivityNotes: ["Ontario IDM production / commercialization content"],
    ineligibleActivityNotes: ["General marketing without an IDM / IP project"],
    outreachAngle: { serviceAngle: "IDM Discoverability & Commercialization", recommendedNextStep: "Confirm an Ontario-based, Canadian-owned interactive media / IP project, then scope discoverability + commercialization assets.", caution: "Ontario interactive digital media / IP only — verify eligibility and project type." },
    fitNotes: "Potential fit for Ontario-based Canadian-owned interactive digital media projects."
  }
];

export const manualFundingPrograms = [
  ...BASE_PROGRAMS.map((program) => ({ ...program, ...(PROGRAM_ENRICHMENT[program.id] || {}) })),
  ...NEW_PROGRAMS
];

export const fundingOpportunityStatuses = [
  "verify_current_intake",
  "advisory_only",
  "concluded_verify_successor"
];

const activeLikeStatuses = new Set(["verify_current_intake", "advisory_only"]);

export function matchFundingProgramsForInput(input = {}, options = {}) {
  const fundingScore = options.fundingScore || scoreFundingFit(input);
  const programs = options.programs || manualFundingPrograms;
  const limit = Number(options.limit || 5);
  const normalizedInput = normalizeFundingInput(input);

  return programs
    .map((program) => scoreProgramMatch({ program, input: normalizedInput, fundingScore }))
    .filter((match) => match.matchScore > 0)
    .sort((a, b) => {
      const scoreDelta = b.matchScore - a.matchScore;
      if (scoreDelta) return scoreDelta;
      return a.program.name.localeCompare(b.program.name);
    })
    .slice(0, limit);
}

export function findFundingProgram(programId, programs = manualFundingPrograms) {
  return programs.find((program) => program.id === programId) || null;
}

export function listFundingProgramsForTenant(tenantId, programs = manualFundingPrograms) {
  return programs.filter((program) => {
    const tenantIds = program.tenantIds || ["*"];
    return tenantIds.includes("*") || tenantIds.includes(tenantId);
  });
}

function scoreProgramMatch({ program, input, fundingScore }) {
  const matchedSignals = [];
  const reviewGaps = [];
  const disqualifiers = [];
  let score = 0;

  const jurisdiction = scoreJurisdiction({ program, input, matchedSignals, reviewGaps, disqualifiers });
  if (jurisdiction.disqualified) {
    // Hard gate: a jurisdiction-gated program never ranks when the business
    // jurisdiction is unknown, foreign, or mismatched. matchScore 0 is filtered out.
    return {
      program,
      matchScore: 0,
      confidence: "low",
      matchedLanes: [],
      matchedSignals,
      reviewGaps,
      disqualifiers,
      outreachAngle: program.outreachAngle || null,
      recommendedNextStep: program.outreachAngle?.recommendedNextStep || "",
      disqualified: true
    };
  }
  score += jurisdiction.score;

  const laneScore = scoreLanes({ program, fundingScore, matchedSignals });
  score += laneScore;

  const industryMatch = matchesAny(input.industry, program.industries);
  const projectText = [input.industry, ...input.goals, ...input.channels, ...input.currentCapabilities].join(" ");
  const matchedProjectType = (program.projectTypes || []).find((projectType) =>
    includesNormalized(projectText, projectType)
  );

  // Sector gate: a sector-exclusive program never ranks without an explicit
  // industry match (e.g. an Agri-Food fund for a generic retailer, or an
  // interactive-media fund for a non-IDM business). Generic project signals
  // like "automation"/"modernization" are not enough on their own.
  if (program.requiresIndustryMatch && !industryMatch) {
    disqualifiers.push(
      `${program.name} targets ${(program.industries || []).slice(0, 3).join(", ")} — confirm sector fit before recommending.`
    );
    return {
      program,
      matchScore: 0,
      confidence: "low",
      matchedLanes: [],
      matchedSignals,
      reviewGaps,
      disqualifiers,
      outreachAngle: program.outreachAngle || null,
      recommendedNextStep: program.outreachAngle?.recommendedNextStep || "",
      disqualified: true
    };
  }

  if (industryMatch) {
    score += 14;
    matchedSignals.push(`Industry aligns with ${program.name}`);
  }
  if (matchedProjectType) {
    score += 16;
    matchedSignals.push(`Project signal: ${matchedProjectType}`);
  }

  score += scoreBusinessReadiness({ program, input, matchedSignals, reviewGaps });

  if (!activeLikeStatuses.has(program.intakeStatus)) {
    score -= 22;
    reviewGaps.push("Program status is not current-ready; verify successor, intake, or replacement path.");
  } else if (program.intakeStatus === "verify_current_intake") {
    reviewGaps.push("Verify current intake window, budget, and application rules before recommending.");
  }

  const matchScore = clampScore(score);
  const confidence = matchScore >= 75 ? "high" : matchScore >= 50 ? "medium" : "low";

  return {
    program,
    matchScore,
    confidence,
    matchedLanes: program.lanes.map((lane) => ({
      id: lane,
      label: FUNDING_LANE_LABELS[lane] || lane,
      score: fundingScore.laneScores?.[lane] || 0
    })),
    matchedSignals,
    reviewGaps,
    disqualifiers,
    outreachAngle: program.outreachAngle || null,
    recommendedNextStep: program.outreachAngle?.recommendedNextStep || program.fitNotes || "",
    disqualified: false
  };
}

function scoreJurisdiction({ program, input, matchedSignals, reviewGaps, disqualifiers }) {
  const countries = normalizeList(program.jurisdictions?.countries);
  const provinces = normalizeList(program.jurisdictions?.provinces);

  // Country gate: must be explicitly identified AND in the program's countries.
  if (countries.length) {
    if (!input.country) {
      disqualifiers.push(`Confirm business country — ${program.jurisdictions.countries.join(", ")} required.`);
      return { score: 0, disqualified: true };
    }
    if (!countries.includes(input.country)) {
      disqualifiers.push(`Outside program jurisdiction (${program.jurisdictions.countries.join(", ")}).`);
      return { score: 0, disqualified: true };
    }
  }

  // Province gate: province-specific programs require the explicit province.
  if (provinces.length) {
    if (!input.province) {
      disqualifiers.push(`Confirm province — ${program.jurisdictions.provinces.join(", ")} required.`);
      return { score: 0, disqualified: true };
    }
    if (!provinces.includes(input.province)) {
      disqualifiers.push(`Outside program region (${program.jurisdictions.provinces.join(", ")}).`);
      return { score: 0, disqualified: true };
    }
    matchedSignals.push(`Province match: ${titleCase(input.province)}`);
    return { score: 24, disqualified: false };
  }

  if (countries.length) {
    matchedSignals.push(`Country match: ${titleCase(input.country)}`);
    return { score: 18, disqualified: false };
  }

  return { score: 8, disqualified: false };
}

function scoreLanes({ program, fundingScore, matchedSignals }) {
  let score = 0;

  for (const lane of program.lanes || []) {
    const laneFit = Number(fundingScore.laneScores?.[lane] || 0);
    if (lane === fundingScore.bestFundingLane) {
      score += 28;
      matchedSignals.push(`Best lane match: ${FUNDING_LANE_LABELS[lane] || lane}`);
    } else if (laneFit >= 40) {
      score += 18;
      matchedSignals.push(`Strong lane signal: ${FUNDING_LANE_LABELS[lane] || lane}`);
    } else if (laneFit >= 20) {
      score += 10;
    }
  }

  return Math.min(score, 38);
}

function scoreBusinessReadiness({ program, input, matchedSignals, reviewGaps }) {
  let score = 0;

  if (program.minEmployees && input.employeeCount < program.minEmployees) {
    reviewGaps.push(`Confirm employee count meets ${program.name} requirements.`);
  } else if (input.employeeCount) {
    score += 5;
    matchedSignals.push("Employee count supplied");
  }

  if (program.maxEmployees && input.employeeCount > program.maxEmployees) {
    reviewGaps.push(`Employee count may exceed ${program.name} size limits.`);
  }

  if (program.minAnnualRevenue && input.annualRevenue < program.minAnnualRevenue) {
    reviewGaps.push(`Confirm revenue traction meets ${program.name} requirements.`);
  } else if (input.annualRevenue) {
    score += 7;
    matchedSignals.push("Revenue range supplied");
  }

  if (program.maxAnnualRevenue && input.annualRevenue > program.maxAnnualRevenue) {
    reviewGaps.push(`Revenue may exceed ${program.name} size limits.`);
  }

  return score;
}

function normalizeFundingInput(input = {}) {
  return {
    province: normalizeText(input.province),
    country: normalizeText(input.country),
    industry: normalizeText(input.industry),
    goals: normalizeList(input.goals),
    channels: normalizeList(input.channels),
    currentCapabilities: normalizeList(input.currentCapabilities),
    annualRevenue: Number(input.annualRevenue || 0),
    employeeCount: Number(input.employeeCount || 0)
  };
}

function normalizeList(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map(normalizeText).filter(Boolean);
}

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function matchesAny(value, candidates = []) {
  const text = normalizeText(value);
  return candidates.some((candidate) => includesNormalized(text, candidate));
}

function includesNormalized(value, candidate) {
  return normalizeText(value).includes(normalizeText(candidate));
}

function titleCase(value) {
  return normalizeText(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function validateManualFundingPrograms(programs = manualFundingPrograms) {
  const ids = new Set();
  const errors = [];

  programs.forEach((program, index) => {
    const path = `programs.${index}`;
    if (!program.id) errors.push(`${path}.id is required`);
    if (ids.has(program.id)) errors.push(`${path}.id must be unique`);
    ids.add(program.id);
    if (!program.name) errors.push(`${path}.name is required`);
    if (!program.provider) errors.push(`${path}.provider is required`);
    if (!program.sourceUrl) errors.push(`${path}.sourceUrl is required`);
    if (!program.lastVerifiedOn) errors.push(`${path}.lastVerifiedOn is required`);
    if (!program.intakeStatus) errors.push(`${path}.intakeStatus is required`);
    if (!Array.isArray(program.lanes) || !program.lanes.length) errors.push(`${path}.lanes is required`);
    for (const lane of program.lanes || []) {
      if (!FUNDING_LANES.includes(lane)) errors.push(`${path}.lanes includes unknown lane ${lane}`);
    }
    if (!program.status || !PROGRAM_STATUSES.includes(program.status)) {
      errors.push(`${path}.status must be one of ${PROGRAM_STATUSES.join(", ")}`);
    }
    if (!program.funding || typeof program.funding !== "object") errors.push(`${path}.funding is required`);
    if (!program.requirements || typeof program.requirements !== "object") errors.push(`${path}.requirements is required`);
    if (!program.outreachAngle?.recommendedNextStep) errors.push(`${path}.outreachAngle.recommendedNextStep is required`);
    if (!program.lastVerified) errors.push(`${path}.lastVerified is required`);
  });

  return {
    ok: errors.length === 0,
    errors
  };
}
