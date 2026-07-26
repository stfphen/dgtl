import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { logAudit } from "../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../lib/permissions";
import {
  collectMediaIds,
  createMediaAsset,
  deleteMediaAsset,
  getSessionTeamId,
  listMediaAssets,
  listTenants
} from "../../../../lib/store";
import { getStorageProvider } from "../../../../lib/media";
import { validateUploadOrThrow } from "../../../../lib/media/validate";

export const dynamic = "force-dynamic";

function clampDimension(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 20000 ? Math.round(n) : 0;
}

/**
 * GET ?tenantId=&kind= — the team's asset library (team-wide assets included
 * in every tenant filter).
 */
export async function GET(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const teamId = getSessionTeamId(session);
  const params = new URL(request.url).searchParams;
  const assets = await listMediaAssets({
    teamId,
    tenantId: params.get("tenantId") || "",
    kind: params.get("kind") || ""
  });
  return NextResponse.json({ assets });
}

/**
 * POST multipart — upload one image into the team library.
 * Fields: file (required), tenantId?, title?, alt?, width?, height?
 */
export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const teamId = getSessionTeamId(session);

  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "Attach a file to upload." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let validated;
  try {
    validated = validateUploadOrThrow({ buffer, mime: file.type, bytes: buffer.length });
  } catch (error) {
    const status = error?.name === "MediaValidationError" ? 400 : 500;
    return NextResponse.json({ error: error?.message || "Upload rejected." }, { status });
  }

  const assetId = `media_${crypto.randomUUID().replaceAll("-", "")}`;
  const provider = getStorageProvider();

  let stored;
  try {
    stored = await provider.put({ teamId, id: assetId, ext: validated.ext, buffer });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not store the file." }, { status: 500 });
  }

  const asset = await createMediaAsset(
    {
      id: assetId,
      tenantId: String(form.get("tenantId") || "").trim(),
      kind: "image",
      url: stored.url,
      storageKey: stored.storageKey,
      mime: validated.mime,
      bytes: buffer.length,
      // Dimensions are measured client-side (no sharp dependency) — advisory.
      width: clampDimension(form.get("width")),
      height: clampDimension(form.get("height")),
      title: String(form.get("title") || file.name || "").trim(),
      alt: String(form.get("alt") || "").trim(),
      source: "upload",
      createdBy: session.user?.id || ""
    },
    { teamId }
  );

  await logAudit({
    userId: session.user?.id,
    action: "media.uploaded",
    targetType: "media_asset",
    targetId: asset.id,
    metadata: { teamId, mime: asset.mime, bytes: asset.bytes, tenantId: asset.tenantId }
  });

  return NextResponse.json({ ok: true, asset });
}

/**
 * DELETE — body { mediaId, force? }. Refuses (409) when a tenant config still
 * references the asset unless force is set; slots referencing a deleted asset
 * degrade gracefully via the render-time resolver fallback.
 */
export async function DELETE(request) {
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

  const mediaId = String(body?.mediaId || "").trim();
  if (!mediaId) {
    return NextResponse.json({ error: "mediaId is required." }, { status: 400 });
  }

  if (!body?.force) {
    const tenants = await listTenants({ teamId });
    const referencedBy = tenants
      .filter((tenant) => {
        const configs = [tenant, tenant.draftConfig, tenant.publishedConfig].filter(Boolean);
        return configs.some((config) => collectMediaIds(config).includes(mediaId));
      })
      .map((tenant) => tenant.slug);
    if (referencedBy.length) {
      return NextResponse.json(
        { error: "Asset is still referenced by tenant configs.", referencedBy },
        { status: 409 }
      );
    }
  }

  const removed = await deleteMediaAsset(mediaId, { teamId });
  if (!removed) {
    return NextResponse.json({ error: "Asset not found for this team." }, { status: 404 });
  }

  if (removed.storageKey) {
    // Best effort — a missing file must not block removing the DB row.
    try {
      await getStorageProvider().remove({ storageKey: removed.storageKey });
    } catch {
      // ignored: row is gone, orphaned file can be swept later
    }
  }

  await logAudit({
    userId: session.user?.id,
    action: "media.deleted",
    targetType: "media_asset",
    targetId: mediaId,
    metadata: { teamId, forced: Boolean(body?.force) }
  });

  return NextResponse.json({ ok: true });
}
