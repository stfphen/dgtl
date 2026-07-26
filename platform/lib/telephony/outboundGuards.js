// Pure authorization checks for outbound click-to-call. Kept separate from the
// route so the lead/tenant/do-not-call rules are unit-testable without the Next
// runtime. The route still enforces session auth (requireRole) before calling
// this; these are the lead- and tenant-level guards.

const DEFAULT_TEAM_ID = "team_default";

/**
 * @param {{ lead: object, teamId: string, tenant: object }} input
 * @returns {{ ok: boolean, status?: number, error?: string }}
 */
export function checkOutboundLead({ lead, teamId, tenant } = {}) {
  if (!lead || (teamId && (lead.teamId || DEFAULT_TEAM_ID) !== teamId)) {
    return { ok: false, status: 404, error: "Lead not found for this team." };
  }
  if (lead.doNotCall || lead.doNotContact) {
    return { ok: false, status: 409, error: "Lead is marked do-not-call / do-not-contact." };
  }
  if (!tenant || !tenant.telephony?.enabled) {
    return { ok: false, status: 409, error: "Telephony is not enabled for this tenant." };
  }
  return { ok: true };
}
