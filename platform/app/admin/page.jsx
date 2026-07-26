import { redirect } from "next/navigation";
import { AdminTabbedShell, AdminTabPanel } from "../../components/admin/AdminTabbedShell";
import LeadDeepResearch from "../../components/admin/LeadDeepResearch";
import FillMissingButton from "../../components/admin/FillMissingButton";
import { missingFields } from "../../lib/leadResearch/leadFields";
import ResearchFromQuery from "../../components/admin/ResearchFromQuery";
import LeadCallPanel from "../../components/admin/LeadCallPanel";
// Off-default-tab panels are code-split (ssr:false) via a client wrapper so
// their JS loads only when the tab is opened — see components/admin/lazyPanels.
import {
  OutreachQueueBuilder,
  TenantBuilder,
  TenantEditor,
  AccountsPanel,
  TenantPhoneSettings,
  TenantBrandingSettings,
  CallsTable,
} from "../../components/admin/lazyPanels";
import { buildCallMetrics, formatTalkTime } from "../../lib/telephony/metrics";
import { getAdminSession } from "../../lib/auth";
import { listAuditLogs } from "../../lib/audit";
import {
  canDeleteCalls,
  canManageContractors,
  canManageLeads,
  canManageTenants,
  canManageUsers,
  canViewDashboard
} from "../../lib/permissions";
import {
  listContractors,
  listDraftEmails,
  listLeads,
  listOutreachCampaigns,
  listOutreachEvents,
  listOutreachQueue,
  listOutreachSuppressions,
  listOutreachTemplates,
  listProspectingBatches,
  listTenants,
  getSessionTeamId,
  getCalls,
  listTasks,
  listTargetAccounts,
  listAccountCampaigns
} from "../../lib/store";
import {
  enrichmentStatuses,
  filterAndSortLeads,
  leadSources,
  outreachStatuses,
  pipelineStatuses
} from "../../lib/leadUtils";
import {
  buildOutreachMetrics,
  campaignStatuses,
  outreachQueueStatuses,
  renderOutreachTemplate,
  suppressionReasons,
  suggestFollowUpDate
} from "../../lib/outreachSequence";
import { listTeamUsers, USER_ROLES } from "../../lib/users";
import {
  buildFundingOpportunityDashboard,
  fundingScanFromLead,
  isFundingScanLead,
  scoreFundingLead
} from "../../lib/funding/admin";
import { matchFundingPrograms } from "../../lib/funding/matching";
import { FUNDING_REVIEW_ITEMS, buildReviewState } from "../../lib/funding/review";
import { buildCloserHandoff } from "../../lib/funding/handoff";

export const dynamic = "force-dynamic";

const statuses = [
  "new",
  "researched",
  "drafted",
  "approved",
  "sent_external",
  "replied",
  "booked",
  "won",
  "lost",
  "do_not_contact"
];

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatPlatformLabel(platform) {
  switch (platform) {
    case "linkedin":
      return "LinkedIn";
    case "x":
      return "X";
    case "youtube":
      return "YouTube";
    case "tiktok":
      return "TikTok";
    default:
      return platform ? `${platform[0].toUpperCase()}${platform.slice(1)}` : "";
  }
}

function formatEnrichmentDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatSignal(signal) {
  if (!signal || typeof signal !== "object") return "";

  if (signal.type === "schema_org" && signal.schemaType) {
    return `${signal.schemaType} schema`;
  }

  if (signal.type === "priority_page" && signal.category) {
    return `${signal.category} page`;
  }

  if (signal.type === "social_profile" && signal.platform) {
    return `${signal.platform} profile`;
  }

  return typeof signal.type === "string" ? signal.type.replaceAll("_", " ") : "";
}

function getLeadEnrichmentSummary(lead) {
  const enrichment = lead?.metadata?.enrichment;
  if (!enrichment || typeof enrichment !== "object") return null;
  const salesBrief =
    enrichment.salesIntelligence && typeof enrichment.salesIntelligence === "object"
      ? enrichment.salesIntelligence
      : null;

  const contacts = asArray(enrichment.contacts);
  const emails = uniqueValues(
    contacts.filter((contact) => contact?.type === "email").map((contact) => contact?.value)
  ).slice(0, 4);
  const phones = uniqueValues(
    contacts.filter((contact) => contact?.type === "phone").map((contact) => contact?.value)
  ).slice(0, 4);

  const socialProfiles = Object.entries(enrichment.socialProfiles || {}).flatMap(([platform, urls]) => {
    const values = asArray(urls);
    if (!values.length) return [];
    return values
      .map((profile) => {
        if (typeof profile === "string") {
          return {
            key: `${platform}:${profile}`,
            label: `${formatPlatformLabel(platform)} ${profile}`,
            href: profile
          };
        }

        if (!profile?.url) return null;
        return {
          key: `${platform}:${profile.url}`,
          label: `${formatPlatformLabel(platform)} ${profile.handle || profile.url}`,
          href: profile.url
        };
      })
      .filter(Boolean);
  });

  const headings = uniqueValues([
    ...asArray(enrichment.website?.headings?.h2),
    ...asArray(enrichment.website?.headings?.h3),
    ...asArray(enrichment.website?.headings?.h1)
  ]).slice(0, 4);

  const signals = uniqueValues(
    asArray(enrichment.signals)
      .map(formatSignal)
      .filter(Boolean)
  ).slice(0, 5);

  return {
    status: enrichment.status || "unknown",
    title: enrichment.website?.title || "",
    lastEnrichedAt: formatEnrichmentDate(enrichment.lastEnrichedAt),
    socialProfiles: uniqueValues(socialProfiles),
    emails,
    phones,
    headings,
    signals,
    salesBrief: salesBrief
      ? {
          summary: salesBrief.summary || "",
          suggestedOffer: salesBrief.suggestedOffer || "",
          callerOpeningLine: salesBrief.callerOpeningLine || "",
          outreachAngles: uniqueValues(asArray(salesBrief.outreachAngles)).slice(0, 3),
          fitScore: Number.isFinite(Number(salesBrief.fitScore)) ? Number(salesBrief.fitScore) : null,
          confidenceScore:
            Number.isFinite(Number(salesBrief.confidenceScore)) ? Number(salesBrief.confidenceScore) : null
        }
      : null
  };
}

function renderEnrichmentGroup(label, values) {
  if (!values.length) return null;

  return (
    <div className="lead-enrichment__group" key={label}>
      <strong>{label}</strong>
      <div className="lead-enrichment__values">
        {values.map((value) => (
          typeof value === "string" ? (
            <span className="lead-enrichment__pill" key={value}>{value}</span>
          ) : value?.href ? (
            <a
              className="lead-enrichment__pill"
              href={value.href}
              key={value.key || value.href}
              rel="noreferrer"
              target="_blank"
            >
              {value.label}
            </a>
          ) : (
            <span className="lead-enrichment__pill" key={value?.key || value?.label}>{value?.label}</span>
          )
        ))}
      </div>
    </div>
  );
}

