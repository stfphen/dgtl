import { NextResponse } from "next/server";
import { logAudit } from "../../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { leadFromCsvRecord, parseCsv } from "../../../../../lib/csv";
import { createLead, getSessionTeamId, requireTenantAccess } from "../../../../../lib/store";

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const form = await request.formData();
  const tenantId = String(form.get("tenantId") || "");
  const teamId = getSessionTeamId(session);
  try {
    await requireTenantAccess(teamId, tenantId);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }
  const records = parseCsv(String(form.get("csv") || ""));
  let imported = 0;
  let skippedDuplicates = 0;

  for (const record of records) {
    const lead = await createLead({ ...leadFromCsvRecord(record, tenantId), teamId });
    if (lead.skippedDuplicate) skippedDuplicates += 1;
    else {
      imported += 1;
      await logAudit({
        userId: session.user?.id,
        action: "lead.imported",
        targetType: "lead",
        targetId: lead.id,
        metadata: {
          teamId,
          tenantId,
          sourceType: lead.sourceType,
          businessName: lead.businessName
        }
      });
    }
  }

  const url = new URL("/admin", process.env.PUBLIC_APP_URL || request.url);
  url.searchParams.set("notice", `Imported ${imported} CSV leads. Skipped ${skippedDuplicates} duplicates.`);
  return NextResponse.redirect(url, 303);
}
