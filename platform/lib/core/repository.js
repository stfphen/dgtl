import { Pool } from "pg";
import {
  getCalls,
  listAccountCampaigns,
  listDraftEmails,
  listLeads,
  listOutreachCampaigns,
  listOutreachEvents,
  listOutreachQueue,
  listTargetAccounts
} from "../store.js";
import {
  mapAccountCampaignToOpportunity,
  mapCallToActivity,
  mapCommitteeContact,
  mapDraftEmailToMessage,
  mapLeadToCompany,
  mapLeadToContact,
  mapLeadToOpportunity,
  mapLeadToResearch,
  mapOutreachCampaign,
  mapOutreachEventToActivity,
  mapQueueItemToMessage,
  mapTargetAccountToCompany,
  mapTargetAccountToResearch
} from "./compatibility.js";

function camelKey(key) {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function mapRow(row) {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [camelKey(key), value?.toISOString?.() || value]));
}

function mergeById(...collections) {
  const merged = new Map();
  for (const collection of collections) {
    for (const record of collection || []) {
      if (record?.id) merged.set(record.id, { ...(merged.get(record.id) || {}), ...record });
    }
  }
  return [...merged.values()];
}

function newestFirst(records, field = "updatedAt") {
  return [...records].sort((left, right) => String(right?.[field] || "").localeCompare(String(left?.[field] || "")));
}

let corePool;
function getCorePool() {
  if (!process.env.DATABASE_URL) return null;
  if (!corePool) corePool = new Pool({ connectionString: process.env.DATABASE_URL });
  return corePool;
}

export class PostgresCoreRepository {
  constructor(db) {
    this.db = db;
  }

  async isReady() {
    const result = await this.db.query("select to_regclass('public.companies') as companies");
    return Boolean(result.rows[0]?.companies);
  }

  async listCompanies(teamId) {
    const result = await this.db.query(
      `select companies.*,
        (select count(*)::int from contacts where contacts.company_id = companies.id) as contact_count,
        (select count(*)::int from opportunities where opportunities.company_id = companies.id) as opportunity_count
       from companies where team_id = $1 order by updated_at desc limit 500`,
      [teamId]
    );
    return result.rows.map(mapRow);
  }

  async getCompany(id, teamId) {
    const result = await this.db.query("select * from companies where id = $1 and team_id = $2 limit 1", [id, teamId]);
    return mapRow(result.rows[0]);
  }

  async listContacts(teamId) {
    const result = await this.db.query(
      `select contacts.*, companies.display_name as company_name
       from contacts left join companies on companies.id = contacts.company_id
       where contacts.team_id = $1 order by contacts.updated_at desc limit 1000`,
      [teamId]
    );
    return result.rows.map(mapRow);
  }

  async getContact(id, teamId) {
    const result = await this.db.query(
      `select contacts.*, companies.display_name as company_name
       from contacts left join companies on companies.id = contacts.company_id
       where contacts.id = $1 and contacts.team_id = $2 limit 1`,
      [id, teamId]
    );
    return mapRow(result.rows[0]);
  }

  async listOpportunities(teamId) {
    const result = await this.db.query(
      `select opportunities.*, companies.display_name as company_name,
        contacts.full_name as primary_contact_name
       from opportunities
       join companies on companies.id = opportunities.company_id
       left join contacts on contacts.id = opportunities.primary_contact_id
       where opportunities.team_id = $1 order by opportunities.updated_at desc limit 1000`,
      [teamId]
    );
    return result.rows.map(mapRow);
  }

  async getOpportunity(id, teamId) {
    const result = await this.db.query(
      `select opportunities.*, companies.display_name as company_name,
        contacts.full_name as primary_contact_name
       from opportunities
       join companies on companies.id = opportunities.company_id
       left join contacts on contacts.id = opportunities.primary_contact_id
       where opportunities.id = $1 and opportunities.team_id = $2 limit 1`,
      [id, teamId]
    );
    return mapRow(result.rows[0]);
  }

