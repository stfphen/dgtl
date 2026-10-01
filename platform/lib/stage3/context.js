function clean(value) { return value === undefined || value === null ? "" : value; }

export function buildGenerationContext(graph, { selectedResearchIds = [], campaign = null } = {}) {
  if (!graph?.opportunity || !graph?.company) throw Object.assign(new Error("Opportunity context is unavailable."), { status: 404 });
  const selected = new Set(selectedResearchIds.filter(Boolean));
  const research = (graph.research || []).filter((item) => !selected.size || selected.has(item.id)).map((item) => ({
    id: item.id,
    content: item.content,
    sourceUrl: clean(item.sourceUrl),
    sourceType: clean(item.sourceType),
    signalCategory: clean(item.signalCategory),
    capturedAt: clean(item.capturedAt),
    authorType: clean(item.authorType),
    authorId: clean(item.authorId),
    confidence: clean(item.confidence),
    verificationStatus: clean(item.verificationStatus),
    provenanceClass: item.verificationStatus === "verified" ? "verified_research" : item.authorType === "agent" ? "ai_generated_inference" : item.sourceType === "import" ? "imported_unverified_note" : "unverified_research"
  }));
  const opportunity = graph.opportunity;
  const company = graph.company;
  return structuredClone({
    schemaVersion: 1,
    company: { id: company.id, displayName: company.displayName, legalName: clean(company.legalName), websiteUrl: clean(company.websiteUrl), normalizedDomain: clean(company.normalizedDomain), industry: clean(company.industry), category: clean(company.category), location: [company.city, company.region, company.country].filter(Boolean).join(", "), researchSummary: clean(company.researchSummary) },
    opportunity: { id: opportunity.id, name: opportunity.name, stage: clean(opportunity.stage), qualification: opportunity.qualification || {}, approachAngle: clean(opportunity.approachAngle), entryOffer: clean(opportunity.entryOffer), offer: clean(opportunity.offer), nextAction: clean(opportunity.nextAction), nextActionAt: clean(opportunity.nextActionAt) },
    contacts: (graph.contacts || []).map((contact) => ({ id: contact.id, fullName: contact.fullName, firstName: clean(contact.firstName), lastName: clean(contact.lastName), title: clean(contact.title), role: clean(contact.role), isPrimary: contact.id === opportunity.primaryContactId })),
    research,
    campaign: campaign ? { id: campaign.id, name: campaign.name, audienceDefinition: campaign.audienceDefinition || {}, personalizationConfig: campaign.personalizationConfig || {} } : null,
    strategyNotice: "Approach angle, offer, CTA, and salesperson instructions are strategy. Only verified research may be presented as fact."
  });
}

export function validateGenerationContext(context, adapter) {
  const missing = [];
  if (!context.company?.displayName) missing.push("company name");
  if (!context.opportunity?.approachAngle) missing.push("approach angle");
  if (!context.opportunity?.offer && !context.opportunity?.entryOffer) missing.push("offer or entry offer");
  if (!context.contacts?.length) missing.push("at least one contact");
  if (adapter.id === "pitch.teaser" && !context.approvedPitchArtifactId) missing.push("approved pitch artifact");
  return missing;
}
