import { permissionDeniedResponse } from "../permissions.js";

export function stage2ErrorResponse(error, request) {
  try { return permissionDeniedResponse(error, request); }
  catch {
    const status = Number(error?.status) || 400;
    return Response.json({ error: error?.message || "Stage 2 request failed." }, { status });
  }
}

export function redirectTo(request, pathname, notice = "") {
  const url = new URL(pathname, process.env.PUBLIC_APP_URL || request.url);
  if (notice) url.searchParams.set("notice", notice);
  return Response.redirect(url, 303);
}
