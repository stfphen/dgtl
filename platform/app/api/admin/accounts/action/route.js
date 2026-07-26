import { NextResponse } from "next/server";
import { logAudit } from "../../../../../lib/audit";
import { permissionDeniedResponse, requireRole } from "../../../../../lib/permissions";
import {
  getSessionTeamId,
  getTargetAccountById,
  updateTargetAccount,
  createAccountCampaign,
  updateAccountCampaign,
  listAccountCampaigns,
  createLead,
  requireTenantAccess
} from "../../../../../lib/store";
import {
  scoreAccountFit,
  assertGateTransition,
  isGateAtOrAfter,
  researchAccountOffline,
  patchFromResearchLeadDossier,
  buildCampaignConcept,
  buildLeadInputsFromAccount,
  assertCanFeedOutreach,
  enrichAccountContacts,
  GATE1_APPROVED,
  GATE_RESEARCHED,
  GATE_SCOPED,
  GATE2_APPROVED,
  GATE_IN_OUTREACH
} from "../../../../../lib/enterpriseProspecting/index.js";
import { researchLead } from "../../../../../lib/leadResearch/researchLead.js";

// The research action may call the AI backend, so allow extra time + dynamic.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const WRITE_ROLES = ["owner", "admin", "sales"];

function gateError(error) {
  // gate-transition / guard errors carry a numeric status.
  return typeof error?.status === "number" ? error.status : 500;
}

