import { domainFromUrl } from "./leadUtils.js";
import {
  buildFundingOpportunityOutreachAngle,
  isFundingScanLead,
  scoreFundingLead
} from "./funding/admin.js";
// NOTE: this module is imported by client components (OutreachQueueBuilder), so
// it must stay free of node-only imports. The signed unsubscribe URL is built
// server-side and passed in via the `unsubscribeUrl` field (see the queue route
// and lib/outreach/sendQueue.js).

export const outreachTemplateFields = [
  "businessName",
  "contactName",
  "city",
  "category",
  "painPoints",
  "recommendedOffer",
  "tenantName",
  "bookingLink",
  "senderName"
];

export const campaignStatuses = ["draft", "active", "paused", "completed"];

export const outreachQueueStatuses = [
  "queued",
  "approved",
  "sending",
  "sent",
  "failed",
  "skipped",
  "suppressed",
  "replied",
  "booked"
];

export const suppressionReasons = [
  "unsubscribed",
  "bounced",
  "manual",
  "complained",
  "invalid",
  "do_not_contact"
];

export const outreachEventTypes = [
  "drafted",
  "queued",
  "approved",
  "sent",
  "failed",
  "skipped",
  "suppressed",
  "replied",
  "booked",
  "unsubscribed"
];

export const defaultOutreachTemplates = [
  {
    id: "template_content_day_intro",
    tenantId: "",
    name: "Content Day Intro",
    subject: "Content idea for {{businessName}}",
    body: `Hey {{contactName}},

I came across {{businessName}} in {{city}} and thought there may be a strong opportunity to turn one focused shoot day into a month of useful short-form content.

The package I would start with is {{recommendedOffer}}.

For {{businessName}}, I would likely build content around:
1. A simple explanation of what makes the offer different
2. Trust-building proof and behind-the-scenes clips
3. Short service or product highlights that can run on Instagram, TikTok, YouTube, and ads

Would it be worth sending over a quick content day concept?

{{unsubscribeFooter}}`,
    category: "",
    offerType: "content_day",
    isActive: true,
    system: true
  },
  {
    id: "template_content_day_followup",
    tenantId: "",
    name: "Content Day Follow-up",
    subject: "Quick follow-up for {{businessName}}",
    body: `Hey {{contactName}},

Quick follow-up on the content day idea for {{businessName}}.

The simple version is: one planned shoot, then a batch of short-form assets your team can use across social, ads, and email.

If useful, I can send over a rough shot list for {{businessName}}.

{{unsubscribeFooter}}`,
    category: "",
    offerType: "follow_up",
    isActive: true,
    system: true
  },
  {
    id: "template_funding_intro",
    tenantId: "",
    name: "Funding Fit Intro",
    subject: "Possible funding angle for {{businessName}}",
    body: `Hi {{contactName}},

Based on your funding fit scan, {{businessName}} looks like a potential fit for the {{fundingLane}} lane{{fundingProgramClause}}.

To be clear, this is a screening signal, not a confirmation of eligibility or funding — that always needs a human review of the specific program rules.

If it is useful, I can walk you through what a fundable project scope could look like and which DGTL package fits ({{fundingRecommendedOffer}}).

Would a short call be worth it?

{{unsubscribeFooter}}`,
    category: "",
    offerType: "funding_intro",
    isActive: true,
    system: true
  },
  {
    id: "template_funding_fit_summary",
    tenantId: "",
    name: "Funding Fit Summary",
    subject: "Your funding fit summary for {{businessName}}",
    body: `Hi {{contactName}},

Here is the quick version of what we saw for {{businessName}}:

- Best-fit lane: {{fundingLane}}
- Potential program to review: {{fundingProgram}}
- Suggested next step: {{fundingNextStep}}

None of this confirms eligibility or an award — we would review the program rules together before any application work.

If you want, I can turn this into a scoped, fundable project outline.

{{unsubscribeFooter}}`,
    category: "",
    offerType: "funding_fit_summary",
    isActive: true,
    system: true
  },
  {
    id: "template_funding_book_call",
    tenantId: "",
    name: "Funding Book a Call",
    subject: "15 minutes on funded growth for {{businessName}}?",
    body: `Hi {{contactName}},

Following up on the funding fit for {{businessName}} in the {{fundingLane}} lane.

The most useful next step is usually a 15-minute call to confirm the project scope, budget, and owner, then decide whether to move into a blueprint, application support, or execution package.

You can grab a time here: {{bookingLink}}

Human review is required before we make any eligibility or funding claim.

{{unsubscribeFooter}}`,
    category: "",
    offerType: "funding_book_call",
    isActive: true,
    system: true
  },
  {
    id: "template_polish_stone_intro",
    tenantId: "",
    name: "Polish Stone Intro",
    subject: "Stone & tile work for {{businessName}}",
    body: `Hi {{contactName}},

I came across {{businessName}} in {{city}} and wanted to reach out — I run Polish Stone, a family granite, tile, and stonework crew that handles high-end installs across the GTA, Southern Ontario, and Muskoka.

If you have a project coming up — countertops, backsplash, floor or wall tile, a full renovation, or a commercial fit-out — we self-perform the whole scope with one accountable crew: demolition, prep, waterproofing, tile, and stone fabrication.

The best starting point is usually {{recommendedOffer}} — a no-obligation on-site measure and a transparent, line-item quote.

Would it be worth booking a quick site visit?

{{unsubscribeFooter}}`,
    category: "",
    offerType: "polish_stone_intro",
    isActive: true,
    system: true
  },
  {
    id: "template_polish_stone_followup",
    tenantId: "",
    name: "Polish Stone Follow-up",
    subject: "Following up — a firm quote for {{businessName}}",
    body: `Hi {{contactName}},

Quick follow-up from Polish Stone on the stone and tile work for {{businessName}}.

The simple version: we come out, measure, and send back a clear written quote covering material, labour, and installation — no surprise extras. As a rule of thumb, installed tile runs about $30–40 per square foot, and countertops are priced by the slab and edge.

If a project is on the horizon, I'm happy to lock in a site visit at your convenience.

{{unsubscribeFooter}}`,
    category: "",
    offerType: "follow_up",
    isActive: true,
    system: true
  }
];

