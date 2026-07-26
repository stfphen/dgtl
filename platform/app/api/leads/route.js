import { NextResponse } from "next/server";
import { createLead } from "../../../lib/store";
import { sanitizePublicLeadInput } from "../../../lib/leadUtils";

// Public, unauthenticated lead capture. The payload is reduced to client-settable
// fields only (see sanitizePublicLeadInput); teamId is resolved server-side from
// the tenant so a caller cannot inject into another team or forge internal fields.
export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const lead = await createLead(sanitizePublicLeadInput(payload, { source: "public_form" }));
  return NextResponse.json({ ok: true, lead });
}
