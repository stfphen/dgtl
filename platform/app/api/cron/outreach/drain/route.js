import { NextResponse } from "next/server";
import { cronTokenAuthorized, drainDueOutreach } from "../../../../../lib/outreach/sendQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled batch-send drain. NOT session-authed (called by cron, not a
 * browser): authenticated with a bearer OUTREACH_CRON_TOKEN, compared in
 * constant time. Sends approved queue items whose scheduledFor has passed via
 * the shared engine. Safe to re-run — the claim CAS makes it idempotent.
 *
 * Trigger example (host crontab, every 5 min):
 *   [slash]5 * * * * curl -fsS -XPOST -H "Authorization: Bearer $OUTREACH_CRON_TOKEN" \
 *     https://dgtlmag.com/api/cron/outreach/drain
 */
export async function POST(request) {
  if (!cronTokenAuthorized(request.headers.get("authorization") || "")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Number.isFinite(Number(body.limit)) && Number(body.limit) > 0 ? Number(body.limit) : 200;
  const dryRun = body.dryRun === true;

  const summary = await drainDueOutreach({ dryRun, limit });
  return NextResponse.json({ ok: true, ...summary });
}
