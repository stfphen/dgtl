/**
 * DGTL Worklog — demo team.
 *
 *   npm run demo            (after `npm run seed`)
 *   npm run demo -- --force  into a workspace that is already being worked in
 *
 * Creates (or resets) a fixed roster of three accounts that all share ONE
 * easy-to-type password, and back-fills each with plausible hours and tasks so
 * every screen has something real in it — including the team-scoped Timesheet
 * and the "By person" report, which look empty with a single user.
 *
 * These credentials are written down in the repo. That is the point for a demo
 * and a liability anywhere else, so this refuses to run against a production
 * environment and prints a removal reminder every time.
 */

import { all, one, run, tx } from '../server/db.mjs';
import { addDays, guardWorkspace, localDate, nowISO } from '../server/config.mjs';
import { hashPassword } from '../server/auth.mjs';

const PASSWORD = 'dgtl-demo-2026';

const ROSTER = [
  { email: 'admin@dgtlgroup.io',  name: 'DGTL Admin',   role: 'admin',  target: 480, seed: 7 },
  { email: 'sam@dgtlgroup.io',    name: 'Sam Delaney',  role: 'member', target: 450, seed: 23 },
  { email: 'jordan@dgtlgroup.io', name: 'Jordan Pike',  role: 'member', target: 360, seed: 61 },
];

// Tasks handed to the two members so the board is not all one person's.
const TASKS = [
  ['sam@dgtlgroup.io',    'Cut the Q3 sizzle reel',                'DLVR', 'doing', 'high',   480,  1],
  ['sam@dgtlgroup.io',    'Client feedback round on the microsite', 'DLVR', 'todo',  'normal', 180,  4],
  ['sam@dgtlgroup.io',    'Photo selects for the launch carousel',  'JRNL', 'todo',  'low',    120,  9],
  ['sam@dgtlgroup.io',    'Ship the campaign landing page',         'PTCH', 'done',  'normal', 300, -3],
  ['jordan@dgtlgroup.io', 'Outreach list for September',            'PTCH', 'doing', 'normal', 240,  2],
  ['jordan@dgtlgroup.io', 'Reconcile last month invoices',          'ADMN', 'todo',  'high',    90,  0],
  ['jordan@dgtlgroup.io', 'Tidy the asset library',                 'ADMN', 'todo',  'low',    150, 12],
];

// Labels per project, so the Quick log "Pick up again" chips have something
// real to suggest — an unlabelled workspace makes that screen look broken.
const NOTES = {
  PLAT: ['Tenant config review', 'Admin shell fixes', 'Lead pipeline QA', 'Funding engine spike'],
  JRNL: ['Creator pack edits', 'Photo selects', 'Copy pass', 'Link check + sitemap'],
  DLVR: ['Client call', 'Revisions round 2', 'Asset handoff', 'Build + deploy'],
  PTCH: ['Offer page draft', 'Prospect research', 'Deck polish'],
  ADMN: ['Standup + planning', 'Invoicing', 'Inbox'],
};

if (process.env.NODE_ENV === 'production') {
  console.error('✗ Refusing to seed demo accounts with NODE_ENV=production.');
  console.error('  These credentials are published in the repo — never put them on a real workspace.');
  process.exit(1);
}

if (!all('SELECT id FROM projects LIMIT 1').length) {
  console.error('✗ No projects yet. Run `npm run seed` first, then `npm run demo`.');
  process.exit(1);
}

/* Which database, and is it one to write three weeks of invented hours into?
   "Already populated" cannot be the test here the way it is for seed — demo
   REQUIRES a seeded workspace, so a gate that fired on the documented
   `seed && demo` would fire every single time, and a gate that always fires is
   one people alias away. What it must never meet is a workspace somebody is
   actually working in, which shows in three places seed never writes:
   accounts that are not on this roster, the hours those people logged, and any
   sign the clock or the attendance strip has been used at all. A workspace
   holding only what `npm run seed` made has nothing real in it to lose. */
const roster = ROSTER.map((p) => p.email);
const marks = `(${roster.map(() => '?').join(',')})`;
const outsiders = all(`SELECT name, email FROM users WHERE lower(email) NOT IN ${marks}`, ...roster);
const theirHours = one(`
  SELECT COUNT(*) AS n FROM time_entries e JOIN users u ON u.id = e.user_id
   WHERE lower(u.email) NOT IN ${marks}`, ...roster).n;
const timed = one("SELECT COUNT(*) AS n FROM time_entries WHERE source <> 'manual'").n;
const spells = one('SELECT COUNT(*) AS n FROM shifts').n;

guardWorkspace('demo', [
  outsiders.length ? `${outsiders.length} ${outsiders.length === 1 ? 'account is' : 'accounts are'} `
    + `not on the demo roster (${outsiders.slice(0, 3).map((u) => u.email).join(', ')}`
    + `${outsiders.length > 3 ? ', …' : ''})` : null,
  theirHours ? `${theirHours} time entries belong to those people` : null,
  timed ? `${timed} ${timed === 1 ? 'stretch was' : 'stretches were'} put there by the timer, `
    + 'so somebody has really worked in this one' : null,
  spells ? `${spells} ${spells === 1 ? 'spell' : 'spells'} of attendance ${spells === 1 ? 'is' : 'are'} `
    + 'recorded in it' : null,
].filter(Boolean), {
  force: process.argv.includes('--force') || process.env.WORKLOG_FORCE === '1',
});

