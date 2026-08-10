/**
 * DGTL Worklog — API smoke test.  `npm test`
 *
 * Boots the real server against a throwaway database on a spare port, then
 * drives it over HTTP exactly as the browser does. No dependencies, no mocks.
 */

import { spawn } from 'node:child_process';
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

// Every database this suite touches belongs in TMP. One written into the app
// instead is invisible to `git status` — data/ is gitignored — so the only way
// to see it is to compare the tree before and after.
const sqliteBefore = new Set(sqliteFiles(APP_DIR));

// The children are handed DB_PATH through `env`; this process needs it too.
// Nothing here imports a server module today, but config.mjs falls back to
// data/worklog.sqlite — and on a host whose .env sets DB_PATH, to the live
// database — so any future import must land on the throwaway one instead.
process.env.DB_PATH = DB_PATH;

let passed = 0;
const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
};

const sh = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { cwd: APP_DIR, env, stdio: 'pipe' });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(out))));
});

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

const servers = [];
/** Boot the real server against the throwaway database; returns a log reader. */
function bootServer(extra = {}) {
  const proc = spawn('node', ['--no-warnings=ExperimentalWarning', 'server/server.mjs'], {
    cwd: APP_DIR, env: { ...env, ...extra }, stdio: 'pipe',
  });
  let out = '';
  proc.stdout.on('data', (d) => { out += d; });
  proc.stderr.on('data', (d) => { out += d; });
  servers.push(proc);
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

const server = bootServer();

const strays = [];                        // databases that appeared outside TMP
const cleanup = () => {
  for (const proc of servers) proc.kill('SIGTERM');
  fs.rmSync(TMP, { recursive: true, force: true });
  // Runs on the failure path too, so the tree is audited however the run ended.
  for (const rel of sqliteFiles(APP_DIR)) if (!sqliteBefore.has(rel)) strays.push(rel);
};

try {
  await sh('node', ['--no-warnings=ExperimentalWarning', 'scripts/seed.mjs']);

  // Wait for the port rather than sleeping a fixed amount.
  for (let i = 0; i < 60; i++) {
    try { await fetch(`${BASE}/api/timer`); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }

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
  ok('the project-level billable flag does not inflate it', mixRow.loggedMinutes === 240, String(mixRow.loggedMinutes));
  const mixRep = await call('GET', `/api/report?scope=team&from=${mixBoot.body.today}&to=${mixBoot.body.today}`);
  const mixProj = mixRep.body.byProject.find((p) => p.projectId === mix);
  ok('Projects and Reports agree on billable minutes',
    mixProj.billableMinutes === mixRow.billableMinutes, `${mixProj?.billableMinutes} vs ${mixRow.billableMinutes}`);

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
  ok('and the refusal carries the entry count',
    blocked.body.details?.timeEntries > 0, JSON.stringify(blocked.body));
  ok('zero minutes is rejected', (await call('POST', '/api/entries', { projectId, minutes: 0 })).status === 400);
  ok('26 hours is rejected', (await call('POST', '/api/entries', { projectId, minutes: 1560 })).status === 400);
  ok('bad date is rejected',
    (await call('POST', '/api/entries', { projectId, minutes: 30, date: '2026-02-31' })).status === 400);
  const edited = await call('PATCH', `/api/entries/${entry.body.entry.id}`, { minutes: 45 });
  ok('entry can be edited', edited.body.entry.minutes === 45);

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
  const second = bootServer({
    PORT: String(PORT_2),
    BOOTSTRAP_ADMIN_EMAIL: intruder.email,
    BOOTSTRAP_ADMIN_PASSWORD: intruder.password,
  });
  ok('a second boot with BOOTSTRAP_ADMIN_* set comes up',
    await waitForLog(second.log, /Users\s+\d+/), second.log());
  ok('it announces no first admin', !/Created the first admin/.test(second.log()), second.log().trim());
  ok('the stale credentials cannot sign in on it',
    (await callOn(BASE_2, 'POST', '/api/auth/login', intruder)).status === 401);
  ok('nor on the first server, which shares the database',
    (await call('POST', '/api/auth/login', intruder)).status === 401);

  const relogin = await call('POST', '/api/auth/login', { email: 'smoke@dgtlgroup.io', password: PASSWORD });
  ok('the admin signs back in to audit the roster', relogin.status === 200, `status ${relogin.status}`);
  const roster = (await call('GET', '/api/users')).body.users.map((u) => u.email);
  ok('the workspace holds no such account', !roster.includes(intruder.email), roster.join());
  // If that boot had opened a database of its own, it would have found it empty
  // and reported a different count — which is the whole hazard, in one number.
  ok('the second boot opened the same database',
    Number(second.log().match(/Users\s+(\d+)/)?.[1]) === roster.length,
    `${second.log().match(/Users\s+(\d+)/)?.[1]} vs ${roster.length}`);
  second.proc.kill('SIGTERM');
} catch (err) {
  failures.push(`harness error: ${err.message}`);
  console.error(err);
  if (server.log()) console.error('--- server log ---\n' + server.log());
} finally {
  cleanup();
}

// --- leftovers ---------------------------------------------------------
// Runs after cleanup, on the pass and the fail path alike: the suite is only
// finished if the working tree is exactly as it found it.
console.log('\nleftovers');
ok('no database was written outside the temp dir', strays.length === 0, strays.join(', '));
ok('the throwaway database is gone', !fs.existsSync(TMP));

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  ✗ ${f}`).join('\n'));
  process.exit(1);
}
