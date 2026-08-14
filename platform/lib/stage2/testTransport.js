import { stableFingerprint } from "../core/ids.js";

export function createTestTransport({ fail = () => false } = {}) {
  const deliveries = [];
  return {
    name: "test",
    mode: "test",
    authorized: true,
    deliveries,
    async send(message) {
      if (fail(message, deliveries.length + 1)) return { ok: false, retryable: true, code: "test_failure", error: "Deterministic test transport failure." };
      const existing = deliveries.find((item) => item.idempotencyKey === message.idempotencyKey);
      if (existing) return { ok: true, providerMessageId: existing.providerMessageId, duplicate: true, simulated: true };
      const delivery = { ...message, providerMessageId: `test_${stableFingerprint(message.idempotencyKey, 20)}`, simulated: true };
      deliveries.push(delivery);
      return { ok: true, providerMessageId: delivery.providerMessageId, simulated: true };
    }
  };
}