export function renderOutreachTemplate(template, { lead = {}, tenant = {}, senderName = "", unsubscribeUrl = "" } = {}) {
  const fields = buildTemplateFields({ lead, tenant, senderName, unsubscribeUrl });
  return {
    subject: replaceMergeFields(template?.subject || "", fields),
    body: replaceMergeFields(template?.body || "", fields),
    fields
  };
}

export function buildTemplateFields({ lead = {}, tenant = {}, senderName = "", unsubscribeUrl = "" } = {}) {
  const tenantName = tenant.brand?.name || tenant.name || "our team";
  const selectedPackage =
    tenant.packages?.find((pkg) => pkg.id === tenant.defaultPackageId) ||
    tenant.packages?.[0] ||
    {};
  const bookingLink = selectedPackage.bookingLink || tenant.routing?.bookingLink || "";
  const funding = buildFundingMergeFields(lead);

  // unsubscribeUrl is a real, signed, team-scoped link built server-side and
  // passed in; when absent (e.g. the client preview) we fall back to a
  // reply-based footer.
  const unsubscribeFooter = unsubscribeUrl
    ? `If you'd prefer not to hear from us, unsubscribe here: ${unsubscribeUrl}`
    : "If this is not relevant, reply and I will make sure you are not contacted again.";

  return {
    businessName: lead.businessName || lead.business || "your business",
    contactName: lead.contactName || lead.name || "there",
    city: lead.city || "",
    category: lead.category || "",
    painPoints: lead.painPoints || "",
    recommendedOffer: lead.recommendedOffer || selectedPackage.name || "a content day package",
    tenantName,
    bookingLink,
    senderName: senderName || tenant.brand?.senderName || tenantName,
    unsubscribeUrl,
    unsubscribeFooter,
    ...funding
  };
}

