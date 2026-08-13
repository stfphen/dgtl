/* Settings — your own preferences, your password, a data export, and (for
   admins) the team roster. */

import { h, hm, parseDuration } from '../util.js';
import {
  avatar, confirmDialog, fail, field, icon, modal, render, select, toast,
} from '../ui.js';
import { isAdmin, saveMe, saveUser, state } from '../store.js';
import { api } from '../api.js';

export const title = 'Settings';
export const subtitle = () => 'You, your team, your data';

const WEEKDAYS = [
  { value: 1, label: 'Monday' }, { value: 0, label: 'Sunday' }, { value: 6, label: 'Saturday' },
];

export function render_(host) {
  const body = h('div', { class: 'stack' });
  host.append(body);

  function draw() {
    render(body,
      h('div', { class: 'grid top', style: { gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' } },
        profileCard(),
        passwordCard(),
      ),
      isAdmin() ? teamCard() : null,
      dataCard(),
    );
  }

  /* ----------------------------------------------------------- profile -- */

  function profileCard() {
    const nameInput = h('input', { class: 'input', maxlength: '120', value: state.user.name });
    const targetInput = h('input', {
      class: 'input', value: hm(state.user.dailyTargetMinutes, { zero: '' }), placeholder: 'e.g. 8h',
    });
    const weekSel = select(WEEKDAYS, { value: state.user.weekStart });

    return h('div', { class: 'card' },
      h('div', { class: 'card-head' },
        avatar(state.user.name),
        h('div', null,
          h('h3', null, state.user.name),
          h('div', { class: 'dim', style: { fontSize: '12px' } }, `${state.user.email} · ${state.user.role}`),
        ),
      ),
      h('div', { class: 'stack', style: { gap: '16px' } },
        field('Display name', nameInput),
        h('div', { class: 'row' },
          field('Daily target', targetInput, 'Drives the ring on Today'),
          field('Week starts on', weekSel),
        ),
        h('div', { class: 'row' },
          h('button', {
            class: 'btn btn-primary',
            onclick: async (e) => {
              const target = targetInput.value.trim() ? parseDuration(targetInput.value) : 0;
              if (targetInput.value.trim() && target === null) return toast('Target should look like 8h or 480m', 'error');
              e.target.disabled = true;
              try {
                await saveMe({
                  name: nameInput.value.trim() || state.user.name,
                  dailyTargetMinutes: target ?? 0,
                  weekStart: Number(weekSel.value),
                });
                toast('Preferences saved', 'success');
                draw();
              } catch (err) { e.target.disabled = false; fail(err); }
            },
          }, 'Save preferences'),
        ),
      ),
    );
  }

  function passwordCard() {
    const current = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
    const next = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
    const confirm = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
    const err = h('div', { class: 'err', hidden: true });

    return h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', null, 'Change password')),
      h('div', { class: 'stack', style: { gap: '16px' } },
        field('Current password', current),
        field('New password', next, 'At least 10 characters'),
        field('Confirm new password', confirm),
        err,
        h('div', { class: 'row' },
          h('button', {
            class: 'btn btn-secondary',
            onclick: async (e) => {
              err.hidden = true;
              if (next.value.length < 10) {
                err.textContent = 'New password must be at least 10 characters.';
                return (err.hidden = false);
              }
              if (next.value !== confirm.value) {
                err.textContent = 'The two new passwords do not match.';
                return (err.hidden = false);
              }
              e.target.disabled = true;
              try {
                await saveMe({ currentPassword: current.value, newPassword: next.value });
                toast('Password changed', 'success');
                draw();
              } catch (ex) {
                e.target.disabled = false;
                err.textContent = ex.message;
                err.hidden = false;
              }
            },
          }, 'Change password'),
        ),
      ),
    );
  }

  /* -------------------------------------------------------------- team -- */

  function teamCard() {
    const host_ = h('div', null, h('div', { class: 'skeleton', style: { height: '120px' } }));

    api.users().then(({ users }) => {
      render(host_, h('table', { class: 'table' },
        h('thead', null, h('tr', null,
          h('th', null, 'Person'), h('th', null, 'Role'), h('th', null, 'Daily target'), h('th', null, 'Status'), h('th', null, ''),
        )),
        h('tbody', null, users.map((u) => h('tr', null,
          h('td', null, h('div', { class: 'row tight' },
            avatar(u.name, true),
            h('div', null,
              h('div', { style: { fontWeight: '600' } }, u.name),
              h('div', { class: 'dim', style: { fontSize: '12px' } }, u.email),
            ))),
          h('td', null, u.role === 'admin' ? h('span', { class: 'pill' }, 'Admin') : h('span', { class: 'dim' }, 'Member')),
          h('td', { class: 'dim' }, hm(u.dailyTargetMinutes, { zero: 'none' })),
          h('td', null, u.active
            ? h('span', { class: 'pill badge-success' }, 'Active')
            : h('span', { class: 'pill badge-error' }, 'Deactivated')),
          h('td', { class: 'actions' },
            h('button', { class: 'btn-icon', title: 'Edit person', onclick: () => userEditor(u, teamRefresh) }, icon('pencil')),
          ),
        ))),
      ));
    }).catch(fail);

    const teamRefresh = () => draw();

    return h('div', { class: 'card', style: { padding: '0' } },
      h('div', { class: 'card-head', style: { padding: '20px 20px 16px', marginBottom: '0' } },
        h('h3', null, 'Team'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn-primary btn-sm', onclick: () => userEditor(null, teamRefresh) }, icon('plus'), 'Add person'),
      ),
      h('div', { class: 'table-wrap', style: { border: 'none', borderRadius: '0' } }, host_),
    );
  }

  function userEditor(user, onDone) {
    const editing = !!user;
    const nameInput = h('input', { class: 'input', maxlength: '120', value: user?.name || '' });
    const emailInput = h('input', {
      class: 'input', type: 'email', value: user?.email || '',
      disabled: editing, placeholder: 'name@dgtlgroup.io',
    });
    const roleSel = select([{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }],
      { value: user?.role || 'member' });
    const targetInput = h('input', { class: 'input', value: hm(user?.dailyTargetMinutes ?? 480, { zero: '' }), placeholder: '8h' });
    const passInput = h('input', {
      class: 'input', type: 'text', autocomplete: 'off',
      placeholder: editing ? 'Leave blank to keep the current one' : 'At least 10 characters',
    });
    const activeToggle = h('input', { type: 'checkbox', checked: user ? user.active : true });
    const err = h('div', { class: 'err', hidden: true });

    modal({
      title: editing ? `Edit ${user.name}` : 'Add someone to the team',
      subtitle: editing ? null : 'They sign in with this email and password. Ask them to change it after first login.',
      body: () => [
        h('div', { class: 'row' }, field('Name', nameInput), field('Email', emailInput)),
        h('div', { class: 'row' }, field('Role', roleSel), field('Daily target', targetInput)),
        field(editing ? 'Reset password' : 'Password', passInput,
          editing ? 'Setting a new password signs them out everywhere.' : null),
        editing ? h('label', { class: 'switch' }, activeToggle, h('span', { class: 'track' }), h('span', null, 'Active')) : null,
        err,
      ],
      actions: (close) => [
        h('button', { class: 'btn btn-ghost', onclick: close }, 'Cancel'),
        h('button', {
          class: 'btn btn-primary',
          onclick: async (e) => {
            err.hidden = true;
            const show = (m) => { err.textContent = m; err.hidden = false; };
            if (!nameInput.value.trim()) return show('Give them a name.');
            if (!editing && !emailInput.value.trim()) return show('An email address is required.');
            if (!editing && passInput.value.length < 10) return show('Password must be at least 10 characters.');

            const target = targetInput.value.trim() ? parseDuration(targetInput.value) : 0;
            e.target.disabled = true;
            try {
              // Through the store, not straight at the API: it reloads the
              // workspace, so someone added here is in every assignee and
              // report picker immediately instead of after a page reload.
              if (editing) {
                await saveUser(user.id, {
                  name: nameInput.value.trim(),
                  role: roleSel.value,
                  active: activeToggle.checked,
                  dailyTargetMinutes: target ?? 0,
                  ...(passInput.value ? { password: passInput.value } : {}),
                });
              } else {
                await saveUser(null, {
                  name: nameInput.value.trim(),
                  email: emailInput.value.trim(),
                  role: roleSel.value,
                  password: passInput.value,
                  dailyTargetMinutes: target ?? 480,
                });
              }
              toast(editing ? 'Person updated' : 'Person added', 'success');
              close();
              onDone?.();
            } catch (ex) {
              e.target.disabled = false;
              show(ex.message);
            }
          },
        }, editing ? 'Save changes' : 'Add person'),
      ],
    });
  }

  /* -------------------------------------------------------------- data -- */

  function dataCard() {
    return h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', null, 'Your data')),
      h('p', { class: 'muted', style: { fontSize: '14px', marginBottom: '18px' } },
        isAdmin()
          ? 'Export the whole workspace — projects, tasks, every time entry and the team roster — as JSON.'
          : 'Export your own time entries, plus the projects and tasks they belong to, as JSON.'),
      h('div', { class: 'row' },
        h('a', { class: 'btn btn-secondary', href: api.exportUrl, download: 'dgtl-worklog-export.json' },
          icon('download'), 'Download JSON export'),
        h('button', {
          class: 'btn btn-ghost',
          onclick: async () => {
            if (!await confirmDialog({ title: 'Sign out?', message: 'You will need your password to get back in.', confirmLabel: 'Sign out' })) return;
            await api.logout();
            window.location.href = '/login.html';
          },
        }, icon('logout'), 'Sign out'),
      ),
      h('p', { class: 'hint', style: { marginTop: '16px' } },
        `Dates are recorded in ${state.timezone || 'the server timezone'}, so the whole team agrees on what "today" means.`),
    );
  }

  draw();
}

export { render_ as render };
