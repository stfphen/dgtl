import { NextResponse } from "next/server";
import { logAudit } from "../../../../../lib/audit";
import { adminCookie, createSessionForUser, getAdminSessionForToken } from "../../../../../lib/auth";
import { exchangeCode, googleConfig, verifyIdToken } from "../../../../../lib/oauth/google";
import { resolveGoogleUser } from "../../../../../lib/oauth/identities";
import { OAUTH_TX_COOKIE, safeEqual, verifyTx } from "../../../../../lib/oauth/state";
import { isPassOnlyRole, passHomeFor } from "../../../../../lib/permissions";
import { clientIpFromRequest, consumeRateLimit } from "../../../../../lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Relative Location: the session cookie is host-scoped, so stay on this host.
function relative(location) {
  const response = new NextResponse(null, { status: 303, headers: { Location: location } });
  response.cookies.set(OAUTH_TX_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
  return response;
}

const fail = (code) => relative(`/admin/login?error=${code}`);

// Step 2 of Google sign-in. Every check fails closed to the login page.
export async function GET(request) {
  const rate = consumeRateLimit(`google-callback:${clientIpFromRequest(request)}`, { limit: 20, windowMs: 60000 });
  if (!rate.allowed) return fail("rate_limited");

  const config = googleConfig();
  if (!config.enabled) return fail("google_unavailable");

  const params = new URL(request.url).searchParams;
  if (params.get("error")) return fail("google_cancelled");

  const tx = verifyTx(request.cookies.get(OAUTH_TX_COOKIE)?.value, config.stateSecret);
  const code = params.get("code");
  if (!tx || !code || !safeEqual(params.get("state"), tx.state)) return fail("google_state");

  let claims;
  try {
    const idToken = await exchangeCode({
      code,
      codeVerifier: tx.codeVerifier,
      redirectUri: tx.redirectUri,
      clientId: config.clientId,
      clientSecret: config.clientSecret
    });
    claims = await verifyIdToken(idToken, { clientId: config.clientId, nonce: tx.nonce });
  } catch {
    return fail("google_failed");
  }

  let resolved;
  try {
    resolved = await resolveGoogleUser(claims);
  } catch {
    return fail("google_failed");
  }
  if (!resolved) return fail("google_no_access");

  const created = await createSessionForUser(resolved.user);
  const session = await getAdminSessionForToken(created.token);
  if (!session) return fail("google_failed");

  await logAudit({
    userId: resolved.user.id,
    action: "auth.login",
    targetType: "user",
    targetId: resolved.user.id,
    metadata: { method: "google", linkedNow: resolved.linkedNow, teamId: session.teamId || "" }
  }).catch(() => null);

  const landing = isPassOnlyRole(session.role) ? passHomeFor(session) : tx.next || "/home";
  const response = relative(landing);
  const cookie = adminCookie(created.token);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
