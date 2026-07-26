import { NextResponse } from "next/server";
import { adminCookie, createAdminSession } from "../../../../lib/auth";
import { clientIpFromRequest, consumeRateLimit } from "../../../../lib/rateLimit";

const LOGIN_RATE_LIMIT = { limit: 10, windowMs: 60000 };

export async function POST(request) {
  // Throttle login attempts per client IP to blunt brute-force / credential
  // stuffing against the (deliberately slow) bcrypt verify.
  const ip = clientIpFromRequest(request);
  const rate = consumeRateLimit(`login:${ip}`, LOGIN_RATE_LIMIT);
  if (!rate.allowed) {
    const tooMany = NextResponse.redirect(
      new URL("/admin/login?error=rate_limited", process.env.PUBLIC_APP_URL || request.url),
      303
    );
    tooMany.headers.set("Retry-After", String(rate.retryAfterSeconds));
    return tooMany;
  }

  const form = await request.formData();
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");

  const session = await createAdminSession(email, password);
  if (!session) {
    return NextResponse.redirect(new URL("/admin/login?error=1", process.env.PUBLIC_APP_URL || request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/admin", process.env.PUBLIC_APP_URL || request.url), 303);
  const cookie = adminCookie(session.token);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
