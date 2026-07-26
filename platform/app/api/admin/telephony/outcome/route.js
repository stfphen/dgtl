import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions.js";
import {
  createOutreachEvent,
  getCallById,
  getSessionTeamId,
  updateCall,
  updateLead
} from "../../../../../lib/store.js";
import { callOutcomes } from "../../../../../lib/telephony/constants.js";

const DEFAULT_TEAM_ID = "team_default";

// POST /api/admin/telephony/outcome — rep saves a call outcome.
// Selecting "do_not_call" also flips the lead's doNotCall flag.
export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const teamId = getSessionTeamId(session);
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const callId = String(body.callId || "");
  const outcome = String(body.outcome || "");
  if (!callId || !callOutcomes.includes(outcome)) {
    return NextResponse.json({ error: "callId and a valid outcome are required." }, { status: 400 });
  }

  const call = await getCallById(callId);
  if (!call || (teamId && (call.teamId || DEFAULT_TEAM_ID) !== teamId)) {
    return NextResponse.json({ error: "Call not found for this team." }, { status: 404 });
  }

  await updateCall(callId, { outcome });

  if (outcome === "do_not_call" && call.leadId) {
    await updateLead(call.leadId, { doNotCall: true }, { teamId });
  }

  if (call.leadId) {
    await createOutreachEvent({
      teamId,
      leadId: call.leadId,
      type: "call",
      metadata: {
        summary: `Call outcome: ${outcome.replaceAll("_", " ")}`,
        callId,
        outcome
      }
    });
  }

  return NextResponse.json({ ok: true, callId, outcome });
}