  async getCompanyGraph(id, teamId) {
    const company = await this.getCompany(id, teamId);
    if (!company) return null;
    const [contacts, opportunities, research, assets, activities, externalLinks] = await Promise.all([
      this.db.query("select * from contacts where company_id = $1 and team_id = $2 order by updated_at desc", [id, teamId]),
      this.db.query("select * from opportunities where company_id = $1 and team_id = $2 order by updated_at desc", [id, teamId]),
      this.db.query(
        `select * from research_records where team_id = $2 and
         (company_id = $1 or opportunity_id in (select id from opportunities where company_id = $1 and team_id = $2))
         order by captured_at desc`,
        [id, teamId]
      ),
      this.db.query(
        `select * from artifacts where team_id = $2 and
         (company_id = $1 or opportunity_id in (select id from opportunities where company_id = $1 and team_id = $2))
         order by created_at desc`,
        [id, teamId]
      ),
      this.db.query(
        `select * from activities where team_id = $2 and
         (company_id = $1 or opportunity_id in (select id from opportunities where company_id = $1 and team_id = $2))
         order by occurred_at desc limit 100`,
        [id, teamId]
      ),
      this.db.query(
        `select * from external_links where team_id = $2 and
         ((local_entity_type = 'company' and local_entity_id = $1) or
          (local_entity_type = 'opportunity' and local_entity_id in
            (select id from opportunities where company_id = $1 and team_id = $2)))
         order by updated_at desc`,
        [id, teamId]
      )
    ]);
    return {
      company,
      contacts: contacts.rows.map(mapRow),
      opportunities: opportunities.rows.map(mapRow),
      research: research.rows.map(mapRow),
      assets: assets.rows.map(mapRow),
      activities: activities.rows.map(mapRow),
      externalLinks: externalLinks.rows.map(mapRow)
    };
  }

  async getContactGraph(id, teamId) {
    const contact = await this.getContact(id, teamId);
    if (!contact) return null;
    const [company, opportunities, activities, externalLinks] = await Promise.all([
      contact.companyId ? this.getCompany(contact.companyId, teamId) : null,
      this.db.query(
        `select opportunities.* from opportunities
         left join opportunity_contacts on opportunity_contacts.opportunity_id = opportunities.id
         where opportunities.team_id = $2 and
           (opportunities.primary_contact_id = $1 or opportunity_contacts.contact_id = $1)
         order by opportunities.updated_at desc`,
        [id, teamId]
      ),
      this.db.query("select * from activities where contact_id = $1 and team_id = $2 order by occurred_at desc limit 100", [id, teamId]),
      this.db.query(
        "select * from external_links where local_entity_type = 'contact' and local_entity_id = $1 and team_id = $2 order by updated_at desc",
        [id, teamId]
      )
    ]);
    return {
      contact,
      company,
      opportunities: opportunities.rows.map(mapRow),
      activities: activities.rows.map(mapRow),
      externalLinks: externalLinks.rows.map(mapRow)
    };
  }

  async getOpportunityGraph(id, teamId) {
    const opportunity = await this.getOpportunity(id, teamId);
    if (!opportunity) return null;
    const [company, contacts, research, assets, campaigns, messages, activities, externalLinks, generationJobs] = await Promise.all([
      this.getCompany(opportunity.companyId, teamId),
      this.db.query(
        `select distinct contacts.* from contacts
         left join opportunity_contacts on opportunity_contacts.contact_id = contacts.id
         where contacts.team_id = $2 and
           (contacts.id = (select primary_contact_id from opportunities where id = $1) or opportunity_contacts.opportunity_id = $1)
         order by contacts.updated_at desc`,
        [id, teamId]
      ),
      this.db.query("select * from research_records where opportunity_id = $1 and team_id = $2 order by captured_at desc", [id, teamId]),
      this.db.query("select * from artifacts where opportunity_id = $1 and team_id = $2 order by created_at desc", [id, teamId]),
      this.db.query("select * from campaigns where opportunity_id = $1 and team_id = $2 order by updated_at desc", [id, teamId]),
      this.db.query("select * from messages where opportunity_id = $1 and team_id = $2 order by created_at desc", [id, teamId]),
      this.db.query("select * from activities where opportunity_id = $1 and team_id = $2 order by occurred_at desc limit 100", [id, teamId]),
      this.db.query(
        "select * from external_links where local_entity_type = 'opportunity' and local_entity_id = $1 and team_id = $2 order by updated_at desc",
        [id, teamId]
      ),
      this.db.query("select * from generation_jobs where opportunity_id = $1 and team_id = $2 order by created_at desc", [id, teamId])
    ]);
    return {
      opportunity,
      company,
      contacts: contacts.rows.map(mapRow),
      research: research.rows.map(mapRow),
      assets: assets.rows.map(mapRow),
      campaigns: campaigns.rows.map(mapRow),
      messages: messages.rows.map(mapRow),
      activities: activities.rows.map(mapRow),
      externalLinks: externalLinks.rows.map(mapRow),
      generationJobs: generationJobs.rows.map(mapRow)
    };
  }

