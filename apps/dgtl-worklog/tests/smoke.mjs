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
  ok('bootstrap carries the open shift on a cold start',
    sBoot.shift?.id === cin.body.shift.id && sBoot.shift.open === true, JSON.stringify(sBoot.shift));
  ok('an open shift starts with nothing attributed and the whole of it in the gap',
    sBoot.shift.attributedMinutes === 0 && sBoot.shift.unattributedMinutes === sBoot.shift.presentMinutes);

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
  const midRun = (await call('GET', '/api/bootstrap')).body.shift;
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
  const mn = (await call('GET', '/api/bootstrap')).body.shift;
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
  const spring = (await call('GET', '/api/bootstrap')).body.shift;
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
  const fall = (await call('GET', '/api/bootstrap')).body.shift;
  ok('the hour that happens twice is counted twice',
    fall.presentMinutes === 180, `${fall.presentMinutes} — the wall clock says 120`);
  ok('attribution across the fall-back step reconciles',
    fall.attributedMinutes === 60 && fall.unattributedMinutes === 120
    && fall.unattributedMinutes === fall.presentMinutes - fall.attributedMinutes,
    JSON.stringify(fall));

  console.log('\nwhat moves the gap');
  const fallEntry = (await call('GET', '/api/entries?from=2026-11-01&to=2026-11-01')).body.entries[0];
  await call('PATCH', `/api/entries/${fallEntry.id}`, { minutes: 10 });
  const trimmed = (await call('GET', '/api/bootstrap')).body.shift;
  ok('correcting an entry after clock-out moves the gap on the next read',
    trimmed.attributedMinutes === 10 && trimmed.unattributedMinutes === 170, JSON.stringify(trimmed));

  await call('PATCH', `/api/entries/${fallEntry.id}`, { minutes: 600 });
  const inflated = (await call('GET', '/api/bootstrap')).body.shift;
  ok('an entry cannot account for more presence than the span it covers',
    inflated.attributedMinutes === 60 && inflated.unattributedMinutes === 120, JSON.stringify(inflated));

  await call('DELETE', `/api/entries/${fallEntry.id}`);
  const emptied = (await call('GET', '/api/bootstrap')).body.shift;
  ok('deleting it hands the whole shift back as unattributed',
    emptied.presentMinutes === 180 && emptied.attributedMinutes === 0 && emptied.unattributedMinutes === 180,
    JSON.stringify(emptied));

  await call('POST', '/api/entries', { projectId: P1, minutes: 45, date: '2026-11-01', note: 'By hand' });
  const byHand = (await call('GET', '/api/bootstrap')).body.shift;
  ok('a block logged by hand is reported apart, never counted as attributed',
    byHand.unplacedMinutes === 45 && byHand.attributedMinutes === 0, JSON.stringify(byHand));
  ok('and it does not close a gap it cannot be placed inside', byHand.unattributedMinutes === 180);

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
  const overlapped = (await call('GET', '/api/bootstrap')).body.shift;
  ok('overlapping stretches clamp to the presence instead of going negative',
    overlapped.attributedMinutes === 180 && overlapped.unattributedMinutes === 0, JSON.stringify(overlapped));
  ok('presence is never less than what is attributed to it, even then',
    overlapped.presentMinutes >= overlapped.attributedMinutes);

  console.log('\na fresh process mid-shift');
  await call('POST', '/api/shift/in');
  const midTimer = await call('POST', '/api/timer/start', { projectId: P1, note: 'Still going' });
  const midShift = (await call('GET', '/api/bootstrap')).body.shift;

  // A restart is a process reading back state it did not create. This one opens
  // the same database with nothing of ours in its memory.
  const third = bootServer({ PORT: String(PORT_3) });
  await ready(third, 'the mid-shift boot');
  const jar = {};
  await callOn(BASE_3, 'POST', '/api/auth/login',
    { email: 'shift@dgtlgroup.io', password: 'shift-password-1' }, jar);
  const reread = (await callOn(BASE_3, 'GET', '/api/bootstrap', null, jar)).body;
  ok('a process that did not open the shift still finds it open',
    reread.shift?.open === true && reread.shift.startedAt === midShift.startedAt, JSON.stringify(reread.shift));
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
  ok('report computes a streak', typeof report.body.streak.current === 'number');
  ok('report breaks down by project', report.body.byProject.length > 0);
  ok('inverted date range is rejected',
    (await call('GET', '/api/report?from=2026-05-01&to=2026-01-01')).status === 400);

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
