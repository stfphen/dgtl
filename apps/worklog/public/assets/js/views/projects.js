/* Projects — the work itself: what it is, who it is for, how much has gone
   into it, and how that sits against the budget. */

import { h, hm, parseDuration, pluralize } from '../util.js';
import {
  confirmDialog, empty, fail, field, icon, kpi, modal, render, select, toast,
} from '../ui.js';
import { quickLog } from '../editors.js';
import { isAdmin, removeProject, saveProject, state } from '../store.js';

export const title = 'Projects';
export const subtitle = () => 'Where the hours go';

/* The colour palette is named as tokens, never as values — the brand lives in
   tokens.css. A project stores its colour as a #rrggbb string, so each token is
   put through the browser's own colour machinery at pick time. Anything CSS
   accepts (a keyword, rgb(), hsl(), color-mix(), oklch(), 3- or 8-digit hex)
   normalises to #rrggbb, so a slot cannot silently disappear because a token
   was written in another notation, and a colour stored in lower case — which is
   what scripts/seed.mjs writes — still matches its swatch. */
const SWATCH_TOKENS = ['--gold', '--gold-tan', '--chart-4', '--chart-5', '--warning', '--error', '--chart-3', '--chart-6'];

let probeCanvas;

/**
 * Any CSS colour → "#RRGGBB". Null when the browser cannot read it as a colour.
 *
 * Validity is the CSSOM's answer — a style declaration silently drops what it
 * cannot parse. The value then comes from painting one pixel and reading it
 * back, because a computed colour does not always serialise as rgb(): a
 * color-mix() lands as color(srgb …) and oklch() stays oklch(). Painting
 * flattens all of them to sRGB bytes, so no swatch is lost to notation.
 */
