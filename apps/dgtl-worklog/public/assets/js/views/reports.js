/* Reports — what actually happened. Two things live here.

   ACTIVITY is the internal read: KPIs, hours per day, the project split, who
   did what, and a trailing-90-day heatmap.

   CLIENT DIGEST is the outward one — one client, one week, assembled from the
   rows rather than from memory. It exists because "Weekly progress note to
   Michael" was an hour of recurring manual work spent restating facts this
   database already held. It is deliberately NOT a client-facing page: the
   dgtl-worklog-status-report skill builds that artefact, and a second one here
   would be two things to keep in step. This is the substance it is built from,
   with every figure carrying the row ids it was summed from. */

import {
  addDays, addMonths, dateMed, dayLong, dayShort, endOfMonth, h, hm, range,
  startOfMonth, startOfWeek, today as todayDate,
} from '../util.js';
import { avatar, bars, empty, fail, heatmap, icon, kpi, render, select, toast, userOptions } from '../ui.js';
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

/** The weeks a digest can be asked for, newest first. */
const WEEKS = () => {
  const start = startOfWeek(todayDate(), state.user.weekStart);
  return [
    { key: 'this', label: 'This week', from: start },
    { key: 'last', label: 'Last week', from: addDays(start, -7) },
    { key: 'prev', label: 'Two weeks ago', from: addDays(start, -14) },
  ].map((w) => ({ ...w, to: addDays(w.from, 6) }));
};

