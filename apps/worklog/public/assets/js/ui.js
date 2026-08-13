/* DGTL Worklog — shared UI: icons, toasts, modals, and the reusable pieces
   (metric cards, ring, bars, heatmap, empty states) every view builds from. */

import { h, clear, hm, initials } from './util.js';

/* --------------------------------------------------------------- icons --- */
/* Line icons, 1.7px stroke, currentColor — per the DGTL component library. */

const svg = (paths, size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor"
        stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export const icons = {
  timer: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 1.5M9 2h6M12 6V2"/>'),
  today: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  tasks: svg('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>'),
  timesheet: svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M12 13v4"/>'),
  projects: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  reports: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11.5 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9 2 2 0 1 1 0 4z"/>'),
  play: svg('<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>', 16),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>', 16),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 16),
  x: svg('<path d="M18 6 6 18M6 6l12 12"/>', 16),
  check: svg('<path d="M20 6 9 17l-5-5"/>', 16),
  trash: svg('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>', 16),
  pencil: svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', 16),
  left: svg('<path d="M15 18 9 12l6-6"/>', 16),
  right: svg('<path d="m9 18 6-6-6-6"/>', 16),
  grip: svg('<circle cx="9" cy="6" r="1.3" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="9" cy="18" r="1.3" fill="currentColor"/><circle cx="15" cy="6" r="1.3" fill="currentColor"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/><circle cx="15" cy="18" r="1.3" fill="currentColor"/>', 16),
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', 16),
  download: svg('<path d="M12 3v12M7 11l5 5 5-5M4 21h16"/>', 16),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 16),
  // Points up at rest, because a sort indicator is read as an arrow and
  // ascending points up. The descending state rotates it — see .sort-caret.down.
  caret: svg('<path d="m6 15 6-6 6 6"/>', 14),
  chevron: svg('<path d="m9 6 6 6-6 6"/>', 16),
};

export const icon = (name, cls) => h('span', { class: cls, html: icons[name] || '' });

/* -------------------------------------------------------------- toasts --- */

let toastHost;
export function toast(message, kind = '') {
  if (!toastHost) document.body.append((toastHost = h('div', { class: 'toasts' })));
  const el = h('div', { class: `toast ${kind}`.trim(), role: 'status' }, message);
  toastHost.append(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 260);
  }, kind === 'error' ? 6000 : 3400);
}

/** Report a thrown ApiError (or anything else) to the user. */
export const fail = (err) => toast(err?.message || 'Something went wrong', 'error');

/* -------------------------------------------------------------- modals --- */

let openModal = null;

/**
 * Show a modal. `build(close)` returns the body nodes; `actions` builds the
 * footer. Escape and backdrop clicks close it, and focus moves to the first
 * field so keyboard users are not stranded.
 */
export function modal({ title, subtitle, body, actions, wide = false }) {
  closeModal();
  const close = () => closeModal();

  const panel = h('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true' },
    h('h3', null, title),
    subtitle ? h('p', { class: 'modal-sub' }, subtitle) : null,
    h('div', { class: 'modal-body' }, body(close)),
    h('div', { class: 'modal-foot' }, actions(close)),
  );

  const overlay = h('div', {
    class: 'overlay',
    onclick: (e) => { if (e.target === overlay) close(); },
  }, panel);

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  openModal = { overlay, onKey, restore: document.activeElement };
  document.body.append(overlay);
  (panel.querySelector('input,select,textarea,button') || panel).focus();
  return close;
}

export function closeModal() {
  if (!openModal) return;
  document.removeEventListener('keydown', openModal.onKey);
  openModal.overlay.remove();
  openModal.restore?.focus?.();
  openModal = null;
}

