import { NextResponse } from "next/server";
import { adminCookie, createAdminSession } from "../../../../lib/auth";
import { clientIpFromRequest, consumeRateLimit } from "../../../../lib/rateLimit";

const LOGIN_RATE_LIMIT = { limit: 10, windowMs: 60000 };

// All redirects here use a RELATIVE Location so the browser stays on whichever
// host it logged in from — this app serves dgtl.chat (the OS) and dgtlmag.com
// from one deployment, and the session cookie is host-scoped. Redirecting to
// PUBLIC_APP_URL would strand a dgtl.chat login on dgtlmag.com without its
// cookie.
const relative = (location, init = {}) =>
  new NextResponse(null, { status: 303, ...init, headers: { Location: location, ...(init.headers || {}) } });

export async function POST(request) {
  // Throttle login attempts per client IP to blunt brute-force / credential
  // stuffing against the (deliberately slow) bcrypt verify.
  const ip = clientIpFromRequest(request);
  const rate = consumeRateLimit(`login:${ip}`, LOGIN_RATE_LIMIT);
  if (!rate.allowed) {
    const tooMany = relative("/admin/login?error=rate_limited");
    tooMany.headers.set("Retry-After", String(rate.retryAfterSeconds));
    return tooMany;
  }

  const form = await request.formData();
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");

  const session = await createAdminSession(email, password);
  if (!session) {
    return relative("/admin/login?error=1");
  }

  const response = relative("/admin");
  const cookie = adminCookie(session.token);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
