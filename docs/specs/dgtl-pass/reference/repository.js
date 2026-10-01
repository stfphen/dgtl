// DGTL Pass — issue + verify against Postgres (reference implementation).
//
// These are the two transactions that make the product. Everything else is
// presentation. Both take `tx`, a client already inside BEGIN, with a
// pg-compatible `query(text, params) -> { rows }`. The caller owns BEGIN/COMMIT.
//
//   - platform (node-postgres):  const client = await pool.connect(); BEGIN; … COMMIT
//   - tests (PGlite):            await db.transaction((tx) => verifyScan(tx, …))
//
// Retries the caller must handle (both are safe to retry wholesale):
//   23505 on passes.issue_request_id  -> two concurrent submits of the same form;
//                                        the retry finds the first pass and returns it.
//   23505 on pass_scans.id            -> two concurrent submits of the same scan;
//                                        the retry finds the stored verdict and returns it.
//
// Port target: platform/lib/passes/store.js (these functions stay Postgres-only;
// the JSON file-store fallback has no row locks, see 03-data-model.md).

import crypto from "node:crypto";
import { deriveCredential, generateShortCode, hashCredential, parseScannedPayload } from "./credentials.js";
import { computeValidityWindow, describeValidity } from "./validity.js";
import { admissionPatch, decideScan, scanResponse, SCAN_RESULTS } from "./verify.js";

export class PassError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "PassError";
    this.code = code;
    this.status = status;
  }
}

const newId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
const SCAN_ID = /^[A-Za-z0-9_-]{8,64}$/;

function mapPass(row) {
  if (!row) return null;
  return {
    id: row.id,
    teamId: row.team_id,
    tenantId: row.tenant_id,
    passTypeId: row.pass_type_id,
    holderId: row.holder_id,
    status: row.status,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    maxUses: row.max_uses,
    reentryCooldownSeconds: row.reentry_cooldown_seconds,
    useCount: row.use_count,
    firstUsedAt: row.first_used_at,
    lastUsedAt: row.last_used_at,
    lastUsedGate: row.last_used_gate,
    credentialKeyId: row.credential_key_id,
    credentialVersion: row.credential_version,
    shortCode: row.short_code,
    source: row.source,
    createdAt: row.created_at
  };
}

function mapPassType(row) {
  return {
    id: row.id,
    teamId: row.team_id,
    tenantId: row.tenant_id,
    name: row.name,
    tier: row.tier,
    isVip: row.is_vip,
    validity: { kind: row.validity_kind, count: row.validity_count },
    maxUses: row.max_uses,
    reentryCooldownSeconds: row.reentry_cooldown_seconds,
    design: row.design,
    email: row.email,
    sms: row.sms
  };
}

async function upsertHolder(tx, { teamId, tenantId, holder }) {
  const name = String(holder?.name || "").trim();
  const email = holder?.email ? String(holder.email).trim().toLowerCase() : null;
  const phone = holder?.phone ? String(holder.phone).trim() : null;
  if (!name) throw new PassError("holder_name_required", "Holder name is required.");
  if (!email && !phone) throw new PassError("holder_contact_required", "An email or phone number is required.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PassError("holder_email_invalid", "Email address is not valid.");
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) throw new PassError("holder_phone_invalid", "Phone must be E.164, e.g. +14165550100.");

  if (email) {
    const { rows } = await tx.query(
      `insert into pass_holders (id, team_id, tenant_id, name, email, phone)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (tenant_id, lower(email)) where email is not null
       do update set name = excluded.name,
                     phone = coalesce(excluded.phone, pass_holders.phone),
                     updated_at = now()
       returning *`,
      [newId("holder"), teamId, tenantId, name, email, phone]
    );
    return rows[0];
  }
  const existing = await tx.query(`select * from pass_holders where tenant_id = $1 and phone = $2 and email is null limit 1`, [tenantId, phone]);
  if (existing.rows[0]) return existing.rows[0];
  const { rows } = await tx.query(
    `insert into pass_holders (id, team_id, tenant_id, name, phone) values ($1, $2, $3, $4, $5) returning *`,
    [newId("holder"), teamId, tenantId, name, phone]
  );
  return rows[0];
}

