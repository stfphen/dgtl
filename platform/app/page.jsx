import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveTemplate } from "../components/templates/registry";
import { getTenantClaimingHost, resolveTenantMediaConfig } from "../lib/store";

export const dynamic = "force-dynamic";

// The root page is host-resolved. A host explicitly claimed by a tenant
// renders that tenant's page, so client custom domains keep working. Any
// unclaimed host — dgtlmag.com (the app host), local dev, the bare VPS
// hostname — goes to /home, the authenticated DGTL operating command
// center (which itself bounces unauthenticated visitors to /admin/login).
// Tenant pages (including Content Day at /t/dgtlmag and the Growth
// Platform page at /t/dgtl-platform) remain reachable under /t/[slug].
export async function generateMetadata() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
  const tenant = await getTenantClaimingHost(host);
  if (!tenant) return {};
  const template = resolveTemplate(tenant);
  return template.buildMetadata ? template.buildMetadata(tenant) : {};
}

export default async function HomePage() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
  const tenant = await getTenantClaimingHost(host);
  if (!tenant) redirect("/home");
  // Media-library references (mediaId) become plain src urls server-side.
  const resolved = await resolveTenantMediaConfig(tenant, { teamId: tenant.teamId });

  const { Component } = resolveTemplate(resolved);
  return <Component tenant={resolved} />;
}
