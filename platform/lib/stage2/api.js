import { permissionDeniedResponse } from "../permissions.js";

export function stage2ErrorResponse(error, request) {
  try { return permissionDeniedResponse(error, request); }
  catch {
    const status = Number(error?.status) || 400;
    return Response.json({ error: error?.message || "Stage 2 request failed." }, { status });
  }
}

export function redirectTo(request, pathname, notice = "") {
  // Relative Location — host-preserving across dgtl.chat and dgtlmag.com.
  const target = notice ? `${pathname}${pathname.includes("?") ? "&" : "?"}notice=${encodeURIComponent(notice)}` : pathname;
  return new Response(null, { status: 303, headers: { Location: target } });
}
