// DGTL Pass — the holder's Wallet copy, whichever provider signs it.
//
// walletwallet  WalletWallet signs with its own Pass Type ID (no Apple account);
//               the copy is created once and stored.
// apple         DGTL's own certificate: the exact design, signed on demand
//               from the pass row, so there is nothing to store.
// The pass page and routes are the same either way.

import { lockPassForWallet, markWalletIssued, recordWalletSync, saveWalletCopy, withTransaction } from "../store.js";
import { buildApplePass } from "./apple.js";
import { walletWalletImages } from "./images.js";
import { buildWalletWalletRequest, createWalletWalletPass, revokeWalletWalletPass, WalletProviderError } from "./walletwallet.js";

export { WalletProviderError };

/**
 * The signed .pkpass for a holder view (lib/passes/holderView.js). The first
 * call creates it at the provider; later calls return the stored copy, so a
 * second tap neither duplicates nor bills a second pass. The row lock makes
 * two simultaneous taps create one.
 */
const PLAN_REFUSALS = new Set([400, 402, 403]);

function issuedLabelFor(view) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: view.settings?.timeZone || "UTC", month: "short", day: "numeric", year: "numeric" }).format(
    new Date(view.pass.createdAt || Date.now())
  );
}

export async function getOrCreateWalletCopy(view, { fetchImpl = fetch } = {}) {
  const { config } = view;
  if (config.wallet.provider === "apple") {
    const pkpass = await buildApplePass(view, config.wallet.apple);
    await markWalletIssued({ passId: view.pass.id, provider: "apple" });
    return { pkpass, googleUrl: null, created: true };
  }
  if (config.wallet.provider !== "walletwallet") throw new WalletProviderError("No Wallet provider is configured.", 404);
  return withTransaction(async (tx) => {
    const locked = await lockPassForWallet(tx, view.pass.id);
    if (!locked) throw new WalletProviderError("Pass not found.", 404);
    if (locked.pkpass && locked.pass.walletProvider === "walletwallet") {
      return { pkpass: locked.pkpass, googleUrl: locked.pass.walletGoogleUrl, created: false };
    }
    const branding = config.wallet.walletwallet.branding;
    const base = {
      pass: locked.pass,
      passType: view.passType,
      holder: view.holder,
      design: view.design,
      validity: view.validity,
      kit: view.kit,
      passPageUrl: view.passPageUrl,
      now: view.now,
      issuedLabel: issuedLabelFor(view)
    };
    const request = buildWalletWalletRequest({ ...base, branding, images: branding === "full" ? await walletWalletImages(view.design) : null });
    let created;
    let warning = null;
    try {
      created = await createWalletWalletPass(config.wallet.walletwallet, request, fetchImpl);
    } catch (error) {
      // A key that is not on Pro refuses Pro fields. Issue the free-plan card
      // rather than leave the holder without Wallet, and say why on the pass.
      if (!(branding === "full" && error instanceof WalletProviderError && PLAN_REFUSALS.has(error.httpStatus))) throw error;
      created = await createWalletWalletPass(config.wallet.walletwallet, buildWalletWalletRequest({ ...base, branding: "preset" }), fetchImpl);
      warning = `Pro branding refused (${error.message}); issued with the free preset. Check the WalletWallet plan.`;
    }
    await saveWalletCopy(tx, { passId: view.pass.id, provider: "walletwallet", ...created, warning });
    return { pkpass: created.pkpass, googleUrl: created.googleUrl, created: true, warning };
  });
}

/**
 * Best effort after a revoke: the pass is already dead at the door (the scanner
 * asks the server), this only greys out the holder's Wallet copy. A provider
 * failure is recorded on the pass, never thrown at the admin.
 */
export async function revokeWalletCopy(pass, config, { fetchImpl = fetch } = {}) {
  // A DGTL-signed pass has no provider copy: it greys out through the Apple
  // web service (Phase 5b). The door refuses it either way.
  if (pass.walletProvider === "apple") return { skipped: "apple_updates_phase_5b" };
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
