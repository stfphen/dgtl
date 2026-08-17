import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, clearAdminCookie, deleteAdminSession } from "../../../../lib/auth";

export async function POST(request) {
  await deleteAdminSession(request.cookies.get(ADMIN_COOKIE_NAME)?.value);

  // Relative Location: stay on the host the user logged out from (the app
  // serves dgtl.chat and dgtlmag.com; the session cookie is host-scoped).
  const response = new NextResponse(null, { status: 303, headers: { Location: "/admin/login" } });
  const cookie = clearAdminCookie();
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