  async createCompany(record) {
    const result = await this.db.query(
      `insert into companies
       (id, team_id, tenant_id, legal_name, display_name, normalized_domain, website_url,
        industry, category, city, region, country, source, owner_user_id,
        relationship_status, research_summary, import_batch_id, metadata, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20)
       returning *`,
      [record.id, record.teamId, record.tenantId || null, record.legalName || null, record.displayName,
        record.normalizedDomain || null, record.websiteUrl || null, record.industry || null,
        record.category || null, record.city || null, record.region || null, record.country || null,
        record.source || null, record.ownerUserId || null, record.relationshipStatus,
        record.researchSummary || null, record.importBatchId || null, JSON.stringify(record.metadata || {}),
        record.createdAt, record.updatedAt]
    );
    return mapRow(result.rows[0]);
  }

  async createContact(record) {
    const result = await this.db.query(
      `insert into contacts
       (id, team_id, tenant_id, company_id, first_name, last_name, full_name, title, role,
        email, normalized_email, phone, linkedin_url, social_urls, source,
        deliverability_state, consent_state, suppression_state, owner_user_id,
        import_batch_id, metadata, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21::jsonb,$22,$23)
       returning *`,
      [record.id, record.teamId, record.tenantId || null, record.companyId || null,
        record.firstName || null, record.lastName || null, record.fullName || null,
        record.title || null, record.role || null, record.email || null,
        record.normalizedEmail || null, record.phone || null, record.linkedinUrl || null,
        JSON.stringify(record.socialUrls || {}), record.source || null, record.deliverabilityState,
        record.consentState, record.suppressionState, record.ownerUserId || null,
        record.importBatchId || null, JSON.stringify(record.metadata || {}), record.createdAt, record.updatedAt]
    );
    return mapRow(result.rows[0]);
  }

  async createOpportunity(record) {
    const result = await this.db.query(
      `insert into opportunities
       (id, team_id, tenant_id, company_id, primary_contact_id, name, stage,
        estimated_value, currency, owner_user_id, qualification, approach_angle,
        offer, entry_offer, next_action, next_action_at, source, status,
        import_batch_id, metadata, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21,$22)
       returning *`,
      [record.id, record.teamId, record.tenantId || null, record.companyId,
        record.primaryContactId || null, record.name, record.stage, record.estimatedValue,
        record.currency, record.ownerUserId || null, JSON.stringify(record.qualification || {}),
        record.approachAngle || null, record.offer || null, record.entryOffer || null,
        record.nextAction || null, record.nextActionAt || null, record.source || null,
        record.status, record.importBatchId || null, JSON.stringify(record.metadata || {}),
        record.createdAt, record.updatedAt]
    );
    for (const contactId of record.contactIds || []) {
      await this.db.query(
        `insert into opportunity_contacts (opportunity_id, contact_id, role, is_primary)
         values ($1,$2,$3,$4) on conflict do nothing`,
        [record.id, contactId, contactId === record.primaryContactId ? "primary" : "stakeholder", contactId === record.primaryContactId]
      );
    }
    return mapRow(result.rows[0]);
  }

  async createExternalLink(record) {
    const result = await this.db.query(
      `insert into external_links
       (id, team_id, tenant_id, local_entity_type, local_entity_id, external_system,
        external_object_type, external_id, external_url, sync_cursor, sync_state,
        metadata, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14) returning *`,
      [record.id, record.teamId, record.tenantId || null, record.localEntityType,
        record.localEntityId, record.externalSystem, record.externalObjectType,
        record.externalId, record.externalUrl || null, record.syncCursor || null,
        record.syncState, JSON.stringify(record.metadata || {}), record.createdAt, record.updatedAt]
    );
    return mapRow(result.rows[0]);
  }

  async createGenerationJob(record) {
    const result = await this.db.query(
      `insert into generation_jobs
       (id, team_id, tenant_id, company_id, opportunity_id, requested_tool,
        requested_skill, brief, status, created_by, result_metadata, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11::jsonb,$12,$13) returning *`,
      [record.id, record.teamId, record.tenantId || null, record.companyId || null,
        record.opportunityId || null, record.requestedTool, record.requestedSkill || null,
        JSON.stringify(record.brief || {}), record.status, record.createdBy || null,
        JSON.stringify(record.metadata || {}), record.createdAt, record.updatedAt]
    );
    return mapRow(result.rows[0]);
  }

