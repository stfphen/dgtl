/* Quick log — the screen the app opens on.
 *
 * One rule shaped this: starting the clock must never wait on a decision.
 * Hit Start the moment work begins, then label it while it runs. The chips are
 * ordered by what this person actually worked on recently, not alphabetically,
 * so the button you want is usually the first one.
 *
 * Two verbs, and the difference between them is money. Tapping a chip SWITCHES:
 * the running stretch is banked against the project it was actually worked on
 * and a fresh one opens. Typing in the label field RELABELS: same stretch, same
 * start, different words. They used to be the same call, which meant tapping a
 * client chip at 10:30 re-filed everything since 09:00 to that client — silent,
 * and invoiced.
 */

import { clock, h, hm, today as todayDate } from '../util.js';
import { empty, fail, icon, render, toast } from '../ui.js';
import { entryEditor } from '../editors.js';
import { shiftStrip } from '../shift.js';
import {
  activeProjects, discardTimer, openTasksFor, projectById, saveEntry,
  startTimer, state, stopTimer, timerSeconds, todayMinutes, updateTimer,
} from '../store.js';
import { api } from '../api.js';

export const title = 'Quick log';
export const subtitle = () => (state.timer ? 'Timer running' : 'Start the clock in one tap');

/** Log-without-timing buttons, in the increments people actually use. */
const PRESETS = [15, 30, 45, 60, 90, 120];

