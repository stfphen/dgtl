/* DGTL Worklog — client state.
   One shared snapshot of the workspace, refreshed from /api/bootstrap. Views
   subscribe and re-render; nothing derived is cached here either. */

import { api } from './api.js';

const listeners = new Set();

export const state = {
  ready: false,
  user: null,
  users: [],
  projects: [],
  tasks: [],
  timer: null,
  // Attendance, separate from the timer on purpose: one says you are here, the
  // other says what you are doing. All of the day's, oldest first — clocking
  // out for lunch and back in is two, and only ever showing the newest hid the
  // morning and its gap behind the afternoon.
  shifts: [],
  // Blocks logged by hand today, which carry no start and end. A property of
  // the day, not of any one shift: nothing can place them inside a presence.
  unplacedMinutes: 0,
  todayEntries: [],
  // Time on no project at all. Project rows cannot carry it, so the Projects
  // screen states it rather than quietly leaving it out of its totals.
  unassigned: { minutes: 0, billableMinutes: 0 },
  today: new Date().toISOString().slice(0, 10),
  // The share of the day meant to reach an invoice. 0 until the workspace
  // loads: the figure belongs to the server, and a plausible-looking default
  // baked in here would be a second opinion about the same number.
  billableTargetPct: 0,
  weekStartDate: null,
  timezone: '',
  // When this snapshot was taken. The shift figures are true as of then, and
  // the strip needs to know how far it has drifted since.
  loadedAt: 0,
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  for (const fn of listeners) fn(state);
}

export async function load() {
  const data = await api.bootstrap();
  Object.assign(state, {
    ready: true,
    user: data.user,
    users: data.users,
    projects: data.projects,
    unassigned: data.unassigned ?? { minutes: 0, billableMinutes: 0 },
    tasks: data.tasks,
    timer: data.timer,
    shifts: data.shifts ?? [],
    unplacedMinutes: data.unplacedMinutes ?? 0,
    todayEntries: data.todayEntries,
    today: data.today,
    billableTargetPct: data.billableTargetPct ?? 0,
    weekStartDate: data.weekStartDate,
    timezone: data.timezone,
    loadedAt: Date.now(),
  });
  // util.today() reads this, so every view agrees on the workspace's "today"
  // rather than the browser's, which may sit in another timezone.
  window.__WORKLOG_TODAY__ = data.today;
  emit();
  return state;
}

/* ------------------------------------------------------------ selectors -- */

export const activeProjects = () => state.projects.filter((p) => p.status === 'active');
export const projectById = (id) => state.projects.find((p) => p.id === Number(id)) || null;
export const taskById = (id) => state.tasks.find((t) => t.id === Number(id)) || null;
export const userById = (id) => state.users.find((u) => u.id === Number(id)) || null;
export const isAdmin = () => state.user?.role === 'admin';

export const openTasksFor = (userId) => state.tasks.filter(
  (t) => !t.archived && t.status !== 'done' && (!userId || t.assigneeId === userId),
);

export const todayMinutes = () => state.todayEntries.reduce((sum, e) => sum + e.minutes, 0);

/** Seconds on the running timer right now — recomputed, never accumulated. */
export function timerSeconds() {
  if (!state.timer) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(state.timer.startedAt).getTime()) / 1000));
}

/** The shift still running, if any. At most one, enforced by the database. */
export const openShift = () => state.shifts.find((s) => s.open) || null;

/** Seconds of presence on a shift — live while it is open, fixed once closed. */
export function shiftSeconds(s) {
  if (!s) return 0;
  if (!s.open) return s.presentMinutes * 60;
  return Math.max(0, Math.round((Date.now() - new Date(s.startedAt).getTime()) / 1000));
}

/**
 * Presence accounted for by clocked work, as of this instant.
 *
 * The server's figure is true as of the last load. Between loads the only
 * thing that can add to it is the clock that was already running — every other
 * way of logging time reloads the workspace — so attributed presence tracks
 * the running timer second for second. That is what holds the gap still while
 * a clock runs and lets it grow only when nothing is running, which is the one
 * honest way to read it.
 */
export function shiftAttributedSeconds(s) {
  if (!s) return 0;
  const since = s.open && state.timer ? Math.max(0, Date.now() - state.loadedAt) / 1000 : 0;
  return Math.min(s.attributedMinutes * 60 + since, shiftSeconds(s));
}

/** Presence across the whole day, closed shifts and the open one together. */
export const dayPresenceSeconds = () => state.shifts.reduce((n, s) => n + shiftSeconds(s), 0);
export const dayAttributedSeconds = () => state.shifts.reduce((n, s) => n + shiftAttributedSeconds(s), 0);

/** Of the minutes filed today, the ones that can be invoiced. */
export const todayBillableMinutes = () =>
  state.todayEntries.reduce((sum, e) => sum + (e.billable ? e.minutes : 0), 0);

