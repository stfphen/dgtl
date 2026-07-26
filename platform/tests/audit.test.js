import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  __setAuditDbForTests,
  listAuditLogs,
  logAudit,
  sanitizeAuditMetadata
} from "../lib/audit.js";

function createFakeAuditDb() {
  const rows = [];

  return {
    rows,
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (normalized.startsWith("insert into audit_logs")) {
        const [id, userId, action, targetType, targetId, metadata] = params;
        const row = {
          id,
          user_id: userId,
          user_email: "owner@example.com",
          user_name: "Owner",
          action,
          target_type: targetType,
          target_id: targetId,
          metadata: JSON.parse(metadata),
          created_at: new Date("2026-06-15T12:00:00Z")
        };
        rows.push(row);
        return { rows: [row], rowCount: 1 };
      }

      if (normalized.startsWith("select audit_logs.*")) {
        const limit = params.at(-1);
        return { rows: rows.slice(0, limit), rowCount: rows.length };
      }

      throw new Error(`Unhandled SQL in fake audit DB: ${sql}`);
    }
  };
}

afterEach(() => {
  __setAuditDbForTests(null);
});

test("audit metadata redacts secrets recursively", () => {
  assert.deepEqual(
    sanitizeAuditMetadata({
      email: "user@example.com",
      password: "plaintext",
      nested: {
        apiToken: "secret-token",
        safe: "visible"
      }
    }),
    {
      email: "user@example.com",
      password: "[redacted]",
      nested: {
        apiToken: "[redacted]",
        safe: "visible"
      }
    }
  );
});

test("logAudit stores sanitized metadata and listAuditLogs returns mapped rows", async () => {
  const db = createFakeAuditDb();
  __setAuditDbForTests(db);

  const row = await logAudit({
    userId: "user_owner",
    action: "user.created",
    targetType: "user",
    targetId: "user_sales",
    metadata: {
      teamId: "team_dgtlmag",
      email: "sales@example.com",
      temporaryPassword: "never-store-this"
    }
  });

  assert.equal(row.action, "user.created");
  assert.equal(row.metadata.temporaryPassword, "[redacted]");
  assert.equal(db.rows[0].metadata.temporaryPassword, "[redacted]");

  const logs = await listAuditLogs({ teamId: "team_dgtlmag" });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].userEmail, "owner@example.com");
  assert.equal(logs[0].targetId, "user_sales");
  assert.equal(logs[0].metadata.email, "sales@example.com");
  assert.equal(logs[0].metadata.temporaryPassword, "[redacted]");
});
