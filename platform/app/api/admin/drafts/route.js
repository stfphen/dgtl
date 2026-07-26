import { NextResponse } from "next/server";
import { logAudit } from "../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../lib/permissions";
import { buildDraftEmail } from "../../../../lib/outreach";
import {
  createDraftEmail,
  createOutreachEvent,
  getSessionTeamId,
  getTenantBySlug,
  listLeads,
  listTenants,
  requireTenantAccess,
  updateLead
} from "../../../../lib/store";

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const form = await request.formData();
  const teamId = getSessionTeamId(session);
  const leadId = String(form.get("leadId") || "");
  const tenantId = String(form.get("tenantId") || "");
  const packageId = String(form.get("packageId") || "");
  try {
    await requireTenantAccess(teamId, tenantId);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }
  const [leads, tenants] = await Promise.all([listLeads({ teamId }), listTenants({ teamId })]);
  const lead = leads.find((item) => item.id === leadId);
  const tenant = tenants.find((item) => item.id === tenantId) || (await getTenantBySlug("dgtlmag"));

  if (lead && lead.pipelineStatus !== "disqualified") {
    const draft = buildDraftEmail({ tenant, lead, packageId });
    const createdDraft = await createDraftEmail({ ...draft, leadId, tenantId: tenant.id, teamId });
    await updateLead(leadId, {
      outreachStatus: "drafted",
      pipelineStatus: ["new", "researched"].includes(lead.pipelineStatus) ? "qualified" : lead.pipelineStatus
    }, { teamId });
    await createOutreachEvent({
      teamId,
      leadId,
      campaignId: lead.campaignId || "",
      type: "drafted",
      metadata: {
        subject: draft.subject,
        packageId
      }
    });
    await logAudit({
      userId: session.user?.id,
      action: "draft_email.created",
      targetType: "draft_email",
      targetId: createdDraft.id,
      metadata: {
        teamId,
        tenantId: tenant.id,
        leadId,
        subject: createdDraft.subject
      }
    });
  }

  return NextResponse.redirect(new URL("/admin", process.env.PUBLIC_APP_URL || request.url), 303);
}
