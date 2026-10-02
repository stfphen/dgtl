import { loadHolderPass, SHOWS_CODE } from "../../../../lib/passes/holderView";
import { getOrCreateWalletCopy, WalletProviderError } from "../../../../lib/passes/wallet";
import { clientIpFromRequest, consumeRateLimit } from "../../../../lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /p/<credential>/google-wallet: the provider issues one pass for both
// wallets, so this creates (or reuses) it and hands over Google's save link.
export async function GET(request, { params }) {
  const { credential } = await params;
  const limit = consumeRateLimit(`pass-wallet:${clientIpFromRequest(request)}`, { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return new Response("Too many requests.", { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  const view = await loadHolderPass(credential);
  if (!view || !SHOWS_CODE.has(view.status) || !view.config.walletEnabled) return new Response("Not found.", { status: 404 });

  try {
    const copy = await getOrCreateWalletCopy(view);
    if (!copy.googleUrl) throw new WalletProviderError("No Google Wallet link for this pass.");
    return new Response(null, { status: 303, headers: { Location: copy.googleUrl, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    if (!(error instanceof WalletProviderError)) throw error;
    console.error(`[passes] google wallet link failed for ${view.pass.id}: ${error.message}`);
    return new Response(null, { status: 303, headers: { Location: `/p/${view.credential}?wallet=unavailable` } });
  }
}
