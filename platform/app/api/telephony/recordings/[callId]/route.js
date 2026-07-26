import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions.js";
import { getCallById, getSessionTeamId } from "../../../../../lib/store.js";

// GET /api/telephony/recordings/:callId — authenticated audio proxy.
// Twilio recording media URLs require HTTP Basic auth (Account SID + Auth Token),
// so the browser can't play them directly. This streams the audio through the app
// (same-origin, session-gated) with the credentials attached. Non-Twilio URLs
// (e.g. the mock sample asset) are redirected as-is.
export async function GET(request, { params }) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const teamId = getSessionTeamId(session);
  const call = await getCallById(params.callId);
  if (!call || call.teamId !== teamId) {
    return new Response("Not found", { status: 404 });
  }

  const url = call.recordingUrl || "";
  if (!url) {
    return new Response("No recording", { status: 404 });
  }
  // Non-Twilio media (mock sample, etc.) — just send the client there.
  if (!url.includes("api.twilio.com")) {
    return Response.redirect(url, 302);
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return new Response("Telephony not configured", { status: 503 });
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const range = request.headers.get("range");
  const upstream = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      ...(range ? { Range: range } : {})
    }
  });
  if (!upstream.ok && upstream.status !== 206) {
    return new Response("Upstream recording error", { status: 502 });
  }

  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") || "audio/mpeg");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("content-length", len);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("content-range", contentRange);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=3600");

  return new Response(upstream.body, { status: upstream.status, headers });
}
