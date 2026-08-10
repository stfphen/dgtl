/* Today — the daily loop. Start the clock, see the day fill up, tick work off.
   This is the habit tracker's Today screen with hours in place of check-ins. */

import { addDays, clock, dayLong, h, hm, relativeDay, startOfWeek, today as todayDate } from '../util.js';
import { empty, fail, icon, kpi, projectOptions, render, ring, select, taskOptions, toast } from '../ui.js';
import { entryEditor, taskEditor } from '../editors.js';
import {
  discardTimer, openTasksFor, projectById, saveTask, startTimer,
  state, stopTimer, timerSeconds, todayMinutes,
} from '../store.js';
import { api } from '../api.js';

export const title = 'Today';
export const subtitle = () => dayLong(todayDate());

export function render_(host) {
  const body = h('div', { class: 'stack' });
  host.append(body);

  let weekMinutes = 0;
  let streak = { current: 0, longest: 0 };
  let tick = null;

  const draw = () => {
    const target = state.user.dailyTargetMinutes;
    const logged = todayMinutes();
    const pct = target ? (logged / target) * 100 : 0;
    const mine = openTasksFor(state.user.id);
    const dueToday = mine.filter((t) => t.dueDate && t.dueDate <= todayDate());

    render(body,
      timerCard(),

      h('div', { class: 'grid cols-4' },
        kpi({
          label: 'Logged today', value: hm(logged, { zero: '0h' }), hero: true,
          foot: target ? `of ${hm(target)} target` : 'no daily target set',
        }),
        kpi({ label: 'This week', value: hm(weekMinutes, { zero: '0h' }), foot: 'since ' + relativeDay(startOfWeek(todayDate(), state.user.weekStart)) }),
        kpi({
          label: 'Current streak', value: `${streak.current}`,
          foot: streak.longest ? `best run ${streak.longest} days` : 'days in a row with time logged',
        }),
        kpi({
          label: 'Open tasks', value: `${mine.length}`,
          foot: dueToday.length ? `${dueToday.length} due today or overdue` : 'nothing due yet',
        }),
      ),

      h('div', { class: 'grid top', style: { gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)' } },
        entriesCard(),
        h('div', { class: 'stack' }, progressCard(pct, logged, target), focusCard(mine)),
      ),
    );
    startTick();
  };

  /* ------------------------------------------------------------ timer --- */

  function timerCard() {
    const running = state.timer;

    if (running) {
      const what = running.taskTitle || running.note || running.projectName || 'Untitled work';
      const el = h('div', { class: 'elapsed', id: 'elapsed' }, clock(timerSeconds()));
      return h('div', { class: 'card timer-card running' },
        h('div', null,
          h('div', { class: 'eyebrow', style: { marginBottom: '10px' } }, 'Timer running'),
          h('div', { style: { fontSize: '19px', fontWeight: '700', color: '#fff' } }, what),
          h('div', { class: 'row tight', style: { marginTop: '10px' } },
            running.projectName
              ? h('span', { class: 'dot-tag' },
                h('span', { class: 'dot', style: { background: running.projectColor || 'var(--gold)' } }),
                running.projectName)
              : h('span', { class: 'dim', style: { fontSize: '13px' } }, 'No project'),
            h('span', { class: 'dim', style: { fontSize: '13px' } },
              `· started ${new Date(running.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`),
          ),
        ),
        h('div', { class: 'timer-side' },
          h('div', { class: 'elapsed-label' }, 'Elapsed'),
          el,
          h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '18px' } },
            h('button', {
              class: 'btn btn-ghost',
              onclick: async () => {
                try { await discardTimer(); toast('Timer discarded — nothing logged'); draw(); } catch (e) { fail(e); }
              },
            }, 'Discard'),
            h('button', {
              class: 'btn btn-primary',
              onclick: async (e) => {
                e.target.disabled = true;
                try {
                  const res = await stopTimer();
                  toast(res.entry ? `Logged ${hm(res.entry.minutes)}` : 'Under a minute — nothing logged',
                    res.entry ? 'success' : '');
                  await refreshStats();
                  draw();
                } catch (err) { e.target.disabled = false; fail(err); }
              },
            }, icon('stop'), 'Stop'),
          ),
        ),
      );
    }

    const projSel = select(projectOptions(state.projects), { placeholder: 'No project', cls: 'select' });
    const taskSel = select(taskOptions(state.tasks.filter((t) => t.assigneeId === state.user.id)), {
      placeholder: 'No task',
    });
    projSel.addEventListener('change', () => {
      const opts = taskOptions(state.tasks.filter((t) => t.assigneeId === state.user.id), projSel.value);
      taskSel.replaceChildren(h('option', { value: '' }, 'No task'),
        ...opts.map((o) => h('option', { value: String(o.value) }, o.label)));
    });
    const noteInput = h('input', { class: 'input', type: 'text', placeholder: 'What are you working on?', maxlength: '500' });

    const begin = async () => {
      try {
        const res = await startTimer({
          projectId: projSel.value ? Number(projSel.value) : null,
          taskId: taskSel.value ? Number(taskSel.value) : null,
          note: noteInput.value,
        });
        if (res.banked) toast(`Banked ${hm(res.banked.minutes)} on the previous timer`);
        draw();
      } catch (e) { fail(e); }
    };
    noteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') begin(); });

    return h('div', { class: 'card timer-card' },
      h('div', null,
        h('div', { class: 'eyebrow', style: { marginBottom: '14px' } }, 'Start the clock'),
        h('div', { class: 'timer-fields' },
          h('label', { class: 'field' }, h('span', { class: 'label' }, 'Project'), projSel),
          h('label', { class: 'field' }, h('span', { class: 'label' }, 'Task'), taskSel),
          h('label', { class: 'field note' }, h('span', { class: 'label' }, 'Note'), noteInput),
        ),
      ),
      h('div', { class: 'timer-side' },
        h('div', { class: 'elapsed-label' }, 'Not running'),
        h('div', { class: 'elapsed idle' }, '0:00'),
        h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '18px' } },
          h('button', { class: 'btn btn-secondary', onclick: () => entryEditor(null, {}, async () => { await refreshStats(); draw(); }) },
            'Log manually'),
          h('button', { class: 'btn btn-primary', onclick: begin }, icon('play'), 'Start'),
        ),
      ),
    );
  }

  function startTick() {
    clearInterval(tick);
    if (!state.timer) return;
    tick = setInterval(() => {
      const el = document.getElementById('elapsed');
      if (!el) return clearInterval(tick);
      el.textContent = clock(timerSeconds());
    }, 1000);
  }

  /* ---------------------------------------------------------- progress -- */

  function progressCard(pct, logged, target) {
    const remaining = Math.max(0, target - logged);
    return h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', null, 'Daily target')),
      h('div', { class: 'ring-wrap' },
        ring(pct, { caption: 'of target' }),
        h('div', null,
          h('div', { style: { fontSize: '22px', fontWeight: '800', color: '#fff' } }, hm(logged, { zero: '0h' })),
          h('div', { class: 'dim', style: { fontSize: '13px', marginTop: '4px' } },
            target ? `of ${hm(target)}` : 'no target set'),
          target ? h('div', {
            class: 'pill', style: { marginTop: '12px' },
          }, remaining ? `${hm(remaining)} to go` : 'Target met ✓') : null,
        ),
      ),
    );
  }

  /* ------------------------------------------------------------- focus -- */

  function focusCard(mine) {
    // Overdue and due-today first, then in-progress — the things that actually
    // want attention before anything else on the list.
    const focus = [...mine]
      .sort((a, b) => {
        const rank = (t) => (t.dueDate && t.dueDate <= todayDate() ? 0 : t.status === 'doing' ? 1 : 2);
        return rank(a) - rank(b) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      })
      .slice(0, 6);

    return h('div', { class: 'card', style: { padding: '0' } },
      h('div', { class: 'card-head', style: { padding: '20px 20px 0', marginBottom: '12px' } },
        h('h3', null, 'Your focus'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => taskEditor(null, {}, draw) }, icon('plus'), 'Add'),
      ),
      focus.length
        ? h('div', null, focus.map((t) => taskLine(t)))
        : empty({ title: 'Nothing on your plate', subtitle: 'Add a task and it will show up here.' }),
    );
  }

  function taskLine(t) {
    const project = projectById(t.projectId);
    const overdue = t.dueDate && t.dueDate < todayDate();
    const dueTodayFlag = t.dueDate === todayDate();

    return h('div', { class: 'task' },
      h('button', {
        class: 'task-check', title: 'Mark done', type: 'button',
        onclick: async () => {
          try { await saveTask(t.id, { status: 'done' }); toast('Task completed', 'success'); draw(); } catch (e) { fail(e); }
        },
      }, h('span', { html: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>' })),
      h('div', { class: 'task-body' },
        h('div', { class: 'task-title' }, t.title),
        h('div', { class: 'task-meta' },
          project ? h('span', { class: 'dot-tag' },
            h('span', { class: 'dot', style: { background: project.color } }),
            h('span', { class: 'dim' }, project.name)) : null,
          t.dueDate ? h('span', { class: overdue ? 'due-over' : dueTodayFlag ? 'due-soon' : '' },
            overdue ? `Overdue · ${relativeDay(t.dueDate)}` : `Due ${relativeDay(t.dueDate)}`) : null,
          t.status === 'doing' ? h('span', { class: 'pill' }, 'In progress') : null,
        ),
      ),
      h('div', { class: 'task-side' },
        h('button', {
          class: 'btn-icon', title: 'Start timer on this task', type: 'button',
          onclick: async () => {
            try { await startTimer({ projectId: t.projectId, taskId: t.id, note: '' }); draw(); } catch (e) { fail(e); }
          },
        }, icon('play')),
      ),
    );
  }

  /* ----------------------------------------------------------- entries -- */

  function entriesCard() {
    const entries = state.todayEntries;
    const total = todayMinutes();

    return h('div', { class: 'card', style: { padding: '0' } },
      h('div', { class: 'card-head', style: { padding: '20px 20px 16px', marginBottom: '0' } },
        h('h3', null, "Today's entries"),
        h('span', { class: 'spacer' }),
        h('span', { class: 'dim', style: { fontSize: '13px' } }, total ? hm(total) : null),
        h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: () => entryEditor(null, {}, async () => { await refreshStats(); draw(); }),
        }, icon('plus'), 'Log time'),
      ),
      entries.length
        ? h('div', { class: 'table-wrap', style: { border: 'none', borderRadius: '0' } },
          h('table', { class: 'table' },
            h('tbody', null, entries.map((e) => h('tr', null,
              h('td', null,
                h('div', { class: 'dot-tag' },
                  h('span', { class: 'dot', style: { background: e.projectColor || '#3a3a3a' } }),
                  e.projectName || 'No project'),
                e.taskTitle || e.note
                  ? h('div', { class: 'dim', style: { fontSize: '12px', marginTop: '4px' } }, e.taskTitle || e.note)
                  : null,
              ),
              h('td', { class: 'shrink' },
                e.source === 'timer' ? h('span', { class: 'pill' }, 'Timer') : null,
                !e.billable ? h('span', { class: 'pill badge-info', style: { marginLeft: '6px' } }, 'Non-billable') : null,
              ),
              h('td', { class: 'num shrink', style: { fontWeight: '700' } }, hm(e.minutes)),
              h('td', { class: 'actions' },
                h('button', {
                  class: 'btn-icon', title: 'Edit entry',
                  onclick: () => entryEditor(e, {}, async () => { await refreshStats(); draw(); }),
                }, icon('pencil')),
              ),
            ))),
          ))
        : empty({
          title: 'No time logged yet today',
          subtitle: 'Start the timer above, or log a block of time by hand.',
          action: h('button', {
            class: 'btn btn-secondary',
            onclick: () => entryEditor(null, {}, async () => { await refreshStats(); draw(); }),
          }, 'Log time'),
        }),
    );
  }

  /* ------------------------------------------------------------- stats -- */

  async function refreshStats() {
    try {
      const weekFrom = startOfWeek(todayDate(), state.user.weekStart);
      const report = await api.report({ from: weekFrom, to: addDays(weekFrom, 6), scope: 'me' });
      weekMinutes = report.totals.minutes;
      streak = report.streak || streak;
    } catch {
      // The page is still useful without the week/streak numbers.
    }
  }

  draw();
  refreshStats().then(draw);

  return () => clearInterval(tick);
}

export { render_ as render };
