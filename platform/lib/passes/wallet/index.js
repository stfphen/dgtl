// DGTL Pass — the holder's Wallet copy, whichever provider signs it.
//
// Today that is WalletWallet (no Apple Developer account needed). DGTL's own
// certificate (build-plan Phase 5) slots in here as a second provider; the
// pass page and routes do not change.

import { lockPassForWallet, recordWalletSync, saveWalletCopy, withTransaction } from "../store.js";
import { buildWalletWalletRequest, createWalletWalletPass, revokeWalletWalletPass, WalletProviderError } from "./walletwallet.js";

export { WalletProviderError };

/**
 * The signed .pkpass for a holder view (lib/passes/holderView.js). The first
 * call creates it at the provider; later calls return the stored copy, so a
 * second tap neither duplicates nor bills a second pass. The row lock makes
 * two simultaneous taps create one.
 */
export async function getOrCreateWalletCopy(view, { fetchImpl = fetch } = {}) {
  const { config } = view;
  if (config.wallet.provider !== "walletwallet") throw new WalletProviderError("No Wallet provider is configured.", 404);
  return withTransaction(async (tx) => {
    const locked = await lockPassForWallet(tx, view.pass.id);
    if (!locked) throw new WalletProviderError("Pass not found.", 404);
    if (locked.pkpass && locked.pass.walletProvider === "walletwallet") {
      return { pkpass: locked.pkpass, googleUrl: locked.pass.walletGoogleUrl, created: false };
    }
    const request = buildWalletWalletRequest({
      pass: locked.pass,
      passType: view.passType,
      holder: view.holder,
      design: view.design,
      validity: view.validity,
      kit: view.kit,
      passPageUrl: view.passPageUrl,
      now: view.now,
      branding: config.wallet.walletwallet.branding,
      logoUrl: view.kit.logoUrl
    });
    const created = await createWalletWalletPass(config.wallet.walletwallet, request, fetchImpl);
    await saveWalletCopy(tx, { passId: view.pass.id, provider: "walletwallet", ...created });
    return { pkpass: created.pkpass, googleUrl: created.googleUrl, created: true };
  });
}

/**
 * Best effort after a revoke: the pass is already dead at the door (the scanner
 * asks the server), this only greys out the holder's Wallet copy. A provider
 * failure is recorded on the pass, never thrown at the admin.
 */
export async function revokeWalletCopy(pass, config, { fetchImpl = fetch } = {}) {
  if (pass.walletProvider !== "walletwallet" || !pass.walletRef) return { skipped: "no_wallet_copy" };
  if (!config.wallet.walletwallet) {
    await recordWalletSync({ passId: pass.id, error: "Revoked here, but WalletWallet is no longer configured to revoke the Wallet copy." });
    return { skipped: "provider_not_configured" };
  }
  try {
    await revokeWalletWalletPass(config.wallet.walletwallet, pass.walletRef, fetchImpl);
    await recordWalletSync({ passId: pass.id });
    return { revoked: true };
  } catch (error) {
    await recordWalletSync({ passId: pass.id, error: error.message });
    return { error: error.message };
  }
}
