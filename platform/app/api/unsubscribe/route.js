import { NextResponse } from "next/server";
import { createOutreachSuppression } from "../../../lib/store";
import { verifyUnsubscribeToken } from "../../../lib/outreach/unsubscribe";

export const runtime = "nodejs";

// Public unsubscribe endpoint. Requires a signed token (see lib/outreach/
// unsubscribe.js) so the suppression is scoped to the recipient's owning
// team/tenant — closing H4, where an unauthenticated GET could write a
// tenant_id=NULL row that suppressed an address for EVERY team.

function htmlPage(title, message, status = 200) {
  return new NextResponse(
    `<main style="font-family: system-ui, sans-serif; max-width: 680px; margin: 64px auto; padding: 0 20px;">
      <h1>${title}</h1>
      <p>${message}</p>
    </main>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function suppress(token) {
  const payload = verifyUnsubscribeToken(token);
  if (!payload || !payload.email) return false;
  await createOutreachSuppression({
    teamId: payload.teamId || undefined,
    tenantId: payload.tenantId || undefined,
    email: payload.email,
    reason: "unsubscribed"
  });
  return true;
}

// Browser click on the footer link.
export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const ok = await suppress(token);
  if (!ok) {
    return htmlPage("Invalid unsubscribe link", "This unsubscribe link is missing or invalid.", 400);
  }
  return htmlPage("Unsubscribe recorded", "You've been added to the do-not-contact list for this sender.");
}

// RFC 8058 one-click (List-Unsubscribe-Post) — email clients POST here directly.
export async function POST(request) {
  let token = new URL(request.url).searchParams.get("token") || "";
  if (!token) {
    const form = await request.formData().catch(() => null);
    token = form ? String(form.get("token") || "") : "";
  }
  const ok = await suppress(token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