/**
 * Funding-specific merge fields, computed only for funding-scan leads. Returns
 * empty strings for non-funding leads so the standard templates are unaffected.
 */
export function buildFundingMergeFields(lead = {}) {
  if (!isFundingScanLead(lead)) {
    return {
      fundingLane: "",
      fundingProgram: "",
      fundingProgramClause: "",
      fundingNextStep: "",
      fundingRecommendedOffer: ""
    };
  }

  const score = scoreFundingLead(lead);
  const topMatch = score.programMatches?.[0] || null;
  const angle = topMatch
    ? buildFundingOpportunityOutreachAngle({ program: topMatch.program, lead, match: topMatch })
    : null;
  const programName = topMatch?.program?.name || "";

  return {
    fundingLane: score.bestFundingLaneLabel || "your growth lane",
    fundingProgram: programName || "a program we would confirm together",
    fundingProgramClause: programName ? `, with ${programName} worth reviewing` : "",
    fundingNextStep: angle?.serviceAngle || "Shape a scoped, fundable project with budget and milestones.",
    fundingRecommendedOffer: score.recommendedOffer || "a fundable project blueprint"
  };
}

export function replaceMergeFields(input, fields = {}) {
  return String(input || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => fields[key] ?? "");
}

export function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function normalizeDomain(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return domainFromUrl(raw.includes("@") ? raw.split("@").pop() : raw);
}

export function recipientDomain(email = "") {
  const normalized = normalizeEmail(email);
  return normalized.includes("@") ? normalized.split("@").pop() : "";
}

export function findSuppressionForLead(lead = {}, suppressions = []) {
  return findSuppression({
    email: lead.email,
    domain: lead.domain || lead.websiteUrl || lead.website
  }, suppressions);
}

export function findSuppression({ email = "", domain = "", tenantId = "" } = {}, suppressions = []) {
  const targetEmail = normalizeEmail(email);
  const targetDomain = normalizeDomain(domain || recipientDomain(targetEmail));

  return suppressions.find((item) => {
    const itemTenant = item.tenantId || "";
    if (itemTenant && tenantId && itemTenant !== tenantId) return false;
    if (item.email && normalizeEmail(item.email) === targetEmail) return true;
    if (item.domain && normalizeDomain(item.domain) === targetDomain) return true;
    return false;
  });
}

export function buildQueuePlan({
  leads = [],
  tenant = {},
  template,
  campaignId = "",
  suppressions = [],
  scheduledFor = "",
  status = "queued",
  senderEmail = "",
  senderName = "",
  includeContacted = false,
  resolveUnsubscribeUrl = null
} = {}) {
  const selectedTemplate = template || defaultOutreachTemplates[0];
  const items = [];
  const skipped = [];

  for (const lead of leads) {
    if (!lead.email) {
      skipped.push({ leadId: lead.id, businessName: lead.businessName || lead.business || "", reason: "missing_email" });
      continue;
    }

    const suppression = findSuppressionForLead(lead, suppressions);
    if (suppression) {
      skipped.push({
        leadId: lead.id,
        businessName: lead.businessName || lead.business || "",
        reason: "suppressed",
        suppressionReason: suppression.reason || ""
      });
      continue;
    }

    if (!includeContacted && isAlreadyContacted(lead)) {
      skipped.push({ leadId: lead.id, businessName: lead.businessName || lead.business || "", reason: "already_contacted" });
      continue;
    }

    const unsubscribeUrl = typeof resolveUnsubscribeUrl === "function" ? resolveUnsubscribeUrl(lead) || "" : "";
    const rendered = renderOutreachTemplate(selectedTemplate, { lead, tenant, senderName, unsubscribeUrl });
    items.push({
      leadId: lead.id,
      campaignId,
      templateId: selectedTemplate.id,
      tenantId: lead.tenantId || tenant.id || selectedTemplate.tenantId || "",
      status: status === "approved" ? "approved" : "queued",
      subject: rendered.subject,
      body: rendered.body,
      recipientEmail: normalizeEmail(lead.email),
      senderEmail: normalizeEmail(senderEmail),
      scheduledFor: scheduledFor || new Date().toISOString()
    });
  }

  return { items, skipped };
}

