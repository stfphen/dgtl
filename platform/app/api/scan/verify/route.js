import crypto from "node:crypto";
import { requirePassCapability } from "../../../../lib/permissions";
import { passErrorResponse, requirePassesReady } from "../../../../lib/passes/http";
import { passSettingsForTenant } from "../../../../lib/passes/settings";
import { verifyScan, withTransaction, withUniqueRetry } from "../../../../lib/passes/store";
import { clientIpFromRequest, consumeRateLimit } from "../../../../lib/rateLimit";
import { getSessionTeamId, listTenants } from "../../../../lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INPUT_KINDS = new Set(["qr", "barcode", "manual"]);

// The ledger keeps a salted daily hash of the scanner's IP, never the IP.
function ipHash(request, config) {
  const secret = config.secrets.get(config.activeKeyId);
  if (!secret) return null;
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHmac("sha256", secret).update(`${day}|${clientIpFromRequest(request)}`).digest("hex");
}

// POST /api/scan/verify · pass.verify. Always 200 for a verdict, including a
// refusal; the scanner never admits on an error status.
export async function POST(request) {
  try {
    const session = await requirePassCapability("pass.verify");
    const config = requirePassesReady();
    const teamId = getSessionTeamId(session);
    const userId = session.user?.id || session.userId;

    for (const [key, limit] of [[`scan:user:${userId}`, 60], [`scan:team:${teamId}`, 600]]) {
      const hit = consumeRateLimit(key, { limit, windowMs: 60_000 });
      if (!hit.allowed) {
        return Response.json({ error: "Slow down.", code: "rate_limited" }, { status: 429, headers: { "Retry-After": String(hit.retryAfterSeconds) } });
      }
    }

    const body = await request.json().catch(() => ({}));
    const tenants = (await listTenants({ teamId })).filter((tenant) => tenant.teamId === teamId);
    const settings = passSettingsForTenant(tenants[0] || {});
    const result = await withUniqueRetry(() =>
      withTransaction((tx) =>
        verifyScan(
          tx,
          {
            scanId: body.scanId,
            raw: body.raw,
            inputKind: INPUT_KINDS.has(body.inputKind) ? body.inputKind : "qr",
            gate: typeof body.gate === "string" ? body.gate.slice(0, 60) : null,
            deviceLabel: typeof body.deviceLabel === "string" ? body.deviceLabel.slice(0, 60) : null,
            verifierId: userId,
            teamId,
            ipHash: ipHash(request, config),
            userAgent: request.headers.get("user-agent")
          },
          {
            allowedHosts: config.allowedScanHosts,
            insecureHosts: config.insecureScanHosts,
            timeZone: settings.timeZone,
            dayCutoffHour: settings.dayCutoffHour
          }
        )
      )
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return passErrorResponse(error, request);
  }
}