export function render_(host) {
  const body = h('div', { class: 'quick' });
  host.append(body);

  let suggestions = { labels: [], projects: [] };
  let draft = { projectId: null, taskId: null, note: '' };   // used before a timer exists
  let tick = null;
  let saveTimer = null;
  let pendingNote = null;   // typed but not yet saved; a switch has to carry it

  /* ------------------------------------------------------- current state -- */
  // While a timer runs it IS the source of truth, so the same chips and label
  // field drive either the live timer or the pending draft.

  const live = () => state.timer;
  const current = () => (live() ? {
    projectId: live().projectId, taskId: live().taskId, note: live().note,
  } : draft);

  /**
   * RELABEL — what the running stretch is called, and nothing else. Never
   * moves started_at, never moves the project: elapsed time is a fact and the
   * project it was worked on is the thing that gets invoiced.
   */
  async function relabel(note) {
    pendingNote = null;
    if (!live()) { draft.note = note; return; }
    try { await updateTimer({ note }); } catch (e) { fail(e); }
  }

  /** Debounced so typing a label doesn't fire a request per keystroke. */
  function saveNoteSoon(note) {
    clearTimeout(saveTimer);
    pendingNote = note;
    if (!live()) { draft.note = note; pendingNote = null; return; }
    saveTimer = setTimeout(() => relabel(note), 500);
  }

  /**
   * SWITCH — a chip changes what the time is FOR, which is a different stretch
   * of work, not a different name for the one running. Starting the next timer
   * banks the current one against the project it was actually worked on; the
   * new stretch is timed from now. Re-labelling instead would move every
   * minute since the start onto whatever was tapped last, and that lands on
   * somebody's invoice with nothing on screen to show it happened.
   */
  async function switchTo(patch) {
    if (!live()) { Object.assign(draft, patch); return draw(); }
    clearTimeout(saveTimer);
    const cur = current();
    const carried = pendingNote ?? cur.note;
    pendingNote = null;
    try {
      const res = await startTimer({
        projectId: cur.projectId, taskId: cur.taskId, note: carried, ...patch,
      });
      toast(res.banked
        ? `Banked ${hm(res.banked.minutes)} on ${res.banked.projectName || 'no project'} — timing the new one from now`
        : 'Switched — the last stretch was under a minute, so nothing was logged');
      await loadSuggestions();
      draw();
    } catch (e) { fail(e); }
  }

  /* -------------------------------------------------------------- draw --- */

  function draw() {
    render(body, shiftStrip(draw), clockCard(), suggestCard(), presetCard(), todayCard());
    startTick();
  }

  function clockCard() {
    const running = live();
    const cur = current();
    const project = projectById(cur.projectId);

    const label = h('input', {
      class: 'quick-label',
      type: 'text',
      maxlength: '500',
      placeholder: running ? 'What are you working on?' : 'Label this (optional)',
      value: cur.note || '',
      oninput: (e) => saveNoteSoon(e.target.value),
      onkeydown: (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (running) { clearTimeout(saveTimer); relabel(e.target.value).then(draw); }
        else begin(e.target.value);
      },
    });

    return h('div', { class: `card quick-hero${running ? ' running' : ''}` },
      h('div', { class: 'quick-state' }, running ? 'Timer running' : 'Ready'),
      h('div', { class: `quick-clock${running ? '' : ' idle'}`, id: 'quick-clock' },
        clock(running ? timerSeconds() : 0)),

      h('div', { class: 'quick-meta' },
        project
          ? h('span', { class: 'dot-tag' },
            h('span', { class: 'dot', style: { background: project.color } }), project.name)
          : h('span', { class: 'dim' }, 'No project'),
        cur.taskId ? h('span', { class: 'pill' }, state.tasks.find((t) => t.id === cur.taskId)?.title || 'Task') : null,
        running ? h('span', { class: 'dim' },
          `since ${new Date(running.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`) : null,
      ),

      h('div', { class: 'quick-actions' },
        running
          ? [
            h('button', { class: 'btn btn-ghost', onclick: discard }, 'Discard'),
            h('button', { class: 'btn btn-primary btn-hero', onclick: stop }, icon('stop'), 'Stop & log'),
          ]
          : h('button', { class: 'btn btn-primary btn-hero', onclick: () => begin(label.value) },
            icon('play'), 'Start'),
      ),

      h('div', { class: 'quick-label-wrap' }, label),
      projectChips(cur.projectId),
      h('p', { class: 'quick-hint' },
        running
          ? 'Re-labelling keeps the clock running. Tapping a project banks what is running and starts a fresh stretch.'
          : 'Start now, sort out the label afterwards. Space starts and stops the clock.'),
    );
  }

  /**
   * Active projects, most recently worked first. Tapping one while the clock
   * runs banks the current stretch and opens the next — it does not re-file
   * what has already elapsed.
   */
  function projectChips(selectedId) {
    const running = !!live();
    const recency = new Map(suggestions.projects.map((p, i) => [p.projectId, i]));
    const projects = [...activeProjects()].sort((a, b) =>
      (recency.has(a.id) ? recency.get(a.id) : 999) - (recency.has(b.id) ? recency.get(b.id) : 999));

    if (!projects.length) return null;

    return h('div', { class: 'suggest' }, projects.map((p) => {
      const on = p.id === selectedId;
      return h('button', {
        class: `chip proj${on ? ' on' : ''}`,
        title: running
          ? (on ? `Bank this stretch and carry on untagged` : `Bank this stretch and start timing ${p.name}`)
          : (on ? 'Tap to untag' : `Tag this time as ${p.name}`),
        onclick: () => switchTo({ projectId: on ? null : p.id, taskId: null }),
      },
        h('span', { class: 'dot', style: { background: p.color } }),
        p.name,
      );
    }));
  }

  /* --------------------------------------------------------- suggestions -- */

  function suggestCard() {
    const cur = current();
    // Things worth one tap: what you were doing lately, and what is on your plate.
    const labels = suggestions.labels.filter((l) => l.note && l.note !== cur.note).slice(0, 6);
    const tasks = openTasksFor(state.user.id)
      .filter((t) => t.id !== cur.taskId)
      .sort((a, b) => {
        const rank = (t) => (t.status === 'doing' ? 0 : t.dueDate && t.dueDate <= todayDate() ? 1 : 2);
        return rank(a) - rank(b) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      })
      .slice(0, 5);

    if (!labels.length && !tasks.length) return null;

    return h('div', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h3', null, 'One tap'),
        h('span', { class: 'spacer' }),
        h('span', { class: 'dim', style: { fontSize: '12px' } }, 'from your recent work'),
      ),

      labels.length ? h('div', { class: 'suggest-group' },
        h('div', { class: 'eyebrow' }, 'Pick up again'),
        h('div', { class: 'suggest' }, labels.map((l) => {
          const p = projectById(l.projectId);
          return h('button', {
            class: 'chip',
            title: p ? `${l.note} · ${p.name}` : l.note,
            onclick: () => switchTo({ note: l.note, projectId: l.projectId, taskId: l.taskId ?? null }),
          },
            p ? h('span', { class: 'dot', style: { background: p.color } }) : null,
            l.note,
          );
        })),
      ) : null,

      tasks.length ? h('div', { class: 'suggest-group' },
        h('div', { class: 'eyebrow' }, 'On your plate'),
        h('div', { class: 'suggest' }, tasks.map((t) => {
          const p = projectById(t.projectId);
          return h('button', {
            class: 'chip',
            title: live() ? 'Bank this stretch and start timing the task' : 'Tag this time to the task',
            onclick: () => switchTo({ taskId: t.id, projectId: t.projectId, note: '' }),
          },
            p ? h('span', { class: 'dot', style: { background: p.color } }) : null,
            t.title,
            t.status === 'doing' ? h('span', { class: 'chip-flag' }, 'in progress') : null,
          );
        })),
      ) : null,
    );
  }

  /* ------------------------------------------------- log without timing --- */

  function presetCard() {
    return h('div', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h3', null, 'Already done it?'),
        h('span', { class: 'spacer' }),
        h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: () => entryEditor(null, { ...current(), date: todayDate() }, refresh),
        }, 'More options'),
      ),
      h('p', { class: 'muted', style: { fontSize: '13px', marginBottom: '14px' } },
        'Log a block against the project and label above, without running the clock.'),
      h('div', { class: 'suggest' }, PRESETS.map((minutes) =>
        h('button', {
          class: 'chip dur',
          onclick: () => logBlock(minutes),
        }, hm(minutes)))),
    );
  }

  async function logBlock(minutes) {
    const cur = current();
    try {
      await saveEntry(null, {
        projectId: cur.projectId, taskId: cur.taskId,
        date: todayDate(), minutes, note: cur.note || '',
      });
      toast(`Logged ${hm(minutes)}`, 'success');
      // The label was for that block; clear it so the next one starts clean.
      if (!live()) draft = { ...draft, note: '' };
      await refresh();
    } catch (e) { fail(e); }
  }

  /* -------------------------------------------------------------- today -- */

  function todayCard() {
    const entries = state.todayEntries;
    const total = todayMinutes();
    const target = state.user.dailyTargetMinutes;

    return h('div', { class: 'card', style: { padding: '0' } },
      h('div', { class: 'card-head', style: { padding: '18px 20px 14px', marginBottom: '0' } },
        h('h3', null, 'Logged today'),
        h('span', { class: 'spacer' }),
        h('span', { style: { fontWeight: '800', color: total ? 'var(--gold)' : 'var(--text-dim)' } },
          hm(total, { zero: '0h' })),
        target ? h('span', { class: 'dim', style: { fontSize: '13px' } }, `of ${hm(target)}`) : null,
      ),
      entries.length
        ? h('div', null, entries.slice(0, 6).map((e) => h('div', { class: 'quick-entry' },
          h('span', { class: 'dot', style: { background: e.projectColor || 'var(--nil)' } }),
          h('span', { class: 'qe-what' }, e.note || e.taskTitle || e.projectName || 'Untitled'),
          e.source === 'timer' ? h('span', { class: 'pill' }, 'Timer') : null,
          h('span', { class: 'qe-min' }, hm(e.minutes)),
          h('button', {
            class: 'btn-icon', title: 'Edit entry',
            onclick: () => entryEditor(e, {}, refresh),
          }, icon('pencil')),
        )))
        : empty({ title: 'Nothing logged yet today', subtitle: 'Hit Start above, or log a block.' }),
    );
  }

  /* ------------------------------------------------------------ actions -- */

  async function begin(note = '') {
    clearTimeout(saveTimer);
    pendingNote = null;
    try {
      const res = await startTimer({ ...draft, note: note || draft.note || '' });
      if (res.banked) toast(`Banked ${hm(res.banked.minutes)} on the previous timer`);
      draft = { projectId: null, taskId: null, note: '' };
      draw();
    } catch (e) { fail(e); }
  }

  async function stop() {
    clearTimeout(saveTimer);
    pendingNote = null;
    try {
      const res = await stopTimer();
      toast(res.entry ? `Logged ${hm(res.entry.minutes)}` : 'Under a minute — nothing logged',
        res.entry ? 'success' : '');
      await loadSuggestions();
      draw();
    } catch (e) { fail(e); }
  }

  async function discard() {
    clearTimeout(saveTimer);
    try { await discardTimer(); toast('Timer discarded — nothing logged'); draw(); } catch (e) { fail(e); }
  }

  async function refresh() {
    await loadSuggestions();
    draw();
  }

  async function loadSuggestions() {
    try { suggestions = await api.suggestions(); } catch { /* chips are optional */ }
  }

  /* --------------------------------------------------------------- tick -- */

  function startTick() {
    clearInterval(tick);
    if (!live()) return;
    tick = setInterval(() => {
      const el = document.getElementById('quick-clock');
      if (!el) return clearInterval(tick);
      el.textContent = clock(timerSeconds());
    }, 1000);
  }

  // Space toggles the clock — but never while someone is typing in a field, and
  // never through an open dialog, where it would fire the timer behind it.
  const onKey = (e) => {
    if (e.code !== 'Space' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('.overlay')) return;
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
      || el.tagName === 'BUTTON' || el.isContentEditable)) return;
    e.preventDefault();
    if (live()) stop(); else begin();
  };
  document.addEventListener('keydown', onKey);

  draw();
  loadSuggestions().then(draw);

  return () => {
    clearInterval(tick);
    clearTimeout(saveTimer);
    document.removeEventListener('keydown', onKey);
  };
}

export { render_ as render };
