import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { leadFromCsvRecord, parseCsv } from "../lib/csv.js";
import { defaultTenant, normalizeTenantConfig } from "../lib/defaultTenant.js";
import { searchApolloPeople } from "../lib/integrations/apollo.js";
import { lookupHunterDomain } from "../lib/integrations/hunter.js";
import { sendResendEmail, validateResendConfig } from "../lib/integrations/resend.js";
import {
  decorateLeadsWithDuplicates,
  filterAndSortLeads,
  leadsToCsv,
  normalizeLeadInput,
  scoreLead
} from "../lib/leadUtils.js";
import { buildDraftEmail } from "../lib/outreach.js";
import { createLead, getLeadById, mergeLeadMetadata, updateLeadResearch } from "../lib/store.js";
import {
  buildQueuePlan,
  canSendQueueItem,
  defaultOutreachTemplates,
  findSuppressionForLead,
  renderOutreachTemplate,
  suggestFollowUpDate
} from "../lib/outreachSequence.js";
import { buildProspectingQuery, mergeBatchCounts, selectedPreviewResults } from "../lib/prospecting.js";
import {
  sanitizeTenantConfig,
  tenantConfigToJson,
  validateTenantConfig
} from "../lib/tenantValidation.js";
import { scoreFundingLead } from "../lib/funding/admin.js";
import {
  dedupeFundingOpportunities,
  normalizeFundingOpportunity,
  validateFundingOpportunity
} from "../lib/funding/ingestion.js";

test("normalizes partial tenant config with default funnel content", () => {
  const tenant = normalizeTenantConfig({
    id: "tenant_partner",
    slug: "partner",
    domains: ["partner.example.com"],
    brand: { name: "Partner Media" }
  });

  assert.equal(tenant.brand.name, "Partner Media");
  assert.equal(tenant.hero.headline, "Get a full month of content filmed in one day.");
  assert.equal(tenant.packages.length, 4);
  assert.equal(tenant.domains[0], "partner.example.com");
});

test("validates a full tenant config after normalization", () => {
  const result = validateTenantConfig(defaultTenant);

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.tenant.hero.stats.length, 3);
});

test("rejects unsafe tenant identity and package config", () => {
  const result = validateTenantConfig({
    ...defaultTenant,
    slug: "Bad Slug",
    status: "published",
    brand: { ...defaultTenant.brand, primaryColor: "blue" },
    defaultPackageId: "missing-package",
    packages: [
      {
        ...defaultTenant.packages[0],
        id: "duplicate",
        action: "pay",
        paymentLink: "stripe.example"
      },
      {
        ...defaultTenant.packages[1],
        id: "duplicate"
      }
    ]
  });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.path),
    [
      "slug",
      "status",
      "packages",
      "defaultPackageId",
      "packages.0.action",
      "packages.0.paymentLink",
      "brand.primaryColor"
    ]
  );
});

test("requires explicit tenant fields for import validation", () => {
  const result = validateTenantConfig({
    brand: { name: "Partial Brand" }
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === "id"));
  assert.ok(result.errors.some((error) => error.path === "slug"));
  assert.ok(result.errors.some((error) => error.path === "domains"));
  assert.ok(result.errors.some((error) => error.path === "packages"));
});

test("sanitizes optional tenant arrays and exports stable JSON", () => {
  const tenant = sanitizeTenantConfig({
    ...defaultTenant,
    hero: { ...defaultTenant.hero, stats: null },
    packages: [{ ...defaultTenant.packages[0], features: null }]
  });
  const json = tenantConfigToJson(tenant);

  assert.deepEqual(tenant.hero.stats, []);
  assert.deepEqual(tenant.packages[0].features, []);
  assert.equal(JSON.parse(json).id, defaultTenant.id);
});

test("parses CSV leads with quoted fields", () => {
  const records = parseCsv(
    'business,contact,email,phone,website,notes\n"Example Clinic","Jane Owner",jane@example.com,4165550100,https://example.com,"Toronto, med spa"'
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].business, "Example Clinic");
  assert.equal(records[0].notes, "Toronto, med spa");
});

