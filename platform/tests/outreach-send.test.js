import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

// File-store isolation (à la tests/tenant-isolation.test.js). All sends use the
// dry-run/mock path so no real email is attempted and no fetch stub is needed.
const STORE_PATH = path.join(os.tmpdir(), `outreach-send-test-${process.pid}.json`);
process.env.APP_STORE_PATH = STORE_PATH;
process.env.PUBLIC_APP_URL = "https://demo.test";
delete process.env.DATABASE_URL;

const store = await import("../lib/store.js");
const { sendApprovedItems, drainDueOutreach, cronTokenAuthorized } = await import("../lib/outreach/sendQueue.js");
const { buildOutreachMetrics } = await import("../lib/outreachSequence.js");
const { signUnsubscribeToken, verifyUnsubscribeToken } = await import("../lib/outreach/unsubscribe.js");
const { defaultTenant } = await import("../lib/defaultTenant.js");

async function reset() {
  await rm(STORE_PATH, { force: true });
}

async function approvedItem(overrides = {}) {
  const lead = await store.createLead({
    businessName: overrides.businessName || "Co",
    email: overrides.email || "a@x.com",
    tenantId: "t1",
    ...overrides.lead
  });
  const item = await store.createOutreachQueueItem({
    leadId: lead.id,
    tenantId: "t1",
    campaignId: overrides.campaignId || "",
    status: "approved",
    step: overrides.step ?? 0,
    subject: "Hi",
    body: "Hello.",
    recipientEmail: lead.email,
    senderEmail: "me@dgtl.test",
    scheduledFor: overrides.scheduledFor || new Date(Date.now() - 1000).toISOString()
  });
  return { lead, item };
}

test("dry-run send marks item sent with a dryrun_ id and contacts the lead", async () => {
  await reset();
  const { lead, item } = await approvedItem();
  const res = await sendApprovedItems({ teamId: "", itemIds: [item.id], dryRun: true });
  assert.equal(res.sent, 1);
  const stored = await store.getOutreachQueueItem(item.id);
  assert.equal(stored.status, "sent");
  assert.match(stored.resendMessageId, /^dryrun_/);
  assert.equal((await store.getLeadById(lead.id)).outreachStatus, "contacted");
});

test("claim prevents a double send (second attempt on the same item is a no-op)", async () => {
  await reset();
  const { item } = await approvedItem();
  const first = await sendApprovedItems({ teamId: "", itemIds: [item.id], dryRun: true });
  const second = await sendApprovedItems({ teamId: "", itemIds: [item.id], dryRun: true });
  assert.equal(first.sent, 1);
  assert.equal(second.sent, 0, "already-sent item must not send again");
  assert.equal(second.skipped, 1);
});

test("a suppressed recipient is marked suppressed, not sent", async () => {
  await reset();
  const { item } = await approvedItem({ email: "stop@x.com" });
  await store.createOutreachSuppression({ email: "stop@x.com", reason: "unsubscribed" });
  const res = await sendApprovedItems({ teamId: "", itemIds: [item.id], dryRun: true });
  assert.equal(res.sent, 0);
  assert.equal(res.suppressed, 1);
  assert.equal((await store.getOutreachQueueItem(item.id)).status, "suppressed");
});

test("a lead that already replied is skipped (drip stop condition)", async () => {
  await reset();
  const { lead, item } = await approvedItem();
  await store.updateLead(lead.id, { outreachStatus: "replied", replyStatus: "replied" });
  const res = await sendApprovedItems({ teamId: "", itemIds: [item.id], dryRun: true });
  assert.equal(res.sent, 0);
  assert.equal(res.skipped, 1);
  assert.equal((await store.getOutreachQueueItem(item.id)).status, "skipped");
});

test("per-domain cap: second recipient on the same domain skips (manual) / defers (scheduled)", async () => {
  await reset();
  const campaign = await store.createOutreachCampaign({ name: "Capped", tenantId: "t1", dailySendCap: 25, perDomainDailyCap: 1 });
  const a = await approvedItem({ email: "a@same.com", campaignId: campaign.id });
  const b = await approvedItem({ email: "b@same.com", campaignId: campaign.id });

  const manual = await sendApprovedItems({ teamId: "", itemIds: [a.item.id, b.item.id], dryRun: true });
  assert.equal(manual.sent, 1, "first on the domain sends");
  assert.equal(manual.skipped, 1, "second on the domain hits the per-domain cap and skips");

  // Same scenario with deferOnCap keeps the capped item approved for next window.
  await reset();
  const c2 = await store.createOutreachCampaign({ id: "c2", name: "Capped2", tenantId: "t1", dailySendCap: 25, perDomainDailyCap: 1 });
  const c = await approvedItem({ email: "c@same.com", campaignId: c2.id });
  const d = await approvedItem({ email: "d@same.com", campaignId: c2.id });
  const scheduled = await sendApprovedItems({ teamId: "", itemIds: [c.item.id, d.item.id], dryRun: true, deferOnCap: true });
  assert.equal(scheduled.sent, 1);
  assert.equal(scheduled.deferred, 1);
  assert.equal((await store.getOutreachQueueItem(d.item.id)).status, "approved", "deferred item stays approved");
});

