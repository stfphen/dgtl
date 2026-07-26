import { NextResponse } from "next/server";
import { logAudit } from "../../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import {
  getRenderableTenantConfig,
  getSessionTeamId,
  getTenantByIdOrSlug,
  saveTenantDraftConfig,
  tenantSnapshot
} from "../../../../../lib/store";
import { applyManualPatch, editTenantConfig } from "../../../../../lib/tenantBuilder/editTenant";
import { diffConfigs } from "../../../../../lib/tenantBuilder/configDiff";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function editErrorStatus(error) {
  return error?.name === "TenantBuilderNotConfigured"
    ? 503
    : error?.name === "TenantBuilderBadInput"
      ? 400
      : error?.name === "TenantBuilderRefused"
        ? 422
        : 502;
}

/**
 * GET ?tenantId= — the current draft snapshot for the editor forms.
 */
export async function GET(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const teamId = getSessionTeamId(session);
  const tenantId = new URL(request.url).searchParams.get("tenantId") || "";
  const tenant = await getTenantByIdOrSlug(tenantId, { teamId });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found for this team." }, { status: 404 });
  }

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      status: tenant.status,
      lastPublishedAt: tenant.lastPublishedAt || "",
      hasPublished: Boolean(tenant.publishedConfig)
    },
    draft: tenantSnapshot(getRenderableTenantConfig(tenant, "draft"))
  });
}

/**
 * POST — apply an edit to a tenant's DRAFT config (published tenants edit
 * their draft copy, then republish). Two modes sharing one pipeline:
 *   { tenantId, instruction }  natural-language edit via the model
 *   { tenantId, patch }        deterministic form/picker edit (no AI)
 */
export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const teamId = getSessionTeamId(session);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const tenantId = String(body?.tenantId || "").trim();
  const instruction = String(body?.instruction || "").trim();
  const patch = body?.patch && typeof body.patch === "object" && !Array.isArray(body.patch) ? body.patch : null;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required." }, { status: 400 });
  }
  if (!instruction && !patch) {
    return NextResponse.json({ error: "Provide an instruction or a patch." }, { status: 400 });
  }

  const tenant = await getTenantByIdOrSlug(tenantId, { teamId });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found for this team." }, { status: 404 });
  }

  // Always edit the draft snapshot — never the published top level.
  const baseDraft = tenantSnapshot(getRenderableTenantConfig(tenant, "draft"));

  let edited;
  try {
    edited = instruction
      ? await editTenantConfig({ baseDraft, instruction })
      : applyManualPatch(baseDraft, patch);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Edit failed." },
      { status: editErrorStatus(error) }
    );
  }

  let saved;
  try {
    saved = await saveTenantDraftConfig(tenant.id, edited.config, { teamId });
  } catch (error) {
    // Validation failed on save — return the diff + warnings so the operator
    // sees what the edit tried to do instead of losing the work.
    return NextResponse.json(
      {
        error: `Edited config did not validate: ${error?.message || "unknown error"}`,
        warnings: edited.warnings,
        changes: diffConfigs(baseDraft, edited.config)
      },
      { status: 422 }
    );
  }

  const savedDraft = tenantSnapshot(getRenderableTenantConfig(saved, "draft"));
  const changes = diffConfigs(baseDraft, savedDraft);

  await logAudit({
    userId: session.user?.id,
    action: "tenant.edited",
    targetType: "tenant",
    targetId: saved.id,
    metadata: {
      teamId,
      slug: saved.slug,
      mode: instruction ? "ai" : "manual",
      changedPaths: changes.map((change) => change.path).slice(0, 25)
    }
  });

  return NextResponse.json({
    tenant: { id: saved.id, slug: saved.slug, status: saved.status },
    warnings: edited.warnings,
    changes
  });
}
