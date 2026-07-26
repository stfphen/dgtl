import crypto from "node:crypto";
import { Pool } from "pg";

const SECRET_KEY_PATTERN = /(password|secret|token|key|credential|hash)/i;
const DEFAULT_LIMIT = 100;

let pgPool;
let testDb;

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function requireDatabase() {
  if (testDb) return testDb;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for audit logging.");
  }

  if (!pgPool) {
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  return pgPool;
}

function sanitizeValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SECRET_KEY_PATTERN.test(key) ? "[redacted]" : sanitizeValue(entry)
    ])
  );
}

export function sanitizeAuditMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return sanitizeValue(metadata);
}

function mapAuditRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email || "",
    userName: row.user_name || "",
    action: row.action,
    targetType: row.target_type || "",
    targetId: row.target_id || "",
    metadata: sanitizeAuditMetadata(row.metadata || {}),
    createdAt: row.created_at?.toISOString?.() || row.created_at
  };
}

export async function logAudit({ userId, action, targetType = "", targetId = "", metadata = {} }) {
  if (!userId || !action) return null;

  const db = requireDatabase();
  const result = await db.query(
    `insert into audit_logs (id, user_id, action, target_type, target_id, metadata)
     values ($1, $2, $3, $4, $5, $6::jsonb)
     returning *`,
    [
      id("audit"),
      userId,
      action,
      targetType || null,
      targetId || null,
      JSON.stringify(sanitizeAuditMetadata(metadata))
    ]
  );

  return mapAuditRow(result.rows[0]);
}

export async function listAuditLogs({ teamId, limit = DEFAULT_LIMIT } = {}) {
  const db = requireDatabase();
  const boundedLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 250);
  const result = teamId
    ? await db.query(
        `select
           audit_logs.*,
           users.email as user_email,
           users.name as user_name
         from audit_logs
         left join users on users.id = audit_logs.user_id
         where audit_logs.metadata ->> 'teamId' = $1
         order by audit_logs.created_at desc
         limit $2`,
        [teamId, boundedLimit]
      )
    : await db.query(
        `select
           audit_logs.*,
           users.email as user_email,
           users.name as user_name
         from audit_logs
         left join users on users.id = audit_logs.user_id
         order by audit_logs.created_at desc
         limit $1`,
        [boundedLimit]
      );

  return result.rows.map(mapAuditRow);
}

export function __setAuditDbForTests(db) {
  testDb = db;
}