test("a successful send schedules a follow-up drip row (step 1, future-dated)", async () => {
  await reset();
  const tmpl = await store.createOutreachTemplate({ name: "F", subject: "Re {{businessName}}", body: "follow {{unsubscribeFooter}}", isActive: true });
  const campaign = await store.createOutreachCampaign({ name: "Drip", tenantId: "t1", followUpTemplateId: tmpl.id, followUpDelayDays: 3 });
  const { item } = await approvedItem({ campaignId: campaign.id });
  await sendApprovedItems({ teamId: "", itemIds: [item.id], dryRun: true });
  const followUps = (await store.listOutreachQueue({})).filter((q) => q.step === 1);
  assert.equal(followUps.length, 1);
  assert.equal(followUps[0].status, "approved");
  assert.ok(new Date(followUps[0].scheduledFor).getTime() > Date.now(), "follow-up is future-scheduled");
});

test("listDueQueueItems returns only past-due approved items", async () => {
  await reset();
  const past = await approvedItem({ email: "past@x.com", scheduledFor: new Date(Date.now() - 1000).toISOString() });
  const future = await approvedItem({ email: "future@x.com", scheduledFor: new Date(Date.now() + 3600e3).toISOString() });
  const due = await store.listDueQueueItems({});
  const ids = due.map((d) => d.id);
  assert.ok(ids.includes(past.item.id));
  assert.ok(!ids.includes(future.item.id));
});

test("cancelPendingOutreachForLead cancels queued/approved rows (eager drip cancel)", async () => {
  await reset();
  const { lead, item } = await approvedItem({ step: 1, scheduledFor: new Date(Date.now() + 3600e3).toISOString() });
  const n = await store.cancelPendingOutreachForLead(lead.id, { teamId: "", reason: "lead_replied" });
  assert.equal(n, 1);
  assert.equal((await store.getOutreachQueueItem(item.id)).status, "skipped");
});

test("approve transition (claim queued -> approved) only flips queued items", async () => {
  await reset();
  const lead = await store.createLead({ businessName: "Q", email: "q@x.com", tenantId: "t1" });
  const queued = await store.createOutreachQueueItem({ leadId: lead.id, tenantId: "t1", status: "queued", subject: "s", body: "b", recipientEmail: "q@x.com", senderEmail: "me@x.com", scheduledFor: new Date().toISOString() });
  const ok = await store.claimOutreachQueueItem(queued.id, { teamId: "", fromStatus: "queued", toStatus: "approved" });
  assert.equal(ok.status, "approved");
  const again = await store.claimOutreachQueueItem(queued.id, { teamId: "", fromStatus: "queued", toStatus: "approved" });
  assert.equal(again, null, "already-approved item cannot be re-approved from queued");
});

test("unsubscribe token round-trips and rejects tampering", () => {
  const token = signUnsubscribeToken({ email: "A@X.com", tenantId: "t1", teamId: "team_x" });
  assert.deepEqual(verifyUnsubscribeToken(token), { email: "a@x.com", tenantId: "t1", teamId: "team_x" });
  assert.equal(verifyUnsubscribeToken(token.slice(0, -2) + "zz"), null);
  assert.equal(verifyUnsubscribeToken("garbage"), null);
});

test("H4: an unsubscribe suppression is scoped to a team, not global-null", async () => {
  await reset();
  const teamTenant = await store.listTenants({ teamId: "team_default" });
  const tenantId = teamTenant[0]?.id;
  await store.createOutreachSuppression({ teamId: "team_default", tenantId, email: "x@scoped.com", reason: "unsubscribed" });

  const forOwningTeam = await store.listOutreachSuppressions({ teamId: "team_default" });
  assert.ok(forOwningTeam.some((s) => s.email === "x@scoped.com"), "owning team sees the suppression");

  const forOtherTeam = await store.listOutreachSuppressions({ teamId: "team_other" });
  assert.ok(!forOtherTeam.some((s) => s.email === "x@scoped.com"), "other teams must NOT inherit it (no tenant_id=NULL global row)");
});

test("cron token auth: rejects missing/wrong, accepts the configured token", () => {
  process.env.OUTREACH_CRON_TOKEN = "cron-secret";
  assert.equal(cronTokenAuthorized(""), false);
  assert.equal(cronTokenAuthorized("Bearer nope"), false);
  assert.equal(cronTokenAuthorized("Bearer cron-secret"), true);
  delete process.env.OUTREACH_CRON_TOKEN;
  assert.equal(cronTokenAuthorized("Bearer anything"), false, "unset token never authorizes");
});

test("drain sends past-due approved items (grouped per team)", async () => {
  await reset();
  // A past-due approved item on the real default-team tenant.
  const lead = await store.createLead({ businessName: "Due", email: "due@x.com", tenantId: defaultTenant.id });
  await store.createOutreachQueueItem({
    leadId: lead.id, tenantId: defaultTenant.id, status: "approved", step: 0,
    subject: "s", body: "b", recipientEmail: "due@x.com", senderEmail: "me@x.com",
    scheduledFor: new Date(Date.now() - 1000).toISOString()
  });

  const summary = await drainDueOutreach({ dryRun: true });
  assert.equal(summary.sent, 1, "the due item was sent by the drain");
  assert.equal((await store.getLeadById(lead.id)).outreachStatus, "contacted");
});

test("buildOutreachMetrics reflects sent counts after a batch", async () => {
  await reset();
  const a = await approvedItem({ email: "m1@x.com" });
  const b = await approvedItem({ email: "m2@y.com" });
  await sendApprovedItems({ teamId: "", itemIds: [a.item.id, b.item.id], dryRun: true });
  const metrics = buildOutreachMetrics({
    queue: await store.listOutreachQueue({}),
    events: await store.listOutreachEvents({}),
    leads: await store.listLeads({})
  });
  assert.equal(metrics.totalSent, 2);
  assert.equal(metrics.byStatus.sent, 2);
  await rm(STORE_PATH, { force: true });
});
