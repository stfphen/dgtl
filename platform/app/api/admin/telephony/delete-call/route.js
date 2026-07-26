import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireCallDelete } from "../../../../../lib/permissions.js";
import { deleteCall, getCallById, getSessionTeamId } from "../../../../../lib/store.js";

// POST /api/admin/telephony/delete-call — permanently delete a single call (and
// its events). Hard-restricted to one account by email (requireCallDelete); the
// UI also hides the button for everyone else, but the server is the real gate.
export async function POST(request) {
  let session;
  try {
    session = await requireCallDelete();
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const callId = String(body.callId || "");
  if (!callId) {
    return NextResponse.json({ error: "callId is required." }, { status: 400 });
  }

  const teamId = getSessionTeamId(session);
  const call = await getCallById(callId);
  if (!call || call.teamId !== teamId) {
    return NextResponse.json({ error: "Call not found." }, { status: 404 });
  }

  await deleteCall(callId);
  return NextResponse.json({ ok: true });
}
