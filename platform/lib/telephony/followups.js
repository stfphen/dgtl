// Missed-call follow-up. Called from /api/telephony/status when a call's final
// status is "missed": create an urgent "Call back {lead}" task, append a
// readable timeline entry, and set lead.nextFollowUpAt / callStatus. Humans act
// on the task — nothing is auto-sent or auto-dialed.

import { createOutreachEvent, createTask, getLeadById, updateLead } from "../store.js";

/**
 * @param {{ call: object, lead?: object }} context
 * @returns {Promise<object|null>} the created task, or null if no lead context.
 */
export async function createMissedCallTask(context = {}) {
  const call = context.call || {};
  const leadId = call.leadId || context.lead?.id || "";
  if (!leadId) return null;

  const lead = context.lead || (await getLeadById(leadId));
  const teamId = call.teamId || lead?.teamId || "team_default";
  const nowIso = new Date().toISOString();
  const who = lead?.businessName || lead?.contactName || "lead";

  // Assign to the lead's owner, else the rep who was on the call.
  const assignedToUserId = lead?.assignedToUserId || call.assignedUserId || "";

  const task = await createTask({
    teamId,
    tenantId: call.tenantId || lead?.tenantId || "",
    leadId,
    title: `Call back ${who}`,
    priority: "urgent",
    dueAt: nowIso,
    assignedToUserId,
    status: "open"
  });

  await updateLead(leadId, { nextFollowUpAt: nowIso, callStatus: "missed" }, { teamId });

  await createOutreachEvent({
    teamId,
    leadId,
    type: "call",
    metadata: {
      summary: `Missed ${call.direction || "inbound"} call — urgent callback task created`,
      callId: call.id || "",
      taskId: task.id
    }
  });

  return task;
}
