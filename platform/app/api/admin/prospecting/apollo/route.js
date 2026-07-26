import { NextResponse } from "next/server";
import { logAudit } from "../../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import { searchApolloPeople } from "../../../../../lib/integrations/apollo";
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
  const titles = String(form.get("titles") || "")
    .split(",")
    .map((title) => title.trim())
    .filter(Boolean);
  const result = await searchApolloPeople({ domain, titles });

  const url = new URL("/admin", process.env.PUBLIC_APP_URL || request.url);
  if (!result.ok) {
    url.searchParams.set("notice", result.reason);
    return NextResponse.redirect(url, 303);
  }

  for (const contact of result.contacts) {
    const lead = await createLead({
      teamId,
      tenantId,
      business: contact.company || domain,
      name: contact.name,
      email: contact.email,
      url: `https://${domain}`,
      notes: buildApolloNotes(contact),
      status: "researched",
      sourceType: "apollo",
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
          provider: "apollo",
          domain,
          businessName: lead.businessName
        }
      });
    }
  }

  url.searchParams.set("notice", `Imported ${result.contacts.length} Apollo contacts for ${domain}.`);
  return NextResponse.redirect(url, 303);
}

function buildApolloNotes(contact) {
  const role = contact.position ? `Apollo person search: ${contact.position}` : "Apollo person search";
  if (contact.email) return role;
  if (contact.emailAvailable) return `${role}. Apollo shows an email is available; use enrichment before outreach.`;
  return `${role}. No email returned by Apollo search.`;
}
