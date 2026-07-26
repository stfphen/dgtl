import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../../lib/permissions";
import { claimOutreachQueueItem, getSessionTeamId } from "../../../../../../lib/store";

function redirectAdmin(request, notice) {
  const url = new URL("/admin", process.env.PUBLIC_APP_URL || request.url);
  if (notice) url.searchParams.set("notice", notice);
  return NextResponse.redirect(url, 303);
}

// Transition selected queued items to approved so they become sendable (by the
// operator's Send button or the scheduled drain). Reuses the compare-and-set
// claim so only genuinely queued items flip (concurrent-safe, team-scoped).
export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const form = await request.formData();
  const teamId = getSessionTeamId(session);
  const queueIds = form.getAll("queueItemId").map(String).filter(Boolean);
  if (!queueIds.length) return redirectAdmin(request, "Select at least one queued item to approve.");

  let approved = 0;
  for (const queueId of queueIds) {
    const claimed = await claimOutreachQueueItem(queueId, { teamId, fromStatus: "queued", toStatus: "approved" });
    if (claimed) approved += 1;
  }

  return redirectAdmin(request, `Approved ${approved} item${approved === 1 ? "" : "s"} for sending.`);
}
