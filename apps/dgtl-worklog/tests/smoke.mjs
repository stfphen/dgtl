/**
 * DGTL Worklog — API smoke test.  `npm test`
 *
 * Boots the real server against a throwaway database on a spare port, then
 * drives it over HTTP exactly as the browser does. No dependencies, no mocks.
 */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'worklog-test-'));
const DB_PATH = path.join(TMP, 'test.sqlite');
const PORT = 8199 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
// Clear of the range PORT is drawn from, so the second boot never collides.
const PORT_2 = PORT + 400;
const BASE_2 = `http://127.0.0.1:${PORT_2}`;
const PASSWORD = 'smoke-test-password';

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

/** Like call(), but against another server and without touching the cookie jar. */
async function callOn(base, method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), origin: base },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
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
