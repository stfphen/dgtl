import { parseTwilioWebhook } from "../../../../lib/telephony/webhookRequest.js";
import { buildInboundResponse, decideRoute } from "../../../../lib/telephony/index.js";
import { toE164US } from "../../../../lib/telephony/phone.js";
import { normalizedPhone } from "../../../../lib/leadUtils.js";
import {
  addCallEvent,
  createCall,
  createLead,
  createOutreachEvent,
  getTenantByPhoneNumber,
  listLeads
} from "../../../../lib/store.js";

const XML_HEADERS = { "Content-Type": "text/xml; charset=utf-8" };

function xml(body, status = 200) {
  return new Response(body, { status, headers: XML_HEADERS });
}

// POST /api/telephony/inbound — Twilio "A call comes in" webhook.
// Verifies signature, identifies the tenant by dialed number, finds/stages the
// caller as a lead, routes the call, logs a Call, and returns routing TwiML.
export async function POST(request) {
  const { params, verified } = await parseTwilioWebhook(request, "/api/telephony/inbound");
  if (!verified) {
    return new Response("Invalid signature", { status: 403 });
  }

  const to = params.To || "";
  const from = params.From || "";

  const tenant = await getTenantByPhoneNumber(to);
  const tel = tenant?.telephony;
  if (!tenant || !tel?.enabled) {
    // Safe rejection — unknown or disabled number.
    const twiml = await buildInboundResponse({
      action: "reject",
      greeting: "This number is not available right now. Goodbye."
    });
    return xml(twiml);
  }

  // Find the caller as an existing lead, else stage a minimal inbound lead.
  const fromDigits = normalizedPhone(from);
  let lead = null;
  if (fromDigits) {
    const leads = await listLeads({ teamId: tenant.teamId, tenantId: tenant.id });
    lead = leads.find((candidate) => normalizedPhone(candidate.phone) === fromDigits) || null;
  }
  if (!lead) {
    lead = await createLead({
      teamId: tenant.teamId,
      tenantId: tenant.id,
      phone: toE164US(from) || from,
      businessName: `Inbound ${toE164US(from) || from || "caller"}`,
      sourceType: "inbound_call",
      pipelineStatus: "new",
      phoneCountry: "US"
    });
  }

  // Reps live in the DB only; empty in the JSON/dev store.
  let reps = [];
  if (process.env.DATABASE_URL) {
    try {
      const { listTeamUsers } = await import("../../../../lib/users.js");
      reps = await listTeamUsers(tenant.teamId);
    } catch {
      reps = [];
    }
  }

  const route = decideRoute(lead, tel, reps);
  const call = await createCall({
    teamId: tenant.teamId,
    tenantId: tenant.id,
    leadId: lead.id || "",
    provider: tel.provider || "twilio",
    providerCallId: params.CallSid || "",
    direction: "inbound",
    status: "ringing",
    fromNumber: from,
    toNumber: to,
    tenantNumber: tel.phoneNumber || to,
    assignedUserId: route.repId || ""
  });
  await addCallEvent(call.id, "inbound_received", {
    route: route.reason,
    from,
    to,
    callSid: params.CallSid || ""
  });
  // Readable timeline entry on the lead.
  await createOutreachEvent({
    teamId: tenant.teamId,
    leadId: lead.id,
    type: "call",
    metadata: {
      summary: `Inbound call received from ${from} (routed: ${route.reason})`,
      callId: call.id,
      direction: "inbound"
    }
  });

  const action = route.type === "rep" || route.type === "fallback" ? "dial" : route.type;
  const twiml = await buildInboundResponse({
    action,
    destinationNumber: route.destinationNumber,
    tenantNumber: tel.phoneNumber || to
  });
  return xml(twiml);
}
