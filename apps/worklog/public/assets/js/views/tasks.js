/* Tasks — the shared to-do list, read the way the work is actually organised:
   client → project → tasks. Filter by project, person and state; sort by any
   column; drag to reorder; one click to complete or to start timing. */

import { h, hm, pluralize, relativeDay, today as todayDate } from '../util.js';
import {
  avatar, empty, fail, groupByClient, icon, icons, mergeRollups, projectOptions, render,
  ring, rollup, select, sortButton, sorter, toast, userOptions,
} from '../ui.js';
import { taskEditor } from '../editors.js';
import { completeTask, projectById, reorderTasks, saveTask, startTimer, state, userById } from '../store.js';

export const title = 'Tasks';
export const subtitle = () => 'Everything the team has on';

const FILTERS = [
  { key: 'open', label: 'Open', match: (t) => t.status !== 'done' },
  { key: 'doing', label: 'In progress', match: (t) => t.status === 'doing' },
  { key: 'due', label: 'Due', match: (t) => t.status !== 'done' && t.dueDate && t.dueDate <= todayDate() },
  { key: 'done', label: 'Done', match: (t) => t.status === 'done' },
  { key: 'all', label: 'All', match: () => true },
];

/* Sections folded shut, by key. Module scope on purpose: a re-render — and a
   trip to another screen and back — leaves the board folded the way you left
   it, for as long as the tab is open. */
const collapsed = new Set();

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 };

const COLUMNS = [
  // Manual order first, and it is the default: the drag handle only means
  // anything while the list is in the order somebody dragged it into.
  { key: 'order', label: 'Order', get: (t) => t.position },
  { key: 'title', label: 'Task', get: (t) => t.title.toLowerCase() },
  { key: 'priority', label: 'Priority', get: (t) => PRIORITY_RANK[t.priority] ?? 1 },
  { key: 'due', label: 'Due', get: (t) => t.dueDate || null },
  { key: 'logged', label: 'Logged', num: true, dir: 'desc', get: (t) => t.loggedMinutes || 0 },
  { key: 'assignee', label: 'Assignee', get: (t) => userById(t.assigneeId)?.name.toLowerCase() || null },
];

/* Time filed against no project at all — the section that would otherwise
   swallow it. Shaped like a project so the same code renders it. */
const NO_PROJECT = () => ({
  id: null, name: 'No project', color: 'var(--nil)', code: '',
  clientId: null, clientName: null, budgetMinutes: null,
  loggedMinutes: state.unassigned?.minutes || 0,
});

