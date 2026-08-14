import crypto from "node:crypto";

const EVENT_MAP = Object.freeze({
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "rejected",
  "email.delivery_delayed": "delivery_delayed"
});

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function verifyResendWebhook({ payload, id, timestamp, signature, secret, now = Date.now(), toleranceSeconds = 300 } = {}) {
  if (!payload || !id || !timestamp || !signature || !secret) throw Object.assign(new Error("Missing signed Resend webhook input."), { status: 400 });
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Math.floor(now / 1000) - seconds) > toleranceSeconds) {
    throw Object.assign(new Error("Resend webhook timestamp is outside the replay window."), { status: 400 });
  }
  const encodedSecret = String(secret).startsWith("whsec_") ? String(secret).slice(6) : String(secret);
  let key;
  try { key = Buffer.from(encodedSecret, "base64"); } catch { throw Object.assign(new Error("Invalid Resend webhook secret."), { status: 500 }); }
  if (!key.length) throw Object.assign(new Error("Invalid Resend webhook secret."), { status: 500 });
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
  const valid = String(signature).split(/\s+/).some((item) => {
    const [version, value] = item.split(",", 2);
    return version === "v1" && value && safeEqual(value, expected);
  });
  if (!valid) throw Object.assign(new Error("Invalid Resend webhook signature."), { status: 400 });
  try { return JSON.parse(payload); } catch { throw Object.assign(new Error("Invalid Resend webhook JSON."), { status: 400 }); }
}

export function normalizeResendEvent(event, webhookId) {
  const eventType = EVENT_MAP[event?.type];
  if (!eventType) return null;
  return {
    provider: "resend",
    providerEventId: String(webhookId || ""),
    providerMessageId: String(event?.data?.email_id || ""),
    eventType,
    occurredAt: event?.created_at || event?.data?.created_at || new Date().toISOString(),
    metadata: {
      providerType: event.type,
      bounceType: event?.data?.bounce?.type || "",
      bounceSubType: event?.data?.bounce?.subType || ""
    }
  };
}
