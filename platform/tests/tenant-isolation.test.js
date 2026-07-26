import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

// Isolate the JSON fallback store in a temp file and force file-store mode BEFORE
// importing the data layer.
const STORE_PATH = path.join(os.tmpdir(), `isolation-test-store-${process.pid}.json`);
process.env.APP_STORE_PATH = STORE_PATH;
delete process.env.DATABASE_URL;

const { createLead, getLeadById, listLeads, updateLeadResearch } = await import("../lib/store.js");

async function seedTwoTeamLeads() {
  const a = await createLead({ businessName: "Alpha Co", email: "a@alpha.test", teamId: "team_a", tenantId: "tenant_a" });
  const b = await createLead({ businessName: "Beta Co", email: "b@beta.test", teamId: "team_b", tenantId: "tenant_b" });
  return { a, b };
}

test("listLeads scoped by teamId excludes other teams", async () => {
  await rm(STORE_PATH, { force: true });
  const { a, b } = await seedTwoTeamLeads();

  const teamA = await listLeads({ teamId: "team_a" });
  assert.ok(teamA.some((lead) => lead.id === a.id), "team_a sees its own lead");
  assert.ok(!teamA.some((lead) => lead.id === b.id), "team_a must not see team_b's lead");
});

test("getLeadById with a mismatched teamId returns null (no cross-team read)", async () => {
  await rm(STORE_PATH, { force: true });
  const { a } = await seedTwoTeamLeads();

  assert.equal((await getLeadById(a.id, { teamId: "team_a" }))?.id, a.id, "owning team can read");
  assert.equal(await getLeadById(a.id, { teamId: "team_b" }), null, "other team cannot read");
  assert.equal((await getLeadById(a.id))?.id, a.id, "unscoped read still works for system callers");
});

test("updateLeadResearch with a mismatched teamId is a no-op (no cross-team write)", async () => {
  await rm(STORE_PATH, { force: true });
  const { a } = await seedTwoTeamLeads();

  const blocked = await updateLeadResearch(a.id, { notes: "hijacked" }, { teamId: "team_b" });
  assert.equal(blocked, null, "cross-team write is rejected");

  const afterBlocked = await getLeadById(a.id, { teamId: "team_a" });
  assert.notEqual(afterBlocked.notes, "hijacked", "target lead is untouched by the cross-team write");

  const allowed = await updateLeadResearch(a.id, { notes: "legit" }, { teamId: "team_a" });
  assert.equal(allowed.notes, "legit", "owning team can write");

  await rm(STORE_PATH, { force: true });
});