export function render_(host, { actions }) {
  const ui = { filter: 'open', projectId: '', assigneeId: String(state.user.id) };
  const sort = sorter(COLUMNS, { key: 'order', dir: 'asc' });

  const board = h('div', { class: 'board' });
  const summary = h('div', { class: 'dim', style: { fontSize: '13px' } });
  const foldAll = h('button', { class: 'btn btn-ghost btn-sm', onclick: () => toggleAll() });
  const sortHint = h('div', { class: 'sort-hint' });

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

  // Rebuilt on every draw, not once at mount: a sort button paints which
  // column is active and which way it points at the moment it is built, so a
  // strip built once keeps highlighting whatever was active when the view
  // opened while the rows underneath it quietly re-sort.
  const sortStrip = h('div', { class: 'sort-strip' });
  const drawSortStrip = () => render(sortStrip,
    h('span', { class: 'sort-lead' }, 'Sort'),
    COLUMNS.map((c) => sortButton(c, sort, draw)));

  host.append(h('div', { class: 'stack' },
    h('div', { class: 'card', style: { padding: '0' } },
      h('div', { class: 'card-head board-head' },
        h('h3', null, 'To-do'),
        h('span', { class: 'spacer' }),
        summary,
        foldAll,
      ),
      sortStrip,
      sortHint,
      board,
    ),
  ));

  /* --------------------------------------------------------- selection -- */

  const dragging = () => sort.key === 'order' && sort.dir === 'asc';

  function visible() {
    const f = FILTERS.find((x) => x.key === ui.filter);
    return state.tasks.filter((t) =>
      !t.archived
      && f.match(t)
      && (!ui.projectId || t.projectId === Number(ui.projectId))
      && (!ui.assigneeId || t.assigneeId === Number(ui.assigneeId)));
  }

  /**
   * Every non-archived task on a project, filters ignored.
   *
   * A section's ring measures the workstream, not the slice you are looking
   * at. Measured over the filtered rows instead, the default "Open" filter
   * would put every completion ring on the board at 0% — which is the exact
   * opposite of the thing the rings exist to show.
   */
  const allTasksOn = (projectId) =>
    state.tasks.filter((t) => !t.archived && (t.projectId ?? null) === projectId);

  /** Sections, built from the rows a filter left standing. */
  function sections(rows) {
    const byProject = new Map();
    for (const t of rows) {
      const key = t.projectId ?? null;
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key).push(t);
    }
    const shown = state.projects.filter((p) => byProject.has(p.id));
    if (byProject.has(null)) shown.push(NO_PROJECT());

    return groupByClient(shown).map((group) => {
      const projects = group.projects.map((p) => ({
        project: p,
        rows: sort.apply(byProject.get(p.id)),
        stats: rollup(allTasksOn(p.id), {
          loggedMinutes: p.loggedMinutes || 0,
          budgetMinutes: p.budgetMinutes,
        }),
      }));
      return { ...group, projects, stats: mergeRollups(projects.map((p) => p.stats)) };
    });
  }

  /* --------------------------------------------------------- rendering -- */

  function draw() {
    for (const c of chips.children) c.classList.toggle('on', c.dataset.filter === ui.filter);
    drawSortStrip();

    const rows = visible();
    const est = rows.reduce((s, t) => s + (t.estimateMinutes || 0), 0);
    summary.textContent = rows.length
      ? `${pluralize(rows.length, 'task')}${est ? ` · ${hm(est)} estimated` : ''}`
      : '';

    sortHint.hidden = dragging();
    sortHint.textContent = dragging() ? ''
      : `Sorted by ${COLUMNS.find((c) => c.key === sort.key)?.label} — pick Order to drag rows again.`;

    if (!rows.length) {
      foldAll.hidden = true;
      render(board, empty({
        title: ui.filter === 'done' ? 'Nothing completed yet' : 'Nothing here',
        subtitle: ui.filter === 'open'
          ? 'Add the first task and it will show up for whoever it is assigned to.'
          : 'Try a different filter, or clear the person and project filters.',
        action: h('button', { class: 'btn btn-primary', onclick: () => taskEditor(null, {}, draw) }, icon('plus'), 'New task'),
      }));
      return;
    }

    const groups = sections(rows);
    foldAll.hidden = false;
    foldAll.textContent = anyOpen(groups) ? 'Collapse all' : 'Expand all';
    render(board, groups.map(clientSection));
  }

  const keysIn = (groups) => groups.flatMap((g) =>
    [`client:${g.key}`, ...g.projects.map((p) => `project:${p.project.id}`)]);

  const anyOpen = (groups) => keysIn(groups).some((k) => !collapsed.has(k));

  function toggleAll() {
    const groups = sections(visible());
    const keys = keysIn(groups);
    if (anyOpen(groups)) for (const k of keys) collapsed.add(k);
    else for (const k of keys) collapsed.delete(k);
    draw();
  }

  /**
   * The two figures a section header states, in words.
   *
   * The effort half names its own denominator — task estimates where there are
   * any, the project budget where there are not — because "of 5h" means two
   * different promises and a reader cannot tell them apart from a percentage.
   */
  function statLine(s, shownCount) {
    const parts = [`${s.done} of ${pluralize(s.total, 'task')} done`];
    if (s.target) {
      const noun = s.basis === 'budget' ? 'budget' : s.basis === 'mixed' ? 'planned' : 'estimated';
      parts.push(`${hm(s.loggedMinutes, { zero: '0h' })} of ${hm(s.target)} ${noun} · ${Math.round(s.effortPct)}%`);
    } else {
      parts.push(s.loggedMinutes ? `${hm(s.loggedMinutes)} logged, no estimate` : 'no estimate');
    }
    // Hours the ratio above could not count, named rather than folded in.
    if (s.unplannedMinutes && s.target) parts.push(`${hm(s.unplannedMinutes)} unplanned`);
    if (shownCount !== undefined && shownCount !== s.total) parts.push(`${shownCount} shown`);
    return parts.join(' · ');
  }

  function sectionRing(s) {
    const effort = s.target
      ? `${hm(s.loggedMinutes, { zero: '0h' })} of ${hm(s.target)} — ${Math.round(s.effortPct)}%`
      : `${hm(s.loggedMinutes, { zero: 'nothing' })} logged, no estimate to measure it against`;
    return ring(s.donePct ?? 0, {
      size: 44, stroke: 5, center: false, inner: s.effortPct,
      title: `Tasks ${s.done}/${s.total}. Time ${effort}.`,
    });
  }

  /** A collapsible section: clickable strip, a chevron that carries the state. */
  function shell(key, ringEl, nameNode, stats, bodyNodes, cls) {
    const open = !collapsed.has(key);
    const flip = () => { if (open) collapsed.add(key); else collapsed.delete(key); draw(); };

    // The strip is the target — a 44px chevron is not what anyone aims at. The
    // button is still a real button so it is reachable by keyboard and can
    // carry aria-expanded; it stops the click it just handled from arriving a
    // second time on the strip behind it.
    const chev = h('button', {
      class: 'sec-toggle', type: 'button', 'aria-expanded': String(open),
      'aria-label': open ? 'Collapse section' : 'Expand section',
      onclick: (e) => { e.stopPropagation(); flip(); },
    }, h('span', { class: 'sec-chev', html: icons.chevron }));

    const head = h('div', { class: `sec-head ${cls}`, onclick: () => flip() },
      chev,
      ringEl,
      h('span', { class: 'sec-what' },
        h('span', { class: 'sec-name' }, nameNode),
        h('span', { class: 'sec-stats' }, stats),
      ),
    );
    return h('section', { class: `sec ${cls}${open ? '' : ' folded'}` },
      head,
      open ? h('div', { class: 'sec-body' }, bodyNodes()) : null,
    );
  }

  function clientSection(group) {
    const label = group.clientId
      ? group.name
      : h('span', null, 'No client', h('span', { class: 'sec-note' }, 'internal, or unfiled'));

    return shell(
      `client:${group.key}`,
      sectionRing(group.stats),
      [label, h('span', { class: 'sec-sub' }, pluralize(group.projects.length, 'project'))],
      statLine(group.stats),
      () => group.projects.map(projectSection),
      'is-client',
    );
  }

  function projectSection({ project, rows, stats }) {
    return shell(
      `project:${project.id}`,
      sectionRing(stats),
      [
        h('span', { class: 'dot', style: { background: project.color } }),
        project.name,
        project.code ? h('span', { class: 'mono-code' }, project.code) : null,
      ],
      statLine(stats, rows.length),
      () => h('div', { class: 'sec-rows' }, rows.map((t) => row(t, rows, project.id))),
      'is-project',
    );
  }

  function row(t, siblings, sectionId) {
    const project = projectById(t.projectId);
    const who = userById(t.assigneeId);
    const done = t.status === 'done';
    const overdue = !done && t.dueDate && t.dueDate < todayDate();
    const over = t.estimateMinutes && t.loggedMinutes > t.estimateMinutes;
    const drag = dragging() && ui.filter !== 'done';

    const el = h('div', {
      class: `task${done ? ' is-done' : ''}`,
      draggable: drag,
      dataset: { id: String(t.id) },
    },
      // A real button, not a decorated span: dragging is the only way this row
      // moves, and HTML5 drag answers to a mouse alone. Focus it and the arrow
      // keys move the row; press it and the row is lifted, and the next row
      // pressed is where it lands — which is the whole feature's only route in
      // from a touchscreen.
      drag
        ? h('button', {
          class: `grip${lifted === t.id ? ' lifted' : ''}`, type: 'button',
          'aria-label': `Reorder ${t.title}`,
          'aria-pressed': String(lifted === t.id),
          title: lifted === t.id
            ? 'Lifted — pick the row to drop it on, or press Escape'
            : 'Drag to reorder · arrow keys move it · press to lift',
          html: icon('grip').innerHTML,
          onclick: (e) => { e.stopPropagation(); toggleLift(t, sectionId); },
          onkeydown: (e) => gripKeys(e, t, siblings, sectionId),
        })
        : h('span', { class: 'grip-off' }),

      h('button', {
        class: `task-check${done ? ' done' : ''}`, type: 'button',
        title: done ? 'Mark as not done' : 'Mark done',
        onclick: async () => {
          try {
            if (done) {
              await saveTask(t.id, { status: 'todo' });
            } else {
              // A repeating task's completion writes next week's instance, and
              // the toast is where that gets said. Silently, the board simply
              // grows a row that looks like the one just ticked off.
              const { next } = await completeTask(t.id);
              toast(next
                ? `Task completed · next one due ${relativeDay(next.dueDate)}`
                : 'Task completed', 'success');
            }
            draw();
          } catch (e) { fail(e); }
        },
      }, h('span', { html: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>' })),

      h('div', { class: 'task-body' },
        h('div', { class: 'task-title' }, t.title),
        h('div', { class: 'task-meta' },
          // The project is the section this row is already inside, so it is
          // only worth repeating when the row is filed somewhere else.
          project && project.id !== sectionId ? h('span', { class: 'dot-tag' },
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
          // Shown on the finished row too: it is what explains the identical
          // row that appeared above it the moment this one was ticked off.
          // Words, not a glyph — ui.js carries no repeat icon, and an
          // approximate one (the clock, the arrow) would have to be learnt.
          t.recurrence ? h('span', { class: 'repeats' },
            t.recurrence === 'monthly' ? 'Repeats monthly' : 'Repeats weekly') : null,
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

    if (drag) wireDrag(el, t, siblings, sectionId);
    return el;
  }

  /* ------------------------------------------------ reordering a row --- */
  /* Three routes to the same one reorder call, because native HTML5 drag is
     only the mouse's. It fires on no touchscreen and there is no key that
     starts it, so until the grip became a button this whole feature had no
     access route from either — the rows could be dragged or they could not be
     moved at all. The keyboard route is the arrow keys on the focused grip;
     the touch route is press-to-lift, then press the row to land on.

     All three refuse to cross a section: moving a task under another project
     would be a re-filing, not a reorder, and re-filing hours-bearing work by
     dropping it somewhere is not a thing to do by accident. The editor moves
     a task between projects. */

  let dragId = null;
  let dragSection;
  let lifted = null;                 // the keyboard/touch equivalent of dragId
  let liftedSection;

  /**
   * Write a section's new order back.
   *
   * Reordering a filtered view must not shuffle the tasks it hides, so the new
   * order is spliced back into the slots the full list already holds.
   */
  async function commitOrder(order) {
    const all = state.tasks.map((x) => x.id);
    const slots = all.map((id, i) => (order.includes(id) ? i : -1)).filter((i) => i >= 0);
    const merged = [...all];
    slots.forEach((slot, i) => { merged[slot] = order[i]; });
    await reorderTasks(merged);
  }

  /** Put `id` at `index` among its siblings, redraw, and keep the focus on it. */
  async function moveTo(id, siblings, index) {
    const order = siblings.map((s) => s.id).filter((x) => x !== id);
    order.splice(Math.max(0, Math.min(order.length, index)), 0, id);
    try {
      await commitOrder(order);
      draw();
      // draw() replaced the row, so the button that was focused no longer
      // exists — without this, one press moves the task and loses the handle.
      board.querySelector(`.task[data-id="${id}"] .grip`)?.focus();
    } catch (e) { fail(e); }
  }

  /** Lift a row, or set it down again. The touch route: press, then press a row. */
  function toggleLift(t, sectionId) {
    lifted = lifted === t.id ? null : t.id;
    liftedSection = lifted === null ? undefined : sectionId;
    draw();
    board.querySelector(`.task[data-id="${t.id}"] .grip`)?.focus();
  }

  /** Arrow keys move the focused row one place; Escape sets a lifted one down. */
  function gripKeys(e, t, siblings, sectionId) {
    if (e.key === 'Escape' && lifted !== null) {
      e.preventDefault();
      toggleLift(t, sectionId);
      return;
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const at = siblings.findIndex((s) => s.id === t.id);
    const to = at + (e.key === 'ArrowUp' ? -1 : 1);
    if (at < 0 || to < 0 || to >= siblings.length) return;
    e.preventDefault();                       // or the page scrolls under it
    lifted = null;
    moveTo(t.id, siblings, to);
  }

  function wireDrag(el, t, siblings, sectionId) {
    const foreign = () => dragId === null || dragId === t.id || dragSection !== sectionId;

    // Where a lifted row lands. Refused across sections for the same reason a
    // drop is: moving a task under another project is a re-filing, not a
    // reorder. A press on one of the row's own controls is that control's.
    el.addEventListener('click', (e) => {
      if (lifted === null || lifted === t.id || liftedSection !== sectionId) return;
      if (e.target.closest('button, a, input, select, textarea')) return;
      const at = siblings.findIndex((s) => s.id === t.id);
      const moving = lifted;
      lifted = null;
      moveTo(moving, siblings, at);
    });

    el.addEventListener('dragstart', (e) => {
      dragId = t.id;
      dragSection = sectionId;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(t.id));
    });
    el.addEventListener('dragend', () => {
      dragId = null;
      el.classList.remove('dragging');
      for (const n of board.querySelectorAll('.task')) n.classList.remove('drop-before', 'drop-after');
    });
    el.addEventListener('dragover', (e) => {
      if (foreign()) return;
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
      if (foreign()) return;

      const order = siblings.map((s) => s.id).filter((id) => id !== dragId);
      const at = order.indexOf(t.id) + (after ? 1 : 0);
      order.splice(at, 0, dragId);

      try { await commitOrder(order); draw(); } catch (err) { fail(err); }
    });
  }

  draw();
}

export { render_ as render };
