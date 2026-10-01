import { requireSession } from "../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../lib/store";
import { stage6ErrorResponse } from "../../../../../lib/stage6/api";
import { buildAssistantService, stage6Actor } from "../../../../../lib/stage6/server";

// POST /api/core/chat/commands — the DGTL.chat terminal's deterministic read
// path. Body: { threadId, toolId, args }.
//
// requireSession, not requireCoreWrite: this route can only reach tools with
// classification "read" (AssistantService.runReadCommand rejects anything else),
// and READ_ROLES already includes viewer. Requiring write would lock viewers out
// of reads they can already get by asking the assistant in prose.
//
// Everything that makes this safe lives in runReadCommand, not here: the
// read-only gate, registry membership, role advertising, strict argument
// validation (a client-supplied teamId is an unknown-argument error), thread
// ownership, the separate rate-limit bucket, and the audit row. The team comes
// from the session — never from the body.
export async function POST(request) {
  try {
    const session = await requireSession();
    const body = await request.json().catch(() => ({}));
    const service = buildAssistantService({ teamId: getSessionTeamId(session), actor: stage6Actor(session) });
    const result = await service.runReadCommand({
      threadId: String(body?.threadId || ""),
      toolId: String(body?.toolId || ""),
      args: body?.args && typeof body.args === "object" && !Array.isArray(body.args) ? body.args : {},
    });
    return Response.json(result);
  } catch (error) {
    return stage6ErrorResponse(error, request);
  }
}
