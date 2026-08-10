#!/usr/bin/env node
/**
 * DGTL Worklog — MCP server (stdio).
 *
 * Speaks JSON-RPC 2.0 over newline-delimited stdin/stdout, which is all the MCP
 * stdio transport requires. Written with zero runtime dependencies to match the
 * Worklog app itself, so there is no install step and nothing to keep patched.
 *
 * Hard rule: stdout carries protocol frames ONLY. Every diagnostic goes to
 * stderr. A stray console.log here corrupts the stream and the connector dies
 * with an unhelpful parse error.
 *
 *   node server.js            # normal launch (reads ./.env)
 *   node server.js --selftest # verify credentials and print the account's role
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { WorklogClient, WorklogError } from './lib/client.js';
import { TOOLS, ToolError } from './lib/tools.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROTOCOL_VERSION = '2024-11-05';
const log = (...args) => process.stderr.write(`[worklog-mcp] ${args.join(' ')}\n`);

// ------------------------------------------------------------------- env file

/**
 * Minimal .env reader. Deliberately does not overwrite variables already set in
 * the environment, so a launcher config can override the file.
 */
function loadEnv(file = path.join(HERE, '.env')) {
  if (!fs.existsSync(file)) return false;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
  return true;
}

// --------------------------------------------------------------------- client

let client = null;
function getClient() {
  if (!client) client = new WorklogClient();
  return client;
}

// ------------------------------------------------------------------ dispatch

const byName = new Map(TOOLS.map((t) => [t.name, t]));

async function callTool(name, args = {}) {
  const tool = byName.get(name);
  if (!tool) throw new ToolError(`Unknown tool "${name}".`);
  return tool.run(getClient(), args ?? {});
}

/** Turn any thrown value into a readable, non-leaking message. */
function describeError(err) {
  if (err instanceof WorklogError) {
    if (err.status === 403) {
      return `${err.message}\n\nThis account is a member, not an admin. Creating projects, `
        + 'listing all users and logging time for other people are admin-only in Worklog.';
    }
    if (err.status === 401) {
      return `${err.message}\n\nThe stored credentials were rejected. Check .env.`;
    }
    if (err.status === 429) return err.message;
    return err.message;
  }
  if (err instanceof ToolError) return err.message;
  if (err?.cause?.code === 'ENOTFOUND' || err?.cause?.code === 'ECONNREFUSED') {
    return `Cannot reach ${process.env.WORKLOG_BASE_URL || 'office.dgtl.at'} — ${err.cause.code}.`;
  }
  return err?.message || String(err);
}

const handlers = {
  initialize(params) {
    return {
      // Echo the client's version when it offers one, so a newer host is not
      // forced down to ours over a difference we do not actually depend on.
      protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'dgtl-worklog', version: '1.0.0' },
    };
  },

  ping() {
    return {};
  },

  'tools/list'() {
    return {
      tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    };
  },

  async 'tools/call'(params) {
    const { name, arguments: args } = params ?? {};
    try {
      const result = await callTool(name, args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      // Tool failures are reported in-band with isError so the model can read
      // and correct them, rather than as a protocol-level error.
      return {
        content: [{ type: 'text', text: describeError(err) }],
        isError: true,
      };
    }
  },
};

// ----------------------------------------------------------------- transport

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handleMessage(msg) {
  // Notifications have no id and take no reply.
  const isNotification = msg.id === undefined || msg.id === null;
  const handler = handlers[msg.method];

  if (!handler) {
    if (isNotification) return;
    send({
      jsonrpc: '2.0',
      id: msg.id,
      error: { code: -32601, message: `Method not found: ${msg.method}` },
    });
    return;
  }

  try {
    const result = await handler(msg.params);
    if (!isNotification) send({ jsonrpc: '2.0', id: msg.id, result });
  } catch (err) {
    log('handler error:', describeError(err));
    if (!isNotification) {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32603, message: describeError(err) },
      });
    }
  }
}

function serve() {
  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      log('ignoring unparseable line');
      return;
    }
    handleMessage(msg).catch((err) => log('dispatch failed:', describeError(err)));
  });

  rl.on('close', () => process.exit(0));

  log(`ready — ${TOOLS.length} tools, target ${process.env.WORKLOG_BASE_URL || 'https://office.dgtl.at'}`);
}

// ------------------------------------------------------------------ selftest

async function selftest() {
  const target = process.env.WORKLOG_BASE_URL || 'https://office.dgtl.at';
  log(`signing in to ${target} as ${process.env.WORKLOG_EMAIL} ...`);
  try {
    const snap = await callTool('worklog_context', {});
    const me = snap.signedInAs;
    log(`OK — signed in as ${me.name} <${me.email}>, role "${me.role}"`);
    log(`   ${snap.users.length} users, ${snap.projects.length} projects, ${snap.openTaskCount} open tasks`);
    log(`   timezone ${snap.timezone}, today ${snap.today}`);
    if (!me.isAdmin) {
      log('NOTE — this account is a member. It can create and assign tasks and log its own');
      log('       time, but NOT create projects or log time for other people.');
    }
    process.exit(0);
  } catch (err) {
    log(`FAILED — ${describeError(err)}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------- main

loadEnv();

if (!process.env.WORKLOG_EMAIL || !process.env.WORKLOG_PASSWORD) {
  log('ERROR: WORKLOG_EMAIL / WORKLOG_PASSWORD are not set.');
  log(`Copy .env.example to .env in ${HERE} and fill it in.`);
  process.exit(1);
}

if (process.argv.includes('--selftest')) await selftest();
else serve();