export function isAlreadyContacted(lead = {}) {
  return Boolean(lead.lastContactedAt) || ["contacted", "replied", "booked", "closed"].includes(lead.outreachStatus);
}

export function canSendQueueItem({ item, queue = [], campaign = {}, suppressions = [], now = new Date() } = {}) {
  if (!item?.recipientEmail) return { ok: false, reason: "missing_recipient_email" };
  if (!item?.senderEmail) return { ok: false, reason: "missing_sender_email" };
  if (!["approved", "queued"].includes(item.status)) return { ok: false, reason: `status_${item.status || "unknown"}` };

  const suppression = findSuppression(
    {
      email: item.recipientEmail,
      domain: recipientDomain(item.recipientEmail),
      tenantId: item.tenantId
    },
    suppressions
  );
  if (suppression) return { ok: false, reason: "suppressed", suppression };

  const dailyCap = Number(campaign.dailySendCap || 0);
  const perDomainCap = Number(campaign.perDomainDailyCap || 0);
  const dayKey = toDayKey(now);
  const sentToday = queue.filter((candidate) => {
    if (candidate.tenantId !== item.tenantId || candidate.status !== "sent" || !candidate.sentAt) return false;
    if (item.campaignId && candidate.campaignId !== item.campaignId) return false;
    return toDayKey(candidate.sentAt) === dayKey;
  });

  if (dailyCap > 0 && sentToday.length >= dailyCap) {
    return { ok: false, reason: "daily_cap_reached", dailyCap };
  }

  const targetDomain = recipientDomain(item.recipientEmail);
  const sentToDomainToday = sentToday.filter((candidate) => recipientDomain(candidate.recipientEmail) === targetDomain);
  if (perDomainCap > 0 && sentToDomainToday.length >= perDomainCap) {
    return { ok: false, reason: "per_domain_daily_cap_reached", perDomainDailyCap: perDomainCap };
  }

  return { ok: true, reason: "" };
}

export function suggestFollowUpDate(from = new Date(), businessDays = 3) {
  const date = new Date(from);
  let added = 0;
  while (added < businessDays) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date.toISOString().slice(0, 10);
}

export function buildOutreachMetrics({ queue = [], events = [], leads = [] } = {}) {
  const byStatus = Object.fromEntries(outreachQueueStatuses.map((status) => [status, 0]));
  for (const item of queue) {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
  }

  const sent = byStatus.sent || 0;
  const replied = byStatus.replied || events.filter((event) => event.type === "replied").length;
  const booked = byStatus.booked || events.filter((event) => event.type === "booked").length;

  return {
    totalQueued: byStatus.queued || 0,
    totalApproved: byStatus.approved || 0,
    totalSent: sent,
    totalFailed: byStatus.failed || 0,
    totalSuppressedSkipped: (byStatus.suppressed || 0) + (byStatus.skipped || 0),
    totalReplied: replied,
    totalBooked: booked,
    replyRate: sent ? Math.round((replied / sent) * 1000) / 10 : 0,
    bookedRate: sent ? Math.round((booked / sent) * 1000) / 10 : 0,
    sentBySource: countSentBy(queue, leads, "sourceType"),
    sentByCity: countSentBy(queue, leads, "city"),
    sentByCategory: countSentBy(queue, leads, "category"),
    byStatus
  };
}

function countSentBy(queue, leads, key) {
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
  return queue
    .filter((item) => item.status === "sent")
    .reduce((counts, item) => {
      const lead = leadsById.get(item.leadId) || {};
      const value = lead[key] || "unknown";
      counts[value] = (counts[value] || 0) + 1;
      return counts;
    }, {});
}

function toDayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
