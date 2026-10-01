import { requireSession } from "../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../lib/store";
import { stage3ErrorResponse } from "../../../../../../lib/stage3/api";
import { readLocalPreview } from "../../../../../../lib/stage3/localPreview";
import { requireStage3Repository } from "../../../../../../lib/stage3/server";

export async function GET(request, { params }) {
  try {
    const session = await requireSession();
    const teamId = getSessionTeamId(session);
    const { id } = await params;
    const job = await requireStage3Repository().getGenerationJob(id, teamId);
    if (!job) throw Object.assign(new Error("Generation job not found."), { status: 404 });
    if (job.validationResults?.passed !== true) throw Object.assign(new Error("Only validated output can be previewed."), { status: 409 });
    const html = await readLocalPreview(teamId, job.id);
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
        "content-security-policy": "sandbox; default-src 'none'; img-src data: https:; media-src data: https:; style-src 'unsafe-inline'; font-src data: https:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "x-frame-options": "SAMEORIGIN"
      }
    });
  } catch (error) {
    if (error?.code === "ENOENT") return Response.json({ error: "Preview is unavailable or expired; regenerate it in the staging worker." }, { status: 404 });
    return stage3ErrorResponse(error, request);
  }
}
