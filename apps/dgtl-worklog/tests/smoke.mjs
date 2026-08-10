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
const PASSWORD = 'smoke-test-password';

const env = {
  ...process.env,
  DB_PATH, PORT: String(PORT), HOST: '127.0.0.1',
  APP_TIMEZONE: 'America/Toronto', SECURE_COOKIES: '0',
  SEED_ADMIN_EMAIL: 'smoke@dgtlgroup.io', SEED_ADMIN_PASSWORD: PASSWORD,
};

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

const server = spawn('node', ['--no-warnings=ExperimentalWarning', 'server/server.mjs'], {
  cwd: APP_DIR, env, stdio: 'pipe',
});
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });

const cleanup = () => {
  server.kill('SIGTERM');
  fs.rmSync(TMP, { recursive: true, force: true });
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

  // The first-boot admin must never touch a workspace that already has users —
  // otherwise a stale env var on a host could mint an account at any restart.
  const { bootstrapAdmin } = await import('../server/auth.mjs');
  process.env.BOOTSTRAP_ADMIN_EMAIL = 'intruder@example.com';
  process.env.BOOTSTRAP_ADMIN_PASSWORD = 'a-long-enough-password';
  ok('first-boot admin is a no-op once users exist', bootstrapAdmin() === null);
  ok('no account was created by it',
    (await call('POST', '/api/auth/login', { email: 'intruder@example.com', password: 'a-long-enough-password' })).status === 401);
} catch (err) {
  failures.push(`harness error: ${err.message}`);
  console.error(err);
  if (serverLog) console.error('--- server log ---\n' + serverLog);
} finally {
  cleanup();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  ✗ ${f}`).join('\n'));
  process.exit(1);
}
