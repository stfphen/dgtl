/**
 * DGTL Worklog — API smoke test.  `npm test`
 *
 * Boots the real server against a throwaway database on a spare port, then
 * drives it over HTTP exactly as the browser does. No dependencies, no mocks.
 *
 * One section does not go over HTTP: the client → project → task rollups that
 * the task board's rings draw are arithmetic in the browser over rows the
 * bootstrap already shipped, so there is no endpoint to call. They live in
 * ui.js as pure functions with no DOM in them for exactly this reason, and are
 * imported and driven directly. What that section cannot see is the rendering
 * — that is checked in a browser, not here.
 */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupByClient, mergeRollups, ringGeometry, rollup, sorter } from '../public/assets/js/ui.js';
import { billableStanding } from '../public/assets/js/store.js';
import { api } from '../public/assets/js/api.js';
import { budgetBar } from '../public/assets/js/views/projects.js';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'worklog-test-'));
const DB_PATH = path.join(TMP, 'test.sqlite');
const PORT = 8199 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
// Clear of the range PORT is drawn from, so the second boot never collides.
const PORT_2 = PORT + 400;
const BASE_2 = `http://127.0.0.1:${PORT_2}`;
const PORT_3 = PORT + 700;
const BASE_3 = `http://127.0.0.1:${PORT_3}`;
// Used twice in a row, not at once: the client derivation has to be watched
// across a restart, so the port is freed between the two boots.
const PORT_4 = PORT + 1000;
const BASE_4 = `http://127.0.0.1:${PORT_4}`;
// The digest, read out of a timezone fourteen hours ahead of the one every
// other boot here runs in.
const PORT_5 = PORT + 1300;
const BASE_5 = `http://127.0.0.1:${PORT_5}`;
const PASSWORD = 'smoke-test-password';
const TZ = 'America/Toronto';

const env = {
  ...process.env,
  DB_PATH, PORT: String(PORT), HOST: '127.0.0.1',
  APP_TIMEZONE: 'America/Toronto', SECURE_COOKIES: '0',
  SEED_ADMIN_EMAIL: 'smoke@dgtlgroup.io', SEED_ADMIN_PASSWORD: PASSWORD,
  // Blanked so an ambient pair — or one left in .env on a real host — cannot
  // mint an account during a boot. The first-boot section sets them on purpose.
  BOOTSTRAP_ADMIN_EMAIL: '', BOOTSTRAP_ADMIN_PASSWORD: '',
};

/** Every *.sqlite* file under a directory, as paths relative to it. */
function sqliteFiles(dir, root = dir) {
  const hits = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) hits.push(...sqliteFiles(full, root));
    else if (e.name.includes('.sqlite')) hits.push(path.relative(root, full));
  }
  return hits;
}

/**
 * What config.mjs would resolve DB_PATH to, right now, in this process: the
 * same .env read, the same "a real env var beats .env", the same default.
 * Mirrored rather than imported — importing config.mjs drags in db.mjs, which
 * opens whatever it resolves, which is the thing this exists to catch.
 */
function resolveEffectiveDbPath() {
  const vars = { ...process.env };
  const envFile = path.join(APP_DIR, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in vars)) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return path.resolve(APP_DIR, vars.DB_PATH || 'data/worklog.sqlite');
}

// --- wall-clock fixtures ------------------------------------------------
// Attendance has to be asserted on both sides of a midnight and of a DST step,
// and no amount of waiting gets a test there. Intl is the only correct source
// for the offset in force at a given instant, so both helpers go through it.

const tzParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});
const tzDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** How far the app timezone's wall clock leads UTC at an instant, in ms. */
function zoneLead(ms) {
  const p = Object.fromEntries(tzParts.formatToParts(ms).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
}

/** The instant at which a wall-clock time in the app timezone happens. */
function atLocal(y, m, d, hh = 0, mm = 0) {
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes: the first offset is read at the wrong instant when the wall
  // time sits on the far side of a transition, the second lands on it.
  return naive - zoneLead(naive - zoneLead(naive));
}

const localDay = (ms) => tzDay.format(ms);

/**
 * One-shot write straight into the throwaway database — the only way to place
 * a fixture at an instant the suite cannot wait for. `w` runs one statement.
 */
function sql(fn) {
  const dbx = new DatabaseSync(DB_PATH);
  try { return fn((q, ...p) => dbx.prepare(q).run(...p)); } finally { dbx.close(); }
}

/** Enough of a file's identity to notice any write to it — or its absence. */
const fingerprint = (p) => {
  try { const s = fs.statSync(p); return `${s.size} bytes @ ${s.mtimeMs}`; } catch { return 'absent'; }
};

// The children are handed DB_PATH through `env`; this process needs it too.
// Nothing here imports a server module today, but config.mjs falls back to
// data/worklog.sqlite — and on a host whose .env sets DB_PATH, to the live
// database — so any future import must land on the throwaway one instead.
process.env.DB_PATH = DB_PATH;

// Three layers, because no one of them sees everything:
//
//   1. the isolation assertion, on the resolved path — the only one that catches
//      an *open*, whether or not a byte changes. A pure open of an already-
//      migrated database writes nothing at all, and leaves nothing to find.
//   2. these fingerprints — any *write* to the database the app would resolve,
//      or to the default it falls back to, sidecars included. Catches a write
//      through a path layer 1 does not name.
//   3. the tree scan below — any *new* database anywhere under the app.
//
// Layer 3 alone is inert, which is how this was got wrong the first time:
// deploy/DEPLOY.md and README.md both put DB_PATH *outside* the app, where a
// scan of APP_DIR never looks, and on any machine that has run `npm start` the
// default already exists, so touching it adds no new path to notice.
const guarded = [...new Set([resolveEffectiveDbPath(), path.join(APP_DIR, 'data/worklog.sqlite')])]
  .flatMap((p) => [p, `${p}-wal`, `${p}-shm`])
  .filter((p) => !p.startsWith(TMP + path.sep));
const guardedBefore = guarded.map(fingerprint);
const sqliteBefore = new Set(sqliteFiles(APP_DIR));

let passed = 0;
const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
};

// Every child leads its own process group, so cleanup can take down anything it
// spawned in turn. It also means a terminal Ctrl-C no longer reaches them —
// which is why the signal handlers below are not optional.
const children = [];
const sh = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { cwd: APP_DIR, env, stdio: 'pipe', detached: true });
  children.push(p);
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(out))));
});

/** Kill a child and everything it spawned, then wait for it to really be gone. */
async function stop(proc) {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  try { process.kill(-proc.pid, 'SIGTERM'); } catch { return; }   // group already gone
  const hard = setTimeout(() => { try { process.kill(-proc.pid, 'SIGKILL'); } catch { /* gone */ } }, 500);
  await once(proc, 'exit');
  clearTimeout(hard);
}

/**
 * Like call(), but against another server and without touching this suite's
 * cookie jar. Pass `jar` — any object — to give that server a jar of its own,
 * which is what a session on a second process needs.
 */
async function callOn(base, method, url, body, jar) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(jar?.cookie ? { cookie: jar.cookie } : {}),
      origin: base,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  if (jar) {
    for (const c of res.headers.getSetCookie?.() ?? []) if (c.startsWith('dgtl_worklog=')) jar.cookie = c.split(';')[0];
  }
  const type = res.headers.get('content-type') || '';
  return { status: res.status, body: type.includes('json') ? await res.json() : await res.text() };
}

let cookie = '';
async function call(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      origin: BASE,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) if (c.startsWith('dgtl_worklog=')) cookie = c.split(';')[0];
  const type = res.headers.get('content-type') || '';
  return { status: res.status, body: type.includes('json') ? await res.json() : await res.text() };
}

/**
 * Run one of the scripts and hand back how it exited.
 *
 * `sh()` above rejects on a non-zero exit, and what these scripts do when they
 * REFUSE is the thing under test. Every call passes a DB_PATH of its own inside
 * the temp dir; the leftovers audit at the end is what proves none of them
 * wandered off it, which is the whole defect.
 */
function runScript(file, args, extra = {}) {
  return new Promise((resolve) => {
    const p = spawn('node', ['--no-warnings=ExperimentalWarning', `scripts/${file}`, ...args], {
      cwd: APP_DIR, env: { ...env, ...extra }, stdio: 'pipe', detached: true,
    });
    children.push(p);
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => resolve({ code, out }));
  });
}

/** Boot the real server against the throwaway database; returns a log reader. */
function bootServer(extra = {}) {
  const proc = spawn('node', ['--no-warnings=ExperimentalWarning', 'server/server.mjs'], {
    cwd: APP_DIR, env: { ...env, ...extra }, stdio: 'pipe', detached: true,
  });
  let out = '';
  proc.stdout.on('data', (d) => { out += d; });
  proc.stderr.on('data', (d) => { out += d; });
  children.push(proc);
  return { proc, log: () => out };
}

/** Poll a boot log until it matches, so we never read a half-flushed pipe. */
const waitForLog = async (log, re) => {
  for (let i = 0; i < 100; i++) {
    if (re.test(log())) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
};

// The banner prints from inside the listen callback, and names the database it
// opened. Waiting for that exact line is a readiness check that also proves
// identity: a server that lost the bind never prints it, and one answering from
// an earlier run — an orphan on the same port, holding a stale database —
// cannot print ours. Polling the port only proves that *something* replied.
const banner = new RegExp(`Database\\s+${DB_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s`);
async function ready(boot, label) {
  const up = await waitForLog(boot.log, banner);
  ok(`${label} is the server this run booted`, up, boot.log().trim() || '(no output at all)');
  if (!up) throw new Error(`${label} never reported ${DB_PATH} — port taken, or a stale server answered`);
}

const server = bootServer();

const strays = [];                        // new databases under the app
let touched = [];                         // guarded databases this run wrote to
let cleaning = null;                      // the one cleanup, however we got here
function cleanup() {
  cleaning ||= (async () => {
    for (const proc of children) await stop(proc);
    // Audited while the children are confirmed dead but before TMP goes: a late
    // write would otherwise recreate the temp dir after the scan and leak it.
    touched = guarded.filter((p, i) => fingerprint(p) !== guardedBefore[i]);
    for (const rel of sqliteFiles(APP_DIR)) if (!sqliteBefore.has(rel)) strays.push(rel);
    fs.rmSync(TMP, { recursive: true, force: true });
  })();
  return cleaning;
}

// Ctrl-C must not leave a listening server and a temp database behind: the next
// run draws its port from the same range and would quietly talk to the orphan.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => { cleanup().finally(() => process.exit(130)); });
}

// Last ditch, and synchronous because nothing else can run here. An uncaught
// throw — or `npm test | head` closing our stdout — unwinds past the finally
// block entirely, and a detached child outlives the process that spawned it.
process.on('exit', () => {
  for (const proc of children) { try { process.kill(-proc.pid, 'SIGKILL'); } catch { /* gone */ } }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* gone */ }
});