  async createResearch(record) {
    const result = await this.db.query(
      `insert into research_records
       (id, team_id, tenant_id, company_id, opportunity_id, source_url, source_type,
        content, signal_category, structured_data, captured_at, author_type, author_id,
        confidence, verification_status, import_batch_id, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18) returning *`,
      [record.id, record.teamId, record.tenantId || null, record.companyId || null,
        record.opportunityId || null, record.sourceUrl || null, record.sourceType,
        record.content, record.signalCategory || null, JSON.stringify(record.structuredData || {}),
        record.capturedAt, record.authorType || null, record.authorId || null,
        record.confidence || null, record.verificationStatus, record.importBatchId || null,
        record.createdAt, record.updatedAt]
    );
    return mapRow(result.rows[0]);
  }

  async createAsset(record) {
    const result = await this.db.query(
      `insert into artifacts
       (id, team_id, tenant_id, opportunity_id, company_id, generation_job_id,
        kind, slug, source_path, build_commit, deployment_target, deployment_url,
        version, status, approved_at, metadata, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18) returning *`,
      [record.id, record.teamId, record.tenantId || null, record.opportunityId || null,
        record.companyId || null, record.generationJobId || null, record.kind,
        record.slug || null, record.sourcePath || null, record.buildCommit || null,
        record.deploymentTarget || null, record.deploymentUrl || null, record.version,
        record.status, record.approvedAt || null, JSON.stringify(record.metadata || {}),
        record.createdAt, record.updatedAt]
    );
    if (record.generationJobId) {
      await this.db.query(
        `insert into generation_job_artifacts (generation_job_id, artifact_id)
         values ($1,$2) on conflict do nothing`,
        [record.generationJobId, record.id]
      );
    }
    return mapRow(result.rows[0]);
  }

  async createActivity(record) {
    const result = await this.db.query(
      `insert into activities
       (id, team_id, tenant_id, company_id, contact_id, opportunity_id, campaign_id,
        message_id, activity_type, occurred_at, actor_type, actor_id, summary,
        metadata, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16) returning *`,
      [record.id, record.teamId, record.tenantId || null, record.companyId || null,
        record.contactId || null, record.opportunityId || null, record.campaignId || null,
        record.messageId || null, record.activityType, record.occurredAt,
        record.actorType || null, record.actorId || null, record.summary || null,
        JSON.stringify(record.metadata || {}), record.createdAt, record.updatedAt]
    );
    return mapRow(result.rows[0]);
  }
}

export class LegacyCoreRepository {
  async snapshot(teamId) {
    const [accounts, leads, accountCampaigns, outreachCampaigns, queue, drafts, events, calls] = await Promise.all([
      listTargetAccounts({ teamId }),
      listLeads({ teamId }),
      listAccountCampaigns({ teamId }),
      listOutreachCampaigns({ teamId }),
      listOutreachQueue({ teamId }),
      listDraftEmails({ teamId }),
      listOutreachEvents({ teamId }),
      getCalls({ teamId })
    ]);
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
    const companies = [...accounts.map(mapTargetAccountToCompany), ...leads.map(mapLeadToCompany)];
    const contacts = [
      ...leads.map(mapLeadToContact),
      ...accounts.flatMap((account) => (account.buyingCommittee || []).map((contact, index) => mapCommitteeContact(account, contact, index)))
    ];
    const opportunities = [
      ...leads.map(mapLeadToOpportunity),
      ...accountCampaigns.flatMap((campaign) => {
        const account = accountsById.get(campaign.accountId);
        return account ? [mapAccountCampaignToOpportunity(campaign, account)] : [];
      })
    ];
    const research = [
      ...leads.map(mapLeadToResearch),
      ...accounts.map(mapTargetAccountToResearch)
    ].filter(Boolean);
    const campaigns = outreachCampaigns.map((campaign) => mapOutreachCampaign(campaign, teamId));
    const messages = queue.flatMap((item) => {
      const lead = leadsById.get(item.leadId);
      return lead ? [mapQueueItemToMessage(item, lead)] : [];
    });
    messages.push(...drafts.flatMap((draft) => {
      const lead = leadsById.get(draft.leadId || draft.lead_id);
      return lead ? [mapDraftEmailToMessage(draft, lead)] : [];
    }));
    const activities = [
      ...events.flatMap((event) => {
        const lead = leadsById.get(event.leadId);
        return lead ? [mapOutreachEventToActivity(event, lead)] : [];
      }),
      ...calls.flatMap((call) => {
        const lead = leadsById.get(call.leadId);
        return lead ? [mapCallToActivity(call, lead)] : [];
      })
    ];
    return { companies, contacts, opportunities, research, campaigns, messages, activities, assets: [], externalLinks: [], generationJobs: [] };
  }

