import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { normalizeDomain, normalizeEmail } from "../../../../../lib/outreachSequence";
import {
  cancelPendingOutreachForLead,
  createOutreachEvent,
  createOutreachSuppression,
  getSessionTeamId,
  listLeads,
  listOutreachQueue,
  updateLead,
  updateOutreachQueueItem
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
  const leadId = String(form.get("leadId") || "");
  const action = String(form.get("action") || "");
  const nextFollowUpAt = String(form.get("nextFollowUpAt") || "");
  const [leads, queue] = await Promise.all([listLeads({ teamId }), listOutreachQueue({ teamId })]);
  const lead = leads.find((item) => item.id === leadId);
  if (!lead) return redirectAdmin(request, "Lead not found.");

  const latestQueueItem = queue.find((item) => item.leadId === leadId && ["sent", "approved", "queued"].includes(item.status));

  if (action === "follow_up") {
    await updateLead(leadId, { nextFollowUpAt }, { teamId });
    await createOutreachEvent({
      teamId,
      leadId,
      queueId: latestQueueItem?.id || "",
      campaignId: latestQueueItem?.campaignId || lead.campaignId || "",
      type: "queued",
      metadata: { nextFollowUpAt, note: "Follow-up date updated." }
    });
    return redirectAdmin(request, "Follow-up date updated.");
  }

  const statusMap = {
    replied: { outreachStatus: "replied", pipelineStatus: "replied", eventType: "replied" },
    booked: { outreachStatus: "booked", pipelineStatus: "booked", eventType: "booked" },
    disqualified: { outreachStatus: "disqualified", pipelineStatus: "disqualified", eventType: "skipped" },
    do_not_contact: { outreachStatus: "suppressed", pipelineStatus: "disqualified", eventType: "suppressed" }
  };
  const next = statusMap[action];
  if (!next) return redirectAdmin(request, "Unsupported outreach action.");

  await updateLead(leadId, {
    outreachStatus: next.outreachStatus,
    pipelineStatus: next.pipelineStatus,
    replyStatus: action,
    campaignId: latestQueueItem?.campaignId || lead.campaignId || ""
  }, { teamId });

  if (latestQueueItem && ["replied", "booked"].includes(action)) {
    await updateOutreachQueueItem(latestQueueItem.id, { status: action }, { teamId });
  }

  // Eagerly cancel any pending (queued/approved) outreach — including scheduled
  // follow-up drip rows — so we don't email a lead who already replied/booked/opted out.
  if (["replied", "booked", "do_not_contact"].includes(action)) {
    await cancelPendingOutreachForLead(leadId, { teamId, reason: `lead_${action}` });
  }

  if (action === "do_not_contact" && (lead.email || lead.domain || lead.websiteUrl)) {
    await createOutreachSuppression({
      teamId,
      tenantId: lead.tenantId,
      email: normalizeEmail(lead.email),
      domain: normalizeDomain(lead.domain || lead.websiteUrl),
      reason: "do_not_contact"
    });
  }

  await createOutreachEvent({
    teamId,
    leadId,
    queueId: latestQueueItem?.id || "",
    campaignId: latestQueueItem?.campaignId || lead.campaignId || "",
    type: next.eventType,
    metadata: { action }
  });

  return redirectAdmin(request, `Lead marked ${action.replaceAll("_", " ")}.`);
}
