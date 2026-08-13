import { createCoreId } from "./ids.js";
import { normalizeDomain, normalizeEmail } from "./duplicateRules.js";
import { getCoreRepository } from "./repository.js";

const EXTERNAL_ENTITY_TYPES = new Set(["company", "contact", "opportunity"]);
const ASSET_KINDS = new Set(["pitch", "teaser", "audit", "report", "proposal", "other"]);

function required(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function iso(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp: ${value}`);
  return date.toISOString();
}

export class CoreService {
  constructor({ teamId, repository = getCoreRepository(), idFactory = createCoreId, now = () => new Date().toISOString() } = {}) {
    this.teamId = required(teamId, "teamId");
    this.repository = repository;
    this.idFactory = idFactory;
    this.now = now;
  }

  listCompanies() { return this.repository.listCompanies(this.teamId); }
  listContacts() { return this.repository.listContacts(this.teamId); }
  listOpportunities() { return this.repository.listOpportunities(this.teamId); }
  getCompany(id) { return this.repository.getCompany(required(id, "companyId"), this.teamId); }
  getContact(id) { return this.repository.getContact(required(id, "contactId"), this.teamId); }
  getOpportunity(id) { return this.repository.getOpportunity(required(id, "opportunityId"), this.teamId); }
  getCompanyGraph(id) { return this.repository.getCompanyGraph(required(id, "companyId"), this.teamId); }
  getContactGraph(id) { return this.repository.getContactGraph(required(id, "contactId"), this.teamId); }
  getOpportunityGraph(id) { return this.repository.getOpportunityGraph(required(id, "opportunityId"), this.teamId); }

  async createCompany(input = {}) {
    const at = this.now();
    return this.repository.createCompany({
      id: input.id || this.idFactory("company"),
      teamId: this.teamId,
      tenantId: input.tenantId || "",
      legalName: input.legalName || "",
      displayName: required(input.displayName || input.legalName, "displayName"),
      normalizedDomain: normalizeDomain(input.normalizedDomain || input.websiteUrl || input.website),
      websiteUrl: input.websiteUrl || input.website || "",
      industry: input.industry || "",
      category: input.category || "",
      city: input.city || "",
      region: input.region || "",
      country: input.country || "",
      source: input.source || "manual",
      ownerUserId: input.ownerUserId || "",
      relationshipStatus: input.relationshipStatus || "prospect",
      researchSummary: input.researchSummary || "",
      importBatchId: input.importBatchId || "",
      metadata: input.metadata || {},
      createdAt: iso(input.createdAt, at),
      updatedAt: at
    });
  }

  async createContact(input = {}) {
    const company = input.companyId ? await this.getCompany(input.companyId) : null;
    if (input.companyId && !company) throw new Error("Company is not available to this team.");
    const at = this.now();
    const fullName = String(input.fullName || `${input.firstName || ""} ${input.lastName || ""}`).trim();
    return this.repository.createContact({
      id: input.id || this.idFactory("contact"),
      teamId: this.teamId,
      tenantId: input.tenantId || company?.tenantId || "",
      companyId: input.companyId || "",
      firstName: input.firstName || "",
      lastName: input.lastName || "",
      fullName,
      title: input.title || "",
      role: input.role || "",
      email: input.email || "",
      normalizedEmail: normalizeEmail(input.email),
      phone: input.phone || "",
      linkedinUrl: input.linkedinUrl || "",
      socialUrls: input.socialUrls || {},
      source: input.source || "manual",
      deliverabilityState: input.deliverabilityState || "unknown",
      consentState: input.consentState || "unknown",
      suppressionState: input.suppressionState || "active",
      ownerUserId: input.ownerUserId || "",
      importBatchId: input.importBatchId || "",
      metadata: input.metadata || {},
      createdAt: iso(input.createdAt, at),
      updatedAt: at
    });
  }

  async createOpportunity(input = {}) {
    const company = await this.getCompany(input.companyId);
    if (!company) throw new Error("Company is not available to this team.");
    const contactIds = [...new Set([input.primaryContactId, ...(input.contactIds || [])].filter(Boolean))];
    for (const contactId of contactIds) {
      const contact = await this.getContact(contactId);
      if (!contact) throw new Error("Contact is not available to this team.");
      if (contact.companyId && contact.companyId !== company.id) {
        throw new Error("Opportunity contacts must belong to the opportunity company.");
      }
    }
    const at = this.now();
    return this.repository.createOpportunity({
      id: input.id || this.idFactory("opportunity"),
      teamId: this.teamId,
      tenantId: input.tenantId || company.tenantId || "",
      companyId: company.id,
      primaryContactId: input.primaryContactId || "",
      contactIds,
      name: required(input.name, "name"),
      stage: input.stage || "new",
      estimatedValue: input.estimatedValue === undefined || input.estimatedValue === null ? null : Number(input.estimatedValue),
      currency: input.currency || "CAD",
      ownerUserId: input.ownerUserId || "",
      qualification: input.qualification || {},
      approachAngle: input.approachAngle || "",
      offer: input.offer || "",
      entryOffer: input.entryOffer || "",
      nextAction: input.nextAction || "",
      nextActionAt: input.nextActionAt ? iso(input.nextActionAt) : "",
      source: input.source || "manual",
      status: input.status || "open",
      importBatchId: input.importBatchId || "",
      metadata: input.metadata || {},
      createdAt: iso(input.createdAt, at),
      updatedAt: at
    });
  }

  async createResearch(input = {}) {
    const { company, opportunity } = await this.resolveCommercialContext(input);
    const at = this.now();
    return this.repository.createResearch({
      id: input.id || this.idFactory("research"),
      teamId: this.teamId,
      tenantId: input.tenantId || opportunity?.tenantId || company?.tenantId || "",
      companyId: company?.id || opportunity?.companyId || "",
      opportunityId: opportunity?.id || "",
      sourceUrl: input.sourceUrl || "",
      sourceType: required(input.sourceType, "sourceType"),
      content: required(input.content, "content"),
      signalCategory: input.signalCategory || "",
      structuredData: input.structuredData || {},
      capturedAt: iso(input.capturedAt, at),
      authorType: input.authorType || "user",
      authorId: input.authorId || "",
      confidence: input.confidence || "",
      verificationStatus: input.verificationStatus || "unverified",
      importBatchId: input.importBatchId || "",
      createdAt: at,
      updatedAt: at
    });
  }

  async createExternalLink(input = {}) {
    const localEntityType = required(input.localEntityType, "localEntityType");
    if (!EXTERNAL_ENTITY_TYPES.has(localEntityType)) throw new Error(`Unsupported local entity type: ${localEntityType}`);
    await this.assertLocalEntity(localEntityType, input.localEntityId);
    const at = this.now();
    return this.repository.createExternalLink({
      id: input.id || this.idFactory("externalLink"),
      teamId: this.teamId,
      tenantId: input.tenantId || "",
      localEntityType,
      localEntityId: required(input.localEntityId, "localEntityId"),
      externalSystem: required(input.externalSystem, "externalSystem"),
      externalObjectType: required(input.externalObjectType, "externalObjectType"),
      externalId: required(input.externalId, "externalId"),
      externalUrl: input.externalUrl || "",
      syncCursor: input.syncCursor || "",
      syncState: input.syncState || "linked",
      metadata: input.metadata || {},
      createdAt: at,
      updatedAt: at
    });
  }

  async createGenerationJob(input = {}) {
    const { company, opportunity } = await this.resolveCommercialContext(input);
    const at = this.now();
    return this.repository.createGenerationJob({
      id: input.id || this.idFactory("generationJob"),
      teamId: this.teamId,
      tenantId: input.tenantId || opportunity?.tenantId || company?.tenantId || "",
      companyId: company?.id || opportunity?.companyId || "",
      opportunityId: opportunity?.id || "",
      requestedTool: required(input.requestedTool, "requestedTool"),
      requestedSkill: input.requestedSkill || "",
      brief: input.brief || {},
      status: input.status || "queued",
      createdBy: input.createdBy || "",
      metadata: input.metadata || {},
      createdAt: at,
      updatedAt: at
    });
  }

  async createAsset(input = {}) {
    const { company, opportunity } = await this.resolveCommercialContext(input);
    const kind = required(input.kind, "kind");
    if (!ASSET_KINDS.has(kind)) throw new Error(`Unsupported asset kind: ${kind}`);
    const at = this.now();
    return this.repository.createAsset({
      id: input.id || this.idFactory("asset"),
      teamId: this.teamId,
      tenantId: input.tenantId || opportunity?.tenantId || company?.tenantId || "",
      companyId: company?.id || opportunity?.companyId || "",
      opportunityId: opportunity?.id || "",
      generationJobId: input.generationJobId || "",
      kind,
      slug: input.slug || "",
      sourcePath: input.sourcePath || "",
      buildCommit: input.buildCommit || "",
      deploymentTarget: input.deploymentTarget || "",
      deploymentUrl: input.deploymentUrl || "",
      version: String(input.version || "1"),
      status: input.status || "draft",
      approvedAt: input.approvedAt ? iso(input.approvedAt) : "",
      metadata: input.metadata || {},
      createdAt: at,
      updatedAt: at
    });
  }

  async createActivity(input = {}) {
    const { company, opportunity } = await this.resolveCommercialContext(input, { allowEmpty: true });
    const at = this.now();
    return this.repository.createActivity({
      id: input.id || this.idFactory("activity"),
      teamId: this.teamId,
      tenantId: input.tenantId || opportunity?.tenantId || company?.tenantId || "",
      companyId: company?.id || opportunity?.companyId || "",
      contactId: input.contactId || "",
      opportunityId: opportunity?.id || "",
      campaignId: input.campaignId || "",
      messageId: input.messageId || "",
      activityType: required(input.activityType, "activityType"),
      occurredAt: iso(input.occurredAt, at),
      actorType: input.actorType || "system",
      actorId: input.actorId || "",
      summary: input.summary || "",
      metadata: input.metadata || {},
      createdAt: at,
      updatedAt: at
    });
  }

  async resolveCommercialContext(input, { allowEmpty = false } = {}) {
    const opportunity = input.opportunityId ? await this.getOpportunity(input.opportunityId) : null;
    if (input.opportunityId && !opportunity) throw new Error("Opportunity is not available to this team.");
    const companyId = input.companyId || opportunity?.companyId;
    const company = companyId ? await this.getCompany(companyId) : null;
    if (companyId && !company) throw new Error("Company is not available to this team.");
    if (!allowEmpty && !company && !opportunity) throw new Error("companyId or opportunityId is required.");
    return { company, opportunity };
  }

  async assertLocalEntity(type, id) {
    const entityId = required(id, "localEntityId");
    if (type === "company" && !(await this.getCompany(entityId))) throw new Error("Company is not available to this team.");
    if (type === "contact" && !(await this.getContact(entityId))) throw new Error("Contact is not available to this team.");
    if (type === "opportunity" && !(await this.getOpportunity(entityId))) throw new Error("Opportunity is not available to this team.");
  }
}

export function getCoreService(teamId) {
  return new CoreService({ teamId });
}
