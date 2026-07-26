import { FUNDING_LANE_LABELS } from "./constants.js";
import { parseJurisdiction } from "./normalizeLocation.js";
import {
  listFundingProgramsForTenant,
  matchFundingProgramsForInput
} from "./programDatabase.js";
import { scoreFundingFit } from "./scoring.js";

const revenueMidpoints = {
  pre_revenue: 0,
  under_100k: 50000,
  "100k_500k": 250000,
  "500k_1m": 750000,
  "1m_5m": 2500000,
  "5m_plus": 5000000
};

export function isFundingScanLead(lead = {}) {
  const metadata = lead.sourceMetadata || lead.metadata || {};
  return lead.sourceType === "funding_scan" || Boolean(metadata.fundingScan);
}

export function fundingScanFromLead(lead = {}) {
  const metadata = lead.sourceMetadata || lead.metadata || {};
  return metadata.fundingScan || {};
}

export function buildFundingFitInputFromLead(lead = {}) {
  const scan = fundingScanFromLead(lead);
  const location = scan.location || [lead.city, lead.region, lead.country].filter(Boolean).join(", ");
  const digitalNeeds = scan.digitalNeeds || "";
  const ecommerceNeeds = scan.ecommerceNeeds || "";
  const crmAutomationNeeds = scan.crmAutomationNeeds || "";
  const mainGrowthGoal = scan.mainGrowthGoal || lead.notes || "";
  const jurisdiction = parseJurisdiction(location, {
    country: scan.country || lead.country,
    province: scan.province || lead.region
  });

  return {
    province: jurisdiction.province || "",
    country: jurisdiction.country || "",
    jurisdictionConfidence: jurisdiction.confidence,
    industry: scan.industry || lead.category || "",
    goals: [mainGrowthGoal].filter(Boolean),
    channels: [ecommerceNeeds].filter(Boolean),
    currentCapabilities: [digitalNeeds, ecommerceNeeds, crmAutomationNeeds].filter(Boolean),
    annualRevenue: revenueMidpoints[scan.revenueRange] || 0,
    employeeCount: Number(scan.employeeCount || 0),
    sellsOnline: hasSubstantiveNeed(ecommerceNeeds),
    exports: scan.currentlyExporting === "yes" || scan.interestedInExporting === "yes",
    hasTrainingNeed: textIncludes([digitalNeeds, crmAutomationNeeds, mainGrowthGoal], ["training", "upskill", "enablement"]),
    sellsToGovernment: textIncludes([digitalNeeds, ecommerceNeeds, crmAutomationNeeds, mainGrowthGoal], ["government", "procurement", "rfp"]),
    usesCleanTech: textIncludes([scan.industry, mainGrowthGoal], ["clean tech", "cleantech", "sustainability", "climate", "energy"]),
    availableProjectBudget: scan.availableProjectBudget || ""
  };
}

export function scoreFundingLead(lead = {}) {
  const input = buildFundingFitInputFromLead(lead);
  const score = scoreFundingFit(input);
  return {
    ...score,
    bestFundingLaneLabel: FUNDING_LANE_LABELS[score.bestFundingLane] || score.bestFundingLane,
    programMatches: matchFundingProgramsForInput(input, { fundingScore: score, limit: 3 })
  };
}

export function matchFundingProgramsForLead(lead = {}, options = {}) {
  const input = buildFundingFitInputFromLead(lead);
  const fundingScore = scoreFundingFit(input);
  return matchFundingProgramsForInput(input, {
    fundingScore,
    programs: options.programs,
    limit: options.limit || 5
  });
}

export function buildFundingProgramLeadMatches(program, leads = [], options = {}) {
  const minScore = Number(options.minScore || 45);
  return leads
    .map((lead) => {
      const [match] = matchFundingProgramsForLead(lead, { programs: [program], limit: 1 });
      if (!match || match.matchScore < minScore) return null;
      return {
        lead,
        matchScore: match.matchScore,
        confidence: match.confidence,
        matchedSignals: match.matchedSignals,
        reviewGaps: match.reviewGaps,
        outreachAngle: buildFundingOpportunityOutreachAngle({ program, lead, match }),
        recommendedPackageId: recommendedPackageForProgram(program)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function buildFundingOpportunityDashboard({ tenantId, leads = [] } = {}) {
  const programs = listFundingProgramsForTenant(tenantId);
  return programs.map((program) => ({
    program,
    leadMatches: buildFundingProgramLeadMatches(program, leads).slice(0, 5),
    proposalChecklist: buildFundingProposalChecklist(program)
  }));
}

export function buildFundingOpportunityOutreachAngle({ program, lead = {}, match = {} }) {
  const businessName = lead.businessName || lead.business || "this business";
  const packageId = recommendedPackageForProgram(program);
  const projectExample = program.eligibleProjectExamples?.[0] || program.projectTypes?.[0] || "a fundable growth project";
  const strongestSignal = match.matchedSignals?.[0] || program.fitNotes;

  return {
    subject: `${program.fundingType || "Funding"} angle for ${businessName}`,
    opener:
      `${businessName} may be worth reviewing against ${program.name} because ${strongestSignal}.`,
    serviceAngle:
      `The practical next step is to shape ${projectExample} into a scoped project with budget, milestones, and evidence.`,
    recommendedPackageId: packageId
  };
}

export function buildFundingProposalChecklist(program = {}) {
  return [
    "Confirm intake status, deadline, eligible costs, and program rules.",
    "Confirm business location, industry, size, revenue, and ownership requirements.",
    `Shape the project around ${program.projectTypes?.slice(0, 2).join(" or ") || "the strongest eligible activity"}.`,
    "Collect current website, growth goals, budget range, timeline, and internal owner.",
    "Prepare plain-language scope, budget assumptions, milestones, outcomes, and measurement plan.",
    "Route interested leads into blueprint, application support, or execution package."
  ];
}

function hasSubstantiveNeed(value) {
  const text = normalizeText(value);
  return Boolean(text) && !["none", "no", "n/a", "na", "not applicable"].includes(text);
}

function recommendedPackageForProgram(program = {}) {
  return program.servicePackageIds?.[0] || "fundable-project-blueprint";
}

function textIncludes(values, keywords) {
  const haystack = normalizeText(values.filter(Boolean).join(" "));
  return keywords.some((keyword) => haystack.includes(keyword));
}

function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase();
}
