import { NextResponse } from "next/server";
import { OutreachService } from "../../../../lib/stage2/outreachService";
import { normalizeResendEvent, verifyResendWebhook } from "../../../../lib/stage2/resendWebhook";
import { requireStage2Repository } from "../../../../lib/stage2/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET || "";
  const teamId = process.env.CORE_PROVIDER_TEAM_ID || "";
  if (!secret || !teamId) return NextResponse.json({ error: "Resend webhook is not configured." }, { status: 503 });
  try {
    const payload = await request.text();
    const webhookId = request.headers.get("svix-id") || "";
    const event = verifyResendWebhook({
      payload,
      id: webhookId,
      timestamp: request.headers.get("svix-timestamp") || "",
      signature: request.headers.get("svix-signature") || "",
      secret
    });
    const normalized = normalizeResendEvent(event, webhookId);
    if (!normalized) return NextResponse.json({ received: true, ignored: true });
    const service = new OutreachService({ teamId, actor: { id: "provider:resend", role: "system" }, repository: requireStage2Repository() });
    const stored = await service.recordProviderEvent(normalized);
    return NextResponse.json({ received: true, duplicate: stored.duplicate === true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Resend webhook processing failed." }, { status: Number(error.status) || 500 });
  }
}