const now = nowISO();
const today = localDate();
const projects = all("SELECT id, code, billable FROM projects WHERE status = 'active'");
const notesFor = (code) => NOTES[code] || ['Project work'];
const byCode = Object.fromEntries(projects.map((p) => [p.code, p.id]));

for (const person of ROSTER) {
  const existing = one('SELECT * FROM users WHERE lower(email) = ?', person.email);

  if (existing) {
    run(`UPDATE users SET name = ?, role = ?, active = 1, password_hash = ?,
           daily_target_minutes = ?, updated_at = ? WHERE id = ?`,
      person.name, person.role, hashPassword(PASSWORD), person.target, now, existing.id);
    // The old password is gone, so its sessions must go too.
    run('DELETE FROM sessions WHERE user_id = ?', existing.id);
    person.id = existing.id;
    console.log(`• reset  ${person.email.padEnd(24)} ${person.role}`);
  } else {
    const res = run(`
      INSERT INTO users (email, name, role, password_hash, daily_target_minutes, week_start, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)`,
      person.email, person.name, person.role, hashPassword(PASSWORD), person.target, now, now);
    person.id = Number(res.lastInsertRowid);
    console.log(`• create ${person.email.padEnd(24)} ${person.role}`);
  }
}

const idOf = Object.fromEntries(ROSTER.map((p) => [p.email, p.id]));

// --- tasks (only the ones that aren't already there, so re-running is safe) ---
let addedTasks = 0;
tx(() => {
  for (const [email, title, code, status, priority, estimate, dueIn] of TASKS) {
    if (one('SELECT id FROM tasks WHERE title = ?', title)) continue;
    const position = one('SELECT COALESCE(MIN(position), 0) - 1 AS p FROM tasks').p;
    run(`INSERT INTO tasks (project_id, title, notes, assignee_id, status, priority,
                            estimate_minutes, due_date, position, done_at, created_at, updated_at)
         VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      byCode[code] ?? null, title, idOf[email], status, priority, estimate,
      addDays(today, dueIn), position, status === 'done' ? now : null, now, now);
    addedTasks++;
  }
});

// --- history: three weeks of weekday hours per person ---
// Deterministic per-person PRNG, so a re-run of a wiped database reproduces the
// same demo rather than a different-looking one.
let filled = 0;
tx(() => {
  for (const person of ROSTER) {
    const has = one('SELECT COUNT(*) AS n FROM time_entries WHERE user_id = ?', person.id).n;
    if (has) {
      console.log(`• ${person.name} already has ${has} entries — history left alone`);
      continue;
    }

    let s = person.seed;
    const rand = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;

    for (let back = 20; back >= 0; back--) {
      const date = addDays(today, -back);
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      if (dow === 0 || dow === 6) continue;
      if (rand() < 0.1) continue;                          // the odd day off

      const target = person.target - 60 + Math.floor(rand() * 150);
      let logged = 0;
      while (logged < target) {
        const minutes = Math.min(target - logged, 30 + Math.floor(rand() * 10) * 15);
        if (minutes < 15) break;
        const project = projects[Math.floor(rand() * projects.length)];
        const pool = notesFor(project.code);
        run(`INSERT INTO time_entries (user_id, project_id, task_id, date, minutes, note, billable, source, created_at, updated_at)
             VALUES (?, ?, NULL, ?, ?, ?, ?, 'manual', ?, ?)`,
          person.id, project.id, date, minutes,
          pool[Math.floor(rand() * pool.length)], project.billable, now, now);
        logged += minutes;
        filled++;
      }
    }
  }
});

// Label anything left unlabelled for the demo roster — earlier runs (and the
// original `npm run seed`) wrote entries with an empty note, which leaves the
// Quick log suggestion chips with nothing to offer.
let labelled = 0;
tx(() => {
  for (const person of ROSTER) {
    const blanks = all(`
      SELECT e.id, p.code FROM time_entries e
      LEFT JOIN projects p ON p.id = e.project_id
      WHERE e.user_id = ? AND TRIM(e.note) = ''`, person.id);
    let s = person.seed + 5;
    const rand = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (const row of blanks) {
      const pool = notesFor(row.code);
      run('UPDATE time_entries SET note = ? WHERE id = ?', pool[Math.floor(rand() * pool.length)], row.id);
      labelled++;
    }
  }
});
if (labelled) console.log(`• labelled ${labelled} previously blank entries`);

const totals = one('SELECT COUNT(*) AS n, COALESCE(SUM(minutes),0) AS m FROM time_entries');

console.log(`
  Demo team ready — ${addedTasks} tasks added, ${filled} entries back-filled.
  Workspace now holds ${totals.n} entries (${(totals.m / 60).toFixed(1)} h).

  Sign in at http://localhost:${process.env.PORT || 8123}

    Password for all three:  ${PASSWORD}

    admin@dgtlgroup.io    DGTL Admin    admin   — sees everyone, manages projects + people
    sam@dgtlgroup.io      Sam Delaney   member  — own time only, full read access
    jordan@dgtlgroup.io   Jordan Pike   member  — own time only, full read access

  Switch to "Team" on Reports or Timesheet to see all three together.

  ⚠  These are demo credentials committed to the repo. Before this workspace holds
     anything real: npm run user -- reset --email <e>   (or  ... off --email <e>)
`);
