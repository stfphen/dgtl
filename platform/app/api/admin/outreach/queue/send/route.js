import { NextResponse } from "next/server";
import { permissionDeniedResponse, requireRole } from "../../../../../../lib/permissions";
import { getSessionTeamId } from "../../../../../../lib/store";
import { sendApprovedItems } from "../../../../../../lib/outreach/sendQueue";

function redirectAdmin(request, notice) {
  const url = new URL("/admin", process.env.PUBLIC_APP_URL || request.url);
  if (notice) url.searchParams.set("notice", notice);
  return NextResponse.redirect(url, 303);
}

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
  if (!queueIds.length) return redirectAdmin(request, "Select at least one approved queue item to send.");

  // Manual send is immediate: no cap-defer (operator chose these), dry-run only
  // via a global OUTREACH_DRY_RUN / campaign testMode (resolved inside the helper).
  const summary = await sendApprovedItems({ teamId, itemIds: queueIds });

  return redirectAdmin(
    request,
    `Send complete: ${summary.sent} sent, ${summary.failed} failed, ${summary.skipped + summary.suppressed} skipped.`
  );
}
