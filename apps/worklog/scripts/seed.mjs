/**
 * DGTL Worklog — first-run seed.
 *
 *   npm run seed                                   first admin + sample data
 *   npm run seed -- --email you@dgtlgroup.io --password '…'
 *   npm run seed -- --no-demo                      admin only, empty workspace
 *
 * Safe to re-run: an existing admin is left alone, and demo data is only
 * inserted into a workspace that has no projects yet.
 */

import crypto from 'node:crypto';
import { all, one, run, tx } from '../server/db.mjs';
import { addDays, localDate, nowISO } from '../server/config.mjs';
import { hashPassword } from '../server/auth.mjs';

const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const has = (name) => argv.includes(`--${name}`);

const email = (flag('email') || process.env.SEED_ADMIN_EMAIL || 'admin@dgtlgroup.io').toLowerCase();
const name = flag('name') || process.env.SEED_ADMIN_NAME || 'DGTL Admin';
const demo = !has('no-demo');

// A generated password is printed once and never stored anywhere else.
let password = flag('password') || process.env.SEED_ADMIN_PASSWORD || '';
let generated = false;
if (!password) {
  password = crypto.randomBytes(12).toString('base64url');
  generated = true;
}

const now = nowISO();
let adminId;

const existing = one('SELECT * FROM users WHERE lower(email) = ?', email);
if (existing) {
  adminId = existing.id;
  console.log(`• user ${email} already exists — left untouched`);
} else {
  const res = run(`
    INSERT INTO users (email, name, role, password_hash, daily_target_minutes, week_start, active, created_at, updated_at)
    VALUES (?, ?, 'admin', ?, 480, 1, 1, ?, ?)`,
    email, name, hashPassword(password), now, now,
  );
  adminId = Number(res.lastInsertRowid);
  console.log(`• created admin ${email}`);
}

if (demo && all('SELECT id FROM projects LIMIT 1').length === 0) {
  // Internal DGTL work surfaces — deliberately not client names or claims.
  const projects = [
    { name: 'Growth Platform', client: 'DGTL', code: 'PLAT', color: '#F0CF50', billable: 0, budget: 240 * 60 },
    { name: 'Influence Journal', client: 'DGTL', code: 'JRNL', color: '#b3a06a', billable: 0, budget: 120 * 60 },
    { name: 'Client Delivery', client: '', code: 'DLVR', color: '#6E9FDB', billable: 1, budget: 400 * 60 },
    { name: 'Pitches & Proposals', client: '', code: 'PTCH', color: '#7BC47F', billable: 0, budget: null },
    { name: 'Internal / Admin', client: 'DGTL', code: 'ADMN', color: '#8a8a8a', billable: 0, budget: null },
  ];

  const tasks = [
    ['Verify platform build on a networked machine', 'PLAT', 'doing', 'high', 180, 0],
    ['Review the three untracked tenant configs', 'PLAT', 'todo', 'high', 90, 2],
    ['Wire funding-opportunity engine to lead matching', 'PLAT', 'todo', 'normal', 960, 21],
    ['Fill canonical + OG URLs once the deploy domain lands', 'JRNL', 'todo', 'normal', 60, 7],
    ['Creator pack QA pass — link check across all packs', 'JRNL', 'todo', 'low', 120, 14],
    ['Draft Q3 retainer report template', 'DLVR', 'todo', 'normal', 240, 10],
    ['Refresh the website-overhaul offer page', 'PTCH', 'doing', 'normal', 180, 3],
    ['Expense reconciliation', 'ADMN', 'todo', 'low', 60, 5],
    ['Ship creator intake staging deploy', 'PLAT', 'done', 'high', 300, -2],
  ];

  tx(() => {
    projects.forEach((p, i) => {
      run(`INSERT INTO projects (name, client, code, color, billable, budget_minutes, status, position, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        p.name, p.client, p.code, p.color, p.billable, p.budget, i, now, now);
    });

    const byCode = Object.fromEntries(all('SELECT id, code FROM projects').map((r) => [r.code, r.id]));

    tasks.forEach(([title, code, status, priority, estimate, dueIn], i) => {
      run(`INSERT INTO tasks (project_id, title, notes, assignee_id, status, priority,
                              estimate_minutes, due_date, position, done_at, created_at, updated_at)
           VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        byCode[code], title, adminId, status, priority, estimate,
        addDays(localDate(), dueIn), i, status === 'done' ? now : null, now, now);
    });

    // Three weeks of plausible, self-consistent history so the charts, the
    // heatmap and the streak all have something real to render on day one.
    const today = localDate();
    const ids = Object.values(byCode);
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

    for (let back = 20; back >= 0; back--) {
      const date = addDays(today, -back);
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      if (dow === 0 || dow === 6) continue;              // weekends off
      if (rand() < 0.12) continue;                        // the odd day away

      let logged = 0;
      const target = 330 + Math.floor(rand() * 210);      // ~5.5–9 h
      while (logged < target) {
        const minutes = Math.min(target - logged, 30 + Math.floor(rand() * 12) * 15);
        if (minutes < 15) break;
        const projectId = ids[Math.floor(rand() * ids.length)];
        run(`INSERT INTO time_entries (user_id, project_id, task_id, date, minutes, note, billable, source, created_at, updated_at)
             VALUES (?, ?, NULL, ?, ?, '', ?, 'manual', ?, ?)`,
          adminId, projectId, date, minutes,
          one('SELECT billable FROM projects WHERE id = ?', projectId).billable, now, now);
        logged += minutes;
      }
    }
  });

  const n = one('SELECT COUNT(*) AS n, COALESCE(SUM(minutes),0) AS m FROM time_entries');
  console.log(`• seeded ${projects.length} projects, ${tasks.length} tasks, ${n.n} time entries (${(n.m / 60).toFixed(1)} h)`);
} else if (demo) {
  console.log('• workspace already has projects — skipped demo data');
}

console.log(`
  Sign in at http://localhost:${process.env.PORT || 8123}

    email     ${email}
    password  ${existing ? '(unchanged)' : password}
`);
if (generated && !existing) console.log('  ↑ generated password — copy it now, it is not stored anywhere else.\n');
