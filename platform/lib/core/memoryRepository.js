function sort(records, field = "updatedAt") {
  return [...records].sort((left, right) => String(right[field] || "").localeCompare(String(left[field] || "")));
}

export class MemoryCoreRepository {
  constructor(seed = {}) {
    this.companies = [...(seed.companies || [])];
    this.contacts = [...(seed.contacts || [])];
    this.opportunities = [...(seed.opportunities || [])];
    this.research = [...(seed.research || [])];
    this.campaigns = [...(seed.campaigns || [])];
    this.messages = [...(seed.messages || [])];
    this.activities = [...(seed.activities || [])];
    this.assets = [...(seed.assets || [])];
    this.externalLinks = [...(seed.externalLinks || [])];
    this.generationJobs = [...(seed.generationJobs || [])];
  }

  scoped(records, teamId) {
    return records.filter((record) => record.teamId === teamId);
  }

  async listCompanies(teamId) {
    return sort(this.scoped(this.companies, teamId).map((company) => ({
      ...company,
      contactCount: this.contacts.filter((contact) => contact.teamId === teamId && contact.companyId === company.id).length,
      opportunityCount: this.opportunities.filter((opportunity) => opportunity.teamId === teamId && opportunity.companyId === company.id).length
    })));
  }

  async getCompany(id, teamId) { return this.companies.find((record) => record.id === id && record.teamId === teamId) || null; }
  async listContacts(teamId) {
    return sort(this.scoped(this.contacts, teamId).map((contact) => ({
      ...contact,
      companyName: this.companies.find((company) => company.id === contact.companyId && company.teamId === teamId)?.displayName || ""
    })));
  }
  async getContact(id, teamId) { return (await this.listContacts(teamId)).find((record) => record.id === id) || null; }
  async listOpportunities(teamId) {
    return sort(this.scoped(this.opportunities, teamId).map((opportunity) => ({
      ...opportunity,
      companyName: this.companies.find((company) => company.id === opportunity.companyId && company.teamId === teamId)?.displayName || "",
      primaryContactName: this.contacts.find((contact) => contact.id === opportunity.primaryContactId && contact.teamId === teamId)?.fullName || ""
    })));
  }
  async getOpportunity(id, teamId) { return (await this.listOpportunities(teamId)).find((record) => record.id === id) || null; }

  async getCompanyGraph(id, teamId) {
    const company = await this.getCompany(id, teamId);
    if (!company) return null;
    const opportunities = this.opportunities.filter((record) => record.teamId === teamId && record.companyId === id);
    const opportunityIds = new Set(opportunities.map((record) => record.id));
    return {
      company,
      contacts: this.contacts.filter((record) => record.teamId === teamId && record.companyId === id),
      opportunities,
      research: this.research.filter((record) => record.teamId === teamId && (record.companyId === id || opportunityIds.has(record.opportunityId))),
      assets: this.assets.filter((record) => record.teamId === teamId && (record.companyId === id || opportunityIds.has(record.opportunityId))),
      activities: sort(this.activities.filter((record) => record.teamId === teamId && (record.companyId === id || opportunityIds.has(record.opportunityId))), "occurredAt"),
      externalLinks: this.externalLinks.filter((record) => record.teamId === teamId &&
        ((record.localEntityType === "company" && record.localEntityId === id) ||
         (record.localEntityType === "opportunity" && opportunityIds.has(record.localEntityId))))
    };
  }

  async getContactGraph(id, teamId) {
    const contact = await this.getContact(id, teamId);
    if (!contact) return null;
    return {
      contact,
      company: contact.companyId ? await this.getCompany(contact.companyId, teamId) : null,
      opportunities: this.opportunities.filter((record) => record.teamId === teamId &&
        (record.primaryContactId === id || record.contactIds?.includes(id))),
      activities: sort(this.activities.filter((record) => record.teamId === teamId && record.contactId === id), "occurredAt"),
      externalLinks: this.externalLinks.filter((record) => record.teamId === teamId && record.localEntityType === "contact" && record.localEntityId === id)
    };
  }

  async getOpportunityGraph(id, teamId) {
    const opportunity = await this.getOpportunity(id, teamId);
    if (!opportunity) return null;
    const contactIds = new Set([opportunity.primaryContactId, ...(opportunity.contactIds || [])].filter(Boolean));
    return {
      opportunity,
      company: await this.getCompany(opportunity.companyId, teamId),
      contacts: this.contacts.filter((record) => record.teamId === teamId && contactIds.has(record.id)),
      research: this.research.filter((record) => record.teamId === teamId && record.opportunityId === id),
      assets: this.assets.filter((record) => record.teamId === teamId && record.opportunityId === id),
      campaigns: this.campaigns.filter((record) => record.teamId === teamId && record.opportunityId === id),
      messages: this.messages.filter((record) => record.teamId === teamId && record.opportunityId === id),
      activities: sort(this.activities.filter((record) => record.teamId === teamId && record.opportunityId === id), "occurredAt"),
      externalLinks: this.externalLinks.filter((record) => record.teamId === teamId && record.localEntityType === "opportunity" && record.localEntityId === id),
      generationJobs: this.generationJobs.filter((record) => record.teamId === teamId && record.opportunityId === id)
    };
  }

  async createCompany(record) { this.companies.push(record); return record; }
  async createContact(record) { this.contacts.push(record); return record; }
  async createOpportunity(record) { this.opportunities.push(record); return record; }
  async createResearch(record) { this.research.push(record); return record; }
  async createExternalLink(record) { this.externalLinks.push(record); return record; }
  async createGenerationJob(record) { this.generationJobs.push(record); return record; }
  async createAsset(record) { this.assets.push(record); return record; }
  async createActivity(record) { this.activities.push(record); return record; }
}
