// DGTL Pass — the Postgres store.
//
// issuePass / verifyScan / revokePass are ported from the tested reference
// (docs/specs/dgtl-pass/reference/repository.js). Each takes `tx`, a client
// already inside BEGIN; withTransaction() owns BEGIN/COMMIT. Postgres only: the
// JSON file store has no row locks, and redemption depends on them
// (docs/specs/dgtl-pass/03-data-model.md).
//
// Retries (both safe to repeat wholesale, see withUniqueRetry):
//   23505 on passes.issue_request_id  two submits of one form; the retry returns the first pass
//   23505 on pass_scans.id            two submits of one scan; the retry returns the stored verdict

import crypto from "node:crypto";
import pg from "pg";
import { credentialUrl, deriveCredential, generateShortCode, hashCredential, parseScannedPayload } from "./credentials.js";
import { computeValidityWindow, describeValidity } from "./validity.js";
import { admissionPatch, decideScan, effectiveStatus, scanResponse, SCAN_RESULTS } from "./verify.js";
import { TIER_PRESETS } from "./tiers.js";

const { Pool } = pg;

export class PassError extends Error {
  constructor(code, message, status = 400, field = undefined) {
    super(message);
    this.name = "PassError";
    this.code = code;
    this.status = status;
    this.field = field;
  }
}

let pool = null;
let testDb = null;

// Tests hand in a PGlite instance ({ query, transaction }).
export function __setPassesDbForTests(db) {
  testDb = db;
}

export function passesDatabaseAvailable() {
  return Boolean(testDb || process.env.DATABASE_URL);
}

function getPool() {
  if (!process.env.DATABASE_URL) throw new PassError("database_required", "DGTL Pass needs Postgres (DATABASE_URL).", 503);
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

// Scripts and tests that own the process close the pool before exiting.
export async function closePassesPool() {
  const current = pool;
  pool = null;
  if (current) await current.end();
}

async function query(text, params) {
  return testDb ? testDb.query(text, params) : getPool().query(text, params);
}

export async function withTransaction(fn) {
  if (testDb) return testDb.transaction((tx) => fn(tx));
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// A unique violation from a concurrent duplicate is resolved by running the
// whole transaction again: the second run finds the first one's row.
export async function withUniqueRetry(fn, attempts = 3) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (error?.code !== "23505" || attempt >= attempts) throw error;
    }
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
    firstViewedAt: row.first_viewed_at,
    revokedAt: row.revoked_at,
    walletProvider: row.wallet_provider || null,
    walletRef: row.wallet_ref || null,
    walletShareUrl: row.wallet_share_url || null,
    walletGoogleUrl: row.wallet_google_url || null,
    walletIssuedAt: row.wallet_issued_at || null,
    walletError: row.wallet_error || null,
    createdAt: row.created_at
  };
}

function mapPassType(row) {
  if (!row) return null;
  return {
    id: row.id,
    teamId: row.team_id,
    tenantId: row.tenant_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    tier: row.tier,
    isVip: row.is_vip,
    validity: { kind: row.validity_kind, count: row.validity_count },
    maxUses: row.max_uses,
    reentryCooldownSeconds: row.reentry_cooldown_seconds,
    design: row.design || {},
    email: row.email || {},
    sms: row.sms || {},
    sortOrder: row.sort_order,
    status: row.status
  };
}

