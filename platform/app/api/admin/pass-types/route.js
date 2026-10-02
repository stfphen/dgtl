import { requirePassCapability } from "../../../../lib/permissions";
import { auditPass, passErrorResponse, requirePassesReady, tenantForSession } from "../../../../lib/passes/http";
import { installPresetPassTypes, listPassTypes, PassError } from "../../../../lib/passes/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/pass-types?tenantId= · pass.view
export async function GET(request) {
  try {
    const session = await requirePassCapability("pass.view");
    requirePassesReady();
    const { teamId, tenant } = await tenantForSession(session, new URL(request.url).searchParams.get("tenantId"));
    return Response.json({ passTypes: await listPassTypes({ teamId, tenantId: tenant.id }) });
  } catch (error) {
    return passErrorResponse(error, request);
  }
}

// POST /api/admin/pass-types { action: "install_presets", tenantId } · pass.configure.
// The full editor (create / update / archive / reorder) is build-plan task P2.4.
export async function POST(request) {
  try {
    const session = await requirePassCapability("pass.configure");
    const body = await request.json().catch(() => ({}));
    if (body.action !== "install_presets") throw new PassError("action_unsupported", "Only install_presets is available yet.", 400, "action");
    requirePassesReady();
    const { teamId, tenant } = await tenantForSession(session, body.tenantId);
    const result = await installPresetPassTypes({ teamId, tenantId: tenant.id });
    if (result.created) await auditPass(session, "pass_type.install_presets", tenant.id, { tenantId: tenant.id, created: result.created });
    return Response.json({ ...result, passTypes: await listPassTypes({ teamId, tenantId: tenant.id }) });
  } catch (error) {
    return passErrorResponse(error, request);
  }
}