/** Yes/no dialog. Resolves true only if the user confirms. */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let decided = false;
    const done = (v) => { decided = true; resolve(v); };
    modal({
      title,
      body: () => h('p', { class: 'muted', style: { fontSize: '14px' } }, message),
      actions: (close) => [
        h('button', { class: 'btn btn-ghost', onclick: () => { done(false); close(); } }, 'Cancel'),
        h('button', {
          class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
          onclick: () => { done(true); close(); },
        }, confirmLabel),
      ],
    });
    // Escape / backdrop dismissal must also resolve, or the caller hangs.
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.overlay')) {
        observer.disconnect();
        if (!decided) resolve(false);
      }
    });
    observer.observe(document.body, { childList: true });
  });
}

/* ---------------------------------------------------------- form fields -- */

export function field(label, control, hint) {
  return h('label', { class: 'field grow' },
    h('span', { class: 'label' }, label),
    control,
    hint ? h('span', { class: 'hint' }, hint) : null,
  );
}

export function select(options, { value, placeholder, cls = 'select' } = {}) {
  const el = h('select', { class: cls });
  if (placeholder) el.append(h('option', { value: '' }, placeholder));
  for (const o of options) el.append(h('option', { value: String(o.value) }, o.label));
  el.value = value === null || value === undefined ? '' : String(value);
  return el;
}

export const projectOptions = (projects, { includeArchived = false } = {}) =>
  projects.filter((p) => includeArchived || p.status === 'active')
    .map((p) => ({ value: p.id, label: p.client ? `${p.name} · ${p.client}` : p.name }));

export const taskOptions = (tasks, projectId) =>
  tasks.filter((t) => t.status !== 'done' && (!projectId || t.projectId === Number(projectId)))
    .map((t) => ({ value: t.id, label: t.title }));

export const userOptions = (users) => users.map((u) => ({ value: u.id, label: u.name }));

/* -------------------------------------------------------- display parts -- */

export const avatar = (name, small = false) =>
  h('div', { class: `avatar${small ? ' sm' : ''}`, title: name }, initials(name));

export function kpi({ label, value, foot, hero = false }) {
  return h('div', { class: `card pad-sm kpi${hero ? ' hero' : ''}` },
    h('div', { class: 'label' }, label),
    h('div', { class: 'value' }, value),
    foot ? h('div', { class: 'foot' }, foot) : null,
  );
}

/**
 * Where the two arcs sit, and whether the inner one is drawn at all.
 *
 * Split out of `ring()` because that last decision is the one that matters and
 * the one a DOM-free test can read: `inner: null` means nothing was ever
 * estimated, and drawing an empty inner track for it would claim "0% of the
 * estimate spent" — a much better-sounding thing than "we never said". The
 * size floor is the other half: below it the inner arc is thinner than its own
 * stroke and reads as a smudge, so it is dropped rather than drawn badly.
 */
export function ringGeometry(size, stroke, inner) {
  const outerR = (size - stroke) / 2;
  // A gap of its own, or the two arcs read as one thick band at 44px.
  const innerR = outerR - stroke - Math.max(2, stroke * 0.4);
  return { outerR, innerR, drawInner: inner !== null && inner !== undefined && innerR > stroke };
}

/**
 * Progress ring — the habit tracker's completion ring, now hours vs target.
 *
 * Pass `inner` and it draws a SECOND, concentric arc inside the first, because
 * one arc cannot answer the question a workstream actually raises. The outer
 * arc is how much of the work is finished; the inner is how much of the
 * estimate has been spent. It is the divergence between them that says
 * something: 80% of the tasks done against 130% of the estimate is a
 * workstream losing money, and a single ring reads that as "nearly there".
 *
 * `inner: null` draws nothing inside, which is the honest answer when there is
 * no estimate to measure against — an empty inner track would read as "0% of
 * the estimate spent", a far better-sounding claim than "we never said".
 *
 * @param pct          outer arc, 0–100 (clamped)
 * @param inner        inner arc percentage, or null for no inner ring at all
 * @param center       false drops the figure in the middle — a 44px ring in a
 *                     section header has no room for it, and the header states
 *                     both numbers as text beside it instead
 * @param label        what the middle reads, defaulting to the CLAMPED arc. The
 *                     arc stays clamped whatever this says, because a circle has
 *                     nowhere past full to go — but the text beside a full ring
 *                     was already saying 167% while the ring's own middle said
 *                     100%, which is one component contradicting itself. Pass
 *                     the real figure and the two agree.
 */
