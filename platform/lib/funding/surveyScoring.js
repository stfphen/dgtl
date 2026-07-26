import { scoreFundingFit } from "./scoring.js";
import { matchFundingProgramsForInput } from "./programDatabase.js";

/**
 * Survey scoring layer. Reuses the deterministic engine (scoreFundingFit +
 * matchFundingProgramsForInput) and adds conservative estimated funding ranges,
 * explicit missing requirements / disqualifiers, and survey-grade confidence.
 *
 * Principles: hard requirements gate confidence (not just add points); never
 * estimate more than the program cap / cost-share; closed or unknown programs
 * never reach high confidence.
 */

const OPEN_STATUSES = new Set(["active", "verify_intake", "invite_only", "advisory"]);

export function estimateFundingRange(program = {}, input = {}) {
  const funding = program.funding || {};
  const currency = funding.currency || "CAD";

  if (!OPEN_STATUSES.has(program.status)) {
    return { min: null, max: null, currency, label: `${funding.amountLabel || "Reference only"} — program not open`, referenceOnly: true };
  }
  if (!funding.maxFunding) {
    return { min: null, max: null, currency, label: funding.amountLabel || "Program ceiling to verify", ceilingOnly: true };
  }

  const budget = Number(input.availableProjectBudget || 0);
  if (!budget) {
    return {
      min: null,
      max: funding.maxFunding,
      currency,
      label: `Program ceiling up to $${funding.maxFunding.toLocaleString()} ${currency} — verify with a project budget`,
      ceilingOnly: true
    };
  }

  const byShare = funding.costSharePercent ? Math.round(budget * funding.costSharePercent) : funding.maxFunding;
  const estimatedMax = Math.min(funding.maxFunding, byShare);
  const estimatedMin = Math.min(estimatedMax, funding.minFunding || Math.round(estimatedMax * 0.5));

  return {
    min: estimatedMin,
    max: estimatedMax,
    currency,
    label: `$${estimatedMin.toLocaleString()}–$${estimatedMax.toLocaleString()} ${currency} planning range to verify`,
    referenceOnly: false,
    ceilingOnly: false
  };
}

export function checkRequirements(program = {}, input = {}) {
  const req = program.requirements || {};
  const missingRequirements = [];
  const disqualifiers = [];

  if (req.provinceRequired && input.province !== req.provinceRequired) {
    if (!input.province) missingRequirements.push(`Confirm province (${req.provinceRequired} required).`);
    else disqualifiers.push(`Province ${input.province} is outside ${req.provinceRequired}.`);
  }
  if (req.countryRequired && input.country && input.country !== req.countryRequired) {
    disqualifiers.push(`Outside ${req.countryRequired}.`);
  }
  if (req.countryRequired && !input.country) {
    missingRequirements.push(`Confirm business country (${req.countryRequired} required).`);
  }
  if (req.employeeMin && input.employeeCount && input.employeeCount < req.employeeMin) {
    disqualifiers.push(`Needs at least ${req.employeeMin} employees.`);
  }
  if (req.employeeMin && !input.employeeCount) {
    missingRequirements.push(`Confirm employee count (min ${req.employeeMin}).`);
  }
  if (req.employeeMax && input.employeeCount && input.employeeCount > req.employeeMax) {
    disqualifiers.push(`Exceeds ${req.employeeMax}-employee limit.`);
  }
  if (req.revenueMin && input.annualRevenue && input.annualRevenue < req.revenueMin) {
    disqualifiers.push(`Needs ~$${req.revenueMin.toLocaleString()}+ annual revenue.`);
  }
  if (req.revenueMin && !input.annualRevenue) {
    missingRequirements.push(`Confirm annual revenue (min ~$${req.revenueMin.toLocaleString()}).`);
  }
  if (req.yearsOperatingMin && input.yearsOperating && input.yearsOperating < req.yearsOperatingMin) {
    disqualifiers.push(`Needs ${req.yearsOperatingMin}+ year(s) operating.`);
  }
  if (req.requiresCompletedDmap && !input.completedDmap) {
    missingRequirements.push("Confirm a completed Digital Adoption Plan (DMAP).");
  }
  if (req.ownsCreativeIp && !input.ownsCreativeIp) {
    missingRequirements.push("Confirm ownership/control of the creative IP/work.");
  }
  if (req.interactiveDigitalMedia && !input.interactiveDigitalMedia) {
    disqualifiers.push("Project is not interactive digital media / IP.");
  }
  if (req.canadianOwned && !input.canadianOwned) {
    missingRequirements.push("Confirm the project is Canadian-owned/controlled.");
  }
  if (req.physicalStorefront && !input.physicalStorefront) {
    missingRequirements.push("Confirm a physical storefront / commercial location.");
  }
  if (req.directToConsumer && !input.directToConsumer) {
    missingRequirements.push("Confirm a direct-to-consumer model.");
  }
  if (req.forProfit && input.forProfit === false) {
    disqualifiers.push("Program requires a for-profit business.");
  }

  return { missingRequirements, disqualifiers };
}

/**
 * Survey-grade confidence. Hard requirements gate the ceiling: a program never
 * reaches "high" with missing requirements, and never "high"/"medium" if closed
 * or disqualified.
 */
export function surveyConfidence({ program, baseConfidence, missingRequirements, disqualifiers }) {
  if (disqualifiers.length) return "not_a_fit";
  if (!OPEN_STATUSES.has(program.status)) return "not_a_fit";
  if (missingRequirements.length >= 2) return "exploratory";
  if (baseConfidence === "high") return missingRequirements.length ? "medium" : "high";
  if (baseConfidence === "medium") return missingRequirements.length ? "exploratory" : "medium";
  return missingRequirements.length ? "not_enough_information" : "exploratory";
}

export function scoreSurvey(normalizedInput = {}) {
  const fundingScore = scoreFundingFit(normalizedInput);
  const rawMatches = matchFundingProgramsForInput(normalizedInput, { fundingScore, limit: 6 });

  const programMatches = rawMatches.map((match) => {
    const { missingRequirements, disqualifiers } = checkRequirements(match.program, normalizedInput);
    const confidence = surveyConfidence({
      program: match.program,
      baseConfidence: match.confidence,
      missingRequirements,
      disqualifiers
    });
    return {
      programId: match.program.id,
      name: match.program.name,
      provider: match.program.provider,
      sourceUrl: match.program.sourceUrl,
      score: match.matchScore,
      confidence,
      reasons: match.matchedSignals,
      missingRequirements: [...new Set([...missingRequirements, ...match.reviewGaps])],
      disqualifiers: [...new Set([...disqualifiers, ...(match.disqualifiers || [])])],
      recommendedNextStep: match.recommendedNextStep || match.outreachAngle?.recommendedNextStep || "",
      serviceAngle: match.outreachAngle?.serviceAngle || "",
      estimatedRange: estimateFundingRange(match.program, normalizedInput),
      status: match.program.status,
      lastVerified: match.program.lastVerified || match.program.lastVerifiedOn || ""
    };
  });

  return { fundingScore, programMatches };
}
