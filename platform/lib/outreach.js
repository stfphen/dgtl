import { isFundingScanLead, scoreFundingLead } from "./funding/admin.js";

export function buildDraftEmail({ tenant, lead, packageId }) {
  if (isFundingScanLead(lead)) {
    return buildFundingFollowUpDraft({ lead });
  }

  const selectedPackage =
    tenant.packages.find((pkg) => pkg.id === packageId) ||
    tenant.packages.find((pkg) => pkg.id === tenant.defaultPackageId) ||
    tenant.packages[0];

  const businessName = lead.businessName || lead.business || "your business";
  const contactName = lead.contactName || lead.name || "there";
  const category = lead.category ? ` in ${lead.category}` : "";
  const city = lead.city ? ` around ${lead.city}` : "";
  const painPoints = lead.painPoints
    ? `\n\nThe main angle I would solve for first: ${lead.painPoints}`
    : "";
  const offerName =
    lead.recommendedOffer ||
    selectedPackage.name;

  return {
    subject: `Content idea for ${businessName}`,
    body: `Hey ${contactName},

I came across ${businessName}${category}${city} and thought there may be a strong opportunity to turn one focused shoot day into a month of useful short-form content.

The package I would start with is ${offerName}: ${selectedPackage.description}${painPoints}

For ${businessName}, I would likely build content around:
1. A simple explanation of what makes the offer different
2. Trust-building proof and behind-the-scenes clips
3. Short service or product highlights that can run on Instagram, TikTok, YouTube, and ads

Would it be worth sending over a quick content day concept?`
  };
}

export function buildFundingFollowUpDraft({ lead }) {
  const businessName = lead.businessName || lead.business || "your business";
  const contactName = lead.contactName || lead.name || "there";
  const fundingScore = scoreFundingLead(lead);

  return {
    subject: `Funding fit next step for ${businessName}`,
    body: `Hey ${contactName},

Thanks for starting the Funding Fit Scan for ${businessName}. Based on the intake, the strongest potential fit appears to be ${fundingScore.bestFundingLaneLabel}.

The next step I would recommend is preparing a Fundable Project Blueprint. That would turn the growth goal into a clear project scope, budget, milestones, and application-ready narrative before any program-specific submission work begins.

This is not a guarantee of funding approval. Program eligibility, timing, documentation, and final approval are determined by the funder or program administrator.

Would it be worth booking a short call to review the scan and decide whether a blueprint is the right next step?`
  };
}
