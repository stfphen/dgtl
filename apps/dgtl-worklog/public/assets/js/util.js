/* DGTL Worklog — formatting, dates and a tiny DOM factory. */

/* ---------------------------------------------------------------- DOM ---- */

/**
 * Build an element. Children are appended as text nodes unless they are
 * already nodes, so anything a user typed lands as text and can never be
 * interpreted as markup. Trusted markup (our own icons) goes via `html:`.
 */
export function h(tag, props = null, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'style') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in el && k !== 'list' && typeof v !== 'object') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

/* -------------------------------------------------------------- format --- */

/** 405 → "6h 45m", 60 → "1h", 0 → "—". */
export function hm(minutes, { zero = '—' } = {}) {
  const m = Math.round(Number(minutes) || 0);
  if (!m) return zero;
  const sign = m < 0 ? '-' : '';
  const a = Math.abs(m);
  const hours = Math.floor(a / 60);
  const mins = a % 60;
  if (!hours) return `${sign}${mins}m`;
  if (!mins) return `${sign}${hours}h`;
  return `${sign}${hours}h ${mins}m`;
}

/** 405 → "6.75" — for columns that need to add up cleanly. */
export const dec = (minutes) => (Math.round(((Number(minutes) || 0) / 60) * 100) / 100).toFixed(2);

/** Seconds → "1:04:09" / "4:09". */
export function clock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hours ? `${hours}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
}

/**
 * Accept what people actually type into a duration box:
 * "1:30" · "1.5" · "1.5h" · "90" · "90m" · "1h30" · "1h 30m"  → minutes.
 * Returns null when it cannot be read as a duration.
 */
export function parseDuration(raw) {
  const s = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;

  let m = s.match(/^(\d+):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);

  m = s.match(/^(\d+(?:\.\d+)?)h(?:(\d+(?:\.\d+)?)m?)?$/);
  if (m) return Math.round(Number(m[1]) * 60 + Number(m[2] || 0));

  m = s.match(/^(\d+(?:\.\d+)?)m$/);
  if (m) return Math.round(Number(m[1]));

  // A bare number: decimals read as hours ("1.5"), whole numbers as minutes
  // ("90") — which is how people use these boxes.
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) return s.includes('.') ? Math.round(Number(m[1]) * 60) : Math.round(Number(m[1]));

  return null;
}

export const initials = (name) => String(name || '?')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

export const pluralize = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ---------------------------------------------------------------- dates -- */
/* Dates are YYYY-MM-DD strings throughout. Every helper stays in calendar
   space (UTC-anchored) so a DST boundary can never shift a day. */

export const today = () => window.__WORKLOG_TODAY__ || new Date().toISOString().slice(0, 10);

export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const dow = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

export function startOfWeek(date, weekStart = 1) {
  return addDays(date, -((dow(date) - weekStart + 7) % 7));
}

export const startOfMonth = (date) => `${date.slice(0, 7)}-01`;

export function endOfMonth(date) {
  const [y, m] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function addMonths(date, n) {
  const [y, m] = date.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

export const daysBetween = (from, to) =>
  Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);

export function range(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

const fmt = (opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts });
const DAY_SHORT = fmt({ weekday: 'short' });
const DAY_LONG = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const MED = fmt({ day: 'numeric', month: 'short' });
const MONTH_YEAR = fmt({ month: 'long', year: 'numeric' });

const asDate = (date) => new Date(`${date}T00:00:00Z`);
export const dayShort = (date) => DAY_SHORT.format(asDate(date));
export const dayLong = (date) => DAY_LONG.format(asDate(date));
export const dateMed = (date) => MED.format(asDate(date));
export const monthYear = (date) => MONTH_YEAR.format(asDate(date));
export const dayNum = (date) => Number(date.slice(8, 10));

/** "Today" / "Yesterday" / "Tomorrow", else a short date. */
export function relativeDay(date, from = today()) {
  const diff = daysBetween(from, date);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return dayShort(date);
  return dateMed(date);
}

export const isWeekend = (date) => dow(date) === 0 || dow(date) === 6;

/** Day-of-week headers ordered from the user's chosen week start. */
export const weekdayLabels = (weekStart = 1) =>
  Array.from({ length: 7 }, (_, i) => dayShort(addDays('2024-01-07', (weekStart + i) % 7)));
