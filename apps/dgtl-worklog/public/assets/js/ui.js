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

/** Progress ring — the habit tracker's completion ring, now hours vs target. */
export function ring(pct, { caption = 'of target', size = 132, stroke = 10 } = {}) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const wrap = h('div', { class: 'ring', style: { width: `${size}px`, height: `${size}px` } });
  wrap.innerHTML = `
    <svg width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#1c1c1c" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#F0CF50" stroke-width="${stroke}"
              stroke-linecap="round" stroke-dasharray="${c}"
              stroke-dashoffset="${c - (c * clamped) / 100}"
              style="transition:stroke-dashoffset .5s ease"/>
    </svg>`;
  wrap.append(h('div', { class: 'mid' },
    h('div', null,
      h('div', { class: 'pct' }, `${Math.round(clamped)}%`),
      h('div', { class: 'cap' }, caption),
    ),
  ));
  return wrap;
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
