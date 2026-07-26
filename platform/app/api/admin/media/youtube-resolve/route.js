import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { resolveYouTubeInput } from "../../../../../lib/media/youtubeResolve";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST { url, prefer? } — classify a pasted YouTube link and return the
 * ready-to-store heroVideo block (+ title/thumbnail when available). Channel
 * handles resolve server-side (Data API when YOUTUBE_API_KEY is set, else an
 * SSRF-guarded page fetch). Read-only — no audit entry; the actual config
 * change goes through the audited tenants/edit route.
 */
export async function POST(request) {
  try {
    await requireRole(["owner", "admin"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const url = String(body?.url || "").trim();
  if (!url) {
    return NextResponse.json({ error: "Paste a YouTube link first." }, { status: 400 });
  }
  const prefer = body?.prefer === "playlist" || body?.prefer === "video" ? body.prefer : undefined;

  try {
    const result = await resolveYouTubeInput(url, { prefer });
    return NextResponse.json(result);
  } catch (error) {
    const status = error?.name === "YouTubeResolveError" ? 400 : 502;
    return NextResponse.json(
      { error: error?.message || "Could not resolve that link." },
      { status }
    );
  }
}
