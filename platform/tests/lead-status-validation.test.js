import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import { normalizePipelineStatus } from "../lib/leadUtils.js";

const STORE_PATH = path.join(os.tmpdir(), `lead-status-test-store-${process.pid}.json`);
process.env.APP_STORE_PATH = STORE_PATH;
delete process.env.DATABASE_URL;

const { createLead, getLeadById, updateLeadStatus } = await import("../lib/store.js");

test("normalizePipelineStatus canonicalizes valid + legacy values and rejects junk", () => {
  assert.equal(normalizePipelineStatus("won"), "won");
  assert.equal(normalizePipelineStatus("Won"), "won");
  assert.equal(normalizePipelineStatus("closed"), "won"); // legacy alias
  assert.equal(normalizePipelineStatus("do-not-contact"), "disqualified"); // legacy alias
  assert.equal(normalizePipelineStatus("bogus"), null);
  assert.equal(normalizePipelineStatus(""), null);
});

test("updateLeadStatus rejects an invalid status and leaves the lead unchanged", async () => {
  await rm(STORE_PATH, { force: true });
  const lead = await createLead({ businessName: "Status Co", email: "s@status.test", teamId: "team_a", tenantId: "tenant_a" });
  assert.equal(lead.pipelineStatus, "new");

  await assert.rejects(() => updateLeadStatus(lead.id, "not-a-status", { teamId: "team_a" }), /Invalid pipeline status/);

  const after = await getLeadById(lead.id, { teamId: "team_a" });
  assert.equal(after.pipelineStatus, "new", "an invalid update must not reset or corrupt the status");

  const ok = await updateLeadStatus(lead.id, "qualified", { teamId: "team_a" });
  // updateLead resolves nothing; re-read to confirm.
  const updated = await getLeadById(lead.id, { teamId: "team_a" });
  assert.equal(updated.pipelineStatus, "qualified");

  await rm(STORE_PATH, { force: true });
});