/**
 * Issue one pass. Idempotent on issueRequestId.
 *
 * input: { teamId, tenantId, passTypeId, holder: { name, email?, phone? },
 *          startDate?, validFrom?, validUntil?, issuedBy, issueRequestId?,
 *          source?, sourceRef? }
 * deps:  { secrets, activeKeyId, timeZone, dayCutoffHour }
 * returns { pass, passType, holder, credential, replay }
 */
export async function issuePass(tx, input, deps) {
  if (input.issueRequestId) {
    const prior = await tx.query(`select * from passes where issue_request_id = $1`, [input.issueRequestId]);
    if (prior.rows[0]) {
      if (prior.rows[0].team_id !== input.teamId) throw new PassError("idempotency_conflict", "Request id already used.", 409);
      const pass = mapPass(prior.rows[0]);
      const typeRow = (await tx.query(`select * from pass_types where id = $1`, [pass.passTypeId])).rows[0];
      const holderRow = (await tx.query(`select * from pass_holders where id = $1`, [pass.holderId])).rows[0];
      const credential = deriveCredential({ passId: pass.id, version: pass.credentialVersion, keyId: pass.credentialKeyId, secrets: deps.secrets });
      return { pass, passType: mapPassType(typeRow), holder: holderRow, credential, replay: true };
    }
  }

  // Tenant ownership is checked here, in SQL. A pass type from another team or
  // tenant simply does not exist from this caller's point of view.
  const typeRow = (
    await tx.query(`select * from pass_types where id = $1 and team_id = $2 and tenant_id = $3 and status = 'active'`, [
      input.passTypeId,
      input.teamId,
      input.tenantId
    ])
  ).rows[0];
  if (!typeRow) throw new PassError("pass_type_not_found", "Pass type not found.", 404);
  const passType = mapPassType(typeRow);

  const window = computeValidityWindow({
    rule: passType.validity,
    startDate: input.startDate,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    timeZone: deps.timeZone,
    dayCutoffHour: deps.dayCutoffHour ?? 0
  });

  const holder = await upsertHolder(tx, input);
  const passId = newId("pass");
  const credential = deriveCredential({ passId, version: 1, keyId: deps.activeKeyId, secrets: deps.secrets });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { rows } = await tx.query(
      `insert into passes (id, team_id, tenant_id, pass_type_id, holder_id, valid_from, valid_until,
                           max_uses, reentry_cooldown_seconds, credential_hash, credential_key_id,
                           short_code, source, source_ref, issue_request_id, issued_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       on conflict (team_id, short_code) do nothing
       returning *`,
      [
        passId,
        input.teamId,
        input.tenantId,
        passType.id,
        holder.id,
        window.validFrom,
        window.validUntil,
        passType.maxUses,
        passType.reentryCooldownSeconds,
        hashCredential(credential),
        deps.activeKeyId,
        (deps.generateShortCode || generateShortCode)(),
        input.source || "manual",
        input.sourceRef || null,
        input.issueRequestId || null,
        input.issuedBy || null
      ]
    );
    if (rows[0]) return { pass: mapPass(rows[0]), passType, holder, credential, replay: false };
  }
  throw new PassError("short_code_exhausted", "Could not allocate a unique pass code.", 500);
}

/**
 * Verify one scan. Idempotent on scanId.
 *
 * input: { scanId, raw, inputKind: 'qr'|'barcode'|'manual', gate?, deviceLabel?,
 *          verifierId, teamId, ipHash?, userAgent? }
 * deps:  { allowedHosts, timeZone, dayCutoffHour }
 * returns the scanner response (reference/verify.js scanResponse) + { replay }
 */
