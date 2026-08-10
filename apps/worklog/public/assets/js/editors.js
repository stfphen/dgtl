/* DGTL Worklog — the two modals used from several views: log/edit time, and
   create/edit a to-do. Kept here so Today, Timesheet, Tasks and Reports all
   open exactly the same dialog. */

import { h, hm, parseDuration, today as todayDate } from './util.js';
import {
  confirmDialog, fail, field, modal, projectOptions, select, taskOptions, toast, userOptions,
} from './ui.js';
import { isAdmin, removeEntry, removeTask, saveEntry, saveTask, state } from './store.js';

/**
 * Log or edit a time entry.
 * @param entry   existing entry, or null to create
 * @param defaults {date, projectId, taskId} pre-fill for a new entry
 */
export function entryEditor(entry = null, defaults = {}, onDone) {
  const editing = !!entry;
  const projSel = select(projectOptions(state.projects, { includeArchived: editing }), {
    value: entry?.projectId ?? defaults.projectId ?? '',
    placeholder: 'No project',
  });
  const taskSel = select(taskOptions(state.tasks, entry?.projectId ?? defaults.projectId), {
    value: entry?.taskId ?? defaults.taskId ?? '',
    placeholder: 'No task',
  });
  // Narrowing the project should narrow the task list with it.
  projSel.addEventListener('change', () => {
    const keep = taskSel.value;
    const opts = taskOptions(state.tasks, projSel.value);
    taskSel.replaceChildren(h('option', { value: '' }, 'No task'),
      ...opts.map((o) => h('option', { value: String(o.value) }, o.label)));
    taskSel.value = opts.some((o) => String(o.value) === keep) ? keep : '';
  });

  const dateInput = h('input', {
    class: 'input', type: 'date', value: entry?.date || defaults.date || todayDate(),
  });
  const durInput = h('input', {
    class: 'input', type: 'text', inputmode: 'decimal',
    placeholder: 'e.g. 1:30, 1.5h or 90m',
    value: entry ? hm(entry.minutes, { zero: '' }) : '',
  });
  const noteInput = h('input', {
    class: 'input', type: 'text', maxlength: '500',
    placeholder: 'What did you work on?', value: entry?.note || '',
  });
  const billable = h('input', { type: 'checkbox', checked: entry ? entry.billable : true });
  const userSel = isAdmin()
    ? select(userOptions(state.users), { value: entry?.userId ?? state.user.id })
    : null;

  const errLine = h('div', { class: 'err', hidden: true });

  modal({
    title: editing ? 'Edit time entry' : 'Log time',
    subtitle: editing ? null : 'Hours you record here roll straight into the timesheet and reports.',
    body: () => [
      h('div', { class: 'row' },
        field('Project', projSel),
        field('Task', taskSel),
      ),
      h('div', { class: 'row' },
        field('Date', dateInput),
        field('Duration', durInput, 'Accepts 1:30 · 1.5h · 90m'),
      ),
      field('Note', noteInput),
      userSel ? field('Person', userSel) : null,
      h('label', { class: 'switch' },
        billable, h('span', { class: 'track' }), h('span', null, 'Billable'),
      ),
      errLine,
    ],
    actions: (close) => [
      editing ? h('button', {
        class: 'btn btn-danger left',
        onclick: async () => {
          if (!await confirmDialog({
            title: 'Delete this entry?',
            message: `${hm(entry.minutes)} on ${entry.date} will be removed from the timesheet. This cannot be undone.`,
            confirmLabel: 'Delete entry', danger: true,
          })) return;
          try {
            await removeEntry(entry.id);
            toast('Entry deleted');
            onDone?.();
          } catch (err) { fail(err); }
        },
      }, 'Delete') : null,
      h('button', { class: 'btn btn-ghost', onclick: close }, 'Cancel'),
      h('button', {
        class: 'btn btn-primary',
        onclick: async (e) => {
          const minutes = parseDuration(durInput.value);
          if (!minutes || minutes < 1) {
            errLine.textContent = 'Enter a duration such as 1:30, 1.5h or 90m.';
            errLine.hidden = false;
            durInput.focus();
            return;
          }
          e.target.disabled = true;
          try {
            await saveEntry(entry?.id, {
              projectId: projSel.value ? Number(projSel.value) : null,
              taskId: taskSel.value ? Number(taskSel.value) : null,
              date: dateInput.value,
              minutes,
              note: noteInput.value,
              billable: billable.checked,
              ...(userSel ? { userId: Number(userSel.value) } : {}),
            });
            toast(editing ? 'Entry updated' : `Logged ${hm(minutes)}`, 'success');
            close();
            onDone?.();
          } catch (err) {
            e.target.disabled = false;
            fail(err);
          }
        },
      }, editing ? 'Save changes' : 'Log time'),
    ],
  });
}

