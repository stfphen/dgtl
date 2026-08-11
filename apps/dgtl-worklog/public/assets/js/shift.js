/* The clock-in strip — attendance, shown above the clock on Today and Quick log.
 *
 * Presence and project time are two separate clocks on purpose. This strip
 * answers "how long have I been here, and how much of that is on a project",
 * and states the difference instead of hiding it. It reports the difference
 * BOTH ways: unattributed presence when the timesheet is thinner than the day,
 * and an overclaim when it is fatter — a gap report that can only ever point
 * one way is not a gap report. Every figure is computed by the server against
 * time_entries on each read and never stored, so correcting an entry next week
 * moves it.
 *
 * One card per shift, because clocking out for lunch and back in is two of
 * them and the morning's gap does not stop existing at one o'clock. */

import { clock, h, hm, relativeDay } from './util.js';
import { fail, toast } from './ui.js';
import {
  clockIn, clockOut, dayAttributedSeconds, dayPresenceSeconds,
  openShift, shiftAttributedSeconds, shiftSeconds, state,
} from './store.js';

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const figure = (label, value, id, tone) => h('div', null,
  h('span', { class: 'label', style: { marginBottom: '2px' } }, label),
  h('div', {
    id,
    style: {
      fontSize: '20px', fontWeight: '800', fontVariantNumeric: 'tabular-nums',
      color: tone || 'var(--text-strong)',
    },
  }, value),
);

/* Presence ticks; the gap holds steady while a clock runs and grows while
   nothing does. Cleared on every build and restarted only when a shift is
   open — a closed one still renders these nodes, so leaving the old interval
   alive would keep writing a constant into them forever. */
let tick = null;
function startTick() {
  tick = setInterval(() => {
    const s = openShift();
    const el = s && document.getElementById(`shift-elapsed-${s.id}`);
    if (!el) return clearInterval(tick);
    const present = shiftSeconds(s);
    const attributed = shiftAttributedSeconds(s);
    el.textContent = clock(present);
    const att = document.getElementById(`shift-attributed-${s.id}`);
    const gap = document.getElementById(`shift-gap-${s.id}`);
    if (att) att.textContent = hm(attributed / 60, { zero: '0m' });
    if (gap) gap.textContent = hm((present - attributed) / 60, { zero: '0m' });
  }, 1000);
}

/** One shift: when it ran, what it accounted for, and what it did not. */
function shiftCard(s, action) {
  const present = shiftSeconds(s);
  const attributed = shiftAttributedSeconds(s);

  const when = s.open
    ? `since ${time(s.startedAt)}${s.date === state.today ? '' : `, ${relativeDay(s.date)}`}`
    : `${time(s.startedAt)} – ${time(s.endedAt)}`;

  return h('div', { class: `card pad-sm${s.open ? ' card-callout' : ''}` },
    h('div', { class: 'row' },
      h('div', null,
        h('div', { class: 'elapsed-label' }, s.open ? 'On the clock' : 'Clocked out'),
        h('div', { class: 'dim', style: { fontSize: '13px' } }, when),
      ),
      h('span', { class: 'spacer' }),
      figure('Present', clock(present), `shift-elapsed-${s.id}`),
      figure('Attributed', hm(attributed / 60, { zero: '0m' }), `shift-attributed-${s.id}`),
      figure('Unaccounted', hm((present - attributed) / 60, { zero: '0m' }), `shift-gap-${s.id}`),
      // Shown only when it is above zero, which on a well-formed shift is
      // never. It is the one figure here a client would argue with, so it is
      // coloured as the warning it is rather than sitting in the row unread.
      s.overclaimedMinutes
        ? figure('Overclaimed', hm(s.overclaimedMinutes), null, 'var(--warning)')
        : null,
      action,
    ),
    s.overclaimedMinutes
      ? h('p', { class: 'hint', style: { marginTop: '10px', color: 'var(--warning)' } },
        `The timesheet bills ${hm(s.claimedMinutes)} against ${hm(s.presentMinutes)} of presence. `
        + 'Something claims more minutes than there was time here to work them.')
      : null,
  );
}

/**
 * Build the strip. `onChange` is called after a clock-in or clock-out, once
 * the workspace has reloaded, so the host view can redraw around it.
 */
export function shiftStrip(onChange) {
  clearInterval(tick);
  const shifts = state.shifts;
  const open = openShift();

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

  const wrap = h('div', { class: 'stack', style: { gap: '10px' } });

  if (!shifts.length) {
    wrap.append(h('div', { class: 'card pad-sm' },
      h('div', { class: 'row' },
        h('div', null,
          h('div', { class: 'elapsed-label' }, 'Not clocked in'),
          h('div', { class: 'dim', style: { fontSize: '13px' } },
            'Attendance is separate from your project timers.'),
        ),
        h('span', { class: 'spacer' }),
        inBtn,
      ),
    ));
  } else {
    for (const s of shifts) wrap.append(shiftCard(s, s.open ? outBtn : null));
    // The button belongs to the day, not to a finished shift, so it sits under
    // the run of them once everything is closed.
    if (!open) {
      wrap.append(h('div', { class: 'row' },
        shifts.length > 1
          ? h('span', { class: 'dim', style: { fontSize: '13px' } },
            `${shifts.length} spells today · ${hm(dayPresenceSeconds() / 60, { zero: '0m' })} present, `
            + `${hm(dayAttributedSeconds() / 60, { zero: '0m' })} attributed`)
          : null,
        h('span', { class: 'spacer' }),
        inBtn,
      ));
    } else if (shifts.length > 1) {
      wrap.append(h('div', { class: 'dim', style: { fontSize: '13px' } },
        `${shifts.length} spells today · ${hm(dayPresenceSeconds() / 60, { zero: '0m' })} present, `
        + `${hm(dayAttributedSeconds() / 60, { zero: '0m' })} attributed`));
    }
  }

  // Blocks logged by hand carry no start and end, so nothing can place them
  // inside any one shift — they are a fact about the day. Saying so is the
  // difference between a gap someone can act on and a number they learn to
  // scroll past.
  if (state.unplacedMinutes) {
    wrap.append(h('p', { class: 'hint' },
      `${hm(state.unplacedMinutes)} logged by hand today carries no start and end, `
      + 'so it cannot be placed inside any of the time above.'));
  }

  if (open) startTick();
  return wrap;
}
