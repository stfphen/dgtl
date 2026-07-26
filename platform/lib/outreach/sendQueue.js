// Shared batch-send engine. Both the manual admin route and the scheduled drain
// endpoint call sendApprovedItems() so the send rules, cap counting, dry-run
// seam, and drip scheduling live in exactly one place.

import crypto from "node:crypto";
import { canSendQueueItem, renderOutreachTemplate, suggestFollowUpDate } from "../outreachSequence.js";
import { resolveDryRun, sendOutreachEmail } from "../integrations/emailProvider.js";
import { buildUnsubscribeUrl } from "./unsubscribe.js";
import {
  claimOutreachQueueItem,
  createOutreachEvent,
  createOutreachQueueItem,
  getLeadById,
  getTeamIdForTenant,
  listDueQueueItems,
  listLeads,
  listOutreachCampaigns,
  listOutreachQueue,
  listOutreachSuppressions,
  listOutreachTemplates,
  listTenants,
  updateLead,
  updateOutreachQueueItem
} from "../store.js";

const CAMPAIGN_FALLBACK = { dailySendCap: 100, perDomainDailyCap: 1 };
// Lead states in which a (follow-up) send must NOT go out.
const STOP_OUTREACH_STATUSES = new Set(["replied", "booked", "disqualified", "suppressed"]);

