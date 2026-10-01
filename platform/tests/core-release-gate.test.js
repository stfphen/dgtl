import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  ImportService,
  MemoryStage2Repository,
  OutreachService,
  PRODUCTION_AUTHORIZATION_PHRASE,
  contentHash,
  createConfiguredTransport,
  createResendTransport,
  createTestTransport,
  evaluateCoreRatePolicy,
  normalizeResendEvent,
  verifyResendWebhook
} from "../lib/stage2/index.js";

const T0 = "2026-08-14T12:00:00.000Z";
const ONE_ROW = "Company,Domain,Contact Name,Email,Recommended Approach Angle,Source\nAcme,acme.test,Ada Buyer,ada@acme.test,Lead with audit,release fixture";

function ids() {
  let value = 0;
  return (type) => `${type}_release_${++value}`;
}

async function queuedScenario({ repository = new MemoryStage2Repository(), now = () => T0, transport = createTestTransport(), ratePolicy, teamId = "team_a" } = {}) {
  const idFactory = ids();
  const actor = { id: "user_owner", role: "owner" };
  const importer = new ImportService({ teamId, actor, repository, now, idFactory });
  let batch = await importer.upload({ filename: "release.csv", content: ONE_ROW });
  batch = await importer.reviewRow(batch.id, batch.rows[0].id, "create_new");
  await importer.apply(batch.id);
  const opportunity = (await repository.listOpportunities(teamId))[0];
  const contact = (await repository.listContacts(teamId))[0];
  const outreach = new OutreachService({ teamId, actor, repository, transport, ratePolicy, now, idFactory });
  const campaign = await outreach.createCampaign({ name: "Release gate", sendingIdentity: { email: "test@dgtl.invalid" } });
  await outreach.addCohort(campaign.id, [{ opportunityId: opportunity.id, contactId: contact.id }]);
  const [message] = await outreach.draftMessages(campaign.id, { subject: "Hello", body: "Approved body" });
  await outreach.approveMessage(message.id);
  await outreach.approveCampaign(campaign.id);
  await outreach.queueMessage(message.id);
  return { repository, outreach, transport, campaign, contact, opportunity, message: await repository.getMessage(message.id, teamId), batch };
}

test("direct-ID attacks cannot cross team boundaries or forge team ownership", async () => {
  const scenario = await queuedScenario();
  const other = new OutreachService({ teamId: "team_b", actor: { id: "owner_b", role: "owner" }, repository: scenario.repository });
  const otherImports = new ImportService({ teamId: "team_b", actor: { id: "owner_b", role: "owner" }, repository: scenario.repository });
  assert.equal(await other.getCampaign(scenario.campaign.id), null);
  assert.equal(await otherImports.getBatch(scenario.batch.id), null);
  await assert.rejects(other.approveMessage(scenario.message.id), /not available/);
  await assert.rejects(other.queueMessage(scenario.message.id), /Only an approved/);
  await assert.rejects(otherImports.apply(scenario.batch.id), /not available/);
  const forged = await other.createCampaign({ name: "Forged", teamId: "team_a", tenantId: "" });
  assert.equal(forged.teamId, "team_b");
  scenario.repository.operationExceptions.push({ id: "exception_a", teamId: "team_a", status: "open" });
  await assert.rejects(other.resolveException("exception_a"), /not available/);
});

