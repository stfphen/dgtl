import { providerFailure, providerNotConfigured, providerSuccess } from "../integrations/providerResponse.js";

const PROVIDER = "stripe";

/**
 * Lazily construct a Stripe client. Returns null when STRIPE_SECRET_KEY is
 * absent so the funnel falls back to Payment Links / lead capture with zero
 * Stripe dependency at runtime (mirrors the OPENAI_API_KEY pattern in
 * lib/enrichment/llmBrief.js).
 */
let cachedClient;
async function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cachedClient) {
    const { default: Stripe } = await import("stripe");
    // apiVersion intentionally omitted: use the version pinned to the installed SDK.
    cachedClient = new Stripe(key);
  }
  return cachedClient;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * A checkout package can pay via Stripe when it has a priceId or an amount.
 */
export function packageHasStripePrice(pkg = {}) {
  const stripe = pkg.stripe || {};
  return Boolean(stripe.priceId) || Number(stripe.amount) > 0;
}

/**
 * Pure builder for Stripe Checkout Session params. Price is taken from the
 * SERVER-resolved package — never from client input.
 */
export function buildCheckoutSessionParams({ pkg = {}, lead = {}, publicAppUrl = "" } = {}) {
  const stripe = pkg.stripe || {};
  const base = String(publicAppUrl || "").replace(/\/+$/, "");
  const lineItem = stripe.priceId
    ? { price: stripe.priceId, quantity: 1 }
    : {
        price_data: {
          currency: (stripe.currency || "cad").toLowerCase(),
          product_data: { name: stripe.productName || pkg.name || "Service package" },
          unit_amount: Math.round(Number(stripe.amount || 0))
        },
        quantity: 1
      };

  const params = {
    mode: stripe.mode === "subscription" ? "subscription" : "payment",
    line_items: [lineItem],
    success_url: `${base}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/?checkout=cancelled`,
    client_reference_id: lead.id || "",
    metadata: {
      leadId: lead.id || "",
      tenantId: lead.tenantId || "",
      packageId: pkg.id || ""
    }
  };
  if (lead.email) params.customer_email = lead.email;
  return params;
}

/**
 * Create a Stripe Checkout Session. Returns a providerResponse envelope:
 * - not configured -> providerNotConfigured (caller falls back to capture)
 * - success -> providerSuccess with { url, sessionId }
 */
export async function createCheckoutSession({ tenant, pkg, lead, publicAppUrl } = {}) {
  const client = await getStripeClient();
  if (!client) return providerNotConfigured(PROVIDER, "STRIPE_SECRET_KEY");
  if (!packageHasStripePrice(pkg)) {
    return providerFailure(PROVIDER, "Package has no Stripe price configured.");
  }
  try {
    const params = buildCheckoutSessionParams({ tenant, pkg, lead, publicAppUrl });
    const session = await client.checkout.sessions.create(params);
    return providerSuccess(PROVIDER, { url: session.url, sessionId: session.id });
  } catch (error) {
    return providerFailure(PROVIDER, error?.message || "Failed to create checkout session.");
  }
}

/**
 * Verify a Stripe webhook signature against the raw request body.
 * @returns {Promise<{ ok: boolean, event?: object, error?: string }>}
 */
export async function verifyWebhookEvent(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { ok: false, error: "STRIPE_WEBHOOK_SECRET is not configured." };
  const client = await getStripeClient();
  if (!client) return { ok: false, error: "STRIPE_SECRET_KEY is not configured." };
  try {
    const event = client.webhooks.constructEvent(rawBody, signature, secret);
    return { ok: true, event };
  } catch (error) {
    return { ok: false, error: error?.message || "Invalid signature." };
  }
}

/**
 * Pure mapping from a verified Stripe event to a lead fulfillment instruction.
 * Returns null for events we do not fulfill. The caller applies idempotency.
 */
export function handleWebhookEvent(event = {}) {
  if (event?.type !== "checkout.session.completed") return null;
  const session = event.data?.object || {};
  const leadId = session.client_reference_id || session.metadata?.leadId || "";
  if (!leadId) return null;
  return {
    leadId,
    order: {
      provider: PROVIDER,
      status: "paid",
      sessionId: session.id || "",
      paymentIntentId: session.payment_intent || "",
      amountTotal: session.amount_total ?? null,
      currency: session.currency || "",
      eventId: event.id || "",
      paidAt: new Date().toISOString()
    }
  };
}
