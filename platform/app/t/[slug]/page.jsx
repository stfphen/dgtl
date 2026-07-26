import { resolveTemplate } from "../../../components/templates/registry";
import {
  getRenderableTenantConfig,
  getTenantBySlug,
  resolveTenantMediaConfig
} from "../../../lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  const config = getRenderableTenantConfig(tenant, "published");
  const template = resolveTemplate(config);
  // Funnel tenants return {} and keep inheriting the layout's static metadata.
  return template.buildMetadata ? template.buildMetadata(config) : {};
}

export default async function TenantPreviewPage({ params, searchParams }) {
  const { slug } = await params;
  const query = await searchParams;
  const tenant = await getTenantBySlug(slug);

  // ?preview=draft renders the unpublished draft snapshot (used by the admin
  // Tenant Builder); default renders the published config.
  const mode = query?.preview === "draft" ? "draft" : "published";
  const config = getRenderableTenantConfig(tenant, mode);
  // Media-library references (mediaId) become plain src urls server-side —
  // the page templates are client components and never talk to the store.
  const resolved = await resolveTenantMediaConfig(config, { teamId: tenant.teamId });

  const { Component } = resolveTemplate(resolved);
  return <Component tenant={resolved} />;
}
