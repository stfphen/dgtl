import { NextResponse } from "next/server";
import { logAudit } from "../../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { lookupHunterDomain } from "../../../../../lib/integrations/hunter";
import { createLead, getSessionTeamId, requireTenantAccess } from "../../../../../lib/store";

export async function POST(request) {
  let session;
  try {
    session = await requireRole(["owner", "admin", "sales"]);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }

  const form = await request.formData();
  const domain = String(form.get("domain") || "");
  const tenantId = String(form.get("tenantId") || "");
  const teamId = getSessionTeamId(session);
  try {
    await requireTenantAccess(teamId, tenantId);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }
  const result = await lookupHunterDomain(domain);

  const url = new URL("/admin", process.env.PUBLIC_APP_URL || request.url);
  if (!result.ok) {
    url.searchParams.set("notice", result.reason);
    return NextResponse.redirect(url, 303);
  }

  for (const contact of result.contacts) {
    const lead = await createLead({
      teamId,
      tenantId,
      business: domain,
      name: contact.name,
      email: contact.email,
      url: `https://${domain}`,
      notes: contact.position ? `Hunter contact: ${contact.position}` : "Hunter contact",
      status: "researched",
      sourceType: "hunter",
      metadata: contact
    });
    if (!lead.skippedDuplicate) {
      await logAudit({
        userId: session.user?.id,
        action: "lead.imported",
        targetType: "lead",
        targetId: lead.id,
        metadata: {
          teamId,
          tenantId,
          provider: "hunter",
          domain,
          businessName: lead.businessName
        }
      });
    }
  }

  url.searchParams.set("notice", `Imported ${result.contacts.length} Hunter contacts for ${domain}.`);
  return NextResponse.redirect(url, 303);
}
