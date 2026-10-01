import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  companyDuplicateMatch,
  contactDuplicateMatch,
  CoreService,
  createCoreId,
  isCoreId,
  legacyCoreId,
  mapAccountCampaignToOpportunity,
  mapCommitteeContact,
  mapDraftEmailToMessage,
  mapLeadToCompany,
  mapLeadToContact,
  mapLeadToOpportunity,
  mapTargetAccountToCompany,
  MemoryCoreRepository
} from "../lib/core/index.js";

const FIXED_TIME = "2026-08-13T18:00:00.000Z";

function deterministicIds() {
  let sequence = 0;
  return (type) => `${type}_test_${++sequence}`;
}

function service(teamId, repository) {
  return new CoreService({ teamId, repository, idFactory: deterministicIds(), now: () => FIXED_TIME });
}

test("Core IDs are typed, stable, and deterministic for legacy compatibility", () => {
  const id = createCoreId("company", () => "00000000-0000-4000-8000-000000000001");
  assert.equal(id, "company_00000000-0000-4000-8000-000000000001");
  assert.equal(isCoreId("company", id), true);
  assert.equal(isCoreId("contact", id), false);
  assert.equal(legacyCoreId("opportunity", "lead", "lead_123"), "opportunity_lead_lead_123");
});

test("duplicate rules are deterministic, tenant-scoped, and review-only", () => {
  assert.deepEqual(
    companyDuplicateMatch(
      { teamId: "team_a", websiteUrl: "https://www.Example.com/about" },
      { teamId: "team_a", normalizedDomain: "example.com" }
    ),
    { strength: "strong", rule: "normalized_domain", requiresReview: true }
  );
  assert.equal(
    companyDuplicateMatch({ teamId: "team_a", normalizedDomain: "example.com" }, { teamId: "team_b", normalizedDomain: "example.com" }),
    null
  );
  assert.deepEqual(
    contactDuplicateMatch({ teamId: "team_a", email: "Person@Example.com" }, { teamId: "team_a", normalizedEmail: "person@example.com" }),
    { strength: "strong", rule: "normalized_email", requiresReview: true }
  );
});

test("legacy lead compatibility creates a stable Company Contact Opportunity graph", () => {
  const lead = {
    id: "lead_123",
    teamId: "team_a",
    tenantId: "tenant_a",
    businessName: "Example Co",
    contactName: "Ada Lovelace",
    contactTitle: "VP Growth",
    email: "ada@example.com",
    website: "https://www.example.com/about",
    pipelineStatus: "researched",
    painPoints: "Fragmented acquisition workflow",
    recommendedOffer: "Growth audit",
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME
  };
  const company = mapLeadToCompany(lead);
  const contact = mapLeadToContact(lead);
  const opportunity = mapLeadToOpportunity(lead);
  assert.equal(company.id, "company_lead_lead_123");
  assert.equal(company.normalizedDomain, "example.com");
  assert.equal(contact.companyId, company.id);
  assert.equal(opportunity.companyId, company.id);
  assert.equal(opportunity.primaryContactId, contact.id);
  assert.equal(opportunity.approachAngle, lead.painPoints);
});

test("target-account campaigns map to companies and distinct opportunities", () => {
  const account = {
    id: "account_1",
    teamId: "team_a",
    tenantId: "tenant_a",
    name: "Enterprise Co",
    domain: "enterprise.example",
    buyingCommittee: [{ name: "Grace Hopper", email: "grace@enterprise.example", isPrimary: true }],
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME
  };
  const company = mapTargetAccountToCompany(account);
  const campaignOne = mapAccountCampaignToOpportunity({ id: "ac_1", accountId: account.id, teamId: "team_a", name: "Platform launch" }, account);
  const campaignTwo = mapAccountCampaignToOpportunity({ id: "ac_2", accountId: account.id, teamId: "team_a", name: "Creator activation" }, account);
  assert.equal(campaignOne.companyId, company.id);
  assert.equal(campaignTwo.companyId, company.id);
  assert.notEqual(campaignOne.id, campaignTwo.id);
  assert.ok(campaignOne.primaryContactId);
});

test("buying-committee contact IDs survive row reordering when identity is present", () => {
  const account = { id: "account_1", teamId: "team_a", createdAt: FIXED_TIME, updatedAt: FIXED_TIME };
  const contact = { name: "Grace Hopper", email: "grace@example.com" };
  assert.equal(mapCommitteeContact(account, contact, 0).id, mapCommitteeContact(account, contact, 5).id);
});

test("legacy message compatibility accepts both PostgreSQL and file-store draft shapes", () => {
  const lead = { id: "lead_1", teamId: "team_a", tenantId: "tenant_a" };
  const postgresDraft = mapDraftEmailToMessage({
    id: "draft_1",
    team_id: "team_a",
    tenant_id: "tenant_a",
    lead_id: "lead_1",
    subject: "Hello",
    created_at: FIXED_TIME
  }, lead);
  const fileDraft = mapDraftEmailToMessage({
    id: "draft_1",
    teamId: "team_a",
    tenantId: "tenant_a",
    leadId: "lead_1",
    subject: "Hello",
    createdAt: FIXED_TIME
  }, lead);
  assert.deepEqual(postgresDraft, fileDraft);
  assert.equal(postgresDraft.opportunityId, "opportunity_lead_lead_1");
});

