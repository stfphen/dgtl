// DGTL Pass — shared route plumbing: the error shape from
// docs/specs/dgtl-pass/04-api.md and team/tenant scoping.

import { logAudit } from "../audit.js";
import { PermissionError, permissionDeniedResponse } from "../permissions.js";
import { getSessionTeamId, getTenantByIdOrSlug } from "../store.js";
import { passesConfig } from "./config.js";
import { passSettingsForTenant } from "./settings.js";
import { PassError, passesDatabaseAvailable } from "./store.js";

export function passErrorResponse(error, request) {
  if (error instanceof PermissionError) return permissionDeniedResponse(error, request);
  if (error instanceof PassError) {
    return Response.json({ error: error.message, code: error.code, ...(error.field ? { field: error.field } : {}) }, { status: error.status });
  }
  throw error;
}

/** Pass routes are Postgres-only and need a configured base URL + key. */
export function requirePassesReady({ issuing = false } = {}) {
  if (!passesDatabaseAvailable()) throw new PassError("database_required", "DGTL Pass needs Postgres (DATABASE_URL).", 503);
  const config = passesConfig();
  if (issuing && !config.enabled) {
    throw new PassError("passes_not_configured", "Set PASS_PUBLIC_BASE_URL, PASS_CREDENTIAL_SECRETS and PASS_CREDENTIAL_ACTIVE_KEY to issue passes.", 503);
  }
  return config;
}

/**
 * The tenant, if it belongs to the session's team. Another team's tenant is a
 * 404, indistinguishable from one that does not exist.
 */
export async function tenantForSession(session, tenantId) {
  const teamId = getSessionTeamId(session);
  const tenant = tenantId ? await getTenantByIdOrSlug(String(tenantId), { teamId }) : null;
  if (!tenant || tenant.teamId !== teamId) throw new PassError("tenant_not_found", "Tenant not found.", 404, "tenantId");
  return { teamId, tenant, settings: passSettingsForTenant(tenant) };
}

export async function auditPass(session, action, targetId, metadata = {}) {
  await logAudit({
    userId: session.user?.id || session.userId,
    action,
    targetType: "pass",
    targetId,
    metadata: { teamId: getSessionTeamId(session), ...metadata }
  });
}