test("maps CSV record into lead shape", () => {
  const lead = leadFromCsvRecord(
    {
      business: "Example Shop",
      contact: "Sam",
      email: "sam@example.com",
      website: "https://shop.example",
      notes: "Retail lead"
    },
    "tenant_dgtlmag"
  );

  assert.equal(lead.tenantId, "tenant_dgtlmag");
  assert.equal(lead.business, "Example Shop");
  assert.equal(lead.sourceType, "csv");
});

test("preserves funding scan answers in lead metadata", () => {
  const lead = normalizeLeadInput({
    tenantId: "tenant_funded_growth",
    business: "Ontario Growth Co",
    name: "Jordan",
    email: "jordan@example.com",
    source: "funding_scan",
    sourceType: "funding_scan",
    url: "https://growth.example",
    category: "Manufacturing",
    metadata: {
      fundingScan: {
        companyWebsite: "https://growth.example",
        industry: "Manufacturing",
        location: "Hamilton, Ontario",
        employeeCount: "12",
        revenueRange: "500k_1m",
        yearsOperating: "3_5",
        incorporated: "yes",
        currentlyExporting: "no",
        interestedInExporting: "yes",
        digitalNeeds: "Website modernization",
        ecommerceNeeds: "Dealer portal",
        crmAutomationNeeds: "Sales pipeline automation",
        availableProjectBudget: "15k_50k",
        mainGrowthGoal: "Expand into new Canadian markets"
      }
    }
  });

  assert.equal(lead.tenantId, "tenant_funded_growth");
  assert.equal(lead.sourceType, "funding_scan");
  assert.equal(lead.websiteUrl, "https://growth.example");
  assert.equal(lead.category, "Manufacturing");
  assert.equal(lead.metadata.fundingScan.location, "Hamilton, Ontario");
  assert.equal(lead.metadata.fundingScan.availableProjectBudget, "15k_50k");
});

test("scores funding scan leads for admin review", () => {
  const lead = normalizeLeadInput({
    tenantId: "tenant_funded_growth",
    business: "Ontario Growth Co",
    sourceType: "funding_scan",
    url: "https://growth.example",
    category: "Manufacturing",
    metadata: {
      fundingScan: {
        industry: "Manufacturing",
        location: "Hamilton, Ontario",
        employeeCount: "12",
        revenueRange: "500k_1m",
        currentlyExporting: "no",
        interestedInExporting: "yes",
        digitalNeeds: "Website modernization",
        ecommerceNeeds: "Dealer portal",
        crmAutomationNeeds: "Sales pipeline automation",
        mainGrowthGoal: "Expand into new Canadian markets"
      }
    }
  });

  const score = scoreFundingLead(lead);

  assert.equal(score.overallFit, 52);
  assert.equal(score.bestFundingLane, "export_marketing");
  assert.equal(score.bestFundingLaneLabel, "Export Marketing");
  assert.equal(score.recommendedOffer, "Export-ready content and market-entry campaign");
  assert.deepEqual(score.eligibilityGaps, []);
});

test("builds a draft email from tenant and lead context", () => {
  const tenant = normalizeTenantConfig({});
  const draft = buildDraftEmail({
    tenant,
    packageId: "pro-content-day",
    lead: {
      business: "Example Dental",
      name: "Alex"
    }
  });

  assert.match(draft.subject, /Example Dental/);
  assert.match(draft.body, /Hey Alex/);
  assert.match(draft.body, /Pro Content Day/);
});

test("builds a funding follow-up draft for funding scan leads", () => {
  const tenant = normalizeTenantConfig({});
  const lead = normalizeLeadInput({
    tenantId: "tenant_funded_growth",
    business: "Ontario Growth Co",
    name: "Jordan",
    sourceType: "funding_scan",
    category: "Manufacturing",
    metadata: {
      fundingScan: {
        industry: "Manufacturing",
        location: "Hamilton, Ontario",
        employeeCount: "12",
        revenueRange: "500k_1m",
        currentlyExporting: "no",
        interestedInExporting: "yes",
        digitalNeeds: "Website modernization",
        ecommerceNeeds: "Dealer portal",
        crmAutomationNeeds: "Sales pipeline automation",
        mainGrowthGoal: "Expand into new Canadian markets"
      }
    }
  });

  const draft = buildDraftEmail({ tenant, lead, packageId: "funding-fit-scan" });

  assert.equal(draft.subject, "Funding fit next step for Ontario Growth Co");
  assert.match(draft.body, /Ontario Growth Co/);
  assert.match(draft.body, /Export Marketing/);
  assert.match(draft.body, /Fundable Project Blueprint/);
  assert.match(draft.body, /not a guarantee of funding approval/);
  assert.match(draft.body, /determined by the funder or program administrator/);
  assert.match(draft.body, /short call/);
});

