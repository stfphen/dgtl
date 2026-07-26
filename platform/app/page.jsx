import { headers } from "next/headers";
import { resolveTemplate } from "../components/templates/registry";
import { getTenantForHost, resolveTenantMediaConfig } from "../lib/store";

export const dynamic = "force-dynamic";

// Host-resolved metadata, mirroring app/t/[slug]/page.jsx: templates that own
// their metadata (platform, agency, showcase, authority) build it from the
// tenant config; funnel tenants return {} and keep inheriting the layout's
// static metadata exactly as before. Without this, custom-domain tenants
// (e.g. the DGTL Growth Platform on app.dgtlmedia.io) titled themselves
// "Content Day".
export async function generateMetadata() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
  const tenant = await getTenantForHost(host);
  const template = resolveTemplate(tenant);
  return template.buildMetadata ? template.buildMetadata(tenant) : {};
}

export default async function HomePage() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
  const tenant = await getTenantForHost(host);
  // Media-library references (mediaId) become plain src urls server-side.
  const resolved = await resolveTenantMediaConfig(tenant, { teamId: tenant.teamId });

  const { Component } = resolveTemplate(resolved);
  return <Component tenant={resolved} />;
}
