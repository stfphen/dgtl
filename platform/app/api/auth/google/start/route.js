import { NextResponse } from "next/server";
import { buildAuthorizeUrl, googleConfig, redirectUriFor } from "../../../../../lib/oauth/google";
import { OAUTH_TX_COOKIE, OAUTH_TX_TTL_MS, pkceChallenge, randomToken, safeNext, signTx } from "../../../../../lib/oauth/state";
import { clientIpFromRequest, consumeRateLimit } from "../../../../../lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const relative = (location) => new NextResponse(null, { status: 303, headers: { Location: location } });

// Step 1 of Google sign-in: mint state + nonce + PKCE, carry them in a signed
// 10-minute cookie scoped to the callback, and send the browser to Google.
export async function GET(request) {
  const rate = consumeRateLimit(`google-start:${clientIpFromRequest(request)}`, { limit: 20, windowMs: 60000 });
  if (!rate.allowed) return relative("/admin/login?error=rate_limited");

  const config = googleConfig();
  if (!config.enabled) return relative("/admin/login?error=google_unavailable");

  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken(48);
  const redirectUri = redirectUriFor(request.url, config);

  const response = NextResponse.redirect(
    buildAuthorizeUrl({ clientId: config.clientId, redirectUri, state, nonce, codeChallenge: pkceChallenge(codeVerifier) }),
    302
  );
  response.cookies.set(OAUTH_TX_COOKIE, signTx({ state, nonce, codeVerifier, redirectUri, next }, config.stateSecret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: OAUTH_TX_TTL_MS / 1000
  });
  return response;
}