/**
 * Where the day stands against the share of it that is meant to be billable.
 *
 * The denominator is the day that ACTUALLY HAPPENED, not a nominal eight
 * hours: presence when somebody clocked in, and never less than the work filed
 * into the day, because a block logged outside any shift was still worked and
 * a basis smaller than the work would report a share above 100% — which is not
 * a share of anything. With no attendance and nothing logged there is only the
 * intention left, and that is what `daily_target_minutes` has always been; it
 * keeps that meaning here and gains the target percentage as a sibling rather
 * than being quietly redefined under the people already using it.
 *
 * Two percentages come out because they answer two questions. `sharePct` is
 * the ratio — how much of the day reached an invoice, the figure this
 * workspace reads 13% on. `progressPct` is how far along the target that is,
 * and it is the one the ring draws, because a ring is a progress bar bent
 * round: filling it has to mean arriving somewhere.
 *
 * Pure, and given every figure it uses, so the numbers on the Today screen are
 * the ones a test can read with no DOM in the room.
 */
export function billableStanding({
  billableMinutes = 0, loggedMinutes = 0, presenceMinutes = 0,
  dailyTargetMinutes = 0, targetPct = 0,
} = {}) {
  const measured = Math.max(presenceMinutes, loggedMinutes);
  const basis = measured || dailyTargetMinutes || 0;
  const source = measured
    ? (presenceMinutes >= loggedMinutes ? 'present' : 'logged')
    : (basis ? 'target' : 'none');
  const targetMinutes = Math.round((basis * targetPct) / 100);
  return {
    billableMinutes, loggedMinutes, presenceMinutes, basis, source, targetPct, targetMinutes,
    sharePct: basis ? (billableMinutes / basis) * 100 : null,
    // null, not 0 — "nobody set a target" and "none of the target is met" are
    // different claims, and an arc drawn for the first one states the second.
    progressPct: targetMinutes ? (billableMinutes / targetMinutes) * 100 : null,
    shortfallMinutes: Math.max(0, targetMinutes - billableMinutes),
  };
}

/** The same, for today, read off the live workspace. */
export const billableToday = () => billableStanding({
  billableMinutes: todayBillableMinutes(),
  loggedMinutes: todayMinutes(),
  presenceMinutes: Math.round(dayPresenceSeconds() / 60),
  dailyTargetMinutes: state.user?.dailyTargetMinutes || 0,
  targetPct: state.billableTargetPct,
});

/* -------------------------------------------------------------- actions -- */
/* Each action calls the API, then reloads the parts that changed. Reloading
   beats patching state by hand: totals, budgets and streaks stay correct. */

export async function startTimer(payload) {
  const res = await api.startTimer(payload);
  await load();
  return res;
}

/**
 * Re-label the running timer. Patches `state.timer` in place instead of
 * reloading — a full reload on every keystroke would fight the label field
 * the user is still typing into.
 */
export async function updateTimer(patch) {
  const res = await api.updateTimer(patch);
  state.timer = res.timer;
  emit();
  return res.timer;
}

export async function stopTimer() {
  const res = await api.stopTimer();
  await load();
  return res;
}

export async function discardTimer() {
  await api.discardTimer();
  await load();
}

export async function clockIn(note) {
  const res = await api.clockIn(note ? { note } : undefined);
  await load();
  return res.shift;
}

export async function saveShift(id, patch) {
  const res = await api.updateShift(id, patch);
  await load();
  return res.shift;
}

export async function removeShift(id) {
  await api.deleteShift(id);
  await load();
}

/**
 * Put a shift's unaccounted presence against a project. Reloads rather than
 * patching, because the entries it writes move the day's total, the project's
 * budget bar and the billable share all at once.
 */
export async function disposeGap(id, patch) {
  const res = await api.disposeGap(id, patch);
  await load();
  return res;
}

export async function clockOut() {
  const res = await api.clockOut();
  await load();
  return res;
}

export async function saveTask(id, patch) {
  const res = id ? await api.updateTask(id, patch) : await api.createTask(patch);
  await load();
  return res.task;
}

/**
 * Tick a task off, and say what that produced.
 *
 * Its own action rather than `saveTask(id, { status: 'done' })` because
 * completing a REPEATING task writes a second row — next week's instance — and
 * the caller has to be able to tell the person so. `saveTask` returns the task
 * it saved and several screens rely on that shape, so the extra fact rides
 * here: `{ task, next }`, with `next` null for everything that does not repeat.
 */
export async function completeTask(id) {
  const res = await api.updateTask(id, { status: 'done' });
  await load();
  return { task: res.task, next: res.next || null };
}

export async function removeTask(id) {
  await api.deleteTask(id);
  await load();
}

export async function reorderTasks(ids) {
  await api.reorderTasks(ids);
  await load();
}

export async function saveEntry(id, patch) {
  const res = id ? await api.updateEntry(id, patch) : await api.createEntry(patch);
  await load();
  return res.entry;
}

export async function removeEntry(id) {
  await api.deleteEntry(id);
  await load();
}

export async function saveProject(id, patch) {
  const res = id ? await api.updateProject(id, patch) : await api.createProject(patch);
  await load();
  return res.project;
}

export async function removeProject(id) {
  const res = await api.deleteProject(id);
  await load();
  return res;
}

/**
 * Add or edit a member of the team. Goes through the store rather than
 * straight to the API so `state.users` reloads with them in it — otherwise a
 * new person is missing from every assignee, timesheet and report picker until
 * someone thinks to reload the page.
 */
export async function saveUser(id, patch) {
  const res = id ? await api.updateUser(id, patch) : await api.createUser(patch);
  await load();
  return res.user;
}

export async function saveMe(patch) {
  await api.updateMe(patch);
  await load();
}
