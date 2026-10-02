import { requirePassCapability } from "../../../../../lib/permissions";
import { auditPass, passErrorResponse, requirePassesReady } from "../../../../../lib/passes/http";
import { PassError, revokePass, withTransaction } from "../../../../../lib/passes/store";
import { getSessionTeamId } from "../../../../../lib/store";
import { revokeWalletCopy } from "../../../../../lib/passes/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/passes/action · { action: "revoke", passId, reason } · pass.revoke.
// Suspend / reactivate / rotate / extend / resend follow in later phases.
export async function POST(request) {
  try {
    // revoke is the only action so far, so its capability is checked first.
    const session = await requirePassCapability("pass.revoke");
    const body = await request.json().catch(() => ({}));
    if (body.action !== "revoke") throw new PassError("action_unsupported", "Only revoke is available yet.", 400, "action");
    const config = requirePassesReady();
    const teamId = getSessionTeamId(session);
    const reason = String(body.reason || "").trim().slice(0, 200) || null;

    const pass = await withTransaction((tx) =>
      revokePass(tx, { passId: String(body.passId || ""), teamId, revokedBy: session.user?.id || null, reason })
    );
    if (!pass) throw new PassError("pass_not_found", "Pass not found or already revoked.", 404, "passId");

    // The door refuses it from this moment (the scanner asks the server).
    // Greying out the holder's Wallet copy is best effort on top.
    const wallet = await revokeWalletCopy(pass, config);
    await auditPass(session, "pass.revoke", pass.id, { reason, wallet: wallet.revoked ? "revoked" : wallet.skipped || "error" });
    return Response.json({ pass: { id: pass.id, status: pass.status, effectiveStatus: "revoked" }, wallet });
  } catch (error) {
    return passErrorResponse(error, request);
  }
}
