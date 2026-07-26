// Parse + verify an inbound Twilio webhook (application/x-www-form-urlencoded).
// Returns the params object and whether the X-Twilio-Signature validated against
// the EXACT configured webhook URL. Routes reject (403) when verified is false.

import { verifyWebhook } from "./index.js";
import { webhookUrl } from "./webhookUrl.js";

export async function parseTwilioWebhook(request, routePath) {
  let params = {};
  try {
    const form = await request.formData();
    for (const [key, value] of form.entries()) {
      params[key] = typeof value === "string" ? value : "";
    }
  } catch {
    params = {};
  }
  const signature = request.headers.get("x-twilio-signature") || "";
  const url = webhookUrl(routePath);
  const verified = await verifyWebhook({ url, signature, params });
  return { params, verified, url, signature };
}
