import { redirect } from "next/navigation";
import { PageHeader } from "../../../components/core/CoreUi";
import PassesWorkspace from "../../../components/passes/PassesWorkspace";
import { getCorePageContext } from "../../../lib/core/server";
import { canUsePass } from "../../../lib/permissions";
import { passesConfig } from "../../../lib/passes/config";
import { passesDatabaseAvailable } from "../../../lib/passes/store";
import { TIER_PALETTE } from "../../../lib/passes/tiers";
import { listTenants } from "../../../lib/store";
import "./passes.css";

export const metadata = { title: "Passes" };
export const dynamic = "force-dynamic";

// Tier → accent, from lib/passes/tiers.js (the kit's tier palette), so the
// client never hardcodes a tier colour.
const TIER_ACCENTS = {
  day: TIER_PALETTE.steel.accent,
  monthly: TIER_PALETTE.bronze.accent,
  yearly: TIER_PALETTE.silver.accent,
  vip_lifetime: TIER_PALETTE.gold.accent,
  custom: TIER_PALETTE.steel.accent
};

export default async function PassesPage() {
  const { session, teamId } = await getCorePageContext();
  if (!canUsePass(session, "pass.view")) redirect("/home");

  let config = null;
  let configError = null;
  try {
    config = passesConfig();
  } catch (error) {
    configError = error.message;
  }
  const tenants = (await listTenants({ teamId }))
    .filter((tenant) => tenant.teamId === teamId)
    .map((tenant) => ({ id: tenant.id, name: tenant.brand?.name || tenant.name || tenant.slug }));

  return (
    <div className="core-page passes-page">
      <PageHeader
        eyebrow="DGTL Core · Operate"
        title="Passes"
        description="Issue branded passes, open them on a phone, and watch the door. Every scan is checked live against this list."
      />
      <PassesWorkspace
        tenants={tenants}
        tierAccents={TIER_ACCENTS}
        caps={{
          issue: canUsePass(session, "pass.issue"),
          revoke: canUsePass(session, "pass.revoke"),
          configure: canUsePass(session, "pass.configure"),
          verify: canUsePass(session, "pass.verify")
        }}
        status={{
          database: passesDatabaseAvailable(),
          enabled: Boolean(config?.enabled),
          baseUrl: config?.baseUrl || null,
          walletEnabled: Boolean(config?.walletEnabled),
          walletProvider: config?.wallet?.provider || null,
          walletBranding: config?.wallet?.walletwallet?.branding || null,
          configError
        }}
      />
    </div>
  );
}
