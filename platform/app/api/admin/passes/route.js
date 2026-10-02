import { requirePassCapability } from "../../../../lib/permissions";
import { auditPass, passErrorResponse, requirePassesReady, tenantForSession } from "../../../../lib/passes/http";
import { formatShortCode } from "../../../../lib/passes/credentials";
import { issuePass, listPasses, passLinks, withTransaction, withUniqueRetry } from "../../../../lib/passes/store";
import { effectiveStatus } from "../../../../lib/passes/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/passes?tenantId= · pass.view. Rows only, no links: a link is
// a credential, fetched one pass at a time from /detail.
export async function GET(request) {
  try {
    const session = await requirePassCapability("pass.view");
    requirePassesReady();
    const url = new URL(request.url);
    const { teamId, tenant } = await tenantForSession(session, url.searchParams.get("tenantId"));
    const passes = await listPasses({ teamId, tenantId: tenant.id, limit: url.searchParams.get("limit") || 50 });
    return Response.json({ passes });
  } catch (error) {
    return passErrorResponse(error, request);
  }
}

// POST /api/admin/passes · pass.issue. Idempotent on issueRequestId: a double
// click, a retry or a replay returns the first pass with "replay": true.
export async function POST(request) {
  try {
    const session = await requirePassCapability("pass.issue");
    const config = requirePassesReady({ issuing: true });
    const body = await request.json().catch(() => ({}));
    const { teamId, tenant, settings } = await tenantForSession(session, body.tenantId);
    const issueRequestId = typeof body.issueRequestId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.issueRequestId) ? body.issueRequestId : null;

    const issued = await withUniqueRetry(() =>
      withTransaction((tx) =>
        issuePass(
          tx,
          {
            teamId,
            tenantId: tenant.id,
            passTypeId: String(body.passTypeId || ""),
            holder: body.holder || {},
            startDate: body.startDate || undefined,
            validFrom: body.validFrom || undefined,
            validUntil: body.validUntil || undefined,
            issuedBy: session.user?.id || null,
            issueRequestId,
            source: "manual"
          },
          { secrets: config.secrets, activeKeyId: config.activeKeyId, timeZone: settings.timeZone, dayCutoffHour: settings.dayCutoffHour }
        )
      )
    );

    const { pass, passType, holder, replay } = issued;
    if (!replay) {
      await auditPass(session, "pass.issue", pass.id, { tenantId: tenant.id, passTypeId: passType.id, tier: passType.tier });
    }
    const links = passLinks(pass, config);
    return Response.json(
      {
        pass: {
          id: pass.id,
          status: pass.status,
          effectiveStatus: effectiveStatus(pass, new Date()),
          validFrom: pass.validFrom,
          validUntil: pass.validUntil,
          shortCode: formatShortCode(pass.shortCode),
          passTypeName: passType.name,
          tier: passType.tier,
          vip: passType.isVip,
          holderName: holder.name
        },
        links: { passPageUrl: links.passPageUrl, walletUrl: config.walletEnabled ? links.walletUrl : null },
        deliveries: [],
        warnings: config.walletEnabled ? [] : ["wallet_not_configured"],
        replay
      },
      { status: replay ? 200 : 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return passErrorResponse(error, request);
  }
}
