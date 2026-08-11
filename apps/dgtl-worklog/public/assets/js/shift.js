/* The clock-in strip — attendance, shown above the clock on Today and Quick log.
 *
 * Presence and project time are two separate clocks on purpose. This strip
 * answers "how long have I been here, and how much of that is on a project",
 * and states the difference instead of hiding it: unattributed presence is the
 * number that tells you the timesheet is thinner than the day was. It is
 * computed by the server against time_entries on every read and never stored,
 * so correcting an entry next week moves it. */

import { clock, h, hm, relativeDay } from './util.js';
import { fail, toast } from './ui.js';
import { clockIn, clockOut, shiftAttributedSeconds, shiftSeconds, state } from './store.js';

/** Worth a strip: still open, or the one that started or ended today. */
const isCurrent = (s) => !!s && (s.open || s.date === state.today || s.endedDate === state.today);

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const figure = (label, value, id) => h('div', null,
  h('span', { class: 'label', style: { marginBottom: '2px' } }, label),
  h('div', {
    id,
    style: { fontSize: '20px', fontWeight: '800', color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' },
  }, value),
);

/* Presence ticks; the gap holds steady while a clock runs and grows while
   nothing does. Self-cancelling, like the other clocks in the app — the strip
   is rebuilt on every draw and the node it was pointed at simply goes. */
let tick = null;
function startTick() {
  clearInterval(tick);
  tick = setInterval(() => {
    const el = document.getElementById('shift-elapsed');
    if (!el) return clearInterval(tick);
    const present = shiftSeconds();
    el.textContent = clock(present);
    const att = document.getElementById('shift-attributed');
    const gap = document.getElementById('shift-gap');
    if (att) att.textContent = hm(shiftAttributedSeconds() / 60, { zero: '0m' });
    if (gap) gap.textContent = hm((present - shiftAttributedSeconds()) / 60, { zero: '0m' });
  }, 1000);
}

/**
 * Build the strip. `onChange` is called after a clock-in or clock-out, once
 * the workspace has reloaded, so the host view can redraw around it.
 */
export function shiftStrip(onChange) {
  const s = isCurrent(state.shift) ? state.shift : null;
  const on = !!s && s.open;

  const present = shiftSeconds();
  const attributed = shiftAttributedSeconds();

  const inBtn = h('button', {
    class: 'btn btn-secondary',
    onclick: async (e) => {
      e.target.disabled = true;
      try { await clockIn(); toast('Clocked in', 'success'); onChange?.(); } catch (err) { e.target.disabled = false; fail(err); }
    },
  }, 'Clock in');

  const outBtn = h('button', {
    class: 'btn btn-secondary',
    onclick: async (e) => {
      e.target.disabled = true;
      try {
        const res = await clockOut();
        const g = res.shift;
        toast(`Clocked out · ${hm(g.presentMinutes, { zero: '0m' })} present, `
          + `${hm(g.attributedMinutes, { zero: '0m' })} attributed, `
          + `${hm(g.unattributedMinutes, { zero: 'nothing' })} unaccounted`
          + (res.banked ? ` — your timer was still running, so ${hm(res.banked.minutes)} was banked` : ''),
          'success');
        onChange?.();
      } catch (err) { e.target.disabled = false; fail(err); }
    },
  }, 'Clock out');

  const since = on
    ? `since ${time(s.startedAt)}${s.date === state.today ? '' : `, ${relativeDay(s.date)}`}`
    : s
      ? `${time(s.startedAt)} – ${time(s.endedAt)}`
      : 'Attendance is separate from your project timers.';

  const card = h('div', { class: `card pad-sm${on ? ' card-callout' : ''}` },
    h('div', { class: 'row' },
      h('div', null,
        h('div', { class: 'elapsed-label' }, on ? 'On the clock' : s ? 'Clocked out' : 'Not clocked in'),
        h('div', { class: 'dim', style: { fontSize: '13px' } }, since),
      ),
      h('span', { class: 'spacer' }),
      s ? figure('Present', clock(present), 'shift-elapsed') : null,
      s ? figure('Attributed', hm(attributed / 60, { zero: '0m' }), 'shift-attributed') : null,
      s ? figure('Unaccounted', hm((present - attributed) / 60, { zero: '0m' }), 'shift-gap') : null,
      on ? outBtn : inBtn,
    ),
    // Blocks logged by hand carry no start and end, so nothing can place them
    // inside the presence. Saying so is the difference between a gap someone
    // can act on and a red number everyone learns to ignore.
    s && s.unplacedMinutes
      ? h('p', { class: 'hint', style: { marginTop: '10px' } },
        `${hm(s.unplacedMinutes)} logged by hand on this date carries no start and end, `
        + 'so it cannot be placed inside the time above.')
      : null,
  );

  if (on) startTick();
  return card;
}