test("normalizes funding opportunity placeholders without external ingestion", () => {
  const opportunity = normalizeFundingOpportunity({
    name: "Digital Modernization Grant",
    agency: "Example Funder",
    link: "https://example.com/grants/digital#apply",
    closeDate: "July 15, 2026",
    province: "Ontario",
    activities: "CRM, ecommerce"
  });

  assert.equal(opportunity.title, "Digital Modernization Grant");
  assert.equal(opportunity.funder, "Example Funder");
  assert.equal(opportunity.sourceUrl, "https://example.com/grants/digital");
  assert.equal(opportunity.deadline, "2026-07-15");
  assert.deepEqual(opportunity.geography, ["Ontario"]);
  assert.deepEqual(opportunity.eligibleActivities, ["CRM", "ecommerce"]);
  assert.equal(opportunity.requiresHumanReview, true);
  assert.equal(validateFundingOpportunity(opportunity).ok, true);
});

test("dedupes normalized funding opportunities by canonical source", () => {
  const opportunities = dedupeFundingOpportunities([
    {
      title: "Export Support Program",
      funder: "Example Funder",
      sourceUrl: "https://example.com/programs/export/"
    },
    {
      title: "Export Support Program duplicate",
      funder: "Example Funder",
      sourceUrl: "https://example.com/programs/export#details"
    },
    {
      title: "Missing source is skipped"
    },
    {
      title: "Automation RFP",
      funder: "Procurement Office",
      sourceUrl: "https://example.com/rfp/automation"
    }
  ]);

  assert.equal(opportunities.length, 2);
  assert.deepEqual(
    opportunities.map((item) => item.title),
    ["Export Support Program", "Automation RFP"]
  );
});

test("searches Apollo people with current endpoint and query params", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.APOLLO_API_KEY;
  let requestUrl;
  let requestOptions;

  process.env.APOLLO_API_KEY = "apollo-test-key";
  globalThis.fetch = async (url, options) => {
    requestUrl = new URL(String(url));
    requestOptions = options;
    return {
      ok: true,
      async json() {
        return {
          people: [
            {
              first_name: "Sam",
              last_name: "Owner",
              title: "Founder",
              has_email: true,
              organization: { name: "Example Co" }
            }
          ]
        };
      }
    };
  };

  try {
    const result = await searchApolloPeople({
      domain: "https://www.example.com/path",
      titles: ["owner", "founder"]
    });

    assert.equal(result.ok, true);
    assert.equal(requestUrl.origin, "https://api.apollo.io");
    assert.equal(requestUrl.pathname, "/api/v1/mixed_people/api_search");
    assert.equal(requestUrl.searchParams.get("q_organization_domains_list[]"), "example.com");
    assert.deepEqual(requestUrl.searchParams.getAll("person_titles[]"), ["owner", "founder"]);
    assert.equal(requestOptions.method, "POST");
    assert.equal(requestOptions.headers["x-api-key"], "apollo-test-key");
    assert.equal(result.contacts[0].emailAvailable, true);
    assert.equal(result.contacts[0].company, "Example Co");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.APOLLO_API_KEY;
    else process.env.APOLLO_API_KEY = originalKey;
  }
});

test("metadata merge preserves existing keys", () => {
  const merged = mergeLeadMetadata(
    {
      displayName: { text: "Example Dental" },
      organization: { name: "Example Co", website: "https://example.co" },
      enrichments: {
        googlePlaces: { placeId: "place_123", rating: 4.8 },
        hunter: { domain: "example.co", emails: [{ value: "owner@example.co" }] },
        apollo: { people: [{ name: "Sam Founder", title: "Owner" }] }
      },
      position: "Founder",
      imported_by: "csv"
    },
    {
      organization: { linkedin_url: "https://linkedin.com/company/example-co" },
      enrichments: {
        website: { title: "Example Co" }
      },
      enrichment: { provider: "manual-review" }
    }
  );

  assert.equal(merged.displayName.text, "Example Dental");
  assert.equal(merged.organization.name, "Example Co");
  assert.equal(merged.organization.website, "https://example.co");
  assert.equal(merged.organization.linkedin_url, "https://linkedin.com/company/example-co");
  assert.equal(merged.enrichments.googlePlaces.placeId, "place_123");
  assert.equal(merged.enrichments.hunter.emails[0].value, "owner@example.co");
  assert.equal(merged.enrichments.apollo.people[0].title, "Owner");
  assert.equal(merged.enrichments.website.title, "Example Co");
  assert.equal(merged.position, "Founder");
  assert.equal(merged.imported_by, "csv");
  assert.equal(merged.enrichment.provider, "manual-review");
});

