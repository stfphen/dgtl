import { providerFailure, providerNotConfigured, providerSuccess } from "./providerResponse.js";

export async function validateResendConfig() {
  if (!process.env.RESEND_API_KEY) {
    return providerNotConfigured("resend", "RESEND_API_KEY");
  }

  return providerSuccess("resend", { configured: true });
}

export async function sendResendEmail({ from, to, subject, html, text, headers }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return providerNotConfigured("resend", "RESEND_API_KEY");
  }

  const payload = { from, to, subject, html, text };
  // Per-message headers (e.g. List-Unsubscribe) for inbox-native one-click.
  if (headers && Object.keys(headers).length) payload.headers = headers;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return providerFailure("resend", data.message || data.error || `Resend request failed with status ${response.status}.`, {
        status: response.status
      });
    }
    return providerSuccess("resend", data, { status: response.status });
  } catch (error) {
    return providerFailure("resend", error.message || "Resend request failed.");
  }
}
