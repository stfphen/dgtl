/* Reports — what actually happened. KPIs, hours per day, the project split,
   who did what, and a trailing-90-day heatmap. */

import {
  addDays, addMonths, dateMed, dayShort, endOfMonth, h, hm, range,
  startOfMonth, startOfWeek, today as todayDate,
} from '../util.js';
import { avatar, bars, empty, fail, heatmap, icon, kpi, render, select, userOptions } from '../ui.js';
import { state } from '../store.js';
import { api } from '../api.js';

export const title = 'Reports';
export const subtitle = () => 'Hours, output and trends';

const PRESETS = () => {
  const t = todayDate();
  const ws = startOfWeek(t, state.user.weekStart);
  return [
    { key: 'week', label: 'This week', from: ws, to: addDays(ws, 6) },
    { key: 'lastweek', label: 'Last week', from: addDays(ws, -7), to: addDays(ws, -1) },
    { key: 'month', label: 'This month', from: startOfMonth(t), to: endOfMonth(t) },
    { key: 'lastmonth', label: 'Last month', from: startOfMonth(addMonths(t, -1)), to: endOfMonth(addMonths(t, -1)) },
    { key: '30', label: 'Last 30 days', from: addDays(t, -29), to: t },
  ];
};

export function render_(host, { actions }) {
  const ui = { preset: 'week', scope: 'me', userId: String(state.user.id) };
  let report = null;
  let loading = true;

  const body = h('div', { class: 'stack' });
  host.append(body);

  const chips = h('div', { class: 'row tight' }, PRESETS().map((p) =>
    h('button', {
      class: `chip${ui.preset === p.key ? ' on' : ''}`, dataset: { preset: p.key },
      onclick: () => { ui.preset = p.key; load(); },
    }, p.label)));

  const scopeSeg = h('div', { class: 'seg' },
    h('button', { class: 'on', dataset: { scope: 'me' }, onclick: () => setScope('me') }, 'Me'),
    h('button', { dataset: { scope: 'team' }, onclick: () => setScope('team') }, 'Team'),
  );

  const whoSel = select(userOptions(state.users), { value: String(state.user.id), cls: 'select sm' });
  whoSel.addEventListener('change', () => { ui.userId = whoSel.value; load(); });

  render(actions, chips, scopeSeg, whoSel,
    h('a', { class: 'btn btn-ghost btn-sm', href: api.exportUrl, download: 'dgtl-worklog-export.json' },
      icon('download'), 'Export'),
  );

  function setScope(scope) {
    ui.scope = scope;
    for (const b of scopeSeg.children) b.classList.toggle('on', b.dataset.scope === scope);
    whoSel.style.display = scope === 'team' ? 'none' : '';
    load();
  }

  async function load() {
    for (const c of chips.children) c.classList.toggle('on', c.dataset.preset === ui.preset);
    const p = PRESETS().find((x) => x.key === ui.preset);
    loading = true;
    draw();
    try {
      report = await api.report(ui.scope === 'team'
        ? { from: p.from, to: p.to, scope: 'team' }
        : { from: p.from, to: p.to, userId: ui.userId });
    } catch (e) {
      report = null;
      fail(e);
    }
    loading = false;
    draw();
  }

  function draw() {
    if (loading || !report) {
      render(body, h('div', { class: 'grid cols-4' },
        Array.from({ length: 4 }, () => h('div', { class: 'card pad-sm' },
          h('div', { class: 'skeleton', style: { height: '62px' } })))),
        h('div', { class: 'card' }, h('div', { class: 'skeleton', style: { height: '220px' } })));
      return;
    }

    const { totals, byDay, byProject, byUser, tasks, streak, heatmap: heat, range: r } = report;
    const days = range(r.from, r.to);
    const workdays = days.filter((d) => ![0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())).length;

    if (!totals.minutes && !tasks.done) {
      render(body, h('div', { class: 'card' }, empty({
        title: 'Nothing logged in this range',
        subtitle: 'Pick a wider range, or start the timer on the Today screen.',
      })));
      return;
    }

    render(body,
      h('div', { class: 'grid cols-4' },
        kpi({
          label: 'Total logged', value: hm(totals.minutes, { zero: '0h' }), hero: true,
          foot: `${dateMed(r.from)} – ${dateMed(r.to)}`,
        }),
        kpi({
          label: 'Billable', value: hm(totals.billableMinutes, { zero: '0h' }),
          foot: totals.minutes ? `${Math.round((totals.billableMinutes / totals.minutes) * 100)}% of logged time` : '—',
        }),
        kpi({
          label: 'Tasks completed', value: String(tasks.done),
          foot: tasks.overdue ? `${tasks.overdue} open and overdue` : `${tasks.open} still open`,
        }),
        streak
          ? kpi({ label: 'Current streak', value: `${streak.current}`, foot: `best run ${streak.longest} days` })
          : kpi({
            label: 'Daily average', value: hm(workdays ? Math.round(totals.minutes / workdays) : 0, { zero: '0h' }),
            foot: 'per weekday in range',
          }),
      ),

      h('div', { class: 'card' },
        h('div', { class: 'card-head' },
          h('h3', null, 'Hours per day'),
          h('span', { class: 'spacer' }),
          h('span', { class: 'dim', style: { fontSize: '13px' } },
            `${totals.days} of ${days.length} days logged`),
        ),
        dayChart(byDay, days),
      ),

      h('div', { class: 'grid top', style: { gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' } },
        h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('h3', null, 'By project')),
          byProject.length
            ? bars(byProject.map((p) => ({
              label: p.name, value: p.minutes, color: p.color,
              sub: totals.minutes ? `${Math.round((p.minutes / totals.minutes) * 100)}% of the range` : null,
            })))
            : h('p', { class: 'dim', style: { fontSize: '14px' } }, 'No time logged in this range.'),
        ),
        h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('h3', null, ui.scope === 'team' ? 'By person' : 'Recent activity')),
          ui.scope === 'team' ? teamTable(byUser, totals.minutes) : heatCard(heat),
        ),
      ),

      ui.scope === 'team' ? h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h3', null, 'Trailing 90 days')),
        heatmap(heat.days, { from: heat.from, to: heat.to }),
      ) : null,
    );
  }

  function heatCard(heat) {
    return h('div', null,
      heatmap(heat.days, { from: heat.from, to: heat.to }),
      h('p', { class: 'hint', style: { marginTop: '12px' } },
        'Each square is a day over the last 90; darker gold means more hours.'),
    );
  }

  function dayChart(byDay, days) {
    const map = new Map(byDay.map((d) => [d.date, d.minutes]));
    const peak = Math.max(60, ...byDay.map((d) => d.minutes));
    // A long range would produce hairline bars — fall back to the last 31 days.
    const shown = days.length > 31 ? days.slice(-31) : days;

    return h('div', null,
      h('div', { class: 'chart-days' }, shown.map((d) => {
        const m = map.get(d) || 0;
        return h('div', {
          class: `d${m ? '' : ' zero'}${d === todayDate() ? ' today' : ''}`,
          title: `${d} · ${hm(m, { zero: 'nothing logged' })}`,
        },
          h('div', { class: 'stem', style: { height: `${Math.max(2, (m / peak) * 100)}%` } }),
          h('div', { class: 'lbl' }, shown.length > 14 ? String(Number(d.slice(8, 10))) : dayShort(d)),
        );
      })),
      shown.length !== days.length
        ? h('p', { class: 'hint', style: { marginTop: '10px' } }, `Showing the last ${shown.length} days of the range.`)
        : null,
    );
  }

  function teamTable(byUser, total) {
    if (!byUser.length) return h('p', { class: 'dim', style: { fontSize: '14px' } }, 'Nobody logged time in this range.');
    return h('table', { class: 'table' },
      h('tbody', null, byUser.map((u) => h('tr', null,
        h('td', { class: 'shrink' },
          h('div', { class: 'row tight', style: { flexWrap: 'nowrap' } }, avatar(u.name, true), u.name)),
        // Explicit width — left to auto-layout this column collapses to the
        // width of its (empty) content and the share bars read as slivers.
        h('td', { style: { width: '55%' } }, h('div', { class: 'bar-track thin' },
          h('div', { class: 'bar-fill', style: { width: `${total ? (u.minutes / total) * 100 : 0}%`, background: 'var(--gold)' } }))),
        h('td', { class: 'num shrink', style: { fontWeight: '700' } }, hm(u.minutes)),
      ))),
    );
  }

  load();
}

export { render_ as render };
