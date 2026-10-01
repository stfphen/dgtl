import { requireCoreWrite } from "../../../../lib/permissions";
import { getSessionTeamId, requireTenantAccess } from "../../../../lib/store";
import { ImportService } from "../../../../lib/stage2/importService";
import { redirectTo, stage2ErrorResponse } from "../../../../lib/stage2/api";
import { requireStage2Repository, stage2Actor } from "../../../../lib/stage2/server";

export async function GET(request) {
  try {
    const session = await requireCoreWrite(); const teamId = getSessionTeamId(session);
    const service = new ImportService({ teamId, actor: stage2Actor(session), repository: requireStage2Repository() });
    return Response.json({ batches: await service.listBatches() });
  } catch (error) { return stage2ErrorResponse(error, request); }
}

export async function POST(request) {
  try {
    const session = await requireCoreWrite(); const teamId = getSessionTeamId(session); const form = await request.formData();
    const tenantId = String(form.get("tenantId") || "");
    if (tenantId) await requireTenantAccess(teamId, tenantId);
    const file = form.get("file");
    const pasted = String(form.get("content") || "");
    const filename = file?.name || String(form.get("filename") || "prospects.csv");
    const sourceType = filename.toLowerCase().endsWith(".tsv") ? "tsv" : "csv";
    const content = file?.text ? await file.text() : pasted;
    if (file?.size > 8 * 1024 * 1024) throw new Error("Spreadsheet exceeds the 8 MB staging limit.");
    const service = new ImportService({ teamId, actor: stage2Actor(session), repository: requireStage2Repository() });
    const batch = await service.upload({ filename, content, sourceType, tenantId, provenance: { uploadMode: file?.name ? "file" : "pasted" } });
    return redirectTo(request, `/imports/${batch.id}`, "Spreadsheet staged. Review mapping and rows before approval.");
  } catch (error) { return stage2ErrorResponse(error, request); }
}