test("every Core API route derives team scope from the authenticated session", async () => {
  const routes = [
    "campaigns/[id]/approve", "campaigns/[id]/cohort", "campaigns/[id]/draft", "campaigns",
    "exceptions/[id]/resolve", "health", "imports/[id]/apply", "imports/[id]/map",
    "imports/[id]/reverse", "imports/[id]/rows/[rowId]", "imports", "messages/[id]/approve",
    "messages/[id]/queue", "messages/[id]/retry", "outbox/drain", "provider-events", "replies/associate"
  ];
  for (const route of routes) {
    const source = await readFile(path.join(process.cwd(), "app", "api", "core", route, "route.js"), "utf8");
    assert.match(source, /getSessionTeamId\(session\)/, `${route} must derive its team from the session`);
    assert.match(source, /require(?:CoreWrite|CoreApproval|Session)\(/, `${route} must authenticate`);
    assert.doesNotMatch(source, /(?:form\.get|payload\.)\(["']?teamId|form\.get\(["']teamId|payload\.teamId/, `${route} must not accept request-owned team scope`);
  }
});

test("campaign membership rejects another team's opportunity and contact IDs", async () => {
  const repository = new MemoryStage2Repository({
    companies: [{ id: "company_b", teamId: "team_b", displayName: "B" }],
    contacts: [{ id: "contact_b", teamId: "team_b", companyId: "company_b", email: "b@b.test", normalizedEmail: "b@b.test" }],
    opportunities: [{ id: "opportunity_b", teamId: "team_b", companyId: "company_b", primaryContactId: "contact_b", name: "B" }]
  });
  const service = new OutreachService({ teamId: "team_a", actor: { id: "owner_a", role: "owner" }, repository, idFactory: ids(), now: () => T0 });
  const campaign = await service.createCampaign({ name: "A" });
  await assert.rejects(service.addCohort(campaign.id, [{ opportunityId: "opportunity_b", contactId: "contact_b" }]), /available canonical/);
  assert.equal(repository.campaignMembers.length, 0);
});

test("simultaneous workers claim once and never duplicate delivery", async () => {
  const scenario = await queuedScenario();
  const second = new OutreachService({ teamId: "team_a", actor: { id: "worker", role: "system" }, repository: scenario.repository, transport: scenario.transport, now: () => T0, idFactory: ids() });
  const [left, right] = await Promise.all([
    scenario.outreach.processOutbox({ workerId: "worker_a" }),
    second.processOutbox({ workerId: "worker_b" })
  ]);
  assert.equal([...left, ...right].filter((item) => item.outcome === "sent").length, 1);
  assert.equal(scenario.transport.deliveries.length, 1);
  assert.equal(scenario.repository.deliveryAttempts.length, 1);
});

test("expired lease before an attempt is safely recovered and sent once", async () => {
  let clock = new Date(T0).getTime();
  const now = () => new Date(clock).toISOString();
  const scenario = await queuedScenario({ now });
  await scenario.repository.claimDueMessages("team_a", now(), 1, "crashed", new Date(clock - 300_000).toISOString(), 2);
  clock += 360_001;
  const result = await scenario.outreach.processOutbox({ workerId: "recovery" });
  assert.deepEqual(result.map((item) => item.outcome), ["sent"]);
  assert.equal(scenario.transport.deliveries.length, 1);
});

test("expired lease after delivery begins becomes uncertain and is never auto-retried", async () => {
  let clock = new Date(T0).getTime();
  const now = () => new Date(clock).toISOString();
  const scenario = await queuedScenario({ now });
  await scenario.repository.claimDueMessages("team_a", now(), 1, "crashed", new Date(clock - 300_000).toISOString(), 2);
  await scenario.repository.createDeliveryAttempt({ id: "attempt_crashed", teamId: "team_a", messageId: scenario.message.id, attemptNumber: 1, transport: "test", status: "sending", startedAt: now(), completedAt: null, metadata: {} });
  clock += 360_001;
  const result = await scenario.outreach.processOutbox({ workerId: "recovery" });
  assert.deepEqual(result, []);
  assert.equal((await scenario.repository.getMessage(scenario.message.id, "team_a")).queueState, "delivery_uncertain");
  assert.equal(scenario.transport.deliveries.length, 0);
  assert.ok(scenario.repository.operationExceptions.some((item) => item.exceptionType === "delivery_outcome_uncertain"));
});

test("provider timeout or thrown unknown result is quarantined without retry", async () => {
  const transport = { name: "test", mode: "test", authorized: true, async send() { throw new Error("timeout after request write"); } };
  const scenario = await queuedScenario({ transport });
  const result = await scenario.outreach.processOutbox();
  assert.deepEqual(result.map((item) => item.outcome), ["delivery_uncertain"]);
  assert.equal((await scenario.repository.getMessage(scenario.message.id, "team_a")).queueState, "delivery_uncertain");
  assert.equal(scenario.repository.deliveryAttempts[0].status, "outcome_unknown");
});

test("campaign pause, new suppression, contact change, and content change all stop queued sends", async (t) => {
  await t.test("paused campaign", async () => {
    const scenario = await queuedScenario();
    await scenario.repository.updateCampaign(scenario.campaign.id, "team_a", { status: "paused" });
    assert.equal((await scenario.outreach.processOutbox())[0].outcome, "campaign_paused");
    assert.equal(scenario.transport.deliveries.length, 0);
  });
  await t.test("suppression after queue", async () => {
    const scenario = await queuedScenario();
    await scenario.outreach.suppress({ email: scenario.contact.email, reason: "manual_suppression" });
    assert.equal((await scenario.outreach.processOutbox())[0].outcome, "suppressed");
    assert.equal(scenario.transport.deliveries.length, 0);
  });
  await t.test("contact changed after approval", async () => {
    const scenario = await queuedScenario();
    await scenario.repository.updateContact(scenario.contact.id, "team_a", { email: "changed@acme.test", normalizedEmail: "changed@acme.test" });
    assert.equal((await scenario.outreach.processOutbox())[0].outcome, "review_required");
    assert.equal(scenario.transport.deliveries.length, 0);
  });
  await t.test("message content changed after approval", async () => {
    const scenario = await queuedScenario();
    await scenario.repository.updateMessage(scenario.message.id, "team_a", { body: "Changed", renderedBody: "Changed", contentHash: contentHash("Hello", "Changed") });
    assert.equal((await scenario.outreach.processOutbox())[0].outcome, "review_required");
    assert.equal(scenario.transport.deliveries.length, 0);
  });
});

test("already-finalized messages are never reclaimed", async () => {
  const scenario = await queuedScenario();
  await scenario.repository.updateMessage(scenario.message.id, "team_a", { status: "sent", queueState: "sent", externalMessageId: "already", sentAt: T0 });
  assert.deepEqual(await scenario.outreach.processOutbox(), []);
  assert.equal(scenario.transport.deliveries.length, 0);
});

test("rate policy independently enforces team, account, domain, batch, concurrency, and retry concepts", async () => {
  const message = { senderEmail: "sender@dgtl.test", recipientEmail: "a@example.test" };
  const sent = [{ senderEmail: "sender@dgtl.test", recipientEmail: "b@example.test" }];
  assert.equal(evaluateCoreRatePolicy({ message, sentMessages: sent, policy: { teamDailyLimit: 1, sendingAccountDailyLimit: 9, recipientDomainDailyLimit: 9 } }).reason, "team_daily_limit");
  assert.equal(evaluateCoreRatePolicy({ message, sentMessages: sent, policy: { teamDailyLimit: 9, sendingAccountDailyLimit: 1, recipientDomainDailyLimit: 9 } }).reason, "sending_account_daily_limit");
  assert.equal(evaluateCoreRatePolicy({ message, sentMessages: sent, policy: { teamDailyLimit: 9, sendingAccountDailyLimit: 9, recipientDomainDailyLimit: 1 } }).reason, "recipient_domain_daily_limit");
  const reservationPolicy = { teamDailyLimit: 9, sendingAccountDailyLimit: 9, recipientDomainDailyLimit: 1 };
  const first = { id: "message_a", createdAt: T0, queueState: "sending", senderEmail: "sender@dgtl.test", recipientEmail: "a@example.test" };
  const second = { id: "message_b", createdAt: T0, queueState: "sending", senderEmail: "sender@dgtl.test", recipientEmail: "b@example.test" };
  assert.equal(evaluateCoreRatePolicy({ message: first, sentMessages: [first, second], policy: reservationPolicy }).allowed, true);
  assert.equal(evaluateCoreRatePolicy({ message: second, sentMessages: [first, second], policy: reservationPolicy }).reason, "recipient_domain_daily_limit");
  assert.equal(evaluateCoreRatePolicy({ message: second, sentMessages: [{ ...first, queueState: "delivery_uncertain", deliveryUncertainAt: T0 }], policy: reservationPolicy }).reason, "recipient_domain_daily_limit");
  const scenario = await queuedScenario({ ratePolicy: { teamDailyLimit: 50, sendingAccountDailyLimit: 25, recipientDomainDailyLimit: 1, batchLimit: 1, workerConcurrency: 1, retryBackoffBaseMs: 1000, retryBackoffMaxMs: 5000 } });
  assert.equal((await scenario.outreach.processOutbox({ limit: 50 })).length, 1);
});

test("production Resend transport requires multiple independent release gates", async () => {
  const base = { CORE_EMAIL_TRANSPORT: "resend", RESEND_API_KEY: "fixture" };
  assert.throws(() => createConfiguredTransport(base), /disabled/);
  const releaseId = "release-2026-08-14";
  const env = {
    ...base,
    CORE_PRODUCTION_SEND_ENABLED: "true",
    CORE_PRODUCTION_SEND_RELEASE_ID: releaseId,
    CORE_PRODUCTION_SEND_AUTHORIZATION: `${PRODUCTION_AUTHORIZATION_PHRASE}:${releaseId}`,
    CORE_RATE_POLICY_APPROVED: releaseId
  };
  const transport = createConfiguredTransport(env, { sendEmail: async () => ({ ok: true, data: { id: "resend_1" }, meta: {} }) });
  assert.equal(transport.authorized, true);
  const result = await transport.send({ idempotencyKey: "core-key", from: "a@dgtl.test", to: "b@example.test", subject: "Hi", body: "Body" });
  assert.equal(result.providerMessageId, "resend_1");
});

test("Resend adapter maps network ambiguity separately from deterministic provider rejection", async () => {
  const unknown = createResendTransport({ authorized: true, sendEmail: async () => ({ ok: false, error: "timeout", meta: {} }) });
  const rejected = createResendTransport({ authorized: true, sendEmail: async () => ({ ok: false, error: "bad sender", meta: { status: 400 } }) });
  assert.equal((await unknown.send({})).outcomeUnknown, true);
  assert.equal((await rejected.send({})).retryable, false);
});

test("signed Resend webhook verification rejects tampering and replay", () => {
  const secretBytes = Buffer.from("release-webhook-secret");
  const secret = `whsec_${secretBytes.toString("base64")}`;
  const id = "msg_webhook_1";
  const timestamp = "1786718400";
  const now = Number(timestamp) * 1000;
  const payload = JSON.stringify({ type: "email.bounced", created_at: T0, data: { email_id: "resend_1", bounce: { type: "Permanent" } } });
  const signature = `v1,${crypto.createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${payload}`).digest("base64")}`;
  assert.equal(verifyResendWebhook({ payload, id, timestamp, signature, secret, now }).type, "email.bounced");
  assert.equal(normalizeResendEvent(JSON.parse(payload), id).eventType, "bounced");
  assert.throws(() => verifyResendWebhook({ payload: `${payload} `, id, timestamp, signature, secret, now }), /signature/);
  assert.throws(() => verifyResendWebhook({ payload, id, timestamp, signature, secret, now: now + 301_000 }), /replay window/);
});

test("unmatched provider events are persisted idempotently and opened as exceptions", async () => {
  const repository = new MemoryStage2Repository();
  const service = new OutreachService({ teamId: "team_a", actor: { id: "provider:resend", role: "system" }, repository, idFactory: ids(), now: () => T0 });
  const input = { provider: "resend", providerEventId: "event_unmatched", providerMessageId: "missing", eventType: "bounced" };
  await service.recordProviderEvent(input);
  const duplicate = await service.recordProviderEvent(input);
  assert.equal(duplicate.duplicate, true);
  assert.equal(repository.providerEvents.length, 1);
  assert.equal(repository.operationExceptions.length, 1);
  assert.equal(repository.operationExceptions[0].exceptionType, "unmatched_provider_event");
});

test("authenticated health data can expose queue and worker state without secrets", async () => {
  const scenario = await queuedScenario();
  const before = await scenario.outreach.getHealth();
  assert.equal(before.pendingOutbox, 1);
  assert.equal(before.productionTransportEnabled, false);
  await scenario.outreach.processOutbox({ workerId: "health_worker" });
  const after = await scenario.outreach.getHealth();
  assert.equal(after.pendingOutbox, 0);
  assert.equal(after.lastSuccessfulWorkerCycle, T0);
});

test("release migration and repository declare additive schema and serialized worker claims", async () => {
  const sql = await readFile(path.join(process.cwd(), "migrations", "011_core_release_gate.sql"), "utf8");
  const repository = await readFile(path.join(process.cwd(), "lib", "stage2", "repository.js"), "utf8");
  for (const term of ["approved_recipient_email", "approved_sender_email", "delivery_uncertain_at", "core_worker_heartbeats", "messages_team_lease_idx", "campaign_members_contact_team_fkey"]) assert.match(sql, new RegExp(term));
  assert.doesNotMatch(sql, /\bdrop\s+(table|column)\b/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
  assert.match(sql, /not valid/i);
  assert.match(repository, /pg_advisory_xact_lock/);
});