export function bodyToHtml(body = "") {
  return String(body)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function leadIsStopped(lead) {
  if (!lead) return false;
  if (lead.doNotContact) return true;
  if (lead.replyStatus) return true;
  return STOP_OUTREACH_STATUSES.has(lead.outreachStatus);
}

// Follow-ups fire at a fixed hour (≈9am America/Toronto = 13:00 UTC) rather than
// the date-only midnight-UTC suggestFollowUpDate returns, so they don't land at
// odd hours or a day early/late across a DST boundary.
function followUpScheduledFor(sentAt, delayDays) {
  const date = suggestFollowUpDate(new Date(sentAt), Number(delayDays) > 0 ? Number(delayDays) : 3);
  return `${date}T13:00:00.000Z`;
}

async function scheduleFollowUp({ item, lead, campaign, tenant, teamId }) {
  const followUpTemplateId = campaign?.followUpTemplateId;
  if (!followUpTemplateId || item.step !== 0) return null; // no drip, or already a follow-up

  const templates = await listOutreachTemplates({ teamId });
  const template = templates.find((t) => t.id === followUpTemplateId && t.isActive !== false);
  if (!template) return null; // configured template missing/inactive -> skip drip quietly

  const unsubscribeUrl = buildUnsubscribeUrl({ email: item.recipientEmail, tenantId: item.tenantId, teamId });
  const rendered = renderOutreachTemplate(template, { lead, tenant, senderName: "", unsubscribeUrl });
  const created = await createOutreachQueueItem({
    teamId,
    leadId: item.leadId,
    campaignId: item.campaignId,
    templateId: followUpTemplateId,
    tenantId: item.tenantId,
    status: "approved",
    step: 1,
    subject: rendered.subject,
    body: rendered.body,
    recipientEmail: item.recipientEmail,
    senderEmail: item.senderEmail,
    scheduledFor: followUpScheduledFor(item.sentAt || new Date().toISOString(), campaign.followUpDelayDays)
  });
  await createOutreachEvent({
    teamId,
    leadId: item.leadId,
    queueId: created.id,
    campaignId: item.campaignId,
    type: "queued",
    metadata: { note: "follow-up scheduled", parentQueueId: item.id, scheduledFor: created.scheduledFor }
  });
  return created;
}

/**
 * Send a batch of approved queue items.
 *
 * @param {object} opts
 * @param {string} opts.teamId
 * @param {string[]} opts.itemIds        queue item ids to attempt
 * @param {boolean} [opts.dryRun]        force mock send (else per-campaign/env)
 * @param {boolean} [opts.deferOnCap]    on a cap hit, reschedule +1 day instead of skipping (scheduled sends)
 * @returns {{sent, failed, skipped, suppressed, deferred, results:Array}}
 */
export async function sendApprovedItems({ teamId, itemIds = [], dryRun, deferOnCap = false } = {}) {
  const [queue, campaigns, suppressions, leads, tenants] = await Promise.all([
    listOutreachQueue({ teamId }),
    listOutreachCampaigns({ teamId }),
    listOutreachSuppressions({ teamId }),
    listLeads({ teamId }),
    listTenants({ teamId })
  ]);
  const queueSnapshot = [...queue];
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
  const tenantsById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

  const counts = { sent: 0, failed: 0, skipped: 0, suppressed: 0, deferred: 0 };
  const results = [];
  const record = (id, outcome, reason = "") => {
    counts[outcome] = (counts[outcome] || 0) + 1;
    results.push({ id, outcome, reason });
  };

  for (const queueId of itemIds) {
    const snapshotItem = queueSnapshot.find((candidate) => candidate.id === queueId);
    if (!snapshotItem || snapshotItem.status !== "approved") {
      record(queueId, "skipped", "not_approved");
      continue;
    }

    // Atomic claim (approved -> sending). Loser of a race gets null and is skipped.
    const item = await claimOutreachQueueItem(queueId, { teamId });
    if (!item) {
      record(queueId, "skipped", "already_claimed");
      continue;
    }
    // Keep the snapshot entry live for cap counting further down the batch.
    Object.assign(snapshotItem, item);

    const campaign = campaigns.find((candidate) => candidate.id === item.campaignId) || CAMPAIGN_FALLBACK;

    // Re-read the lead so a reply/booking/opt-out that landed after scheduling
    // cancels a follow-up (and any late change on an intro).
    const lead = (await getLeadById(item.leadId, { teamId })) || leadsById.get(item.leadId) || null;
    if (leadIsStopped(lead)) {
      await finalize(item, snapshotItem, "skipped", { failureReason: "lead_stopped", teamId });
      await logEvent({ teamId, item, type: "skipped", metadata: { reason: "lead_stopped" } });
      record(queueId, "skipped", "lead_stopped");
      continue;
    }

    // The item is now leased ("sending"); check eligibility against its pre-claim
    // status so canSendQueueItem's approved/queued gate passes.
    const sendCheck = canSendQueueItem({
      item: { ...item, status: "approved" },
      queue: queueSnapshot,
      campaign,
      suppressions
    });
    if (!sendCheck.ok) {
      const capHit = sendCheck.reason === "daily_cap_reached" || sendCheck.reason === "per_domain_daily_cap_reached";
      if (capHit && deferOnCap) {
        // Reschedule for the next window; stays approved so the next drain retries.
        const nextDay = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        await updateOutreachQueueItem(item.id, { status: "approved", scheduledFor: nextDay }, { teamId });
        Object.assign(snapshotItem, { status: "approved", scheduledFor: nextDay });
        record(queueId, "deferred", sendCheck.reason);
        continue;
      }
      const outcome = sendCheck.reason === "suppressed" ? "suppressed" : "skipped";
      await finalize(item, snapshotItem, outcome, { failureReason: sendCheck.reason, teamId });
      await logEvent({ teamId, item, type: outcome, metadata: { reason: sendCheck.reason } });
      record(queueId, outcome, sendCheck.reason);
      continue;
    }

    const effectiveDryRun = resolveDryRun({ dryRun, campaign });
    const unsubscribeUrl = buildUnsubscribeUrl({ email: item.recipientEmail, tenantId: item.tenantId, teamId });
    let result;
    try {
      result = await sendOutreachEmail(
        {
          // Fall back to a configured verified sender if the item has none.
          from: item.senderEmail || process.env.RESEND_FROM || "",
          to: item.recipientEmail,
          subject: item.subject,
          text: item.body,
          html: bodyToHtml(item.body),
          headers: unsubscribeUrl
            ? {
                "List-Unsubscribe": `<${unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
              }
            : undefined
        },
        { dryRun: effectiveDryRun }
      );
    } catch (error) {
      result = { ok: false, error: error?.message || "Send threw." };
    }

    if (result.ok) {
      const sentAt = new Date().toISOString();
      const resendMessageId = result.data?.id || result.data?.message_id || "";
      await finalize(item, snapshotItem, "sent", { sentAt, resendMessageId, teamId });
      item.sentAt = sentAt;
      await updateLead(item.leadId, {
        outreachStatus: "contacted",
        pipelineStatus: "contacted",
        lastContactedAt: sentAt,
        nextFollowUpAt: suggestFollowUpDate(new Date(sentAt), campaign.followUpDelayDays),
        campaignId: item.campaignId
      }, { teamId });
      await logEvent({
        teamId,
        item,
        type: "sent",
        metadata: { subject: item.subject, recipientEmail: item.recipientEmail, resendMessageId, dryRun: effectiveDryRun }
      });
      const tenant = tenantsById.get(item.tenantId) || {};
      await scheduleFollowUp({ item, lead, campaign, tenant, teamId });
      record(queueId, "sent", effectiveDryRun ? "dry_run" : "");
    } else {
      const failureReason = result.error || result.reason || "Send failed.";
      await finalize(item, snapshotItem, "failed", { failureReason, teamId });
      await logEvent({ teamId, item, type: "failed", metadata: { reason: failureReason, configured: result.configured } });
      record(queueId, "failed", failureReason);
    }
  }

  return { ...counts, results };
}

async function finalize(item, snapshotItem, status, { sentAt = "", resendMessageId = "", failureReason = "", teamId } = {}) {
  const updates = { status };
  if (sentAt) updates.sentAt = sentAt;
  updates.failureReason = failureReason;
  if (resendMessageId) updates.resendMessageId = resendMessageId;
  const next = await updateOutreachQueueItem(item.id, updates, { teamId });
  Object.assign(item, next || {}, { status });
  if (snapshotItem) Object.assign(snapshotItem, { status, sentAt: sentAt || snapshotItem.sentAt });
}

async function logEvent({ teamId, item, type, metadata }) {
  await createOutreachEvent({
    teamId,
    leadId: item.leadId,
    queueId: item.id,
    campaignId: item.campaignId,
    type,
    metadata
  });
}

/**
 * Constant-time check of a cron bearer token against OUTREACH_CRON_TOKEN.
 * Returns false when the env var is unset (never allow when unconfigured).
 */
export function cronTokenAuthorized(authHeader = "") {
  const expected = process.env.OUTREACH_CRON_TOKEN || "";
  if (!expected) return false;
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled-send drain core: send all approved queue items whose scheduledFor
 * has passed, grouped per team so cap math + scoping stay correct. Scheduled
 * sends defer (not skip) on a cap hit. Idempotent via the claim CAS.
 */
export async function drainDueOutreach({ dryRun = false, limit = 200 } = {}) {
  const due = await listDueQueueItems({ limit });
  const idsByTeam = new Map();
  const teamCache = new Map();
  for (const item of due) {
    let teamId = teamCache.get(item.tenantId);
    if (teamId === undefined) {
      teamId = await getTeamIdForTenant(item.tenantId);
      teamCache.set(item.tenantId, teamId);
    }
    if (!idsByTeam.has(teamId)) idsByTeam.set(teamId, []);
    idsByTeam.get(teamId).push(item.id);
  }

  const totals = { processed: due.length, sent: 0, failed: 0, skipped: 0, suppressed: 0, deferred: 0 };
  const byTeam = {};
  for (const [teamId, itemIds] of idsByTeam) {
    const summary = await sendApprovedItems({ teamId, itemIds, dryRun, deferOnCap: true });
    byTeam[teamId] = summary;
    for (const key of ["sent", "failed", "skipped", "suppressed", "deferred"]) {
      totals[key] += summary[key] || 0;
    }
  }
  return { ...totals, byTeam };
}
