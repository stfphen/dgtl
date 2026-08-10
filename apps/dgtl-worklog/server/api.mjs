/**
 * DGTL Worklog — JSON API.
 *
 * Permission model, deliberately small:
 *   • everyone   — logs their own time, creates and edits tasks, reads team reports
 *   • admins     — additionally manage projects, manage users, and edit anyone's time
 *
 * Derived numbers (streaks, totals, completion %) are computed here from
 * time_entries on every read. Nothing derived is ever stored.
 */

import { all, one, run, tx } from './db.mjs';
import { APP_TIMEZONE, addDays, isDate, localDate, nowISO, startOfWeek } from './config.mjs';
import { HttpError, bad } from './http.mjs';
import {
  clearThrottle, createSession, destroySession, hashPassword,
  requireAdmin, requireUser, throttleLogin, verifyPassword,
} from './auth.mjs';

// ------------------------------------------------------------------ palette
// The two shades the API has to name for itself. Nothing here can read
// tokens.css, so these are the only brand values restated outside it — change
// a token and change its twin here, or a new project comes out the wrong gold.

const DEFAULT_PROJECT_COLOR = '#F0CF50';   // tokens.css --gold
const UNASSIGNED_COLOR = '#8a8a8a';        // tokens.css --chart-6, the neutral series

// ---------------------------------------------------------------- validation

const str = (v, { name, max = 200, required = false, dflt = '' } = {}) => {
  if (v === undefined || v === null) {
    if (required) throw bad(`${name} is required`);
    return dflt;
  }
  const s = String(v).trim();
  if (required && !s) throw bad(`${name} is required`);
  if (s.length > max) throw bad(`${name} must be ${max} characters or fewer`);
  return s;
};

const int = (v, { name, min = 0, max = 10 ** 9, nullable = false } = {}) => {
  if (v === undefined || v === null || v === '') {
    if (nullable) return null;
    throw bad(`${name} is required`);
  }
  const n = Number(v);
  if (!Number.isInteger(n)) throw bad(`${name} must be a whole number`);
  if (n < min || n > max) throw bad(`${name} must be between ${min} and ${max}`);
  return n;
};

const pick = (v, allowed, { name, dflt } = {}) => {
  if (v === undefined || v === null || v === '') return dflt;
  const s = String(v);
  if (!allowed.includes(s)) throw bad(`${name} must be one of: ${allowed.join(', ')}`);
  return s;
};

const bool01 = (v, dflt = 1) => (v === undefined || v === null ? dflt : (v && v !== '0' ? 1 : 0));

const dateOr = (v, dflt) => {
  if (v === undefined || v === null || v === '') return dflt;
  if (!isDate(String(v))) throw bad(`"${v}" is not a valid YYYY-MM-DD date`);
  return String(v);
};

const colorOr = (v, dflt = DEFAULT_PROJECT_COLOR) => {
  if (v === undefined || v === null || v === '') return dflt;
  const s = String(v).trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) throw bad('Colour must be a #rrggbb hex value');
  return s.toUpperCase();
};

/** Does `actor` own row `ownerId`, or outrank it? */
const canEditFor = (actor, ownerId) => actor.role === 'admin' || actor.id === ownerId;

// ------------------------------------------------------------------ shaping

const projectRow = (p) => ({
  id: p.id, name: p.name, client: p.client, code: p.code, color: p.color,
  billable: !!p.billable, budgetMinutes: p.budget_minutes, status: p.status,
  position: p.position, loggedMinutes: p.logged_minutes ?? 0, openTasks: p.open_tasks ?? 0,
  // Every task ever filed under the project, including done and archived ones.
  // `openTasks` drives the table; this drives the delete warning, because a
  // delete detaches all of them, not only the ones still open.
  taskCount: p.all_tasks ?? 0,
  // Billable is a property of each entry, not of the project — a billable
  // project can hold non-billable hours. This counts only entries carrying
  // this project's id: time logged against no project is in no project row at
  // all, which is why the bootstrap payload reports it separately.
  billableMinutes: p.billable_minutes ?? 0,
});

const taskRow = (t) => ({
  id: t.id, projectId: t.project_id, title: t.title, notes: t.notes,
  assigneeId: t.assignee_id, status: t.status, priority: t.priority,
  estimateMinutes: t.estimate_minutes, dueDate: t.due_date, position: t.position,
  doneAt: t.done_at, archived: !!t.archived, loggedMinutes: t.logged_minutes ?? 0,
});

const entryRow = (e) => ({
  id: e.id, userId: e.user_id, projectId: e.project_id, taskId: e.task_id,
  date: e.date, minutes: e.minutes, note: e.note, billable: !!e.billable,
  startedAt: e.started_at, endedAt: e.ended_at, source: e.source,
  projectName: e.project_name ?? null, projectColor: e.project_color ?? null,
  taskTitle: e.task_title ?? null, userName: e.user_name ?? null,
});

