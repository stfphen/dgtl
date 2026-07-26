import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import { sanitizePublicLeadInput } from "../lib/leadUtils.js";

const STORE_PATH = path.join(os.tmpdir(), `public-lead-test-store-${process.pid}.json`);
process.env.APP_STORE_PATH = STORE_PATH;
delete process.env.DATABASE_URL;

const { createLead, getLeadById } = await import("../lib/store.js");

test("sanitizePublicLeadInput drops privileged/internal fields", () => {
  const clean = sanitizePublicLeadInput(
    {
      businessName: "Hacky Co",
      email: "x@hacky.test",
      teamId: "team_victim",
      pipelineStatus: "won",
      status: "won",
      leadScore: 999,
      assignedTo: "someone",
      assignedToUserId: "user_x",
      campaignId: "c1",
      doNotContact: true,
      metadata: { order: { status: "paid" } }
    },
    { source: "public_form" }
  );

  assert.equal(clean.businessName, "Hacky Co");
  assert.equal(clean.email, "x@hacky.test");
  assert.equal(clean.source, "public_form");
  for (const forbidden of [
    "teamId",
    "pipelineStatus",
    "status",
    "leadScore",
    "assignedTo",
    "assignedToUserId",
    "campaignId",
    "doNotContact",
    "metadata"
  ]) {
    assert.equal(clean[forbidden], undefined, `${forbidden} must be stripped`);
  }
});

test("public createLead cannot forge team, status, or score", async () => {
  await rm(STORE_PATH, { force: true });

  const lead = await createLead(
    sanitizePublicLeadInput(
      {
        businessName: "Honest Co",
        email: "y@honest.test",
        tenantId: "funded-growth",
        teamId: "team_victim",
        pipelineStatus: "won",
        leadScore: 999,
        assignedTo: "rep_x"
      },
      { source: "public_form" }
    )
  );

  assert.notEqual(lead.teamId, "team_victim", "team is resolved server-side, not from the body");
  assert.notEqual(lead.pipelineStatus, "won", "status is not client-forgeable");
  assert.notEqual(lead.leadScore, 999, "score is not client-forgeable");
  assert.equal(lead.assignedTo, "", "assignment is not client-forgeable");

  const stored = await getLeadById(lead.id);
  assert.equal(stored.pipelineStatus, "new");

  await rm(STORE_PATH, { force: true });
});
