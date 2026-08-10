/* Timesheet — the week grid you fill in, and the month calendar you look back
   over. The calendar is the habit tracker's month history, coloured by hours
   instead of check-ins. */

import {
  addDays, addMonths, dayNum, dayShort, endOfMonth, h, hm, dec, monthYear,
  range, relativeDay, startOfMonth, startOfWeek, today as todayDate, dateMed, isWeekend,
} from '../util.js';
import { empty, fail, icon, modal, render, select, userOptions } from '../ui.js';
import { entryEditor } from '../editors.js';
import { isAdmin, projectById, state } from '../store.js';
import { api } from '../api.js';

export const title = 'Timesheet';
export const subtitle = () => 'Hours by day';

export function render_(host, { actions }) {
  const ui = {
    mode: 'week',
    anchor: todayDate(),
    userId: String(state.user.id),
  };
  let entries = [];
  let loading = true;

  const body = h('div', { class: 'stack' });
  const label = h('div', { style: { fontSize: '14px', fontWeight: '700', color: '#fff', minWidth: '150px', textAlign: 'center' } });
  host.append(body);

  /* ------------------------------------------------------------ chrome -- */

  const modeSeg = h('div', { class: 'seg' },
    h('button', { class: 'on', dataset: { mode: 'week' }, onclick: () => setMode('week') }, 'Week'),
    h('button', { dataset: { mode: 'month' }, onclick: () => setMode('month') }, 'Month'),
  );

  const whoSel = select(
    [...(isAdmin() ? [{ value: '', label: 'Whole team' }] : []), ...userOptions(state.users)],
    { value: String(state.user.id), cls: 'select sm' },
  );
  whoSel.addEventListener('change', () => { ui.userId = whoSel.value; load(); });

  render(actions,
    modeSeg,
    h('div', { class: 'row tight' },
      h('button', { class: 'btn-icon', title: 'Previous', onclick: () => step(-1) }, icon('left')),
      label,
      h('button', { class: 'btn-icon', title: 'Next', onclick: () => step(1) }, icon('right')),
    ),
    h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { ui.anchor = todayDate(); load(); } }, 'Today'),
    whoSel,
    h('button', {
      class: 'btn btn-primary',
      onclick: () => entryEditor(null, { date: inRange(todayDate()) ? todayDate() : bounds().from }, load),
    }, icon('plus'), 'Log time'),
  );

  function setMode(mode) {
    ui.mode = mode;
    for (const b of modeSeg.children) b.classList.toggle('on', b.dataset.mode === mode);
    load();
  }

  const step = (n) => {
    ui.anchor = ui.mode === 'week' ? addDays(ui.anchor, n * 7) : addMonths(ui.anchor, n);
    load();
  };

  const bounds = () => (ui.mode === 'week'
    ? { from: startOfWeek(ui.anchor, state.user.weekStart), to: addDays(startOfWeek(ui.anchor, state.user.weekStart), 6) }
    : { from: startOfMonth(ui.anchor), to: endOfMonth(ui.anchor) });

  const inRange = (d) => {
    const { from, to } = bounds();
    return d >= from && d <= to;
  };

  /* -------------------------------------------------------------- data -- */

  async function load() {
    const { from, to } = bounds();
    label.textContent = ui.mode === 'week'
      ? (from.slice(0, 7) === to.slice(0, 7)
        ? `${dayNum(from)}–${dateMed(to)}`
        : `${dateMed(from)} – ${dateMed(to)}`)
      : monthYear(ui.anchor);

    loading = true;
    draw();
    try {
      const res = await api.entries(ui.userId
        ? { from, to, userId: ui.userId }
        : { from, to, scope: 'team' });
      entries = res.entries;
    } catch (e) {
      entries = [];
      fail(e);
    }
    loading = false;
    draw();
  }

  const minutesOn = (date, projectId = undefined) => entries.reduce((sum, e) =>
    sum + ((e.date === date && (projectId === undefined || e.projectId === projectId)) ? e.minutes : 0), 0);

  /* -------------------------------------------------------------- draw -- */

  function draw() {
    if (loading) {
      render(body, h('div', { class: 'card' },
        h('div', { class: 'skeleton', style: { height: '280px' } })));
      return;
    }
    render(body, ui.mode === 'week' ? weekView() : monthView(), totalsCard());
  }

  function weekView() {
    const { from, to } = bounds();
    const days = range(from, to);

    // Rows: every project with time this week, plus the active ones, so the
    // grid is a thing you can fill in rather than only a thing you read.
    const used = new Set(entries.map((e) => e.projectId));
    const rows = state.projects.filter((p) => p.status === 'active' || used.has(p.id));
    if (entries.some((e) => e.projectId === null)) rows.push({ id: null, name: 'No project', color: '#3a3a3a' });

    if (!rows.length) {
      return h('div', { class: 'card' }, empty({
        title: 'No projects yet',
        subtitle: isAdmin() ? 'Create a project and the week grid fills in around it.' : 'Ask an admin to set up a project.',
      }));
    }

    return h('div', { class: 'table-wrap' },
      h('table', { class: 'weekgrid' },
        h('thead', null, h('tr', null,
          h('th', null, 'Project'),
          days.map((d) => h('th', { class: d === todayDate() ? 'today' : '' },
            h('div', null, dayShort(d)),
            h('div', { style: { fontWeight: '400', letterSpacing: '0', marginTop: '2px' } }, String(dayNum(d))),
          )),
          h('th', { style: { textAlign: 'right', paddingRight: '16px' } }, 'Total'),
        )),
        h('tbody', null, rows.map((p) => {
          const total = days.reduce((s, d) => s + minutesOn(d, p.id), 0);
          return h('tr', null,
            h('td', null, h('div', { class: 'dot-tag' },
              h('span', { class: 'dot', style: { background: p.color } }), p.name)),
            days.map((d) => {
              const m = minutesOn(d, p.id);
              return h('td', null, h('button', {
                class: `cell${m ? '' : ' nil'}`,
                title: `${p.name} · ${relativeDay(d)}`,
                onclick: () => openCell(p.id, d),
              }, m ? dec(m) : '·'));
            }),
            h('td', { style: { textAlign: 'right', paddingRight: '16px', fontWeight: '700' } },
              total ? dec(total) : h('span', { style: { color: '#3a3a3a' } }, '·')),
          );
        })),
        h('tfoot', null, h('tr', null,
          h('td', null, 'Daily total'),
          days.map((d) => {
            const m = minutesOn(d);
            return h('td', { class: m ? 'total' : '' }, m ? dec(m) : '·');
          }),
          h('td', { class: 'total', style: { textAlign: 'right', paddingRight: '16px' } },
            dec(entries.reduce((s, e) => s + e.minutes, 0))),
        )),
      ));
  }

  function monthView() {
    const { from, to } = bounds();
    const lead = (new Date(`${from}T00:00:00Z`).getUTCDay() - state.user.weekStart + 7) % 7;
    const labels = Array.from({ length: 7 }, (_, i) => dayShort(addDays('2024-01-07', (state.user.weekStart + i) % 7)));

    return h('div', { class: 'card' },
      h('div', { class: 'cal' },
        labels.map((l) => h('div', { class: 'dow' }, l)),
        Array.from({ length: lead }, () => h('div', { class: 'day blank' })),
        range(from, to).map((d) => {
          const m = minutesOn(d);
          return h('button', {
            class: `day${m ? '' : ' off'}${d === todayDate() ? ' today' : ''}`,
            onclick: () => openDay(d),
            title: `${relativeDay(d)} · ${hm(m, { zero: 'nothing logged' })}`,
          },
            h('span', { class: 'n' }, String(dayNum(d))),
            h('span', { class: 'h' }, m ? dec(m) : (isWeekend(d) ? '' : '·')),
          );
        }),
      ),
    );
  }

  function totalsCard() {
    const total = entries.reduce((s, e) => s + e.minutes, 0);
    const billable = entries.reduce((s, e) => s + (e.billable ? e.minutes : 0), 0);
    const days = new Set(entries.map((e) => e.date)).size;

    return h('div', { class: 'grid cols-4' },
      h('div', { class: 'card pad-sm kpi hero' },
        h('div', { class: 'label' }, ui.mode === 'week' ? 'Week total' : 'Month total'),
        h('div', { class: 'value' }, hm(total, { zero: '0h' })),
      ),
      h('div', { class: 'card pad-sm kpi' },
        h('div', { class: 'label' }, 'Billable'),
        h('div', { class: 'value' }, hm(billable, { zero: '0h' })),
        h('div', { class: 'foot' }, total ? `${Math.round((billable / total) * 100)}% of logged time` : '—'),
      ),
      h('div', { class: 'card pad-sm kpi' },
        h('div', { class: 'label' }, 'Days logged'),
        h('div', { class: 'value' }, String(days)),
      ),
      h('div', { class: 'card pad-sm kpi' },
        h('div', { class: 'label' }, 'Daily average'),
        h('div', { class: 'value' }, hm(days ? Math.round(total / days) : 0, { zero: '0h' })),
        h('div', { class: 'foot' }, 'across days with time logged'),
      ),
    );
  }

  /* ------------------------------------------------------------ detail -- */

  function openCell(projectId, date) {
    const rows = entries.filter((e) => e.date === date && e.projectId === projectId);
    if (!rows.length) {
      entryEditor(null, { date, projectId }, load);
      return;
    }
    dayModal(rows, `${projectById(projectId)?.name || 'No project'} · ${relativeDay(date)}`, date, projectId);
  }

  function openDay(date) {
    const rows = entries.filter((e) => e.date === date);
    if (!rows.length) {
      entryEditor(null, { date }, load);
      return;
    }
    dayModal(rows, relativeDay(date), date);
  }

  function dayModal(rows, heading, date, projectId) {
    const total = rows.reduce((s, e) => s + e.minutes, 0);
    const editable = (e) => isAdmin() || e.userId === state.user.id;

    modal({
      title: heading,
      subtitle: `${hm(total)} across ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`,
      body: (close) => rows.map((e) => h('div', {
        class: 'row',
        style: { justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #1c1c1c' },
      },
        h('div', { style: { minWidth: '0' } },
          h('div', { class: 'dot-tag' },
            h('span', { class: 'dot', style: { background: e.projectColor || '#3a3a3a' } }),
            e.projectName || 'No project'),
          h('div', { class: 'dim', style: { fontSize: '12px', marginTop: '4px' } },
            [e.taskTitle, e.note, !ui.userId ? e.userName : null].filter(Boolean).join(' · ') || '—'),
        ),
        h('div', { class: 'row tight' },
          h('span', { style: { fontWeight: '700' } }, hm(e.minutes)),
          editable(e)
            ? h('button', {
              class: 'btn-icon', title: 'Edit entry',
              onclick: () => { close(); entryEditor(e, {}, load); },
            }, icon('pencil'))
            : null,
        ),
      )),
      actions: (close) => [
        h('button', { class: 'btn btn-ghost', onclick: close }, 'Close'),
        h('button', {
          class: 'btn btn-primary',
          onclick: () => { close(); entryEditor(null, { date, projectId }, load); },
        }, icon('plus'), 'Add entry'),
      ],
    });
  }

  load();
}

export { render_ as render };
