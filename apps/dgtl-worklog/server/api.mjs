/**
 * DGTL Worklog — JSON API.
 *
 * Permission model, deliberately small:
 *   • everyone   — logs their own time, creates and edits tasks, reads team reports
 *   • admins     — additionally manage projects, manage users, and edit anyone's time
 *
 * Derived numbers (totals, completion %, what a shift or a day accounts for)
 * are computed here from time_entries on every read. Nothing derived is ever
 * stored.
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

// ------------------------------------------------------------ what a day owes
/**
 * The share of the day that is meant to be billable.
 *
 * `users.daily_target_minutes` says how LONG a day is meant to be, and it kept
 * that meaning — it is still the fallback denominator on a day nobody clocked
 * in for. What it never said is how much of that day is meant to reach an
 * invoice, and "8h logged" is the number an agency can hit while selling
 * nothing. This is the sibling: a percentage, because the honest denominator
 * on a day with attendance is the presence actually recorded, not a nominal
 * eight hours, and a target expressed in minutes would be measured against a
 * day that did not happen.
 *
 * It lives on `users.billable_target_pct`, defaulting to 60 — a starting
 * position rather than a measurement, being the utilisation figure agencies
 * plan against. This workspace's own share is 13%, which is exactly why the
 * ring had to stop measuring hours present.
 */

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

// ---------------------------------------------------------------- recurring
/**
 * Two rules, and deliberately only two.
 *
 * The list this was built for carries "Weekly progress note to Michael" twice —
 * Due Fri and Due 21 Aug, two rows typed a week apart — and the same shape
 * again for the monthly invoice reminder. Weekly and monthly are the whole of
 * the observed need. An RRULE parser for a three-person agency would be more
 * code than the app's entire task module to serve cases nobody has, and every
 * one of its extra fields would be another thing a reader has to check before
 * trusting a due date.
 */
const RECURRENCES = ['weekly', 'monthly'];

/** undefined leaves the rule alone; '' / null / 'none' clears it. */
const recurrenceOr = (v, dflt = null) => {
  if (v === undefined) return dflt;
  if (v === null || v === '' || v === 'none') return null;
  const s = String(v);
  if (!RECURRENCES.includes(s)) throw bad(`Repeat must be one of: ${RECURRENCES.join(', ')}`);
  return s;
};

/**
 * Same day next month, clamped to the month's length: 31 Jan → 28 Feb.
 *
 * Kept in calendar space like every other date helper — a YYYY-MM-DD in and a
 * YYYY-MM-DD out, no local midnight anywhere near it — so a DST step cannot
 * move a due date by a day.
 */
