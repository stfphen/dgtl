import { NextResponse } from "next/server";
import { createLead, getTenantByIdOrSlug, updateLeadResearch } from "../../../lib/store";
import { sanitizePublicLeadInput } from "../../../lib/leadUtils";
import { createCheckoutSession, packageHasStripePrice } from "../../../lib/payments/stripe";

export const runtime = "nodejs";

/**
 * Create a checkout session for a tenant package and capture the lead.
 *
 * Price is resolved from the SERVER-side tenant config (never trusted from the
 * client). Falls back to lead capture when Stripe is not configured or the
 * package has no Stripe price, so Payment Link / capture demos keep working.
 */
export async function POST(request) {
  const payload = await request.json().catch(() => ({}));

  // Resolve tenant + package server-side.
  const tenant = await getTenantByIdOrSlug(payload.tenantId || payload.tenantSlug);
  const pkg =
    tenant?.packages?.find((item) => item.id === payload.packageId) || null;

  // Always capture the lead first (so an abandoned payment still leaves a lead).
  // Sanitize the untrusted body: the buyer may set contact/tenant fields, but the
  // owning team and all internal fields are derived server-side (never forged).
  const lead = await createLead(sanitizePublicLeadInput(payload, { source: "public_form" }));

  // Direct Payment Link takes precedence (no Stripe SDK needed).
  if (pkg?.paymentLink) {
    return NextResponse.json({ ok: true, redirect: pkg.paymentLink, leadId: lead.id });
  }

  if (!pkg || !packageHasStripePrice(pkg)) {
    return NextResponse.json({ ok: true, captured: true, reason: "no_stripe_price", leadId: lead.id });
  }

  const result = await createCheckoutSession({
    tenant,
    pkg,
    lead,
    publicAppUrl: process.env.PUBLIC_APP_URL || new URL(request.url).origin
  });

  if (!result.ok) {
    // Not configured or session failure -> lead is still captured.
    return NextResponse.json({
      ok: true,
      captured: true,
      reason: result.configured === false ? "stripe_not_configured" : "checkout_failed",
      leadId: lead.id
    });
  }

  // Record the pending order on the lead.
  await updateLeadResearch(lead.id, {
    metadata: {
      order: {
        provider: "stripe",
        status: "pending",
        sessionId: result.data.sessionId,
        packageId: pkg.id,
        amount: pkg.stripe?.amount ?? null,
        currency: (pkg.stripe?.currency || "cad").toLowerCase(),
        createdAt: new Date().toISOString()
      }
    }
  });

  return NextResponse.json({ ok: true, url: result.data.url, leadId: lead.id });
}
