"use client";

import dynamic from "next/dynamic";

// Off-default-tab admin panels, code-split so their JS loads only when the user
// opens that tab. AdminTabPanel unmounts inactive tabs (returns null), so these
// dynamic chunks aren't fetched until the tab is activated — trimming the
// initial /admin first-load JS. `ssr: false` is the lever that keeps them out
// of the server render; it requires this client boundary, since it isn't
// allowed inside the server-rendered admin page. A fixed-height card fallback
// reserves space to avoid layout shift while the chunk loads.
function PanelFallback() {
  return <div className="admin-panel" aria-busy="true" style={{ minHeight: 220 }} />;
}

// Options must be an inline object literal (Next's SWC transform requirement).
export const AccountsPanel = dynamic(() => import("./AccountsPanel"), { ssr: false, loading: PanelFallback });
export const CallsTable = dynamic(() => import("./CallsTable"), { ssr: false, loading: PanelFallback });
export const OutreachQueueBuilder = dynamic(() => import("./OutreachQueueBuilder"), { ssr: false, loading: PanelFallback });
export const TenantBuilder = dynamic(() => import("./TenantBuilder"), { ssr: false, loading: PanelFallback });
export const TenantEditor = dynamic(() => import("./TenantEditor"), { ssr: false, loading: PanelFallback });
export const TenantBrandingSettings = dynamic(() => import("./TenantBrandingSettings"), { ssr: false, loading: PanelFallback });
export const TenantPhoneSettings = dynamic(() => import("./TenantPhoneSettings"), { ssr: false, loading: PanelFallback });