function toHex(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const probe = document.createElement('span');
  probe.style.color = raw;
  if (!probe.style.color) return null;

  probeCanvas ??= document.createElement('canvas');
  probeCanvas.width = 1;
  probeCanvas.height = 1;
  const ctx = probeCanvas.getContext('2d', { willReadFrequently: true });

  // A canvas keeps its previous fill when it rejects one, so a value it will
  // not take would paint as whatever came before — silently, and usually black.
  // Offering it two different starting points catches that: if the assignment
  // took, both end up the same colour.
  const settle = (start) => { ctx.fillStyle = start; ctx.fillStyle = raw; return ctx.fillStyle; };
  if (settle('white') !== settle('black')) return null;

  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (!a) return null;                      // fully transparent is not a swatch
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** The token palette, resolved. Tokens that will not resolve are named, not dropped silently. */
function palette() {
  const root = getComputedStyle(document.documentElement);
  const colors = [];
  const unresolved = [];
  for (const token of SWATCH_TOKENS) {
    const hex = toHex(root.getPropertyValue(token));
    if (hex) colors.push(hex);
    else unresolved.push(token);
  }
  return { colors, unresolved };
}

/**
 * How the budget bar divides — pure, so the geometry the row draws is the same
 * arithmetic a test can read without a DOM.
 *
 * Under budget the track IS the budget and the fill is what has gone into it.
 * Past it the track has nothing left to give, and a fill clamped to 100% drew a
 * project at 453% pixel-identical to one at 101%: the single most alarming fact
 * in this workspace — 22h 38m of non-billable time against a 5h budget —
 * rendered as "a full red bar", flatly contradicting the "453% of 5h · 17h 38m
 * over" printed beside it.
 *
 * So past 100% the track stops meaning the budget and starts meaning what was
 * SPENT: the budget's share of that is drawn in the project's colour and the
 * overrun in red, and the two are read as a proportion. At 101% the red is a
 * sliver; at 453% it is three quarters of the row, and the eye reaches it
 * before the text does. The bar is on its own scale from that point, which is
 * why the figure beside it always names the budget the percentage is of.
 */
export function budgetBar(loggedMinutes, budgetMinutes) {
  if (!budgetMinutes) return null;
  const pct = (loggedMinutes / budgetMinutes) * 100;
  if (pct <= 100) return { pct, over: false, insidePct: pct, overPct: 0 };
  // The budget as a share of what was spent: 5h of 22h38m is 22% of the row.
  const insidePct = 10000 / pct;
  return { pct, over: true, insidePct, overPct: 100 - insidePct };
}

export function render_(host, { actions }) {
  const ui = { showArchived: false };
  const body = h('div', { class: 'stack' });
  host.append(body);

  const toggle = h('button', {
    class: 'chip',
    onclick: () => { ui.showArchived = !ui.showArchived; toggle.classList.toggle('on', ui.showArchived); draw(); },
  }, 'Show archived');

  render(actions,
    toggle,
    isAdmin()
      ? h('button', { class: 'btn btn-primary', onclick: () => editor(null) }, icon('plus'), 'New project')
      : null,
  );

  function draw() {
    const rows = state.projects.filter((p) => ui.showArchived || p.status === 'active');
    // Every KPI below is measured over `rows`, so the whole strip moves as one
    // when "Show archived" is flipped — and each card names the set it counted
    // rather than leaving the reader to infer it from the toggle.
    const scope = ui.showArchived ? 'across every project' : 'across active projects';
    const totalLogged = rows.reduce((s, p) => s + p.loggedMinutes, 0);
    // Billability belongs to the time entry, not the project: a billable
    // project can hold non-billable hours, so this sums the server's per-entry
    // totals. It still will not equal the Reports figure — this strip is
    // per-project and all-time, Reports is scoped to a range, a person and
    // (here) the archived toggle, and it also counts time logged against no
    // project at all. Time with no project belongs to no project row, so the
    // feet below name what has been left out rather than swallowing it.
    const billableLogged = rows.reduce((s, p) => s + (p.billableMinutes ?? 0), 0);

    // Work that is in the workspace but in no project, and so in no card above.
    const offProject = state.unassigned?.minutes || 0;
    const offProjectTasks = state.tasks.filter(
      (t) => !t.archived && t.status !== 'done' && t.projectId === null,
    ).length;
    const note = (text) => (text ? ` · excludes ${text}` : '');

    if (!rows.length) {
      render(body, h('div', { class: 'card' }, empty({
        title: 'No projects yet',
        subtitle: isAdmin()
          ? 'A project is the bucket hours and tasks hang off. Create the first one.'
          : 'An admin needs to create the first project before time can be logged against it.',
        action: isAdmin() ? h('button', { class: 'btn btn-primary', onclick: () => editor(null) }, icon('plus'), 'New project') : null,
      })));
      return;
    }

    render(body,
      h('div', { class: 'grid cols-4' },
        kpi({
          label: 'Logged all time', value: hm(totalLogged, { zero: '0h' }),
          foot: scope + note(offProject ? `${hm(offProject)} on no project` : ''), hero: true,
        }),
        kpi({
          label: 'Active projects',
          value: String(rows.filter((p) => p.status === 'active').length),
          foot: `of ${pluralize(rows.length, 'project')} shown`,
        }),
        kpi({
          label: 'Open tasks',
          value: String(rows.reduce((s, p) => s + p.openTasks, 0)),
          foot: scope + note(offProjectTasks ? `${offProjectTasks} on no project` : ''),
        }),
        kpi({
          label: 'Billable share',
          value: totalLogged ? `${Math.round((billableLogged / totalLogged) * 100)}%` : '—',
          foot: totalLogged
            ? `${hm(billableLogged, { zero: '0h' })} of ${hm(totalLogged)}, ${scope}`
              + note(offProject ? `${hm(offProject)} on no project` : '')
            : null,
        }),
      ),

      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', null, h('tr', null,
            h('th', null, 'Project'),
            h('th', null, 'Contact'),
            h('th', null, 'Open tasks'),
            h('th', { style: { minWidth: '200px' } }, 'Budget'),
            h('th', { class: 'num' }, 'Logged'),
            h('th', null, ''),
          )),
          h('tbody', null, rows.map(row)),
        )),
    );
  }

  function row(p) {
    const bar = budgetBar(p.loggedMinutes, p.budgetMinutes);

    return h('tr', null,
      h('td', null,
        // Who the work is for, above what the work is — the same grouping the
        // task board reads. Absent rather than "—" when there is no client:
        // an internal project has none, and a dash in every row is noise.
        p.clientName ? h('div', { class: 'client-eyebrow' }, p.clientName) : null,
        h('div', { class: 'dot-tag' },
          h('span', { class: 'dot', style: { background: p.color } }),
          h('span', { style: { fontWeight: '600' } }, p.name),
          p.code ? h('span', { class: 'mono-code' }, p.code) : null,
        ),
        h('div', { class: 'row tight', style: { marginTop: '6px' } },
          p.status === 'archived' ? h('span', { class: 'pill badge-info' }, 'Archived') : null,
          !p.billable ? h('span', { class: 'dim', style: { fontSize: '12px' } }, 'Non-billable') : null,
        ),
      ),
      h('td', { class: 'dim' }, p.client || '—'),
      h('td', null, p.openTasks ? pluralize(p.openTasks, 'task') : h('span', { class: 'dim' }, '—')),
      h('td', null, bar
        ? h('div', null,
          bar.over
            // Two segments and a carved separator, not one clamped fill: the
            // project's colour and --error are only 2.6:1 against each other,
            // and no single divider colour can reach 3:1 against both, so the
            // track's own shade is cut back in between them — each segment then
            // borders something it clears by a wide margin.
            ? h('div', {
              class: 'bar-track thin over',
              title: `${hm(p.loggedMinutes)} spent against a ${hm(p.budgetMinutes)} budget`,
            },
              h('div', { class: 'in', style: { width: `${bar.insidePct}%`, background: p.color } }),
              h('div', { class: 'out', style: { width: `${bar.overPct}%` } }))
            : h('div', { class: 'bar-track thin' },
              h('div', { class: 'bar-fill', style: { width: `${bar.pct}%`, background: p.color } })),
          h('div', { class: `hint${bar.over ? ' over' : ''}`, style: { marginTop: '6px' } },
            `${Math.round(bar.pct)}% of ${hm(p.budgetMinutes)}`
            + (bar.over ? ` · ${hm(p.loggedMinutes - p.budgetMinutes)} over` : '')),
        )
        : h('span', { class: 'dim' }, 'No budget')),
      h('td', { class: 'num', style: { fontWeight: '700' } }, hm(p.loggedMinutes, { zero: '—' })),
      h('td', { class: 'actions' },
        h('button', { class: 'btn-icon', title: 'Log time to this project', onclick: () => quickLog(p.id, draw) }, icon('plus')),
        isAdmin() ? h('button', { class: 'btn-icon', title: 'Edit project', onclick: () => editor(p) }, icon('pencil')) : null,
      ),
    );
  }

  /* ------------------------------------------------------------ editor -- */

  function editor(project) {
    const editing = !!project;
    const nameInput = h('input', { class: 'input', maxlength: '120', placeholder: 'Project name', value: project?.name || '' });
    const contactInput = h('input', { class: 'input', maxlength: '120', placeholder: 'Who you deal with', value: project?.client || '' });

    /* The client is picked, not typed, wherever one already exists: this whole
       round started because five projects belonged to one client and only a
       hand-kept naming convention said so. A free text box would let "The
       Piano Boutique" and "Piano Boutique" become two sections for the same
       people, which is the same failure wearing a different hat. Typing is
       reserved for a genuinely new one. */
    const clientNames = [...new Set(state.projects.map((p) => p.clientName).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    const clientSel = select([
      { value: '', label: 'No client' },
      ...clientNames.map((n) => ({ value: n, label: n })),
    ], { value: project?.clientName || '' });
    // "New client…" is marked on the option, not by a magic value: every value
    // in this list is a client name, so any sentinel string is a name somebody
    // could one day type. The dataset flag cannot be collided with.
    clientSel.append(h('option', { value: '', dataset: { newClient: '1' } }, 'New client…'));
    const wantsNew = () => clientSel.selectedOptions[0]?.dataset.newClient === '1';

    const newClientInput = h('input', { class: 'input', maxlength: '120', placeholder: 'e.g. The Piano Boutique' });
    const newClientField = h('div', { hidden: true }, field('New client', newClientInput));
    clientSel.addEventListener('change', () => {
      newClientField.hidden = !wantsNew();
      if (!newClientField.hidden) newClientInput.focus();
    });
    const chosenClient = () => (wantsNew() ? newClientInput.value.trim() : clientSel.value);
    const codeInput = h('input', { class: 'input', maxlength: '16', placeholder: 'e.g. PLAT', value: project?.code || '' });
    const budgetInput = h('input', {
      class: 'input', placeholder: 'e.g. 120h — leave blank for none',
      value: project?.budgetMinutes ? hm(project.budgetMinutes, { zero: '' }) : '',
    });
    const billable = h('input', { type: 'checkbox', checked: project ? project.billable : true });
    const statusSel = select(
      [{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }],
      { value: project?.status || 'active' },
    );

    const { colors, unresolved } = palette();
    // The stored value goes through the same normaliser as the tokens, so a
    // colour seeded in lower case still matches — and is saved back in the one
    // form the API stores. Null keeps whatever the project already has.
    let color = toHex(project?.color) || colors[0] || null;
    const dots = colors.map((c) => h('button', {
      type: 'button', title: c, 'aria-label': `Colour ${c}`,
      style: {
        width: '26px', height: '26px', borderRadius: '50%', background: c,
        cursor: 'pointer', padding: '0',
      },
      onclick: () => { color = c; paintSwatches(); },
    }));
    // Selection is carried by aria-pressed as well as the ring, so it is not
    // colour-alone — and the ring itself is a token, not a literal.
    function paintSwatches() {
      for (const dot of dots) {
        const on = dot.title === color;
        dot.style.border = on ? '2px solid var(--text)' : '1px solid var(--border)';
        dot.setAttribute('aria-pressed', String(on));
      }
    }
    paintSwatches();

    // A palette that came up short says so. Silently showing fewer swatches
    // than the design system defines is how a broken token goes unnoticed.
    const swatches = h('div', null,
      colors.length ? h('div', { class: 'row tight' }, dots) : null,
      unresolved.length
        ? h('span', { class: 'hint' }, colors.length
          ? `${unresolved.join(', ')} did not resolve to a colour — ${pluralize(unresolved.length, 'swatch', 'swatches')} missing from the palette.`
          : 'The brand colour tokens did not load, so there is no palette to pick from. '
            + 'Saving keeps the colour this project already has.')
        : null,
    );

    const errLine = h('div', { class: 'err', hidden: true });

    modal({
      title: editing ? 'Edit project' : 'New project',
      body: () => [
        field('Name', nameInput),
        h('div', { class: 'row' },
          field('Client', clientSel, 'Groups this project on the task board'),
          field('Contact', contactInput, 'The person, not the company'),
        ),
        newClientField,
        h('div', { class: 'row' }, field('Code', codeInput, 'Short tag for dense views'), field('Budget', budgetInput, 'Accepts 120h or 7200m')),
        editing ? field('Status', statusSel) : null,
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Colour'), swatches),
        h('label', { class: 'switch' }, billable, h('span', { class: 'track' }), h('span', null, 'Billable work')),
        errLine,
      ],
      actions: (close) => [
        editing && !project.loggedMinutes ? h('button', {
          class: 'btn btn-danger left',
          onclick: async () => {
            // Every task ever filed under the project is detached, not just the
            // open ones — so the warning counts all of them and mentions how
            // many are still open, rather than quoting the smaller number and
            // being contradicted by the toast a second later.
            const attached = project.taskCount ?? project.openTasks;
            const open = project.openTasks;
            if (!await confirmDialog({
              title: `Delete "${project.name}"?`,
              message: attached
                ? `It has no time logged against it, so no hours are lost. Its ${pluralize(attached, 'task')}`
                  + `${open ? ` (${open} still open)` : ''} survive and keep their history, `
                  + 'but they lose the project and cannot be put back.'
                : 'It has no time logged against it and no tasks attached, so nothing is lost.',
              confirmLabel: 'Delete project', danger: true,
            })) return;
            try {
              const res = await removeProject(project.id);
              const kept = res?.detachedTasks ?? 0;
              const stillOpen = res?.detachedOpenTasks ?? 0;
              toast(kept
                ? `Project deleted · ${pluralize(kept, 'task')} kept${stillOpen ? `, ${stillOpen} still open` : ''}`
                : 'Project deleted');
              close();
              draw();
            } catch (e) { fail(e); }
          },
        }, 'Delete') : null,
        h('button', { class: 'btn btn-ghost', onclick: close }, 'Cancel'),
        h('button', {
          class: 'btn btn-primary',
          onclick: async (e) => {
            if (!nameInput.value.trim()) {
              errLine.textContent = 'Give the project a name.';
              errLine.hidden = false;
              return nameInput.focus();
            }
            const budget = budgetInput.value.trim() ? parseDuration(budgetInput.value) : null;
            if (budgetInput.value.trim() && !budget) {
              errLine.textContent = 'Budget should look like 120h, 7200m or 120:00.';
              errLine.hidden = false;
              return budgetInput.focus();
            }
            if (wantsNew() && !newClientInput.value.trim()) {
              errLine.textContent = 'Name the new client, or choose one from the list.';
              errLine.hidden = false;
              return newClientInput.focus();
            }
            e.target.disabled = true;
            try {
              await saveProject(project?.id, {
                name: nameInput.value.trim(),
                client: contactInput.value.trim(),
                clientName: chosenClient(),
                code: codeInput.value.trim(),
                color,
                billable: billable.checked,
                budgetMinutes: budget,
                ...(editing ? { status: statusSel.value } : {}),
              });
              toast(editing ? 'Project updated' : 'Project created', 'success');
              close();
              draw();
            } catch (err) { e.target.disabled = false; fail(err); }
          },
        }, editing ? 'Save changes' : 'Create project'),
      ],
    });
  }

  draw();
}

export { render_ as render };