  async listCompanies(teamId) {
    const snapshot = await this.snapshot(teamId);
    return newestFirst(snapshot.companies.map((company) => ({
      ...company,
      contactCount: snapshot.contacts.filter((contact) => contact.companyId === company.id).length,
      opportunityCount: snapshot.opportunities.filter((opportunity) => opportunity.companyId === company.id).length
    })));
  }

  async getCompany(id, teamId) {
    return (await this.snapshot(teamId)).companies.find((company) => company.id === id) || null;
  }

  async listContacts(teamId) {
    const snapshot = await this.snapshot(teamId);
    const companies = new Map(snapshot.companies.map((company) => [company.id, company]));
    return newestFirst(snapshot.contacts.map((contact) => ({ ...contact, companyName: companies.get(contact.companyId)?.displayName || "" })));
  }

  async getContact(id, teamId) {
    return (await this.listContacts(teamId)).find((contact) => contact.id === id) || null;
  }

  async listOpportunities(teamId) {
    const snapshot = await this.snapshot(teamId);
    const companies = new Map(snapshot.companies.map((company) => [company.id, company]));
    const contacts = new Map(snapshot.contacts.map((contact) => [contact.id, contact]));
    return newestFirst(snapshot.opportunities.map((opportunity) => ({
      ...opportunity,
      companyName: companies.get(opportunity.companyId)?.displayName || "",
      primaryContactName: contacts.get(opportunity.primaryContactId)?.fullName || ""
    })));
  }

  async getOpportunity(id, teamId) {
    return (await this.listOpportunities(teamId)).find((opportunity) => opportunity.id === id) || null;
  }

  async getCompanyGraph(id, teamId) {
    const snapshot = await this.snapshot(teamId);
    const company = snapshot.companies.find((record) => record.id === id);
    if (!company) return null;
    const opportunities = snapshot.opportunities.filter((record) => record.companyId === id);
    const opportunityIds = new Set(opportunities.map((record) => record.id));
    return {
      company,
      contacts: snapshot.contacts.filter((record) => record.companyId === id),
      opportunities,
      research: snapshot.research.filter((record) => record.companyId === id || opportunityIds.has(record.opportunityId)),
      assets: snapshot.assets.filter((record) => record.companyId === id || opportunityIds.has(record.opportunityId)),
      activities: newestFirst(snapshot.activities.filter((record) => record.companyId === id || opportunityIds.has(record.opportunityId)), "occurredAt"),
      externalLinks: snapshot.externalLinks.filter((record) =>
        (record.localEntityType === "company" && record.localEntityId === id) ||
        (record.localEntityType === "opportunity" && opportunityIds.has(record.localEntityId)))
    };
  }

  async getContactGraph(id, teamId) {
    const snapshot = await this.snapshot(teamId);
    const contact = snapshot.contacts.find((record) => record.id === id);
    if (!contact) return null;
    return {
      contact,
      company: snapshot.companies.find((record) => record.id === contact.companyId) || null,
      opportunities: snapshot.opportunities.filter((record) => record.primaryContactId === id || record.contactIds?.includes(id)),
      activities: newestFirst(snapshot.activities.filter((record) => record.contactId === id), "occurredAt"),
      externalLinks: snapshot.externalLinks.filter((record) => record.localEntityType === "contact" && record.localEntityId === id)
    };
  }

