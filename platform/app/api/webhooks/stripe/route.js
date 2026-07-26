import { NextResponse } from "next/server";
import { getLeadById, updateLeadResearch } from "../../../../lib/store";
import { handleWebhookEvent, verifyWebhookEvent } from "../../../../lib/payments/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook endpoint. Must NOT sit behind admin auth/CSRF. Reads the raw
 * body for signature verification, then fulfills checkout.session.completed by
 * marking the lead paid — idempotently (Stripe delivers at-least-once).
 */
export async function POST(request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  const verified = await verifyWebhookEvent(rawBody, signature);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error || "Invalid signature." }, { status: 400 });
  }

  const fulfillment = handleWebhookEvent(verified.event);
  if (!fulfillment) {
    // Event we don't act on — acknowledge so Stripe stops retrying.
    return NextResponse.json({ received: true, ignored: true });
  }

  const lead = await getLeadById(fulfillment.leadId);
  if (!lead) {
    return NextResponse.json({ received: true, leadMissing: true });
  }

  const existingOrder = (lead.sourceMetadata || lead.metadata || {}).order || {};
  if (existingOrder.status === "paid") {
    // Idempotency: already fulfilled, no-op.
    return NextResponse.json({ received: true, alreadyPaid: true });
  }

  await updateLeadResearch(fulfillment.leadId, {
    status: "won",
    metadata: { order: { ...existingOrder, ...fulfillment.order } }
  });

  return NextResponse.json({ received: true });
}
