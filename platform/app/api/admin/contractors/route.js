import { NextResponse } from "next/server";
import { logAudit } from "../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../lib/permissions";
import { createContractor, getSessionTeamId } from "../../../../lib/store";

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const form = await request.formData();
  const teamId = getSessionTeamId(session);
  const contractor = await createContractor({
    teamId,
    name: String(form.get("name") || ""),
    email: String(form.get("email") || ""),
    phone: String(form.get("phone") || ""),
    serviceArea: String(form.get("serviceArea") || ""),
    weeklyCapacity: String(form.get("weeklyCapacity") || "0"),
    availabilityNotes: String(form.get("availabilityNotes") || ""),
    rateNotes: String(form.get("rateNotes") || "")
  });
  await logAudit({
    userId: session.user?.id,
    action: "contractor.created",
    targetType: "contractor",
    targetId: contractor.id,
    metadata: {
      teamId,
      name: contractor.name,
      serviceArea: contractor.serviceArea,
      weeklyCapacity: contractor.weeklyCapacity
    }
  });

  return NextResponse.redirect(new URL("/admin", process.env.PUBLIC_APP_URL || request.url), 303);
}