export async function verifyScan(tx, input, deps) {
  if (!SCAN_ID.test(String(input.scanId || ""))) throw new PassError("scan_id_invalid", "scanId is required.");
  if (!input.teamId || !input.verifierId) throw new PassError("unauthenticated", "Verifier session required.", 401);

  const prior = await tx.query(`select team_id, response from pass_scans where id = $1`, [input.scanId]);
  if (prior.rows[0]) {
    if (prior.rows[0].team_id !== input.teamId) throw new PassError("scan_id_conflict", "scanId already used.", 409);
    return { ...prior.rows[0].response, replay: true };
  }

  const { rows: clock } = await tx.query(`select now() as now`);
  const now = clock[0].now;
  const parsed = parseScannedPayload(input.raw, { allowedHosts: deps.allowedHosts });

  let passRow = null;
  if (parsed.kind === "credential") {
    passRow = (await tx.query(`select * from passes where credential_hash = $1 for update`, [hashCredential(parsed.credential)])).rows[0] || null;
  } else if (parsed.kind === "short_code") {
    // Manual entry is scoped to the verifier's team in SQL: a short code can
    // never resolve to another team's pass.
    passRow = (await tx.query(`select * from passes where team_id = $1 and short_code = $2 for update`, [input.teamId, parsed.shortCode])).rows[0] || null;
  }

  const pass = mapPass(passRow);
  const decision =
    parsed.kind === "invalid"
      ? { result: SCAN_RESULTS.INVALID_FORMAT, admit: false, tone: "deny", title: "Not a pass code", internalReason: parsed.reason }
      : decideScan({ pass, now, scannerTeamId: input.teamId });
  const visible = pass && decision.result !== SCAN_RESULTS.NOT_FOUND ? pass : null;

  let passType = null;
  let holder = null;
  let validity = null;
  if (visible) {
    passType = mapPassType((await tx.query(`select * from pass_types where id = $1`, [visible.passTypeId])).rows[0]);
    holder = (await tx.query(`select name from pass_holders where id = $1`, [visible.holderId])).rows[0];
    validity = describeValidity(visible, { timeZone: deps.timeZone, dayCutoffHour: deps.dayCutoffHour ?? 0 });
  }

  if (decision.admit) {
    const patch = admissionPatch(visible, { now, gate: input.gate || null });
    await tx.query(
      `update passes set use_count = $2, first_used_at = $3, last_used_at = $4, last_used_gate = $5, updated_at = now()
       where id = $1`,
      [visible.id, patch.useCount, patch.firstUsedAt, patch.lastUsedAt, patch.lastUsedGate]
    );
  }

  const response = scanResponse({ scanId: input.scanId, decision, pass: visible, passType, holder, validity });
  await tx.query(
    `insert into pass_scans (id, team_id, tenant_id, pass_id, verifier_id, result, internal_reason, admitted,
                             input_kind, gate, device_label, ip_hash, user_agent, response)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)`,
    [
      input.scanId,
      input.teamId,
      visible?.tenantId || null,
      visible?.id || null,
      input.verifierId,
      decision.result,
      decision.internalReason || null,
      decision.admit,
      input.inputKind || "qr",
      input.gate || null,
      input.deviceLabel || null,
      input.ipHash || null,
      input.userAgent ? String(input.userAgent).slice(0, 300) : null,
      JSON.stringify(response)
    ]
  );
  return { ...response, replay: false };
}

export async function revokePass(tx, { passId, teamId, revokedBy, reason }) {
  const { rows } = await tx.query(
    `update passes set status = 'revoked', revoked_at = now(), revoked_by = $3, revoke_reason = $4,
                       content_updated_at = now(), updated_at = now()
     where id = $1 and team_id = $2 and status <> 'revoked'
     returning *`,
    [passId, teamId, revokedBy, reason || null]
  );
  return mapPass(rows[0]);
}