export function ring(pct, {
  caption = 'of target', size = 132, stroke = 10, inner = null, center = true, title = null,
  label = null,
} = {}) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  const { outerR, innerR, drawInner } = ringGeometry(size, stroke, inner);

  // Every stroke comes from `style`, not the `stroke` attribute: a presentation
  // attribute cannot hold var(), and the declaration re-resolves on its own if
  // the palette ever changes under a ring that is already on screen.
  const arc = (r, value, token, track) => {
    const c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(100, value || 0));
    return `
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"
              style="stroke:var(${track})"/>
      ${v > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"
              stroke-linecap="round" stroke-dasharray="${c}"
              stroke-dashoffset="${c - (c * v) / 100}"
              style="stroke:var(${token});transition:stroke-dashoffset .5s ease"/>` : ''}`;
  };

  const wrap = h('div', { class: 'ring', style: { width: `${size}px`, height: `${size}px` } });
  if (title) wrap.title = title;
  // Past the estimate the arc has nowhere left to go, so the colour carries it:
  // a full red ring is over budget, a full blue one is exactly on it.
  const innerToken = inner !== null && inner > 100 ? '--error' : '--chart-4';
  // The inner track is the "there IS an estimate" signal — whether it is drawn
  // at all is what separates a workstream at 0% spent from one nobody ever
  // estimated. --chart-grid reads 1.16:1 on this surface, which cannot carry a
  // signal, so the inner track is --nil: the palette's own swatch for absent
  // data, 4.4:1 here, and an unspent estimate is exactly that. The OUTER track
  // stays --chart-grid, because Today's ring is this same function and its
  // remainder means nothing beyond "the rest of the circle".
  wrap.innerHTML = `
    <svg width="${size}" height="${size}" aria-hidden="true">
      ${arc(outerR, clamped, '--gold', '--chart-grid')}
      ${drawInner ? arc(innerR, inner, innerToken, '--nil') : ''}
    </svg>`;
  if (center) {
    wrap.append(h('div', { class: 'mid' },
      h('div', null,
        h('div', { class: 'pct' }, label ?? `${Math.round(clamped)}%`),
        h('div', { class: 'cap' }, caption),
      ),
    ));
  }
  return wrap;
}

/* ------------------------------------------------------- section rollups -- */
/* Pure arithmetic over rows already in memory. `/api/bootstrap` ships every
   project and every task on a cold start, so a client → project → task rollup
   is a loop in the browser and needs no endpoint of its own. Kept here, and
   kept pure, so the numbers the rings draw are the same ones a test can read
   without a DOM. */

/**
 * What a section header states and its ring draws.
 *
 * `loggedMinutes` is the PROJECT's total, not the sum of its tasks': hours get
 * logged against a project with no task attached all the time — every one of
 * this workspace's TPB hours did — and a figure that quietly dropped them
 * would disagree with the Logged column on the Projects screen.
 *
 * The budget wins over the task estimates where a project has both, for the
 * same reason. The budget is what the client bought and it is already on the
 * Projects screen as a bar; measuring against the internal estimate instead
 * would put 84% here and 453% there for one project, and a reader who sees two
 * numbers for one thing stops believing both. `basis` names which was used, so
 * "of 5h budget" and "of 27h estimated" are never mistaken for each other.
 */
export function rollup(tasks, { loggedMinutes = 0, budgetMinutes = null } = {}) {
  let total = 0;
  let done = 0;
  let estimate = 0;
  for (const t of tasks) {
    if (t.archived) continue;
    total++;
    if (t.status === 'done') done++;
    estimate += t.estimateMinutes || 0;
  }
  const target = budgetMinutes || estimate || 0;
  return {
    total, done, estimate, target, loggedMinutes,
    basis: budgetMinutes ? 'budget' : (estimate ? 'estimate' : null),
    // Hours that no target covers. Zero for a project — it either has a target
    // or it does not — but it is what keeps a client's ratio honest below.
    unplannedMinutes: target ? 0 : loggedMinutes,
    donePct: total ? (done / total) * 100 : null,
    // null, not 0 — "nothing to measure against" and "nothing spent" are
    // different claims, and only one of them earns an arc.
    effortPct: target ? (loggedMinutes / target) * 100 : null,
  };
}

/**
 * Roll several project rollups into the client that owns them.
 *
 * The effort ratio counts only the projects that have something to be measured
 * against. Hours on a project with no budget and no estimates would otherwise
 * be divided by the other projects' targets, and one unplanned workstream
 * would put the whole account into the red on arithmetic alone. They are
 * carried out separately as `unplannedMinutes` so the header can state them
 * rather than the ratio quietly swallowing them.
 */
export function mergeRollups(list) {
  const out = { total: 0, done: 0, estimate: 0, target: 0, loggedMinutes: 0, unplannedMinutes: 0 };
  const bases = new Set();
  for (const r of list) {
    out.total += r.total; out.done += r.done; out.estimate += r.estimate; out.target += r.target;
    out.unplannedMinutes += r.unplannedMinutes;
    if (r.target) out.loggedMinutes += r.loggedMinutes;
    if (r.basis) bases.add(r.basis);
  }
  out.basis = bases.size === 1 ? [...bases][0] : (bases.size ? 'mixed' : null);
  out.donePct = out.total ? (out.done / out.total) * 100 : null;
  out.effortPct = out.target ? (out.loggedMinutes / out.target) * 100 : null;
  return out;
}

/** Projects bucketed by client, named clients first, "no client" last. */
export function groupByClient(projects) {
  const groups = new Map();
  for (const p of projects) {
    const key = p.clientId ? `c${p.clientId}` : 'none';
    if (!groups.has(key)) {
      groups.set(key, { key, clientId: p.clientId ?? null, name: p.clientName || '', projects: [] });
    }
    groups.get(key).projects.push(p);
  }
  return [...groups.values()].sort((a, b) =>
    (a.clientId ? 0 : 1) - (b.clientId ? 0 : 1) || a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------- sorting ---- */

/**
 * Click-to-sort state. Built once and handed to `sortButton`, so the task
 * board and the timesheet cannot drift into two different ideas of what a
 * second click does.
 *
 * @param columns  [{ key, label, get(row), num?, dir? }] — `dir` is the
 *                 direction the column starts in when it is first picked
 *                 (hours want 'desc'; names want 'asc')
 * @param key      the column to start on, or null for the order rows arrived in
 */
export function sorter(columns, { key = null, dir = 'asc' } = {}) {
  const find = (k) => columns.find((c) => c.key === k);
  const st = {
    columns,
    key,
    dir,
    /** A new column starts in its own direction; the same column reverses. */
    toggle(k) {
      if (st.key === k) st.dir = st.dir === 'asc' ? 'desc' : 'asc';
      else { st.key = k; st.dir = find(k)?.dir || 'asc'; }
      return st;
    },
    apply(rows) {
      const col = find(st.key);
      if (!col?.get) return rows.slice();
      const sign = st.dir === 'desc' ? -1 : 1;
      // Decorated with the arrival index: Array#sort is stable, but only for
      // ties the comparator declares, and an empty value has to sort last in
      // BOTH directions — otherwise every task with no due date jumps to the
      // top the moment you reverse the column.
      return rows
        .map((r, i) => [r, col.get(r), i])
        .sort(([, av, ai], [, bv, bi]) => {
          const an = av === null || av === undefined || av === '';
          const bn = bv === null || bv === undefined || bv === '';
          if (an !== bn) return an ? 1 : -1;
          if (an) return ai - bi;
          if (av < bv) return -sign;
          if (av > bv) return sign;
          return ai - bi;
        })
        .map(([r]) => r);
    },
  };
  return st;
}

/**
 * One sortable column heading. The caret span is always present, empty when
 * the column is not the active one, so the label does not shift sideways as
 * the sort moves between columns.
 */
export function sortButton(col, st, onChange) {
  const on = st.key === col.key;
  return h('button', {
    type: 'button',
    class: `sort-btn${on ? ' on' : ''}${col.num ? ' num' : ''}`,
    'aria-label': on
      ? `${col.label}, sorted ${st.dir === 'asc' ? 'ascending' : 'descending'} — activate to reverse`
      : `Sort by ${col.label}`,
    title: on ? `Sorted by ${col.label} — click to reverse` : `Sort by ${col.label}`,
    onclick: () => { st.toggle(col.key); onChange(st); },
  },
    h('span', null, col.label),
    h('span', { class: `sort-caret${on && st.dir === 'desc' ? ' down' : ''}`, html: on ? icons.caret : '' }),
  );
}

/** Horizontal bar list — project breakdowns, budget usage. */
export function bars(rows, { max, showPct = false } = {}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return h('div', { class: 'bars' }, rows.map((r) => {
    const pct = Math.min(100, (r.value / top) * 100);
    return h('div', { class: `bar-row${r.over ? ' bar-over' : ''}` },
      h('div', { class: 'top' },
        h('span', { class: 'dot-tag' },
          h('span', { class: 'dot', style: { background: r.color || 'var(--gold)' } }),
          r.label,
        ),
        h('span', { class: 'v' }, showPct ? `${Math.round((r.value / top) * 100)}%` : hm(r.value)),
      ),
      h('div', { class: 'bar-track' },
        h('div', { class: 'bar-fill', style: { width: `${pct}%`, background: r.color || 'var(--gold)' } }),
      ),
      r.sub ? h('div', { class: 'hint' }, r.sub) : null,
    );
  }));
}

/** GitHub-style trailing heatmap, straight from the habit tracker. */
export function heatmap(days, { from, to, onPick } = {}) {
  const byDate = new Map(days.map((d) => [d.date, d.minutes]));
  const peak = Math.max(60, ...days.map((d) => d.minutes));
  const level = (m) => (!m ? 0 : m >= peak * 0.75 ? 4 : m >= peak * 0.5 ? 3 : m >= peak * 0.25 ? 2 : 1);

  const grid = h('div', { class: 'heat' });
  let col = h('div', { class: 'col' });

  // Pad so the first column starts on a Sunday and rows read as weekdays.
  const startDow = new Date(`${from}T00:00:00Z`).getUTCDay();
  for (let i = 0; i < startDow; i++) col.append(h('div', { class: 'cell', style: { visibility: 'hidden' } }));

  for (let d = from; d <= to; ) {
    const minutes = byDate.get(d) || 0;
    col.append(h('button', {
      class: 'cell',
      dataset: { lvl: String(level(minutes)) },
      title: `${d} · ${hm(minutes, { zero: 'nothing logged' })}`,
      onclick: onPick ? (() => onPick(d)) : null,
      type: 'button',
      style: onPick ? null : { cursor: 'default' },
    }));
    if (new Date(`${d}T00:00:00Z`).getUTCDay() === 6) {
      grid.append(col);
      col = h('div', { class: 'col' });
    }
    const next = new Date(`${d}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    d = next.toISOString().slice(0, 10);
  }
  grid.append(col);

  return h('div', null, grid,
    h('div', { class: 'heat-legend' },
      h('span', null, 'Less'),
      [0, 1, 2, 3, 4].map((l) => h('span', { class: 'cell', dataset: { lvl: String(l) }, style: { display: 'inline-block' } })),
      h('span', null, 'More'),
    ),
  );
}

export function empty({ title, subtitle, action }) {
  return h('div', { class: 'empty' },
    h('img', { src: '/assets/spark.svg', alt: '' }),
    h('div', { class: 't' }, title),
    subtitle ? h('div', { class: 's' }, subtitle) : null,
    action || null,
  );
}

/** Swap a container's contents for freshly built nodes. */
export const render = (host, ...nodes) => { clear(host).append(...nodes.flat(Infinity).filter(Boolean)); return host; };