async function upsertHolder(tx, { teamId, tenantId, holder }) {
  const name = String(holder?.name || "").trim();
  const email = holder?.email ? String(holder.email).trim().toLowerCase() : null;
  const phone = holder?.phone ? String(holder.phone).replace(/[\s().-]/g, "") : null;
  if (!name) throw new PassError("holder_name_required", "Holder name is required.", 400, "holder.name");
  if (name.length > 120) throw new PassError("holder_name_too_long", "Holder name is too long.", 400, "holder.name");
  if (!email && !phone) throw new PassError("holder_contact_required", "An email or phone number is required.", 400, "holder.email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PassError("holder_email_invalid", "Email address is not valid.", 400, "holder.email");
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) throw new PassError("holder_phone_invalid", "Phone must be E.164, e.g. +14165550100.", 400, "holder.phone");

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

// ---------------------------------------------------------------------------
// Pass types
// ---------------------------------------------------------------------------

/** The five DGTL presets for one tenant. Idempotent: existing slugs are left alone. */
export async function installPresetPassTypes({ teamId, tenantId }) {
  return withTransaction(async (tx) => {
    let created = 0;
    const presets = Object.values(TIER_PRESETS);
    for (const [index, preset] of presets.entries()) {
      const { rows } = await tx.query(
        `insert into pass_types (id, team_id, tenant_id, slug, name, description, tier, validity_kind, validity_count,
                                 max_uses, reentry_cooldown_seconds, is_vip, design, email, sort_order)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15)
         on conflict (tenant_id, slug) do nothing
         returning id`,
        [
          newId("ptype"),
          teamId,
          tenantId,
          preset.presetId.replace(/_/g, "-"),
          preset.name,
          `${preset.material} tier`,
          preset.tier,
          preset.validity.kind,
          preset.validity.count || 1,
          preset.usage.maxUses,
          preset.usage.reentryCooldownSeconds,
          preset.isVip,
          // Empty design = follow the tier preset; a tenant override goes here.
          JSON.stringify({ presetId: preset.presetId }),
          JSON.stringify(preset.email),
          index
        ]
      );
      created += rows.length;
    }
    return { created, total: presets.length };
  });
}

export async function listPassTypes({ teamId, tenantId }) {
  const { rows } = await query(
    `select * from pass_types where team_id = $1 and tenant_id = $2 and status = 'active' order by sort_order, created_at`,
    [teamId, tenantId]
  );
  return rows.map(mapPassType);
}

// ---------------------------------------------------------------------------
// Issue / verify / revoke (the reference transactions)
// ---------------------------------------------------------------------------

/**
 * Issue one pass. Idempotent on issueRequestId.
 *
 * input: { teamId, tenantId, passTypeId, holder: { name, email?, phone? },
 *          startDate?, validFrom?, validUntil?, issuedBy, issueRequestId?, source?, sourceRef? }
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
  if (!typeRow) throw new PassError("pass_type_not_found", "Pass type not found.", 404, "passTypeId");
  const passType = mapPassType(typeRow);

  let window;
  try {
    window = computeValidityWindow({
      rule: passType.validity,
      startDate: input.startDate,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      timeZone: deps.timeZone,
      dayCutoffHour: deps.dayCutoffHour ?? 0
    });
  } catch (error) {
    throw new PassError("validity_invalid", error.message, 400, "startDate");
  }

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
 * deps:  { allowedHosts, insecureHosts?, timeZone, dayCutoffHour }
 * returns the scanner response (verify.js scanResponse) + { replay }
 */
export async function verifyScan(tx, input, deps) {
  if (!SCAN_ID.test(String(input.scanId || ""))) throw new PassError("scan_id_invalid", "scanId is required.", 400, "scanId");
  if (!input.teamId || !input.verifierId) throw new PassError("unauthenticated", "Verifier session required.", 401);

  const prior = await tx.query(`select team_id, response from pass_scans where id = $1`, [input.scanId]);
  if (prior.rows[0]) {
    if (prior.rows[0].team_id !== input.teamId) throw new PassError("scan_id_conflict", "scanId already used.", 409);
    return { ...prior.rows[0].response, replay: true };
  }

  const { rows: clock } = await tx.query(`select now() as now`);
  const now = clock[0].now;
  const parsed = parseScannedPayload(input.raw, { allowedHosts: deps.allowedHosts, insecureHosts: deps.insecureHosts || [] });

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

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The links for one pass. The link is the credential: never log it. */
export function passLinks(pass, config) {
  const credential = deriveCredential({ passId: pass.id, version: pass.credentialVersion, keyId: pass.credentialKeyId, secrets: config.secrets });
  const passPageUrl = credentialUrl(config.baseUrl, credential);
  return { passPageUrl, walletUrl: `${passPageUrl}/wallet.pkpass` };
}

/**
 * The holder pass page: look a pass up by the credential in its URL. Returns
 * null for anything unknown (including a rotated credential), so every miss
 * renders the same 404. Stamps first_viewed_at on the first open.
 */
export async function getPassForHolder(credential) {
  const { rows } = await query(`select * from passes where credential_hash = $1`, [hashCredential(credential)]);
  const pass = mapPass(rows[0]);
  if (!pass) return null;
  const [typeResult, holderResult, clock] = await Promise.all([
    query(`select * from pass_types where id = $1`, [pass.passTypeId]),
    query(`select name from pass_holders where id = $1`, [pass.holderId]),
    query(`select now() as now`)
  ]);
  if (!pass.firstViewedAt) {
    await query(`update passes set first_viewed_at = now() where id = $1 and first_viewed_at is null`, [pass.id]);
  }
  const now = clock.rows[0].now;
  return { pass, passType: mapPassType(typeResult.rows[0]), holder: { name: holderResult.rows[0]?.name || "" }, now, status: effectiveStatus(pass, now) };
}

export async function getPassForTeam({ teamId, passId }) {
  const { rows } = await query(`select * from passes where id = $1 and team_id = $2`, [passId, teamId]);
  return mapPass(rows[0]);
}

/** Admin list: no credentials, no links (fetched per pass). */
export async function listPasses({ teamId, tenantId, limit = 50 }) {
  const { rows } = await query(
    `select p.*, t.name as type_name, t.tier as type_tier, t.is_vip as type_is_vip,
            h.name as holder_name, h.email as holder_email, h.phone as holder_phone, now() as db_now
       from passes p
       join pass_types t on t.id = p.pass_type_id
       join pass_holders h on h.id = p.holder_id
      where p.team_id = $1 and ($2::text is null or p.tenant_id = $2)
      order by p.created_at desc
      limit $3`,
    [teamId, tenantId || null, Math.min(Math.max(Number(limit) || 50, 1), 100)]
  );
  return rows.map((row) => {
    const pass = mapPass(row);
    return {
      ...pass,
      effectiveStatus: effectiveStatus(pass, row.db_now),
      passTypeName: row.type_name,
      tier: row.type_tier,
      vip: row.type_is_vip,
      holderName: row.holder_name,
      holderEmail: row.holder_email,
      holderPhone: row.holder_phone
    };
  });
}

/** Overview numbers for the Passes module. dayStart is the tenant's business-day start. */
export async function passesOverview({ teamId, tenantId, dayStart }) {
  const scope = [teamId, tenantId || null, dayStart];
  const [counts, scans, tiers, recent] = await Promise.all([
    query(
      `select count(*) filter (where status = 'active' and valid_from <= now()
                                 and (valid_until is null or valid_until > now())
                                 and (max_uses is null or use_count < max_uses))::int as active,
              count(*) filter (where created_at >= $3)::int as issued_today
         from passes where team_id = $1 and ($2::text is null or tenant_id = $2)`,
      scope
    ),
    query(
      `select count(*)::int as scans, count(*) filter (where admitted)::int as admits
         from pass_scans where team_id = $1 and ($2::text is null or tenant_id = $2 or tenant_id is null) and created_at >= $3`,
      scope
    ),
    query(
      `select t.tier, count(*)::int as n
         from passes p join pass_types t on t.id = p.pass_type_id
        where p.team_id = $1 and ($2::text is null or p.tenant_id = $2) and p.status = 'active'
          and p.valid_from <= now() and (p.valid_until is null or p.valid_until > now())
          and (p.max_uses is null or p.use_count < p.max_uses)
        group by t.tier`,
      [teamId, tenantId || null]
    ),
    query(
      `select s.id, s.created_at, s.result, s.admitted, s.gate, s.input_kind,
              h.name as holder_name, t.name as type_name, t.tier, u.name as verifier_name
         from pass_scans s
         left join passes p on p.id = s.pass_id
         left join pass_holders h on h.id = p.holder_id
         left join pass_types t on t.id = p.pass_type_id
         left join users u on u.id = s.verifier_id
        where s.team_id = $1
        order by s.created_at desc
        limit 12`,
      [teamId]
    )
  ]);
  return {
    active: counts.rows[0].active,
    issuedToday: counts.rows[0].issued_today,
    scansToday: scans.rows[0].scans,
    admitsToday: scans.rows[0].admits,
    deniesToday: scans.rows[0].scans - scans.rows[0].admits,
    byTier: Object.fromEntries(tiers.rows.map((row) => [row.tier, row.n])),
    recentScans: recent.rows.map((row) => ({
      id: row.id,
      at: row.created_at,
      result: row.result,
      admitted: row.admitted,
      gate: row.gate,
      inputKind: row.input_kind,
      holderName: row.holder_name || null,
      passTypeName: row.type_name || null,
      tier: row.tier || null,
      verifierName: row.verifier_name || null
    }))
  };
}

// ---------------------------------------------------------------------------
// Hosted Wallet copies (migration 016)
// ---------------------------------------------------------------------------

/** Lock the pass row so two taps on "Add to Apple Wallet" create one provider pass. */
export async function lockPassForWallet(tx, passId) {
  const { rows } = await tx.query(`select * from passes where id = $1 for update`, [passId]);
  if (!rows[0]) return null;
  return { pass: mapPass(rows[0]), pkpass: rows[0].wallet_pkpass ? Buffer.from(rows[0].wallet_pkpass) : null };
}

export async function saveWalletCopy(tx, { passId, provider, ref, shareUrl, googleUrl, pkpass, warning = null }) {
  await tx.query(
    `update passes set wallet_provider = $2, wallet_ref = $3, wallet_share_url = $4, wallet_google_url = $5,
                       wallet_pkpass = $6, wallet_issued_at = now(), wallet_synced_at = now(), wallet_error = $7,
                       updated_at = now()
     where id = $1`,
    [passId, provider, ref, shareUrl || null, googleUrl || null, pkpass, warning]
  );
}

/** A DGTL-signed pass is built on demand; only the first add is recorded. */
export async function markWalletIssued({ passId, provider }) {
  await query(
    `update passes set wallet_provider = coalesce(wallet_provider, $2), wallet_issued_at = coalesce(wallet_issued_at, now()), updated_at = now()
     where id = $1`,
    [passId, provider]
  );
}

export async function recordWalletSync({ passId, error = null }) {
  await query(
    error
      ? `update passes set wallet_error = $2, updated_at = now() where id = $1`
      : `update passes set wallet_synced_at = now(), wallet_error = null, updated_at = now() where id = $1`,
    error ? [passId, String(error).slice(0, 500)] : [passId]
  );
}
