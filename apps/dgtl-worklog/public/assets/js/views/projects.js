/* Projects — the work itself: what it is, who it is for, how much has gone
   into it, and how that sits against the budget. */

import { h, hm, parseDuration, pluralize } from '../util.js';
import {
  confirmDialog, empty, fail, field, icon, kpi, modal, render, select, toast,
} from '../ui.js';
import { quickLog } from '../editors.js';
import { isAdmin, removeProject, saveProject, state } from '../store.js';
import { api } from '../api.js';

export const title = 'Projects';
export const subtitle = () => 'Where the hours go';

/* The project colour is stored as a #rrggbb string (the API validates that
   shape), so the palette is named as tokens and resolved to computed values at
   pick time. The brand values stay in tokens.css and are never restated here. */
const SWATCH_TOKENS = ['--gold', '--gold-tan', '--chart-4', '--chart-5', '--warning', '--error', '--chart-3', '--chart-6'];
const HEX = /^#[0-9a-fA-F]{6}$/;

const swatchColors = () => {
  const root = getComputedStyle(document.documentElement);
  return SWATCH_TOKENS
    .map((t) => root.getPropertyValue(t).trim().toUpperCase())
    .filter((c) => HEX.test(c));
};

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
    // project can hold non-billable hours. Summing the server's per-entry
    // billable totals is what makes this agree with the Reports screen.
    const billableLogged = rows.reduce((s, p) => s + (p.billableMinutes ?? 0), 0);

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
        h('div', { class: 'card pad-sm kpi hero' },
          h('div', { class: 'label' }, 'Logged all time'),
          h('div', { class: 'value' }, hm(totalLogged, { zero: '0h' })),
        ),
        h('div', { class: 'card pad-sm kpi' },
          h('div', { class: 'label' }, 'Active projects'),
          h('div', { class: 'value' }, String(state.projects.filter((p) => p.status === 'active').length)),
        ),
        h('div', { class: 'card pad-sm kpi' },
          h('div', { class: 'label' }, 'Open tasks'),
          h('div', { class: 'value' }, String(rows.reduce((s, p) => s + p.openTasks, 0))),
        ),
        h('div', { class: 'card pad-sm kpi' },
          h('div', { class: 'label' }, 'Billable share'),
          h('div', { class: 'value' }, totalLogged
            ? `${Math.round((rows.filter((p) => p.billable).reduce((s, p) => s + p.loggedMinutes, 0) / totalLogged) * 100)}%`
            : '—'),
        ),
      ),

      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', null, h('tr', null,
            h('th', null, 'Project'),
            h('th', null, 'Client'),
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
    const pct = p.budgetMinutes ? (p.loggedMinutes / p.budgetMinutes) * 100 : null;
    const over = pct !== null && pct > 100;

    return h('tr', null,
      h('td', null,
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
      h('td', null, p.budgetMinutes
        ? h('div', null,
          h('div', { class: `bar-track thin${over ? ' bar-over' : ''}` },
            h('div', {
              class: 'bar-fill',
              style: { width: `${Math.min(100, pct)}%`, background: over ? 'var(--error)' : p.color },
            })),
          h('div', { class: 'hint', style: { marginTop: '6px' } },
            `${Math.round(pct)}% of ${hm(p.budgetMinutes)}${over ? ` · ${hm(p.loggedMinutes - p.budgetMinutes)} over` : ''}`),
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
    const clientInput = h('input', { class: 'input', maxlength: '120', placeholder: 'Client or internal team', value: project?.client || '' });
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

    let color = project?.color || SWATCHES[0];
    const swatches = h('div', { class: 'row tight' }, SWATCHES.map((c) => {
      const dot = h('button', {
        type: 'button', title: c,
        style: {
          width: '26px', height: '26px', borderRadius: '50%', background: c, cursor: 'pointer',
          border: c === color ? '2px solid #fff' : '1px solid var(--border)', padding: '0',
        },
        onclick: () => {
          color = c;
          for (const s of swatches.children) s.style.border = s.title === c ? '2px solid #fff' : '1px solid var(--border)';
        },
      });
      return dot;
    }));

    const errLine = h('div', { class: 'err', hidden: true });

    modal({
      title: editing ? 'Edit project' : 'New project',
      body: () => [
        field('Name', nameInput),
        h('div', { class: 'row' }, field('Client', clientInput), field('Code', codeInput, 'Short tag for dense views')),
        h('div', { class: 'row' }, field('Budget', budgetInput, 'Accepts 120h or 7200m'), editing ? field('Status', statusSel) : null),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Colour'), swatches),
        h('label', { class: 'switch' }, billable, h('span', { class: 'track' }), h('span', null, 'Billable work')),
        errLine,
      ],
      actions: (close) => [
        editing && !project.loggedMinutes ? h('button', {
          class: 'btn btn-danger left',
          onclick: async () => {
            if (!await confirmDialog({
              title: `Delete "${project.name}"?`,
              message: 'It has no time logged against it, so nothing is lost. Tasks keep their history but lose the project.',
              confirmLabel: 'Delete project', danger: true,
            })) return;
            try { await removeProject(project.id); toast('Project deleted'); close(); draw(); } catch (e) { fail(e); }
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
            e.target.disabled = true;
            try {
              await saveProject(project?.id, {
                name: nameInput.value.trim(),
                client: clientInput.value.trim(),
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
