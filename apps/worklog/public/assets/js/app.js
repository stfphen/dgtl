/* DGTL Worklog — shell and router.
   Builds the sidebar + top bar, mounts one view at a time, and keeps the
   running-timer chip ticking wherever you are in the app. */

import { $, clear, clock, h } from './util.js';
import { avatar, fail, icon, render } from './ui.js';
import { load, openTasksFor, state, subscribe, timerSeconds } from './store.js';

import * as quick from './views/quick.js';
import * as today from './views/today.js';
import * as tasks from './views/tasks.js';
import * as timesheet from './views/timesheet.js';
import * as projects from './views/projects.js';
import * as reports from './views/reports.js';
import * as settings from './views/settings.js';

const VIEWS = {
  quick: { module: quick, icon: 'timer', label: 'Quick log' },
  today: { module: today, icon: 'today', label: 'Today' },
  tasks: { module: tasks, icon: 'tasks', label: 'Tasks' },
  timesheet: { module: timesheet, icon: 'timesheet', label: 'Timesheet' },
  projects: { module: projects, icon: 'projects', label: 'Projects' },
  reports: { module: reports, icon: 'reports', label: 'Reports' },
  settings: { module: settings, icon: 'settings', label: 'Settings' },
};

const NAV = [
  { section: 'Work', keys: ['quick', 'today', 'tasks'] },
  { section: 'Time', keys: ['timesheet', 'reports'] },
  { section: 'Workspace', keys: ['projects', 'settings'] },
];

const root = $('#app');
let teardown = null;
let current = null;

/** Quick log is the landing view — the app opens ready to start the clock. */
const routeKey = () => {
  const key = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
  return VIEWS[key] ? key : 'quick';
};

/* ------------------------------------------------------------- chrome --- */

function buildShell() {
  const nav = h('nav', { class: 'nav' });
  const pageTitle = h('h1');
  const pageSub = h('div', { class: 'sub' });
  const actions = h('div', { class: 'page-actions' });
  const viewHost = h('div');

  const chipTime = h('span', { class: 'el' }, '0:00');
  const chipWhat = h('span', { class: 'what' });
  const timerChip = h('button', {
    class: 'timer-chip', title: 'Go to the running timer',
    onclick: () => { location.hash = '#/today'; },
  }, h('span', { class: 'dot' }), chipTime, chipWhat);

  const sidebar = h('aside', { class: 'sidebar', id: 'sidebar' },
    h('div', { class: 'sidebar-head' },
      h('img', { src: '/assets/dgtl-logo.svg', alt: 'DGTL' }),
      h('span', { class: 'wordmark' }, 'Worklog'),
    ),
    nav,
    h('div', { class: 'user-chip' },
      avatar(state.user.name),
      h('div', { class: 'who' },
        h('div', { class: 'name' }, state.user.name),
        h('div', { class: 'role' }, state.user.role),
      ),
      h('button', {
        class: 'btn-icon', title: 'Sign out',
        onclick: async () => {
          const { api } = await import('./api.js');
          await api.logout();
          window.location.href = '/login.html';
        },
      }, icon('logout')),
    ),
  );

  const scrim = h('div', { class: 'scrim', hidden: true, onclick: () => toggleSidebar(false) });
  const toggleSidebar = (open) => {
    sidebar.classList.toggle('open', open);
    scrim.hidden = !open;
  };

  const shell = h('div', { class: 'shell' },
    sidebar,
    h('div', { class: 'main' },
      h('header', { class: 'topbar glass-bar' },
        h('button', { class: 'btn-icon menu-btn', title: 'Menu', onclick: () => toggleSidebar(true) }, icon('menu')),
        h('div', null, pageTitle, pageSub),
        h('div', { class: 'topbar-right' }, timerChip),
      ),
      h('main', { class: 'page' },
        h('div', { class: 'page-head' }, actions),
        viewHost,
      ),
    ),
  );

  render(root, shell, scrim);
  return { nav, pageTitle, pageSub, actions, viewHost, timerChip, chipTime, chipWhat, toggleSidebar };
}

function drawNav(chrome) {
  const key = routeKey();
  const counts = {
    tasks: openTasksFor(state.user.id).length,
  };

  clear(chrome.nav);
  for (const group of NAV) {
    chrome.nav.append(h('div', { class: 'nav-label' }, group.section));
    for (const k of group.keys) {
      const v = VIEWS[k];
      chrome.nav.append(h('a', {
        class: `nav-item${k === key ? ' active' : ''}`,
        href: `#/${k}`,
        onclick: () => chrome.toggleSidebar(false),
      },
        icon(v.icon),
        h('span', null, v.label),
        counts[k] ? h('span', { class: 'count' }, String(counts[k])) : null,
      ));
    }
  }
}

function drawTimerChip(chrome) {
  const on = !!state.timer;
  chrome.timerChip.classList.toggle('on', on);
  if (!on) return;
  chrome.chipTime.textContent = clock(timerSeconds());
  chrome.chipWhat.textContent = state.timer.taskTitle || state.timer.note || state.timer.projectName || 'Working';
}

/* ------------------------------------------------------------- routing -- */

function mount(chrome) {
  const key = routeKey();
  if (teardown) { teardown(); teardown = null; }
  current = key;

  const view = VIEWS[key].module;
  chrome.pageTitle.textContent = view.title;
  chrome.pageSub.textContent = view.subtitle ? view.subtitle() : '';
  document.title = `${view.title} · DGTL Worklog`;

  clear(chrome.actions);
  clear(chrome.viewHost);
  drawNav(chrome);

  try {
    teardown = view.render(chrome.viewHost, { actions: chrome.actions }) || null;
  } catch (err) {
    console.error(err);
    fail(err);
  }
  window.scrollTo(0, 0);
}

/* ---------------------------------------------------------------- boot -- */

(async function boot() {
  try {
    await load();
  } catch (err) {
    // 401 already redirected inside the API client; anything else is fatal.
    if (err.status !== 401) {
      render(root, h('div', { class: 'auth' },
        h('div', { class: 'auth-card card' },
          h('h1', null, 'Cannot load the workspace'),
          h('p', { class: 'sub' }, err.message),
          h('button', { class: 'btn btn-primary', onclick: () => location.reload() }, 'Try again'),
        )));
    }
    return;
  }

  const chrome = buildShell();
  mount(chrome);

  window.addEventListener('hashchange', () => {
    if (routeKey() !== current) mount(chrome);
  });

  // Nav counts and the timer chip follow every state change.
  subscribe(() => {
    drawNav(chrome);
    drawTimerChip(chrome);
    chrome.pageSub.textContent = VIEWS[current]?.module.subtitle?.() ?? '';
  });

  drawTimerChip(chrome);
  setInterval(() => drawTimerChip(chrome), 1000);

  // A tab left open overnight would otherwise show yesterday's Today screen.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const was = state.today;
    try {
      await load();
      if (state.today !== was) mount(chrome);
    } catch { /* offline — keep showing what we have */ }
  });
}());
