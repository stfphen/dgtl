import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions.js";
import {
  inAppTranscriptionAvailable,
  transcribeAndSummarizeCall
} from "../../../../../lib/telephony/transcribeRecording.js";
import { getCallById, getSessionTeamId } from "../../../../../lib/store.js";

// POST /api/admin/telephony/transcribe — manually (re)transcribe a recorded call.
// Used by the "Transcribe" button to backfill calls recorded before in-app
// transcription, or to retry a failed one. Synchronous so the UI can refresh.
export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  if (!inAppTranscriptionAvailable()) {
    return NextResponse.json(
      { error: "Transcription is not configured. Set DEEPGRAM_API_KEY (or OPENAI_API_KEY) in the server environment." },
      { status: 503 }
    );
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
  if (!call.recordingUrl) {
    return NextResponse.json({ error: "This call has no recording to transcribe." }, { status: 409 });
  }

  const result = await transcribeAndSummarizeCall(call);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Transcription failed." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
