import { loadHolderPass, SHOWS_CODE } from "../../../../lib/passes/holderView";
import { getOrCreateWalletCopy, WalletProviderError } from "../../../../lib/passes/wallet";
import { clientIpFromRequest, consumeRateLimit } from "../../../../lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /p/<credential>/wallet.pkpass: the signed Apple Wallet pass.
// Same 404 as the page for anything it would not show a code for.
export async function GET(request, { params }) {
  const { credential } = await params;
  const limit = consumeRateLimit(`pass-wallet:${clientIpFromRequest(request)}`, { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return new Response("Too many requests.", { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

  const view = await loadHolderPass(credential);
  if (!view || !SHOWS_CODE.has(view.status) || !view.config.walletEnabled) return new Response("Not found.", { status: 404 });

  try {
    const copy = await getOrCreateWalletCopy(view);
    const name = view.kit.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pass";
    return new Response(copy.pkpass, {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${name}-pass.pkpass"`,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer"
      }
    });
  } catch (error) {
    if (!(error instanceof WalletProviderError)) throw error;
    console.error(`[passes] wallet copy failed for ${view.pass.id}: ${error.message}`);
    return new Response(null, { status: 303, headers: { Location: `/p/${view.credential}?wallet=unavailable` } });
  }
}
