import { NextResponse } from "next/server";
import { logAudit } from "../../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { getSessionTeamId, saveTenantDraftConfig } from "../../../../../lib/store";
import { generateTenantConfig } from "../../../../../lib/tenantBuilder/generateTenant";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ALLOWED_DOC_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/html",
  "application/json"
]);

function mediaTypeFor(file) {
  const type = String(file.type || "").toLowerCase();
  if (ALLOWED_DOC_TYPES.has(type)) return type;
  const name = String(file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "text/markdown";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".html") || name.endsWith(".htm")) return "text/html";
  if (name.endsWith(".json")) return "application/json";
  return null;
}

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

  const prompt = String(form.get("prompt") || "");
  const brandName = String(form.get("brandName") || "").trim();
  const slug = String(form.get("slug") || "").trim();
  const direction = String(form.get("direction") || "").trim();
  const verticalPreset = String(form.get("verticalPreset") || "").trim();

  const documents = [];
  for (const entry of form.getAll("documents")) {
    if (!entry || typeof entry.arrayBuffer !== "function" || !entry.size) continue;
    const mediaType = mediaTypeFor(entry);
    if (!mediaType) continue;
    const base64 = Buffer.from(await entry.arrayBuffer()).toString("base64");
    documents.push({ name: entry.name || "document", mediaType, base64 });
  }

  let generated;
  try {
    generated = await generateTenantConfig({ prompt, brandName, slug, direction, verticalPreset, documents });
  } catch (error) {
    const status =
      error?.name === "TenantBuilderNotConfigured"
        ? 503
        : error?.name === "TenantBuilderBadInput"
          ? 400
          : error?.name === "TenantBuilderRefused"
            ? 422
            : 502;
    return NextResponse.json({ error: error?.message || "Generation failed." }, { status });
  }

  let tenant;
  try {
    tenant = await saveTenantDraftConfig(null, generated.config, { teamId });
  } catch (error) {
    // The generated config failed validation on save — return it so the
    // operator can see what to fix rather than losing the work.
    return NextResponse.json(
      {
        error: `Generated config did not validate: ${error?.message || "unknown error"}`,
        config: generated.config,
        warnings: generated.warnings
      },
      { status: 422 }
    );
  }

  await logAudit({
    userId: session.user?.id,
    action: "tenant.generated",
    targetType: "tenant",
    targetId: tenant.id,
    metadata: {
      teamId,
      slug: tenant.slug,
      direction: tenant.design?.direction || "",
      documentCount: documents.length,
      hasPrompt: Boolean(prompt.trim())
    }
  });

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      status: tenant.status,
      brandName: tenant.brand?.name || brandName,
      headline: tenant.hero?.headline || ""
    },
    warnings: generated.warnings
  });
}