const userRow = (u) => ({
  id: u.id, email: u.email, name: u.name, role: u.role, active: !!u.active,
  dailyTargetMinutes: u.daily_target_minutes, weekStart: u.week_start,
});

const listProjects = () => all(`
  SELECT p.*,
         (SELECT COALESCE(SUM(minutes), 0) FROM time_entries te WHERE te.project_id = p.id) AS logged_minutes,
         (SELECT COALESCE(SUM(CASE WHEN te.billable = 1 THEN te.minutes ELSE 0 END), 0)
            FROM time_entries te WHERE te.project_id = p.id) AS billable_minutes,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status <> 'done' AND t.archived = 0) AS open_tasks,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS all_tasks
    FROM projects p
   ORDER BY p.status ASC, p.position ASC, p.id ASC
`).map(projectRow);

/**
 * Time that belongs to no project. Every project row counts only entries
 * carrying its id, so this is the remainder the Projects screen would
 * otherwise drop on the floor — it is stated there, not hidden.
 */
const unassignedTotals = () => {
  const u = one(`
    SELECT COALESCE(SUM(minutes), 0) AS minutes,
           COALESCE(SUM(CASE WHEN billable = 1 THEN minutes ELSE 0 END), 0) AS billable_minutes
      FROM time_entries WHERE project_id IS NULL`);
  return { minutes: u.minutes, billableMinutes: u.billable_minutes };
};

const listTasks = ({ includeArchived = false } = {}) => all(`
  SELECT t.*,
         (SELECT COALESCE(SUM(minutes), 0) FROM time_entries te WHERE te.task_id = t.id) AS logged_minutes
    FROM tasks t
   WHERE (? = 1 OR t.archived = 0)
   ORDER BY t.position ASC, t.id ASC
`, includeArchived ? 1 : 0).map(taskRow);

const ENTRY_SELECT = `
  SELECT e.*, p.name AS project_name, p.color AS project_color,
         t.title AS task_title, u.name AS user_name
    FROM time_entries e
    LEFT JOIN projects p ON p.id = e.project_id
    LEFT JOIN tasks    t ON t.id = e.task_id
    LEFT JOIN users    u ON u.id = e.user_id
`;

function runningTimer(userId) {
  const t = one(`
    SELECT tm.*, p.name AS project_name, p.color AS project_color, tk.title AS task_title
      FROM timers tm
      LEFT JOIN projects p  ON p.id = tm.project_id
      LEFT JOIN tasks    tk ON tk.id = tm.task_id
     WHERE tm.user_id = ?`, userId);
  if (!t) return null;
  return {
    projectId: t.project_id, taskId: t.task_id, note: t.note, billable: !!t.billable,
    startedAt: t.started_at, projectName: t.project_name, projectColor: t.project_color,
    taskTitle: t.task_title,
    elapsedSeconds: Math.max(0, Math.round((Date.now() - new Date(t.started_at).getTime()) / 1000)),
  };
}

/**
 * Stop the running timer and write it to time_entries.
 * Under a minute is discarded — a mis-click should not litter the timesheet.
 */
function stopTimer(userId, { discard = false } = {}) {
  const t = one('SELECT * FROM timers WHERE user_id = ?', userId);
  if (!t) return null;

  const endedAt = new Date();
  const minutes = Math.round((endedAt.getTime() - new Date(t.started_at).getTime()) / 60000);

  return tx(() => {
    run('DELETE FROM timers WHERE user_id = ?', userId);
    if (discard || minutes < 1) return null;

    const now = nowISO();
    const res = run(`
      INSERT INTO time_entries
        (user_id, project_id, task_id, date, minutes, note, billable, started_at, ended_at, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'timer', ?, ?)`,
      userId, t.project_id, t.task_id, localDate(new Date(t.started_at)), minutes,
      t.note, t.billable, t.started_at, endedAt.toISOString(), now, now,
    );
    return one(`${ENTRY_SELECT} WHERE e.id = ?`, Number(res.lastInsertRowid));
  });
}

// ------------------------------------------------------------------ reports

/**
 * Longest and current run of consecutive days with any time logged — the
 * habit tracker's streak, re-pointed at hours instead of check-ins. Computed
 * over the user's whole history, never stored.
 */