test("Core service enforces tenant isolation and canonical relationships", async () => {
  const repository = new MemoryCoreRepository({
    companies: [{ id: "company_other", teamId: "team_b", displayName: "Other", createdAt: FIXED_TIME, updatedAt: FIXED_TIME }]
  });
  const core = service("team_a", repository);
  const company = await core.createCompany({ displayName: "DGTL Prospect", websiteUrl: "https://www.prospect.test/path" });
  const contact = await core.createContact({ companyId: company.id, fullName: "Sam Buyer", email: "SAM@PROSPECT.TEST" });
  const opportunity = await core.createOpportunity({
    companyId: company.id,
    primaryContactId: contact.id,
    contactIds: [contact.id],
    name: "Audit-led entry",
    approachAngle: "Lead with a sourced digital audit",
    nextAction: "Review audit brief"
  });

  assert.equal(company.normalizedDomain, "prospect.test");
  assert.equal(contact.normalizedEmail, "sam@prospect.test");
  assert.equal(opportunity.companyId, company.id);
  assert.deepEqual(opportunity.contactIds, [contact.id]);
  assert.deepEqual((await core.listCompanies()).map((record) => record.id), [company.id]);
  assert.equal(await core.getCompany("company_other"), null);
});

test("opportunity creation rejects cross-company and cross-team contacts", async () => {
  const repository = new MemoryCoreRepository();
  const coreA = service("team_a", repository);
  const coreB = service("team_b", repository);
  const companyA = await coreA.createCompany({ displayName: "A" });
  const companyB = await coreB.createCompany({ displayName: "B" });
  const contactB = await coreB.createContact({ companyId: companyB.id, fullName: "Buyer B" });
  await assert.rejects(
    coreA.createOpportunity({ companyId: companyA.id, primaryContactId: contactB.id, name: "Invalid" }),
    /Contact is not available to this team/
  );
});

test("research, generation jobs, artifacts, activities, and external links join through an opportunity", async () => {
  const repository = new MemoryCoreRepository();
  const core = service("team_a", repository);
  const company = await core.createCompany({ displayName: "Graph Co" });
  const contact = await core.createContact({ companyId: company.id, fullName: "Primary Buyer" });
  const opportunity = await core.createOpportunity({ companyId: company.id, primaryContactId: contact.id, name: "Graph proof" });
  const research = await core.createResearch({ opportunityId: opportunity.id, sourceType: "website", sourceUrl: "https://graph.test", content: "Verified expansion signal", verificationStatus: "verified" });
  const job = await core.createGenerationJob({
    opportunityId: opportunity.id,
    requestedTool: "pitch.dgtlmag.com",
    requestedSkill: "dgtl-pitch-composer",
    brief: { angle: "expansion" },
    errorMetadata: { retryable: false },
    resultMetadata: { requestId: "request_1" }
  });
  const asset = await core.createAsset({ opportunityId: opportunity.id, generationJobId: job.id, kind: "pitch", slug: "graph-co" });
  const link = await core.createExternalLink({ localEntityType: "opportunity", localEntityId: opportunity.id, externalSystem: "worklog", externalObjectType: "engagement", externalId: "eng_42" });
  const activity = await core.createActivity({ opportunityId: opportunity.id, contactId: contact.id, activityType: "research_verified", summary: "Research verified" });
  await assert.rejects(core.createAsset({ opportunityId: opportunity.id, kind: "binary_blob" }), /Unsupported asset kind/);
  const graph = await core.getOpportunityGraph(opportunity.id);

  assert.equal(graph.company.id, company.id);
  assert.deepEqual(graph.contacts.map((record) => record.id), [contact.id]);
  assert.deepEqual(graph.research.map((record) => record.id), [research.id]);
  assert.deepEqual(graph.generationJobs.map((record) => record.id), [job.id]);
  assert.deepEqual(job.errorMetadata, { retryable: false });
  assert.deepEqual(job.resultMetadata, { requestId: "request_1" });
  assert.deepEqual(graph.assets.map((record) => record.id), [asset.id]);
  assert.deepEqual(graph.externalLinks.map((record) => record.id), [link.id]);
  assert.deepEqual(graph.activities.map((record) => record.id), [activity.id]);
});

test("migration 009 is additive and declares every Phase 1 persistence primitive", async () => {
  const migrationPath = path.join(process.cwd(), "migrations", "009_core_domain.sql");
  const sql = await readFile(migrationPath, "utf8");
  for (const table of [
    "companies", "contacts", "opportunities", "opportunity_contacts", "research_records",
    "campaigns", "messages", "activities", "artifacts", "external_links", "generation_jobs",
    "generation_job_artifacts", "import_batches", "import_rows"
  ]) {
    assert.match(sql, new RegExp(`create table if not exists ${table}\\b`));
  }
  assert.doesNotMatch(sql, /\bdrop\s+table\b/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
  assert.match(sql, /on conflict do nothing/g);
});