try {
  console.log('\nrollups and sorting (pure, no server)');
  // The three cases the section rings have to survive, as data.
  const T = (o) => ({ archived: false, status: 'todo', estimateMinutes: null, ...o });

  const workstream = rollup(
    [T({ status: 'done' }), T({}), T({ estimateMinutes: 60 }), T({ estimateMinutes: 120 })],
    { loggedMinutes: 0 },
  );
  ok('a rollup counts done over every non-archived task',
    workstream.total === 4 && workstream.done === 1, JSON.stringify(workstream));
  ok('a workstream with tasks and no hours reads 0% spent, not "no estimate"',
    workstream.effortPct === 0 && workstream.target === 180, JSON.stringify(workstream));
  ok('archived tasks are outside the count', rollup([T({ archived: true }), T({})]).total === 1);

  const unplanned = rollup([T({}), T({})], { loggedMinutes: 300 });
  ok('with nothing to measure against there is no percentage to draw',
    unplanned.effortPct === null && unplanned.basis === null, JSON.stringify(unplanned));
  ok('and its hours are carried out as unplanned rather than dropped',
    unplanned.unplannedMinutes === 300);

  // 22h38m against a 5h budget, with 27h of task estimates on top of it.
  const overBudget = rollup([T({ estimateMinutes: 1620 })], { loggedMinutes: 1358, budgetMinutes: 300 });
  ok('a budget beats the task estimates, so this and the Projects bar agree',
    overBudget.target === 300 && overBudget.basis === 'budget', JSON.stringify(overBudget));
  ok('453% is reported as 453%, not clamped to full', Math.round(overBudget.effortPct) === 453);

  const account = mergeRollups([overBudget, unplanned]);
  ok('a client ratio counts only the projects that have a target',
    account.loggedMinutes === 1358 && account.target === 300, JSON.stringify(account));
  ok('and states the hours it could not count', account.unplannedMinutes === 300);
  ok('a client spanning a budget and an estimate calls its basis mixed',
    mergeRollups([overBudget, workstream]).basis === 'mixed');

  // The section rings are 44/5; Today's daily target is the default 132/10.
  ok('a section with nothing to measure gets no inner ring at all',
    ringGeometry(44, 5, null).drawInner === false);
  ok('a section with an estimate and no hours still gets one, empty',
    ringGeometry(44, 5, 0).drawInner === true);
  ok('and so does one at 453%', ringGeometry(44, 5, 453).drawInner === true);
  ok('an inner arc thinner than its own stroke is dropped, not drawn as a smudge',
    ringGeometry(28, 5, 50).drawInner === false, JSON.stringify(ringGeometry(28, 5, 50)));
  ok('the daily-target ring is untouched: one arc, same radius as it always had',
    ringGeometry(132, 10, null).outerR === 61 && ringGeometry(132, 10, null).drawInner === false);

  const due = [{ n: 'b', d: '2026-01-02' }, { n: 'a', d: null }, { n: 'c', d: '2026-01-01' }, { n: 'd', d: null }];
  const st = sorter([{ key: 'd', label: 'Due', get: (r) => r.d }], { key: 'd' });
  ok('sorting puts empty values last, ascending',
    st.apply(due).map((r) => r.n).join('') === 'cbad', st.apply(due).map((r) => r.n).join(''));
  st.toggle('d');
  ok('a second click reverses the column', st.dir === 'desc');
  ok('and empty values stay last — reversing must not float them to the top',
    st.apply(due).map((r) => r.n).join('') === 'bcad', st.apply(due).map((r) => r.n).join(''));
  ok('rows that tie keep the order they arrived in',
    st.apply(due).slice(2).map((r) => r.n).join('') === 'ad');
  st.toggle('d');
  ok('a third click puts it back', st.dir === 'asc');
  ok('an unset sort leaves the rows exactly as they came',
    sorter([{ key: 'd', label: 'Due', get: (r) => r.d }]).apply(due).map((r) => r.n).join('') === 'bacd');

  // The budget bar's geometry. A clamped fill drew 453% and 101% identically,
  // so the two are compared here as the numbers the row actually paints.
  const wild = budgetBar(1358, 300);      // FlockaMG: 22h38m against a 5h budget
  const just = budgetBar(303, 300);       // a hair over
  ok('a budget bar under its budget is the ordinary fill, and the track is the budget',
    budgetBar(150, 300).over === false && budgetBar(150, 300).insidePct === 50,
    JSON.stringify(budgetBar(150, 300)));
  ok('past it the track becomes what was SPENT, so the overrun has room to draw',
    wild.over === true && Math.round(wild.insidePct) === 22 && Math.round(wild.overPct) === 78,
    JSON.stringify(wild));
  ok('and 453% no longer paints the same as 101%',
    Math.abs(wild.overPct - just.overPct) > 20,
    `${wild.overPct.toFixed(1)}% red vs ${just.overPct.toFixed(1)}%`);
  ok('a hair over budget is a sliver, not a full red bar',
    just.over === true && just.overPct < 2 && just.insidePct > 98, JSON.stringify(just));
  ok('a project with no budget has no bar at all', budgetBar(500, null) === null);

  // What the Today ring measures now. The denominator is the day that actually
  // happened, which is the whole argument: 8h logged is a figure an agency can
  // hit every day while selling nothing.
  const clocked = billableStanding({
    billableMinutes: 104, loggedMinutes: 104, presenceMinutes: 810,
    dailyTargetMinutes: 480, targetPct: 60,
  });
  ok('presence beats the nominal day as the denominator, and the card can say which',
    clocked.basis === 810 && clocked.source === 'present', JSON.stringify(clocked));
  ok('1h 44m billable in a 13h 30m day is 13%, not 22% of a day nobody worked',
    Math.round(clocked.sharePct) === 13, String(clocked.sharePct));
  ok('and the ring measures that against the billable target, not against the hours',
    clocked.targetMinutes === 486 && Math.round(clocked.progressPct) === 21,
    JSON.stringify({ target: clocked.targetMinutes, progress: clocked.progressPct }));
  ok('the shortfall is stated in minutes, which is the thing anyone can act on',
    clocked.shortfallMinutes === 382);

  const unclocked = billableStanding({
    billableMinutes: 60, loggedMinutes: 300, presenceMinutes: 0,
    dailyTargetMinutes: 480, targetPct: 60,
  });
  ok('with nobody clocked in the day is the work filed into it',
    unclocked.basis === 300 && unclocked.source === 'logged', JSON.stringify(unclocked));
  ok('and with neither, the daily target is all that is left to mean anything',
    billableStanding({ dailyTargetMinutes: 480, targetPct: 60 }).source === 'target');
  // A block logged by hand outside every shift is still work that happened, so
  // the basis widens to hold it. Dividing by presence alone reads 150%, which
  // is not a share of anything.
  ok('a share can never read over 100 — the day is at least as long as the work in it',
    billableStanding({
      billableMinutes: 180, loggedMinutes: 180, presenceMinutes: 120, targetPct: 60,
    }).sharePct === 100);
  ok('no target means no arc, which is a different claim from none of it met',
    billableStanding({ billableMinutes: 60, loggedMinutes: 60, targetPct: 0 }).progressPct === null);

  const grouped = groupByClient([
    { id: 1, clientId: null }, { id: 2, clientId: 7, clientName: 'Zed' },
    { id: 3, clientId: 4, clientName: 'Ash' }, { id: 4, clientId: 7, clientName: 'Zed' },
  ]);
  ok('projects gather under the client that owns them',
    grouped.length === 3 && grouped[0].name === 'Ash' && grouped[1].projects.length === 2,
    JSON.stringify(grouped.map((g) => [g.name, g.projects.length])));
  ok('and the clientless ones sort last, not first', grouped[2].clientId === null);

  await sh('node', ['--no-warnings=ExperimentalWarning', 'scripts/seed.mjs']);

  console.log('\nisolation');
  // The path the SERVER opened, read out of its own banner. Mirroring
  // config.mjs here instead asserts a fact this process set two lines earlier,
  // which is a check that cannot fail — it printed a tick for the exact break
  // it was named for. ready() still throws on a miss, and that abort is
  // deliberate: if the app resolved some other database, every assertion after
  // this point would be writing test data into it.
  await ready(server, 'the API');
  const opened = server.log().match(/Database\s+(\S+)/)?.[1];
  ok('the database it opened is the throwaway one',
    !!opened && opened.startsWith(TMP + path.sep), opened || '(no banner)');

  console.log('\nauth');
  ok('unauthenticated bootstrap is refused', (await call('GET', '/api/bootstrap')).status === 401);
  ok('wrong password is refused',
    (await call('POST', '/api/auth/login', { email: 'smoke@dgtlgroup.io', password: 'nope' })).status === 401);
  const login = await call('POST', '/api/auth/login', { email: 'smoke@dgtlgroup.io', password: PASSWORD });
  ok('correct password signs in', login.status === 200 && login.body.user.role === 'admin', `status ${login.status}`);
  ok('session cookie was issued', cookie.startsWith('dgtl_worklog='));

  console.log('\nbootstrap');
  const boot = await call('GET', '/api/bootstrap');
  ok('bootstrap returns the workspace',
    boot.status === 200 && boot.body.projects.length === 5 && boot.body.tasks.length === 9,
    `${boot.body.projects?.length} projects / ${boot.body.tasks?.length} tasks`);
  ok('bootstrap carries today + timezone', /^\d{4}-\d{2}-\d{2}$/.test(boot.body.today) && !!boot.body.timezone);
  // The Today ring reads this rather than assuming one, so the migration that
  // makes it per-person moves the server and nothing on the screen.
  ok('bootstrap carries the share of the day that is meant to be billable',
    Number.isInteger(boot.body.billableTargetPct)
    && boot.body.billableTargetPct > 0 && boot.body.billableTargetPct <= 100,
    String(boot.body.billableTargetPct));
  const projectId = boot.body.projects[0].id;

  console.log('\nprojects');
  const created = await call('POST', '/api/projects', { name: 'Test Project', code: 'TEST', color: '#6E9FDB' });
  ok('admin can create a project', created.status === 200 && created.body.project.code === 'TEST');
  ok('bad colour is rejected',
    (await call('POST', '/api/projects', { name: 'X', color: 'red' })).status === 400);
  ok('nameless project is rejected', (await call('POST', '/api/projects', {})).status === 400);
  ok('empty project can be deleted',
    (await call('DELETE', `/api/projects/${created.body.project.id}`)).status === 200);

  // Tasks outlive their project (schema.sql sets project_id to NULL). Deleting
  // one therefore detaches work silently unless the count comes back, which is
  // what the confirm dialog quotes instead of guessing.
  const doomed = (await call('POST', '/api/projects', { name: 'Doomed Project', code: 'DOOM' })).body.project;
  const keep = await call('POST', '/api/tasks', { title: 'Survivor task', projectId: doomed.id });
  await call('POST', '/api/tasks', { title: 'Finished task', projectId: doomed.id, status: 'done' });

  const doomedRow = (await call('GET', '/api/projects')).body.projects.find((p) => p.id === doomed.id);
  ok('a project row counts every task attached, not only the open ones',
    doomedRow.taskCount === 2 && doomedRow.openTasks === 1, `${doomedRow.taskCount} / ${doomedRow.openTasks}`);

  const del = await call('DELETE', `/api/projects/${doomed.id}`);
  ok('deleting a project reports how many tasks it detached',
    del.status === 200 && del.body.detachedTasks === 2, JSON.stringify(del.body));
  ok('and how many of those were still open', del.body.detachedOpenTasks === 1, JSON.stringify(del.body));

  const after = (await call('GET', '/api/tasks')).body.tasks;
  const survivor = after.find((t) => t.id === keep.body.task.id);
  ok('detached tasks survive with no project', !!survivor && survivor.projectId === null);

  const spare = (await call('POST', '/api/projects', { name: 'Taskless', code: 'NIL' })).body.project;
  const del2 = await call('DELETE', `/api/projects/${spare.id}`);
  ok('a project with no tasks reports zero detached',
    del2.status === 200 && del2.body.detachedTasks === 0 && del2.body.detachedOpenTasks === 0);

  // Billable is a property of the entry, not the project, so a billable project
  // holding non-billable hours must not read as fully billable. Projects and
  // Reports render from different sources; this is what stops them disagreeing.
  const mix = (await call('POST', '/api/projects', { name: 'Billable Mix', billable: true })).body.project.id;
  await call('POST', '/api/entries', { projectId: mix, minutes: 60, billable: true });
  await call('POST', '/api/entries', { projectId: mix, minutes: 180, billable: false });
  const mixBoot = await call('GET', '/api/bootstrap');
  const mixRow = mixBoot.body.projects.find((p) => p.id === mix);
  ok('a project row carries per-entry billable minutes', mixRow.billableMinutes === 60, String(mixRow.billableMinutes));
  ok('a billable project holding non-billable hours is not fully billable',
    mixRow.billableMinutes < mixRow.loggedMinutes, `${mixRow.billableMinutes} of ${mixRow.loggedMinutes}`);
  const mixRep = await call('GET', `/api/report?scope=team&from=${mixBoot.body.today}&to=${mixBoot.body.today}`);
  const mixProj = mixRep.body.byProject.find((p) => p.projectId === mix);
  ok('Projects and Reports agree on billable minutes',
    mixProj.billableMinutes === mixRow.billableMinutes, `${mixProj?.billableMinutes} vs ${mixRow.billableMinutes}`);

  // The figures above agree only because every fixture entry landed today. The
  // project row is all-time and the report is range-bound, so backdating one
  // entry must pull them apart — otherwise the assertion above proves they read
  // the same source, not that they cover the same span.
  const yesterday = new Date(`${mixBoot.body.today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yday = yesterday.toISOString().slice(0, 10);
  await call('POST', '/api/entries', { projectId: mix, minutes: 30, billable: true, date: yday });
  const mixRow2 = (await call('GET', '/api/projects')).body.projects.find((p) => p.id === mix);
  const ydayRep = await call('GET', `/api/report?scope=team&from=${yday}&to=${yday}`);
  const ydayProj = ydayRep.body.byProject.find((p) => p.projectId === mix);
  ok('the project row is all-time while a report is bound to its range',
    mixRow2.billableMinutes === 90 && ydayProj.billableMinutes === 30,
    `row ${mixRow2.billableMinutes} vs yesterday ${ydayProj?.billableMinutes}`);

  // Time on no project is in no project row, which is the whole reason the
  // bootstrap reports it separately and the Projects card names it.
  await call('POST', '/api/entries', { minutes: 45, note: 'no project at all', billable: true });
  const offBoot = (await call('GET', '/api/bootstrap')).body;
  const allTime = (await call('GET', `/api/report?scope=team&from=1970-01-01&to=${offBoot.today}`)).body;
  const rowSum = offBoot.projects.reduce((s, p) => s + p.loggedMinutes, 0);
  ok('bootstrap reports time that belongs to no project',
    offBoot.unassigned.minutes >= 45 && offBoot.unassigned.billableMinutes >= 45,
    JSON.stringify(offBoot.unassigned));
  ok('project rows plus off-project time equal the report total',
    rowSum + offBoot.unassigned.minutes === allTime.totals.minutes,
    `${rowSum} + ${offBoot.unassigned.minutes} vs ${allTime.totals.minutes}`);

  console.log('\nclients');
  // Nothing has created a client yet — the seeded codes share no prefix — so
  // the derivation's one-shot guard is still armed at this point. Everything
  // in this section is ordered around that.
  const bare = (await call('GET', '/api/projects')).body.projects;
  ok('a project with no client says so, rather than borrowing its contact',
    bare.every((p) => p.clientId === null && p.clientName === null));

  // The hierarchy an owner authored by hand in `code`, long before there was
  // anywhere else to put it. 902 is a lone code and must stay a tag.
  for (const [name, code] of [
    ['Whitlock Pianos — Account & Comms', '900'],
    ['WP · A — Site & Listings', '900-A'],
    ['WP · B — Studio Content', '900-B'],
    ['Ridgeway Retainer', '902'],
  ]) await call('POST', '/api/projects', { name, code });

  const derived = bootServer({ PORT: String(PORT_4) });
  await ready(derived, 'the derivation boot');
  const djar = {};
  await callOn(BASE_4, 'POST', '/api/auth/login', { email: 'smoke@dgtlgroup.io', password: PASSWORD }, djar);
  const afterDerive = (await callOn(BASE_4, 'GET', '/api/projects', null, djar)).body.projects;
  const wp = afterDerive.filter((p) => p.code.startsWith('900'));
  ok('a code prefix shared by several projects becomes one client on connect',
    wp.length === 3 && new Set(wp.map((p) => p.clientId)).size === 1 && wp[0].clientId,
    JSON.stringify(wp.map((p) => [p.code, p.clientId])));
  ok('and it is named off the parent project, cut at its separator',
    wp.every((p) => p.clientName === 'Whitlock Pianos'), JSON.stringify(wp.map((p) => p.clientName)));
  ok('a lone code stays a tag and earns no client of its own',
    afterDerive.find((p) => p.code === '902').clientId === null);
  ok('a project with no code at all is left with no client',
    afterDerive.find((p) => p.code === 'DLVR').clientId === null);
  await stop(derived.proc);

  // The guard is one-shot, not convergent: something the owner has since
  // changed must survive the next restart. Detach one, then boot again.
  const detachId = wp.find((p) => p.code === '900-B').id;
  await call('PATCH', `/api/projects/${detachId}`, { clientName: '' });
  const rederived = bootServer({ PORT: String(PORT_4) });
  await ready(rederived, 'the second derivation boot');
  const rjar = {};
  await callOn(BASE_4, 'POST', '/api/auth/login', { email: 'smoke@dgtlgroup.io', password: PASSWORD }, rjar);
  const afterRestart = (await callOn(BASE_4, 'GET', '/api/projects', null, rjar)).body.projects;
  ok('a project moved off its client is not put back by the next boot',
    afterRestart.find((p) => p.id === detachId).clientId === null,
    JSON.stringify(afterRestart.find((p) => p.id === detachId)));
  ok('and the ones nobody touched keep the client they were given',
    afterRestart.filter((p) => p.code === '900' || p.code === '900-A')
      .every((p) => p.clientId === wp[0].clientId));
  await stop(rederived.proc);

  // The write channel: a client rides on the project, because a client with no
  // projects is not a thing this app has any use for.
  const withContact = (await call('POST', '/api/projects', {
    name: 'Bellweather Site', code: 'BELL', client: 'Priya', clientName: 'Bellweather Pianos',
  })).body.project;
  ok('a project carries a client and a contact at once, and they are different things',
    withContact.clientName === 'Bellweather Pianos' && withContact.client === 'Priya',
    JSON.stringify(withContact));
  ok('the client is a row, not another string on the project', Number.isInteger(withContact.clientId));

  const sameClient = (await call('POST', '/api/projects', {
    name: 'Bellweather Listings', code: 'BELL2', clientName: 'bellweather pianos',
  })).body.project;
  ok('a client typed in another case is the same client, not a second section',
    sameClient.clientId === withContact.clientId, `${withContact.clientId} vs ${sameClient.clientId}`);
  const beforeReject = (await call('GET', '/api/projects')).body.projects.length;
  ok('an over-long client name is rejected',
    (await call('POST', '/api/projects', { name: 'Half-written', clientName: 'z'.repeat(121) })).status === 400);
  // The client is written after the project row, so a name refused too late
  // would 400 a request that had already created the project.
  ok('and the refusal leaves no half-written project behind',
    (await call('GET', '/api/projects')).body.projects.length === beforeReject,
    `${beforeReject} → ${(await call('GET', '/api/projects')).body.projects.length}`);
  ok('an over-long client name is refused on edit too, before the update lands',
    (await call('PATCH', `/api/projects/${sameClient.id}`, { name: 'Renamed', clientName: 'z'.repeat(121) })).status === 400
    && (await call('GET', '/api/projects')).body.projects.find((p) => p.id === sameClient.id).name === 'Bellweather Listings');

  await call('PATCH', `/api/projects/${withContact.id}`, { clientName: '' });
  const afterClear = (await call('GET', '/api/projects')).body.projects;
  ok('clearing one project\'s client detaches only that project',
    afterClear.find((p) => p.id === withContact.id).clientName === null
    && afterClear.find((p) => p.id === sameClient.id).clientId === withContact.clientId);

  // AUTOINCREMENT never reuses an id, so a fresh id for the same name is proof
  // the old row went — which the name on its own could never show.
  await call('PATCH', `/api/projects/${sameClient.id}`, { clientName: '' });
  const revived = (await call('POST', '/api/projects', {
    name: 'Bellweather Again', clientName: 'Bellweather Pianos',
  })).body.project;
  ok('a client whose last project left is retired, not kept as an empty section',
    revived.clientId > withContact.clientId, `${withContact.clientId} → ${revived.clientId}`);

  const dropped = await call('DELETE', `/api/projects/${revived.id}`);
  ok('deleting the last project on a client retires it too',
    dropped.body.droppedClients === 1, JSON.stringify(dropped.body));
  for (const id of [withContact.id, sameClient.id]) await call('DELETE', `/api/projects/${id}`);

  console.log('\ntasks');
  const task = await call('POST', '/api/tasks', { title: 'Smoke task', projectId, estimateMinutes: 60 });
  ok('task is created', task.status === 200 && task.body.task.status === 'todo');
  const taskId = task.body.task.id;
  const done = await call('PATCH', `/api/tasks/${taskId}`, { status: 'done' });
  ok('completing a task stamps done_at', done.status === 200 && !!done.body.task.doneAt);
  const reopened = await call('PATCH', `/api/tasks/${taskId}`, { status: 'todo' });
  ok('reopening a task clears done_at', reopened.body.task.doneAt === null);
  ok('invalid status is rejected',
    (await call('PATCH', `/api/tasks/${taskId}`, { status: 'sideways' })).status === 400);

  const before = (await call('GET', '/api/tasks')).body.tasks.map((t) => t.id);
  const shuffled = [before[2], before[0], ...before.slice(3), before[1]];
  const reordered = await call('POST', '/api/tasks/reorder', { ids: shuffled });
  ok('tasks can be reordered',
    reordered.status === 200 && reordered.body.tasks.map((t) => t.id).join() === shuffled.join(),
    reordered.body.tasks?.map((t) => t.id).join());
  ok('reorder rejects a non-list', (await call('POST', '/api/tasks/reorder', { ids: 'nope' })).status === 400);

  console.log('\ntime entries');
  const entry = await call('POST', '/api/entries', { projectId, taskId, minutes: 90, note: 'Smoke work' });
  ok('manual entry is logged', entry.status === 200 && entry.body.entry.minutes === 90);
  ok('entry joins in the project name', entry.body.entry.projectName === boot.body.projects[0].name);

  // Hours people are paid for must never be orphaned by tidying a project list.
  const blocked = await call('DELETE', `/api/projects/${projectId}`);
  ok('a project with logged time still cannot be deleted', blocked.status === 400);
  ok('and the refusal says how much time is in the way',
    /\d+ time (entry|entries)/.test(blocked.body.error), blocked.body.error);
  ok('zero minutes is rejected', (await call('POST', '/api/entries', { projectId, minutes: 0 })).status === 400);
  ok('26 hours is rejected', (await call('POST', '/api/entries', { projectId, minutes: 1560 })).status === 400);
  ok('bad date is rejected',
    (await call('POST', '/api/entries', { projectId, minutes: 30, date: '2026-02-31' })).status === 400);
  const edited = await call('PATCH', `/api/entries/${entry.body.entry.id}`, { minutes: 45 });
  ok('entry can be edited', edited.body.entry.minutes === 45);

  // A malformed user id used to coerce to NaN, and NaN took the unscoped
  // branch — so a typo widened the query to the whole team instead of failing.
  ok('a non-numeric user id is rejected, not silently widened',
    (await call('GET', '/api/entries?userId=abc')).status === 400);
  ok('a zero user id is rejected', (await call('GET', '/api/entries?userId=0')).status === 400);
  ok('a fractional user id is rejected', (await call('GET', '/api/entries?userId=1.5')).status === 400);
  ok('a real user id still scopes to that person',
    (await call('GET', `/api/entries?userId=${boot.body.user.id}`)).body.entries
      .every((e) => e.userId === boot.body.user.id));

  console.log('\ntimer');
  const started = await call('POST', '/api/timer/start', { projectId, taskId, note: 'Timing' });
  ok('timer starts', started.status === 200 && !!started.body.timer.startedAt);
  ok('starting a timer moves the task to doing',
    (await call('GET', '/api/bootstrap')).body.tasks.find((t) => t.id === taskId).status === 'doing');
  const restart = await call('POST', '/api/timer/start', { projectId, note: 'Switched' });
  ok('switching timers keeps only one running', restart.body.timer.note === 'Switched');

  // Quick log leans on this: start first, label while it runs.
  const startedAt = restart.body.timer.startedAt;
  const relabel = await call('PATCH', '/api/timer', { note: 'Labelled mid-run', taskId });
  ok('a running timer can be relabelled', relabel.status === 200 && relabel.body.timer.note === 'Labelled mid-run');
  ok('relabelling never moves started_at', relabel.body.timer.startedAt === startedAt);
  ok('relabelling to a task pulls its project through', relabel.body.timer.taskId === taskId);
  const stopped = await call('POST', '/api/timer/stop');
  ok('a sub-minute timer is discarded, not logged as 0', stopped.body.entry === null && stopped.body.discarded);
  ok('timer is cleared after stop', (await call('GET', '/api/timer')).body.timer === null);
  ok('relabelling with no timer running 404s', (await call('PATCH', '/api/timer', { note: 'x' })).status === 404);

  // Switching must BANK the segment it interrupts, not drop it. This is the
  // verb the whole quick-log flow rests on, and two ways of breaking it — not
  // banking at all, and banking with discard — both left this suite green.
  // stopTimer drops anything under a minute, so the running timer is backdated
  // in the throwaway database rather than by sleeping for one.
  await call('POST', '/api/timer/start', { projectId, note: 'Interrupted work' });
  const tdb = new DatabaseSync(DB_PATH);
  tdb.prepare('UPDATE timers SET started_at = ?').run(new Date(Date.now() - 42 * 60000).toISOString());
  tdb.close();
  const switched = await call('POST', '/api/timer/start', { projectId, note: 'After the switch' });
  ok('switching banks the segment it interrupted',
    !!switched.body.banked && switched.body.banked.minutes === 42, JSON.stringify(switched.body.banked));
  ok('the banked segment reaches the timesheet as timer work',
    (await call('GET', '/api/entries')).body.entries
      .some((e) => e.source === 'timer' && e.minutes === 42 && e.note === 'Interrupted work'));

  const discarded = await call('POST', '/api/timer/discard');
  ok('discarding a timer stops it', discarded.status === 200 && discarded.body.timer === null);
  ok('and logs nothing for it',
    !(await call('GET', '/api/entries')).body.entries.some((e) => e.note === 'After the switch'));

  console.log('\nattendance');

  // The rule a shift across midnight leans on, exercised on the real path: an
  // entry belongs to the local day its timer BEGAN on, not the one it ended
  // on, and not "whatever day it is when the row gets written".
  const dayBoot = (await call('GET', '/api/bootstrap')).body;
  const [ty, tm, td] = dayBoot.today.split('-').map(Number);
  const beforeMidnight = atLocal(ty, tm, td, 0, 0) - 10 * 60000;
  await call('POST', '/api/timer/start', { note: '' });
  sql((w) => w('UPDATE timers SET started_at = ? WHERE user_id = ?',
    new Date(beforeMidnight).toISOString(), dayBoot.user.id));
  const filed = await call('POST', '/api/timer/stop');
  ok('a timer that began before local midnight files to the day it began on',
    filed.body.entry?.date === localDay(beforeMidnight) && filed.body.entry.date !== dayBoot.today,
    `${filed.body.entry?.date} · today is ${dayBoot.today}`);

  // A person of their own for the attribution work. The timer section backdated
  // a running clock twice to fake long stretches, which leaves that admin
  // holding windows that overlap by construction — and overlap is one of the
  // things asserted below.
  const shiftUser = await call('POST', '/api/users', {
    email: 'shift@dgtlgroup.io', name: 'Shift Tester', role: 'member', password: 'shift-password-1',
  });
  ok('a second person holds the attendance fixtures', shiftUser.status === 200, JSON.stringify(shiftUser.body));
  const shiftUid = shiftUser.body.user.id;
  const adminSeat = cookie;
  cookie = '';
  await call('POST', '/api/auth/login', { email: 'shift@dgtlgroup.io', password: 'shift-password-1' });

  ok('clocking out when nothing is open 404s', (await call('POST', '/api/shift/out')).status === 404);
  const cin = await call('POST', '/api/shift/in');
  ok('clocking in opens a shift',
    cin.status === 200 && cin.body.shift.open === true && cin.body.shift.presentMinutes === 0,
    JSON.stringify(cin.body.shift));
  ok('a shift carries no project and no task',
    !('projectId' in cin.body.shift) && !('taskId' in cin.body.shift), Object.keys(cin.body.shift).join(','));
  ok('clocking in twice is refused', (await call('POST', '/api/shift/in')).status === 400);

  const sBoot = (await call('GET', '/api/bootstrap')).body;
  ok('bootstrap carries the day\'s shifts on a cold start',
    Array.isArray(sBoot.shifts) && sBoot.shifts.length === 1
    && sBoot.shifts[0].id === cin.body.shift.id && sBoot.shifts[0].open === true,
    JSON.stringify(sBoot.shifts));
  ok('an open shift starts with nothing attributed and the whole of it in the gap',
    sBoot.shifts[0].attributedMinutes === 0
    && sBoot.shifts[0].unattributedMinutes === sBoot.shifts[0].presentMinutes);
  ok('and nothing overclaimed',
    sBoot.shifts[0].claimedMinutes === 0 && sBoot.shifts[0].overclaimedMinutes === 0);

  // The check in the route is manners. The partial unique index is the rule,
  // and two requests never race each other inside a test, so it is asserted
  // where it actually lives.
  let raced = 'the insert succeeded';
  try {
    sql((w) => w('INSERT INTO shifts (user_id, date, started_at) VALUES (?, ?, ?)',
      shiftUid, sBoot.today, new Date().toISOString()));
  } catch (err) { raced = err.message; }
  ok('the database itself refuses a second open shift', /UNIQUE/i.test(raced), raced);

  console.log('\nthe chip switch');
  // Start on one client, tap another client's chip, and the minutes worked
  // before the tap must stay where they were earned. Re-labelling instead —
  // which is what the chips used to do — moved all of them onto the tapped
  // project, silently, and then onto that client's invoice.
  const P1 = sBoot.projects[0].id;
  const P2 = sBoot.projects[1].id;

  await call('POST', '/api/timer/start', { projectId: P1, note: 'Work for the first client' });

  // A clock that is still running has written no entry yet. If the
  // reconciliation ignored it the gap would grow a minute a minute against work
  // plainly being done, and the strip would be crying wolf all afternoon.
  const halfway = Date.now();
  sql((w) => {
    w('UPDATE shifts SET started_at = ? WHERE user_id = ? AND ended_at IS NULL',
      new Date(halfway - 60 * 60000).toISOString(), shiftUid);
    w('UPDATE timers SET started_at = ? WHERE user_id = ?',
      new Date(halfway - 30 * 60000).toISOString(), shiftUid);
  });
  const midRun = (await call('GET', '/api/bootstrap')).body.shifts[0];
  ok('a clock still running counts against the presence it is inside',
    midRun.presentMinutes === 60 && midRun.attributedMinutes === 30 && midRun.unattributedMinutes === 30,
    JSON.stringify(midRun));

  // Two hours of it without waiting two hours. The clock and the shift move
  // back to the same instant, so the fixture stays internally consistent.
  const base = Date.now();
  const shiftStart = new Date(base - 120 * 60000).toISOString();
  sql((w) => {
    w('UPDATE timers SET started_at = ? WHERE user_id = ?', shiftStart, shiftUid);
    w('UPDATE shifts SET started_at = ? WHERE user_id = ? AND ended_at IS NULL', shiftStart, shiftUid);
  });

  const priorEntries = (await call('GET', '/api/entries?from=1970-01-01')).body.entries.length;
  const chip = await call('POST', '/api/timer/start', { projectId: P2, note: 'Work for the second client' });
  ok('tapping a project chip banks the stretch that was running',
    chip.body.banked?.minutes === 120 && chip.body.banked?.projectId === P1,
    JSON.stringify(chip.body.banked));
  ok('and times the new project from now, not from the old start',
    chip.body.timer.projectId === P2 && Date.parse(chip.body.timer.startedAt) >= base,
    chip.body.timer.startedAt);

  const afterSwitch = (await call('GET', '/api/entries?from=1970-01-01')).body.entries;
  ok('the switch wrote exactly one entry, on the project actually worked',
    afterSwitch.length === priorEntries + 1
    && afterSwitch.filter((e) => e.projectId === P1 && e.minutes === 120).length === 1,
    `${afterSwitch.length - priorEntries} new`);
  ok('and not one of those 120 minutes reached the project that was tapped',
    afterSwitch.every((e) => e.projectId !== P2), JSON.stringify(afterSwitch.filter((e) => e.projectId === P2)));

  // The other verb is untouched: the label field still edits the running
  // stretch in place, which is the whole reason Quick log works at all.
  const preLabel = chip.body.timer.startedAt;
  const relabelled = await call('PATCH', '/api/timer', { note: 'Second client · edit pass' });
  ok('the label field still re-labels in place and leaves the start alone',
    relabelled.body.timer.startedAt === preLabel && relabelled.body.timer.note === 'Second client · edit pass');
  ok('and re-labelling writes no entry',
    (await call('GET', '/api/entries?from=1970-01-01')).body.entries.length === afterSwitch.length);

  // Slide the whole session an hour further back so the second stretch has real
  // length. Every interval keeps its duration and its order; only the anchor
  // moves, so nothing the assertions below rest on has been invented.
  const banked1 = afterSwitch.find((e) => e.projectId === P1 && e.minutes === 120);
  const hour = 60 * 60000;
  const aStart = new Date(Date.parse(banked1.startedAt) - hour).toISOString();
  const aEnd = new Date(Date.parse(banked1.endedAt) - hour).toISOString();
  sql((w) => {
    w('UPDATE time_entries SET started_at = ?, ended_at = ? WHERE id = ?', aStart, aEnd, banked1.id);
    w('UPDATE timers SET started_at = ? WHERE user_id = ?', aEnd, shiftUid);
    w('UPDATE shifts SET started_at = ? WHERE user_id = ? AND ended_at IS NULL', aStart, shiftUid);
  });

  const out = await call('POST', '/api/shift/out');
  ok('clocking out banks a timer that was still running',
    out.body.banked?.projectId === P2 && out.body.banked?.minutes === 60, JSON.stringify(out.body.banked));
  const tiled = out.body.shift;
  ok('the two stretches tile the shift exactly',
    tiled.presentMinutes === 180 && tiled.attributedMinutes === 180 && tiled.unattributedMinutes === 0,
    JSON.stringify(tiled));
  ok('the gap is presence minus attributed, exactly',
    tiled.unattributedMinutes === tiled.presentMinutes - tiled.attributedMinutes);

  const timed = (await call('GET', '/api/entries?from=1970-01-01')).body.entries
    .filter((e) => e.startedAt && e.endedAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  ok('no two timed stretches this person logged overlap',
    timed.every((e, i) => i === 0 || timed[i - 1].endedAt <= e.startedAt),
    timed.map((e) => `${e.startedAt}→${e.endedAt}`).join(' '));
  ok('their minutes never sum past the presence that contained them',
    timed.reduce((s, e) => s + e.minutes, 0) <= tiled.presentMinutes,
    `${timed.reduce((s, e) => s + e.minutes, 0)} of ${tiled.presentMinutes}`);

  // A mis-tap costs the seconds since the last switch and no more: stopTimer
  // drops anything under a minute, so nothing zero-length reaches the sheet.
  await call('POST', '/api/timer/start', { projectId: P1, note: 'Instant switch' });
  const beforeInstant = (await call('GET', '/api/entries?from=1970-01-01')).body.entries.length;
  const instant = await call('POST', '/api/timer/start', { projectId: P2, note: 'Instant switch again' });
  ok('switching in the same instant banks nothing', instant.body.banked === null, JSON.stringify(instant.body.banked));
  ok('and writes no zero-minute entry',
    (await call('GET', '/api/entries?from=1970-01-01')).body.entries.length === beforeInstant);
  await call('POST', '/api/timer/discard');

  console.log('\nthe verb a chip has to use');
  // The defect this whole feature exists to fix lives in client code the suite
  // never loads, so reverting the chip handler to PATCH left every assertion
  // green. Both verbs are pinned here instead: what SWITCH must do, what
  // RELABEL must not, and — below — that the client still calls the right one.
  await call('POST', '/api/timer/start', { projectId: P1, note: 'ninety seconds of A' });
  sql((w) => w('UPDATE timers SET started_at = ? WHERE user_id = ?',
    new Date(Date.now() - 90 * 1000).toISOString(), shiftUid));
  const verb = await call('POST', '/api/timer/start', { projectId: P2, note: 'now on B' });
  ok('SWITCH banks the interrupted stretch against the project it was worked on',
    verb.body.banked?.projectId === P1 && verb.body.banked?.minutes >= 1,
    JSON.stringify(verb.body.banked));
  ok('and the new clock does not carry the banked stretch\'s start',
    verb.body.timer.startedAt !== verb.body.banked.startedAt,
    `${verb.body.timer.startedAt} vs ${verb.body.banked.startedAt}`);
  ok('it resumes exactly where the banked minutes ended, so no second is lost or doubled',
    verb.body.timer.startedAt === verb.body.banked.endedAt,
    `${verb.body.timer.startedAt} vs ${verb.body.banked.endedAt}`);

  // The negative control, and the reason a chip must never use this route: a
  // PATCH moves the project and banks nothing, so every minute already elapsed
  // silently re-files to whoever was tapped last, and then gets invoiced.
  const pStart = verb.body.timer.startedAt;
  const pCount = (await call('GET', '/api/entries?from=1970-01-01')).body.entries.length;
  const patched = await call('PATCH', '/api/timer', { projectId: P1 });
  ok('RELABEL moves the project without banking anything — which is the bug, pinned',
    patched.body.timer.projectId === P1 && patched.body.timer.startedAt === pStart
    && (await call('GET', '/api/entries?from=1970-01-01')).body.entries.length === pCount,
    'PATCH banked something, or moved the start');
  await call('POST', '/api/timer/discard');

  // Which leaves one thing the API cannot see: whether the chips still call the
  // right one. Read the source and check. A rename will trip this, and that is
  // the point — the next person gets a failing test naming the invariant
  // instead of a client silently re-filing somebody's morning again.
  const quickSrc = fs.readFileSync(path.join(APP_DIR, 'public/assets/js/views/quick.js'), 'utf8');

  // Anything that changes what the running time is FOR — a project or a task —
  // has to go through the switch. Duration presets are not in this set: they
  // set neither, they log a block.
  const retag = [...quickSrc.matchAll(/onclick:\s*\(\)\s*=>\s*(\w+)\(\{[^}]*(?:projectId|taskId)/g)]
    .map((m) => m[1]);
  ok('every handler that re-tags the running time switches rather than re-labels',
    retag.length >= 3 && retag.every((fn) => fn === 'switchTo'),
    retag.join(', ') || 'no re-tagging handlers found — has the shape changed?');

  // And the switch must not be a re-label wearing its name. Exactly one call to
  // updateTimer in the file, inside relabel — this is the assertion that fails
  // if switchTo's body is quietly turned back into a PATCH.
  const relabelBody = quickSrc.slice(quickSrc.indexOf('async function relabel('))
    .split(/\n {2}(?:\/\*\*|async function |function )/)[0];
  ok('and Quick log re-labels in exactly one place, the label field',
    (quickSrc.match(/updateTimer\(/g) || []).length === 1 && relabelBody.includes('updateTimer('),
    `${(quickSrc.match(/updateTimer\(/g) || []).length} calls to updateTimer, `
    + `${relabelBody.includes('updateTimer(') ? 'in' : 'NOT in'} relabel`);
  ok('and the switch opens a new stretch rather than patching the running one',
    /async function switchTo\([\s\S]*?startTimer\(/.test(quickSrc),
    'switchTo no longer calls startTimer');

  console.log('\nwhat a stretch is allowed to bill');
  // Rounding billed a whole minute for anything over thirty seconds. That was
  // harmless while a chip re-labelled and one entry a session absorbed it; now
  // every tap banks, so it became a systematic overbill nothing on screen could
  // report. Flooring is what makes the claim and the window the same fact.
  const bill = async (seconds, projectId, note) => {
    await call('POST', '/api/timer/start', { projectId, note });
    sql((w) => w('UPDATE timers SET started_at = ? WHERE user_id = ?',
      new Date(Date.now() - seconds * 1000).toISOString(), shiftUid));
    return (await call('POST', '/api/timer/stop')).body;
  };
  const half = await bill(31, P1, 'thirty-one seconds');
  ok('a thirty-one second stretch bills nothing, not a whole minute',
    half.entry === null && half.discarded === true, JSON.stringify(half.entry));
  const justOver = await bill(91, P1, 'ninety-one seconds');
  ok('a ninety-one second stretch bills one minute, not two',
    justOver.entry?.minutes === 1, String(justOver.entry?.minutes));
  ok('and the entry ends where its billed minutes end, not where the clock stopped',
    Date.parse(justOver.entry.endedAt) - Date.parse(justOver.entry.startedAt) === 60000,
    `${(Date.parse(justOver.entry.endedAt) - Date.parse(justOver.entry.startedAt)) / 1000}s of window for 1m billed`);

  // The seconds the floor leaves behind are still work. They carry into
  // whatever was tapped next instead of being thrown away — which is also why
  // a switch inside the first minute moves them to the new project rather than
  // billing a full minute to one nobody worked a minute on.
  const carryStart = await call('POST', '/api/timer/start', { projectId: P1, note: 'carried from here' });
  sql((w) => w('UPDATE timers SET started_at = ? WHERE user_id = ?',
    new Date(Date.now() - 40 * 1000).toISOString(), shiftUid));
  const carryTap = await call('POST', '/api/timer/start', { projectId: P2, note: 'carried to here' });
  ok('a switch inside the first minute banks nothing', carryTap.body.banked === null);
  ok('and the new stretch resumes from where the old one started, not from now',
    Date.parse(carryTap.body.timer.startedAt) <= Date.now() - 39 * 1000,
    `${Math.round((Date.now() - Date.parse(carryTap.body.timer.startedAt)) / 1000)}s of carried time`);
  sql((w) => w('UPDATE timers SET started_at = ? WHERE user_id = ?',
    new Date(Date.parse(carryTap.body.timer.startedAt) - 80 * 1000).toISOString(), shiftUid));
  const settled = await call('POST', '/api/timer/stop');
  ok('forty seconds then eighty bills two minutes, all of it to the second project',
    settled.body.entry?.minutes === 2 && settled.body.entry?.projectId === P2,
    JSON.stringify({ minutes: settled.body.entry?.minutes, project: settled.body.entry?.projectName }));
  ok('and nothing at all is billed to the project that ran under a minute',
    !(await call('GET', '/api/entries?from=1970-01-01')).body.entries
      .some((e) => e.note === 'carried from here'), 'an entry exists for the abandoned stretch');
  ok('the carried stretch starts where the resumed clock was put, losing nothing',
    Date.parse(settled.body.entry.startedAt) === Date.parse(carryTap.body.timer.startedAt) - 80 * 1000,
    `${settled.body.entry.startedAt} vs ${carryTap.body.timer.startedAt} less 80s`);

  // Every stretch above was backdated into the same few minutes so it could be
  // billed and asserted on its own, and the chip-switch scenario left a banked
  // hour ending at this instant. All of it lies across the window the run below
  // needs. Clear this person's clocked work first, or what gets measured is the
  // fixture rather than the rule — the invariants over it were asserted above.
  sql((w) => w('DELETE FROM time_entries WHERE user_id = ? AND started_at IS NOT NULL', shiftUid));

  /**
   * Let `secs` of wall time pass, without waiting for it. Everything this
   * session has written moves back together — the running clock, the entries
   * already banked and the open shift — so every span keeps its length and
   * every boundary keeps its order. Moving only the running clock, which is
   * the obvious version, rewinds it INTO the entry just banked and fabricates
   * an overlap that the run is supposed to be proving cannot happen.
   */
  const advance = (secs) => sql((w) => {
    const back = `'-${secs} seconds'`;
    w(`UPDATE timers SET started_at = strftime('%Y-%m-%dT%H:%M:%fZ', started_at, ${back}) WHERE user_id = ?`, shiftUid);
    w(`UPDATE time_entries SET started_at = strftime('%Y-%m-%dT%H:%M:%fZ', started_at, ${back}),
                               ended_at   = strftime('%Y-%m-%dT%H:%M:%fZ', ended_at, ${back})
        WHERE user_id = ? AND started_at IS NOT NULL`, shiftUid);
    w(`UPDATE shifts SET started_at = strftime('%Y-%m-%dT%H:%M:%fZ', started_at, ${back})
        WHERE user_id = ? AND ended_at IS NULL`, shiftUid);
  });

  // Eight chip taps half a minute apart. Under rounding this billed eight
  // minutes inside four — 194% — and no figure anywhere could say so.
  await call('POST', '/api/shift/in');
  await call('POST', '/api/timer/start', { projectId: P1, note: 'tap 0' });
  for (let i = 1; i <= 8; i++) {
    advance(31);
    await call('POST', '/api/timer/start', { projectId: i % 2 ? P2 : P1, note: `tap ${i}` });
  }
  advance(31);
  await call('POST', '/api/timer/stop');
  const tapped = (await call('POST', '/api/shift/out')).body.shift;
  const tappedRows = (await call('GET', '/api/entries?from=1970-01-01')).body.entries
    .filter((e) => /^tap \d+$/.test(e.note));
  const tappedBilled = tappedRows.reduce((s, e) => s + e.minutes, 0);
  ok('nine stretches of thirty-one seconds never bill more than the presence',
    tappedBilled <= tapped.presentMinutes,
    `${tappedBilled}m billed inside ${tapped.presentMinutes}m — ${Math.round(tappedBilled / tapped.presentMinutes * 100)}%`);
  ok('and the shift reports no overclaim',
    tapped.overclaimedMinutes === 0 && tapped.claimedMinutes <= tapped.presentMinutes,
    JSON.stringify(tapped));
  const tappedSorted = [...tappedRows].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  ok('the banked stretches tile the run end to end, none overlapping the next',
    tappedSorted.every((e, i) => i === 0 || tappedSorted[i - 1].endedAt <= e.startedAt),
    tappedSorted.map((e) => `${e.note}:${e.startedAt}→${e.endedAt}`).join(' '));
  ok('and every one of them bills exactly the window it holds',
    tappedRows.every((e) => Date.parse(e.endedAt) - Date.parse(e.startedAt) === e.minutes * 60000),
    tappedRows.map((e) => `${e.minutes}m/${(Date.parse(e.endedAt) - Date.parse(e.startedAt)) / 1000}s`).join(' '));

  // Fixtures below sit on dates that are not today, so the bootstrap payload —
  // which carries only the day's shifts — correctly leaves them out. The range
  // endpoint is how anything older is reachable at all, which is the whole
  // reason it exists: PATCH and DELETE need an id from somewhere.
  const readShift = async (date) =>
    (await call('GET', `/api/shifts?from=${date}&to=${date}`)).body.shifts[0];

  /** Place a finished shift and the stretches inside it straight into the database. */
  const placeShift = (from, to, entries) => sql((w) => {
    w('INSERT INTO shifts (user_id, date, started_at, ended_at, note) VALUES (?, ?, ?, ?, ?)',
      shiftUid, localDay(from), new Date(from).toISOString(), new Date(to).toISOString(), '');
    for (const [eFrom, eTo, projectId] of entries) {
      const iso = new Date(eFrom).toISOString();
      w(`INSERT INTO time_entries
           (user_id, project_id, date, minutes, note, billable, started_at, ended_at, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, '', 1, ?, ?, 'timer', ?, ?)`,
        shiftUid, projectId, localDay(eFrom), Math.round((eTo - eFrom) / 60000),
        iso, new Date(eTo).toISOString(), iso, iso);
    }
  });

  console.log('\na shift across midnight');
  const mnIn = atLocal(2026, 6, 10, 22, 30);
  const mnOut = atLocal(2026, 6, 11, 1, 30);
  placeShift(mnIn, mnOut, [
    [atLocal(2026, 6, 10, 22, 40), atLocal(2026, 6, 10, 23, 40), P1],
    [atLocal(2026, 6, 11, 0, 10), atLocal(2026, 6, 11, 1, 10), P2],
  ]);
  const mn = await readShift('2026-06-10');
  ok('a shift crossing midnight is filed on the day it began',
    mn.date === '2026-06-10' && mn.endedDate === '2026-06-11', `${mn.date} → ${mn.endedDate}`);
  ok('its presence is the real elapsed time', mn.presentMinutes === 180, String(mn.presentMinutes));
  ok('both sides of midnight are attributed', mn.attributedMinutes === 120, String(mn.attributedMinutes));
  ok('and the gap still reconciles across the day boundary',
    mn.unattributedMinutes === 60 && mn.unattributedMinutes === mn.presentMinutes - mn.attributedMinutes,
    JSON.stringify(mn));

  // The two stretches file to different calendar days, which is exactly what a
  // date-scoped sum gets wrong — it sees 60 of the 120 and reports twice the
  // gap. Attribution is by window, so the day boundary never enters into it.
  const mnDay = (await call('GET', `/api/entries?from=${mn.date}&to=${mn.date}`)).body.entries
    .reduce((s, e) => s + e.minutes, 0);
  ok('a date-scoped sum would have missed the far side of midnight',
    mnDay === 60 && mn.attributedMinutes === 120, `${mnDay} on ${mn.date} vs ${mn.attributedMinutes} attributed`);
  ok('presence is never less than what is attributed to it', mn.presentMinutes >= mn.attributedMinutes);

  console.log('\na shift across a DST boundary');
  const springIn = atLocal(2026, 3, 8, 1, 0);     // 01:00 EST
  const springOut = atLocal(2026, 3, 8, 4, 0);    // 04:00 EDT — three hours on the wall, two in fact
  ok('the spring fixture really straddles the step',
    zoneLead(springIn) !== zoneLead(springOut),
    `${zoneLead(springIn) / hour}h → ${zoneLead(springOut) / hour}h`);
  placeShift(springIn, springOut, [
    [atLocal(2026, 3, 8, 1, 15), atLocal(2026, 3, 8, 1, 45), P1],
    [atLocal(2026, 3, 8, 3, 0), atLocal(2026, 3, 8, 3, 30), P2],
  ]);
  const spring = await readShift('2026-03-08');
  ok('the hour that does not exist is not counted as presence',
    spring.presentMinutes === 120, `${spring.presentMinutes} — the wall clock says 180`);
  ok('attribution across the spring-forward step reconciles',
    spring.attributedMinutes === 60 && spring.unattributedMinutes === 60
    && spring.unattributedMinutes === spring.presentMinutes - spring.attributedMinutes,
    JSON.stringify(spring));

  const fallIn = atLocal(2026, 11, 1, 0, 30);     // 00:30 EDT
  const fallOut = atLocal(2026, 11, 1, 2, 30);    // 02:30 EST — two hours on the wall, three in fact
  ok('the autumn fixture really straddles the step',
    zoneLead(fallIn) !== zoneLead(fallOut), `${zoneLead(fallIn) / hour}h → ${zoneLead(fallOut) / hour}h`);
  placeShift(fallIn, fallOut, [[atLocal(2026, 11, 1, 0, 45), atLocal(2026, 11, 1, 1, 45), P1]]);
  const fall = await readShift('2026-11-01');
  ok('the hour that happens twice is counted twice',
    fall.presentMinutes === 180, `${fall.presentMinutes} — the wall clock says 120`);
  ok('attribution across the fall-back step reconciles',
    fall.attributedMinutes === 60 && fall.unattributedMinutes === 120
    && fall.unattributedMinutes === fall.presentMinutes - fall.attributedMinutes,
    JSON.stringify(fall));

  console.log('\nwhat moves the gap');
  const fallEntry = (await call('GET', '/api/entries?from=2026-11-01&to=2026-11-01')).body.entries[0];
  await call('PATCH', `/api/entries/${fallEntry.id}`, { minutes: 10 });
  const trimmed = await readShift('2026-11-01');
  ok('correcting an entry after clock-out moves the gap on the next read',
    trimmed.attributedMinutes === 10 && trimmed.unattributedMinutes === 170, JSON.stringify(trimmed));

  await call('PATCH', `/api/entries/${fallEntry.id}`, { minutes: 600 });
  const inflated = await readShift('2026-11-01');
  ok('an entry cannot account for more presence than the span it covers',
    inflated.attributedMinutes === 60 && inflated.unattributedMinutes === 120, JSON.stringify(inflated));
  // PATCH /api/entries never touches started_at, so the window still says 60
  // and the gap still says 120 — the report is unmoved while the invoice is
  // ten hours. That is the second route to an overbill and the reason the
  // claim is counted unclamped as well.
  ok('but the ten hours it now bills against three is stated outright',
    inflated.claimedMinutes === 600 && inflated.overclaimedMinutes === 420,
    JSON.stringify({ claimed: inflated.claimedMinutes, over: inflated.overclaimedMinutes }));

  // A stretch that merely straddles clock-in is not an overclaim: the part
  // outside is real work in another part of the day, not minutes billed
  // against this presence. Only a claim with no clock behind it crosses over.
  //
  // Three hours of work of which one falls inside a three-hour shift. Summing
  // the whole of every overlapping entry — the obvious way to count a claim —
  // reads 180 + 60 = 240 against 180 and cries overclaim on an ordinary
  // morning that started before the clock-in. That figure would be wrong on so
  // many days that it would join the list of things people scroll past, which
  // is the failure mode this number exists to avoid.
  await call('PATCH', `/api/entries/${fallEntry.id}`, { minutes: 60 });
  sql((w) => w(`INSERT INTO time_entries
      (user_id, project_id, date, minutes, note, billable, started_at, ended_at, source, created_at, updated_at)
    VALUES (?, ?, '2026-11-01', 180, 'started before the clock-in', 1, ?, ?, 'timer', ?, ?)`,
  shiftUid, P1, new Date(fallIn - 120 * 60000).toISOString(), new Date(fallIn + 60 * 60000).toISOString(),
  new Date(fallIn).toISOString(), new Date(fallIn).toISOString()));
  const straddle = await readShift('2026-11-01');
  ok('a stretch straddling clock-in counts only the part inside',
    straddle.attributedMinutes === 120 && straddle.claimedMinutes === 120,
    JSON.stringify(straddle));
  ok('and is no overclaim, however much of it lies outside',
    straddle.overclaimedMinutes === 0,
    `claimed ${straddle.claimedMinutes} against ${straddle.presentMinutes} present`);
  sql((w) => w("DELETE FROM time_entries WHERE note = 'started before the clock-in'"));

  // Minutes claimed with no clock behind them have no position in time, so
  // exactly one shift may count them: the one holding the instant the stretch
  // began, which is the same rule that decides the day it files under. A
  // stretch worked through lunch overlaps the morning and the afternoon, and
  // handing the excess to both reports one overbill as two.
  const lunchIn = atLocal(2026, 7, 14, 9, 0);
  const lunchOut = atLocal(2026, 7, 14, 12, 0);
  const backIn = atLocal(2026, 7, 14, 13, 0);
  const backOut = atLocal(2026, 7, 14, 17, 0);
  placeShift(lunchIn, lunchOut, []);
  placeShift(backIn, backOut, []);
  sql((w) => w(`INSERT INTO time_entries
      (user_id, project_id, date, minutes, note, billable, started_at, ended_at, source, created_at, updated_at)
    VALUES (?, ?, '2026-07-14', 600, 'worked through lunch', 1, ?, ?, 'timer', ?, ?)`,
  shiftUid, P1, new Date(atLocal(2026, 7, 14, 11, 0)).toISOString(),
  new Date(atLocal(2026, 7, 14, 14, 0)).toISOString(),
  new Date(lunchIn).toISOString(), new Date(lunchIn).toISOString()));
  const spells = (await call('GET', '/api/shifts?from=2026-07-14&to=2026-07-14')).body.shifts
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  // Morning holds one of its three hours and the whole 420-minute excess:
  // 60 + 420 billed against 180 present, so 300 over. The afternoon holds
  // another hour of it and no excess at all, so nothing over.
  ok('a stretch worked through lunch is billed against the spell it began in',
    spells[0].overclaimedMinutes === 300 && spells[1].overclaimedMinutes === 0,
    spells.map((x) => `${x.startedAt}: claimed ${x.claimedMinutes} over ${x.overclaimedMinutes}`).join(' · '));
  ok('and each spell still counts the part of it that it actually contained',
    spells[0].attributedMinutes === 60 && spells[1].attributedMinutes === 60,
    spells.map((x) => x.attributedMinutes).join(','));
  sql((w) => {
    w("DELETE FROM time_entries WHERE note = 'worked through lunch'");
    w("DELETE FROM shifts WHERE user_id = ? AND date = '2026-07-14'", shiftUid);
  });

  await call('DELETE', `/api/entries/${fallEntry.id}`);
  const emptied = await readShift('2026-11-01');
  ok('deleting it hands the whole shift back as unattributed',
    emptied.presentMinutes === 180 && emptied.attributedMinutes === 0 && emptied.unattributedMinutes === 180,
    JSON.stringify(emptied));

  // A block logged by hand carries no start and end, so nothing can place it
  // inside a particular shift. Reporting it per shift meant a zero-minute shift
  // claimed every manual minute filed on its date, and two shifts on one date
  // each claimed the same block as their own. It belongs to the day.
  await call('POST', '/api/entries', { projectId: P1, minutes: 45, date: '2026-11-01', note: 'By hand' });
  const byHandShift = await readShift('2026-11-01');
  ok('a shift does not claim the manual blocks that share its date',
    !('unplacedMinutes' in byHandShift), Object.keys(byHandShift).join(','));
  ok('and it does not close a gap nothing could be placed inside',
    byHandShift.attributedMinutes === 0 && byHandShift.unattributedMinutes === 180);

  await call('POST', '/api/entries', { projectId: P1, minutes: 45, note: 'By hand, today' });
  const dayBoot2 = (await call('GET', '/api/bootstrap')).body;
  ok('the day reports what was logged by hand on it',
    dayBoot2.unplacedMinutes === 45, String(dayBoot2.unplacedMinutes));

  // Nothing the API can do produces two overlapping stretches. A hand-edited
  // database can, and the reconciliation has to report no gap rather than a
  // negative one, which would read as hours owed back.
  sql((w) => {
    for (const n of [1, 2]) {
      w(`INSERT INTO time_entries
           (user_id, project_id, date, minutes, note, billable, started_at, ended_at, source, created_at, updated_at)
         VALUES (?, ?, '2026-11-01', 180, ?, 1, ?, ?, 'timer', ?, ?)`,
        shiftUid, P1, `overlap ${n}`, new Date(fallIn).toISOString(), new Date(fallOut).toISOString(),
        new Date(fallIn).toISOString(), new Date(fallIn).toISOString());
    }
  });
  const overlapped = await readShift('2026-11-01');
  ok('overlapping stretches clamp to the presence instead of going negative',
    overlapped.attributedMinutes === 180 && overlapped.unattributedMinutes === 0, JSON.stringify(overlapped));
  ok('presence is never less than what is attributed to it, even then',
    overlapped.presentMinutes >= overlapped.attributedMinutes);
  // The clamp is exactly why attributed alone cannot be the gap report: it says
  // "nothing unaccounted" for a timesheet billing twice the presence. The
  // unclamped claim is what makes the overrun sayable at all.
  ok('and the overrun the clamp hides is stated instead of vanishing',
    overlapped.claimedMinutes === 360 && overlapped.overclaimedMinutes === 180,
    JSON.stringify({ claimed: overlapped.claimedMinutes, over: overlapped.overclaimedMinutes }));

  // The sheet walks the same stretches in start order with a cursor that only
  // moves forward. A SHORT stretch nested inside a longer one is the case that
  // separates that from a naive walk: the naive one drags the cursor back to
  // the short stretch's end and opens a phantom gap over presence the long one
  // already covers — then offers those minutes for disposal, on top of work
  // that is already there. Two stretches of equal length would not show it,
  // which is why this one is nested rather than duplicated.
  sql((w) => w(`INSERT INTO time_entries
       (user_id, project_id, date, minutes, note, billable, started_at, ended_at, source, created_at, updated_at)
     VALUES (?, ?, '2026-11-01', 30, 'nested inside the overlap', 1, ?, ?, 'timer', ?, ?)`,
  shiftUid, P2, new Date(fallIn + 30 * 60000).toISOString(), new Date(fallIn + 60 * 60000).toISOString(),
  new Date(fallIn).toISOString(), new Date(fallIn).toISOString()));
  const overlapSheet = (await call('GET', `/api/shift/${overlapped.id}`)).body;
  ok('a stretch nested inside another is shown as the row it is',
    overlapSheet.segments.filter((s) => s.kind === 'work').length === 3,
    JSON.stringify(overlapSheet.segments.map((s) => `${s.kind} ${s.minutes}`)));
  ok('and opens no gap over presence the longer stretch already covers',
    overlapSheet.openMinutes === 0 && overlapSheet.segments.every((s) => s.kind !== 'gap'),
    JSON.stringify({ open: overlapSheet.openMinutes }));
  sql((w) => w("DELETE FROM time_entries WHERE note = 'nested inside the overlap'"));

  console.log('\ncorrecting attendance after the fact');
  // Time entries have always been editable and the whole read-time
  // reconciliation leans on that. The presence they are measured against was
  // write-once: a clock-out forgotten overnight reported nineteen hours with no
  // cap, no warning and no way back that did not involve opening the database.
  const forgot = (await call('POST', '/api/shift/in')).body.shift;
  sql((w) => w('UPDATE shifts SET started_at = ? WHERE id = ?',
    new Date(Date.now() - 19 * hour).toISOString(), forgot.id));
  const overnight = (await call('GET', '/api/bootstrap')).body.shifts.find((x) => x.open);
  ok('a clock-out nobody remembered reports the whole nineteen hours',
    overnight.presentMinutes >= 19 * 60, String(overnight.presentMinutes));

  const fixed = await call('PATCH', `/api/shift/${forgot.id}`, {
    endedAt: new Date(Date.parse(overnight.startedAt) + 8 * hour).toISOString(),
  });
  ok('and it can be corrected to the eight hours actually worked',
    fixed.status === 200 && fixed.body.shift.presentMinutes === 480 && fixed.body.shift.open === false,
    JSON.stringify(fixed.body.shift));
  ok('the correction recomputes the gap rather than storing one',
    fixed.body.shift.unattributedMinutes === 480 - fixed.body.shift.attributedMinutes);

  ok('a shift cannot end before it starts',
    (await call('PATCH', `/api/shift/${forgot.id}`,
      { endedAt: new Date(Date.parse(overnight.startedAt) - hour).toISOString() })).status === 400);
  ok('nor take a start that is not a date at all',
    (await call('PATCH', `/api/shift/${forgot.id}`, { startedAt: 'yesterday-ish' })).status === 400);

  // The cap, on a quiet stretch of calendar where nothing else can refuse it
  // first. Asserted against today's shifts it passed for the wrong reason: the
  // overlap check caught the 25 hours before the cap ever saw them.
  const quiet = atLocal(2026, 5, 5, 10, 0);
  sql((w) => w('INSERT INTO shifts (user_id, date, started_at, ended_at, note) VALUES (?, ?, ?, ?, ?)',
    shiftUid, '2026-05-05', new Date(quiet).toISOString(), new Date(quiet + 2 * hour).toISOString(), ''));
  const quietId = (await readShift('2026-05-05')).id;
  ok('a shift may run right up to twenty-three hours',
    (await call('PATCH', `/api/shift/${quietId}`,
      { endedAt: new Date(quiet + 23 * hour).toISOString() })).status === 200);
  ok('but not longer than a day',
    (await call('PATCH', `/api/shift/${quietId}`,
      { endedAt: new Date(quiet + 25 * hour).toISOString() })).status === 400);
  ok('and the refusal leaves it as it was',
    (await readShift('2026-05-05')).presentMinutes === 23 * 60,
    String((await readShift('2026-05-05')).presentMinutes));
  await call('DELETE', `/api/shift/${quietId}`);

  // Several spells in a day is the ordinary case — lunch — and the morning's
  // gap does not stop existing at one o'clock. This person has picked up a few
  // over the sections above, so the assertions are about the shape of the list
  // rather than a count that would drift every time a fixture is added.
  //
  // `forgot` began nineteen hours ago and was corrected to end eight hours
  // after that, so it lies wholly on YESTERDAY's local date for every run
  // starting before 19:00 in the app timezone — which is most of them. Reading
  // it back out of the bootstrap therefore only worked in the evening: these
  // three assertions were red at every other hour of the day, and were.
  // Today's spells come from the bootstrap; an older one comes from the range
  // endpoint, which is the exact reason that endpoint exists.
  const everyShift = async () =>
    (await call('GET', '/api/shifts?from=1970-01-01&to=2999-12-31')).body.shifts;
  const beforeLunch = (await call('GET', '/api/bootstrap')).body.shifts;
  const lunchBack = await call('POST', '/api/shift/in');
  ok('a second spell can be opened once the first is closed', lunchBack.status === 200);
  const both = (await call('GET', '/api/bootstrap')).body.shifts;
  ok('bootstrap reports every spell of the day, oldest first',
    both.length === beforeLunch.length + 1
    && both.every((x, i) => i === 0 || both[i - 1].startedAt <= x.startedAt)
    && both.some((x) => x.id === lunchBack.body.shift.id),
    both.map((x) => `${x.id}:${x.startedAt}`).join(' '));
  const corrected = (await everyShift()).find((x) => x.id === forgot.id);
  ok('the corrected spell is still readable, with its own reconciliation',
    corrected?.presentMinutes === 480 && corrected.open === false
    && both.find((x) => x.id === lunchBack.body.shift.id)?.open === true,
    JSON.stringify(corrected));
  ok('and exactly one spell anywhere is running',
    (await everyShift()).filter((x) => x.open).length === 1,
    String((await everyShift()).filter((x) => x.open).length));

  // Presence cannot happen twice at once, or the same minute is reconciled
  // against two shifts and counted as covered in both.
  ok('a spell cannot be moved on top of another',
    (await call('PATCH', `/api/shift/${lunchBack.body.shift.id}`, {
      startedAt: new Date(Date.parse(both[0].startedAt) + hour).toISOString(),
      endedAt: new Date(Date.parse(both[0].startedAt) + 2 * hour).toISOString(),
    })).status === 400);
  ok('and one already closed cannot be reopened while another is running',
    (await call('PATCH', `/api/shift/${forgot.id}`, { endedAt: null })).status === 400);

  ok('someone else\'s attendance is not yours to edit',
    (await call('PATCH', `/api/shift/${forgot.id}`, { note: 'x' })).status === 200
    && (await callOn(BASE, 'PATCH', `/api/shift/${forgot.id}`, { note: 'x' })).status === 401,
    'an unauthenticated PATCH was accepted');

  const entriesBeforeDelete = (await call('GET', '/api/entries?from=1970-01-01')).body.entries.length;
  const shiftsBeforeDelete = await everyShift();
  const gone = await call('DELETE', `/api/shift/${forgot.id}`);
  ok('a spell recorded by mistake can be removed', gone.status === 200);
  const afterDelete = await everyShift();
  ok('and only that one goes',
    afterDelete.length === shiftsBeforeDelete.length - 1 && !afterDelete.some((x) => x.id === forgot.id),
    afterDelete.map((x) => x.id).join(','));
  ok('taking no logged work with it — nothing references a shift',
    (await call('GET', '/api/entries?from=1970-01-01')).body.entries.length === entriesBeforeDelete,
    `${entriesBeforeDelete} entries before, `
    + `${(await call('GET', '/api/entries?from=1970-01-01')).body.entries.length} after`);
  ok('deleting one that is already gone 404s',
    (await call('DELETE', `/api/shift/${forgot.id}`)).status === 404);
  await call('POST', '/api/shift/out');

  console.log('\nthe clock-out sheet');
  // A day with a shape to it: eight hours here, three of them clocked, and the
  // rest open. Placed on a quiet stretch of calendar so nothing this person has
  // picked up over the sections above can reach into it.
  const sheetIn = atLocal(2026, 9, 15, 9, 0);
  const sheetOut = atLocal(2026, 9, 15, 17, 0);
  placeShift(sheetIn, sheetOut, [
    [atLocal(2026, 9, 15, 9, 30), atLocal(2026, 9, 15, 11, 0), P1],
    [atLocal(2026, 9, 15, 13, 0), atLocal(2026, 9, 15, 14, 30), P2],
  ]);
  const sheetId = (await readShift('2026-09-15')).id;
  const sheet = (await call('GET', `/api/shift/${sheetId}`)).body;

  ok('the sheet lays the day out end to end, with nothing between the rows',
    sheet.segments[0].from === new Date(sheetIn).toISOString()
    && sheet.segments[sheet.segments.length - 1].to === new Date(sheetOut).toISOString()
    && sheet.segments.every((s, i) => i === 0 || sheet.segments[i - 1].to === s.from),
    sheet.segments.map((s) => `${s.kind} ${s.minutes}m`).join(' · '));
  ok('and names what each stretch of it was for',
    sheet.segments.filter((s) => s.kind === 'work').length === 2
    && sheet.segments.filter((s) => s.kind === 'work').every((s) => s.projectId && s.projectName),
    JSON.stringify(sheet.segments.filter((s) => s.kind === 'work').map((s) => s.projectName)));
  ok('open time is reported as open, and adds to exactly what could be filed into it',
    sheet.segments.filter((s) => s.kind === 'gap').map((s) => s.minutes).join() === '30,120,150'
    && sheet.openMinutes === 300,
    `${sheet.openMinutes} open`);

  // The reviewer's trap from an earlier round: a figure on one screen that
  // quietly disagrees with the screen beside it. Both are shiftView, and this
  // is what says so.
  const stripView = await readShift('2026-09-15');
  ok('the sheet and the strip report the same day, figure for figure',
    ['presentMinutes', 'attributedMinutes', 'unattributedMinutes', 'claimedMinutes', 'overclaimedMinutes']
      .every((k) => sheet.shift[k] === stripView[k]),
    JSON.stringify({ sheet: sheet.shift, strip: stripView }));
  ok('and presence is open time plus what was attributed, with no minute in two places',
    sheet.openMinutes + sheet.shift.attributedMinutes + sheet.shortfallMinutes
      === sheet.shift.presentMinutes,
    `${sheet.openMinutes} + ${sheet.shift.attributedMinutes} + ${sheet.shortfallMinutes} `
    + `vs ${sheet.shift.presentMinutes}`);

  // A day rarely ends on a whole minute. The gap is FLOORED, because it is a
  // promise about what a disposition would write — but the shortfall must be
  // measured against the gap's real length, or thirty leftover seconds are
  // announced as a stretch billing less than it ran and the sheet accuses
  // somebody of an overbill it invented by rounding.
  const oddIn = atLocal(2026, 9, 19, 9, 0);
  placeShift(oddIn, atLocal(2026, 9, 19, 12, 0) + 30000, []);
  const odd = (await call('GET', `/api/shift/${(await readShift('2026-09-19')).id}`)).body;
  ok('a gap that is not a whole number of minutes offers only the whole ones',
    odd.openMinutes === 180 && odd.shift.presentMinutes === 181, JSON.stringify(odd.shift));
  ok('and the leftover seconds are not reported as an entry billing less than it ran',
    odd.shortfallMinutes === 0, String(odd.shortfallMinutes));

  // Blocks logged by hand carry no window, so nothing can place them inside
  // this presence — the sheet says so rather than leaving a reader to wonder.
  await call('POST', '/api/entries', { projectId: P1, minutes: 45, date: '2026-09-15', note: 'By hand' });
  ok('the sheet reports the day\'s unplaced manual time as its own fact',
    (await call('GET', `/api/shift/${sheetId}`)).body.unplacedMinutes === 45);
  ok('a sheet for a shift that does not exist 404s',
    (await call('GET', '/api/shift/999999')).status === 404);
  ok('and an unauthenticated read is refused',
    (await callOn(BASE, 'GET', `/api/shift/${sheetId}`)).status === 401);

  console.log('\ndisposing of the gap');
  // An overhead bucket is an ORDINARY project flagged non-billable, not a magic
  // value: it is created through the same endpoint as any other, and everything
  // downstream — reports, budgets, the billable share — already knows what a
  // non-billable project means.
  const memberSeat = cookie;
  cookie = adminSeat;
  const overhead = (await call('POST', '/api/projects', {
    name: 'Admin & Overhead', code: 'OVH', billable: false,
  })).body.project;
  const retired = (await call('POST', '/api/projects', { name: 'Retired Bucket', billable: false })).body.project;
  await call('PATCH', `/api/projects/${retired.id}`, { status: 'archived' });
  cookie = memberSeat;
  ok('an overhead bucket is a project like any other, flagged non-billable',
    overhead.billable === false && overhead.status === 'active', JSON.stringify(overhead));

  // Explicitly to the far end of the calendar: /api/entries defaults `to` to
  // today, and these fixtures sit on a quiet date that is still in the future.
  const everyEntry = async () =>
    (await call('GET', '/api/entries?from=1970-01-01&to=2999-12-31')).body.entries;
  const priorRows = (await everyEntry()).length;
  const put = await call('POST', `/api/shift/${sheetId}/dispose`, { projectId: overhead.id, note: 'Unaccounted presence' });
  ok('disposing of the gap writes one ordinary entry per stretch of open time',
    put.status === 200 && put.body.entries.length === 3 && put.body.minutes === 300,
    JSON.stringify({ n: put.body.entries?.length, minutes: put.body.minutes, err: put.body.error }));
  ok('and every one of them bills exactly the window it holds',
    put.body.entries.every((e) => Date.parse(e.endedAt) - Date.parse(e.startedAt) === e.minutes * 60000),
    put.body.entries.map((e) => `${e.minutes}m/${(Date.parse(e.endedAt) - Date.parse(e.startedAt)) / 60000}m`).join(' '));
  ok('the gap closes', put.body.shift.unattributedMinutes === 0
    && put.body.shift.attributedMinutes === 480, JSON.stringify(put.body.shift));
  ok('and not one minute of it is overclaimed',
    put.body.shift.overclaimedMinutes === 0 && put.body.shift.claimedMinutes <= put.body.shift.presentMinutes,
    JSON.stringify(put.body.shift));
  ok('billable follows the bucket, which is the whole reason to have one',
    put.body.entries.every((e) => e.billable === false));
  ok('the entries are in the timesheet like any others, on the day they were worked',
    (await call('GET', '/api/entries?from=2026-09-15&to=2026-09-15')).body.entries
      .filter((e) => e.projectId === overhead.id).reduce((s, e) => s + e.minutes, 0) === 300);
  ok('and the rows really were written, not counted twice from one insert',
    (await everyEntry()).length === priorRows + 3,
    `${priorRows} rows before, ${(await everyEntry()).length} after`);
  ok('a second tap finds nothing left rather than filing the afternoon twice',
    (await call('POST', `/api/shift/${sheetId}/dispose`, { projectId: overhead.id })).status === 400);

  // Nothing derived is stored: correcting one of those entries has to move the
  // reconciliation, and it has to move it the RIGHT way. The window is
  // untouched, so the presence is still covered — unattributed, but not open.
  const disposed = put.body.entries.find((e) => e.minutes === 150);
  await call('PATCH', `/api/entries/${disposed.id}`, { minutes: 5 });
  const trimmedSheet = (await call('GET', `/api/shift/${sheetId}`)).body;
  ok('trimming a disposed entry re-opens the gap in the figures, computed fresh',
    trimmedSheet.shift.unattributedMinutes === 145, JSON.stringify(trimmedSheet.shift));
  ok('but the minutes are unattributed and NOT open — a stretch already sits there',
    trimmedSheet.openMinutes === 0 && trimmedSheet.shortfallMinutes === 145,
    JSON.stringify({ open: trimmedSheet.openMinutes, short: trimmedSheet.shortfallMinutes }));
  await call('PATCH', `/api/entries/${disposed.id}`, { minutes: 150 });

  // One row of the sheet rather than the whole of it.
  const scopeIn = atLocal(2026, 9, 16, 10, 0);
  const scopeOut = atLocal(2026, 9, 16, 14, 0);
  placeShift(scopeIn, scopeOut, []);
  const scopeId = (await readShift('2026-09-16')).id;
  const scoped = await call('POST', `/api/shift/${scopeId}/dispose`, {
    projectId: overhead.id,
    from: new Date(atLocal(2026, 9, 16, 11, 0)).toISOString(),
    to: new Date(atLocal(2026, 9, 16, 12, 0)).toISOString(),
  });
  ok('one stretch of the day can be assigned on its own',
    scoped.status === 200 && scoped.body.entries.length === 1 && scoped.body.minutes === 60,
    JSON.stringify({ n: scoped.body.entries?.length, m: scoped.body.minutes, err: scoped.body.error }));
  const scopeSheet = (await call('GET', `/api/shift/${scopeId}`)).body;
  ok('and the rest of it is left exactly as it was',
    scopeSheet.openMinutes === 180
    && scopeSheet.segments.filter((s) => s.kind === 'gap').map((s) => s.minutes).join() === '60,120',
    JSON.stringify(scopeSheet.segments.map((s) => `${s.kind} ${s.minutes}`)));
  ok('a stretch with one end and not the other is refused',
    (await call('POST', `/api/shift/${scopeId}/dispose`,
      { projectId: overhead.id, from: new Date(scopeIn).toISOString() })).status === 400);
  ok('and one that ends before it starts',
    (await call('POST', `/api/shift/${scopeId}/dispose`, {
      projectId: overhead.id,
      from: new Date(scopeOut).toISOString(), to: new Date(scopeIn).toISOString(),
    })).status === 400);

  ok('an archived project is not a bucket you can still file into',
    (await call('POST', `/api/shift/${scopeId}/dispose`, { projectId: retired.id })).status === 400);
  ok('nor a project that does not exist',
    (await call('POST', `/api/shift/${scopeId}/dispose`, { projectId: 999999 })).status === 404);
  ok('nor no project at all — a gap is disposed of somewhere or not at all',
    (await call('POST', `/api/shift/${scopeId}/dispose`, {})).status === 400);

  // The open shift's gap is still growing, so there is nothing settled to fill.
  // Backdated first, and deliberately: a shift opened this instant has no gap
  // worth a minute, so it is refused whether or not the rule exists — and an
  // assertion that passes either way proves nothing about the rule it names.
  const stillIn = (await call('POST', '/api/shift/in')).body.shift;
  sql((w) => w('UPDATE shifts SET started_at = ? WHERE id = ?',
    new Date(Date.now() - 2 * hour).toISOString(), stillIn.id));
  const openGap = (await call('GET', `/api/shift/${stillIn.id}`)).body;
  ok('the open shift really does have a gap to be refused',
    openGap.openMinutes >= 100 && openGap.shift.open === true, JSON.stringify(openGap.shift));
  const openTry = await call('POST', `/api/shift/${stillIn.id}/dispose`, { projectId: overhead.id });
  ok('an open shift has no settled gap to dispose of', openTry.status === 400, `status ${openTry.status}`);
  ok('and the refusal says so, rather than reporting an empty gap',
    /clock out first/i.test(openTry.body.error || ''), openTry.body.error);
  await call('POST', '/api/shift/out');

  // Attendance is one person's, and so is accounting for it.
  sql((w) => w('INSERT INTO shifts (user_id, date, started_at, ended_at, note) VALUES (?, ?, ?, ?, ?)',
    1, '2026-09-18', new Date(atLocal(2026, 9, 18, 9, 0)).toISOString(),
    new Date(atLocal(2026, 9, 18, 12, 0)).toISOString(), ''));
  const othersId = (await call('GET', '/api/shifts?scope=team&from=2026-09-18&to=2026-09-18')).body.shifts[0].id;
  ok('someone else\'s attendance is not yours to account for',
    (await call('POST', `/api/shift/${othersId}/dispose`, { projectId: overhead.id })).status === 403);

  console.log('\nwhat a disposition is not allowed to do');
  // The one rule that matters. Every stretch written by a disposition bills
  // exactly the window it holds and lands where nothing else does, so it cannot
  // overclaim on its own — but a day already carrying an entry that bills more
  // minutes than its clock ran has no room left to give, and filling the gap
  // would be the straw that puts the invoice past the day.
  //
  // Three hours present, half an hour of it clocked, and that half hour edited
  // to bill ninety minutes: 90 claimed against 180, so no overclaim YET, and
  // 150 minutes still open. Filling them would bill 240 against 180.
  const tightIn = atLocal(2026, 9, 17, 9, 0);
  placeShift(tightIn, atLocal(2026, 9, 17, 12, 0), [
    [atLocal(2026, 9, 17, 9, 30), atLocal(2026, 9, 17, 10, 0), P1],
  ]);
  const tightId = (await readShift('2026-09-17')).id;
  const tightEntry = (await call('GET', '/api/entries?from=2026-09-17&to=2026-09-17')).body.entries[0];
  await call('PATCH', `/api/entries/${tightEntry.id}`, { minutes: 90 });

  const tightBefore = (await call('GET', `/api/shift/${tightId}`)).body;
  ok('a stretch billing more than it ran is flagged on the row that causes it',
    tightBefore.segments.some((s) => s.kind === 'work' && s.claimsMinutes === 90 && s.spanMinutes === 30),
    JSON.stringify(tightBefore.segments.filter((s) => s.kind === 'work')));
  ok('the day does not overclaim yet, and its gap is real',
    tightBefore.shift.overclaimedMinutes === 0 && tightBefore.shift.claimedMinutes === 90
    && tightBefore.openMinutes === 150, JSON.stringify(tightBefore.shift));

  const rowsBefore = (await everyEntry()).length;
  const refused = await call('POST', `/api/shift/${tightId}/dispose`, { projectId: overhead.id });
  ok('filling that gap is refused, because it would bill more than the day held',
    refused.status === 400, `status ${refused.status}`);
  ok('and the refusal states the arithmetic rather than saying no',
    /4h against 3h of presence/.test(refused.body.error || ''), refused.body.error);
  ok('nothing was written on the way to that refusal',
    (await everyEntry()).length === rowsBefore,
    `${rowsBefore} rows before, ${(await everyEntry()).length} after`);
  const tightAfter = (await call('GET', `/api/shift/${tightId}`)).body;
  ok('and the gap it would not fill is still exactly where it was',
    tightAfter.openMinutes === 150 && tightAfter.shift.attributedMinutes === 30,
    JSON.stringify(tightAfter.shift));

  // Correct the entry that was in the way, and the same call goes through —
  // the refusal was about the day, not about disposing.
  await call('PATCH', `/api/entries/${tightEntry.id}`, { minutes: 30 });
  const allowed = await call('POST', `/api/shift/${tightId}/dispose`, { projectId: overhead.id });
  ok('correct that entry and the same disposition goes through',
    allowed.status === 200 && allowed.body.shift.unattributedMinutes === 0
    && allowed.body.shift.overclaimedMinutes === 0, JSON.stringify(allowed.body.shift || allowed.body));

  console.log('\nreaching a spell that is not today\'s');
  // The wrapper whose absence made a whole endpoint unreachable from the app:
  // PATCH and DELETE need a shift id, the bootstrap carries only today's, and
  // without this the range endpoint existed with nothing calling it. Driven
  // through a stubbed fetch, so what is asserted is the request the browser
  // would really make rather than the presence of a key.
  const asked = [];
  if (typeof api.shifts === 'function') {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      asked.push(`${init?.method} ${url}`);
      return new Response(JSON.stringify({ shifts: [] }), { headers: { 'content-type': 'application/json' } });
    };
    try {
      await api.shifts({ from: '2026-10-06', to: '2026-10-06', userId: 3 });
      await api.shifts({ from: '2026-10-06', to: '2026-10-06', scope: 'team' });
    } finally { globalThis.fetch = realFetch; }
  }
  ok('the app can ask for attendance over a range, for one person or the team',
    asked[0] === 'GET /api/shifts?from=2026-10-06&to=2026-10-06&userId=3'
    && asked[1] === 'GET /api/shifts?from=2026-10-06&to=2026-10-06&scope=team',
    asked.join(' | ') || 'there is no api.shifts to call');

  console.log('\nthe day, which no single spell can see');
  // Every figure above this line is per shift, and the ground BETWEEN two
  // spells belongs to none of them. Walked here through the documented buttons
  // only — clock in, clock out, the pencil, Assign — because that is how it was
  // reached: nothing below writes a fixture the app itself could not produce.
  //
  //   clock in/out → pencil the spell to 09:00–12:00
  //   dispose the whole gap                  → 180m filed, window 09:00–12:00
  //   pencil the SAME spell to end at 10:00
  //
  // The spell now reports open 0, unaccounted 0, overclaimed 0 — all true of
  // the spell. The day it sits in bills three hours against one of presence.
  // Fixed instants on quiet days, which is the only way an attendance fixture
  // can be placed at all — but a fixture day that IS the day of the run would
  // collect this person's own clock-ins from the sections above and read a
  // different presence. Stated as an assertion rather than assumed.
  const runDay = (await call('GET', '/api/bootstrap')).body.today;
  ok('the quiet days these fixtures sit on are not the day this run happens on',
    runDay !== '2026-10-06' && runDay !== '2026-10-08' && runDay !== '2026-10-09',
    `today is ${runDay} — move the fixtures`);

  const penciled = async (from, to) => {
    await call('POST', '/api/shift/in');
    const closed = (await call('POST', '/api/shift/out')).body.shift;
    const res = await call('PATCH', `/api/shift/${closed.id}`, {
      startedAt: new Date(from).toISOString(),
      ...(to === null ? {} : { endedAt: new Date(to).toISOString() }),
    });
    return res.body.shift;
  };

  const d1 = await penciled(atLocal(2026, 10, 6, 9, 0), atLocal(2026, 10, 6, 12, 0));
  ok('a spell corrected onto a quiet day is three hours of presence with nothing in it',
    d1.presentMinutes === 180 && d1.date === '2026-10-06', JSON.stringify(d1));
  const d1Filed = await call('POST', `/api/shift/${d1.id}/dispose`, { projectId: overhead.id });
  ok('disposing of the whole of it files three hours against the bucket',
    d1Filed.status === 200 && d1Filed.body.minutes === 180, JSON.stringify(d1Filed.body.error || d1Filed.body.minutes));

  await call('PATCH', `/api/shift/${d1.id}`, { endedAt: new Date(atLocal(2026, 10, 6, 10, 0)).toISOString() });
  // `day` read through a helper, never off the payload directly: a block that
  // vanished must read as a failed assertion, not as a crash that takes every
  // check after it with it.
  const dayOf = (sheet) => sheet.day || {};
  const shrunk = (await call('GET', `/api/shift/${d1.id}`)).body;
  ok('shortening the spell under the work leaves the spell itself reconciled',
    shrunk.shift.presentMinutes === 60 && shrunk.shift.unattributedMinutes === 0
    && shrunk.openMinutes === 0 && shrunk.shift.overclaimedMinutes === 0,
    JSON.stringify({ shift: shrunk.shift, open: shrunk.openMinutes }));
  ok('while the DAY it sits in bills three hours against one of presence',
    dayOf(shrunk).presenceMinutes === 60 && dayOf(shrunk).claimedMinutes === 180,
    JSON.stringify(dayOf(shrunk)));
  // The stretch runs past the clock-out, so an hour of it is real work inside
  // real presence. Counting the whole of it as "while nobody was clocked in"
  // would be a bigger lie than the one it replaces.
  ok('and a stretch that merely overruns the clock-out is not called off-shift',
    dayOf(shrunk).offShiftMinutes === 0, String(dayOf(shrunk).offShiftMinutes));

  const rowsBeforeDay = (await everyEntry()).length;
  const secondSpell = await penciled(atLocal(2026, 10, 6, 11, 0), atLocal(2026, 10, 6, 14, 0));
  const pushed = await call('POST', `/api/shift/${secondSpell.id}/dispose`, { projectId: overhead.id });
  ok('filling a second spell\'s gap is refused once the DAY would bill past its presence',
    pushed.status === 400, `status ${pushed.status} — ${JSON.stringify(pushed.body)}`);
  ok('and the refusal states the day\'s arithmetic, not the spell\'s',
    /5h against 4h of presence across the whole of this day/.test(pushed.body.error || ''),
    pushed.body.error);
  ok('nothing was written on the way to that refusal either',
    (await everyEntry()).length === rowsBeforeDay,
    `${rowsBeforeDay} rows before, ${(await everyEntry()).length} after`);

  // The refusal is about the day, not about disposing: give the day back the
  // presence the pencil took away and the same call goes through.
  await call('PATCH', `/api/shift/${d1.id}`, { endedAt: new Date(atLocal(2026, 10, 6, 11, 0)).toISOString() });
  const nowAllowed = await call('POST', `/api/shift/${secondSpell.id}/dispose`, { projectId: overhead.id });
  ok('correct the presence and the same disposition goes through',
    nowAllowed.status === 200 && nowAllowed.body.minutes === 120,
    JSON.stringify(nowAllowed.body.error || nowAllowed.body.minutes));
  const dayAfterFix = (await call('GET', `/api/shift/${secondSpell.id}`)).body;
  ok('and the day then bills exactly what it was present for',
    dayOf(dayAfterFix).claimedMinutes === 300 && dayOf(dayAfterFix).presenceMinutes === 300,
    JSON.stringify(dayOf(dayAfterFix)));

  // A stretch clocked entirely outside every spell: not attributed, not open,
  // not a shortfall, not unplaced — it carries a window, so unplacedMinutes
  // (which counts only rows with none) cannot see it. Before this it was on the
  // timesheet and named nowhere.
  const offIn = atLocal(2026, 10, 8, 9, 0);
  placeShift(offIn, atLocal(2026, 10, 8, 17, 0), [
    [atLocal(2026, 10, 8, 9, 0), atLocal(2026, 10, 8, 11, 0), P1],
    [atLocal(2026, 10, 8, 15, 0), atLocal(2026, 10, 8, 16, 0), P2],
  ]);
  const offId = (await readShift('2026-10-08')).id;
  await call('PATCH', `/api/shift/${offId}`, { endedAt: new Date(atLocal(2026, 10, 8, 12, 0)).toISOString() });
  const offSheet = (await call('GET', `/api/shift/${offId}`)).body;
  ok('the afternoon hour is in none of the spell\'s own figures',
    offSheet.shift.presentMinutes === 180 && offSheet.shift.attributedMinutes === 120
    && offSheet.openMinutes === 60 && offSheet.shortfallMinutes === 0
    && offSheet.unplacedMinutes === 0,
    JSON.stringify({ shift: offSheet.shift, open: offSheet.openMinutes, short: offSheet.shortfallMinutes }));
  ok('and it is named as the hour nobody was clocked in for',
    dayOf(offSheet).offShiftMinutes === 60, JSON.stringify(dayOf(offSheet)));
  // Two different facts, and neither one covers the other: this day bills
  // exactly its presence and still has an hour of work outside it.
  ok('a day can bill exactly its presence and still hold work outside it',
    dayOf(offSheet).claimedMinutes === 180 && dayOf(offSheet).presenceMinutes === 180
    && dayOf(offSheet).offShiftMinutes === 60, JSON.stringify(dayOf(offSheet)));
  const ordinary = (await call('GET', `/api/shift/${sheetId}`)).body;
  ok('an ordinary day reports neither',
    dayOf(ordinary).offShiftMinutes === 0
    && dayOf(ordinary).claimedMinutes <= dayOf(ordinary).presenceMinutes,
    JSON.stringify(dayOf(ordinary)));
  // Manual blocks have no window, so nothing places them inside or outside a
  // spell. They stay reported apart rather than being counted as work done
  // while nobody was here.
  await call('POST', '/api/entries', { projectId: P1, minutes: 45, date: '2026-10-08', note: 'By hand' });
  const withManual = (await call('GET', `/api/shift/${offId}`)).body;
  ok('a block logged by hand is not counted as work done off the clock',
    dayOf(withManual).offShiftMinutes === 60 && dayOf(withManual).claimedMinutes === 180
    && withManual.unplacedMinutes === 45, JSON.stringify(dayOf(withManual)));

  console.log('\nmoving an entry\'s date');
  // The window is the attribution — that is what makes midnight and DST
  // reconcile — so moving the date column alone left the row on one day and its
  // clock on another: the strip read "Attributed 1m" while the KPI above it
  // read "Logged today 0h".
  const windowed = (await call('GET', '/api/entries?from=2026-10-08&to=2026-10-08')).body.entries
    .find((e) => e.startedAt);
  const moved = await call('PATCH', `/api/entries/${windowed.id}`, { date: '2026-10-09' });
  ok('a stretch with a clock behind it cannot be moved to another date',
    moved.status === 400, `status ${moved.status}`);
  ok('and the refusal names the day its clock ran',
    /clock ran on 2026-10-08/.test(moved.body.error || ''), moved.body.error);
  ok('the row is exactly where it was',
    (await call('GET', '/api/entries?from=2026-10-08&to=2026-10-08')).body.entries
      .some((e) => e.id === windowed.id));
  // The editor sends every field on every save, date included. Re-sending the
  // one it already has is not a move, and refusing it would make the note
  // uneditable on every timed entry in the workspace.
  const resaved = await call('PATCH', `/api/entries/${windowed.id}`,
    { date: '2026-10-08', note: 'Same day, new label' });
  ok('re-sending the date it already has is not a move',
    resaved.status === 200 && resaved.body.entry.note === 'Same day, new label',
    JSON.stringify(resaved.body));
  const byHandRow = (await call('GET', '/api/entries?from=2026-10-08&to=2026-10-08')).body.entries
    .find((e) => e.note === 'By hand');
  ok('a block logged by hand still moves freely — it has no clock to disagree with',
    (await call('PATCH', `/api/entries/${byHandRow.id}`, { date: '2026-10-09' })).status === 200);

  console.log('\na fresh process mid-shift');
  await call('POST', '/api/shift/in');
  const midTimer = await call('POST', '/api/timer/start', { projectId: P1, note: 'Still going' });
  const midShift = (await call('GET', '/api/bootstrap')).body.shifts.find((x) => x.open);

  // A restart is a process reading back state it did not create. This one opens
  // the same database with nothing of ours in its memory.
  const third = bootServer({ PORT: String(PORT_3) });
  await ready(third, 'the mid-shift boot');
  const jar = {};
  await callOn(BASE_3, 'POST', '/api/auth/login',
    { email: 'shift@dgtlgroup.io', password: 'shift-password-1' }, jar);
  const reread = (await callOn(BASE_3, 'GET', '/api/bootstrap', null, jar)).body;
  ok('a process that did not open the shift still finds it open',
    reread.shifts?.some((x) => x.open && x.startedAt === midShift.startedAt), JSON.stringify(reread.shifts));
  ok('and the timer that was running is still running',
    reread.timer?.startedAt === midTimer.body.timer.startedAt, JSON.stringify(reread.timer));
  await stop(third.proc);
  await call('POST', '/api/shift/out');

  cookie = adminSeat;

  console.log('\nsuggestions');
  await call('POST', '/api/entries', { projectId, minutes: 60, note: 'Recurring label' });
  const suggest = await call('GET', '/api/suggestions');
  ok('suggestions return recent labels',
    suggest.status === 200 && suggest.body.labels.some((l) => l.note === 'Recurring label'));
  ok('suggestions rank projects by recent use', Array.isArray(suggest.body.projects) && suggest.body.projects.length > 0);
  ok('blank notes are not suggested', suggest.body.labels.every((l) => l.note.trim() !== ''));

  console.log('\nreports');
  const report = await call('GET', '/api/report?scope=me');
  ok('report returns totals', report.status === 200 && typeof report.body.totals.minutes === 'number');
  ok('report includes a 90-day heatmap', Array.isArray(report.body.heatmap.days));
  // The streak is gone from the payload as well as from the screen. It counted
  // days in a row with ANY time logged — showing up, not selling — and the
  // heatmap on the same screen shows consistency better than one integer. A
  // field still shipped is a field something will read again.
  ok('no report carries a streak any more',
    !('streak' in report.body)
    && !('streak' in (await call('GET', '/api/report?scope=team')).body),
    Object.keys(report.body).join(','));
  ok('report breaks down by project', report.body.byProject.length > 0);
  ok('inverted date range is rejected',
    (await call('GET', '/api/report?from=2026-05-01&to=2026-01-01')).status === 400);

  // --- overdue is measured against TODAY, never against the end of the range.
  //
  // Not one date below is a literal, and none of them is derived from this
  // machine's clock either: every one is the day the SERVER reports, stepped.
  // The bug it replaces measured `due_date < to`, so a report asked for over
  // this week called everything due inside the week late — which is a wrong
  // answer at every hour of the day, and that is exactly why it can be
  // asserted at any of them.
  const repToday = (await call('GET', '/api/bootstrap')).body.today;
  const step = (date, n) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const taskKpi = async (from, to) =>
    (await call('GET', `/api/report?scope=team&from=${from}&to=${to}`)).body.tasks;

  const AHEAD = step(repToday, 7);
  const kpi0 = await taskKpi(repToday, AHEAD);
  const laterThisWeek = (await call('POST', '/api/tasks', {
    title: 'Due on Friday, asked about on Monday', dueDate: step(repToday, 3),
  })).body.task;
  const withFuture = await taskKpi(repToday, AHEAD);
  ok('a task due inside the range but not yet due is open, and is NOT overdue',
    withFuture.overdue === kpi0.overdue && withFuture.open === kpi0.open + 1,
    `overdue ${kpi0.overdue}→${withFuture.overdue}, open ${kpi0.open}→${withFuture.open}`);

  const wasDue = (await call('POST', '/api/tasks', {
    title: 'Was due yesterday', dueDate: step(repToday, -1),
  })).body.task;
  const withPast = await taskKpi(repToday, AHEAD);
  ok('one whose date has actually passed is',
    withPast.overdue === kpi0.overdue + 1, `${kpi0.overdue} → ${withPast.overdue}`);

  // A range that ended before either task was created, let alone due. Under
  // `due_date < to` the overdue count moved with the range; it must not.
  const oldReport = await taskKpi(step(repToday, -30), step(repToday, -20));
  ok('a range wholly in the past reports the same overdue count — the range is not the clock',
    oldReport.overdue === withPast.overdue, `${withPast.overdue} vs ${oldReport.overdue} over an old range`);
  ok('and the same open count, because open is a fact about today and the screen says so',
    oldReport.open === withPast.open, `${withPast.open} vs ${oldReport.open}`);
  ok('while what the range IS for — the completions in it — is nothing like the same',
    oldReport.done !== withPast.done || (oldReport.done === 0 && withPast.done >= 0),
    `${withPast.done} vs ${oldReport.done}`);

  for (const t of [laterThisWeek, wasDue]) await call('DELETE', `/api/tasks/${t.id}`);
  const cleaned = await taskKpi(repToday, AHEAD);
  ok('and the two fixtures are gone again, so nothing after this reads them',
    cleaned.open === kpi0.open && cleaned.overdue === kpi0.overdue,
    `open ${cleaned.open}/${kpi0.open}, overdue ${cleaned.overdue}/${kpi0.overdue}`);

  console.log('\nrepeating work');
  // NOTHING in this section is a date built from this machine's clock.
  //
  // Every rule is stepped from one of two kinds of anchor: a FIXED one far
  // enough ahead that no step can reach the present — asserted, not assumed,
  // on the next line — or a date expressed relative to the day the SERVER
  // reports, compared only against that same day. A literal like "next Friday"
  // computed here would be a fixture that ages, and a fixture that ages is how
  // a suite comes to pass only in the morning.
  const serverToday = (await call('GET', '/api/bootstrap')).body.today;
  ok('the fixed anchors these rules step from are still in the future',
    serverToday < '2099-01-01', `today is ${serverToday} — the anchors below need rewriting`);

  const shiftDate = (date, n) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const daysApart = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
  const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

  const mkTask = async (patch) => (await call('POST', '/api/tasks', patch)).body.task;
  const finish = async (id, extra = {}) => (await call('PATCH', `/api/tasks/${id}`, { status: 'done', ...extra })).body;
  const allTasks = async () => (await call('GET', '/api/tasks?archived=1')).body.tasks;

  const weeklyFar = await mkTask({ title: 'Weekly note (anchored)', dueDate: '2099-01-01', recurrence: 'weekly' });
  const weeklyHeir = (await finish(weeklyFar.id)).next;
  ok('completing a weekly task writes the next one, seven days on',
    weeklyHeir?.dueDate === '2099-01-08', String(weeklyHeir?.dueDate));

  const monthEnd = await mkTask({ title: 'Invoice (month end)', dueDate: '2099-01-31', recurrence: 'monthly' });
  const febDue = (await finish(monthEnd.id)).next;
  ok('a monthly on the 31st lands on the last day of a short month, not on the 3rd of the next',
    febDue?.dueDate === '2099-02-28', String(febDue?.dueDate));
  const marDue = (await finish(febDue.id)).next;
  ok('and it stays where the clamp put it — there is no hidden anchor day to spring back to',
    marDue?.dueDate === '2099-03-28', String(marDue?.dueDate));

  // Three weeks of Friday notes written in one sitting. Stepping once would
  // have created an instance that was already a fortnight late.
  const stale = await mkTask({
    title: 'Weekly note (three weeks stale)', dueDate: shiftDate(serverToday, -21), recurrence: 'weekly',
  });
  const caught = (await finish(stale.id)).next;
  ok('a series finished three weeks late catches up instead of being born overdue',
    caught.dueDate > serverToday, `${caught.dueDate} against a today of ${serverToday}`);
  ok('it catches up in whole steps, so the note is still due on the weekday it always was',
    daysApart(stale.dueDate, caught.dueDate) % 7 === 0
    && weekdayOf(stale.dueDate) === weekdayOf(caught.dueDate),
    `${stale.dueDate} → ${caught.dueDate}`);
  ok('and it is the FIRST week that has not happened, not one convenient distance ahead',
    daysApart(serverToday, caught.dueDate) >= 1 && daysApart(serverToday, caught.dueDate) <= 7,
    `${caught.dueDate} is ${daysApart(serverToday, caught.dueDate)} days out`);

  const src = await mkTask({
    title: 'Weekly progress note to Michael', projectId, dueDate: '2099-06-05', recurrence: 'weekly',
    estimateMinutes: 60, priority: 'high', notes: 'Assembled from the worklog',
  });
  await call('POST', '/api/entries', { projectId, taskId: src.id, minutes: 75, note: 'writing this week\'s' });
  const handover = await finish(src.id);
  const heir = handover.next;
  ok('the next instance carries everything that describes the WORK',
    heir.title === src.title && heir.projectId === src.projectId && heir.assigneeId === src.assigneeId
    && heir.estimateMinutes === 60 && heir.priority === 'high' && heir.notes === src.notes
    && heir.recurrence === 'weekly', JSON.stringify(heir));
  ok('and nothing that described the one now finished',
    heir.status === 'todo' && heir.doneAt === null && handover.task.doneAt !== null, JSON.stringify(heir));
  // Read off the LIST, not off the PATCH response: only the list query joins
  // the entry totals in, so asserting loggedMinutes on the response above would
  // be comparing 0 to a 0 that means "not asked for".
  const afterHandover = await allTasks();
  const srcRow = afterHandover.find((t) => t.id === src.id);
  const heirRow = afterHandover.find((t) => t.id === heir.id);
  ok('the hours stay on the instance they were actually worked on',
    srcRow.loggedMinutes === 75 && heirRow.loggedMinutes === 0,
    JSON.stringify({ done: srcRow.loggedMinutes, next: heirRow.loggedMinutes }));
  const positions = afterHandover.map((t) => t.position);
  ok('it starts at the top of the board, not in the finished row\'s slot',
    heir.position < src.position && heir.position === Math.min(...positions),
    `${heir.position} against a minimum of ${Math.min(...positions)}`);

  const before3 = (await allTasks()).length;
  const reEdit = await call('PATCH', `/api/tasks/${src.id}`, { status: 'done', notes: 'tidied afterwards' });
  ok('editing a task that is already done does not mint a second instance',
    reEdit.body.next === null && (await allTasks()).length === before3,
    `${before3} → ${(await allTasks()).length}`);
  await call('PATCH', `/api/tasks/${src.id}`, { status: 'todo' });
  ok('reopening one does not retract the instance it already created',
    (await allTasks()).length === before3);

  const plain = await mkTask({ title: 'One-off', dueDate: '2099-01-01' });
  ok('a task with no rule creates nothing when it is completed', (await finish(plain.id)).next === null);

  const ruleDropped = await mkTask({ title: 'Ends here', dueDate: '2099-01-01', recurrence: 'weekly' });
  await call('PATCH', `/api/tasks/${ruleDropped.id}`, { recurrence: null });
  const stoppedDone = await finish(ruleDropped.id);
  ok('clearing the rule mid-series ends it: the instance stays, the next is never written',
    stoppedDone.next === null && stoppedDone.task.recurrence === null, JSON.stringify(stoppedDone.task));

  const shelved = await mkTask({ title: 'Shelved', dueDate: '2099-01-01', recurrence: 'weekly' });
  ok('archiving and completing in one move writes nothing — a rule spawning rows nobody sees is not a rule',
    (await finish(shelved.id, { archived: 1 })).next === null);

  const doomedSeries = await mkTask({ title: 'Deleted series', dueDate: '2099-01-01', recurrence: 'weekly' });
  await call('DELETE', `/api/tasks/${doomedSeries.id}`);
  ok('deleting the open instance ends the series, because the row IS the series',
    !(await allTasks()).some((t) => t.title === 'Deleted series'));

  ok('a rule with no due date is refused — there would be nothing to step from',
    (await call('POST', '/api/tasks', { title: 'Undated', recurrence: 'weekly' })).status === 400);
  ok('a rule this app does not have is refused rather than silently ignored',
    (await call('POST', '/api/tasks', { title: 'Daily', dueDate: '2099-01-01', recurrence: 'daily' })).status === 400);
  ok('and a due date cannot be cleared out from under a rule already set',
    (await call('PATCH', `/api/tasks/${heir.id}`, { dueDate: null })).status === 400);

  const bornDone = await mkTask({ title: 'Filed as already finished', status: 'done' });
  ok('a task filed as already done is stamped, so completion counts can see it at all',
    !!bornDone.doneAt, JSON.stringify(bornDone.doneAt));

  console.log('\nthe Friday client note');
  // A fixed week, and four completions placed at four positions on the clock —
  // midnight, morning, late evening, and late evening the day BEFORE the week.
  // Two of those four have a UTC date on the other side of the boundary from
  // their Toronto date, which is the whole point: they are the cases a
  // UTC-dated filter gets wrong, and they are asserted on every run at every
  // hour rather than waiting for the suite to happen to run in the evening.
  const DFROM = '2026-05-04';                 // Monday
  const DTO = '2026-05-10';                   // Sunday
  const dgUrl = (q) => `/api/digest?${q}`;

  const ws1 = (await call('POST', '/api/projects', {
    name: 'Ashcombe — Site & Listings', code: 'ASH-A', clientName: 'Ashcombe Pianos', budgetMinutes: 2400,
  })).body.project;
  const ws2 = (await call('POST', '/api/projects', {
    name: 'Ashcombe — Studio Content', code: 'ASH-B', clientName: 'Ashcombe Pianos',
  })).body.project;
  const ws3 = (await call('POST', '/api/projects', {
    name: 'Ashcombe — Nothing Happened', code: 'ASH-C', clientName: 'Ashcombe Pianos',
  })).body.project;
  const elsewhere = (await call('POST', '/api/projects', { name: 'Someone else entirely', code: 'ELSE' })).body.project;
  const ashcombeId = ws1.clientId;

  const E = async (projectId, date, minutes, note, billable = true) =>
    (await call('POST', '/api/entries', { projectId, date, minutes, note, billable })).body.entry;
  const inWeek = [
    await E(ws1.id, '2026-05-04', 95, 'Rebuilt the listings feed and resubmitted the sitemap'),
    await E(ws1.id, '2026-05-06', 50, 'Fixed the duplicate NAP across three aggregators'),
    await E(ws1.id, '2026-05-06', 40, '', false),        // logged with no note — coverage
    await E(ws2.id, '2026-05-07', 130, 'Second pass on the studio shoot brief'),
    await E(ws2.id, '2026-05-10', 25, 'Uploaded the retouched set', false),
  ];
  const outsiders = [
    await E(elsewhere.id, '2026-05-06', 200, 'nothing to do with this client'),
    await E(ws1.id, '2026-05-03', 60, 'the day before the week'),
    await E(ws1.id, '2026-05-11', 60, 'the day after the week'),
  ];

  /** A completed task placed at an exact instant — done_at is stamped, not sent. */
  const finishedAt = async (title, projectId, iso, estimateMinutes = 60) => {
    const t = (await call('POST', '/api/tasks', { title, projectId, estimateMinutes })).body.task;
    sql((w) => w("UPDATE tasks SET status = 'done', done_at = ? WHERE id = ?", iso, t.id));
    return t;
  };
  const atMidnight = await finishedAt('Claimed the duplicate listing', ws1.id, '2026-05-04T04:00:00Z');
  const atMorning = await finishedAt('Rewrote the opening hours', ws1.id, '2026-05-06T12:00:00Z');
  const atNight = await finishedAt('Delivered the retouched set', ws2.id, '2026-05-11T02:30:00Z');
  const nightBefore = await finishedAt('Signed off the shoot list', ws1.id, '2026-05-04T03:30:00Z');

  const dueNext = await mkTask({ title: 'Ship the photography brief', projectId: ws1.id, dueDate: '2026-05-14', estimateMinutes: 120 });
  const dueInside = await mkTask({ title: 'Confirm the delivery slot', projectId: ws2.id, dueDate: '2026-05-06', estimateMinutes: 30 });
  const dueBefore = await mkTask({ title: 'Chase the domain transfer', projectId: ws1.id, dueDate: '2026-04-20', estimateMinutes: 45 });
  const dueFar = await mkTask({ title: 'Quarterly review', projectId: ws1.id, dueDate: '2026-05-30', estimateMinutes: 90 });

  const dg = (await call('GET', dgUrl(`clientId=${ashcombeId}&from=${DFROM}&to=${DTO}`))).body;

  ok('the digest answers for the week it was asked for',
    dg.range.from === DFROM && dg.range.to === DTO && dg.range.days === 7 && dg.horizon === '2026-05-17',
    JSON.stringify(dg.range));
  ok('it totals only the hours inside that week, on that client\'s projects',
    dg.totals.minutes === 340 && dg.totals.billableMinutes === 275
    && dg.totals.entries === 5 && dg.totals.days === 4, JSON.stringify(dg.totals));
  const claimed = new Set(dg.provenance.find((p) => p.id === 'totals.minutes').entryIds);
  ok('another client\'s hours, and the days either side, are not in it',
    outsiders.every((e) => !claimed.has(e.id)) && inWeek.every((e) => claimed.has(e.id)),
    `${[...claimed].join()} vs outsiders ${outsiders.map((e) => e.id).join()}`);

  const wsById = new Map(dg.workstreams.map((w) => [w.projectId, w]));
  ok('each workstream carries its own hours', wsById.get(ws1.id).minutes === 185 && wsById.get(ws2.id).minutes === 155,
    JSON.stringify(dg.workstreams.map((w) => [w.name, w.minutes])));
  ok('the workstreams add up to the total, with nothing left over',
    dg.workstreams.reduce((n, w) => n + w.minutes, 0) === dg.totals.minutes);
  const wsIds = dg.workstreams.flatMap((w) => w.entryIds);
  ok('and no entry is counted in two of them',
    new Set(wsIds).size === wsIds.length && wsIds.length === dg.totals.entries);
  ok('a project of theirs with nothing in it is named as silent, not quietly dropped',
    dg.silentProjects.some((p) => p.projectId === ws3.id) && !wsById.has(ws3.id),
    JSON.stringify(dg.silentProjects));

  const doneIds = dg.completed.map((c) => c.taskId);
  ok('a task ticked off at 22:30 on the last evening belongs to that week, not to the next one',
    doneIds.includes(atNight.id), `completed: ${dg.completed.map((c) => c.title).join(' | ')}`);
  ok('and one ticked off at 23:30 the night BEFORE it belongs to the week before',
    !doneIds.includes(nightBefore.id));
  ok('the ordinary ones are there too, and nothing else is',
    doneIds.length === 3 && doneIds.includes(atMidnight.id) && doneIds.includes(atMorning.id)
    && dg.totals.tasksCompleted === 3, doneIds.join());
  ok('every completion states a date inside the week it is reported in',
    dg.completed.every((c) => c.doneDate >= DFROM && c.doneDate <= DTO),
    dg.completed.map((c) => `${c.title}:${c.doneDate}`).join(' | '));

  ok('the narrative is the notes people wrote, verbatim and in order',
    dg.narrative.length === 4
    && dg.narrative.map((n) => n.note).join('|') === inWeek.filter((e) => e.note).map((e) => e.note).join('|'),
    dg.narrative.map((n) => n.note).join(' | '));
  ok('the hours it does NOT speak for are stated rather than implied away',
    dg.coverage.notedMinutes === 300 && dg.coverage.unnotedMinutes === 40
    && dg.coverage.notedMinutes + dg.coverage.unnotedMinutes === dg.totals.minutes,
    JSON.stringify(dg.coverage));

  const bucket = (id) => dg.upcoming.find((u) => u.taskId === id)?.bucket;
  ok('what falls due next week, what is still open inside it, and what was late before it',
    bucket(dueNext.id) === 'next' && bucket(dueInside.id) === 'inWeek' && bucket(dueBefore.id) === 'before',
    JSON.stringify(dg.upcoming.map((u) => [u.title, u.bucket])));
  ok('only the one that predates the week is called overdue — Friday is not late on Tuesday',
    dg.upcoming.filter((u) => u.overdue).map((u) => u.taskId).join() === String(dueBefore.id)
    && dg.totals.overdue === 1 && dg.totals.dueNextWeek === 1 && dg.totals.openInWeek === 1,
    JSON.stringify(dg.totals));
  ok('and work beyond the horizon is left for the digest that will cover it',
    !dg.upcoming.some((u) => u.taskId === dueFar.id));

  // ---- the provenance sweep -------------------------------------------
  // Every claim, checked against rows fetched from a DIFFERENT endpoint than
  // the one that made it. This is the assertion the digest exists to pass: a
  // figure nobody can trace to a row is a figure somebody invented.
  const rangeRows = (await call('GET', `/api/entries?scope=team&from=${DFROM}&to=${DTO}`)).body.entries;
  const entryById = new Map(rangeRows.map((e) => [e.id, e]));
  const taskById = new Map((await allTasks()).map((t) => [t.id, t]));
  const unreconciled = [];
  const kinds = new Set();
  for (const p of dg.provenance) {
    kinds.add(p.kind);
    if (p.kind === 'minutes') {
      const rows = p.entryIds.map((id) => entryById.get(id));
      if (rows.some((r) => !r)) unreconciled.push(`${p.id}: names a row the range does not hold`);
      else if (rows.reduce((n, r) => n + r.minutes, 0) !== p.value) {
        unreconciled.push(`${p.id}: rows sum ${rows.reduce((n, r) => n + r.minutes, 0)}, claim says ${p.value}`);
      }
    } else if (p.kind === 'tasks') {
      if (p.taskIds.length !== p.value) unreconciled.push(`${p.id}: ${p.taskIds.length} ids for a claim of ${p.value}`);
      if (p.taskIds.some((id) => !taskById.has(id))) unreconciled.push(`${p.id}: names a task that is not there`);
    } else if (p.kind === 'task-date') {
      const t = taskById.get(p.taskIds[0]);
      const actual = p.field === 'doneAt' ? localDay(Date.parse(t.doneAt)) : t.dueDate;
      if (actual !== p.value) unreconciled.push(`${p.id}: row says ${actual}, claim says ${p.value}`);
    } else if (p.kind === 'text') {
      if (entryById.get(p.entryIds[0])?.note !== p.value) unreconciled.push(`${p.id}: the note does not match the row`);
    } else unreconciled.push(`${p.id}: no rule knows how to check a "${p.kind}" claim`);
  }
  ok('every claim in the digest reconciles against the rows it names',
    unreconciled.length === 0, unreconciled.join('; '));
  ok('and there were claims of every kind to check, so that sweep cannot pass on an empty list',
    dg.provenance.length >= 20 && kinds.size === 4, `${dg.provenance.length} claims, kinds ${[...kinds].join()}`);
  const stated = new Set(dg.provenance.map((p) => p.id));
  ok('every figure the digest leads with is one of those claims',
    ['totals.minutes', 'totals.billableMinutes', 'totals.tasksCompleted', 'totals.dueNextWeek',
      'totals.overdue', 'narrative.minutes'].every((id) => stated.has(id))
    && dg.workstreams.every((w) => stated.has(`workstream.${w.projectId}.minutes`)),
    [...stated].join(' '));

  // ---- the same boundary, on the KPI beside it -------------------------
  // Reports counts completions from the same column. Measured as a delta, so
  // whatever else the suite has finished today cannot move it.
  const doneInWeek = async (from, to) =>
    (await call('GET', `/api/report?scope=team&from=${from}&to=${to}`)).body.tasks.done;
  const week1Before = await doneInWeek(DFROM, DTO);
  const week2Before = await doneInWeek('2026-05-11', '2026-05-17');
  const lateOne = await finishedAt('Sent the Sunday recap', ws1.id, '2026-05-11T02:45:00Z');
  ok('the Reports KPI files that 22:30 completion into the same week the digest does',
    (await doneInWeek(DFROM, DTO)) === week1Before + 1
    && (await doneInWeek('2026-05-11', '2026-05-17')) === week2Before,
    `week1 ${week1Before} → ${await doneInWeek(DFROM, DTO)}, week2 ${week2Before} → ${await doneInWeek('2026-05-11', '2026-05-17')}`);
  sql((w) => w('DELETE FROM tasks WHERE id = ?', lateOne.id));

  // ---- the same fixtures, read in a zone fourteen hours ahead ----------
  // Not a second opinion about the boundary: the mirror image of it. In +14
  // both of those completions cross the other way, and a digest that read UTC
  // — or this machine — would give the same answer twice.
  const ahead = bootServer({ PORT: String(PORT_5), APP_TIMEZONE: 'Pacific/Kiritimati' });
  await ready(ahead, 'the +14 boot');
  const ajar = {};
  await callOn(BASE_5, 'POST', '/api/auth/login', { email: 'smoke@dgtlgroup.io', password: PASSWORD }, ajar);
  const dgAhead = (await callOn(BASE_5, 'GET', dgUrl(`clientId=${ashcombeId}&from=${DFROM}&to=${DTO}`), null, ajar)).body;
  const aheadIds = dgAhead.completed.map((c) => c.taskId);
  ok('fourteen hours east, the 22:30 completion has moved into the following week',
    !aheadIds.includes(atNight.id), dgAhead.completed.map((c) => `${c.title}:${c.doneDate}`).join(' | '));
  ok('and the one from the night before has moved into this one',
    aheadIds.includes(nightBefore.id), aheadIds.join());
  ok('the hours are unmoved, because an entry files under a date it was given',
    dgAhead.totals.minutes === dg.totals.minutes && dgAhead.totals.entries === dg.totals.entries);
  ok('and the digest still reconciles in that zone',
    dgAhead.provenance.filter((p) => p.kind === 'minutes')
      .every((p) => p.entryIds.reduce((n, id) => n + (entryById.get(id)?.minutes ?? NaN), 0) === p.value),
    'a claim in +14 does not match its rows');
  await stop(ahead.proc);

  // ---- the shape of the thing ------------------------------------------
  const dflt = (await call('GET', dgUrl(`clientId=${ashcombeId}`))).body;
  ok('with no range it covers the caller\'s current week — seven days, today inside them',
    dflt.range.days === 7 && dflt.range.from <= serverToday && dflt.range.to >= serverToday,
    JSON.stringify(dflt.range));
  ok('a digest cannot be asked to list a decade of notes in one response',
    (await call('GET', dgUrl(`clientId=${ashcombeId}&from=1970-01-01&to=${DTO}`))).status === 400);
  ok('an inverted range is refused here too',
    (await call('GET', dgUrl(`clientId=${ashcombeId}&from=${DTO}&to=${DFROM}`))).status === 400);
  ok('a client that does not exist is a 404, not an empty digest that reads as a quiet week',
    (await call('GET', dgUrl('clientId=99999'))).status === 404);
  ok('and no client at all is refused', (await call('GET', '/api/digest')).status === 400);
  const clientList = (await call('GET', '/api/clients')).body.clients;
  ok('the client list carries the client its projects were filed under',
    clientList.some((c) => c.id === ashcombeId && c.name === 'Ashcombe Pianos' && c.projects === 3),
    JSON.stringify(clientList));

  console.log('\nusers + permissions');
  const member = await call('POST', '/api/users', {
    email: 'member@dgtlgroup.io', name: 'Member', role: 'member', password: 'member-password-1',
  });
  ok('admin can create a member', member.status === 200 && member.body.user.role === 'member');
  ok('short password is rejected',
    (await call('POST', '/api/users', { email: 'x@y.co', name: 'X', password: 'short' })).status === 400);
  ok('duplicate email is rejected',
    (await call('POST', '/api/users', { email: 'member@dgtlgroup.io', name: 'X', password: 'another-password' })).status === 400);
  ok('last admin cannot be demoted',
    (await call('PATCH', '/api/users/1', { role: 'member' })).status === 400);

  const adminCookie = cookie;
  cookie = '';
  await call('POST', '/api/auth/login', { email: 'member@dgtlgroup.io', password: 'member-password-1' });
  ok('member is refused the user list', (await call('GET', '/api/users')).status === 403);
  ok('member cannot create a project', (await call('POST', '/api/projects', { name: 'Nope' })).status === 403);
  ok('member cannot edit someone else\'s time',
    (await call('PATCH', `/api/entries/${entry.body.entry.id}`, { minutes: 5 })).status === 403);
  ok('member can log their own time',
    (await call('POST', '/api/entries', { projectId, minutes: 30 })).status === 200);
  ok('member can read team reports', (await call('GET', '/api/report?scope=team')).status === 200);

  console.log('\nexport');
  // Three faults in one route. The scope was pasted into the SQL rather than
  // bound — the only interpolation left in server/ — the rows came out of a
  // bare SELECT with none of ENTRY_SELECT's joins, so every exported entry
  // named nothing, and nothing asserted any of it.
  const memberId = member.body.user.id;
  const mineExport = await call('GET', '/api/export');
  ok('a member\'s export carries their own rows and only theirs',
    mineExport.status === 200 && mineExport.body.scope === 'own'
    && mineExport.body.entries.length > 0
    && mineExport.body.entries.every((e) => e.userId === memberId),
    `${mineExport.body.entries.length} rows from ${[...new Set(mineExport.body.entries.map((e) => e.userId))].join()}`);
  ok('and it does not hand them the roster',
    mineExport.body.users === undefined, JSON.stringify(mineExport.body.users));

  cookie = adminCookie;
  const allExport = (await call('GET', '/api/export')).body;
  const owners = new Set(allExport.entries.map((e) => e.userId));
  ok('an admin\'s carries the whole workspace, people included',
    allExport.scope === 'all' && Array.isArray(allExport.users) && allExport.users.length >= 2
    && owners.size > 1 && allExport.entries.length > mineExport.body.entries.length,
    `${allExport.entries.length} rows from ${owners.size} people, ${allExport.users?.length} users`);
  ok('and the member\'s export is exactly their slice of it — the scope is the only difference',
    allExport.entries.filter((e) => e.userId === memberId).map((e) => e.id).join()
    === mineExport.body.entries.map((e) => e.id).join());

  // The four nulls. Verified across every row rather than the first one: the
  // joins were missing for all of them, so a spot check would have passed on a
  // route that happened to have one project.
  const onProjects = allExport.entries.filter((e) => e.projectId !== null);
  ok('an exported entry names the project it was worked on, not just its id',
    onProjects.length > 0 && onProjects.every((e) => e.projectName !== null && e.projectColor !== null),
    `${onProjects.filter((e) => e.projectName === null).length} of ${onProjects.length} rows name nothing`);
  ok('and the person who logged it',
    allExport.entries.length > 0 && allExport.entries.every((e) => e.userName !== null),
    `${allExport.entries.filter((e) => e.userName === null).length} rows with no name on them`);
  const onTasks = allExport.entries.filter((e) => e.taskId !== null);
  ok('and, where there is one, the task title',
    onTasks.length > 0 && onTasks.every((e) => e.taskTitle !== null),
    `${onTasks.length} rows carry a task id`);
  // What the interpolation was: an id pasted into SQL. Bound, a member id that
  // is not a plain number cannot reach the query at all — the session carries
  // it, so this asserts the shape the route now depends on.
  ok('every exported row carries a real numeric owner, which is what the bound scope matches on',
    allExport.entries.every((e) => Number.isInteger(e.userId)));

  console.log('\nhardening');
  cookie = adminCookie;
  const crossOrigin = await fetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie, origin: 'https://evil.example' },
    body: JSON.stringify({ name: 'CSRF' }),
  });
  ok('cross-origin write is refused', crossOrigin.status === 403);
  const traversal = await fetch(`${BASE}/../server/config.mjs`);
  ok('path traversal is refused', traversal.status === 404, `status ${traversal.status}`);
  ok('unknown endpoint 404s', (await call('GET', '/api/nope')).status === 404);
  ok('wrong verb reports 405', (await call('GET', '/api/auth/login')).status === 405);
  ok('logout clears the session', (await call('POST', '/api/auth/logout')).status === 200);
  ok('bootstrap is refused after logout', (await call('GET', '/api/bootstrap')).status === 401);

  console.log('\nwhich database a script opens');
  // config.mjs resolves DB_PATH out of .env before a script prints a word, so
  // `npm run seed` run in the app directory on the host opened production and
  // said nothing about it. The path is printed now, and the two scripts that
  // INSERT stop when the workspace they found is one somebody is using. Every
  // run below points at a database of its own inside TMP — which is also why
  // the leftovers audit is part of this assertion and not separate from it.
  const SCRIPT_DB = path.join(TMP, 'scripts.sqlite');
  // Blanked, not set: seed falls back to its own admin@dgtlgroup.io and its own
  // generated password, which is what a fresh checkout actually does.
  const scriptEnv = { DB_PATH: SCRIPT_DB, SEED_ADMIN_EMAIL: '', SEED_ADMIN_PASSWORD: '' };

  const fresh = await runScript('seed.mjs', [], scriptEnv);
  ok('a fresh checkout still seeds with no arguments and no ceremony',
    fresh.code === 0 && /created admin admin@dgtlgroup\.io/.test(fresh.out)
    && /generated password/.test(fresh.out), `exit ${fresh.code}: ${fresh.out.slice(-240)}`);
  ok('and it names the database it opened, first line, before it writes',
    fresh.out.split('\n').find((l) => l.startsWith('Database')) === `Database  ${SCRIPT_DB}`,
    fresh.out.split('\n')[0]);

  const again = await runScript('seed.mjs', [], scriptEnv);
  ok('seeding a workspace that already holds people and hours is refused',
    again.code === 1 && /Refusing to run seed/.test(again.out), `exit ${again.code}: ${again.out.slice(-240)}`);
  ok('and the refusal states what it found there, not merely that it refused',
    /1 account/.test(again.out) && /logged time entries/.test(again.out), again.out.slice(-240));
  ok('the path is named on the refusal too — that is the fact that was missing',
    again.out.includes(`Database  ${SCRIPT_DB}`));

  const forced = await runScript('seed.mjs', ['--force'], scriptEnv);
  ok('--force is the deliberate way past it, and says it was used',
    forced.code === 0 && /--force was given/.test(forced.out), `exit ${forced.code}: ${forced.out.slice(-240)}`);
  ok('WORKLOG_FORCE=1 does the same where there is no argv to reach',
    (await runScript('seed.mjs', [], { ...scriptEnv, WORKLOG_FORCE: '1' })).code === 0);

  const demoOk = await runScript('demo.mjs', [], scriptEnv);
  ok('demo still runs straight after a seed, so the documented workflow is untouched',
    demoOk.code === 0 && /Demo team ready/.test(demoOk.out), `exit ${demoOk.code}: ${demoOk.out.slice(-300)}`);

  // What demo must never meet: somebody else's workspace. Two independent
  // marks of one — a person off the roster, and a stretch the timer wrote.
  // The second is the one that matters, because a real workspace seeded with
  // the default admin email has nobody off the roster to find.
  const sdb = new DatabaseSync(SCRIPT_DB);
  sdb.prepare(`INSERT INTO users (email, name, role, password_hash, daily_target_minutes, week_start, active, created_at, updated_at)
               VALUES ('michael@ashcombe.example', 'Michael', 'member', 'x', 480, 1, 1, ?, ?)`)
    .run('2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  sdb.close();
  const demoNo = await runScript('demo.mjs', [], scriptEnv);
  ok('demo refuses a workspace with somebody else in it',
    demoNo.code === 1 && /not on the demo roster/.test(demoNo.out), `exit ${demoNo.code}: ${demoNo.out.slice(-300)}`);
  ok('and names who, so an operator can tell their own team from a fixture',
    /michael@ashcombe\.example/.test(demoNo.out), demoNo.out.slice(-300));
  ok('--force gets past that one too', (await runScript('demo.mjs', ['--force'], scriptEnv)).code === 0);

  // The hole the roster test alone leaves: one account, and it is the default
  // admin email. Nothing about the ROSTER can see that, so the timer can.
  const solo = path.join(TMP, 'solo.sqlite');
  const soloEnv = { DB_PATH: solo, SEED_ADMIN_EMAIL: '', SEED_ADMIN_PASSWORD: '' };
  ok('a second fresh database seeds cleanly too', (await runScript('seed.mjs', [], soloEnv)).code === 0);
  const soloDb = new DatabaseSync(solo);
  soloDb.prepare(`INSERT INTO time_entries (user_id, project_id, task_id, date, minutes, note, billable, started_at, ended_at, source, created_at, updated_at)
                  VALUES (1, 1, NULL, '2026-05-04', 60, 'real work', 1, ?, ?, 'timer', ?, ?)`)
    .run('2026-05-04T13:00:00Z', '2026-05-04T14:00:00Z', '2026-05-04T14:00:00Z', '2026-05-04T14:00:00Z');
  soloDb.close();
  const soloDemo = await runScript('demo.mjs', [], soloEnv);
  ok('a workspace whose only account IS the demo admin is still refused once the clock has been run in it',
    soloDemo.code === 1 && /timer/.test(soloDemo.out), `exit ${soloDemo.code}: ${soloDemo.out.slice(-300)}`);

  // The user tool is the one script that must still work on a live workspace —
  // it is how a real team gets back in. So it announces and does not refuse.
  const list = await runScript('user.mjs', ['list'], scriptEnv);
  ok('the user tool names its database and then does its job, gate or no gate',
    list.code === 0 && list.out.includes(`Database  ${SCRIPT_DB}`)
    && /admin@dgtlgroup\.io/.test(list.out), `exit ${list.code}: ${list.out.slice(0, 240)}`);

  console.log('\nfirst-boot admin');
  // The first-boot admin must never touch a workspace that already has users —
  // otherwise a stale env var on a host could mint an account at any restart.
  // Boot a second server against the same database with the pair set, so what
  // gets exercised is the real boot path. Importing auth.mjs into this process
  // instead would resolve config.mjs's own DB_PATH and create a database in the
  // app directory — on a host whose .env sets DB_PATH, the live one.
  const intruder = { email: 'intruder@example.com', password: 'a-long-enough-password' };
  const relogin = await call('POST', '/api/auth/login', { email: 'smoke@dgtlgroup.io', password: PASSWORD });
  ok('the admin signs back in to audit the roster', relogin.status === 200, `status ${relogin.status}`);
  const before2 = (await call('GET', '/api/users')).body.users.map((u) => u.email).sort();

  const second = bootServer({
    PORT: String(PORT_2),
    BOOTSTRAP_ADMIN_EMAIL: intruder.email,
    BOOTSTRAP_ADMIN_PASSWORD: intruder.password,
  });
  await ready(second, 'the second boot');
  ok('the stale credentials cannot sign in on it',
    (await callOn(BASE_2, 'POST', '/api/auth/login', intruder)).status === 401);
  ok('nor on the first server, which shares the database',
    (await call('POST', '/api/auth/login', intruder)).status === 401);

  // The roster itself, before and after — state, not a line of log prose that
  // could be reworded (or go missing on a crash) while the account is created.
  const after2 = (await call('GET', '/api/users')).body.users.map((u) => u.email).sort();
  ok('that boot left the roster exactly as it found it',
    after2.join() === before2.join(), `${before2.join()} → ${after2.join()}`);
  ok('and the workspace holds no such account', !after2.includes(intruder.email), after2.join());
  await stop(second.proc);
} catch (err) {
  failures.push(`harness error: ${err.message}`);
  console.error(err);
  if (server.log()) console.error('--- server log ---\n' + server.log());
} finally {
  await cleanup();
}

// --- leftovers ---------------------------------------------------------
// Runs after cleanup, on the pass and the fail path alike: the suite is only
// finished if every database outside its temp dir is as it found it.
console.log('\nleftovers');
ok('no database outside the temp dir was created or written', touched.length === 0,
  touched.map((p) => `${p}: ${guardedBefore[guarded.indexOf(p)]} → ${fingerprint(p)}`).join('; '));
ok('no new database appeared under the app', strays.length === 0, strays.join(', '));
ok('the throwaway database is gone', !fs.existsSync(TMP));

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  ✗ ${f}`).join('\n'));
  process.exit(1);
}