function streaks(userId, today) {
  const days = all(
    'SELECT DISTINCT date FROM time_entries WHERE user_id = ? AND minutes > 0 ORDER BY date ASC',
    userId,
  ).map((r) => r.date);
  if (!days.length) return { current: 0, longest: 0, activeDays: 0 };

  let longest = 1;
  let run_ = 1;
  for (let i = 1; i < days.length; i++) {
    run_ = addDays(days[i - 1], 1) === days[i] ? run_ + 1 : 1;
    if (run_ > longest) longest = run_;
  }

  // The current streak survives "today not logged yet" — it only breaks once
  // yesterday has also gone unlogged, so an early-morning check-in reads right.
  const last = days[days.length - 1];
  let current = 0;
  if (last === today || last === addDays(today, -1)) {
    current = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (addDays(days[i - 1], 1) === days[i]) current++;
      else break;
    }
  }
  return { current, longest, activeDays: days.length };
}

function buildReport({ from, to, userId }) {
  // One scoping clause, bound not interpolated. `q` appends the user id only
  // when the report is scoped to one person, keeping placeholders aligned.
  const scoped = userId ? 'AND e.user_id = ?' : '';
  const q = (sql, ...lead) => all(sql, ...lead, ...(userId ? [userId] : []));

  const totals = q(`
    SELECT COALESCE(SUM(e.minutes),0) AS minutes,
           COALESCE(SUM(CASE WHEN e.billable = 1 THEN e.minutes ELSE 0 END),0) AS billable_minutes,
           COUNT(*) AS entries,
           COUNT(DISTINCT e.date) AS days
      FROM time_entries e
     WHERE e.date BETWEEN ? AND ? ${scoped}`, from, to)[0];

  const byDay = q(`
    SELECT e.date AS date, SUM(e.minutes) AS minutes
      FROM time_entries e
     WHERE e.date BETWEEN ? AND ? ${scoped}
     GROUP BY e.date ORDER BY e.date`, from, to);

  const byProject = q(`
    SELECT e.project_id AS projectId,
           COALESCE(p.name, 'Unassigned') AS name,
           COALESCE(p.color, ?)           AS color,
           SUM(e.minutes) AS minutes,
           SUM(CASE WHEN e.billable = 1 THEN e.minutes ELSE 0 END) AS billableMinutes
      FROM time_entries e LEFT JOIN projects p ON p.id = e.project_id
     WHERE e.date BETWEEN ? AND ? ${scoped}
     GROUP BY e.project_id ORDER BY minutes DESC`, UNASSIGNED_COLOR, from, to);

  const byUser = q(`
    SELECT e.user_id AS userId, COALESCE(u.name, 'Removed user') AS name, SUM(e.minutes) AS minutes
      FROM time_entries e LEFT JOIN users u ON u.id = e.user_id
     WHERE e.date BETWEEN ? AND ? ${scoped}
     GROUP BY e.user_id ORDER BY minutes DESC`, from, to);

  const taskScope = userId ? 'AND t.assignee_id = ?' : '';
  const tasks = all(`
    SELECT
      SUM(CASE WHEN t.status = 'done' AND date(t.done_at) BETWEEN ? AND ? THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN t.status <> 'done' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN t.status <> 'done' AND t.due_date IS NOT NULL AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue
    FROM tasks t WHERE t.archived = 0 ${taskScope}`,
    ...[from, to, to, ...(userId ? [userId] : [])])[0];

  // Trailing 90 days ending at `to` — the heatmap, straight out of the habit tracker.
  const heatFrom = addDays(to, -89);
  const heatmap = q(`
    SELECT e.date AS date, SUM(e.minutes) AS minutes
      FROM time_entries e
     WHERE e.date BETWEEN ? AND ? ${scoped}
     GROUP BY e.date ORDER BY e.date`, heatFrom, to);

  return {
    range: { from, to },
    totals: {
      minutes: totals.minutes, billableMinutes: totals.billable_minutes,
      entries: totals.entries, days: totals.days,
    },
    byDay, byProject, byUser,
    tasks: { done: tasks.done ?? 0, open: tasks.open ?? 0, overdue: tasks.overdue ?? 0 },
    heatmap: { from: heatFrom, to, days: heatmap },
    streak: userId ? streaks(userId, localDate()) : null,
  };
}

// ------------------------------------------------------------------- routes

/** `[method, pattern, handler]`; `:name` segments land in `ctx.params`. */
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, pattern, handler });

// --- auth ---
route('POST', '/api/auth/login', async ({ body, res, req, ip }) => {
  const email = str(body.email, { name: 'Email', required: true, max: 190 }).toLowerCase();
  const password = String(body.password || '');
  throttleLogin(ip, email);

  const user = one('SELECT * FROM users WHERE lower(email) = ?', email);
  // Same message and roughly the same work either way — no account enumeration.
  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    throw new HttpError(401, 'Email or password is incorrect');
  }
  clearThrottle(ip, email);
  createSession(res, user.id, String(req.headers['user-agent'] || ''));
  return { user: userRow(user) };
});

