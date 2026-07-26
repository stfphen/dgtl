import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCheckoutSessionParams,
  createCheckoutSession,
  handleWebhookEvent,
  packageHasStripePrice
} from "../lib/payments/stripe.js";
import { sanitizeTenantConfig } from "../lib/tenantValidation.js";

const lead = { id: "lead_1", tenantId: "tenant_1", email: "buyer@example.com" };

test("buildCheckoutSessionParams uses a priceId when present", () => {
  const pkg = { id: "pro", name: "Pro", stripe: { priceId: "price_123", mode: "payment" } };
  const params = buildCheckoutSessionParams({ pkg, lead, publicAppUrl: "https://app.example.com/" });

  assert.deepEqual(params.line_items, [{ price: "price_123", quantity: 1 }]);
  assert.equal(params.mode, "payment");
  assert.equal(params.client_reference_id, "lead_1");
  assert.equal(params.metadata.leadId, "lead_1");
  assert.equal(params.metadata.packageId, "pro");
  assert.equal(params.customer_email, "buyer@example.com");
  assert.match(params.success_url, /^https:\/\/app\.example\.com\/\?checkout=success/);
  assert.match(params.cancel_url, /checkout=cancelled$/);
});

test("buildCheckoutSessionParams builds price_data for ad-hoc amounts", () => {
  const pkg = { id: "day", name: "Content Day", stripe: { amount: 250000, currency: "CAD", productName: "Content Day" } };
  const params = buildCheckoutSessionParams({ pkg, lead, publicAppUrl: "https://app.example.com" });
  const item = params.line_items[0];

  assert.equal(item.price_data.currency, "cad");
  assert.equal(item.price_data.unit_amount, 250000);
  assert.equal(item.price_data.product_data.name, "Content Day");
});

test("packageHasStripePrice detects priceId or amount", () => {
  assert.equal(packageHasStripePrice({ stripe: { priceId: "price_1" } }), true);
  assert.equal(packageHasStripePrice({ stripe: { amount: 1000 } }), true);
  assert.equal(packageHasStripePrice({ stripe: {} }), false);
  assert.equal(packageHasStripePrice({}), false);
});

test("createCheckoutSession is graceful when Stripe is not configured", async () => {
  const saved = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  try {
    const result = await createCheckoutSession({
      pkg: { id: "pro", stripe: { priceId: "price_1" } },
      lead,
      publicAppUrl: "https://app.example.com"
    });
    assert.equal(result.ok, false);
    assert.equal(result.configured, false);
  } finally {
    if (saved === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = saved;
  }
});

test("handleWebhookEvent maps checkout.session.completed to a paid order", () => {
  const fulfillment = handleWebhookEvent({
    id: "evt_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_1",
        client_reference_id: "lead_1",
        payment_intent: "pi_1",
        amount_total: 250000,
        currency: "cad",
        metadata: { leadId: "lead_1" }
      }
    }
  });

  assert.equal(fulfillment.leadId, "lead_1");
  assert.equal(fulfillment.order.status, "paid");
  assert.equal(fulfillment.order.sessionId, "cs_1");
  assert.equal(fulfillment.order.paymentIntentId, "pi_1");
  assert.equal(fulfillment.order.eventId, "evt_1");
});

test("handleWebhookEvent ignores unrelated events and missing lead ids", () => {
  assert.equal(handleWebhookEvent({ type: "payment_intent.created", data: { object: {} } }), null);
  assert.equal(
    handleWebhookEvent({ type: "checkout.session.completed", data: { object: { id: "cs_2" } } }),
    null
  );
});

test("sanitizeTenantConfig preserves a valid stripe package block and drops empty ones", () => {
  const sanitized = sanitizeTenantConfig({
    slug: "demo",
    packages: [
      { id: "pro", action: "checkout", stripe: { priceId: "price_1", currency: "CAD", mode: "subscription" } },
      { id: "free", action: "capture", stripe: { currency: "cad" } }
    ]
  });

  const pro = sanitized.packages.find((pkg) => pkg.id === "pro");
  const free = sanitized.packages.find((pkg) => pkg.id === "free");
  assert.equal(pro.stripe.priceId, "price_1");
  assert.equal(pro.stripe.currency, "cad");
  assert.equal(pro.stripe.mode, "subscription");
  assert.equal(free.stripe, undefined);
});