export function render_(host, { actions }) {
  const ui = {
    mode: 'activity', preset: 'week', scope: 'me', userId: String(state.user.id),
    clientId: '', week: 'this',
  };
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

  const modeSeg = h('div', { class: 'seg' },
    h('button', { class: 'on', dataset: { mode: 'activity' }, onclick: () => setMode('activity') }, 'Activity'),
    h('button', { dataset: { mode: 'digest' }, onclick: () => setMode('digest') }, 'Client digest'),
  );

  /* ----------------------------------------------------- digest controls -- */
  let clients = null;                     // null until fetched once
  let digest = null;

  const clientSel = select([], { cls: 'select sm' });
  clientSel.addEventListener('change', () => { ui.clientId = clientSel.value; loadDigest(); });

  const weekChips = h('div', { class: 'row tight' }, WEEKS().map((w) =>
    h('button', {
      class: `chip${ui.week === w.key ? ' on' : ''}`, dataset: { week: w.key },
      onclick: () => { ui.week = w.key; loadDigest(); },
    }, w.label)));

  const copyBtn = h('button', {
    class: 'btn btn-ghost btn-sm',
    onclick: async () => {
      if (!digest) return;
      const done = await copyText(digestText(digest));
      toast(done ? 'Digest copied' : 'Could not reach the clipboard — select the text instead',
        done ? 'success' : 'error');
    },
  }, icon('download'), 'Copy');

  function drawActions() {
    if (ui.mode === 'activity') {
      render(actions, modeSeg, chips, scopeSeg, whoSel,
        h('a', { class: 'btn btn-ghost btn-sm', href: api.exportUrl, download: 'dgtl-worklog-export.json' },
          icon('download'), 'Export'));
    } else {
      render(actions, modeSeg, weekChips, clientSel, copyBtn);
    }
  }

  function setMode(mode) {
    ui.mode = mode;
    for (const b of modeSeg.children) b.classList.toggle('on', b.dataset.mode === mode);
    drawActions();
    if (mode === 'digest') loadDigest();
    else draw();
  }

  function setScope(scope) {
    ui.scope = scope;
    for (const b of scopeSeg.children) b.classList.toggle('on', b.dataset.scope === scope);
    whoSel.style.display = scope === 'team' ? 'none' : '';
    load();
  }

  async function load() {
    if (ui.mode !== 'activity') return;
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
    if (ui.mode !== 'activity') return;
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

  /* ------------------------------------------------------------- digest -- */

  /** Fetch the clients once, then the selected client's week. */
  async function loadDigest() {
    for (const c of weekChips.children) c.classList.toggle('on', c.dataset.week === ui.week);
    if (!clients) {
      try {
        clients = (await api.clients()).clients;
      } catch (e) { clients = []; fail(e); }
      render(clientSel, ...clients.map((c) => h('option', { value: String(c.id) }, c.name)));
      if (!ui.clientId && clients.length) ui.clientId = String(clients[0].id);
      clientSel.value = ui.clientId;
    }
    if (!clients.length) {
      digest = null;
      render(body, h('div', { class: 'card' }, empty({
        title: 'No clients yet',
        subtitle: 'A digest is per client. Put a client name on a project — Projects → edit — '
          + 'and its workstreams gather under it here.',
      })));
      return;
    }

    const week = WEEKS().find((w) => w.key === ui.week);
    digest = null;
    render(body, h('div', { class: 'card' }, h('div', { class: 'skeleton', style: { height: '280px' } })));
    try {
      digest = await api.digest({ clientId: ui.clientId, from: week.from, to: week.to });
    } catch (e) {
      fail(e);
      render(body, h('div', { class: 'card' }, empty({ title: 'Could not build the digest', subtitle: e.message })));
      return;
    }
    drawDigest();
  }

  function drawDigest() {
    const d = digest;
    const t = d.totals;
    const sharePct = t.minutes ? Math.round((t.billableMinutes / t.minutes) * 100) : 0;

    render(body,
      h('div', { class: 'card digest-head' },
        h('div', { class: 'client-eyebrow' }, 'Weekly digest'),
        h('h2', null, d.client.name),
        h('p', { class: 'digest-range' },
          `${dayLong(d.range.from)} – ${dayLong(d.range.to)}`),
        h('p', { class: 'hint' },
          `Assembled from ${t.entries} time ${t.entries === 1 ? 'entry' : 'entries'} `
          + `across ${d.workstreams.length} ${d.workstreams.length === 1 ? 'workstream' : 'workstreams'}, `
          + `in ${d.timezone}. Every figure below names the rows it came from.`),
      ),

      h('div', { class: 'grid cols-4' },
        kpi({ label: 'Logged', value: hm(t.minutes, { zero: '0h' }), hero: true, foot: `over ${t.days} of ${d.range.days} days` }),
        kpi({ label: 'Billable', value: hm(t.billableMinutes, { zero: '0h' }), foot: `${sharePct}% of logged time` }),
        kpi({ label: 'Completed', value: String(t.tasksCompleted), foot: `${t.tasksOpen} still open` }),
        kpi({ label: 'Due next week', value: String(t.dueNextWeek), foot: t.overdue ? `${t.overdue} still open from before` : 'nothing carried over' }),
      ),

      card('Hours by workstream', d.workstreams.length
        ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
          h('thead', null, h('tr', null,
            h('th', null, 'Workstream'), h('th', { class: 'num' }, 'Hours'),
            h('th', { class: 'num' }, 'Billable'), h('th', { class: 'num' }, 'Closed'),
            h('th', { class: 'num' }, 'Remaining'))),
          h('tbody', null, d.workstreams.map((w) => h('tr', null,
            h('td', null, h('span', { class: 'dot-tag' },
              h('span', { class: 'dot', style: { background: w.color } }), w.name),
              w.code ? h('span', { class: 'mono-code' }, w.code) : null),
            h('td', { class: 'num' }, hm(w.minutes, { zero: '—' })),
            h('td', { class: 'num' }, hm(w.billableMinutes, { zero: '—' })),
            h('td', { class: 'num' }, w.closedPct === null ? '—'
              : `${w.tasksClosed} of ${w.tasksScheduled}`),
            h('td', { class: 'num' }, hm(w.estimateRemainingMinutes, { zero: '—' })),
          ))),
        ))
        : quiet('No hours were logged against this client in the week.')),

      card(`Completed this week (${d.completed.length})`, d.completed.length
        ? h('div', { class: 'digest-list' }, d.completed.map((c) => h('div', { class: 'digest-item' },
          h('div', { class: 'digest-item-head' },
            h('span', { class: 'digest-item-title' }, c.title),
            h('span', { class: 'digest-when' }, dateMed(c.doneDate)),
          ),
          h('div', { class: 'digest-item-meta' },
            h('span', { class: 'dot-tag' },
              h('span', { class: 'dot', style: { background: c.projectColor || 'var(--nil)' } }),
              c.projectName || 'No project'),
            c.assigneeName ? h('span', null, c.assigneeName) : null,
            c.loggedMinutes ? h('span', null, `${hm(c.loggedMinutes)} logged`) : null,
            c.recurrence ? h('span', null, c.recurrence === 'monthly' ? 'Repeats monthly' : 'Repeats weekly') : null,
          ),
        )))
        : quiet('Nothing was ticked off inside this week. The hours above say what the time went on.')),

      card('The week, in the words people logged', d.narrative.length
        ? h('div', null,
          h('div', { class: 'digest-list' }, narrativeDays(d.narrative).map(([date, rows]) =>
            h('div', { class: 'digest-day' },
              h('div', { class: 'digest-day-head' }, dayLong(date)),
              rows.map((n) => h('div', { class: 'digest-note' },
                h('span', { class: 'digest-note-min' }, hm(n.minutes)),
                h('span', { class: 'digest-note-what' },
                  h('span', { class: 'dot', style: { background: 'var(--gold-tan)' } }),
                  n.note,
                  h('span', { class: 'digest-note-src' },
                    `${n.projectName || 'No project'}${n.userName ? ` · ${n.userName}` : ''}`),
                ),
              )),
            ))),
          h('p', { class: 'hint' },
            `${hm(d.coverage.notedMinutes, { zero: '0h' })} of the ${hm(d.coverage.minutes, { zero: '0h' })} `
            + `logged carries a written note. The remaining ${hm(d.coverage.unnotedMinutes, { zero: '0h' })} `
            + 'is in the totals and not in the story — it was logged without one.'),
        )
        : quiet('No time entry this week carries a note, so there is no narrative to draw from — '
          + 'only the hours and the task list above.')),

      card(`What is due next (${d.upcoming.length})`, d.upcoming.length
        ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
          h('thead', null, h('tr', null,
            h('th', null, 'Task'), h('th', null, 'Workstream'),
            h('th', null, 'Due'), h('th', null, 'Owner'))),
          h('tbody', null, d.upcoming.map((u) => h('tr', null,
            h('td', null, u.title),
            h('td', null, u.projectName || '—'),
            h('td', { class: u.bucket === 'before' ? 'due-over' : u.bucket === 'inWeek' ? 'due-soon' : '' },
              `${dateMed(u.dueDate)}${u.bucket === 'before' ? ' · overdue' : ''}`),
            h('td', null, u.assigneeName || 'Unassigned'),
          ))),
        ))
        : quiet('Nothing on this client falls due in the seven days after the week.')),

      provenanceCard(d),
    );
  }

  const card = (heading, inner) => h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('h3', null, heading)), inner);

  const quiet = (text) => h('p', { class: 'dim', style: { fontSize: '14px' } }, text);

  /** Narrative rows bucketed by date, in the order they were logged. */
  function narrativeDays(rows) {
    const days = new Map();
    for (const n of rows) {
      if (!days.has(n.date)) days.set(n.date, []);
      days.get(n.date).push(n);
    }
    return [...days.entries()];
  }

  /**
   * The claims, with the rows behind them — folded shut, because it is an
   * audit trail rather than part of the read. Open it and every figure above
   * can be traced to the ids it was summed from without leaving the app.
   */
  function provenanceCard(d) {
    const kindLabel = { minutes: 'time entries', tasks: 'tasks', 'task-date': 'task', text: 'time entry' };
    return h('details', { class: 'card digest-prov' },
      h('summary', null,
        h('span', null, 'Where every number came from'),
        h('span', { class: 'dim' }, ` ${d.provenance.length} claims`)),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null,
          h('th', null, 'Claim'), h('th', null, 'Value'), h('th', null, 'Rows'))),
        h('tbody', null, d.provenance.map((p) => h('tr', null,
          h('td', null, p.label),
          h('td', { class: 'mono-code' }, String(p.value)),
          h('td', { class: 'dim' },
            `${kindLabel[p.kind] || 'rows'} #${(p.entryIds || p.taskIds || []).join(', #') || '—'}`),
        ))),
      )),
    );
  }

  /* ------------------------------------------------------------- copy ----- */

  /** The same digest as plain text — what gets pasted into the email. */
  function digestText(d) {
    const t = d.totals;
    const out = [
      `${d.client.name} — week of ${d.range.from} to ${d.range.to}`,
      `${hm(t.minutes, { zero: '0h' })} logged · ${hm(t.billableMinutes, { zero: '0h' })} billable · `
      + `${t.tasksCompleted} completed · ${t.dueNextWeek} due next week`,
      '',
      'HOURS BY WORKSTREAM',
      ...(d.workstreams.length
        ? d.workstreams.map((w) => `  ${w.name} — ${hm(w.minutes, { zero: '0h' })}`
          + `${w.billableMinutes ? ` (${hm(w.billableMinutes)} billable)` : ''}`)
        : ['  nothing logged']),
      '',
      'COMPLETED',
      ...(d.completed.length
        ? d.completed.map((c) => `  ${c.doneDate}  ${c.title}${c.projectName ? ` — ${c.projectName}` : ''}`)
        : ['  nothing completed inside the week']),
      '',
      'THE WEEK IN NOTES',
      ...(d.narrative.length
        ? d.narrative.map((n) => `  ${n.date}  ${hm(n.minutes)}  ${n.note}`)
        : ['  no time entry carries a note']),
      '',
      'DUE NEXT',
      ...(d.upcoming.length
        ? d.upcoming.map((u) => `  ${u.dueDate}  ${u.title}${u.bucket === 'before' ? '  (overdue)' : ''}`)
        : ['  nothing falls due in the following week']),
      '',
      `${hm(d.coverage.notedMinutes, { zero: '0h' })} of ${hm(d.coverage.minutes, { zero: '0h' })} `
      + 'carries a written note. Figures are sums of logged entries in '
      + `${d.timezone}; nothing here is estimated.`,
    ];
    return out.join('\n');
  }

  /**
   * Clipboard, with the fallback that matters: `navigator.clipboard` is absent
   * on a page served over plain HTTP to anything but localhost, which is
   * exactly how this app is reached on a LAN. Returns false rather than
   * throwing, so the caller can say so instead of failing silently.
   */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* insecure context, or permission refused */ }
    const ta = h('textarea', { style: { position: 'fixed', top: '-1000px', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch { done = false; }
    ta.remove();
    return done;
  }

  drawActions();
  load();
}

export { render_ as render };