test("nested enrichment object can be added", () => {
  const merged = mergeLeadMetadata(
    {
      formattedAddress: "123 Queen St W",
      location: { city: "Toronto", province: "ON" }
    },
    {
      enrichment: {
        website: {
          title: "Example Dental",
          contacts: {
            primary: { email: "owner@example.com" }
          }
        }
      }
    }
  );

  assert.equal(merged.formattedAddress, "123 Queen St W");
  assert.equal(merged.location.city, "Toronto");
  assert.equal(merged.enrichment.website.title, "Example Dental");
  assert.equal(merged.enrichment.website.contacts.primary.email, "owner@example.com");
});

test("updateLeadResearch works in file-store mode", async () => {
  const storePath = path.join(process.cwd(), "data", "app-store.json");
  const originalDatabaseUrl = process.env.DATABASE_URL;
  let originalStore;

  try {
    originalStore = await readFile(storePath, "utf8");
  } catch {
    originalStore = undefined;
  }

  delete process.env.DATABASE_URL;
  await rm(storePath, { force: true });

  try {
    const lead = await createLead({
      id: "lead_file_store_research",
      tenantId: "tenant_dgtlmag",
      business: "Example Dental",
      notes: "Imported from CSV",
      status: "new",
      metadata: {
        company: "Example Dental",
        owner: "Sam Founder",
        location: { city: "Toronto" }
      },
      createdAt: "2026-06-01T12:00:00.000Z"
    });

    const updated = await updateLeadResearch(lead.id, {
      notes: "Verified owner and website",
      status: "researched",
      metadata: {
        location: { province: "ON" },
        enrichment: {
          provider: "manual-review",
          website: { title: "Example Dental" }
        }
      }
    });

    assert.equal(updated.id, lead.id);
    assert.equal(updated.createdAt, "2026-06-01T12:00:00.000Z");
    assert.equal(updated.notes, "Verified owner and website");
    assert.equal(updated.status, "researched");
    assert.equal(updated.metadata.company, "Example Dental");
    assert.equal(updated.metadata.owner, "Sam Founder");
    assert.equal(updated.metadata.location.city, "Toronto");
    assert.equal(updated.metadata.location.province, "ON");
    assert.equal(updated.metadata.enrichment.provider, "manual-review");
    assert.equal(updated.metadata.enrichment.website.title, "Example Dental");

    const storedLead = await getLeadById(lead.id);
    assert.deepEqual(storedLead.metadata, updated.metadata);
    assert.notEqual(storedLead.updatedAt, lead.updatedAt);
  } finally {
    if (originalStore === undefined) {
      await rm(storePath, { force: true });
    } else {
      await writeFile(storePath, originalStore);
    }

    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test("scores leads with deterministic reasons", () => {
  const lead = normalizeLeadInput({
    businessName: "Example Med Spa",
    website: "https://examplemedspa.com",
    email: "owner@examplemedspa.com",
    phone: "416-555-0100",
    category: "med spa",
    googleRating: 4.7,
    googleReviewCount: 80
  });
  const score = scoreLead(lead);

  assert.equal(score.score, 70);
  assert.match(score.reason, /website exists/);
  assert.match(score.reason, /high-value category/);
});

test("detects duplicate leads by domain business and Google Place ID", () => {
  const leads = [
    normalizeLeadInput({
      id: "lead_1",
      businessName: "Example Dental",
      website: "https://exampledental.com",
      googlePlaceId: "places/abc"
    }),
    normalizeLeadInput({
      id: "lead_2",
      businessName: "Example Dental",
      website: "https://www.exampledental.com/services"
    }),
    normalizeLeadInput({
      id: "lead_3",
      businessName: "Other Dental",
      googlePlaceId: "places/abc"
    })
  ];

  const decorated = decorateLeadsWithDuplicates(leads);
  assert.equal(decorated[0].possibleDuplicates.length, 2);
  assert.ok(decorated[0].possibleDuplicates.some((duplicate) => duplicate.reasons.includes("domain + business")));
  assert.ok(decorated[0].possibleDuplicates.some((duplicate) => duplicate.reasons.includes("Google Place ID")));
});

test("filters leads and exports filtered CSV", () => {
  const leads = [
    normalizeLeadInput({
      id: "lead_1",
      businessName: "Toronto Clinic",
      city: "Toronto",
      category: "clinic",
      sourceType: "google_places",
      leadScore: 40
    }),
    normalizeLeadInput({
      id: "lead_2",
      businessName: "Barrie Cafe",
      city: "Barrie",
      category: "coffee shop",
      sourceType: "csv",
      leadScore: 10
    })
  ];

  const filtered = filterAndSortLeads(leads, { city: "Toronto", sort: "score_desc" });
  const csv = leadsToCsv(filtered);

  assert.equal(filtered.length, 1);
  assert.match(csv, /Toronto Clinic/);
  assert.doesNotMatch(csv, /Barrie Cafe/);
});

test("returns standard not-configured provider response for Hunter", async () => {
  const originalKey = process.env.HUNTER_API_KEY;
  delete process.env.HUNTER_API_KEY;

  try {
    const result = await lookupHunterDomain("example.com");
    assert.equal(result.ok, false);
    assert.equal(result.provider, "hunter");
    assert.equal(result.configured, false);
    assert.match(result.error, /HUNTER_API_KEY/);
  } finally {
    if (originalKey === undefined) delete process.env.HUNTER_API_KEY;
    else process.env.HUNTER_API_KEY = originalKey;
  }
});

test("builds prospecting queries and selected batch imports", () => {
  const query = buildProspectingQuery({ category: "med spas", city: "Toronto" });
  const batch = {
    previewResults: [
      { businessName: "One" },
      { businessName: "Two" },
      { businessName: "Three" }
    ]
  };
  const selected = selectedPreviewResults(batch, [0, 2]);
  const counts = mergeBatchCounts({ found: 3, imported: 1 }, { imported: 3, skippedDuplicates: 1 });

  assert.equal(query, "med spas in Toronto");
  assert.deepEqual(selected.map((item) => item.businessName), ["One", "Three"]);
  assert.equal(counts.found, 3);
  assert.equal(counts.imported, 3);
  assert.equal(counts.skippedDuplicates, 1);
});

test("normalizes legacy JSON fallback leads into the new schema", () => {
  const lead = normalizeLeadInput({
    business: "Legacy Shop",
    name: "Legacy Owner",
    url: "https://legacy.example",
    sourceType: "form",
    status: "researched"
  });

  assert.equal(lead.businessName, "Legacy Shop");
  assert.equal(lead.contactName, "Legacy Owner");
  assert.equal(lead.domain, "legacy.example");
  assert.equal(lead.sourceType, "public_form");
  assert.equal(lead.pipelineStatus, "researched");
});

test("renders outreach templates with supported merge fields", () => {
  const rendered = renderOutreachTemplate(
    {
      subject: "Idea for {{businessName}} in {{city}}",
      body: "Hey {{contactName}}, {{tenantName}} can help with {{recommendedOffer}}. {{bookingLink}}"
    },
    {
      lead: {
        businessName: "Example Clinic",
        contactName: "Sam",
        city: "Toronto",
        recommendedOffer: "Pro Content Day"
      },
      tenant: normalizeTenantConfig({
        brand: { name: "DGTL" },
        packages: [{ id: "pkg", name: "Starter", bookingLink: "https://book.example" }],
        defaultPackageId: "pkg"
      })
    }
  );

  assert.equal(rendered.subject, "Idea for Example Clinic in Toronto");
  assert.match(rendered.body, /Hey Sam/);
  assert.match(rendered.body, /DGTL/);
  assert.match(rendered.body, /Pro Content Day/);
});

test("queues only eligible outreach leads and reports skipped reasons", () => {
  const tenant = normalizeTenantConfig({});
  const leads = [
    normalizeLeadInput({ id: "lead_email", businessName: "Has Email", email: "owner@example.com" }),
    normalizeLeadInput({ id: "lead_missing", businessName: "Missing Email" }),
    normalizeLeadInput({ id: "lead_suppressed", businessName: "Suppressed", email: "blocked@example.com" }),
    normalizeLeadInput({
      id: "lead_contacted",
      businessName: "Contacted",
      email: "contacted@example.com",
      outreachStatus: "contacted"
    })
  ];

  const plan = buildQueuePlan({
    leads,
    tenant,
    template: defaultOutreachTemplates[0],
    suppressions: [{ email: "blocked@example.com", reason: "manual" }],
    senderEmail: "sales@dgtl.example"
  });

  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].leadId, "lead_email");
  assert.deepEqual(
    plan.skipped.map((item) => item.reason),
    ["missing_email", "suppressed", "already_contacted"]
  );
});

test("suppression matching blocks email and domain targets", () => {
  const lead = normalizeLeadInput({
    email: "owner@example.com",
    website: "https://example.com"
  });

  assert.equal(findSuppressionForLead(lead, [{ email: "OWNER@example.com", reason: "manual" }]).reason, "manual");
  assert.equal(findSuppressionForLead(lead, [{ domain: "example.com", reason: "do_not_contact" }]).reason, "do_not_contact");
});

test("send caps enforce daily and per-domain limits", () => {
  const today = new Date("2026-06-15T12:00:00.000Z");
  const item = {
    id: "queue_2",
    tenantId: "tenant_a",
    campaignId: "campaign_a",
    status: "approved",
    recipientEmail: "new@example.com",
    senderEmail: "sales@dgtl.example"
  };
  const queue = [
    {
      id: "queue_1",
      tenantId: "tenant_a",
      campaignId: "campaign_a",
      status: "sent",
      recipientEmail: "old@example.com",
      sentAt: "2026-06-15T08:00:00.000Z"
    }
  ];

  assert.equal(
    canSendQueueItem({ item, queue, campaign: { dailySendCap: 1, perDomainDailyCap: 2 }, now: today }).reason,
    "daily_cap_reached"
  );
  assert.equal(
    canSendQueueItem({ item, queue, campaign: { dailySendCap: 10, perDomainDailyCap: 1 }, now: today }).reason,
    "per_domain_daily_cap_reached"
  );
  assert.equal(
    canSendQueueItem({ item, queue, campaign: { dailySendCap: 10, perDomainDailyCap: 2 }, now: today }).ok,
    true
  );
});

test("Resend returns not-configured provider response", async () => {
  const originalKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  try {
    const config = await validateResendConfig();
    const send = await sendResendEmail({
      from: "sales@example.com",
      to: "lead@example.com",
      subject: "Test",
      text: "Hello"
    });

    assert.equal(config.ok, false);
    assert.equal(config.provider, "resend");
    assert.equal(config.configured, false);
    assert.equal(send.ok, false);
    assert.equal(send.provider, "resend");
    assert.equal(send.configured, false);
  } finally {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  }
});

test("Resend success and failure responses preserve provider shape", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "resend-test-key";

  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      async json() {
        return { id: "msg_123" };
      }
    });
    const success = await sendResendEmail({
      from: "sales@example.com",
      to: "lead@example.com",
      subject: "Test",
      text: "Hello"
    });
    assert.equal(success.ok, true);
    assert.equal(success.provider, "resend");
    assert.equal(success.data.id, "msg_123");

    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      async json() {
        return { message: "Invalid sender" };
      }
    });
    const failure = await sendResendEmail({
      from: "bad@example.com",
      to: "lead@example.com",
      subject: "Test",
      text: "Hello"
    });
    assert.equal(failure.ok, false);
    assert.equal(failure.provider, "resend");
    assert.equal(failure.configured, true);
    assert.match(failure.error, /Invalid sender/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  }
});

test("suggests follow-up dates three business days out", () => {
  assert.equal(suggestFollowUpDate(new Date("2026-06-12T12:00:00.000Z")), "2026-06-17");
  assert.equal(suggestFollowUpDate(new Date("2026-06-15T12:00:00.000Z")), "2026-06-18");
});
