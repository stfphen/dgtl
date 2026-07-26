import { providerFailure, providerNotConfigured, providerSuccess } from "./providerResponse.js";

export async function lookupHunterDomain(domain) {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) {
    return withHunterAliases(providerNotConfigured("hunter", "HUNTER_API_KEY"), []);
  }

  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("limit", "10");

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const message = await readHunterError(response);
      return withHunterAliases(
        providerFailure("hunter", message || `Hunter returned ${response.status}.`, {
          status: response.status,
          domain
        }),
        []
      );
    }

    const data = await response.json();
    const contacts = (data.data?.emails || []).map((email) => ({
        name: [email.first_name, email.last_name].filter(Boolean).join(" "),
        contactName: [email.first_name, email.last_name].filter(Boolean).join(" "),
        email: email.value,
        position: email.position || "",
        contactTitle: email.position || "",
        confidence: email.confidence,
        metadata: email
      }));
    return withHunterAliases(providerSuccess("hunter", contacts, { domain, count: contacts.length }), contacts);
  } catch (error) {
    return withHunterAliases(providerFailure("hunter", `Hunter request failed: ${error.message}`, { domain }), []);
  }
}

function withHunterAliases(response, contacts) {
  return {
    ...response,
    contacts,
    reason: response.error || response.reason || ""
  };
}

async function readHunterError(response) {
  try {
    const data = await response.json();
    const detail = data.errors?.[0]?.details || data.errors?.[0]?.id;
    if (detail) return `Hunter returned ${response.status}: ${detail}`;
  } catch {
    return "";
  }

  return "";
}