/** Create or edit a to-do. */
export function taskEditor(task = null, defaults = {}, onDone) {
  const editing = !!task;
  const titleInput = h('input', {
    class: 'input', type: 'text', maxlength: '200',
    placeholder: 'What needs doing?', value: task?.title || '',
  });
  const projSel = select(projectOptions(state.projects, { includeArchived: editing }), {
    value: task?.projectId ?? defaults.projectId ?? '', placeholder: 'No project',
  });
  const assigneeSel = select(userOptions(state.users), {
    value: task?.assigneeId ?? state.user.id, placeholder: 'Unassigned',
  });
  const statusSel = select(
    [{ value: 'todo', label: 'To do' }, { value: 'doing', label: 'In progress' }, { value: 'done', label: 'Done' }],
    { value: task?.status || 'todo' },
  );
  const prioSel = select(
    [{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }],
    { value: task?.priority || 'normal' },
  );
  const estInput = h('input', {
    class: 'input', type: 'text', placeholder: 'e.g. 3h',
    value: task?.estimateMinutes ? hm(task.estimateMinutes, { zero: '' }) : '',
  });
  const dueInput = h('input', { class: 'input', type: 'date', value: task?.dueDate || defaults.dueDate || '' });
  const notesInput = h('textarea', { class: 'textarea', maxlength: '4000', placeholder: 'Detail, links, context…' },
    task?.notes || '');
  const errLine = h('div', { class: 'err', hidden: true });

  modal({
    wide: true,
    title: editing ? 'Edit task' : 'New task',
    body: () => [
      field('Task', titleInput),
      h('div', { class: 'row' },
        field('Project', projSel),
        field('Assignee', assigneeSel),
      ),
      h('div', { class: 'row' },
        field('Status', statusSel),
        field('Priority', prioSel),
      ),
      h('div', { class: 'row' },
        field('Estimate', estInput, 'Optional — compared against logged time'),
        field('Due date', dueInput),
      ),
      field('Notes', notesInput),
      errLine,
    ],
    actions: (close) => [
      editing ? h('button', {
        class: 'btn btn-danger left',
        onclick: async () => {
          if (!await confirmDialog({
            title: 'Delete this task?',
            message: 'Any time already logged against it is kept — only the to-do is removed.',
            confirmLabel: 'Delete task', danger: true,
          })) return;
          try {
            await removeTask(task.id);
            toast('Task deleted');
            close();
            onDone?.();
          } catch (err) { fail(err); }
        },
      }, 'Delete') : null,
      h('button', { class: 'btn btn-ghost', onclick: close }, 'Cancel'),
      h('button', {
        class: 'btn btn-primary',
        onclick: async (e) => {
          if (!titleInput.value.trim()) {
            errLine.textContent = 'Give the task a title.';
            errLine.hidden = false;
            titleInput.focus();
            return;
          }
          e.target.disabled = true;
          try {
            await saveTask(task?.id, {
              title: titleInput.value.trim(),
              projectId: projSel.value ? Number(projSel.value) : null,
              assigneeId: assigneeSel.value ? Number(assigneeSel.value) : null,
              status: statusSel.value,
              priority: prioSel.value,
              estimateMinutes: estInput.value.trim() ? parseDuration(estInput.value) : null,
              dueDate: dueInput.value || null,
              notes: notesInput.value,
            });
            toast(editing ? 'Task updated' : 'Task added', 'success');
            close();
            onDone?.();
          } catch (err) {
            e.target.disabled = false;
            fail(err);
          }
        },
      }, editing ? 'Save changes' : 'Add task'),
    ],
  });
}

/** Quick "log time against this project", used from the projects table. */
export const quickLog = (projectId, onDone) =>
  entryEditor(null, { projectId, date: todayDate() }, onDone);
