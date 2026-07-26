import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { buildQueuePlan } from "../../../../../lib/outreachSequence";
import { buildUnsubscribeUrl } from "../../../../../lib/outreach/unsubscribe";
import {
  createOutreachEvent,
  createOutreachQueueItems,
  getSessionTeamId,
  listLeads,
  listOutreachSuppressions,
  listOutreachTemplates,
  listTenants,
  requireTenantAccess,
  updateLead
} from "../../../../../lib/store";

function redirectAdmin(request, notice) {
  const url = new URL("/admin", process.env.PUBLIC_APP_URL || request.url);
  if (notice) url.searchParams.set("notice", notice);
  return NextResponse.redirect(url, 303);
}

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const form = await request.formData();
  const teamId = getSessionTeamId(session);
  const leadIds = form.getAll("leadId").map(String).filter(Boolean);
  if (!leadIds.length) return redirectAdmin(request, "Select at least one lead to queue.");

  const tenantId = String(form.get("tenantId") || "");
  try {
    await requireTenantAccess(teamId, tenantId);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }
  const templateId = String(form.get("templateId") || "");
  const campaignId = String(form.get("campaignId") || "");
  const scheduledFor = String(form.get("scheduledFor") || "");
  const queueStatus = String(form.get("queueStatus") || "queued");
  const senderEmail = String(form.get("senderEmail") || "");
  const senderName = String(form.get("senderName") || "");
  const includeContacted = form.get("includeContacted") === "on";

  const [leads, tenants, templates, suppressions] = await Promise.all([
    listLeads({ teamId }),
    listTenants({ teamId }),
    listOutreachTemplates({ teamId }),
    listOutreachSuppressions({ teamId })
  ]);
  const selectedLeads = leads.filter((lead) => leadIds.includes(lead.id));
  const tenant = tenants.find((item) => item.id === tenantId) || tenants[0] || {};
  const template = templates.find((item) => item.id === templateId && item.isActive !== false) || templates[0];

  if (!template) return redirectAdmin(request, "Create an outreach template before queueing.");

  const plan = buildQueuePlan({
    leads: selectedLeads,
    tenant,
    template,
    campaignId,
    suppressions,
    scheduledFor,
    status: queueStatus,
    senderEmail,
    senderName,
    includeContacted,
    resolveUnsubscribeUrl: (lead) =>
      buildUnsubscribeUrl({ email: lead.email, tenantId: lead.tenantId || tenant.id || "", teamId })
  });

  const created = await createOutreachQueueItems(plan.items.map((item) => ({ ...item, teamId })));
  for (const item of created) {
    await updateLead(item.leadId, {
      outreachStatus: item.status,
      pipelineStatus: item.status === "approved" ? "qualified" : undefined,
      campaignId: item.campaignId
    }, { teamId });
    await createOutreachEvent({
      teamId,
      leadId: item.leadId,
      queueId: item.id,
      campaignId: item.campaignId,
      type: item.status,
      metadata: {
        subject: item.subject,
        recipientEmail: item.recipientEmail,
        templateId: item.templateId
      }
    });
  }

  const skippedSummary = plan.skipped.length ? ` Skipped ${plan.skipped.length}.` : "";
  return redirectAdmin(request, `Queued ${created.length} outreach item${created.length === 1 ? "" : "s"}.${skippedSummary}`);
}