route('POST', '/api/auth/logout', ({ req, res }) => {
  destroySession(req, res);
  return { ok: true };
});

// --- bootstrap: everything the app needs for a cold start, in one call ---
route('GET', '/api/bootstrap', ({ req }) => {
  const user = requireUser(req);
  const today = localDate();
  return {
    user: { ...user, dailyTargetMinutes: user.dailyTargetMinutes, weekStart: user.weekStart },
    today,
    timezone: APP_TIMEZONE,
    weekStartDate: startOfWeek(today, user.weekStart),
    users: all('SELECT * FROM users WHERE active = 1 ORDER BY name').map(userRow),
    projects: listProjects(),
    unassigned: unassignedTotals(),
    tasks: listTasks(),
    timer: runningTimer(user.id),
    todayEntries: all(`${ENTRY_SELECT} WHERE e.user_id = ? AND e.date = ? ORDER BY e.id DESC`,
      user.id, today).map(entryRow),
  };
});

// --- me ---
route('PATCH', '/api/me', ({ req, body }) => {
  const user = requireUser(req);
  const row = one('SELECT * FROM users WHERE id = ?', user.id);

  const name = str(body.name, { name: 'Name', dflt: row.name, max: 120 }) || row.name;
  const target = body.dailyTargetMinutes === undefined
    ? row.daily_target_minutes
    : int(body.dailyTargetMinutes, { name: 'Daily target', min: 0, max: 24 * 60 });
  const weekStart = body.weekStart === undefined ? row.week_start
    : int(body.weekStart, { name: 'Week start', min: 0, max: 6 });

  let passwordHash = row.password_hash;
  if (body.newPassword) {
    if (!verifyPassword(String(body.currentPassword || ''), row.password_hash)) {
      throw bad('Current password is incorrect');
    }
    if (String(body.newPassword).length < 10) throw bad('New password must be at least 10 characters');
    passwordHash = hashPassword(String(body.newPassword));
  }

  run(`UPDATE users SET name = ?, daily_target_minutes = ?, week_start = ?, password_hash = ?, updated_at = ?
        WHERE id = ?`, name, target, weekStart, passwordHash, nowISO(), user.id);
  return { user: userRow(one('SELECT * FROM users WHERE id = ?', user.id)) };
});

// --- projects (admin writes) ---
route('GET', '/api/projects', ({ req }) => {
  requireUser(req);
  return { projects: listProjects() };
});