  async getOpportunityGraph(id, teamId) {
    const snapshot = await this.snapshot(teamId);
    const opportunity = snapshot.opportunities.find((record) => record.id === id);
    if (!opportunity) return null;
    const contactIds = new Set([opportunity.primaryContactId, ...(opportunity.contactIds || [])].filter(Boolean));
    const legacyCampaignId = opportunity.metadata?.campaignId;
    return {
      opportunity,
      company: snapshot.companies.find((record) => record.id === opportunity.companyId) || null,
      contacts: snapshot.contacts.filter((record) => contactIds.has(record.id)),
      research: snapshot.research.filter((record) => record.opportunityId === id),
      assets: snapshot.assets.filter((record) => record.opportunityId === id),
      campaigns: snapshot.campaigns.filter((record) => record.opportunityId === id || (legacyCampaignId && record.legacySourceId === legacyCampaignId)),
      messages: snapshot.messages.filter((record) => record.opportunityId === id),
      activities: newestFirst(snapshot.activities.filter((record) => record.opportunityId === id), "occurredAt"),
      externalLinks: snapshot.externalLinks.filter((record) => record.localEntityType === "opportunity" && record.localEntityId === id),
      generationJobs: snapshot.generationJobs.filter((record) => record.opportunityId === id)
    };
  }
}

export class CompositeCoreRepository {
  constructor({ canonical = null, compatibility = new LegacyCoreRepository() } = {}) {
    this.canonical = canonical;
    this.compatibility = compatibility;
    this.ready = null;
  }

  async canonicalReady() {
    if (!this.canonical) return false;
    if (this.ready === null) {
      try {
        this.ready = await this.canonical.isReady();
      } catch {
        this.ready = false;
      }
    }
    return this.ready;
  }

  async mergedList(method, teamId) {
    const compatibility = await this.compatibility[method](teamId);
    if (!(await this.canonicalReady())) return compatibility;
    const canonical = await this.canonical[method](teamId);
    return newestFirst(mergeById(compatibility, canonical));
  }

  listCompanies(teamId) { return this.mergedList("listCompanies", teamId); }
  listContacts(teamId) { return this.mergedList("listContacts", teamId); }
  listOpportunities(teamId) { return this.mergedList("listOpportunities", teamId); }

  async getRecord(method, id, teamId) {
    const compatibility = await this.compatibility[method](id, teamId);
    if (!(await this.canonicalReady())) return compatibility;
    return (await this.canonical[method](id, teamId)) || compatibility;
  }

  getCompany(id, teamId) { return this.getRecord("getCompany", id, teamId); }
  getContact(id, teamId) { return this.getRecord("getContact", id, teamId); }
  getOpportunity(id, teamId) { return this.getRecord("getOpportunity", id, teamId); }

  async mergedGraph(method, rootKey, id, teamId) {
    const compatibility = await this.compatibility[method](id, teamId);
    if (!(await this.canonicalReady())) return compatibility;
    const canonical = await this.canonical[method](id, teamId);
    if (!canonical) return compatibility;
    if (!compatibility) return canonical;
    const keys = new Set([...Object.keys(compatibility), ...Object.keys(canonical)]);
    const result = {};
    for (const key of keys) {
      if (key === rootKey || key === "company") result[key] = canonical[key] || compatibility[key];
      else result[key] = mergeById(compatibility[key], canonical[key]);
    }
    return result;
  }

  getCompanyGraph(id, teamId) { return this.mergedGraph("getCompanyGraph", "company", id, teamId); }
  getContactGraph(id, teamId) { return this.mergedGraph("getContactGraph", "contact", id, teamId); }
  getOpportunityGraph(id, teamId) { return this.mergedGraph("getOpportunityGraph", "opportunity", id, teamId); }

  async write(method, record) {
    if (!(await this.canonicalReady())) {
      throw new Error("DGTL Core writes require DATABASE_URL and migration 009_core_domain.sql.");
    }
    return this.canonical[method](record);
  }

  createCompany(record) { return this.write("createCompany", record); }
  createContact(record) { return this.write("createContact", record); }
  createOpportunity(record) { return this.write("createOpportunity", record); }
  createExternalLink(record) { return this.write("createExternalLink", record); }
  createGenerationJob(record) { return this.write("createGenerationJob", record); }
  createResearch(record) { return this.write("createResearch", record); }
  createAsset(record) { return this.write("createAsset", record); }
  createActivity(record) { return this.write("createActivity", record); }
}

let defaultRepository;
export function getCoreRepository() {
  if (!defaultRepository) {
    const pool = getCorePool();
    defaultRepository = new CompositeCoreRepository({
      canonical: pool ? new PostgresCoreRepository(pool) : null
    });
  }
  return defaultRepository;
}

export function __resetCoreRepositoryForTests() {
  defaultRepository = null;
}