function addMonthsClamped(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

const stepDue = (date, rule) => (rule === 'monthly' ? addMonthsClamped(date, 1) : addDays(date, 7));

/**
 * When the next instance of a repeating task falls due.
 *
 * Stepped from the CURRENT due date, never from the day it was ticked off and
 * never from a stored counter: a Friday note stays on Friday however late it
 * was written, and the twelfth instance of a monthly is the eleventh stepped
 * once — not an accumulated offset that has drifted a day per year of DST.
 *
 * Then stepped again until it is past `after`. Without that, finishing three
 * weeks of notes in one sitting writes three instances that were already
 * overdue when they were created, and the series never catches up with the
 * calendar — a schedule permanently in the past has stopped being a schedule.
 * The catch-up keeps the phase: whole steps only, so it is still a Friday.
 *
 * The cap is a stop, not a rule. A due date a decade stale rolls forward as far
 * as it can and lands wherever that leaves it, which is visibly odd and
 * therefore correctable — a route that hung would not be.
 */
function nextDueDate(due, rule, after) {
  let d = stepDue(due, rule);
  for (let i = 0; i < 600 && d <= after; i++) d = stepDue(d, rule);
  return d;
}

/**
 * Write the next instance of a repeating task, and only what belongs on it.
 *
 * Carried over: everything that describes the WORK — title, notes, project,
 * assignee, estimate, priority, and the rule itself, so the series continues.
 *
 * Not carried, each for its own reason:
 *   • `done_at` — the new instance is not done, and reports count completions
 *     from that column.
 *   • logged time — it is not copied because it is not a column: entries point
 *     at the task they were worked on. Next week's note has been worked on for
 *     no minutes, and the estimate is what says how long it should take.
 *   • `position` — it goes to the top of the list exactly as a hand-typed task
 *     does. Inheriting the finished row's slot would file next week's work into
 *     the middle of a board somebody has dragged into an order.
 *   • `archived` — a series that spawned archived instances would be a rule for
 *     generating rows nobody sees.
 */
function spawnNextInstance(task, today = localDate()) {
  const now = nowISO();
  const top = one('SELECT COALESCE(MIN(position), 0) - 1 AS p FROM tasks').p;
  const res = run(`
    INSERT INTO tasks (project_id, title, notes, assignee_id, status, priority,
                       estimate_minutes, due_date, recurrence, position, done_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, NULL, ?, ?)`,
    task.project_id, task.title, task.notes, task.assignee_id, task.priority,
    task.estimate_minutes, nextDueDate(task.due_date, task.recurrence, today),
    task.recurrence, top, now, now,
  );
  return one('SELECT * FROM tasks WHERE id = ?', Number(res.lastInsertRowid));
}

/**
 * Minutes as people read them, for the inside of a refusal. The client has its
 * own `hm()`; a message that says "cannot bill 254 against 180" makes the
 * reader do the arithmetic that caused the refusal in the first place.
 */
const dur = (m) => {
  const n = Math.max(0, Math.round(m));
  const h = Math.floor(n / 60);
  const rest = n % 60;
  if (!h) return `${rest}m`;
  return rest ? `${h}h ${rest}m` : `${h}h`;
};

// ------------------------------------------------------------------ shaping

const projectRow = (p) => ({
  id: p.id, name: p.name, client: p.client, code: p.code, color: p.color,
  // `client` above is the CONTACT — see schema.sql. These two are who the work
  // is for, joined from `clients` rather than stored on the project, so a
  // rename lands everywhere at once.
  clientId: p.client_id ?? null,
  clientName: p.client_display_name ?? null,
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
  // null means "does not repeat". The next due date is NOT sent alongside it:
  // it is a function of this row's due date and this rule, so the client can
  // say it whenever it needs to, and a stale copy of it can never be shipped.
  recurrence: t.recurrence || null,
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
  // How long a day is, and how much of it is meant to reach an invoice. Two
  // settings because they answer two questions: a short day can still be a
  // fully billable one.
  billableTargetPct: u.billable_target_pct ?? 60,
});

const listProjects = () => all(`
  SELECT p.*,
         pc.client_id AS client_id,
         c.name       AS client_display_name,
         (SELECT COALESCE(SUM(minutes), 0) FROM time_entries te WHERE te.project_id = p.id) AS logged_minutes,
         (SELECT COALESCE(SUM(CASE WHEN te.billable = 1 THEN te.minutes ELSE 0 END), 0)
            FROM time_entries te WHERE te.project_id = p.id) AS billable_minutes,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status <> 'done' AND t.archived = 0) AS open_tasks,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS all_tasks
    FROM projects p
    LEFT JOIN project_clients pc ON pc.project_id = p.id
    LEFT JOIN clients c          ON c.id = pc.client_id
   ORDER BY p.status ASC, p.position ASC, p.id ASC
`).map(projectRow);

/** One project shaped exactly as the list shapes it — client join included. */
const oneProject = (id) => listProjects().find((p) => p.id === Number(id)) || null;

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

// ------------------------------------------------------------------ clients
// A client is who the work is for; `projects.client` is the contact you deal
// with. The two are different columns because they are different facts — see
// schema.sql.

/**
 * The account a code belongs to: everything before the first hyphen.
 * "111-A" → "111", "111" → "111", "" → null. The owner hand-authored this
 * hierarchy in `code` long before there was anywhere else to put it.
 */
const codeGroup = (code) => {
  const s = String(code || '').trim().toUpperCase();
  if (!s) return null;
  const i = s.indexOf('-');
  return i > 0 ? s.slice(0, i) : s;
};

// "The Piano Boutique — Account & Comms" → "The Piano Boutique".
// Only a separator with space either side counts, so a hyphenated name
// ("Jones-Baker Studio") is not cut in half.
const NAME_SEPARATOR = /\s+[—–·|:-]\s+/;

/**
 * Find a client by name, case-insensitively, or create it.
 *
 * Both sides are folded by SQLite, not one by SQLite and one by JavaScript:
 * `lower()` here is ASCII-only while JS `toLowerCase()` is not, so "ÉCOLE"
 * lowered in JS would miss a row the unique index still refuses to let in, and
 * the insert would 500 instead of matching. One case-folder, no disagreement.
 */
function clientIdFor(name, now = nowISO()) {
  const found = one('SELECT id FROM clients WHERE lower(name) = lower(?)', name);
  if (found) return found.id;
  return Number(run(
    'INSERT INTO clients (name, created_at, updated_at) VALUES (?, ?, ?)', name, now, now,
  ).lastInsertRowid);
}

/**
 * Drop clients nobody points at. A client exists only as the thing some
 * projects have in common, so the last project leaving takes it with it —
 * which is also what makes renaming work: retag the five projects one at a
 * time and the old name disappears on the fifth, instead of lingering as an
 * empty section for the rest of the workspace's life.
 */
const pruneClients = () =>
  run('DELETE FROM clients WHERE id NOT IN (SELECT client_id FROM project_clients)').changes;

/**
 * Point a project at a client by an ALREADY VALIDATED name; '' detaches it.
 *
 * Validation is the caller's, and deliberately: this runs after the project
 * row is written, so a name rejected in here would 400 a request that had
 * already created the project. `clientNameOr` is what the routes call first.
 */
function setProjectClient(projectId, name) {
  if (!name) run('DELETE FROM project_clients WHERE project_id = ?', projectId);
  else {
    run('INSERT OR REPLACE INTO project_clients (project_id, client_id) VALUES (?, ?)',
      projectId, clientIdFor(name));
  }
  pruneClients();
}

/** undefined (leave the client alone) or a checked name, before any write. */
const clientNameOr = (v) =>
  (v === undefined ? undefined : str(v, { name: 'Client', max: 120 }));

/**
 * Read the client structure out of the codes, once.
 *
 * The hierarchy was already authored by hand in `projects.code` — 111, 111-A,
 * 111-B, 111-C, 111-D — so the workspace does not have to be re-entered for
 * the board to group correctly on day one. Two rules keep the guess honest:
 *
 *   • A prefix earns a client only when two or more projects share it. A lone
 *     code (PLAT, JRNL, 222) is a tag, not an account, and inventing a client
 *     per project would replace one bad grouping with another.
 *   • The name comes off the parent project — the one whose code IS the prefix
 *     — cut at its first separator. "The Piano Boutique — Account & Comms"
 *     names the client "The Piano Boutique". With no parent to read, the
 *     prefix itself is used, which is visibly a placeholder rather than a
 *     plausible-looking wrong answer.
 *
 * It runs only while the clients table is empty, so it is a one-shot: after
 * this, clients are data the owner owns and nothing re-derives them from a
 * code they may since have changed. A project with no code — Cold Calls,
 * Office Time — gets no client, which is the right answer for internal work
 * and is shown as its own section rather than hidden.
 */
function deriveClientsFromCodes() {
  if (one('SELECT id FROM clients LIMIT 1')) return { created: 0, linked: 0 };

  const groups = new Map();
  for (const p of all('SELECT id, name, code FROM projects ORDER BY position ASC, id ASC')) {
    const g = codeGroup(p.code);
    if (!g) continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(p);
  }

  const seen = new Set();
  let linked = 0;
  tx(() => {
    const now = nowISO();
    for (const [g, members] of groups) {
      if (members.length < 2) continue;
      const parent = members.find((p) => String(p.code || '').trim().toUpperCase() === g);
      const head = String((parent || members[0]).name).split(NAME_SEPARATOR)[0].trim();
      const name = head.length >= 2 ? head : g;
      // Two prefixes can derive the same head ("TPB"); clientIdFor reuses the
      // row rather than tripping the unique index and aborting the boot.
      const clientId = clientIdFor(name, now);
      seen.add(name.toLowerCase());
      for (const m of members) {
        run('INSERT OR REPLACE INTO project_clients (project_id, client_id) VALUES (?, ?)', m.id, clientId);
        linked++;
      }
    }
  });
  return { created: seen.size, linked };
}

// On connect, before the first request is served. Idempotent by the guard
// above, so a restart is a no-op and a workspace whose clients have all been
// deleted is treated as one asking to be derived again.
const derivedClients = deriveClientsFromCodes();
if (derivedClients.created) {
  console.log(`Clients   derived ${derivedClients.created} from project codes, `
    + `${derivedClients.linked} projects linked`);
}

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
 *
 * Floored, not rounded, and the entry ends where the billed minutes end rather
 * than where the clock was stopped. Rounding billed a whole minute for any
 * stretch over thirty seconds, which nobody noticed while a chip re-labelled
 * instead of banking: one entry a session absorbed it. Now every chip tap
 * banks, so eight taps half a minute apart billed eight minutes inside four —
 * and the reconciliation could not report it, because it measures the window
 * and the window was honest. Flooring makes the claim and the window the same
 * fact, which is what lets an overrun be seen at all.
 */
function stopTimer(userId, { discard = false } = {}) {
  const t = one('SELECT * FROM timers WHERE user_id = ?', userId);
  if (!t) return null;

  const startedMs = new Date(t.started_at).getTime();
  const minutes = Math.floor((Date.now() - startedMs) / 60000);
  const endedAt = new Date(startedMs + minutes * 60000);

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

// ------------------------------------------------------------------- shifts

/**
 * Every shift belonging to a person's day, oldest first — clocking out for
 * lunch and back in is two of them, and reporting only the newest hid the
 * morning and its gap behind the afternoon. An open shift is always included
 * whatever day it began on, and a shift that began yesterday and ended this
 * morning belongs to both, which is why the range is widened by a day and then
 * filtered on the local dates shiftView derives.
 */
const shiftsForDay = (userId, today) => all(
  `SELECT * FROM shifts
    WHERE user_id = ? AND (ended_at IS NULL OR date BETWEEN ? AND ?)
    ORDER BY started_at ASC, id ASC`, userId, addDays(today, -1), today,
).map(shiftView).filter((s) => s.open || s.date === today || s.endedDate === today);

/**
 * Reconcile a shift against the work filed inside it. Computed on every read
 * and never stored, so an entry corrected three weeks later moves these
 * numbers exactly the way it moves a budget bar.
 *
 * A time entry accounts for presence up to the span it actually covers inside
 * the shift, and no further than the minutes it claims — min(claimed,
 * covered). That clamp is what makes present >= attributed true by
 * construction rather than by care: covered spans cannot overlap each other
 * (one timer per person, and opening one banks the last), so they cannot sum
 * past the window that contains them, whichever way an entry is edited after.
 *
 * That clamp is also why attributed alone is not a gap report. It can only
 * ever point one way — it is structurally incapable of saying the timesheet
 * bills MORE than the presence, which is the direction that reaches a client.
 * So the claim is counted a second time, unclamped, and the overrun stated.
 */
function shiftView(s) {
  if (!s) return null;
  const start = Date.parse(s.started_at);
  const end = s.ended_at ? Date.parse(s.ended_at) : Date.now();
  const endISO = s.ended_at || new Date(end).toISOString();

  // Timer segments only. A manual block carries no window, so nothing places it
  // inside the presence — it is reported apart, at the level of the day, rather
  // than silently swelling one shift's gap.
  let attributedMs = 0;
  let claimedMs = 0;
  for (const e of all(`
    SELECT minutes, started_at, ended_at FROM time_entries
     WHERE user_id = ? AND started_at IS NOT NULL AND ended_at IS NOT NULL
       AND started_at < ? AND ended_at > ?`, s.user_id, endISO, s.started_at)) {
    const covered = Math.min(Date.parse(e.ended_at), end) - Math.max(Date.parse(e.started_at), start);
    if (covered <= 0) continue;
    attributedMs += Math.min(e.minutes * 60000, covered);
    // What the timesheet bills for this stretch, counted against this presence:
    // the part with a clock behind it, clamped to the overlap, PLUS any part
    // claiming more minutes than its own window ever ran for. A stretch that
    // merely straddles clock-in is not an overclaim — its far half is real work
    // in another part of the day — so only the unbacked excess crosses over.
    //
    // And the excess is counted by exactly one shift: the one holding the
    // instant the stretch began, the same rule that decides which day it files
    // under. Minutes claimed with no clock behind them have no position in
    // time, so a stretch worked through lunch would otherwise hand the whole
    // of its excess to the morning AND the afternoon and report it twice.
    const unbacked = Math.max(0, e.minutes * 60000 - (Date.parse(e.ended_at) - Date.parse(e.started_at)));
    const beganHere = Date.parse(e.started_at) >= start && Date.parse(e.started_at) < end;
    claimedMs += Math.min(e.minutes * 60000, covered) + (beganHere ? unbacked : 0);
  }

  // The running timer has not written its entry yet. Counting the part of it
  // that falls inside the shift is what holds the gap still while a clock is
  // running, instead of growing it a minute a minute against work plainly
  // being done — and it is zero at clock-out, which banks first.
  const t = one('SELECT started_at FROM timers WHERE user_id = ?', s.user_id);
  if (t) {
    const covered = Math.min(Date.now(), end) - Math.max(Date.parse(t.started_at), start);
    if (covered > 0) { attributedMs += covered; claimedMs += covered; }
  }

  const presentMinutes = Math.max(0, Math.round((end - start) / 60000));
  // The min is unreachable through any route, because no route can produce two
  // overlapping segments. It is here so a hand-edited database reports a gap of
  // zero rather than a negative one that would read as time owed back.
  const attributedMinutes = Math.min(presentMinutes, Math.round(attributedMs / 60000));
  const claimedMinutes = Math.round(claimedMs / 60000);

  return {
    id: s.id,
    // Whose presence this is. A team-scoped range comes back as one list, and
    // a spell nobody can be named against is one no reader can act on — nor
    // can a screen tell whether the correction buttons are theirs to press.
    userId: s.user_id,
    date: s.date, endedDate: s.ended_at ? localDate(new Date(end)) : null,
    startedAt: s.started_at, endedAt: s.ended_at,
    note: s.note, open: !s.ended_at,
    presentMinutes,
    attributedMinutes,
    unattributedMinutes: presentMinutes - attributedMinutes,
    // What this presence bills, and by how much it bills more than there was
    // presence to bill. Zero on every well-formed shift; above zero it is the
    // only number here that a client would ever argue with.
    claimedMinutes,
    overclaimedMinutes: Math.max(0, claimedMinutes - presentMinutes),
  };
}

/**
 * The same reconciliation, one level up: a whole local day instead of one
 * spell of it.
 *
 * Per-shift figures cannot see the ground between two shifts. An entry whose
 * window runs past a clock-out and into the hour before the next clock-in is
 * counted, by each spell, only for the part that spell contained — correctly —
 * and the part belonging to neither is counted by nobody. That hour is how a
 * DAY comes to bill more than it was present for while every spell on it
 * reports no overclaim, and it is also the hour a stretch clocked entirely
 * outside every shift lives in: not attributed, not open, not unplaced, named
 * nowhere. One computation answers both, so the two figures cannot drift.
 *
 * Presence is the UNION of the day's shifts — they cannot overlap through any
 * route, and merging means a hand-edited pair still cannot count one minute
 * twice. The claim is every WINDOWED entry that began on this date: a manual
 * block has no window, so nothing places it inside or outside a shift, and it
 * stays reported apart as `unplacedMinutes`. Filed by the instant a stretch
 * began, the same rule that decides the day it files under, so a stretch is
 * counted by exactly one day however far past midnight it runs.
 *
 * The running timer is left out. It has written no entry yet, and counting a
 * claim that does not exist could only ever invent an accusation.
 */
function dayView(userId, date) {
  const union = [];
  for (const w of all(
    'SELECT started_at, ended_at FROM shifts WHERE user_id = ? AND date = ? ORDER BY started_at ASC',
    userId, date,
  ).map((s) => ({ from: Date.parse(s.started_at), to: s.ended_at ? Date.parse(s.ended_at) : Date.now() }))) {
    const last = union[union.length - 1];
    if (last && w.from <= last.to) last.to = Math.max(last.to, w.to);
    else union.push(w);
  }
  const presenceMinutes = Math.round(union.reduce((n, w) => n + (w.to - w.from), 0) / 60000);

  // Widened by a day either side and then filed exactly, the same shape
  // completedBetween uses: no zone offset anywhere is a whole day, so the SQL
  // can only ever over-select, and localDate() decides.
  let claimedMinutes = 0;
  let offShiftMinutes = 0;
  for (const e of all(`
    SELECT minutes, started_at, ended_at FROM time_entries
     WHERE user_id = ? AND started_at IS NOT NULL AND ended_at IS NOT NULL
       AND started_at >= ? AND started_at < ?`,
  userId, `${addDays(date, -1)}T00:00:00.000Z`, `${addDays(date, 2)}T00:00:00.000Z`)) {
    const from = Date.parse(e.started_at);
    if (localDate(new Date(from)) !== date) continue;
    claimedMinutes += e.minutes;
    const to = Date.parse(e.ended_at);
    const inside = union.reduce((n, w) => n + Math.max(0, Math.min(to, w.to) - Math.max(from, w.from)), 0);
    // Zero overlap, not partial: a stretch that merely runs past a clock-out
    // has a real half inside the presence, and calling the whole of it
    // "while nobody was clocked in" would be a bigger lie than saying nothing.
    if (inside === 0) offShiftMinutes += e.minutes;
  }

  return { presenceMinutes, claimedMinutes, offShiftMinutes };
}

/** What a day bills beyond what it was present for. Zero on a well-formed day. */
const dayOverclaim = (d) => Math.max(0, d.claimedMinutes - d.presenceMinutes);

/**
 * The same presence, laid out end to end instead of summed: every stretch of a
 * shift in order, each of them either work with a clock behind it or open time
 * nothing accounts for. This is what the reconciliation sheet draws, and it is
 * computed from the same windows shiftView reconciles, on every read — a sheet
 * opened again after an entry is corrected shows a different and equally
 * correct day.
 *
 * Two rounding rules, and they are not the same rule twice:
 *   • a work stretch is ROUNDED, because the figure is describing something
 *     that already happened.
 *   • a gap is FLOORED, because the figure is a promise: `openMinutes` is
 *     exactly what a disposition would write into it, and a gap rounded up
 *     would offer a minute the day did not contain.
 *
 * Overlapping stretches — only reachable by editing the database by hand —
 * appear as the two rows they are, and the gaps are computed off their MERGED
 * coverage so the same minute is never offered for disposal twice.
 */
function shiftSegments(s) {
  const start = Date.parse(s.started_at);
  const end = s.ended_at ? Date.parse(s.ended_at) : Date.now();
  const endISO = s.ended_at || new Date(end).toISOString();

  const covered = [];
  for (const e of all(`
    SELECT e.*, p.name AS project_name, p.color AS project_color, t.title AS task_title
      FROM time_entries e
      LEFT JOIN projects p ON p.id = e.project_id
      LEFT JOIN tasks    t ON t.id = e.task_id
     WHERE e.user_id = ? AND e.started_at IS NOT NULL AND e.ended_at IS NOT NULL
       AND e.started_at < ? AND e.ended_at > ?
     ORDER BY e.started_at ASC, e.id ASC`, s.user_id, endISO, s.started_at)) {
    const from = Math.max(Date.parse(e.started_at), start);
    const to = Math.min(Date.parse(e.ended_at), end);
    if (to <= from) continue;
    covered.push({
      kind: 'work', from, to,
      minutes: Math.round((to - from) / 60000),
      entryId: e.id, projectId: e.project_id, projectName: e.project_name,
      projectColor: e.project_color, taskTitle: e.task_title, note: e.note,
      billable: !!e.billable, source: e.source,
      // What the whole entry bills, and how long its whole window ran for. They
      // differ only where an entry has been edited away from its own clock, and
      // that difference IS the overclaim — stated on the row that causes it
      // instead of only in the total at the top, where nobody can act on it.
      claimsMinutes: e.minutes,
      spanMinutes: Math.round((Date.parse(e.ended_at) - Date.parse(e.started_at)) / 60000),
    });
  }

  // The clock still running has written no entry yet, so it is not in the query
  // above — but it is plainly the current stretch, and leaving it out would
  // show the last few minutes of an open shift as a gap.
  const t = one(`
    SELECT tm.*, p.name AS project_name, p.color AS project_color, tk.title AS task_title
      FROM timers tm
      LEFT JOIN projects p  ON p.id = tm.project_id
      LEFT JOIN tasks    tk ON tk.id = tm.task_id
     WHERE tm.user_id = ?`, s.user_id);
  if (t) {
    const from = Math.max(Date.parse(t.started_at), start);
    const to = Math.min(Date.now(), end);
    if (to > from) {
      covered.push({
        kind: 'running', from, to, minutes: Math.round((to - from) / 60000),
        entryId: null, projectId: t.project_id, projectName: t.project_name,
        projectColor: t.project_color, taskTitle: t.task_title, note: t.note,
        billable: !!t.billable, source: 'timer',
        claimsMinutes: Math.round((to - from) / 60000),
        spanMinutes: Math.round((to - from) / 60000),
      });
    }
  }

  // One walk in start order, and the cursor only ever moves forward: a stretch
  // that overlaps the one before it — reachable by editing the database, and
  // nothing else — leaves the cursor where the later end already put it, so the
  // same minute is never offered for disposal twice and no gap comes out
  // negative. A separate merge pass ahead of this did exactly the same thing
  // twice, which is why removing it changed no number anywhere.
  const gaps = [];
  let cursor = start;
  for (const c of [...covered].sort((a, b) => a.from - b.from)) {
    if (c.from > cursor) gaps.push({ kind: 'gap', from: cursor, to: c.from });
    cursor = Math.max(cursor, c.to);
  }
  if (cursor < end) gaps.push({ kind: 'gap', from: cursor, to: end });
  for (const g of gaps) g.minutes = Math.floor((g.to - g.from) / 60000);

  const segments = [...covered, ...gaps].sort((a, b) => a.from - b.from || a.to - b.to);
  return {
    segments: segments.map(({ from, to, ...rest }) => ({
      ...rest, from: new Date(from).toISOString(), to: new Date(to).toISOString(),
    })),
    gaps,
    openMinutes: gaps.reduce((n, g) => n + g.minutes, 0),
  };
}

/**
 * The clock-out sheet: what the day was, and what of it is still open.
 *
 * `openMinutes` is not always the same number as `unattributedMinutes`, and the
 * difference is the point. Unattributed presence is what the timesheet fails to
 * BILL for; open time is presence no clock ever COVERED. An entry trimmed from
 * an hour to ten minutes leaves fifty minutes that are unattributed and yet not
 * open — nothing can be filed into them, because a stretch already sits there.
 * `shortfallMinutes` names that remainder rather than letting the sheet's rows
 * quietly disagree with the figure at the top of it.
 */
function shiftSheet(s) {
  const shift = shiftView(s);
  const { segments, gaps, openMinutes } = shiftSegments(s);
  // Measured against the gaps' real length, not against `openMinutes`. Those
  // are floored, so a day ending fifty-three seconds into a gap would leave one
  // minute over and this figure would announce a stretch billing less than it
  // ran — inventing an accusation out of rounding.
  const openExact = Math.round(gaps.reduce((n, g) => n + (g.to - g.from), 0) / 60000);
  return {
    shift,
    segments,
    openMinutes,
    shortfallMinutes: Math.max(0, shift.presentMinutes - shift.attributedMinutes - openExact),
    // Blocks logged by hand on the day this shift began. They carry no start
    // and end, so nothing can place them inside this presence — the sheet says
    // so rather than leaving someone to wonder where their afternoon went.
    unplacedMinutes: one(`
      SELECT COALESCE(SUM(minutes), 0) AS minutes FROM time_entries
       WHERE user_id = ? AND date = ? AND (started_at IS NULL OR ended_at IS NULL)`,
      s.user_id, s.date).minutes,
    // The day this spell sits in, because two of the things a reader needs are
    // facts about the day and not about the spell: work that ran while nobody
    // was clocked in at all, and a day billing past its own presence while
    // every spell on it reconciles.
    day: dayView(s.user_id, s.date),
  };
}

// ------------------------------------------------------------------ reports

/* The streak — days in a row with any time logged — was removed from here and
   from every screen. It measures showing up, not selling: a figure this
   workspace could hold at 100 while billing 13% of it, which is the same
   argument that took it off the Today screen. The trailing-90-day heatmap on
   the Reports screen shows consistency better than one integer, and it is
   still here. */

/**
 * Tasks finished inside a calendar range — the one definition, used by the
 * report's KPI and by the client digest, so the two cannot disagree about what
 * "completed this week" means while sitting on the same screen.
 *
 * `done_at` is an ISO instant and every other date in this app is a calendar
 * date in APP_TIMEZONE, so the comparison has to cross between them. SQLite's
 * date() reads that instant as UTC: a task ticked off at 21:00 on Sunday in
 * Toronto is 01:00 Monday in UTC, and a UTC-dated filter files it into next
 * week — which is a report that is right in the morning and wrong in the
 * evening. The SQL therefore only WIDENS by a day either side (no offset
 * anywhere is a whole day), and the calendar date each row actually files under
 * is computed with the same localDate() everything else uses.
 */
function completedBetween({ from, to, assigneeId = null, projectIds = null }) {
  const where = ['t.archived = 0', "t.status = 'done'", 't.done_at IS NOT NULL',
    'date(t.done_at) BETWEEN ? AND ?'];
  const params = [addDays(from, -1), addDays(to, 1)];
  if (assigneeId) { where.push('t.assignee_id = ?'); params.push(assigneeId); }
  if (projectIds) {
    if (!projectIds.length) return [];
    where.push(`t.project_id IN (${projectIds.map(() => '?').join(',')})`);
    params.push(...projectIds);
  }
  return all(`
    SELECT t.*, p.name AS project_name, p.color AS project_color, u.name AS assignee_name,
           (SELECT COALESCE(SUM(minutes), 0) FROM time_entries te WHERE te.task_id = t.id) AS logged_minutes
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN users    u ON u.id = t.assignee_id
     WHERE ${where.join(' AND ')}
     ORDER BY t.done_at ASC, t.id ASC`, ...params)
    .map((t) => ({ ...t, done_date: localDate(new Date(t.done_at)) }))
    .filter((t) => t.done_date >= from && t.done_date <= to);
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
      SUM(CASE WHEN t.status <> 'done' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN t.status <> 'done' AND t.due_date IS NOT NULL AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue
    FROM tasks t WHERE t.archived = 0 ${taskScope}`,
    ...[to, ...(userId ? [userId] : [])])[0];
  // Counted through the shared helper rather than in the query above, because
  // done_at is an instant and this range is calendar dates — see the comment on
  // completedBetween. Inline, this KPI read a UTC date and disagreed with the
  // digest beside it for the last few hours of every day.
  const tasksDone = completedBetween({ from, to, assigneeId: userId }).length;

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
    tasks: { done: tasksDone, open: tasks.open ?? 0, overdue: tasks.overdue ?? 0 },
    heatmap: { from: heatFrom, to, days: heatmap },
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
    // How much of the day is meant to reach an invoice. Sent rather than
    // assumed by the client, so the migration that makes it per-person moves
    // one expression on the server and nothing on the screen.
    billableTargetPct: user.billableTargetPct,
    weekStartDate: startOfWeek(today, user.weekStart),
    users: all('SELECT * FROM users WHERE active = 1 ORDER BY name').map(userRow),
    projects: listProjects(),
    unassigned: unassignedTotals(),
    tasks: listTasks(),
    timer: runningTimer(user.id),
    // Attendance runs alongside the timer, never instead of it — the client has
    // to know on a cold start whether this person is on the clock at all. All
    // of the day's shifts, because clocking out for lunch makes two.
    shifts: shiftsForDay(user.id, today),
    // Blocks logged by hand today. They carry no start and end, so nothing can
    // place them inside any one shift — reporting them per shift let two
    // shifts on a date each claim the same block as their own, and measured
    // them against a presence they were never inside. They belong to the day.
    unplacedMinutes: one(`
      SELECT COALESCE(SUM(minutes), 0) AS minutes FROM time_entries
       WHERE user_id = ? AND date = ? AND (started_at IS NULL OR ended_at IS NULL)`,
      user.id, today).minutes,
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
  const billablePct = body.billableTargetPct === undefined ? row.billable_target_pct
    : int(body.billableTargetPct, { name: 'Billable target', min: 0, max: 100 });

  let passwordHash = row.password_hash;
  if (body.newPassword) {
    if (!verifyPassword(String(body.currentPassword || ''), row.password_hash)) {
      throw bad('Current password is incorrect');
    }
    if (String(body.newPassword).length < 10) throw bad('New password must be at least 10 characters');
    passwordHash = hashPassword(String(body.newPassword));
  }

  run(`UPDATE users SET name = ?, daily_target_minutes = ?, billable_target_pct = ?, week_start = ?,
         password_hash = ?, updated_at = ? WHERE id = ?`,
    name, target, billablePct, weekStart, passwordHash, nowISO(), user.id);
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
  // Checked before the INSERT: rejecting it afterwards would 400 a request
  // that had already created the project.
  const clientName = clientNameOr(body.clientName);
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
  const id = Number(res.lastInsertRowid);
  // The client rides on the project rather than getting its own endpoint: a
  // client with no projects is not a thing this app has any use for, so it is
  // always created and always retired as a side effect of one.
  if (clientName !== undefined) setProjectClient(id, clientName);
  return { project: oneProject(id) };
});

route('PATCH', '/api/projects/:id', ({ req, body, params }) => {
  requireAdmin(req);
  const p = one('SELECT * FROM projects WHERE id = ?', params.id);
  if (!p) throw new HttpError(404, 'Project not found');
  const clientName = clientNameOr(body.clientName);   // before the UPDATE, as above

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
  if (clientName !== undefined) setProjectClient(p.id, clientName);
  return { project: oneProject(p.id) };
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
  // The link row went with it (ON DELETE CASCADE); this retires the client if
  // that was the last project holding it up.
  const droppedClients = pruneClients();
  return { ok: true, detachedTasks: t.n, detachedOpenTasks: t.open, droppedClients };
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
  const dueDate = dateOr(body.dueDate, null);
  const recurrence = recurrenceOr(body.recurrence);
  // A rule steps FROM a due date. With none there is nothing to step, and the
  // only remaining answer would be to invent one off the day it was ticked —
  // which is how a Friday note becomes a Tuesday note. Refused at both ends
  // instead, so a task can never sit in the database carrying a rule it cannot
  // execute.
  if (recurrence && !dueDate) throw bad('A repeating task needs a due date — that is what it repeats from');

  const status = pick(body.status, ['todo', 'doing', 'done'], { name: 'Status', dflt: 'todo' });
  const res = run(`
    INSERT INTO tasks (project_id, title, notes, assignee_id, status, priority,
                       estimate_minutes, due_date, recurrence, position, done_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    int(body.projectId, { name: 'Project', nullable: true }),
    str(body.title, { name: 'Task title', required: true, max: 200 }),
    str(body.notes, { name: 'Notes', max: 4000 }),
    body.assigneeId === undefined ? user.id : int(body.assigneeId, { name: 'Assignee', nullable: true }),
    status,
    pick(body.priority, ['low', 'normal', 'high'], { name: 'Priority', dflt: 'normal' }),
    int(body.estimateMinutes, { name: 'Estimate', min: 0, max: 10 ** 6, nullable: true }),
    dueDate, recurrence,
    next,
    // Stamped here as well as on the PATCH transition. Filed as done — which is
    // how work already finished gets recorded, and how an importer writes
    // history — this column was left NULL, and every "completed this week"
    // count in the app reads it, so the task was done and counted nowhere.
    status === 'done' ? now : null,
    now, now,
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
  const dueDate = body.dueDate === undefined ? t.due_date : dateOr(body.dueDate, null);
  const recurrence = recurrenceOr(body.recurrence, t.recurrence || null);
  const archived = bool01(body.archived, t.archived);
  if (recurrence && !dueDate) throw bad('A repeating task needs a due date — that is what it repeats from');

  // A rule fires on the CROSSING into done, not on the state. Without the first
  // clause every later edit of a finished task — retagging it, fixing a typo —
  // would send the same PATCH with status still 'done' and mint another
  // instance, which is precisely the duplicate this feature exists to stop.
  const completing = t.status !== 'done' && status === 'done' && !!recurrence && !archived;

  return tx(() => {
    run(`UPDATE tasks SET project_id = ?, title = ?, notes = ?, assignee_id = ?, status = ?,
           priority = ?, estimate_minutes = ?, due_date = ?, recurrence = ?, position = ?, archived = ?,
           done_at = ?, updated_at = ? WHERE id = ?`,
      body.projectId === undefined ? t.project_id : int(body.projectId, { name: 'Project', nullable: true }),
      str(body.title, { name: 'Task title', dflt: t.title, max: 200 }) || t.title,
      body.notes === undefined ? t.notes : str(body.notes, { name: 'Notes', max: 4000 }),
      body.assigneeId === undefined ? t.assignee_id : int(body.assigneeId, { name: 'Assignee', nullable: true }),
      status,
      pick(body.priority, ['low', 'normal', 'high'], { name: 'Priority', dflt: t.priority }),
      body.estimateMinutes === undefined ? t.estimate_minutes
        : int(body.estimateMinutes, { name: 'Estimate', min: 0, max: 10 ** 6, nullable: true }),
      dueDate, recurrence,
      body.position === undefined ? t.position : int(body.position, { name: 'Position', min: -(10 ** 6) }),
      archived,
      doneAt, nowISO(), t.id,
    );
    const saved = one('SELECT * FROM tasks WHERE id = ?', t.id);
    // Built from the row as it now stands, not as it arrived: an estimate
    // corrected in the same breath as ticking the box is the estimate the next
    // instance should carry.
    //
    // Reopening one does NOT retract the instance it spawned. Two rows would
    // then be the same week's work, which is the mess this replaced — but
    // deleting a row somebody may already have logged hours against, to undo a
    // tick, is worse. The one to delete is the one you can see; the app offers
    // that, and this does not guess.
    const next = completing ? spawnNextInstance(saved) : null;
    return { task: taskRow(saved), next: next ? taskRow(next) : null };
  });
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

  // A stretch with a clock behind it is filed by its window, not by this
  // column — that is what makes midnight and DST reconcile — so moving the date
  // alone would leave the row on one day and its attendance on another, and the
  // strip and the KPI above it would read different totals for the same work.
  // Refused rather than fixed up: shifting the window silently is a bigger
  // change than the reader asked for, and this app does not store an answer it
  // can derive.
  const date = dateOr(body.date, e.date);
  if (e.started_at && date !== e.date) {
    throw bad(`That stretch's clock ran on ${localDate(new Date(Date.parse(e.started_at)))}, so it `
      + 'is filed there. Correct the times it ran, or log it again on the day you meant.');
  }

  run(`UPDATE time_entries SET project_id = ?, task_id = ?, date = ?, minutes = ?, note = ?,
         billable = ?, updated_at = ? WHERE id = ?`,
    body.projectId === undefined ? e.project_id : int(body.projectId, { name: 'Project', nullable: true }),
    body.taskId === undefined ? e.task_id : int(body.taskId, { name: 'Task', nullable: true }),
    date,
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
  const prev = one('SELECT started_at FROM timers WHERE user_id = ?', user.id);
  // Starting a second timer banks the first rather than losing it.
  const banked = stopTimer(user.id);

  // The new stretch picks up exactly where the last one's BILLED minutes ended,
  // not at this instant. The seconds the floor above left behind are still work
  // — they carry into what was tapped next instead of being thrown away, and
  // the entries end up tiling the session end to end with nothing lost between
  // them. When the interrupted stretch was too short to bank at all, that is
  // the whole of it: those seconds move to the new project rather than billing
  // a full minute to one nobody worked a minute on.
  const resume = banked ? banked.ended_at : (prev ? prev.started_at : nowISO());

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
    resume,
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

// --- shifts: attendance, which is not a timer ---
route('POST', '/api/shift/in', ({ req, body }) => {
  const user = requireUser(req);
  if (one('SELECT id FROM shifts WHERE user_id = ? AND ended_at IS NULL', user.id)) {
    throw bad('You are already clocked in — clock out first');
  }

  const startedAt = nowISO();
  try {
    run('INSERT INTO shifts (user_id, date, started_at, note) VALUES (?, ?, ?, ?)',
      user.id, localDate(new Date(startedAt)), startedAt, str(body.note, { name: 'Note', max: 500 }));
  } catch (err) {
    // The same refusal arriving from the partial unique index instead, when two
    // taps race the check above. The index is the rule; this is its manners.
    if (/UNIQUE/i.test(String(err.message))) throw bad('You are already clocked in — clock out first');
    throw err;
  }
  return { shift: shiftView(one('SELECT * FROM shifts WHERE user_id = ? AND ended_at IS NULL', user.id)) };
});

route('POST', '/api/shift/out', ({ req }) => {
  const user = requireUser(req);
  const s = one('SELECT * FROM shifts WHERE user_id = ? AND ended_at IS NULL', user.id);
  if (!s) throw new HttpError(404, 'You are not clocked in');

  // Banked before the shift closes, so the segment ends no later than the
  // presence containing it. A timer left running past clock-out would go on
  // counting time nobody was here for, and none of it could be attributed.
  const banked = stopTimer(user.id);
  run('UPDATE shifts SET ended_at = ? WHERE id = ?', nowISO(), s.id);
  return {
    shift: shiftView(one('SELECT * FROM shifts WHERE id = ?', s.id)),
    banked: banked ? entryRow(banked) : null,
  };
});

/**
 * Attendance over a range. PATCH and DELETE take an id, and the bootstrap
 * payload only ever carries today's — so without this, a clock-out forgotten
 * last Tuesday has an id nothing can tell you, and stays wrong forever.
 * Same scoping rules as /api/entries, down to validating the user id rather
 * than coercing it.
 */
route('GET', '/api/shifts', ({ req, query }) => {
  const user = requireUser(req);
  const to = dateOr(query.get('to'), localDate());
  const from = dateOr(query.get('from'), addDays(to, -30));
  const scope = query.get('scope') === 'team' ? 'team' : 'me';
  const asked = query.get('userId');
  const userId = scope === 'team' ? null : (asked ? int(asked, { name: 'User', min: 1 }) : user.id);

  const rows = userId
    ? all('SELECT * FROM shifts WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY started_at DESC, id DESC',
      userId, from, to)
    : all('SELECT * FROM shifts WHERE date BETWEEN ? AND ? ORDER BY started_at DESC, id DESC', from, to);
  return { shifts: rows.map(shiftView), range: { from, to } };
});

/**
 * One shift, laid out — the artefact the owner reads to answer "what did I do
 * today". Readable by anyone signed in, the same as every other person's
 * entries and reports already are; filling the gap is not, below.
 */
route('GET', '/api/shift/:id', ({ req, params }) => {
  requireUser(req);
  const s = one('SELECT * FROM shifts WHERE id = ?', params.id);
  if (!s) throw new HttpError(404, 'Shift not found');
  return shiftSheet(s);
});

/** ISO instant, validated. Shifts are the one place the client sends one. */
const instant = (v, { name }) => {
  const ms = Date.parse(String(v));
  if (Number.isNaN(ms)) throw bad(`${name} is not a valid date and time`);
  return new Date(ms).toISOString();
};

const MAX_SHIFT_MS = 24 * 60 * 60000;

/**
 * Correct a shift after the fact. Time entries have always been editable and
 * the whole read-time reconciliation leans on that; the presence they are
 * measured against was write-once, so a clock-out forgotten overnight reported
 * nineteen hours with no cap, no warning and no way back short of raw SQL.
 */
route('PATCH', '/api/shift/:id', ({ req, body, params }) => {
  const user = requireUser(req);
  const s = one('SELECT * FROM shifts WHERE id = ?', params.id);
  if (!s) throw new HttpError(404, 'Shift not found');
  if (!canEditFor(user, s.user_id)) throw new HttpError(403, 'You can only edit your own attendance');

  const startedAt = body.startedAt === undefined ? s.started_at : instant(body.startedAt, { name: 'Start' });
  // null reopens a shift; undefined leaves it as it was.
  const endedAt = body.endedAt === undefined ? s.ended_at
    : (body.endedAt === null ? null : instant(body.endedAt, { name: 'End' }));

  if (endedAt) {
    if (Date.parse(endedAt) <= Date.parse(startedAt)) throw bad('A shift has to end after it starts');
    if (Date.parse(endedAt) - Date.parse(startedAt) > MAX_SHIFT_MS) throw bad('A shift cannot run longer than 24 hours');
  }
  // Reopening one while another is open leaves this person clocked in twice,
  // which the partial unique index refuses anyway — said plainly here instead.
  if (!endedAt && one('SELECT id FROM shifts WHERE user_id = ? AND ended_at IS NULL AND id <> ?', s.user_id, s.id)) {
    throw bad('Another shift is still open — close that one first');
  }
  // Presence cannot happen twice at once. Overlapping shifts would let the same
  // minute be reconciled against both and counted as covered in each.
  const clash = one(`
    SELECT id FROM shifts
     WHERE user_id = ? AND id <> ?
       AND started_at < ? AND COALESCE(ended_at, ?) > ?`,
    s.user_id, s.id,
    endedAt || new Date(Date.parse(startedAt) + MAX_SHIFT_MS).toISOString(),
    new Date(Date.now() + MAX_SHIFT_MS).toISOString(), startedAt);
  if (clash) throw bad('That overlaps another shift already on this day');

  run('UPDATE shifts SET started_at = ?, ended_at = ?, date = ?, note = ? WHERE id = ?',
    startedAt, endedAt, localDate(new Date(startedAt)),
    body.note === undefined ? s.note : str(body.note, { name: 'Note', max: 500 }),
    s.id);
  return { shift: shiftView(one('SELECT * FROM shifts WHERE id = ?', s.id)) };
});

route('DELETE', '/api/shift/:id', ({ req, params }) => {
  const user = requireUser(req);
  const s = one('SELECT * FROM shifts WHERE id = ?', params.id);
  if (!s) throw new HttpError(404, 'Shift not found');
  if (!canEditFor(user, s.user_id)) throw new HttpError(403, 'You can only delete your own attendance');
  // No entry references a shift, so removing one drops a record of presence and
  // not a minute of anybody's logged work.
  run('DELETE FROM shifts WHERE id = ?', s.id);
  return { ok: true };
});

/**
 * Account for the open time in a shift, in one call.
 *
 * The gap is disposed of by writing ORDINARY time entries — one per stretch of
 * presence nothing covers, each with a real start and end. There is no second
 * kind of row here and no flag saying "this was a gap": whatever the reports,
 * the budgets and the timesheet already do with an hour, they do with this one.
 * An overhead bucket is likewise an ordinary project that happens to be flagged
 * non-billable, which is why the entry takes its billable flag FROM the project
 * rather than from the caller — the whole value of putting an afternoon against
 * "Admin" is that the billable-share figure already knows what that means.
 *
 * Three refusals, and each of them is a fact the sheet is already showing:
 *   • an open shift has a gap that is still growing, so there is nothing
 *     settled to fill.
 *   • a gap already filled has nothing left in it — the second click of a
 *     double click writes nothing rather than a second hour.
 *   • and the one that matters: filling the gap must not be able to make the
 *     day bill more than it contained. Every stretch written here bills exactly
 *     the window it holds and lands where nothing else does, so it cannot
 *     overclaim on its own — but a day already carrying an entry that bills
 *     more minutes than its clock ran has no room left to give, and the check
 *     is a recomputation inside the transaction rather than arithmetic that
 *     could drift from the one shiftView does.
 */
route('POST', '/api/shift/:id/dispose', ({ req, body, params }) => {
  const user = requireUser(req);
  const s = one('SELECT * FROM shifts WHERE id = ?', params.id);
  if (!s) throw new HttpError(404, 'Shift not found');
  if (!canEditFor(user, s.user_id)) throw new HttpError(403, 'You can only account for your own attendance');
  if (!s.ended_at) throw bad('Clock out first — an open shift\'s gap is still growing');

  const project = one('SELECT * FROM projects WHERE id = ?',
    int(body.projectId, { name: 'Project', min: 1 }));
  if (!project) throw new HttpError(404, 'Project not found');
  if (project.status !== 'active') {
    throw bad(`"${project.name}" is archived — pick a project that is still running`);
  }

  // An optional window narrows this to one stretch of the day, which is what
  // the sheet sends when a single row is assigned rather than the whole gap.
  const from = body.from === undefined || body.from === null
    ? null : Date.parse(instant(body.from, { name: 'From' }));
  const to = body.to === undefined || body.to === null
    ? null : Date.parse(instant(body.to, { name: 'To' }));
  if ((from === null) !== (to === null)) throw bad('Give both ends of the stretch, or neither');
  if (from !== null && to <= from) throw bad('That stretch ends before it starts');

  const note = str(body.note, { name: 'Note', max: 500 });
  const before = shiftView(s);
  const dayBefore = dayView(s.user_id, s.date);

  const parts = shiftSegments(s).gaps
    .map((g) => ({ from: Math.max(g.from, from ?? g.from), to: Math.min(g.to, to ?? g.to) }))
    .map((g) => ({ from: g.from, minutes: Math.floor((g.to - g.from) / 60000) }))
    .filter((g) => g.minutes >= 1);
  if (!parts.length) {
    throw bad(from === null
      ? 'There is no unaccounted time left on this shift'
      : 'Nothing is unaccounted for in that stretch');
  }

  return tx(() => {
    const now = nowISO();
    const ids = [];
    for (const p of parts) {
      const res = run(`
        INSERT INTO time_entries
          (user_id, project_id, task_id, date, minutes, note, billable, started_at, ended_at, source, created_at, updated_at)
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`,
        s.user_id, project.id, localDate(new Date(p.from)), p.minutes, note, project.billable,
        new Date(p.from).toISOString(), new Date(p.from + p.minutes * 60000).toISOString(), now, now);
      ids.push(Number(res.lastInsertRowid));
    }

    const after = shiftView(one('SELECT * FROM shifts WHERE id = ?', s.id));
    if (after.overclaimedMinutes > before.overclaimedMinutes) {
      // Rolled back by the throw. Reached when something already on this day
      // bills more minutes than its own clock ran for but has not yet passed
      // the presence on its own: the gap is real, and filling it is still the
      // last straw. Naming the arithmetic is the only way the reader can tell
      // this from a refusal to do something reasonable.
      throw bad(`Filling this gap would bill ${dur(after.claimedMinutes)} against `
        + `${dur(after.presentMinutes)} of presence. Something on this day already claims more `
        + 'minutes than its own clock ran — correct that entry first.');
    }

    // And the same question one level up. The check above is per shift, and a
    // stretch running through the ground BETWEEN two spells is counted by
    // neither of them, so a day could be pushed past its own presence with
    // every spell on it still reporting nothing wrong. Recomputed rather than
    // reasoned about, for the same reason as the check above it.
    const dayAfter = dayView(s.user_id, s.date);
    if (dayOverclaim(dayAfter) > dayOverclaim(dayBefore)) {
      throw bad(`Filling this gap would bill ${dur(dayAfter.claimedMinutes)} against `
        + `${dur(dayAfter.presenceMinutes)} of presence across the whole of this day. Something on `
        + 'it runs past the hours anybody was clocked in — correct that entry first.');
    }

    return {
      shift: after,
      minutes: parts.reduce((n, p) => n + p.minutes, 0),
      entries: ids.map((id) => entryRow(one(`${ENTRY_SELECT} WHERE e.id = ?`, id))),
    };
  });
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

// ------------------------------------------------------------------- digest
/**
 * The weekly client note, as data.
 *
 * The list this was built for carries "Weekly progress note to Michael" as
 * recurring manual work: an hour every Friday assembling, by hand, facts this
 * database already holds. This endpoint is those facts, for one client, over
 * one week — hours by workstream, what closed, the notes people wrote on their
 * own time entries as the narrative, and what falls due next.
 *
 * It is NOT a page. `dgtl-worklog-status-report` already builds the
 * client-facing artefact, and a second presentation layer competing with it
 * would be two things to keep in step and one of them always stale. What that
 * skill has to do by hand today is exactly the arithmetic below — closed over
 * scheduled per workstream, estimate remaining, logged minutes from the project
 * totals rather than the task totals, completions sorted by doneAt — so the
 * payload is shaped as its inputs and it can read this instead of computing it.
 *
 * ---------------------------------------------------------------------------
 * The rule that governs every figure here: A NUMBER THAT CANNOT NAME ITS ROWS
 * DOES NOT GO IN.
 *
 * Every claim is emitted twice — once where it is read, and once in
 * `provenance`, carrying the ids of the rows it was summed from. Nothing is
 * rounded for readability, nothing is estimated, and there is no figure in the
 * payload that is not either a claim or built from claims. That is what makes
 * it checkable by a test rather than by a careful reader: sum the named rows,
 * compare to the stated value, and the digest is either honest or red.
 */
const MAX_DIGEST_DAYS = 92;

/** One provenance claim: what was said, and which rows say it. */
const claim = (id, kind, label, value, source) => ({ id, kind, label, value, ...source });

function buildDigest({ client, from, to, timezone = APP_TIMEZONE }) {
  const projects = all(`
    SELECT p.* FROM projects p
      JOIN project_clients pc ON pc.project_id = p.id
     WHERE pc.client_id = ?
     ORDER BY p.status ASC, p.position ASC, p.id ASC`, client.id);
  const projectIds = projects.map((p) => p.id);
  const provenance = [];

  const entries = projectIds.length ? all(`
    SELECT e.*, p.name AS project_name, p.color AS project_color,
           t.title AS task_title, u.name AS user_name
      FROM time_entries e
      LEFT JOIN projects p ON p.id = e.project_id
      LEFT JOIN tasks    t ON t.id = e.task_id
      LEFT JOIN users    u ON u.id = e.user_id
     WHERE e.date BETWEEN ? AND ?
       AND e.project_id IN (${projectIds.map(() => '?').join(',')})
     ORDER BY e.date ASC, e.id ASC`, from, to, ...projectIds) : [];

  const completed = completedBetween({ from, to, projectIds });

  // Open work with a date on it, split at the end of the range: what is coming
  // and what is already late. Both are rows that exist — a recurring task's
  // NEXT instance is not here, because it has not been written yet and a digest
  // that promised it would be promising a row nobody can open.
  const horizon = addDays(to, 7);
  const dated = projectIds.length ? all(`
    SELECT t.*, p.name AS project_name, p.color AS project_color, u.name AS assignee_name
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN users    u ON u.id = t.assignee_id
     WHERE t.archived = 0 AND t.status <> 'done' AND t.due_date IS NOT NULL
       AND t.due_date <= ?
       AND t.project_id IN (${projectIds.map(() => '?').join(',')})
     ORDER BY t.due_date ASC, t.id ASC`, horizon, ...projectIds) : [];

  const openByProject = new Map();
  for (const t of projectIds.length ? all(`
    SELECT project_id, COUNT(*) AS open,
           COALESCE(SUM(COALESCE(estimate_minutes, 0)), 0) AS estimate_open,
           COUNT(*) FILTER (WHERE priority = 'high') AS high
      FROM tasks
     WHERE archived = 0 AND status <> 'done'
       AND project_id IN (${projectIds.map(() => '?').join(',')})
     GROUP BY project_id`, ...projectIds) : []) openByProject.set(t.project_id, t);

  const doneAllByProject = new Map(projectIds.length ? all(`
    SELECT project_id, COUNT(*) AS n FROM tasks
     WHERE archived = 0 AND status = 'done'
       AND project_id IN (${projectIds.map(() => '?').join(',')})
     GROUP BY project_id`, ...projectIds).map((r) => [r.project_id, r.n]) : []);

  const loggedAllByProject = new Map(projectIds.length ? all(`
    SELECT project_id, COALESCE(SUM(minutes), 0) AS m FROM time_entries
     WHERE project_id IN (${projectIds.map(() => '?').join(',')})
     GROUP BY project_id`, ...projectIds).map((r) => [r.project_id, r.m]) : []);

  const sum = (rows, f = (e) => e.minutes) => rows.reduce((n, e) => n + f(e), 0);
  const ids = (rows) => rows.map((e) => e.id);

  const workstreams = projects.map((p) => {
    const mine = entries.filter((e) => e.project_id === p.id);
    const billable = mine.filter((e) => e.billable);
    const open = openByProject.get(p.id) || { open: 0, estimate_open: 0, high: 0 };
    const closedInRange = completed.filter((t) => t.project_id === p.id);
    const doneAll = doneAllByProject.get(p.id) || 0;
    const scheduled = doneAll + open.open;
    return {
      projectId: p.id, name: p.name, code: p.code, color: p.color, status: p.status,
      contact: p.client,
      minutes: sum(mine), billableMinutes: sum(billable), entries: mine.length,
      entryIds: ids(mine),
      // All-time, and named all-time: a budget is not spent by one week.
      loggedAllTimeMinutes: loggedAllByProject.get(p.id) || 0,
      budgetMinutes: p.budget_minutes,
      tasksClosedInRange: closedInRange.length,
      tasksClosed: doneAll,
      tasksOpen: open.open,
      tasksHighPriorityOpen: open.high,
      // Closed over scheduled, the basis stated: a percentage of task COUNTS,
      // never of hours, and null rather than 0 where the project holds no tasks
      // at all — "nothing planned" is not "nothing done".
      tasksScheduled: scheduled,
      closedPct: scheduled ? (doneAll / scheduled) * 100 : null,
      estimateRemainingMinutes: open.estimate_open,
    };
  });

  const active = workstreams.filter((w) =>
    w.entries || w.tasksClosedInRange || dated.some((t) => t.project_id === w.projectId));

  const narrative = entries.filter((e) => e.note.trim()).map((e) => ({
    entryId: e.id, date: e.date, minutes: e.minutes, note: e.note,
    projectId: e.project_id, projectName: e.project_name,
    taskId: e.task_id, taskTitle: e.task_title,
    userId: e.user_id, userName: e.user_name, billable: !!e.billable,
  }));

  const people = [...entries.reduce((m, e) => {
    const row = m.get(e.user_id) || { userId: e.user_id, name: e.user_name || 'Removed user', minutes: 0, entryIds: [] };
    row.minutes += e.minutes;
    row.entryIds.push(e.id);
    return m.set(e.user_id, row);
  }, new Map()).values()].sort((a, b) => b.minutes - a.minutes);

  // Three buckets, and every one of them is a statement about the REPORTED
  // range rather than about the instant this ran — so last week's digest reads
  // the same today, tomorrow and next year.
  //
  //   before  — due before the week even started and still open. Late on any
  //             reading of the calendar, which is what earns the word.
  //   inWeek  — due inside the reported week and still open. Deliberately NOT
  //             called overdue: a digest written on Tuesday for the current
  //             week would be accusing Friday's work of being late.
  //   next    — due in the seven days after the range. This is the "what is
  //             coming" list.
  const bucketOf = (due) => (due < from ? 'before' : due <= to ? 'inWeek' : 'next');
  const upcoming = dated.map((t) => ({
    taskId: t.id, title: t.title, dueDate: t.due_date, status: t.status,
    priority: t.priority, estimateMinutes: t.estimate_minutes,
    projectId: t.project_id, projectName: t.project_name,
    assigneeId: t.assignee_id, assigneeName: t.assignee_name,
    recurrence: t.recurrence || null,
    bucket: bucketOf(t.due_date),
    overdue: t.due_date < from,
  }));

  const notedMinutes = sum(narrative);
  const totals = {
    minutes: sum(entries),
    billableMinutes: sum(entries.filter((e) => e.billable)),
    entries: entries.length,
    days: new Set(entries.map((e) => e.date)).size,
    tasksCompleted: completed.length,
    tasksOpen: workstreams.reduce((n, w) => n + w.tasksOpen, 0),
    tasksHighPriorityOpen: workstreams.reduce((n, w) => n + w.tasksHighPriorityOpen, 0),
    estimateRemainingMinutes: workstreams.reduce((n, w) => n + w.estimateRemainingMinutes, 0),
    dueNextWeek: upcoming.filter((t) => t.bucket === 'next').length,
    openInWeek: upcoming.filter((t) => t.bucket === 'inWeek').length,
    overdue: upcoming.filter((t) => t.bucket === 'before').length,
  };

  // ---- provenance: one line per claim, each naming the rows it came from ----
  provenance.push(
    claim('totals.minutes', 'minutes', `${dur(totals.minutes)} logged across the week`,
      totals.minutes, { entryIds: ids(entries) }),
    claim('totals.billableMinutes', 'minutes', `${dur(totals.billableMinutes)} of it billable`,
      totals.billableMinutes, { entryIds: ids(entries.filter((e) => e.billable)) }),
  );
  for (const w of active) {
    provenance.push(claim(`workstream.${w.projectId}.minutes`, 'minutes',
      `${w.name} — ${dur(w.minutes)}`, w.minutes, { entryIds: w.entryIds }));
    provenance.push(claim(`workstream.${w.projectId}.billableMinutes`, 'minutes',
      `${w.name} — ${dur(w.billableMinutes)} billable`, w.billableMinutes,
      { entryIds: w.entryIds.filter((id) => entries.find((e) => e.id === id).billable) }));
  }
  provenance.push(claim('totals.tasksCompleted', 'tasks',
    `${completed.length} ${completed.length === 1 ? 'task' : 'tasks'} completed`,
    completed.length, { taskIds: completed.map((t) => t.id) }));
  for (const t of completed) {
    provenance.push(claim(`completed.${t.id}.doneDate`, 'task-date',
      `"${t.title}" completed ${t.done_date}`, t.done_date, { taskIds: [t.id], field: 'doneAt' }));
  }
  provenance.push(claim('totals.dueNextWeek', 'tasks',
    `${totals.dueNextWeek} due between ${addDays(to, 1)} and ${horizon}`, totals.dueNextWeek,
    { taskIds: upcoming.filter((t) => t.bucket === 'next').map((t) => t.taskId) }));
  provenance.push(claim('totals.openInWeek', 'tasks',
    `${totals.openInWeek} due inside the week and still open`, totals.openInWeek,
    { taskIds: upcoming.filter((t) => t.bucket === 'inWeek').map((t) => t.taskId) }));
  provenance.push(claim('totals.overdue', 'tasks',
    `${totals.overdue} still open from before ${from}`, totals.overdue,
    { taskIds: upcoming.filter((t) => t.bucket === 'before').map((t) => t.taskId) }));
  for (const t of upcoming) {
    provenance.push(claim(`upcoming.${t.taskId}.dueDate`, 'task-date',
      `"${t.title}" due ${t.dueDate}`, t.dueDate, { taskIds: [t.taskId], field: 'dueDate' }));
  }
  provenance.push(claim('narrative.minutes', 'minutes',
    `${dur(notedMinutes)} of the week carries a written note`, notedMinutes,
    { entryIds: narrative.map((n) => n.entryId) }));
  for (const n of narrative) {
    provenance.push(claim(`narrative.${n.entryId}.note`, 'text',
      n.note, n.note, { entryIds: [n.entryId], field: 'note' }));
  }
  for (const p of people) {
    provenance.push(claim(`person.${p.userId}.minutes`, 'minutes',
      `${p.name} — ${dur(p.minutes)}`, p.minutes, { entryIds: p.entryIds }));
  }

  return {
    client: { id: client.id, name: client.name },
    range: { from, to, days: 1 + Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) },
    horizon,
    generatedAt: nowISO(),
    timezone,
    projects: projects.map((p) => ({
      projectId: p.id, name: p.name, code: p.code, color: p.color, status: p.status,
    })),
    // Named so a reader knows they were looked at and had nothing, rather than
    // wondering whether the digest simply missed them.
    silentProjects: workstreams.filter((w) => !active.includes(w))
      .map((w) => ({ projectId: w.projectId, name: w.name, code: w.code, status: w.status })),
    totals,
    workstreams: active,
    completed: completed.map((t) => ({
      taskId: t.id, title: t.title, notes: t.notes,
      projectId: t.project_id, projectName: t.project_name, projectColor: t.project_color,
      doneAt: t.done_at, doneDate: t.done_date,
      assigneeId: t.assignee_id, assigneeName: t.assignee_name,
      priority: t.priority, estimateMinutes: t.estimate_minutes, loggedMinutes: t.logged_minutes,
      recurrence: t.recurrence || null,
    })),
    narrative,
    // What share of the week the narrative actually speaks for. A story built
    // from the notes on 40% of the hours is a story about 40% of the hours, and
    // saying so is the difference between a spine and a claim of completeness.
    coverage: {
      minutes: totals.minutes,
      notedMinutes,
      unnotedMinutes: totals.minutes - notedMinutes,
      notedEntries: narrative.length,
    },
    upcoming,
    people,
    provenance,
  };
}

route('GET', '/api/digest', ({ req, query }) => {
  const user = requireUser(req);
  const clientId = int(query.get('clientId'), { name: 'Client', min: 1 });
  const client = one('SELECT * FROM clients WHERE id = ?', clientId);
  if (!client) throw new HttpError(404, 'Client not found');

  // The week the caller's own calendar is on, which is the week they are
  // writing the note for. Both ends can be given instead; the pair is what
  // makes last week's digest reproducible after the fact.
  const from = dateOr(query.get('from'), startOfWeek(localDate(), user.weekStart));
  const to = dateOr(query.get('to'), addDays(from, 6));
  if (from > to) throw bad('The start of the range is after its end');
  const days = 1 + Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
  // A digest lists every note in its range, so an unbounded one is a way to ask
  // for the whole workspace in a single response.
  if (days > MAX_DIGEST_DAYS) throw bad(`A digest covers at most ${MAX_DIGEST_DAYS} days — this one asks for ${days}`);

  return buildDigest({ client, from, to });
});

/** Clients that have projects, for the digest picker. */
route('GET', '/api/clients', ({ req }) => {
  requireUser(req);
  return {
    clients: all(`
      SELECT c.id, c.name, COUNT(pc.project_id) AS projects
        FROM clients c
        JOIN project_clients pc ON pc.client_id = c.id
       GROUP BY c.id ORDER BY c.name`).map((c) => ({ id: c.id, name: c.name, projects: c.projects })),
  };
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