route('POST', '/api/projects', ({ req, body }) => {
  requireAdmin(req);
  const now = nowISO();
  const next = one('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM projects').p;
  const res = run(`
    INSERT INTO projects (name, client, code, color, billable, budget_minutes, status, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    str(body.name, { name: 'Project name', required: true, max: 120 }),
    str(body.client, { name: 'Client', max: 120 }),
    str(body.code, { name: 'Code', max: 16 }).toUpperCase(),
    colorOr(body.color),
    bool01(body.billable, 1),
    int(body.budgetMinutes, { name: 'Budget', min: 0, max: 10 ** 7, nullable: true }),
    next, now, now,
  );
  return { project: projectRow(one('SELECT * FROM projects WHERE id = ?', Number(res.lastInsertRowid))) };
});

route('PATCH', '/api/projects/:id', ({ req, body, params }) => {
  requireAdmin(req);
  const p = one('SELECT * FROM projects WHERE id = ?', params.id);
  if (!p) throw new HttpError(404, 'Project not found');

  run(`UPDATE projects SET name = ?, client = ?, code = ?, color = ?, billable = ?,
         budget_minutes = ?, status = ?, position = ?, updated_at = ? WHERE id = ?`,
    str(body.name, { name: 'Project name', dflt: p.name, max: 120 }) || p.name,
    body.client === undefined ? p.client : str(body.client, { name: 'Client', max: 120 }),
    body.code === undefined ? p.code : str(body.code, { name: 'Code', max: 16 }).toUpperCase(),
    colorOr(body.color, p.color),
    bool01(body.billable, p.billable),
    body.budgetMinutes === undefined ? p.budget_minutes
      : int(body.budgetMinutes, { name: 'Budget', min: 0, max: 10 ** 7, nullable: true }),
    pick(body.status, ['active', 'archived'], { name: 'Status', dflt: p.status }),
    body.position === undefined ? p.position : int(body.position, { name: 'Position', min: 0 }),
    nowISO(), p.id,
  );
  return { project: projectRow(one('SELECT * FROM projects WHERE id = ?', p.id)) };
});

route('DELETE', '/api/projects/:id', ({ req, params }) => {
  requireAdmin(req);
  const p = one('SELECT * FROM projects WHERE id = ?', params.id);
  if (!p) throw new HttpError(404, 'Project not found');

  // Deleting a project with history would orphan hours people are paid for.
  // Archive is the safe path, and the UI offers it instead.
  const logged = one('SELECT COUNT(*) AS n FROM time_entries WHERE project_id = ?', p.id).n;
  if (logged > 0) {
    throw bad(`"${p.name}" has ${logged} time ${logged === 1 ? 'entry' : 'entries'}. Archive it instead of deleting.`);
  }

  // Tasks outlive the project — schema.sql sets project_id to NULL rather than
  // deleting them — so count them before the row goes and report exactly how
  // many were detached. The UI states that number instead of guessing at it.
  const t = one(`
    SELECT COUNT(*) AS n,
           COALESCE(SUM(CASE WHEN status <> 'done' AND archived = 0 THEN 1 ELSE 0 END), 0) AS open
      FROM tasks WHERE project_id = ?`, p.id);

  run('DELETE FROM projects WHERE id = ?', p.id);
  return { ok: true, detachedTasks: t.n, detachedOpenTasks: t.open };
});

// --- tasks (anyone) ---
route('GET', '/api/tasks', ({ req, query }) => {
  requireUser(req);
  return { tasks: listTasks({ includeArchived: query.get('archived') === '1' }) };
});

route('POST', '/api/tasks', ({ req, body }) => {
  const user = requireUser(req);
  const now = nowISO();
  const next = one('SELECT COALESCE(MIN(position), 0) - 1 AS p FROM tasks').p;
  const res = run(`
    INSERT INTO tasks (project_id, title, notes, assignee_id, status, priority,
                       estimate_minutes, due_date, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    int(body.projectId, { name: 'Project', nullable: true }),
    str(body.title, { name: 'Task title', required: true, max: 200 }),
    str(body.notes, { name: 'Notes', max: 4000 }),
    body.assigneeId === undefined ? user.id : int(body.assigneeId, { name: 'Assignee', nullable: true }),
    pick(body.status, ['todo', 'doing', 'done'], { name: 'Status', dflt: 'todo' }),
    pick(body.priority, ['low', 'normal', 'high'], { name: 'Priority', dflt: 'normal' }),
    int(body.estimateMinutes, { name: 'Estimate', min: 0, max: 10 ** 6, nullable: true }),
    dateOr(body.dueDate, null),
    next, now, now,
  );
  return { task: taskRow(one('SELECT * FROM tasks WHERE id = ?', Number(res.lastInsertRowid))) };
});

route('PATCH', '/api/tasks/:id', ({ req, body, params }) => {
  requireUser(req);
  const t = one('SELECT * FROM tasks WHERE id = ?', params.id);
  if (!t) throw new HttpError(404, 'Task not found');

  const status = pick(body.status, ['todo', 'doing', 'done'], { name: 'Status', dflt: t.status });
  // done_at is the timestamp reports count "completed this week" from, so it
  // is stamped on the transition and cleared if a task is reopened.
  const doneAt = status === 'done' ? (t.done_at || nowISO()) : null;

  run(`UPDATE tasks SET project_id = ?, title = ?, notes = ?, assignee_id = ?, status = ?,
         priority = ?, estimate_minutes = ?, due_date = ?, position = ?, archived = ?,
         done_at = ?, updated_at = ? WHERE id = ?`,
    body.projectId === undefined ? t.project_id : int(body.projectId, { name: 'Project', nullable: true }),
    str(body.title, { name: 'Task title', dflt: t.title, max: 200 }) || t.title,
    body.notes === undefined ? t.notes : str(body.notes, { name: 'Notes', max: 4000 }),
    body.assigneeId === undefined ? t.assignee_id : int(body.assigneeId, { name: 'Assignee', nullable: true }),
    status,
    pick(body.priority, ['low', 'normal', 'high'], { name: 'Priority', dflt: t.priority }),
    body.estimateMinutes === undefined ? t.estimate_minutes
      : int(body.estimateMinutes, { name: 'Estimate', min: 0, max: 10 ** 6, nullable: true }),
    body.dueDate === undefined ? t.due_date : dateOr(body.dueDate, null),
    body.position === undefined ? t.position : int(body.position, { name: 'Position', min: -(10 ** 6) }),
    bool01(body.archived, t.archived),
    doneAt, nowISO(), t.id,
  );
  return { task: taskRow(one('SELECT * FROM tasks WHERE id = ?', t.id)) };
});

route('DELETE', '/api/tasks/:id', ({ req, params }) => {
  requireUser(req);
  const t = one('SELECT * FROM tasks WHERE id = ?', params.id);
  if (!t) throw new HttpError(404, 'Task not found');
  // Time already logged against the task keeps its project and survives via
  // ON DELETE SET NULL — hours are never destroyed by tidying a to-do list.
  run('DELETE FROM tasks WHERE id = ?', t.id);
  return { ok: true };
});

route('POST', '/api/tasks/reorder', ({ req, body }) => {
  requireUser(req);
  const ids = Array.isArray(body.ids) ? body.ids.map((v) => int(v, { name: 'Task id' })) : null;
  if (!ids) throw bad('Send { ids: [...] } in the new order');
  tx(() => ids.forEach((id, i) => run('UPDATE tasks SET position = ?, updated_at = ? WHERE id = ?', i, nowISO(), id)));
  return { tasks: listTasks() };
});

// --- time entries ---
route('GET', '/api/entries', ({ req, query }) => {
  const user = requireUser(req);
  const to = dateOr(query.get('to'), localDate());
  const from = dateOr(query.get('from'), addDays(to, -30));
  const scope = query.get('scope') === 'team' ? 'team' : 'me';
  // Validated, not coerced. A bare Number() turns "abc" into NaN, NaN is falsy,
  // and the falsy branch below is the unscoped team query — so a malformed id
  // silently widened the scope instead of being rejected.
  const asked = query.get('userId');
  const userId = scope === 'team' ? null : (asked ? int(asked, { name: 'User', min: 1 }) : user.id);

  const rows = userId
    ? all(`${ENTRY_SELECT} WHERE e.user_id = ? AND e.date BETWEEN ? AND ? ORDER BY e.date DESC, e.id DESC`, userId, from, to)
    : all(`${ENTRY_SELECT} WHERE e.date BETWEEN ? AND ? ORDER BY e.date DESC, e.id DESC`, from, to);
  return { entries: rows.map(entryRow), range: { from, to } };
});

route('POST', '/api/entries', ({ req, body }) => {
  const user = requireUser(req);
  const targetUser = body.userId === undefined ? user.id : int(body.userId, { name: 'User' });
  if (!canEditFor(user, targetUser)) throw new HttpError(403, "You can only log your own time");

  const now = nowISO();
  const res = run(`
    INSERT INTO time_entries (user_id, project_id, task_id, date, minutes, note, billable, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`,
    targetUser,
    int(body.projectId, { name: 'Project', nullable: true }),
    int(body.taskId, { name: 'Task', nullable: true }),
    dateOr(body.date, localDate()),
    int(body.minutes, { name: 'Minutes', min: 1, max: 24 * 60 }),
    str(body.note, { name: 'Note', max: 500 }),
    bool01(body.billable, 1),
    now, now,
  );
  return { entry: entryRow(one(`${ENTRY_SELECT} WHERE e.id = ?`, Number(res.lastInsertRowid))) };
});

route('PATCH', '/api/entries/:id', ({ req, body, params }) => {
  const user = requireUser(req);
  const e = one('SELECT * FROM time_entries WHERE id = ?', params.id);
  if (!e) throw new HttpError(404, 'Time entry not found');
  if (!canEditFor(user, e.user_id)) throw new HttpError(403, "You can only edit your own time");

  run(`UPDATE time_entries SET project_id = ?, task_id = ?, date = ?, minutes = ?, note = ?,
         billable = ?, updated_at = ? WHERE id = ?`,
    body.projectId === undefined ? e.project_id : int(body.projectId, { name: 'Project', nullable: true }),
    body.taskId === undefined ? e.task_id : int(body.taskId, { name: 'Task', nullable: true }),
    dateOr(body.date, e.date),
    body.minutes === undefined ? e.minutes : int(body.minutes, { name: 'Minutes', min: 1, max: 24 * 60 }),
    body.note === undefined ? e.note : str(body.note, { name: 'Note', max: 500 }),
    bool01(body.billable, e.billable),
    nowISO(), e.id,
  );
  return { entry: entryRow(one(`${ENTRY_SELECT} WHERE e.id = ?`, e.id)) };
});

route('DELETE', '/api/entries/:id', ({ req, params }) => {
  const user = requireUser(req);
  const e = one('SELECT * FROM time_entries WHERE id = ?', params.id);
  if (!e) throw new HttpError(404, 'Time entry not found');
  if (!canEditFor(user, e.user_id)) throw new HttpError(403, "You can only delete your own time");
  run('DELETE FROM time_entries WHERE id = ?', e.id);
  return { ok: true };
});

// --- timer ---
route('GET', '/api/timer', ({ req }) => ({ timer: runningTimer(requireUser(req).id) }));

route('POST', '/api/timer/start', ({ req, body }) => {
  const user = requireUser(req);
  // Starting a second timer banks the first rather than losing it.
  const banked = stopTimer(user.id);

  run(`INSERT INTO timers (user_id, project_id, task_id, note, billable, started_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET project_id = excluded.project_id,
         task_id = excluded.task_id, note = excluded.note,
         billable = excluded.billable, started_at = excluded.started_at`,
    user.id,
    int(body.projectId, { name: 'Project', nullable: true }),
    int(body.taskId, { name: 'Task', nullable: true }),
    str(body.note, { name: 'Note', max: 500 }),
    bool01(body.billable, 1),
    nowISO(),
  );

  // Picking up a to-do implies it is in progress.
  if (body.taskId) {
    run(`UPDATE tasks SET status = 'doing', updated_at = ? WHERE id = ? AND status = 'todo'`, nowISO(), body.taskId);
  }
  return { timer: runningTimer(user.id), banked: banked ? entryRow(banked) : null };
});

/**
 * Re-label a running timer without stopping it. This is what makes the Quick
 * log screen work: hit start the moment you begin, sort out what it was
 * afterwards. Deliberately does not touch started_at — elapsed time is a fact.
 */
route('PATCH', '/api/timer', ({ req, body }) => {
  const user = requireUser(req);
  const t = one('SELECT * FROM timers WHERE user_id = ?', user.id);
  if (!t) throw new HttpError(404, 'No timer is running');

  const projectId = body.projectId === undefined ? t.project_id
    : int(body.projectId, { name: 'Project', nullable: true });
  // A task belonging to a different project would silently mis-file the hours.
  let taskId = body.taskId === undefined ? t.task_id : int(body.taskId, { name: 'Task', nullable: true });
  if (taskId) {
    const task = one('SELECT project_id FROM tasks WHERE id = ?', taskId);
    if (!task) throw new HttpError(404, 'Task not found');
    if (projectId && task.project_id && task.project_id !== projectId) taskId = null;
  }

  run(`UPDATE timers SET project_id = ?, task_id = ?, note = ?, billable = ? WHERE user_id = ?`,
    projectId, taskId,
    body.note === undefined ? t.note : str(body.note, { name: 'Note', max: 500 }),
    bool01(body.billable, t.billable),
    user.id,
  );
  if (taskId) {
    run(`UPDATE tasks SET status = 'doing', updated_at = ? WHERE id = ? AND status = 'todo'`, nowISO(), taskId);
  }
  return { timer: runningTimer(user.id) };
});

route('POST', '/api/timer/stop', ({ req }) => {
  const user = requireUser(req);
  const entry = stopTimer(user.id);
  return { timer: null, entry: entry ? entryRow(entry) : null, discarded: !entry };
});

route('POST', '/api/timer/discard', ({ req }) => {
  const user = requireUser(req);
  stopTimer(user.id, { discard: true });
  return { timer: null };
});

// --- reports ---
route('GET', '/api/report', ({ req, query }) => {
  const user = requireUser(req);
  const to = dateOr(query.get('to'), localDate());
  const from = dateOr(query.get('from'), addDays(to, -6));
  if (from > to) throw bad('The start of the range is after its end');

  const scope = query.get('scope') === 'team' ? 'team' : 'me';
  const userId = scope === 'team' ? null
    : (query.get('userId') ? int(query.get('userId'), { name: 'User' }) : user.id);
  return buildReport({ from, to, userId });
});

/**
 * What this person actually works on, for the Quick log chips.
 *
 * Ordered by recency then frequency rather than alphabetically, so the button
 * you want is usually the first one — which is the whole point of the screen.
 */
route('GET', '/api/suggestions', ({ req }) => {
  const user = requireUser(req);
  const since = addDays(localDate(), -30);

  const labels = all(`
    SELECT e.note AS note, e.project_id AS projectId, MAX(e.task_id) AS taskId,
           COUNT(*) AS uses, MAX(e.date) AS lastUsed
      FROM time_entries e
     WHERE e.user_id = ? AND e.date >= ? AND TRIM(e.note) <> ''
     GROUP BY lower(TRIM(e.note)), e.project_id
     ORDER BY MAX(e.date) DESC, uses DESC
     LIMIT 8`, user.id, since);

  // Projects this person has touched lately, most recent first. The client
  // shows these before the rest of the active list.
  const projects = all(`
    SELECT e.project_id AS projectId, SUM(e.minutes) AS minutes, MAX(e.date) AS lastUsed
      FROM time_entries e
     WHERE e.user_id = ? AND e.date >= ? AND e.project_id IS NOT NULL
     GROUP BY e.project_id
     ORDER BY MAX(e.date) DESC, minutes DESC`, user.id, since);

  return { labels, projects, since };
});

// --- users (admin) ---
route('GET', '/api/users', ({ req }) => {
  requireAdmin(req);
  return { users: all('SELECT * FROM users ORDER BY active DESC, name').map(userRow) };
});

route('POST', '/api/users', ({ req, body }) => {
  requireAdmin(req);
  const email = str(body.email, { name: 'Email', required: true, max: 190 }).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('That does not look like an email address');
  if (one('SELECT id FROM users WHERE lower(email) = ?', email)) throw bad('Someone already uses that email');

  const password = String(body.password || '');
  if (password.length < 10) throw bad('Password must be at least 10 characters');

  const now = nowISO();
  const res = run(`
    INSERT INTO users (email, name, role, password_hash, daily_target_minutes, week_start, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    email,
    str(body.name, { name: 'Name', required: true, max: 120 }),
    pick(body.role, ['admin', 'member'], { name: 'Role', dflt: 'member' }),
    hashPassword(password),
    int(body.dailyTargetMinutes ?? 480, { name: 'Daily target', min: 0, max: 24 * 60 }),
    int(body.weekStart ?? 1, { name: 'Week start', min: 0, max: 6 }),
    now, now,
  );
  return { user: userRow(one('SELECT * FROM users WHERE id = ?', Number(res.lastInsertRowid))) };
});

route('PATCH', '/api/users/:id', ({ req, body, params }) => {
  const admin = requireAdmin(req);
  const u = one('SELECT * FROM users WHERE id = ?', params.id);
  if (!u) throw new HttpError(404, 'User not found');

  const role = pick(body.role, ['admin', 'member'], { name: 'Role', dflt: u.role });
  const active = bool01(body.active, u.active);

  if (admin.id === u.id && !active) throw bad('You cannot deactivate yourself');

  // Guard against an admin locking the whole team out of administration.
  if ((role !== 'admin' || !active) && u.role === 'admin') {
    const others = one("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id <> ?", u.id).n;
    if (others === 0) throw bad('This is the last active admin — promote someone else first');
  }

  let passwordHash = u.password_hash;
  if (body.password) {
    if (String(body.password).length < 10) throw bad('Password must be at least 10 characters');
    passwordHash = hashPassword(String(body.password));
  }

  run(`UPDATE users SET name = ?, role = ?, active = ?, password_hash = ?,
         daily_target_minutes = ?, week_start = ?, updated_at = ? WHERE id = ?`,
    str(body.name, { name: 'Name', dflt: u.name, max: 120 }) || u.name,
    role, active, passwordHash,
    body.dailyTargetMinutes === undefined ? u.daily_target_minutes
      : int(body.dailyTargetMinutes, { name: 'Daily target', min: 0, max: 24 * 60 }),
    body.weekStart === undefined ? u.week_start : int(body.weekStart, { name: 'Week start', min: 0, max: 6 }),
    nowISO(), u.id,
  );

  // A deactivated or password-reset account should not keep live sessions.
  if (!active || body.password) run('DELETE FROM sessions WHERE user_id = ?', u.id);

  return { user: userRow(one('SELECT * FROM users WHERE id = ?', u.id)) };
});

// --- export ---
route('GET', '/api/export', ({ req }) => {
  const user = requireUser(req);
  const mine = user.role === 'admin' ? '' : `WHERE user_id = ${user.id}`;
  return {
    exportedAt: nowISO(),
    exportedBy: user.email,
    scope: user.role === 'admin' ? 'all' : 'own',
    timezone: APP_TIMEZONE,
    projects: listProjects(),
    tasks: listTasks({ includeArchived: true }),
    entries: all(`SELECT * FROM time_entries ${mine} ORDER BY date, id`).map(entryRow),
    users: user.role === 'admin' ? all('SELECT * FROM users ORDER BY id').map(userRow) : undefined,
  };
});

// ------------------------------------------------------------------- router

const compiled = routes.map((r) => {
  const names = [];
  const source = r.pattern.replace(/:([A-Za-z0-9_]+)/g, (_, n) => {
    names.push(n);
    return '([^/]+)';
  });
  return { ...r, re: new RegExp(`^${source}$`), names };
});

/**
 * Dispatch an /api/* request. Returns { status, body }, or null when no route
 * matches so the caller can fall through to static files.
 */
export async function handleApi(req, res, url, body, ip) {
  for (const r of compiled) {
    const m = url.pathname.match(r.re);
    if (!m) continue;
    if (r.method !== req.method) continue;

    const params = {};
    r.names.forEach((n, i) => { params[n] = m[i + 1]; });
    const out = await r.handler({ req, res, body, params, query: url.searchParams, ip });
    return { status: 200, body: out };
  }

  // Path exists under another verb — say so rather than 404.
  const methods = compiled.filter((r) => r.re.test(url.pathname)).map((r) => r.method);
  if (methods.length) throw new HttpError(405, `Use ${methods.join(' or ')} on this endpoint`);
  return null;
}
