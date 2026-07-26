import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, clearAdminCookie, deleteAdminSession } from "../../../../lib/auth";

export async function POST(request) {
  await deleteAdminSession(request.cookies.get(ADMIN_COOKIE_NAME)?.value);

  const response = NextResponse.redirect(new URL("/admin/login", process.env.PUBLIC_APP_URL || request.url), 303);
  const cookie = clearAdminCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
