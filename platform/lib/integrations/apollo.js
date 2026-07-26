import { providerFailure, providerNotConfigured, providerSuccess } from "./providerResponse.js";

export async function searchApolloPeople({ domain, titles }) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return withApolloAliases(providerNotConfigured("apollo", "APOLLO_API_KEY"), []);
  }

  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return withApolloAliases(providerFailure("apollo", "Apollo search needs a valid company domain.", { domain }), []);
  }

  const url = new URL("https://api.apollo.io/api/v1/mixed_people/api_search");
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "10");
  url.searchParams.append("q_organization_domains_list[]", normalizedDomain);

  for (const title of titles || []) {
    if (title) url.searchParams.append("person_titles[]", title);
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": apiKey
      }
    });

    if (!response.ok) {
      const message = await readApolloError(response);
      return withApolloAliases(
        providerFailure("apollo", message || `Apollo returned ${response.status}.`, {
          status: response.status,
          domain: normalizedDomain
        }),
        []
      );
    }

    const data = await response.json();
    const contacts = (data.people || []).map((person) => ({
        name: person.name || [person.first_name, person.last_name].filter(Boolean).join(" "),
        contactName: person.name || [person.first_name, person.last_name].filter(Boolean).join(" "),
        email: person.email || "",
        emailAvailable: Boolean(person.has_email || person.email),
        position: person.title || "",
        contactTitle: person.title || "",
        linkedin: person.linkedin_url || "",
        company: person.organization?.name || person.organization_name || normalizedDomain,
        metadata: person
      }));
    return withApolloAliases(providerSuccess("apollo", contacts, { domain: normalizedDomain, count: contacts.length }), contacts);
  } catch (error) {
    return withApolloAliases(providerFailure("apollo", `Apollo request failed: ${error.message}`, { domain: normalizedDomain }), []);
  }
}

function withApolloAliases(response, contacts) {
  return {
    ...response,
    contacts,
    reason: response.error || response.reason || ""
  };
}

function normalizeDomain(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

async function readApolloError(response) {
  try {
    const data = await response.json();
    const detail = data.error || data.message || data.error_message;
    if (detail) return `Apollo returned ${response.status}: ${detail}`;
  } catch {
    return "";
  }

  return "";
}
