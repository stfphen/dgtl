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
 * them and the morning's gap does not stop existing at one o'clock.
 *
 * The strip is the summary; the sheet below it is the artefact. Clocking out
 * opens the sheet, because the moment the day closes is the only moment anyone
 * will ever look at it — and it is the thing an owner reads to answer "what did
 * I do today", and to defend an invoice against a client who asks. */

import { clock, dayLong, h, hm, relativeDay } from './util.js';
import { confirmDialog, empty, fail, field, icon, modal, render, toast } from './ui.js';
import { api } from './api.js';
import {
  activeProjects, clockIn, clockOut, dayAttributedSeconds, dayPresenceSeconds,
  disposeGap, openShift, removeShift, saveShift, shiftAttributedSeconds, shiftSeconds, state,
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

/* ------------------------------------------------------------- the sheet -- */

/**
 * A datetime-local field's value, from an instant. The browser's own zone, the
 * same one every clock time in this strip is already printed in — a field
 * seeded in APP_TIMEZONE would read back through the browser's on save and
 * move the shift by the difference.
 */
const pad = (n) => String(n).padStart(2, '0');
const localField = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    + `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** One row of the day: a stretch of work, the clock still running, or a gap. */
function segmentRow(seg, onAssign) {
  const gap = seg.kind === 'gap';
  // An entry billing more minutes than its own window ran for. The total at the
  // top says the shift overclaims; this says which stretch does it.
  const over = !gap && seg.claimsMinutes > seg.spanMinutes;

  return h('div', { class: `sheet-row${gap ? ' is-gap' : ''}${over ? ' is-over' : ''}` },
    h('span', { class: 'sheet-when' }, `${time(seg.from)} – ${time(seg.to)}`),
    h('span', { class: 'sheet-what' },
      gap
        ? h('span', { class: 'dot-tag' },
          h('span', { class: 'dot dot-open' }), 'Nothing accounts for this')
        : h('span', { class: 'dot-tag' },
          h('span', { class: 'dot', style: { background: seg.projectColor || 'var(--nil)' } }),
          seg.projectName || 'No project',
          seg.kind === 'running' ? h('span', { class: 'pill' }, 'Running') : null,
          !seg.billable ? h('span', { class: 'pill badge-info' }, 'Non-billable') : null),
      seg.note || seg.taskTitle
        ? h('div', { class: 'sheet-note' }, seg.taskTitle || seg.note) : null,
      over
        ? h('div', { class: 'sheet-note warn' },
          `bills ${hm(seg.claimsMinutes)} for a stretch that ran ${hm(seg.spanMinutes)}`)
        : null,
    ),
    h('span', { class: 'sheet-min' }, hm(seg.minutes, { zero: 'under a minute' })),
    // The slot is held open whether or not there is a button in it, so the
    // durations line up down the column instead of stepping in and out by the
    // width of the word "Assign" — on the one page in this app whose whole job
    // is to be read carefully.
    h('span', { class: 'sheet-act' },
      gap && seg.minutes >= 1 && onAssign
        ? h('button', { class: 'btn btn-ghost btn-sm', onclick: () => onAssign(seg) }, 'Assign')
        : null),
  );
}

/**
 * The clock-out reconciliation sheet: the day laid out end to end, what it
 * accounted for, and what it did not — with the gap disposable in one tap.
 *
 * Deliberately not a form. Nothing here has to be filled in and nothing is
 * saved on close: a gap is a fact, and a sheet that refused to shut until the
 * afternoon was labelled would teach everyone to tap "overhead" on everything,
 * which is exactly how the figure stops meaning anything.
 *
 * @param shift    the shift as the strip already has it — the title reads off
 *                 this so the sheet has a heading before the fetch lands
 * @param onChange called once the workspace has reloaded after a disposition
 */
export function shiftSheet(shift, onChange) {
  const host = h('div', { class: 'stack', style: { gap: '16px' } });
  let sheet = null;
  let scope = null;    // one gap row, or null for the whole of it

  async function reload() {
    try { sheet = await api.shiftSheet(shift.id); } catch (e) { fail(e); return; }
    paint();
  }

  async function dispose(project) {
    try {
      const res = await disposeGap(shift.id, {
        projectId: project.id,
        note: 'Unaccounted presence',
        ...(scope ? { from: scope.from, to: scope.to } : {}),
      });
      toast(`${hm(res.minutes)} put against ${project.name}`
        + (project.billable ? '' : ' — non-billable'), 'success');
      scope = null;
      await reload();
      onChange?.();
    } catch (e) { fail(e); }
  }

  /** The chips. An overhead bucket is a project flagged non-billable, so the
      two groups are the same list read two ways — there is no second kind of
      thing here for the reports to be ignorant of. */
  function disposeStrip() {
    const open = scope ? scope.minutes : sheet.openMinutes;
    if (!open) {
      return h('p', { class: 'hint' },
        sheet.shift.presentMinutes
          ? 'Every minute of this spell has something behind it.'
          : 'Nothing to account for.');
    }
    // The server refuses to fill a gap that is still growing, so the chips are
    // not offered — an affordance that only ever produces a refusal is worse
    // than no affordance.
    if (sheet.shift.open) {
      return h('p', { class: 'hint' },
        `${hm(open)} is unaccounted for so far. Clock out and this can be put against a `
        + 'project or an overhead bucket in one tap — while the clock runs, the gap is '
        + 'still moving.');
    }
    const projects = activeProjects();
    const overhead = projects.filter((p) => !p.billable);
    const billable = projects.filter((p) => p.billable);

    const group = (label, list) => h('div', { class: 'suggest-group' },
      h('div', { class: 'eyebrow' }, label),
      h('div', { class: 'suggest' }, list.map((p) => h('button', {
        class: 'chip proj',
        title: `Put ${hm(open)} against ${p.name}`,
        onclick: () => dispose(p),
      }, h('span', { class: 'dot', style: { background: p.color } }), p.name))),
    );

    return h('div', { class: 'sheet-dispose' },
      h('div', { class: 'row' },
        // "Open time", not "unaccounted": gaps are floored to whole minutes,
        // so on a day that ended mid-minute this figure sits one below the
        // Unaccounted total at the top. They are different quantities — one is
        // the gap, one is what can actually be filed into it — and giving them
        // the same name would read as the same number contradicting itself.
        h('div', { class: 'eyebrow' }, scope
          ? `Put ${time(scope.from)} – ${time(scope.to)} against`
          : `Put ${hm(open)} of open time against`),
        h('span', { class: 'spacer' }),
        scope
          ? h('button', {
            class: 'btn btn-ghost btn-sm',
            onclick: () => { scope = null; paint(); },
          }, `All ${hm(sheet.openMinutes)} instead`)
          : null,
      ),
      // Named for the flag they are grouped by, not for what someone hoped
      // they would be: this list is every non-billable project, and an overhead
      // bucket is one of those. A group called "Overhead" holding a product
      // workstream that simply is not billed to a client would be a second,
      // invented category wearing the first one's label.
      overhead.length ? group('Overhead & non-billable', overhead) : null,
      billable.length ? group('Billable projects', billable) : null,
      overhead.length ? null : h('p', { class: 'hint' },
        'An overhead bucket is an ordinary project flagged non-billable. Add Admin, '
        + 'Sales or Break on the Projects screen and they will appear here.'),
      h('p', { class: 'hint' },
        'A gap is a fact, not an error — closing this without filling it leaves it as it is.'),
    );
  }

  function paint() {
    if (!sheet) {
      render(host, h('p', { class: 'dim', style: { fontSize: '13px' } }, 'Reading the day…'));
      return;
    }
    const g = sheet.shift;
    render(host,
      h('div', { class: 'row sheet-figures' },
        figure('Present', hm(g.presentMinutes, { zero: '0m' })),
        figure('Attributed', hm(g.attributedMinutes, { zero: '0m' })),
        figure('Unaccounted', hm(g.unattributedMinutes, { zero: 'none' }), null,
          g.unattributedMinutes ? 'var(--gold)' : null),
        g.overclaimedMinutes
          ? figure('Overclaimed', hm(g.overclaimedMinutes), null, 'var(--warning)')
          : null,
      ),

      sheet.segments.length
        ? h('div', { class: 'sheet' },
          // A gap under a minute is the residue of flooring — the day ended
          // partway through one — and nothing can ever be filed into it. The
          // payload still carries it, so the day tiles end to end; a row saying
          // "nothing accounts for this · under a minute" is only clutter, and
          // clutter on this sheet is what teaches people not to read it.
          sheet.segments.filter((seg) => seg.kind !== 'gap' || seg.minutes >= 1)
            // No per-row Assign while the shift is open: the gap it points at
            // is still moving, and the server will refuse to fill it.
            .map((seg) => segmentRow(seg,
              sheet.shift.open ? null : (s) => { scope = s; paint(); })))
        : empty({ title: 'No time inside this spell', subtitle: 'Nothing was clocked while you were here.' }),

      g.overclaimedMinutes
        ? h('p', { class: 'hint warn' },
          `The timesheet bills ${hm(g.claimedMinutes)} against ${hm(g.presentMinutes)} of presence. `
          + 'Something claims more minutes than there was time here to work them, so the gap '
          + 'cannot be filled until that entry is corrected.')
        : null,
      sheet.shortfallMinutes
        ? h('p', { class: 'hint' },
          `${hm(sheet.shortfallMinutes)} of this presence is inside a stretch that bills less than `
          + 'it ran for, so it is unattributed but not open — correct that entry rather than '
          + 'filing something new on top of it.')
        : null,
      sheet.unplacedMinutes
        ? h('p', { class: 'hint' },
          `${hm(sheet.unplacedMinutes)} logged by hand on this day carries no start and end, `
          + 'so nothing can place it inside this presence.')
        : null,

      disposeStrip(),
    );
  }

  modal({
    title: shift.open ? 'The day so far' : 'Clocked out',
    subtitle: `${dayLong(shift.date)} · ${time(shift.startedAt)}`
      + (shift.endedAt ? ` – ${time(shift.endedAt)}` : ' — still running'),
    wide: true,
    body: () => host,
    actions: (close) => [
      h('button', {
        class: 'btn btn-ghost left',
        // The editor replaces this modal (there is only ever one), so the sheet
        // is re-opened afterwards against the corrected day — unless the spell
        // was deleted, in which case there is no day left to open.
        onclick: () => shiftEditor(shift, () => {
          onChange?.();
          const fresh = state.shifts.find((x) => x.id === shift.id);
          if (fresh) shiftSheet(fresh, onChange);
        }),
      }, icon('pencil'), 'Correct the hours'),
      h('button', { class: 'btn btn-primary', onclick: close }, 'Done'),
    ],
  });

  reload();
}

/* ------------------------------------------------------------ the editor -- */

/**
 * Correct or remove a spell of attendance.
 *
 * The server owns every rule here — inverted, over a day, overlapping another,
 * reopened while one is already running — and each refusal arrives as a
 * sentence. It is printed where the mistake was made rather than thrown as a
 * toast that has gone by the time the reader looks up.
 */
export function shiftEditor(shift, onDone) {
  const startInput = h('input', { class: 'input', type: 'datetime-local', value: localField(shift.startedAt) });
  const endInput = h('input', {
    class: 'input', type: 'datetime-local', value: shift.endedAt ? localField(shift.endedAt) : '',
  });
  const errLine = h('div', { class: 'err', hidden: true });
  const say = (msg) => { errLine.textContent = msg; errLine.hidden = false; };

  modal({
    title: 'Correct this spell',
    subtitle: `${dayLong(shift.date)} · ${hm(shift.presentMinutes, { zero: '0m' })} of presence recorded`,
    body: () => [
      h('div', { class: 'row' },
        field('Clocked in', startInput),
        field('Clocked out', endInput, 'Leave blank to re-open this spell'),
      ),
      h('p', { class: 'hint' },
        'Attendance carries no project and no minutes, so correcting it moves nothing on the '
        + 'timesheet. What it moves is the presence every logged hour is measured against.'),
      errLine,
    ],
    actions: (close) => [
      h('button', {
        class: 'btn btn-danger left',
        onclick: async () => {
          if (!await confirmDialog({
            title: 'Delete this spell?',
            message: 'The record that you were here goes; every hour you logged stays exactly '
              + 'where it is. Nothing references a shift.',
            confirmLabel: 'Delete spell', danger: true,
          })) return;
          try {
            await removeShift(shift.id);
            toast('Spell deleted — no logged work was touched');
            close();
            onDone?.();
          } catch (e) { fail(e); }
        },
      }, 'Delete'),
      h('button', { class: 'btn btn-ghost', onclick: close }, 'Cancel'),
      h('button', {
        class: 'btn btn-primary',
        onclick: async (e) => {
          const from = new Date(startInput.value);
          if (!startInput.value || Number.isNaN(from.getTime())) {
            say('Give the spell a start time.');
            return startInput.focus();
          }
          const to = endInput.value ? new Date(endInput.value) : null;
          if (endInput.value && Number.isNaN(to.getTime())) {
            say('That end time is not a date and time.');
            return endInput.focus();
          }
          e.target.disabled = true;
          try {
            const saved = await saveShift(shift.id, {
              startedAt: from.toISOString(),
              endedAt: to ? to.toISOString() : null,
            });
            toast(saved.open
              ? 'Spell re-opened — you are back on the clock'
              : `Spell corrected · ${hm(saved.presentMinutes, { zero: '0m' })} present`, 'success');
            close();
            onDone?.();
          } catch (err) {
            e.target.disabled = false;
            say(err?.message || 'That could not be saved.');
          }
        },
      }, 'Save'),
    ],
  });
}

/* -------------------------------------------------------------- the strip -- */

/** One shift: when it ran, what it accounted for, and what it did not. */
function shiftCard(s, onChange, action) {
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
      h('div', { class: 'row tight shift-actions' },
        action,
        // The sheet is where the gap gets dealt with, and the pencil is the
        // only way to reach the correction endpoints at all — without it a
        // forgotten clock-out is nineteen hours nobody can fix without SQL.
        h('button', {
          class: 'btn btn-secondary btn-sm',
          onclick: () => shiftSheet(s, onChange),
        }, s.open ? 'Review' : 'Review the day'),
        h('button', {
          class: 'btn-icon', title: 'Correct these hours',
          onclick: () => shiftEditor(s, onChange),
        }, icon('pencil')),
      ),
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
    class: 'btn btn-secondary btn-sm',
    onclick: async (e) => {
      e.target.disabled = true;
      try {
        const res = await clockOut();
        toast(res.banked
          ? `Clocked out — your timer was still running, so ${hm(res.banked.minutes)} was banked`
          : 'Clocked out', 'success');
        onChange?.();
        // The sheet, not a toast. A one-line summary of the day is exactly the
        // thing that gets read as a notification and forgotten; this is the
        // moment — and the only moment — anyone looks at what the day was.
        shiftSheet(res.shift, onChange);
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
    for (const s of shifts) wrap.append(shiftCard(s, onChange, s.open ? outBtn : null));
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
