import { legacyCoreId, stableFingerprint } from "./ids.js";
import { normalizeDomain, normalizeEmail } from "./duplicateRules.js";

function timestamp(value) {
  return value?.toISOString?.() || value || "";
}

function splitName(value) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function accountCompanyId(accountId) {
  return legacyCoreId("company", "target", accountId);
}

function leadCompanyId(leadId) {
  return legacyCoreId("company", "lead", leadId);
}

function leadContactId(leadId) {
  return legacyCoreId("contact", "lead", leadId);
}

function leadOpportunityId(leadId) {
  return legacyCoreId("opportunity", "lead", leadId);
}

export function mapTargetAccountToCompany(account = {}) {
  return {
    id: accountCompanyId(account.id),
    teamId: account.teamId,
    tenantId: account.tenantId || "",
    legalName: "",
    displayName: account.name || "Unnamed account",
    normalizedDomain: normalizeDomain(account.domain),
    websiteUrl: account.domain ? (/^https?:\/\//i.test(account.domain) ? account.domain : `https://${account.domain}`) : "",
    industry: account.firmographics?.industry || "",
    category: account.segment || "",
    city: account.firmographics?.hqGeo || "",
    region: "",
    country: "",
    source: account.sourceType || "legacy_target_account",
    ownerUserId: "",
    relationshipStatus: account.gateStatus === "deprioritized" ? "inactive" : "prospect",
    researchSummary: account.fitRationale || "",
    legacySourceType: "target_account",
    legacySourceId: account.id,
    metadata: {
      tier: account.tier ?? null,
      fitScore: account.fitScore ?? null,
      gateStatus: account.gateStatus || "",
      dataGaps: account.dataGaps || []
    },
    createdAt: timestamp(account.createdAt),
    updatedAt: timestamp(account.updatedAt)
  };
}

export function mapLeadToCompany(lead = {}) {
  const stage = lead.pipelineStatus || lead.status || "new";
  return {
    id: leadCompanyId(lead.id),
    teamId: lead.teamId,
    tenantId: lead.tenantId || "",
    legalName: "",
    displayName: lead.businessName || lead.business || lead.contactName || lead.name || lead.domain || lead.email || "Imported lead",
    normalizedDomain: normalizeDomain(lead.domain || lead.website || lead.websiteUrl),
    websiteUrl: lead.website || lead.websiteUrl || "",
    industry: lead.category || "",
    category: lead.category || "",
    addressLine: lead.address || "",
    city: lead.city || "",
    region: lead.region || "",
    country: lead.country || "",
    source: lead.sourceType || lead.source || "legacy_lead",
    ownerUserId: lead.assignedToUserId || "",
    relationshipStatus: ["won", "booked"].includes(stage) ? "customer" : (["lost", "do_not_contact"].includes(stage) ? "inactive" : "prospect"),
    researchSummary: lead.notes || "",
    legacySourceType: "lead",
    legacySourceId: lead.id,
    metadata: { leadScore: lead.leadScore || 0, sourceMetadata: lead.metadata || {} },
    createdAt: timestamp(lead.createdAt),
    updatedAt: timestamp(lead.updatedAt)
  };
}

export function mapLeadToContact(lead = {}) {
  const fullName = lead.contactName || lead.name || "";
  const names = splitName(fullName);
  return {
    id: leadContactId(lead.id),
    teamId: lead.teamId,
    tenantId: lead.tenantId || "",
    companyId: leadCompanyId(lead.id),
    ...names,
    fullName,
    title: lead.contactTitle || "",
    role: lead.metadata?.roleLabel || "",
    email: lead.email || "",
    normalizedEmail: normalizeEmail(lead.email),
    phone: lead.phone || "",
    linkedinUrl: lead.metadata?.linkedinUrl || "",
    socialUrls: lead.metadata?.socialProfiles || {},
    source: lead.sourceType || lead.source || "legacy_lead",
    deliverabilityState: lead.metadata?.emailStatus || "unknown",
    consentState: lead.doNotContact ? "withdrawn" : (lead.consentSource ? "recorded" : "unknown"),
    suppressionState: lead.doNotContact ? "suppressed" : "active",
    ownerUserId: lead.assignedToUserId || "",
    legacySourceType: "lead",
    legacySourceId: lead.id,
    metadata: { preferredContactMethod: lead.preferredContactMethod || "", doNotCall: Boolean(lead.doNotCall) },
    createdAt: timestamp(lead.createdAt),
    updatedAt: timestamp(lead.updatedAt)
  };
}

export function mapCommitteeContact(account = {}, contact = {}, index = 0) {
  const identity = contact.email || contact.profileUrl || [contact.name, contact.title].filter(Boolean).join("|") || `row:${index}`;
  const legacyId = `${account.id}_${stableFingerprint(identity)}`;
  const fullName = contact.name || "";
  return {
    id: legacyCoreId("contact", "buying_committee", legacyId),
    teamId: account.teamId,
    tenantId: account.tenantId || "",
    companyId: accountCompanyId(account.id),
    ...splitName(fullName),
    fullName,
    title: contact.title || "",
    role: contact.roleLabel || "",
    email: contact.email || "",
    normalizedEmail: normalizeEmail(contact.email),
    phone: contact.phone || "",
    linkedinUrl: contact.profileUrl || "",
    socialUrls: {},
    source: contact.source || "legacy_buying_committee",
    deliverabilityState: contact.emailStatus || "unknown",
    consentState: "unknown",
    suppressionState: "active",
    ownerUserId: "",
    legacySourceType: "buying_committee",
    legacySourceId: legacyId,
    metadata: { confidence: contact.confidence || "", isPrimary: Boolean(contact.isPrimary) },
    createdAt: timestamp(account.createdAt),
    updatedAt: timestamp(account.updatedAt)
  };
}

export function mapLeadToOpportunity(lead = {}) {
  const stage = lead.pipelineStatus || lead.status || "new";
  return {
    id: leadOpportunityId(lead.id),
    teamId: lead.teamId,
    tenantId: lead.tenantId || "",
    companyId: leadCompanyId(lead.id),
    primaryContactId: leadContactId(lead.id),
    contactIds: [leadContactId(lead.id)],
    name: lead.businessName || lead.business || lead.contactName || lead.name || "Lead opportunity",
    stage,
    estimatedValue: null,
    currency: "CAD",
    ownerUserId: lead.assignedToUserId || "",
    qualification: { score: lead.leadScore || 0, reason: lead.leadScoreReason || "" },
    approachAngle: lead.painPoints || "",
    offer: lead.recommendedOffer || "",
    entryOffer: "",
    nextAction: lead.metadata?.nextAction || "",
    nextActionAt: timestamp(lead.nextFollowUpAt),
    source: lead.sourceType || lead.source || "legacy_lead",
    status: ["won", "lost", "do_not_contact"].includes(stage) ? "closed" : "open",
    legacySourceType: "lead",
    legacySourceId: lead.id,
    metadata: {
      outreachStatus: lead.outreachStatus || "",
      enrichmentStatus: lead.enrichmentStatus || "",
      replyStatus: lead.replyStatus || "",
      campaignId: lead.campaignId || ""
    },
    createdAt: timestamp(lead.createdAt),
    updatedAt: timestamp(lead.updatedAt)
  };
}

export function mapAccountCampaignToOpportunity(campaign = {}, account = {}) {
  const committee = (account.buyingCommittee || []).map((contact, index) => mapCommitteeContact(account, contact, index));
  const primary = committee.find((contact) => contact.metadata.isPrimary) || committee[0] || null;
  return {
    id: legacyCoreId("opportunity", "account_campaign", campaign.id),
    teamId: campaign.teamId || account.teamId,
    tenantId: account.tenantId || "",
    companyId: accountCompanyId(campaign.accountId || account.id),
    primaryContactId: primary?.id || "",
    contactIds: committee.map((contact) => contact.id),
    name: campaign.name || "Account opportunity",
    stage: campaign.status || "draft",
    estimatedValue: null,
    currency: "CAD",
    ownerUserId: "",
    qualification: {
      budgetBand: campaign.budgetBand || "",
      budgetRationale: campaign.budgetRationale || "",
      successMetric: campaign.successMetric || ""
    },
    approachAngle: campaign.bigIdea || "",
    offer: Array.isArray(campaign.deliverables) ? campaign.deliverables.join(", ") : "",
    entryOffer: "",
    nextAction: campaign.outreachOpener || "",
    nextActionAt: "",
    source: "legacy_account_campaign",
    status: ["closed", "won", "lost"].includes(campaign.status) ? "closed" : "open",
    legacySourceType: "account_campaign",
    legacySourceId: campaign.id,
    metadata: { approvedBy: campaign.approvedBy || "", approvedAt: timestamp(campaign.approvedAt) },
    createdAt: timestamp(campaign.createdAt),
    updatedAt: timestamp(campaign.updatedAt)
  };
}

export function mapLeadToResearch(lead = {}) {
  if (!lead.notes && !lead.metadata?.enrichment) return null;
  return {
    id: legacyCoreId("research", "lead", lead.id),
    teamId: lead.teamId,
    tenantId: lead.tenantId || "",
    companyId: leadCompanyId(lead.id),
    opportunityId: leadOpportunityId(lead.id),
    sourceUrl: lead.sourceUrl || "",
    sourceType: lead.sourceType || lead.source || "legacy_lead",
    content: lead.notes || "Legacy lead enrichment",
    signalCategory: "",
    structuredData: lead.metadata?.enrichment || {},
    capturedAt: timestamp(lead.updatedAt || lead.createdAt),
    authorType: "legacy_import",
    authorId: "",
    confidence: "",
    verificationStatus: "unverified",
    legacySourceType: "lead",
    legacySourceId: lead.id,
    createdAt: timestamp(lead.createdAt),
    updatedAt: timestamp(lead.updatedAt)
  };
}

export function mapTargetAccountToResearch(account = {}) {
  const hasResearch = account.fitRationale || Object.keys(account.dossier || {}).length || (account.signals || []).length;
  if (!hasResearch) return null;
  return {
    id: legacyCoreId("research", "target", account.id),
    teamId: account.teamId,
    tenantId: account.tenantId || "",
    companyId: accountCompanyId(account.id),
    opportunityId: "",
    sourceUrl: "",
    sourceType: "legacy_target_account",
    content: account.fitRationale || "Legacy target-account dossier",
    signalCategory: "account_research",
    structuredData: { dossier: account.dossier || {}, signals: account.signals || [], firmographics: account.firmographics || {} },
    capturedAt: timestamp(account.updatedAt || account.createdAt),
    authorType: "legacy_import",
    authorId: "",
    confidence: "",
    verificationStatus: "unverified",
    legacySourceType: "target_account",
    legacySourceId: account.id,
    createdAt: timestamp(account.createdAt),
    updatedAt: timestamp(account.updatedAt)
  };
}

export function mapOutreachCampaign(campaign = {}, teamId = "") {
  return {
    id: legacyCoreId("campaign", "outreach", campaign.id),
    teamId,
    tenantId: campaign.tenantId || "",
    opportunityId: "",
    name: campaign.name || "Outreach campaign",
    kind: "outreach",
    status: campaign.status || "draft",
    ownerUserId: "",
    source: "legacy_outreach",
    legacySourceType: "outreach_campaign",
    legacySourceId: campaign.id,
    metadata: { description: campaign.description || "", dailySendCap: campaign.dailySendCap || 0 },
    createdAt: timestamp(campaign.createdAt),
    updatedAt: timestamp(campaign.updatedAt)
  };
}

export function mapQueueItemToMessage(item = {}, lead = {}) {
  return {
    id: legacyCoreId("message", "outreach_queue", item.id),
    teamId: lead.teamId,
    tenantId: item.tenantId || lead.tenantId || "",
    opportunityId: lead.id ? leadOpportunityId(lead.id) : "",
    campaignId: item.campaignId ? legacyCoreId("campaign", "outreach", item.campaignId) : "",
    contactId: lead.id ? leadContactId(lead.id) : "",
    channel: "email",
    direction: "outbound",
    subject: item.subject || "",
    body: item.body || "",
    status: item.status || "draft",
    provider: "resend",
    externalMessageId: item.resendMessageId || "",
    scheduledAt: timestamp(item.scheduledFor),
    sentAt: timestamp(item.sentAt),
    legacySourceType: "outreach_queue",
    legacySourceId: item.id,
    metadata: { recipientEmail: item.recipientEmail || "", failureReason: item.failureReason || "", step: item.step || 0 },
    createdAt: timestamp(item.createdAt),
    updatedAt: timestamp(item.updatedAt)
  };
}

export function mapDraftEmailToMessage(draft = {}, lead = {}) {
  return {
    id: legacyCoreId("message", "draft_email", draft.id),
    teamId: draft.teamId || draft.team_id || lead.teamId,
    tenantId: draft.tenantId || draft.tenant_id || lead.tenantId || "",
    opportunityId: lead.id ? leadOpportunityId(lead.id) : "",
    campaignId: lead.campaignId ? legacyCoreId("campaign", "outreach", lead.campaignId) : "",
    contactId: lead.id ? leadContactId(lead.id) : "",
    channel: "email",
    direction: "outbound",
    subject: draft.subject || "",
    body: draft.body || "",
    status: draft.status || "draft",
    provider: "",
    externalMessageId: "",
    scheduledAt: "",
    sentAt: "",
    legacySourceType: "draft_email",
    legacySourceId: draft.id,
    metadata: {},
    createdAt: timestamp(draft.createdAt || draft.created_at),
    updatedAt: timestamp(draft.updatedAt || draft.updated_at || draft.createdAt || draft.created_at)
  };
}

export function mapOutreachEventToActivity(event = {}, lead = {}) {
  return {
    id: legacyCoreId("activity", "outreach_event", event.id),
    teamId: lead.teamId,
    tenantId: lead.tenantId || "",
    companyId: lead.id ? leadCompanyId(lead.id) : "",
    contactId: lead.id ? leadContactId(lead.id) : "",
    opportunityId: lead.id ? leadOpportunityId(lead.id) : "",
    campaignId: event.campaignId ? legacyCoreId("campaign", "outreach", event.campaignId) : "",
    messageId: event.queueId ? legacyCoreId("message", "outreach_queue", event.queueId) : "",
    activityType: event.type || "outreach_event",
    occurredAt: timestamp(event.createdAt),
    actorType: "system",
    actorId: "",
    summary: `Outreach ${String(event.type || "event").replaceAll("_", " ")}`,
    metadata: event.metadata || {},
    legacySourceType: "outreach_event",
    legacySourceId: event.id,
    createdAt: timestamp(event.createdAt),
    updatedAt: timestamp(event.createdAt)
  };
}

export function mapCallToActivity(call = {}, lead = {}) {
  return {
    id: legacyCoreId("activity", "call", call.id),
    teamId: call.teamId || lead.teamId,
    tenantId: call.tenantId || lead.tenantId || "",
    companyId: lead.id ? leadCompanyId(lead.id) : "",
    contactId: lead.id ? leadContactId(lead.id) : "",
    opportunityId: lead.id ? leadOpportunityId(lead.id) : "",
    campaignId: call.campaignId ? legacyCoreId("campaign", "outreach", call.campaignId) : "",
    messageId: call.outreachMessageId ? legacyCoreId("message", "outreach_queue", call.outreachMessageId) : "",
    activityType: "call",
    occurredAt: timestamp(call.startedAt || call.createdAt),
    actorType: "user",
    actorId: call.assignedUserId || "",
    summary: `${call.direction || "outbound"} call · ${call.outcome || call.status || "unknown"}`,
    metadata: { provider: call.provider || "", durationSeconds: call.durationSeconds, status: call.status || "" },
    legacySourceType: "call",
    legacySourceId: call.id,
    createdAt: timestamp(call.createdAt),
    updatedAt: timestamp(call.updatedAt || call.createdAt)
  };
}

export const legacyIds = Object.freeze({
  accountCompanyId,
  leadCompanyId,
  leadContactId,
  leadOpportunityId
});