export async function POST(request) {
  let session;
  try {
    session = await requireRole(WRITE_ROLES);
  } catch (error) {
    return permissionDeniedResponse(error, request);
  }
  const teamId = getSessionTeamId(session);
  if (!teamId) return NextResponse.json({ error: "Team context is required." }, { status: 403 });
  const userId = session.user?.id;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "");
  const accountId = String(body?.accountId || "");

  if (!accountId) return NextResponse.json({ error: "accountId is required." }, { status: 400 });

  const account = await getTargetAccountById(accountId, { teamId });
  if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  try {
    switch (action) {
      case "score": {
        const fit = scoreAccountFit(account);
        const updated = await updateTargetAccount(
          accountId,
          { tier: fit.tier, fitScore: fit.fitScore, fitRationale: fit.rationale },
          { teamId }
        );
        await logAudit({
          userId,
          action: "account.scored",
          targetType: "target_account",
          targetId: accountId,
          metadata: { teamId, fitScore: fit.fitScore, tier: fit.tier }
        });
        return NextResponse.json({ account: updated, fit });
      }

      case "approve": {
        // GATE 1: approve account + tier.
        assertGateTransition(account.gateStatus, GATE1_APPROVED);
        const updated = await updateTargetAccount(
          accountId,
          { gateStatus: GATE1_APPROVED, approvedBy: userId || "", approvedAt: new Date().toISOString() },
          { teamId }
        );
        await logAudit({
          userId,
          action: "account.gate1_approved",
          targetType: "target_account",
          targetId: accountId,
          metadata: { teamId, name: account.name, tier: account.tier }
        });
        return NextResponse.json({ account: updated, gate: 1 });
      }

      case "research": {
        if (!isGateAtOrAfter(account.gateStatus, GATE1_APPROVED)) {
          return NextResponse.json({ error: "Account must clear Gate 1 before research." }, { status: 409 });
        }
        // 1) Real contact + firmographic enrichment (Apollo + Hunter + EDGAR).
        //    Degrades gracefully (no keys / no domain -> returns what it can).
        const enrichment = await enrichAccountContacts({ account });

        // 2) Web research for signals via Claude, with offline fallback.
        let signals = account.signals || [];
        let dossier;
        let mode = "offline";
        try {
          const aiDossier = await researchLead({
            businessName: account.name,
            website: account.domain ? (/^https?:\/\//i.test(account.domain) ? account.domain : `https://${account.domain}`) : "",
            city: account.firmographics?.hqGeo || "",
            category: account.firmographics?.industry || ""
          });
          dossier = aiDossier;
          const aiPatch = patchFromResearchLeadDossier(aiDossier);
          if (aiPatch.signals?.length) signals = aiPatch.signals;
          mode = "ai";
          // If contact enrichment found nobody, fall back to AI-derived decision-makers.
          if (!enrichment.buyingCommittee?.length && aiPatch.buyingCommittee?.length) {
            enrichment.buyingCommittee = aiPatch.buyingCommittee;
          }
        } catch (researchError) {
          const off = researchAccountOffline(account);
          dossier = off.dossier;
          if ((!signals || !signals.length) && off.patch.signals?.length) signals = off.patch.signals;
          mode = "offline";
        }

        // 3) Merge: prefer real-enriched committee; keep prior if providers found none.
        const committee = enrichment.buyingCommittee?.length ? enrichment.buyingCommittee : account.buyingCommittee || [];
        const firmographics = { ...(account.firmographics || {}), ...(enrichment.firmographicsPatch || {}) };
        const dataGaps = [];
        if (!committee.some((c) => c.emailStatus === "verified")) dataGaps.push("No verified email yet — verify before outreach.");
        if (committee.some((c) => !c.name)) dataGaps.push("Some committee roles unnamed.");
        if (!signals.length) dataGaps.push("No timing signals yet.");

        const nextStatus = account.gateStatus === GATE1_APPROVED ? GATE_RESEARCHED : account.gateStatus;
        const updated = await updateTargetAccount(
          accountId,
          { buyingCommittee: committee, signals, firmographics, dossier, dataGaps, gateStatus: nextStatus },
          { teamId }
        );
        await logAudit({
          userId,
          action: "account.researched",
          targetType: "target_account",
          targetId: accountId,
          metadata: { teamId, mode, signals: signals.length, committee: committee.length, contactSources: (enrichment.sources || []).map((s) => `${s.provider}:${s.ok ? s.count || "ok" : "off"}`).join(",") }
        });
        return NextResponse.json({ account: updated, mode, contactSources: enrichment.sources, dossier });
      }

      case "scope": {
        if (!isGateAtOrAfter(account.gateStatus, GATE_RESEARCHED)) {
          return NextResponse.json({ error: "Research the account before scoping a campaign." }, { status: 409 });
        }
        const concept = buildCampaignConcept({ account, serviceFocus: String(body?.serviceFocus || "") });
        const campaign = await createAccountCampaign({
          teamId,
          accountId,
          name: concept.name,
          bigIdea: concept.bigIdea,
          deliverables: concept.deliverables,
          budgetBand: concept.budgetBand,
          budgetRationale: concept.budgetRationale,
          successMetric: concept.successMetric,
          outreachOpener: concept.outreachOpener,
          status: "draft"
        });
        const nextStatus = account.gateStatus === GATE_RESEARCHED ? GATE_SCOPED : account.gateStatus;
        const updated = await updateTargetAccount(accountId, { gateStatus: nextStatus }, { teamId });
        await logAudit({
          userId,
          action: "account.scoped",
          targetType: "target_account",
          targetId: accountId,
          metadata: { teamId, campaignId: campaign.id, budgetBand: campaign.budgetBand }
        });
        return NextResponse.json({ account: updated, campaign });
      }

      case "approve-campaign": {
        // GATE 2: verify contacts + approve campaign, then promote contacts into
        // the existing lead pipeline (which feeds the human-approved outreach queue).
        const campaignId = String(body?.campaignId || "");
        if (!campaignId) return NextResponse.json({ error: "campaignId is required." }, { status: 400 });

        // If a tenant is supplied to tag promoted leads, it must belong to this team.
        const promoteTenantId = String(body?.tenantId || "");
        if (promoteTenantId) await requireTenantAccess(teamId, promoteTenantId);

        const campaigns = await listAccountCampaigns({ teamId, accountId });
        const campaign = campaigns.find((c) => c.id === campaignId);
        if (!campaign) return NextResponse.json({ error: "Campaign not found for this account." }, { status: 404 });

        assertGateTransition(account.gateStatus, GATE2_APPROVED);
        await updateAccountCampaign(
          campaignId,
          { status: "gate2_approved", approvedBy: userId || "", approvedAt: new Date().toISOString() },
          { teamId }
        );
        const gate2Account = await updateTargetAccount(
          accountId,
          { gateStatus: GATE2_APPROVED, approvedBy: userId || "", approvedAt: new Date().toISOString() },
          { teamId }
        );

        // Defense in depth: only feed outreach once Gate 2 is cleared.
        assertCanFeedOutreach(gate2Account);

        const leadInputs = buildLeadInputsFromAccount({
          account: gate2Account,
          teamId,
          tenantId: promoteTenantId,
          campaign
        });
        const createdLeads = [];
        for (const input of leadInputs) {
          const lead = await createLead(input);
          // A skipped-duplicate return is an existing lead, not a newly promoted
          // committee member — don't count or re-log it as a promotion.
          if (lead.skippedDuplicate) continue;
          createdLeads.push(lead);
          await logAudit({
            userId,
            action: "lead.imported",
            targetType: "lead",
            targetId: lead.id,
            metadata: {
              teamId,
              provider: "enterprise_prospecting",
              accountId,
              campaignId,
              emailStatus: input.metadata?.emailStatus,
              needsVerification: input.metadata?.needsVerification
            }
          });
        }

        const finalAccount = await updateTargetAccount(accountId, { gateStatus: GATE_IN_OUTREACH }, { teamId });
        await logAudit({
          userId,
          action: "account.gate2_approved",
          targetType: "target_account",
          targetId: accountId,
          metadata: { teamId, campaignId, contactsPromoted: createdLeads.length }
        });
        return NextResponse.json({
          account: finalAccount,
          campaign: { ...campaign, status: "gate2_approved" },
          promotedLeads: createdLeads.length,
          leads: createdLeads.map((l) => ({ id: l.id, businessName: l.businessName, contactName: l.contactName, email: l.email }))
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Account action failed." },
      { status: gateError(error) }
    );
  }
}
