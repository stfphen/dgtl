/* Tasks — the shared to-do list. Filter by project, person and state; drag to
   reorder; one click to complete or to start timing. */

import { h, hm, pluralize, relativeDay, today as todayDate } from '../util.js';
import {
  avatar, empty, fail, icon, projectOptions, render, select, toast, userOptions,
} from '../ui.js';
import { taskEditor } from '../editors.js';
import { projectById, reorderTasks, saveTask, startTimer, state, userById } from '../store.js';

export const title = 'Tasks';
export const subtitle = () => 'Everything the team has on';

const FILTERS = [
  { key: 'open', label: 'Open', match: (t) => t.status !== 'done' },
  { key: 'doing', label: 'In progress', match: (t) => t.status === 'doing' },
  { key: 'due', label: 'Due', match: (t) => t.status !== 'done' && t.dueDate && t.dueDate <= todayDate() },
  { key: 'done', label: 'Done', match: (t) => t.status === 'done' },
  { key: 'all', label: 'All', match: () => true },
];

export function render_(host, { actions }) {
  const ui = { filter: 'open', projectId: '', assigneeId: String(state.user.id) };
  const list = h('div');
  const summary = h('div', { class: 'dim', style: { fontSize: '13px' } });

  const projFilter = select([{ value: '', label: 'All projects' }, ...projectOptions(state.projects)], { cls: 'select sm' });
  const whoFilter = select(
    [{ value: '', label: 'Everyone' }, ...userOptions(state.users)],
    { value: String(state.user.id), cls: 'select sm' },
  );
  projFilter.addEventListener('change', () => { ui.projectId = projFilter.value; draw(); });
  whoFilter.addEventListener('change', () => { ui.assigneeId = whoFilter.value; draw(); });

  const chips = h('div', { class: 'row tight' }, FILTERS.map((f) =>
    h('button', {
      class: `chip${ui.filter === f.key ? ' on' : ''}`, dataset: { filter: f.key },
      onclick: () => { ui.filter = f.key; draw(); },
    }, f.label)));

  render(actions,
    chips,
    projFilter,
    whoFilter,
    h('button', { class: 'btn btn-primary', onclick: () => taskEditor(null, {}, draw) }, icon('plus'), 'New task'),
  );

  host.append(h('div', { class: 'stack' },
    h('div', { class: 'card', style: { padding: '0' } },
      h('div', { class: 'card-head', style: { padding: '18px 20px', marginBottom: '0', borderBottom: '1px solid var(--border)' } },
        h('h3', null, 'To-do'),
        h('span', { class: 'spacer' }),
        summary,
      ),
      list,
    ),
  ));

  /* --------------------------------------------------------- rendering -- */

  function visible() {
    const f = FILTERS.find((x) => x.key === ui.filter);
    return state.tasks.filter((t) =>
      !t.archived
      && f.match(t)
      && (!ui.projectId || t.projectId === Number(ui.projectId))
      && (!ui.assigneeId || t.assigneeId === Number(ui.assigneeId)));
  }

  function draw() {
    for (const c of chips.children) c.classList.toggle('on', c.dataset.filter === ui.filter);

    const rows = visible();
    const est = rows.reduce((s, t) => s + (t.estimateMinutes || 0), 0);
    summary.textContent = rows.length
      ? `${pluralize(rows.length, 'task')}${est ? ` · ${hm(est)} estimated` : ''}`
      : '';

    if (!rows.length) {
      render(list, empty({
        title: ui.filter === 'done' ? 'Nothing completed yet' : 'Nothing here',
        subtitle: ui.filter === 'open'
          ? 'Add the first task and it will show up for whoever it is assigned to.'
          : 'Try a different filter, or clear the person and project filters.',
        action: h('button', { class: 'btn btn-primary', onclick: () => taskEditor(null, {}, draw) }, icon('plus'), 'New task'),
      }));
      return;
    }
    render(list, rows.map((t) => row(t, rows)));
  }

  function row(t, siblings) {
    const project = projectById(t.projectId);
    const who = userById(t.assigneeId);
    const done = t.status === 'done';
    const overdue = !done && t.dueDate && t.dueDate < todayDate();
    const over = t.estimateMinutes && t.loggedMinutes > t.estimateMinutes;

    const el = h('div', {
      class: `task${done ? ' is-done' : ''}`,
      draggable: ui.filter !== 'done',
      dataset: { id: String(t.id) },
    },
      h('span', { class: 'grip', title: 'Drag to reorder', html: icon('grip').innerHTML }),

      h('button', {
        class: `task-check${done ? ' done' : ''}`, type: 'button',
        title: done ? 'Mark as not done' : 'Mark done',
        onclick: async () => {
          try {
            await saveTask(t.id, { status: done ? 'todo' : 'done' });
            if (!done) toast('Task completed', 'success');
            draw();
          } catch (e) { fail(e); }
        },
      }, h('span', { html: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>' })),

      h('div', { class: 'task-body' },
        h('div', { class: 'task-title' }, t.title),
        h('div', { class: 'task-meta' },
          project ? h('span', { class: 'dot-tag' },
            h('span', { class: 'dot', style: { background: project.color } }),
            h('span', { class: 'dim' }, project.name)) : null,
          t.priority !== 'normal'
            ? h('span', { class: t.priority === 'high' ? 'prio-high' : 'prio-low' },
              t.priority === 'high' ? 'High priority' : 'Low priority')
            : null,
          t.dueDate && !done
            ? h('span', { class: overdue ? 'due-over' : t.dueDate === todayDate() ? 'due-soon' : '' },
              overdue ? `Overdue · ${relativeDay(t.dueDate)}` : `Due ${relativeDay(t.dueDate)}`)
            : null,
          t.loggedMinutes || t.estimateMinutes
            ? h('span', { class: over ? 'due-soon' : '' },
              `${hm(t.loggedMinutes, { zero: '0h' })}${t.estimateMinutes ? ` of ${hm(t.estimateMinutes)}` : ' logged'}`)
            : null,
          t.status === 'doing' ? h('span', { class: 'pill' }, 'In progress') : null,
        ),
      ),

      who ? avatar(who.name, true) : null,

      h('div', { class: 'task-side' },
        !done ? h('button', {
          class: 'btn-icon', title: 'Start timer on this task', type: 'button',
          onclick: async () => {
            try { await startTimer({ projectId: t.projectId, taskId: t.id, note: '' }); toast('Timer started', 'success'); draw(); } catch (e) { fail(e); }
          },
        }, icon('play')) : null,
        h('button', { class: 'btn-icon', title: 'Edit task', onclick: () => taskEditor(t, {}, draw) }, icon('pencil')),
      ),
    );

    wireDrag(el, t, siblings);
    return el;
  }

  /* ------------------------------------------------------------- drag --- */
  /* Native HTML5 drag. The dragged row is remembered on the module scope so a
     drop knows what moved; order is written back with one reorder call. */

  let dragId = null;

  function wireDrag(el, t, siblings) {
    el.addEventListener('dragstart', (e) => {
      dragId = t.id;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(t.id));
    });
    el.addEventListener('dragend', () => {
      dragId = null;
      el.classList.remove('dragging');
      for (const n of list.children) n.classList.remove('drop-before', 'drop-after');
    });
    el.addEventListener('dragover', (e) => {
      if (dragId === null || dragId === t.id) return;
      e.preventDefault();
      const box = el.getBoundingClientRect();
      const after = e.clientY > box.top + box.height / 2;
      el.classList.toggle('drop-before', !after);
      el.classList.toggle('drop-after', after);
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop-before', 'drop-after'));
    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      const after = el.classList.contains('drop-after');
      el.classList.remove('drop-before', 'drop-after');
      if (dragId === null || dragId === t.id) return;

      const order = siblings.map((s) => s.id).filter((id) => id !== dragId);
      const at = order.indexOf(t.id) + (after ? 1 : 0);
      order.splice(at, 0, dragId);

      // Reordering a filtered view must not shuffle the tasks it hides, so the
      // new order is spliced back into the full list before saving.
      const all = state.tasks.map((x) => x.id);
      const slots = all.map((id, i) => (order.includes(id) ? i : -1)).filter((i) => i >= 0);
      const merged = [...all];
      slots.forEach((slot, i) => { merged[slot] = order[i]; });

      try { await reorderTasks(merged); draw(); } catch (err) { fail(err); }
    });
  }

  draw();
}

export { render_ as render };
