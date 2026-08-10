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
  todayEntries: [],
  today: new Date().toISOString().slice(0, 10),
  weekStartDate: null,
  timezone: '',
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
    tasks: data.tasks,
    timer: data.timer,
    todayEntries: data.todayEntries,
    today: data.today,
    weekStartDate: data.weekStartDate,
    timezone: data.timezone,
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

export async function saveTask(id, patch) {
  const res = id ? await api.updateTask(id, patch) : await api.createTask(patch);
  await load();
  return res.task;
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
  await api.deleteProject(id);
  await load();
}

export async function saveMe(patch) {
  await api.updateMe(patch);
  await load();
}