export default async function AdminPage({ searchParams }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canViewDashboard(session)) redirect("/admin/login");
  const params = await searchParams;
  const notice = params?.notice;
  const canManageLeadActions = canManageLeads(session);
  const canDeleteCallRecords = canDeleteCalls(session);
  const canManageTenantActions = canManageTenants(session);
  const canManageContractorActions = canManageContractors(session);
  const teamId = getSessionTeamId(session);
  const canManageTeamUsers = canManageUsers(session) && Boolean(teamId);
  const visibleTabs = [
    ...(session.role === "contractor" ? [] : ["pipeline"]),
    ...(canManageLeadActions ? ["funding", "prospecting", "accounts", "outreach", "calls"] : []),
    ...(canManageTenantActions ? ["tenants"] : []),
    ...(canManageTeamUsers || canManageContractorActions || session.role === "contractor" ? ["team"] : [])
  ];

  const [
    tenants,
    leads,
    contractors,
    drafts,
    batches,
    outreachTemplates,
    outreachCampaigns,
    outreachQueue,
    outreachSuppressions,
    outreachEvents,
    calls,
    tasks,
    teamUsers,
    auditLogs,
    targetAccounts,
    accountCampaigns
  ] = await Promise.all([
    listTenants({ teamId }),
    listLeads({ teamId }),
    listContractors({ teamId }),
    listDraftEmails({ teamId }),
    listProspectingBatches({ teamId }),
    listOutreachTemplates({ teamId }),
    listOutreachCampaigns({ teamId }),
    listOutreachQueue({ teamId }),
    listOutreachSuppressions({ teamId }),
    listOutreachEvents({ teamId }),
    getCalls({ teamId }),
    listTasks({ teamId, status: "open" }),
    canManageTeamUsers ? listTeamUsers(teamId) : Promise.resolve([]),
    canManageTeamUsers ? listAuditLogs({ teamId, limit: 75 }) : Promise.resolve([]),
    canManageLeadActions ? listTargetAccounts({ teamId }) : Promise.resolve([]),
    canManageLeadActions ? listAccountCampaigns({ teamId }) : Promise.resolve([])
  ]);

  const leadFilters = {
    query: params?.q || "",
    city: params?.city || "",
    category: params?.category || "",
    source: params?.source || "",
    enrichmentStatus: params?.enrichmentStatus || "",
    outreachStatus: params?.outreachStatus || "",
    pipelineStatus: params?.pipelineStatus || "",
    sort: params?.sort || "created_desc"
  };
  const filteredLeads = filterAndSortLeads(leads, leadFilters);
  const selectedBatch = batches.find((batch) => batch.id === params?.batchId) || batches[0];
  const exportQuery = new URLSearchParams(
    Object.fromEntries(Object.entries(leadFilters).filter(([, value]) => value))
  ).toString();

  const leadCounts = pipelineStatuses.map((status) => ({
    status,
    count: leads.filter((lead) => lead.pipelineStatus === status).length
  }));
  const cities = uniqueOptions(leads.map((lead) => lead.city));
  const categories = uniqueOptions(leads.map((lead) => lead.category));
  const outreachMetrics = buildOutreachMetrics({ queue: outreachQueue, events: outreachEvents, leads });
  const activeTemplates = outreachTemplates.filter((template) => template.isActive !== false);
  const defaultTemplate = activeTemplates[0];
  const defaultTenant = tenants[0] || {};
  const sampleLead = filteredLeads[0] || leads[0] || {};
  const templatePreview = defaultTemplate
    ? renderOutreachTemplate(defaultTemplate, { lead: sampleLead, tenant: defaultTenant, senderName: "DGTL" })
    : null;
  const queueByLead = groupBy(outreachQueue, "leadId");
  const eventsByLead = groupBy(outreachEvents, "leadId");
  const callsByLead = groupBy(calls, "leadId");
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
  const callbackTasks = (tasks || []).filter((task) => task.priority === "urgent");
  const usersById = new Map((teamUsers || []).map((user) => [user.id, user]));
  const callMetrics = buildCallMetrics(calls);
  const dialTenants = tenants
    .filter((tenant) => tenant?.telephony?.enabled && tenant?.telephony?.phoneNumber)
    .map((tenant) => ({
      id: tenant.id,
      name: tenant.name || tenant.slug || tenant.id,
      phoneNumber: tenant.telephony.phoneNumber
    }));
  const callsView = calls.map((call) => {
    const lead = leadsById.get(call.leadId);
    return {
      ...call,
      businessName: lead?.businessName || lead?.business || "",
      leadPhone: lead?.phone || call.toNumber || call.fromNumber || "",
      repName: usersById.get(call.assignedUserId)?.name || ""
    };
  });
  const dueFollowUps = leads.filter((lead) => {
    if (!lead.nextFollowUpAt) return false;
    return new Date(lead.nextFollowUpAt).getTime() <= Date.now();
  });
  const fundingScanLeads = leads
    .filter(isFundingScanLead)
    .map((lead) => ({
      lead,
      scan: fundingScanFromLead(lead),
      score: scoreFundingLead(lead),
      opportunityMatches: matchFundingPrograms(fundingScanFromLead(lead)).topMatches.slice(0, 3),
      review: buildReviewState(lead),
      handoff: buildCloserHandoff(lead),
      survey: (lead.sourceMetadata || lead.metadata || {}).fundingSurvey || null
    }));
  const fundingTenant = tenants.find((tenant) => tenant.slug === "funded-growth") || tenants[0] || {};
  const fundingDashboard = buildFundingOpportunityDashboard({
    tenantId: fundingTenant.id,
    leads: fundingScanLeads.map(({ lead }) => lead)
  });

  return (
    <AdminTabbedShell
      notice={notice}
      visibleTabs={visibleTabs}
      navCounts={{
        pipeline: leads?.length || undefined,
        calls: callbackTasks?.length || undefined,
        tenants: tenants?.length || undefined,
        outreach: outreachQueue?.length || undefined
      }}
      user={{ name: session.user?.name, email: session.user?.email, role: session.role }}
    >
      <AdminTabPanel tabId="pipeline">
        <section className="admin-metrics v2-metrics-scroll" aria-label="Lead pipeline summary">
        {leadCounts.map((item) => (
          <article key={item.status} className="v2-metric-pill">
            <span className="v2-metric-count">{item.count}</span>
            <p className="v2-metric-label">{item.status.replaceAll("_", " ")}</p>
          </article>
        ))}
        </section>
      </AdminTabPanel>

      {canManageLeadActions && callbackTasks.length ? (
      <AdminTabPanel tabId="pipeline">
      <section className="admin-panel">
        <div className="pipeline-header">
          <div>
            <h2>Needs Callback</h2>
            <p>Urgent missed-call follow-ups. Call the lead back, then mark an outcome.</p>
          </div>
          <span className="status-pill">{callbackTasks.length}</span>
        </div>
        <div className="outreach-list">
          {callbackTasks.map((task) => {
            const lead = leadsById.get(task.leadId);
            return (
              <div key={task.id} className="outreach-list-row">
                <strong>{task.title}</strong>
                <span>
                  {lead?.phone || "no phone"}
                  {task.dueAt ? ` | due ${new Date(task.dueAt).toLocaleDateString()}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </section>
      </AdminTabPanel>
      ) : null}

      {canManageLeadActions ? (
      <AdminTabPanel tabId="calls">
        <section className="admin-metrics v2-metrics-scroll" aria-label="Call summary">
          {[
            { label: "total calls", value: callMetrics.total },
            { label: "inbound", value: callMetrics.inbound },
            { label: "outbound", value: callMetrics.outbound },
            { label: "completed", value: callMetrics.completed },
            { label: "missed", value: callMetrics.missed },
            { label: "talk time", value: formatTalkTime(callMetrics.totalTalkTimeSeconds) }
          ].map((item) => (
            <article key={item.label} className="v2-metric-pill">
              <span className="v2-metric-count">{item.value}</span>
              <p className="v2-metric-label">{item.label}</p>
            </article>
          ))}
        </section>

        {callbackTasks.length ? (
          <section className="admin-panel">
            <div className="pipeline-header">
              <div>
                <h2>Needs Callback</h2>
                <p>Urgent missed-call follow-ups. Call the lead back, then mark an outcome.</p>
              </div>
              <span className="status-pill">{callbackTasks.length}</span>
            </div>
            <div className="outreach-list">
              {callbackTasks.map((task) => {
                const lead = leadsById.get(task.leadId);
                return (
                  <div key={task.id} className="outreach-list-row">
                    <strong>{task.title}</strong>
                    <span>
                      {lead?.phone || "no phone"}
                      {task.dueAt ? ` | due ${new Date(task.dueAt).toLocaleDateString()}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="admin-panel admin-panel--wide">
          <div className="pipeline-header">
            <div>
              <h2>Call Log</h2>
              <p>Every inbound and outbound call across your team. Filter and set outcomes inline.</p>
            </div>
            <span className="status-pill">{calls.length} calls</span>
          </div>
          <CallsTable calls={callsView} canDelete={canDeleteCallRecords} dialTenants={dialTenants} />
        </section>
      </AdminTabPanel>
      ) : null}

      <AdminTabPanel tabId="pipeline">
      <section className="admin-panel admin-panel--wide">
        <div className="pipeline-header">
          <div>
            <h2>Funding Scan Leads</h2>
            <p>Review funding scan submissions, potential fit, recommended next step, and draft follow-up emails. Human review required.</p>
          </div>
          <span className="status-pill">{fundingScanLeads.length} scans</span>
        </div>

        <div className="funding-lead-list">
          {fundingScanLeads.map(({ lead, scan, score, opportunityMatches, review, handoff, survey }) => (
            <article className="funding-lead-card" key={lead.id}>
              <div className="funding-lead-card__header">
                <div>
                  <h3>{lead.businessName || lead.business || "Unknown business"}</h3>
                  {lead.websiteUrl || scan.companyWebsite ? (
                    <a href={lead.websiteUrl || scan.companyWebsite} target="_blank" rel="noreferrer">
                      {lead.websiteUrl || scan.companyWebsite}
                    </a>
                  ) : (
                    <span className="muted-text">No website</span>
                  )}
                </div>
                <span className={`status-pill status-pill--${lead.pipelineStatus}`}>{lead.pipelineStatus}</span>
              </div>

              <details className="funding-review" open>
                <summary className="funding-review__header">
                  <strong>Human review checklist</strong>
                  <span className={`status-pill status-pill--${review.isComplete ? "ok" : "warn"}`}>
                    {review.isComplete ? "Review complete" : "Requires human review"}
                  </span>
                </summary>
                {canManageLeadActions ? (
                  <form action="/api/admin/funding/review" method="post" className="funding-review__form">
                    <input type="hidden" name="leadId" value={lead.id} />
                    <input type="hidden" name="redirectTo" value="/admin" />
                    {FUNDING_REVIEW_ITEMS.map((item) => (
                      <label key={item.id} className="funding-review__item">
                        <input
                          type="checkbox"
                          name="items"
                          value={item.id}
                          defaultChecked={review.items[item.id]}
                        />
                        <span>
                          {item.label}
                          {item.required ? <em> (required)</em> : null}
                        </span>
                      </label>
                    ))}
                    <input
                      className="input"
                      type="text"
                      name="reviewer"
                      placeholder="Reviewer name"
                      defaultValue={review.reviewer}
                    />
                    <button className="button button--secondary" type="submit">Save review</button>
                    {review.updatedAt ? (
                      <p className="funding-review__meta">
                        Last reviewed by {review.reviewer || "unknown"} on {review.updatedAt.slice(0, 10)}
                      </p>
                    ) : null}
                  </form>
                ) : (
                  <p>Reviewer access required to update the checklist.</p>
                )}
              </details>

              <dl className="funding-lead-stats">
                <div>
                  <dt>Potential fit</dt>
                  <dd>{score.overallFit}</dd>
                </div>
                <div>
                  <dt>Potential lane</dt>
                  <dd>{score.bestFundingLaneLabel}</dd>
                </div>
                <div>
                  <dt>Recommended next step</dt>
                  <dd>{score.recommendedOffer}</dd>
                </div>
              </dl>

              <div className="funding-gap-list">
                <strong>Human review required</strong>
                <p>This is a potential fit only. Do not confirm eligibility, funding amount, or approval without reviewing the specific funder or program administrator rules.</p>
                <strong>
                  {opportunityMatches[0]?.match?.label === "Potential fit"
                    ? "Potential opportunity categories"
                    : "Funding lanes to investigate — not enough information to estimate yet"}
                </strong>
                <ul>
                  {opportunityMatches.map((match) => (
                    <li key={match.id}>
                      <strong>Potential opportunity category: {match.name}</strong>
                      <span> Why it may match: {match.match.whyItMayMatch}</span>
                    </li>
                  ))}
                </ul>
                <strong>Readiness gaps</strong>
                {score.eligibilityGaps.length ? (
                  <ul>
                    {score.eligibilityGaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No immediate gaps from the scan inputs.</p>
                )}
              </div>

              <div className="funding-gap-list">
                <strong>Potential program matches</strong>
                {score.programMatches?.length ? (
                  <ul>
                    {score.programMatches.map((match) => (
                      <li key={match.program.id}>
                        {match.program.name} ({match.matchScore}, {match.confidence})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No program matches from the current scan inputs.</p>
                )}
              </div>

              {survey?.result ? (
                <div className="funding-gap-list funding-survey-result">
                  <strong>Funding survey result — {survey.result.overallFit.replaceAll("_", " ")}</strong>
                  {survey.result.estimatedFundingRange ? (
                    <p>Estimated range: {survey.result.estimatedFundingRange.label}</p>
                  ) : null}
                  {survey.result.topProgramMatches?.length ? (
                    <ul>
                      {survey.result.topProgramMatches.map((match) => (
                        <li key={match.programId}>
                          <strong>{match.name}</strong> ({match.confidence})
                          {match.estimatedRange?.label ? ` — ${match.estimatedRange.label}` : ""}
                          {match.recommendedNextStep ? <span> · Next: {match.recommendedNextStep}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No program matches for the identified jurisdiction; confirm location and project details.</p>
                  )}
                  <p>
                    Completed {survey.completedAt ? survey.completedAt.slice(0, 10) : "—"} · jurisdiction{" "}
                    {survey.normalizedInput?.country || "unknown"}
                    {survey.normalizedInput?.province ? `/${survey.normalizedInput.province}` : ""}
                  </p>
                </div>
              ) : null}

              <details className="funding-handoff">
                <summary>Closer handoff summary{handoff.reviewIncomplete ? " (review incomplete)" : ""}</summary>
                <div className="funding-handoff__body">
                  <p><strong>{handoff.business}</strong>{handoff.location ? ` — ${handoff.location}` : ""}</p>
                  <p>Best lane: {handoff.topLane} (fit {handoff.overallFit})</p>
                  {handoff.topProgram ? (
                    <p>Top program: {handoff.topProgram.name} — {handoff.topProgram.provider} ({handoff.topProgram.matchScore}, {handoff.topProgram.confidence})</p>
                  ) : null}
                  <p>Recommended offer: {handoff.recommendedOffer}</p>
                  <p>Next step: {handoff.nextStep}</p>
                  {handoff.fitReasons.length ? (
                    <div>
                      <strong>Why it may fit</strong>
                      <ul>{handoff.fitReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                    </div>
                  ) : null}
                  {handoff.gaps.length ? (
                    <div>
                      <strong>Open gaps</strong>
                      <ul>{handoff.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
                    </div>
                  ) : null}
                  <p className="funding-handoff__meta">
                    Review status: {handoff.reviewStatus}. Human review required — not a funding or eligibility guarantee.
                  </p>
                </div>
              </details>

              {canManageLeadActions ? (
                <form action="/api/admin/drafts" method="post" className="inline-form">
                  <input type="hidden" name="leadId" value={lead.id} />
                  <input type="hidden" name="tenantId" value={lead.tenantId || tenants[0]?.id} />
                  <input type="hidden" name="packageId" value={lead.packageId || "funding-fit-scan"} />
                  <button className="button button--secondary" type="submit">Draft Funding Follow-Up</button>
                </form>
              ) : null}
            </article>
          ))}
          {!fundingScanLeads.length ? <p>No funding scan leads yet.</p> : null}
        </div>
      </section>
      </AdminTabPanel>

      {canManageLeadActions ? (
      <AdminTabPanel tabId="funding">
      <section className="admin-panel admin-panel--wide">
        <div className="pipeline-header">
          <div>
            <h2>Funding Opportunities</h2>
            <p>Manual opportunity intelligence for grants, digital adoption programs, export funding, and funded-contract angles. Human review required before any client-facing claim.</p>
          </div>
          <span className="status-pill">{fundingDashboard.length} opportunities</span>
        </div>

        <div className="funding-opportunity-grid">
          {fundingDashboard.map(({ program, leadMatches, proposalChecklist }) => (
            <article className="funding-opportunity-card" key={program.id}>
              <div className="funding-lead-card__header">
                <div>
                  <p className="eyebrow">{program.fundingType}</p>
                  <h3>{program.name}</h3>
                  <p>{program.provider} | {program.statusLabel}</p>
                </div>
                <span className="status-pill">{program.intakeStatus.replaceAll("_", " ")}</span>
              </div>

              <p>{program.fitNotes}</p>
              <dl className="funding-lead-stats">
                <div>
                  <dt>Targets</dt>
                  <dd>{program.targetBusinessLabels?.slice(0, 2).join(", ") || "Business fit review"}</dd>
                </div>
                <div>
                  <dt>Projects</dt>
                  <dd>{program.projectTypes?.slice(0, 2).join(", ")}</dd>
                </div>
                <div>
                  <dt>Lead Matches</dt>
                  <dd>{leadMatches.length}</dd>
                </div>
              </dl>

              <div className="funding-gap-list">
                <strong>Top matched leads</strong>
                {leadMatches.length ? (
                  <ul>
                    {leadMatches.map(({ lead, matchScore, confidence, outreachAngle }) => (
                      <li key={lead.id}>
                        {lead.businessName || lead.business || "Unknown business"} ({matchScore}, {confidence}) - {outreachAngle.serviceAngle}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No lead matches above the current threshold.</p>
                )}
              </div>

              <div className="funding-gap-list">
                <strong>Proposal support checklist</strong>
                <ul>
                  {proposalChecklist.slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <a className="button button--secondary" href={program.sourceUrl} target="_blank" rel="noreferrer">
                Review Source
              </a>
            </article>
          ))}
          {!fundingDashboard.length ? <p>No funding opportunities configured yet.</p> : null}
        </div>
      </section>
      </AdminTabPanel>
      ) : null}

      {canManageLeadActions ? (
      <AdminTabPanel tabId="prospecting">
      <ResearchFromQuery />
      <section className="admin-panel">
        <h2>Prospecting Batch Builder</h2>
        <p>Create a search batch, preview Google Places results, then import selected prospects into the pipeline.</p>

        <div className="batch-builder">
          <form action="/api/admin/prospecting/batches" method="post" className="admin-form batch-builder__form">
            <label>
              Tenant
              <select name="tenantId" defaultValue={tenants[0]?.id}>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.brand.name}</option>
                ))}
              </select>
            </label>
            <label>
              Batch Name
              <input name="name" placeholder="Toronto med spas - June batch" required />
            </label>
            <label>
              Search Query
              <input name="query" placeholder="med spas in Toronto" />
            </label>
            <label>
              Category
              <input name="category" placeholder="med spas" />
            </label>
            <label>
              City / Location
              <input name="city" placeholder="Toronto" />
            </label>
            <label>
              Max Results
              <input name="maxResults" type="number" min="1" max="20" defaultValue="20" />
            </label>
            <label className="admin-check">
              <input name="enrichHunter" type="checkbox" />
              Enrich domains with Hunter when available
            </label>
            <label className="admin-check">
              <input name="enrichApollo" type="checkbox" />
              Find Apollo decision-maker profiles when available
            </label>
            <button className="button button--primary" type="submit">Create Preview Batch</button>
          </form>

          <div className="batch-history">
            <h3>Recent Batches</h3>
            <div className="admin-list">
              {batches.map((batch) => (
                <a key={batch.id} href={`/admin?batchId=${batch.id}`}>
                  <strong>{batch.name}</strong>
                  <span>
                    {batch.status} | found {batch.counts.found || 0} | imported {batch.counts.imported || 0} | skipped {batch.counts.skippedDuplicates || 0}
                  </span>
                </a>
              ))}
              {!batches.length ? <p>No batches yet.</p> : null}
            </div>
          </div>
        </div>

        {selectedBatch ? (
          <div className="batch-preview">
            <div className="batch-preview__header">
              <div>
                <h3>{selectedBatch.name}</h3>
                <p>{selectedBatch.query} | {selectedBatch.status}</p>
              </div>
              <span>{selectedBatch.previewResults.length} preview results</span>
            </div>
            {selectedBatch.error ? <p className="admin-error">{selectedBatch.error}</p> : null}
            <form action="/api/admin/prospecting/batches/import" method="post">
              <input type="hidden" name="batchId" value={selectedBatch.id} />
              <div className="preview-grid">
                {selectedBatch.previewResults.map((prospect, index) => (
                  <label key={`${prospect.googlePlaceId || prospect.businessName}-${index}`} className="preview-card">
                    <input type="checkbox" name="selected" value={index} defaultChecked />
                    <strong>{prospect.businessName || prospect.business}</strong>
                    <span>{prospect.category || "No category"} | {prospect.city || selectedBatch.city || "No city"}</span>
                    <small>{prospect.website || prospect.url || prospect.phone || "No website or phone"}</small>
                  </label>
                ))}
                {!selectedBatch.previewResults.length ? <p>No preview results yet.</p> : null}
              </div>
              {selectedBatch.previewResults.length ? (
                <button className="button button--primary" type="submit">Import Selected Prospects</button>
              ) : null}
            </form>
          </div>
        ) : null}
      </section>
      </AdminTabPanel>
      ) : null}

      {canManageLeadActions ? (
      <AdminTabPanel tabId="accounts">
        <AccountsPanel accounts={targetAccounts} campaigns={accountCampaigns} />
      </AdminTabPanel>
      ) : null}

      {canManageLeadActions ? (
      <AdminTabPanel tabId="outreach">
      <section className="admin-panel">
        <div className="pipeline-header">
          <div>
            <h2>Outreach Sequence V1</h2>
            <p>Queue approved B2B outreach, send selected messages through Resend, and track suppression, replies, bookings, and follow-ups.</p>
          </div>
          <span className="status-pill">{outreachQueue.length} queue items</span>
        </div>

        <div className="outreach-metrics">
          <article><span>{outreachMetrics.totalQueued}</span><p>Queued</p></article>
          <article><span>{outreachMetrics.totalApproved}</span><p>Approved</p></article>
          <article><span>{outreachMetrics.totalSent}</span><p>Sent</p></article>
          <article><span>{outreachMetrics.totalFailed}</span><p>Failed</p></article>
          <article><span>{outreachMetrics.totalSuppressedSkipped}</span><p>Suppressed / skipped</p></article>
          <article><span>{outreachMetrics.replyRate}%</span><p>Reply rate</p></article>
          <article><span>{outreachMetrics.bookedRate}%</span><p>Booked-call rate</p></article>
        </div>

        <div className="outreach-admin-grid">
          <section className="outreach-card">
            <h3>Template Library</h3>
            <form action="/api/admin/outreach/templates" method="post" className="admin-form">
              <input type="hidden" name="action" value="create" />
              <label>
                Tenant
                <select name="tenantId" defaultValue={tenants[0]?.id}>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>{tenant.brand.name}</option>
                  ))}
                </select>
              </label>
              <input name="name" placeholder="Intro for med spas" required />
              <input name="category" placeholder="Optional category" />
              <input name="offerType" placeholder="Optional offer type" />
              <input name="subject" placeholder="Subject with {{businessName}}" required />
              <textarea name="body" rows="7" placeholder="Body with {{contactName}}, {{city}}, {{recommendedOffer}}" required />
              <button className="button button--primary" type="submit">Create Template</button>
            </form>
            <div className="outreach-list">
              {outreachTemplates.map((template) => (
                <details key={template.id} className="outreach-list-item">
                  <summary>
                    <strong>{template.name}</strong>
                    <span>{template.isActive === false ? "inactive" : template.system ? "starter" : "active"}</span>
                  </summary>
                  <pre>{renderOutreachTemplate(template, { lead: sampleLead, tenant: defaultTenant, senderName: "DGTL" }).body}</pre>
                  {!template.system ? (
                    <form action="/api/admin/outreach/templates" method="post" className="admin-form">
                      <input type="hidden" name="templateId" value={template.id} />
                      <input type="hidden" name="action" value="update" />
                      <input name="name" defaultValue={template.name} required />
                      <input name="category" defaultValue={template.category} />
                      <input name="offerType" defaultValue={template.offerType} />
                      <input name="subject" defaultValue={template.subject} required />
                      <textarea name="body" rows="6" defaultValue={template.body} required />
                      <label className="admin-check">
                        <input name="isActive" type="checkbox" defaultChecked={template.isActive !== false} />
                        Active
                      </label>
                      <button className="button button--secondary" type="submit">Save Template</button>
                    </form>
                  ) : null}
                  {!template.system && template.isActive !== false ? (
                    <form action="/api/admin/outreach/templates" method="post" className="inline-form">
                      <input type="hidden" name="templateId" value={template.id} />
                      <input type="hidden" name="action" value="deactivate" />
                      <button className="button button--secondary" type="submit">Deactivate</button>
                    </form>
                  ) : null}
                </details>
              ))}
            </div>
          </section>

          <section className="outreach-card">
            <h3>Campaigns</h3>
            <form action="/api/admin/outreach/campaigns" method="post" className="admin-form">
              <input type="hidden" name="action" value="create" />
              <label>
                Tenant
                <select name="tenantId" defaultValue={tenants[0]?.id}>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>{tenant.brand.name}</option>
                  ))}
                </select>
              </label>
              <input name="name" placeholder="Toronto med spa outreach" required />
              <textarea name="description" rows="3" placeholder="Campaign notes" />
              <select name="status" defaultValue="draft">
                {campaignStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <input name="sourceFilter" placeholder="Optional source filter" />
              <input name="cityFilter" placeholder="Optional city filter" />
              <input name="categoryFilter" placeholder="Optional category filter" />
              <input name="dailySendCap" type="number" min="1" defaultValue="25" />
              <input name="perDomainDailyCap" type="number" min="1" defaultValue="1" />
              <label>
                Follow-up template (drip)
                <select name="followUpTemplateId" defaultValue="">
                  <option value="">No automatic follow-up</option>
                  {outreachTemplates.filter((t) => t.isActive !== false).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Follow-up delay (business days)
                <input name="followUpDelayDays" type="number" min="1" defaultValue="3" />
              </label>
              <label className="admin-check">
                <input name="testMode" type="checkbox" />
                Test mode (dry-run — records sent without emailing)
              </label>
              <button className="button button--primary" type="submit">Create Campaign</button>
            </form>
            <div className="outreach-list">
              {outreachCampaigns.map((campaign) => (
                <details key={campaign.id} className="outreach-list-item">
                  <summary>
                    <strong>{campaign.name}</strong>
                    <span>{campaign.status} | {campaign.dailySendCap}/day | {campaign.perDomainDailyCap}/domain</span>
                  </summary>
                  <form action="/api/admin/outreach/campaigns" method="post" className="admin-form">
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <input type="hidden" name="action" value="update" />
                    <input name="name" defaultValue={campaign.name} required />
                    <textarea name="description" rows="3" defaultValue={campaign.description} />
                    <select name="status" defaultValue={campaign.status}>
                      {campaignStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <input name="sourceFilter" defaultValue={campaign.sourceFilter} />
                    <input name="cityFilter" defaultValue={campaign.cityFilter} />
                    <input name="categoryFilter" defaultValue={campaign.categoryFilter} />
                    <input name="dailySendCap" type="number" min="1" defaultValue={campaign.dailySendCap} />
                    <input name="perDomainDailyCap" type="number" min="1" defaultValue={campaign.perDomainDailyCap} />
                    <label>
                      Follow-up template (drip)
                      <select name="followUpTemplateId" defaultValue={campaign.followUpTemplateId || ""}>
                        <option value="">No automatic follow-up</option>
                        {outreachTemplates.filter((t) => t.isActive !== false).map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Follow-up delay (business days)
                      <input name="followUpDelayDays" type="number" min="1" defaultValue={campaign.followUpDelayDays || 3} />
                    </label>
                    <label className="admin-check">
                      <input name="testMode" type="checkbox" defaultChecked={Boolean(campaign.testMode)} />
                      Test mode (dry-run)
                    </label>
                    <button className="button button--secondary" type="submit">Save Campaign</button>
                  </form>
                </details>
              ))}
              {!outreachCampaigns.length ? <p>No campaigns yet.</p> : null}
            </div>
          </section>
        </div>

        <section className="outreach-card outreach-card--wide">
          <div className="pipeline-header">
            <div>
              <h3>Queue Builder</h3>
              <p>Using the current lead filters: {filteredLeads.length} visible leads.</p>
            </div>
            {templatePreview ? <span className="status-pill">Preview: {templatePreview.subject}</span> : null}
          </div>
          <OutreachQueueBuilder
            leads={filteredLeads}
            tenants={tenants}
            templates={outreachTemplates}
            campaigns={outreachCampaigns}
            suppressions={outreachSuppressions}
          />
        </section>

        <div className="outreach-admin-grid">
          <section className="outreach-card">
            <h3>Pending Approval</h3>
            <form action="/api/admin/outreach/queue/approve" method="post">
              <div className="outreach-list">
                {outreachQueue.filter((item) => item.status === "queued").slice(0, 200).map((item) => (
                  <label key={item.id} className="outreach-queue-row">
                    <input type="checkbox" name="queueItemId" value={item.id} defaultChecked />
                    <span>
                      <strong>{item.subject}</strong>
                      <small>{item.recipientEmail} | {item.scheduledFor ? new Date(item.scheduledFor).toLocaleString() : "No schedule"}</small>
                    </span>
                  </label>
                ))}
                {!outreachQueue.some((item) => item.status === "queued") ? <p>Nothing awaiting approval.</p> : null}
              </div>
              {outreachQueue.some((item) => item.status === "queued") ? (
                <button className="button button--primary" type="submit">Approve Selected</button>
              ) : null}
            </form>
          </section>

          <section className="outreach-card">
            <h3>Approved Queue</h3>
            <form action="/api/admin/outreach/queue/send" method="post">
              <div className="outreach-list">
                {outreachQueue.filter((item) => ["approved", "sending", "sent", "failed"].includes(item.status)).slice(0, 200).map((item) => (
                  <label key={item.id} className="outreach-queue-row">
                    <input
                      type="checkbox"
                      name="queueItemId"
                      value={item.id}
                      defaultChecked={item.status === "approved"}
                      disabled={item.status !== "approved"}
                    />
                    <span>
                      <strong>{item.subject}</strong>
                      <small>{item.recipientEmail} | {item.status} | {item.scheduledFor ? new Date(item.scheduledFor).toLocaleString() : "No schedule"}</small>
                      {item.failureReason ? <small>{item.failureReason}</small> : null}
                    </span>
                  </label>
                ))}
                {!outreachQueue.some((item) => ["approved", "sending", "sent", "failed"].includes(item.status)) ? <p>No approved outreach yet.</p> : null}
              </div>
              {outreachQueue.some((item) => item.status === "approved") ? (
                <button className="button button--primary" type="submit">Send Approved</button>
              ) : null}
            </form>
          </section>

          <section className="outreach-card">
            <h3>Suppression List</h3>
            <form action="/api/admin/outreach/suppressions" method="post" className="admin-form">
              <label>
                Tenant
                <select name="tenantId" defaultValue="">
                  <option value="">All tenants</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>{tenant.brand.name}</option>
                  ))}
                </select>
              </label>
              <input name="email" type="email" placeholder="email@example.com" />
              <input name="domain" placeholder="example.com" />
              <select name="reason" defaultValue="manual">
                {suppressionReasons.map((reason) => <option key={reason} value={reason}>{reason.replaceAll("_", " ")}</option>)}
              </select>
              <button className="button button--primary" type="submit">Add Suppression</button>
            </form>
            <div className="outreach-list">
              {outreachSuppressions.slice(0, 50).map((item) => (
                <div key={item.id} className="outreach-list-row">
                  <strong>{item.email || item.domain}</strong>
                  <span>{item.reason} | {item.tenantId || "all tenants"}</span>
                </div>
              ))}
              {!outreachSuppressions.length ? <p>No suppressions yet.</p> : null}
            </div>
          </section>
        </div>

        <div className="outreach-admin-grid">
          <section className="outreach-card">
            <h3>Due Follow-ups</h3>
            <div className="outreach-list">
              {dueFollowUps.map((lead) => (
                <div key={lead.id} className="outreach-list-row">
                  <strong>{lead.businessName}</strong>
                  <span>{lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleDateString() : "No date"} | {lead.email || "No email"}</span>
                </div>
              ))}
              {!dueFollowUps.length ? <p>No due follow-ups.</p> : null}
            </div>
          </section>

          <section className="outreach-card">
            <h3>Performance</h3>
            <div className="outreach-performance-grid">
              <MetricTable title="Sent by Source" data={outreachMetrics.sentBySource} />
              <MetricTable title="Sent by City" data={outreachMetrics.sentByCity} />
              <MetricTable title="Sent by Category" data={outreachMetrics.sentByCategory} />
              <MetricTable title="Queue Status" data={outreachMetrics.byStatus} />
            </div>
          </section>
        </div>
      </section>
      </AdminTabPanel>
      ) : null}

      <AdminTabPanel tabId="pipeline">
      <section className="admin-panel">
        <div className="pipeline-header">
          <div>
            <h2>Lead Pipeline</h2>
            <p>{filteredLeads.length} visible leads from {leads.length} total.</p>
          </div>
          <a className="button button--secondary" href={`/api/admin/leads/export${exportQuery ? `?${exportQuery}` : ""}`}>
            Export Filtered CSV
          </a>
        </div>

        <form action="/admin" method="get" className="lead-filters">
          <input name="q" placeholder="Search business, contact, city, notes" defaultValue={leadFilters.query} />
          <select name="city" defaultValue={leadFilters.city}>
            <option value="">All cities</option>
            {cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <select name="category" defaultValue={leadFilters.category}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select name="source" defaultValue={leadFilters.source}>
            <option value="">All sources</option>
            {leadSources.map((source) => <option key={source} value={source}>{source.replaceAll("_", " ")}</option>)}
          </select>
          <select name="enrichmentStatus" defaultValue={leadFilters.enrichmentStatus}>
            <option value="">All enrichment</option>
            {enrichmentStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
          <select name="outreachStatus" defaultValue={leadFilters.outreachStatus}>
            <option value="">All outreach</option>
            {outreachStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
          <select name="pipelineStatus" defaultValue={leadFilters.pipelineStatus}>
            <option value="">All pipeline</option>
            {pipelineStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
          <select name="sort" defaultValue={leadFilters.sort}>
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
            <option value="score_desc">Score high to low</option>
            <option value="score_asc">Score low to high</option>
            <option value="city">City</option>
            <option value="source">Source</option>
            <option value="status">Status</option>
          </select>
          <button className="button button--primary" type="submit">Apply</button>
        </form>

        <div className="lead-control-list">
          <div className="lead-table-head" aria-hidden="true">
            <span>Business</span>
            <span>Score</span>
            <span>Stage</span>
            <span></span>
          </div>
          {filteredLeads.map((lead) => {
            const leadQueue = queueByLead.get(lead.id) || [];
            const leadEvents = eventsByLead.get(lead.id) || [];
            const leadCalls = callsByLead.get(lead.id) || [];
            const leadTenant = tenants.find((tenant) => tenant.id === lead.tenantId) || tenants[0];
            const enrichment = getLeadEnrichmentSummary(lead);
            return (
            <details className="lead-card" name="lead-drawer" key={lead.id}>
              <summary>
                <span>
                  <strong>{lead.businessName || lead.business || "Unknown business"}</strong>
                  <small>{lead.city || "No city"} | {lead.category || "No category"} | {lead.sourceType}</small>
                </span>
                <span className="lead-score">Score {lead.leadScore || 0}</span>
                <span className={`status-pill status-pill--${lead.pipelineStatus}`}>{lead.pipelineStatus}</span>
                {lead.possibleDuplicates?.length ? <span className="duplicate-pill">Possible duplicate</span> : null}
              </summary>

              <div className="lead-detail-grid lead-detail-grid--stacked">
                <section>
                  <dl className="lead-contact-record">
                    <div className="lead-contact-row">
                      <dt>Contact</dt>
                      <dd>{lead.contactName || "None"}{lead.contactTitle ? ` | ${lead.contactTitle}` : ""}</dd>
                    </div>
                    <div className="lead-contact-row">
                      <dt>Phone</dt>
                      <dd>{lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : "None"}</dd>
                    </div>
                    <div className="lead-contact-row">
                      <dt>Website</dt>
                      <dd>{lead.websiteUrl ? <a href={lead.websiteUrl} target="_blank" rel="noreferrer">{lead.websiteUrl}</a> : "None"}</dd>
                    </div>
                    <div className="lead-contact-row">
                      <dt>Address</dt>
                      <dd>{lead.address || "None"}</dd>
                    </div>
                  </dl>

                  <details className="lead-section">
                    <summary>Lead detail</summary>
                    <div className="lead-section__body">
                      <dl className="lead-facts">
                        <div><dt>Contact</dt><dd>{lead.contactName || "None"} {lead.contactTitle ? `| ${lead.contactTitle}` : ""}</dd></div>
                        <div><dt>Email</dt><dd>{lead.email || "None"}</dd></div>
                        <div><dt>Phone</dt><dd>{lead.phone || "None"}</dd></div>
                        <div><dt>Website</dt><dd>{lead.websiteUrl || "None"}</dd></div>
                        <div><dt>Address</dt><dd>{lead.address || "None"}</dd></div>
                        <div><dt>Batch</dt><dd>{lead.batchId || "None"}</dd></div>
                        <div><dt>Google</dt><dd>{lead.googleRating || 0} rating | {lead.googleReviewCount || 0} reviews</dd></div>
                        <div><dt>Last Contacted</dt><dd>{lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString() : "Never"}</dd></div>
                        <div><dt>Next Follow-up</dt><dd>{lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleDateString() : "None"}</dd></div>
                        <div><dt>Last Call</dt><dd>{lead.lastCallAt ? new Date(lead.lastCallAt).toLocaleDateString() : (leadCalls[0] ? `${leadCalls[0].status}${leadCalls[0].outcome ? ` · ${leadCalls[0].outcome.replaceAll("_", " ")}` : ""}` : "None")}</dd></div>
                      </dl>

                      {lead.possibleDuplicates?.length ? (
                        <div className="duplicate-review">
                          <strong>Possible duplicates</strong>
                          {lead.possibleDuplicates.map((duplicate) => (
                            <p key={duplicate.id}>{duplicate.businessName}: {duplicate.reasons.join(", ")}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </details>

                  <details className="lead-section">
                    <summary>Call &amp; SMS</summary>
                    <div className="lead-section__body">
                      {canManageLeadActions ? (
                        <LeadCallPanel
                          leadId={lead.id}
                          leadPhone={lead.phone || ""}
                          doNotCall={Boolean(lead.doNotCall)}
                          doNotContact={Boolean(lead.doNotContact)}
                          telephonyEnabled={Boolean(leadTenant?.telephony?.enabled)}
                          calls={leadCalls}
                          canDelete={canDeleteCallRecords}
                        />
                      ) : (
                        <p>You do not have permission to manage call actions.</p>
                      )}
                    </div>
                  </details>

                  <details className="lead-section">
                    <summary>AI research &amp; sales brief</summary>
                    <div className="lead-section__body">
                      {enrichment ? (
                        <div className="lead-enrichment">
                          <div className="lead-enrichment__meta">
                            <strong>Website enrichment</strong>
                            <span>Status: {enrichment.status}</span>
                            {enrichment.lastEnrichedAt ? <span>Last enriched: {enrichment.lastEnrichedAt}</span> : null}
                            {enrichment.title ? <span>Title: {enrichment.title}</span> : null}
                          </div>
                          {renderEnrichmentGroup("Social", enrichment.socialProfiles)}
                          {renderEnrichmentGroup("Emails", enrichment.emails)}
                          {renderEnrichmentGroup("Phones", enrichment.phones)}
                          {renderEnrichmentGroup("Headings", enrichment.headings)}
                          {renderEnrichmentGroup("Signals", enrichment.signals)}
                          {enrichment.salesBrief?.summary ? (
                            <div className="lead-enrichment__brief">
                              <strong>Sales brief</strong>
                              <p>{enrichment.salesBrief.summary}</p>
                              {enrichment.salesBrief.suggestedOffer ? (
                                <p><span>Offer:</span> {enrichment.salesBrief.suggestedOffer}</p>
                              ) : null}
                              {enrichment.salesBrief.callerOpeningLine ? (
                                <p><span>Caller opener:</span> {enrichment.salesBrief.callerOpeningLine}</p>
                              ) : null}
                              <div className="lead-enrichment__scores">
                                {enrichment.salesBrief.fitScore !== null ? (
                                  <span className="lead-enrichment__score">Fit {enrichment.salesBrief.fitScore}</span>
                                ) : null}
                                {enrichment.salesBrief.confidenceScore !== null ? (
                                  <span className="lead-enrichment__score">
                                    Confidence {enrichment.salesBrief.confidenceScore}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                          {renderEnrichmentGroup("Angles", enrichment.salesBrief?.outreachAngles || [])}
                        </div>
                      ) : null}

                      <LeadDeepResearch
                        leadId={lead.id}
                        initialDossier={lead?.metadata?.research?.dossier || null}
                        initialReviewFlags={lead?.metadata?.research?.reviewQueue || []}
                      />
                      <FillMissingButton leadId={lead.id} missingCount={missingFields(lead).length} />
                    </div>
                  </details>
                </section>

                <section>
                  {canManageLeadActions ? (
                  <details className="lead-section">
                    <summary>Edit &amp; status</summary>
                    <div className="lead-section__body">
                  <h3>Edit Pipeline Fields</h3>
                  <form action="/api/admin/leads/update" method="post" className="admin-form">
                    <input type="hidden" name="leadId" value={lead.id} />
                    <input type="hidden" name="redirectTo" value={`/admin${exportQuery ? `?${exportQuery}` : ""}`} />
                    <label>
                      Contact Name
                      <input name="contactName" defaultValue={lead.contactName || ""} />
                    </label>
                    <label>
                      Pipeline Status
                      <select name="pipelineStatus" defaultValue={lead.pipelineStatus}>
                        {pipelineStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                      </select>
                    </label>
                    <label>
                      Assigned To
                      <input name="assignedTo" defaultValue={lead.assignedTo || ""} />
                    </label>
                    <label>
                      Next Follow-up
                      <input name="nextFollowUpAt" type="date" defaultValue={lead.nextFollowUpAt ? String(lead.nextFollowUpAt).slice(0, 10) : ""} />
                    </label>
                    <label>
                      Notes
                      <textarea name="notes" rows="4" defaultValue={lead.notes || ""} />
                    </label>
                    {/* Advanced fields: collapsed on phones behind a CSS-only toggle,
                        always visible on desktop. All inputs stay in the DOM so they
                        submit regardless of the toggle state. */}
                    <input type="checkbox" id={`lead-more-${lead.id}`} className="admin-form__more-toggle" />
                    <label htmlFor={`lead-more-${lead.id}`} className="admin-form__more-label">More details</label>
                    <div className="admin-form__more">
                      <label>
                        Contact Title
                        <input name="contactTitle" defaultValue={lead.contactTitle || ""} />
                      </label>
                      <label>
                        Outreach Status
                        <select name="outreachStatus" defaultValue={lead.outreachStatus}>
                          {outreachStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                        </select>
                      </label>
                      <label>
                        Enrichment Status
                        <select name="enrichmentStatus" defaultValue={lead.enrichmentStatus}>
                          {enrichmentStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                        </select>
                      </label>
                      <label>
                        Lead Score
                        <input name="leadScore" type="number" defaultValue={lead.leadScore || 0} />
                      </label>
                      <label>
                        Score Reason
                        <textarea name="leadScoreReason" rows="3" defaultValue={lead.leadScoreReason || ""} />
                      </label>
                      <label>
                        Pain Points
                        <textarea name="painPoints" rows="3" defaultValue={lead.painPoints || ""} />
                      </label>
                      <label>
                        Recommended next step
                        <input name="recommendedOffer" defaultValue={lead.recommendedOffer || ""} />
                      </label>
                      <label>
                        Campaign
                        <select name="campaignId" defaultValue={lead.campaignId || ""}>
                          <option value="">No campaign</option>
                          {outreachCampaigns.map((campaign) => (
                            <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Reply Status
                        <input name="replyStatus" defaultValue={lead.replyStatus || ""} />
                      </label>
                    </div>
                    <button className="button button--primary" type="submit">Save Lead</button>
                  </form>

                  <form action="/api/admin/drafts" method="post" className="admin-form">
                    <input type="hidden" name="leadId" value={lead.id} />
                    <input type="hidden" name="tenantId" value={lead.tenantId} />
                    <input type="hidden" name="packageId" value={lead.packageId || tenants[0]?.defaultPackageId} />
                    <button className="button button--secondary" type="submit">Generate Draft Email</button>
                  </form>

                  {lead.websiteUrl ? (
                    <form action="/api/admin/leads/enrich" method="post" className="admin-form">
                      <input type="hidden" name="leadId" value={lead.id} />
                      <button className="button button--secondary" type="submit">Enrich from Website</button>
                    </form>
                  ) : (
                    <span className="button button--secondary button--disabled" aria-disabled="true">Enrich from Website</span>
                  )}

                  <div className="lead-actions">
                    <form action="/api/admin/outreach/events" method="post">
                      <input type="hidden" name="leadId" value={lead.id} />
                      <input type="hidden" name="action" value="replied" />
                      <button className="button button--secondary" type="submit">Mark Replied</button>
                    </form>
                    <form action="/api/admin/outreach/events" method="post">
                      <input type="hidden" name="leadId" value={lead.id} />
                      <input type="hidden" name="action" value="booked" />
                      <button className="button button--secondary" type="submit">Mark Booked</button>
                    </form>
                    <form action="/api/admin/outreach/events" method="post">
                      <input type="hidden" name="leadId" value={lead.id} />
                      <input type="hidden" name="action" value="do_not_contact" />
                      <button className="button button--secondary" type="submit">Do Not Contact</button>
                    </form>
                  </div>

                  <form action="/api/admin/outreach/events" method="post" className="admin-form">
                    <input type="hidden" name="leadId" value={lead.id} />
                    <input type="hidden" name="action" value="follow_up" />
                    <label>
                      Follow-up Date
                      <input name="nextFollowUpAt" type="date" defaultValue={lead.nextFollowUpAt ? String(lead.nextFollowUpAt).slice(0, 10) : suggestFollowUpDate()} />
                    </label>
                    <button className="button button--secondary" type="submit">Set Follow-up</button>
                  </form>

                  <form action="/api/admin/outreach/queue" method="post" className="admin-form">
                    <input type="hidden" name="leadId" value={lead.id} />
                    <input type="hidden" name="tenantId" value={lead.tenantId || tenants[0]?.id} />
                    <input type="hidden" name="queueStatus" value="queued" />
                    <input type="hidden" name="includeContacted" value="on" />
                    <label>
                      Follow-up Template
                      <select name="templateId" defaultValue={activeTemplates[1]?.id || activeTemplates[0]?.id || ""}>
                        {activeTemplates.map((template) => (
                          <option key={template.id} value={template.id}>{template.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Sender Email
                      <input name="senderEmail" type="email" placeholder="you@approved-domain.com" />
                    </label>
                    <input name="scheduledFor" type="hidden" value={lead.nextFollowUpAt || ""} />
                    <button className="button button--secondary" type="submit">Queue Follow-up</button>
                  </form>
                    </div>
                  </details>
                  ) : null}

                  <details className="lead-section">
                    <summary>Outreach history</summary>
                    <div className="lead-section__body">
                  <section className="outreach-history">
                    <div className="outreach-list">
                      {leadQueue.map((item) => (
                        <div key={item.id} className="outreach-list-row">
                          <strong>{item.subject}</strong>
                          <span>{item.status} | {item.recipientEmail} | {item.sentAt ? new Date(item.sentAt).toLocaleString() : "not sent"}</span>
                        </div>
                      ))}
                      {leadEvents.map((event) => (
                        <div key={event.id} className="outreach-list-row">
                          <strong>{event.metadata?.summary || event.type}</strong>
                          <span>{new Date(event.createdAt).toLocaleString()}</span>
                        </div>
                      ))}
                      {!leadQueue.length && !leadEvents.length ? <p>No outreach history yet.</p> : null}
                    </div>
                  </section>
                    </div>
                  </details>

                  <details className="lead-section">
                    <summary>Raw source data</summary>
                    <div className="lead-section__body">
                      <pre className="metadata-preview">{JSON.stringify(lead.sourceMetadata || lead.metadata || {}, null, 2)}</pre>
                      {lead.possibleDuplicates?.length ? (
                        <div className="duplicate-review">
                          <strong>Possible duplicates</strong>
                          {lead.possibleDuplicates.map((duplicate) => (
                            <p key={`raw-${duplicate.id}`}>{duplicate.businessName}: {duplicate.reasons.join(", ")}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </details>
                </section>
              </div>
            </details>
            );
          })}
          {!filteredLeads.length ? <p>No leads match the current filters.</p> : null}
        </div>
      </section>
      </AdminTabPanel>

      {canManageTenantActions ? (
      <AdminTabPanel tabId="tenants">
      <section className="admin-grid">
        <TenantBuilder />
        <TenantEditor
          tenants={tenants.map((tenant) => ({
            id: tenant.id,
            slug: tenant.slug,
            status: tenant.status,
            name: tenant.brand?.name || tenant.slug,
            lastPublishedAt: tenant.lastPublishedAt || "",
            hasPublished: Boolean(tenant.publishedConfig)
          }))}
        />
        <TenantPhoneSettings
          tenants={tenants.map((tenant) => ({
            id: tenant.id,
            name: tenant.brand?.name || tenant.slug,
            slug: tenant.slug,
            telephony: tenant.telephony
          }))}
          reps={teamUsers.map((user) => ({ id: user.id, name: user.name, email: user.email }))}
        />
        <TenantBrandingSettings
          tenants={tenants.map((tenant) => ({
            id: tenant.id,
            name: tenant.brand?.name || tenant.slug,
            slug: tenant.slug,
            appIcon: tenant.brand?.appIcon || ""
          }))}
        />
        <article className="admin-panel admin-panel--wide">
          <h2>Tenants</h2>
          <p>Review configured white-label brands and open public previews.</p>
          <div className="tenant-summary-grid">
            {tenants.map((tenant) => (
              <div key={tenant.id} className="tenant-summary-card">
                <strong>{tenant.brand.name}</strong>
                <span>{tenant.slug} | {tenant.status}</span>
                <span>{tenant.domains.join(", ")}</span>
                <a className="button button--secondary" href={`/t/${tenant.slug}`} target="_blank">Preview</a>
              </div>
            ))}
          </div>
        </article>

      </section>
      </AdminTabPanel>
      ) : null}

      {canManageLeadActions ? (
      <AdminTabPanel tabId="pipeline">
      <section className="admin-grid">
        <article className="admin-panel">
          <h2>CSV Lead Import</h2>
          <p>Headers accepted: business, contact, contact_title, email, phone, website, domain, address, city, province, country, category, notes, status.</p>
          <form action="/api/admin/leads/import" method="post" className="admin-form">
            <label>
              Tenant
              <select name="tenantId" defaultValue={tenants[0]?.id}>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.brand.name}</option>
                ))}
              </select>
            </label>
            <textarea name="csv" rows="10" placeholder="business,contact,email,phone,website,notes" required />
            <button className="button button--primary" type="submit">Import Leads</button>
          </form>
        </article>

      </section>
      </AdminTabPanel>
      ) : null}

      {canManageLeadActions ? (
      <AdminTabPanel tabId="prospecting">
      <section className="admin-grid">
        <article className="admin-panel">
          <h2>API Prospecting</h2>
          <p>Quick one-off provider actions. Use the batch builder above for daily acquisition work.</p>

          <div className="api-provider-stack">
            <form action="/api/admin/prospecting/google" method="post" className="admin-form api-provider-card">
              <h3>Google Places Search</h3>
              <label>
                Tenant
                <select name="tenantId" defaultValue={tenants[0]?.id}>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>{tenant.brand.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Search Query
                <input name="query" placeholder="med spas in Toronto" required />
              </label>
              <label className="admin-checkbox">
                <input type="checkbox" name="autoEnrich" value="on" />
                <span>Auto-enrich websites after import</span>
              </label>
              <button className="button button--primary" type="submit">Find Prospects</button>
            </form>

            <div className="api-provider-grid">
              <form action="/api/admin/prospecting/hunter" method="post" className="admin-form api-provider-card">
                <h3>Hunter Domain Search</h3>
                <label>
                  Tenant
                  <select name="tenantId" defaultValue={tenants[0]?.id}>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>{tenant.brand.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Domain
                  <input name="domain" placeholder="example.com" required />
                </label>
                <button className="button button--secondary" type="submit">Enrich with Hunter</button>
              </form>

              <form action="/api/admin/prospecting/apollo" method="post" className="admin-form api-provider-card">
                <h3>Apollo Person Search</h3>
                <label>
                  Tenant
                  <select name="tenantId" defaultValue={tenants[0]?.id}>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>{tenant.brand.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Domain
                  <input name="domain" placeholder="example.com" required />
                </label>
                <label>
                  Titles
                  <input name="titles" placeholder="owner, founder, marketing manager" />
                </label>
                <button className="button button--secondary" type="submit">Enrich with Apollo</button>
              </form>

              <form action="/api/admin/leads/enrich-batch" method="post" className="admin-form api-provider-card">
                <h3>Enrich recent website leads</h3>
                <label>
                  Tenant
                  <select name="tenantId" defaultValue={tenants[0]?.id}>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>{tenant.brand.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Limit
                  <select name="limit" defaultValue="3">
                    <option value="1">1</option>
                    <option value="3">3</option>
                    <option value="5">5</option>
                  </select>
                </label>
                <label>
                  Status
                  <select name="status" defaultValue="">
                    <option value="">Any status</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                </label>
                <button className="button button--secondary" type="submit">Run Batch Enrichment</button>
              </form>
            </div>
          </div>
        </article>

      </section>
      </AdminTabPanel>
      ) : null}

      {(canManageTeamUsers || canManageContractorActions || session.role === "contractor") ? (
      <AdminTabPanel tabId="team">
      <section className="admin-grid">
        {canManageTeamUsers ? (
        <article className="admin-panel admin-panel--wide">
          <div className="pipeline-header">
            <div>
              <h2>Team Credentials</h2>
              <p>Create database-backed logins, update roles, and activate or deactivate access for {session.team.name}.</p>
            </div>
            <span className="status-pill">{teamUsers.length} users</span>
          </div>

          <form action="/api/admin/users" method="post" className="admin-form team-user-form">
            <input type="hidden" name="action" value="create" />
            <input type="hidden" name="teamId" value={session.team.id} />
            <label>
              Name
              <input name="name" placeholder="Team member name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" placeholder="teammate@example.com" required />
            </label>
            <label>
              Temporary Password
              <input name="password" type="password" minLength="12" placeholder="At least 12 characters" required />
            </label>
            <label>
              Role
              <select name="role" defaultValue="viewer" required>
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
            <button className="button button--primary" type="submit">Create Credential</button>
          </form>

          <div className="team-users-table" role="table" aria-label="Team users">
            <div className="team-users-table__row team-users-table__row--head" role="row">
              <span role="columnheader">Name</span>
              <span role="columnheader">Email</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Created</span>
              <span role="columnheader">Actions</span>
            </div>
            {teamUsers.map((user) => (
              <div key={user.id} className="team-users-table__row" role="row">
                <span role="cell" data-label="Name"><strong>{user.name || "No name"}</strong></span>
                <span role="cell" data-label="Email">{user.email}</span>
                <span role="cell" data-label="Role">
                  <form action="/api/admin/users" method="post" className="inline-form team-role-form">
                    <input type="hidden" name="action" value="update_role" />
                    <input type="hidden" name="teamId" value={session.team.id} />
                    <input type="hidden" name="userId" value={user.id} />
                    <select name="role" defaultValue={user.role}>
                      {USER_ROLES.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <button className="button button--secondary" type="submit">Save</button>
                  </form>
                </span>
                <span role="cell" data-label="Status">
                  <span className={`status-pill status-pill--${user.status}`}>{user.status}</span>
                </span>
                <span role="cell" data-label="Created">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}</span>
                <span role="cell" data-label="Actions">
                  <form action="/api/admin/users" method="post" className="inline-form">
                    <input type="hidden" name="action" value={user.status === "active" ? "deactivate" : "reactivate"} />
                    <input type="hidden" name="teamId" value={session.team.id} />
                    <input type="hidden" name="userId" value={user.id} />
                    <button
                      className="button button--secondary"
                      type="submit"
                      disabled={user.id === session.user?.id && user.status === "active"}
                    >
                      {user.status === "active" ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </span>
              </div>
            ))}
            {!teamUsers.length ? <p>No team users yet.</p> : null}
          </div>
        </article>
        ) : null}

        {canManageTeamUsers ? (
        <article className="admin-panel admin-panel--wide">
          <div className="pipeline-header">
            <div>
              <h2>Audit Log</h2>
              <p>Recent team administration and sales operations.</p>
            </div>
            <span className="status-pill">{auditLogs.length} events</span>
          </div>
          <div className="team-users-table audit-log-table" role="table" aria-label="Audit log">
            <div className="team-users-table__row team-users-table__row--head" role="row">
              <span role="columnheader">Time</span>
              <span role="columnheader">User</span>
              <span role="columnheader">Action</span>
              <span role="columnheader">Target</span>
              <span role="columnheader">Metadata</span>
            </div>
            {auditLogs.map((event) => (
              <div key={event.id} className="team-users-table__row audit-log-table__row" role="row">
                <span role="cell" data-label="Time">{event.createdAt ? new Date(event.createdAt).toLocaleString() : "Unknown"}</span>
                <span role="cell" data-label="User">{event.userName || event.userEmail || event.userId || "Unknown"}</span>
                <span role="cell" data-label="Action"><strong>{event.action}</strong></span>
                <span role="cell" data-label="Target">{[event.targetType, event.targetId].filter(Boolean).join(": ") || "None"}</span>
                <span role="cell" data-label="Metadata"><code>{JSON.stringify(event.metadata || {})}</code></span>
              </div>
            ))}
            {!auditLogs.length ? <p>No audit events yet.</p> : null}
          </div>
        </article>
        ) : null}

        <article className="admin-panel">
          <h2>Contractor Capacity</h2>
          <p>Track delivery partners, service area, capacity, and rate notes before assigning booked work.</p>
          {canManageContractorActions ? (
          <form action="/api/admin/contractors" method="post" className="admin-form">
            <input name="name" placeholder="Contractor name" required />
            <input name="email" type="email" placeholder="email@example.com" />
            <input name="phone" placeholder="Phone" />
            <input name="serviceArea" placeholder="Toronto / GTA / Kitchener" />
            <input name="weeklyCapacity" type="number" min="0" placeholder="Weekly shoot capacity" />
            <textarea name="availabilityNotes" rows="3" placeholder="Availability notes" />
            <textarea name="rateNotes" rows="3" placeholder="Rate and margin notes" />
            <button className="button button--primary" type="submit">Add Contractor</button>
          </form>
          ) : null}
          <div className="admin-list">
            {contractors.map((contractor) => (
              <div key={contractor.id}>
                <strong>{contractor.name}</strong>
                <span>{contractor.service_area || contractor.serviceArea || "No service area yet"}</span>
              </div>
            ))}
          </div>
        </article>

        {canManageLeadActions ? (
        <article className="admin-panel">
          <h2>Draft Emails</h2>
          <div className="admin-list admin-list--drafts">
            {drafts.map((draft) => (
              <div key={draft.id}>
                <strong>{draft.subject}</strong>
                <pre>{draft.body}</pre>
              </div>
            ))}
            {!drafts.length ? <p>No draft emails yet.</p> : null}
          </div>
        </article>
        ) : null}
      </section>
      </AdminTabPanel>
      ) : null}
    </AdminTabbedShell>
  );
}

function uniqueOptions(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key] || "";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

function MetricTable({ title, data }) {
  const rows = Object.entries(data || {}).filter(([, count]) => count);
  return (
    <div className="metric-table">
      <strong>{title}</strong>
      {rows.map(([label, count]) => (
        <span key={label}>{label}: {count}</span>
      ))}
      {!rows.length ? <span>No sent data yet.</span> : null}
    </div>
  );
}
