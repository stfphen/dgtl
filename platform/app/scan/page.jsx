import { redirect } from "next/navigation";
import Scanner from "../../components/scan/Scanner";
import { canUsePass, loadSession } from "../../lib/permissions";
import { sparkSvg, svgDataUri } from "../../lib/passes/art";
import { passesConfig } from "../../lib/passes/config";
import { passSettingsForTenant } from "../../lib/passes/settings";
import { TIER_PALETTE } from "../../lib/passes/tiers";
import { getSessionTeamId, listTenants } from "../../lib/store";

export const dynamic = "force-dynamic";

// The door scanner (docs/specs/dgtl-pass/06-scanner.md). Door staff land here
// after sign-in; workspace roles holding pass.verify can open it too.
export default async function ScanPage() {
  const session = await loadSession();
  if (!session) redirect("/admin/login");
  if (!canUsePass(session, "pass.verify")) redirect("/home");

  let configured = true;
  try {
    configured = passesConfig().enabled;
  } catch {
    configured = false;
  }
  const teamId = getSessionTeamId(session);
  const tenants = (await listTenants({ teamId })).filter((tenant) => tenant.teamId === teamId);
  const gates = [...new Set(tenants.flatMap((tenant) => passSettingsForTenant(tenant).gates))];

  return (
    <Scanner
      configured={configured}
      user={{ name: session.user?.name || session.email || "", role: session.role }}
      teamName={session.team?.name || ""}
      gates={gates.length ? gates : ["Main door"]}
      art={{
        spark: svgDataUri(sparkSvg(TIER_PALETTE.gold.accent)),
        tiers: {
          day: { accent: TIER_PALETTE.steel.accent, label: "Steel" },
          monthly: { accent: TIER_PALETTE.bronze.accent, label: "Bronze" },
          yearly: { accent: TIER_PALETTE.silver.accent, label: "Silver" },
          vip_lifetime: { accent: TIER_PALETTE.gold.accent, label: "VIP" },
          custom: { accent: TIER_PALETTE.steel.accent, label: "" }
        }
      }}
    />
  );
}
