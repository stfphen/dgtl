import { NextResponse } from "next/server";
import { logAudit } from "../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../lib/permissions";
import {
  getSessionTeamId,
  listTargetAccounts,
  listAccountCampaigns,
  createTargetAccount
} from "../../../../lib/store";
import { scoreAccountFit } from "../../../../lib/enterpriseProspecting/index.js";

const WRITE_ROLES = ["owner", "admin", "sales"];

// GET: list target accounts (+ their campaigns) for the team.
export async function GET(request) {
  let session;
  try {
    session = await requireRole(WRITE_ROLES);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }
  const teamId = getSessionTeamId(session);
  if (!teamId) return NextResponse.json({ error: "Team context is required." }, { status: 403 });
  const [accounts, campaigns] = await Promise.all([
    listTargetAccounts({ teamId }),
    listAccountCampaigns({ teamId })
  ]);
  return NextResponse.json({ accounts, campaigns });
}

// POST: import selected accounts (from a search preview) into target_accounts.
// Body: { accounts: [previewObj, ...] }  (dedupes by domain within the team).
export async function POST(request) {
  let session;
  try {
    session = await requireRole(WRITE_ROLES);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }
  const teamId = getSessionTeamId(session);
  if (!teamId) return NextResponse.json({ error: "Team context is required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const incoming = Array.isArray(body?.accounts) ? body.accounts : body?.account ? [body.account] : [];
  if (!incoming.length) {
    return NextResponse.json({ error: "No accounts provided." }, { status: 400 });
  }
  if (incoming.length > 200) {
    return NextResponse.json({ error: "Too many accounts in one import (max 200)." }, { status: 400 });
  }

  const existing = await listTargetAccounts({ teamId });
  const existingDomains = new Set(existing.map((a) => (a.domain || "").toLowerCase()).filter(Boolean));

  const imported = [];
  const skipped = [];
  for (const raw of incoming) {
    const domain = String(raw?.domain || "").toLowerCase();
    if (domain && existingDomains.has(domain)) {
      skipped.push({ name: raw?.name, reason: "duplicate_domain" });
      continue;
    }
    // Recompute fit server-side (never trust client-sent scores).
    const fit = scoreAccountFit(raw);
    const account = await createTargetAccount({
      teamId,
      name: raw?.name || "Untitled Account",
      domain: raw?.domain || "",
      segment: raw?.segment || "",
      tier: fit.tier,
      fitScore: fit.fitScore,
      fitRationale: fit.rationale,
      firmographics: raw?.firmographics || {},
      signals: Array.isArray(raw?.signals) ? raw.signals : [],
      buyingCommittee: Array.isArray(raw?.buyingCommittee) ? raw.buyingCommittee : [],
      sourceType: raw?.sourceType || "manual",
      gateStatus: "sourced"
    });
    if (domain) existingDomains.add(domain);
    imported.push(account);
    await logAudit({
      userId: session.user?.id,
      action: "account.imported",
      targetType: "target_account",
      targetId: account.id,
      metadata: { teamId, name: account.name, domain: account.domain, segment: account.segment, fitScore: account.fitScore }
    });
  }

  return NextResponse.json({ imported, skipped });
}
