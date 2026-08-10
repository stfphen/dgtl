/**
 * Tool definitions for the DGTL Worklog MCP server.
 *
 * Every tool maps onto a route in `apps/worklog/server/api.mjs`. The validation
 * rules below mirror that file exactly — max lengths, enum values, minute
 * bounds — so a bad argument fails here with a useful message instead of
 * costing a round trip to a shared host.
 *
 * Two behaviours are deliberately NOT inherited from the API:
 *
 *   • `POST /api/tasks` silently assigns to the *caller* when assigneeId is
 *     omitted. For a bot account that is always wrong — it would quietly pile
 *     the team's work onto claude@dgtl.at. Here, omitting an assignee leaves
 *     the task unassigned, and you assign on purpose or not at all.
 *   • IDs may be given as names. Worklog speaks integer ids; people speak
 *     "PolishStone" and "Marta". Every id argument accepts either and resolves
 *     against a short-lived snapshot, refusing ambiguous matches rather than
 *     picking one.
 */

import { qs } from './client.js';

// ------------------------------------------------------------------ snapshot

const SNAPSHOT_TTL_MS = 30_000;
let snapshot = null;
let snapshotAt = 0;

/** `/api/bootstrap` in one call: user, users, projects, tasks, today, timezone. */
async function getSnapshot(client, { fresh = false } = {}) {
  if (fresh || !snapshot || Date.now() - snapshotAt > SNAPSHOT_TTL_MS) {
    snapshot = await client.get('/api/bootstrap');
    snapshotAt = Date.now();
  }
  return snapshot;
}

/** Any write invalidates the cache — stale ids are worse than an extra call. */
const invalidate = () => { snapshot = null; };

// ---------------------------------------------------------------- resolution

class ToolError extends Error {}

const isId = (v) => Number.isInteger(v) || /^\d+$/.test(String(v ?? ''));

function resolveOne(ref, rows, { label, fields }) {
  if (ref === undefined || ref === null || ref === '') return null;
  if (isId(ref)) {
    const id = Number(ref);
    const hit = rows.find((r) => r.id === id);
    if (!hit) throw new ToolError(`No ${label} with id ${id}.`);
    return hit.id;
  }

  const needle = String(ref).trim().toLowerCase();
  const values = (r) => fields.map((f) => String(r[f] ?? '').toLowerCase()).filter(Boolean);

  const exact = rows.filter((r) => values(r).includes(needle));
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) {
    throw new ToolError(
      `"${ref}" matches ${exact.length} ${label}s exactly (ids ${exact.map((r) => r.id).join(', ')}). Pass the id.`,
    );
  }

  const partial = rows.filter((r) => values(r).some((v) => v.includes(needle)));
  if (partial.length === 1) return partial[0].id;
  if (partial.length > 1) {
    const names = partial.slice(0, 8).map((r) => `${r.id}: ${r[fields[0]]}`).join(', ');
    throw new ToolError(`"${ref}" is ambiguous — ${partial.length} ${label}s match (${names}). Pass the id.`);
  }
  throw new ToolError(`No ${label} matches "${ref}".`);
}

const resolveProject = (ref, snap) =>
  resolveOne(ref, snap.projects, { label: 'project', fields: ['name', 'code', 'client'] });

const resolveUser = (ref, snap) =>
  resolveOne(ref, snap.users, { label: 'user', fields: ['name', 'email'] });

const resolveTask = (ref, snap) =>
  resolveOne(ref, snap.tasks, { label: 'task', fields: ['title'] });

// ---------------------------------------------------------------- validation

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asDate(v, snap, { name }) {
  if (v === undefined || v === null || v === '') return undefined;
  const s = String(v).trim().toLowerCase();
  if (s === 'today') return snap.today;
  if (s === 'tomorrow') return shiftDate(snap.today, 1);
  if (s === 'yesterday') return shiftDate(snap.today, -1);
  if (!DATE_RE.test(s)) throw new ToolError(`${name} must be YYYY-MM-DD (or today/tomorrow/yesterday), got "${v}".`);
  return s;
}

function shiftDate(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function asEnum(v, allowed, { name }) {
  if (v === undefined || v === null || v === '') return undefined;
  const s = String(v).toLowerCase();
  if (!allowed.includes(s)) throw new ToolError(`${name} must be one of: ${allowed.join(', ')}.`);
  return s;
}

function asText(v, { name, max }) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  if (s.length > max) throw new ToolError(`${name} must be ${max} characters or fewer (got ${s.length}).`);
  return s;
}

/** Minutes from either `minutes` or a friendlier `hours`. */
function asMinutes(args, { required = false } = {}) {
  let m;
  if (args.minutes !== undefined && args.minutes !== null) m = Number(args.minutes);
  else if (args.hours !== undefined && args.hours !== null) m = Math.round(Number(args.hours) * 60);
  else {
    if (required) throw new ToolError('Give either minutes or hours.');
    return undefined;
  }
  if (!Number.isFinite(m)) throw new ToolError('Duration must be a number.');
  m = Math.round(m);
  if (m < 1 || m > 1440) throw new ToolError(`Duration must be between 1 and 1440 minutes (got ${m}).`);
  return m;
}

const hhmm = (mins) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;

// --------------------------------------------------------------------- tools

const TOOLS = [
  {
    name: 'worklog_context',
    description:
      'Orientation call. Returns who the connector is signed in as, its role, the timezone and '
      + "today's date, plus every active user, project and open task with their ids. Call this "
      + 'first in a session — it is what makes name-based arguments resolvable.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run(client) {
      const snap = await getSnapshot(client, { fresh: true });
      const open = snap.tasks.filter((t) => t.status !== 'done' && !t.archived);
      return {
        signedInAs: { ...snap.user, isAdmin: snap.user.role === 'admin' },
        today: snap.today,
        timezone: snap.timezone,
        weekStartDate: snap.weekStartDate,
        canCreateProjects: snap.user.role === 'admin',
        canLogTimeForOthers: snap.user.role === 'admin',
        users: snap.users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
        projects: snap.projects.map((p) => ({
          id: p.id, name: p.name, client: p.client, code: p.code,
          billable: p.billable, status: p.status, openTasks: p.openTasks,
        })),
        openTaskCount: open.length,
        openTasks: open.slice(0, 50).map((t) => ({
          id: t.id, title: t.title, projectId: t.projectId,
          assigneeId: t.assigneeId, status: t.status, priority: t.priority, dueDate: t.dueDate,
        })),
      };
    },
  },

  {
    name: 'worklog_list_tasks',
    description:
      'List tasks, optionally filtered by project, assignee, status or overdue. '
      + 'Returns logged minutes against each task.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project id, name or code.' },
        assignee: { type: 'string', description: 'User id, name or email. Use "unassigned" for tasks with no owner.' },
        status: { type: 'string', enum: ['todo', 'doing', 'done'] },
        overdueOnly: { type: 'boolean', description: 'Only tasks past their due date and not done.' },
        includeArchived: { type: 'boolean', default: false },
      },
      additionalProperties: false,
    },
    async run(client, args) {
      const snap = await getSnapshot(client);
      const { tasks } = await client.get(`/api/tasks${qs({ archived: args.includeArchived ? 1 : undefined })}`);

      const projectId = args.project ? resolveProject(args.project, snap) : undefined;
      const unassigned = String(args.assignee ?? '').toLowerCase() === 'unassigned';
      const assigneeId = args.assignee && !unassigned ? resolveUser(args.assignee, snap) : undefined;
      const status = asEnum(args.status, ['todo', 'doing', 'done'], { name: 'status' });

      const names = new Map(snap.projects.map((p) => [p.id, p.name]));
      const people = new Map(snap.users.map((u) => [u.id, u.name]));

      const filtered = tasks.filter((t) => {
        if (projectId !== undefined && t.projectId !== projectId) return false;
        if (unassigned && t.assigneeId !== null) return false;
        if (assigneeId !== undefined && t.assigneeId !== assigneeId) return false;
        if (status && t.status !== status) return false;
        if (args.overdueOnly && !(t.dueDate && t.dueDate < snap.today && t.status !== 'done')) return false;
        return true;
      });

      return {
        count: filtered.length,
        tasks: filtered.map((t) => ({
          ...t,
          projectName: names.get(t.projectId) ?? null,
          assigneeName: people.get(t.assigneeId) ?? null,
          loggedFormatted: hhmm(t.loggedMinutes),
          overdue: !!(t.dueDate && t.dueDate < snap.today && t.status !== 'done'),
        })),
      };
    },
  },

  {
    name: 'worklog_create_task',
    description:
      'Create a task. If you omit assignee the task is left UNASSIGNED (this differs from the '
      + 'web app, which would assign it to the signed-in account). Title is required.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Required. Max 200 characters.' },
        project: { type: 'string', description: 'Project id, name or code.' },
        assignee: { type: 'string', description: 'User id, name or email. Omit to leave unassigned.' },
        notes: { type: 'string', description: 'Max 4000 characters.' },
        status: { type: 'string', enum: ['todo', 'doing', 'done'], default: 'todo' },
        priority: { type: 'string', enum: ['low', 'normal', 'high'], default: 'normal' },
        estimateMinutes: { type: 'integer', minimum: 0 },
        dueDate: { type: 'string', description: 'YYYY-MM-DD, or today/tomorrow.' },
      },
      required: ['title'],
      additionalProperties: false,
    },
    async run(client, args) {
      const snap = await getSnapshot(client);
      const title = asText(args.title, { name: 'title', max: 200 });
      if (!title) throw new ToolError('title is required.');

      const body = {
        title,
        projectId: args.project ? resolveProject(args.project, snap) : null,
        // Explicit null, not undefined — undefined would make the API assign to the bot.
        assigneeId: args.assignee ? resolveUser(args.assignee, snap) : null,
        notes: asText(args.notes, { name: 'notes', max: 4000 }) ?? '',
        status: asEnum(args.status, ['todo', 'doing', 'done'], { name: 'status' }) ?? 'todo',
        priority: asEnum(args.priority, ['low', 'normal', 'high'], { name: 'priority' }) ?? 'normal',
        estimateMinutes: args.estimateMinutes ?? null,
        dueDate: asDate(args.dueDate, snap, { name: 'dueDate' }) ?? null,
      };

      const { task } = await client.post('/api/tasks', body);
      invalidate();
      return { created: task, url: `${client.baseUrl}/#tasks` };
    },
  },

  {
    name: 'worklog_create_tasks_bulk',
    description:
      'Create several tasks in one go. Each item takes the same fields as worklog_create_task. '
      + 'Requests are serialised and rate-limited. Reports per-item success or failure rather '
      + 'than aborting the batch on the first error.',
    inputSchema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          minItems: 1,
          maxItems: 50,
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              project: { type: 'string' },
              assignee: { type: 'string' },
              notes: { type: 'string' },
              status: { type: 'string', enum: ['todo', 'doing', 'done'] },
              priority: { type: 'string', enum: ['low', 'normal', 'high'] },
              estimateMinutes: { type: 'integer' },
              dueDate: { type: 'string' },
            },
            required: ['title'],
          },
        },
        defaultProject: { type: 'string', description: 'Applied to any item without its own project.' },
        defaultAssignee: { type: 'string', description: 'Applied to any item without its own assignee.' },
      },
      required: ['tasks'],
      additionalProperties: false,
    },
    async run(client, args) {
      const create = TOOLS.find((t) => t.name === 'worklog_create_task');
      const created = [];
      const failed = [];

      for (const item of args.tasks) {
        const merged = {
          ...item,
          project: item.project ?? args.defaultProject,
          assignee: item.assignee ?? args.defaultAssignee,
        };
        try {
          const { created: task } = await create.run(client, merged);
          created.push({ id: task.id, title: task.title });
        } catch (err) {
          failed.push({ title: item.title, error: err.message });
        }
      }

      invalidate();
      return {
        summary: `${created.length} created, ${failed.length} failed`,
        created,
        failed,
      };
    },
  },

  {
    name: 'worklog_update_task',
    description:
      'Update a task — reassign it, change status or priority, set a due date, or archive it. '
      + 'Only the fields you pass are changed. Setting status to done stamps the completion time '
      + 'that weekly reports count from.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task id or title.' },
        title: { type: 'string' },
        project: { type: 'string' },
        assignee: { type: 'string', description: 'User id, name or email. Pass "unassigned" to clear.' },
        notes: { type: 'string' },
        status: { type: 'string', enum: ['todo', 'doing', 'done'] },
        priority: { type: 'string', enum: ['low', 'normal', 'high'] },
        estimateMinutes: { type: 'integer' },
        dueDate: { type: 'string', description: 'YYYY-MM-DD, or "none" to clear.' },
        archived: { type: 'boolean' },
      },
      required: ['task'],
      additionalProperties: false,
    },
    async run(client, args) {
      const snap = await getSnapshot(client);
      const id = resolveTask(args.task, snap);
      const body = {};

      if (args.title !== undefined) body.title = asText(args.title, { name: 'title', max: 200 });
      if (args.project !== undefined) body.projectId = args.project ? resolveProject(args.project, snap) : null;
      if (args.assignee !== undefined) {
        body.assigneeId = String(args.assignee).toLowerCase() === 'unassigned'
          ? null
          : resolveUser(args.assignee, snap);
      }
      if (args.notes !== undefined) body.notes = asText(args.notes, { name: 'notes', max: 4000 });
      if (args.status !== undefined) body.status = asEnum(args.status, ['todo', 'doing', 'done'], { name: 'status' });
      if (args.priority !== undefined) body.priority = asEnum(args.priority, ['low', 'normal', 'high'], { name: 'priority' });
      if (args.estimateMinutes !== undefined) body.estimateMinutes = args.estimateMinutes;
      if (args.dueDate !== undefined) {
        body.dueDate = String(args.dueDate).toLowerCase() === 'none'
          ? null
          : asDate(args.dueDate, snap, { name: 'dueDate' });
      }
      if (args.archived !== undefined) body.archived = args.archived;

      if (!Object.keys(body).length) throw new ToolError('Nothing to update — pass at least one field.');

      const { task } = await client.patch(`/api/tasks/${id}`, body);
      invalidate();
      return { updated: task };
    },
  },

  {
    name: 'worklog_list_projects',
    description: 'List projects with logged time, open task counts, billable flag and budget.',
    inputSchema: {
      type: 'object',
      properties: {
        includeArchived: { type: 'boolean', default: false },
      },
      additionalProperties: false,
    },
    async run(client, args) {
      const { projects } = await client.get('/api/projects');
      const rows = args.includeArchived ? projects : projects.filter((p) => p.status === 'active');
      return {
        count: rows.length,
        projects: rows.map((p) => ({
          ...p,
          loggedFormatted: hhmm(p.loggedMinutes),
          budgetUsedPct: p.budgetMinutes
            ? Math.round((p.loggedMinutes / p.budgetMinutes) * 100)
            : null,
        })),
      };
    },
  },

  {
    name: 'worklog_create_project',
    description:
      'Create a project. ADMIN ONLY — the connector account must have the admin role or this '
      + 'returns 403. Colour defaults to DGTL gold.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Required. Max 120 characters.' },
        client: { type: 'string', description: 'Client name. Max 120 characters.' },
        code: { type: 'string', description: 'Short tag for dense views. Max 16 characters, upper-cased.' },
        color: { type: 'string', description: '#rrggbb. Defaults to #F0CF50.' },
        billable: { type: 'boolean', default: true },
        budgetMinutes: { type: 'integer', minimum: 0 },
      },
      required: ['name'],
      additionalProperties: false,
    },
    async run(client, args) {
      const name = asText(args.name, { name: 'name', max: 120 });
      if (!name) throw new ToolError('name is required.');
      const color = args.color ? String(args.color).trim() : undefined;
      if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
        throw new ToolError('color must be a #rrggbb hex value.');
      }

      const { project } = await client.post('/api/projects', {
        name,
        client: asText(args.client, { name: 'client', max: 120 }) ?? '',
        code: asText(args.code, { name: 'code', max: 16 }) ?? '',
        color,
        billable: args.billable ?? true,
        budgetMinutes: args.budgetMinutes ?? null,
      });
      invalidate();
      return { created: project };
    },
  },

  {
    name: 'worklog_log_time',
    description:
      'Log a time entry. Defaults to the connector account and today. Logging time for ANOTHER '
      + 'user requires the admin role. Duration accepts minutes or hours.',
    inputSchema: {
      type: 'object',
      properties: {
        minutes: { type: 'integer', minimum: 1, maximum: 1440 },
        hours: { type: 'number', description: 'Alternative to minutes, e.g. 1.5.' },
        project: { type: 'string', description: 'Project id, name or code.' },
        task: { type: 'string', description: 'Task id or title.' },
        user: { type: 'string', description: 'Whose time this is. Admin only for anyone but the connector account.' },
        date: { type: 'string', description: 'YYYY-MM-DD, or today/yesterday. Defaults to today.' },
        note: { type: 'string', description: 'Max 500 characters.' },
        billable: { type: 'boolean', default: true },
      },
      additionalProperties: false,
    },
    async run(client, args) {
      const snap = await getSnapshot(client);
      const minutes = asMinutes(args, { required: true });

      const { entry } = await client.post('/api/entries', {
        minutes,
        projectId: args.project ? resolveProject(args.project, snap) : null,
        taskId: args.task ? resolveTask(args.task, snap) : null,
        userId: args.user ? resolveUser(args.user, snap) : undefined,
        date: asDate(args.date, snap, { name: 'date' }) ?? snap.today,
        note: asText(args.note, { name: 'note', max: 500 }) ?? '',
        billable: args.billable ?? true,
      });
      invalidate();
      return { logged: { ...entry, formatted: hhmm(entry.minutes) } };
    },
  },

  {
    name: 'worklog_list_entries',
    description: 'List time entries over a date range, for one person or the whole team.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'YYYY-MM-DD. Defaults to 30 days before `to`.' },
        to: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
        user: { type: 'string', description: 'User id, name or email.' },
        scope: { type: 'string', enum: ['me', 'team'], default: 'me' },
      },
      additionalProperties: false,
    },
    async run(client, args) {
      const snap = await getSnapshot(client);
      const scope = asEnum(args.scope, ['me', 'team'], { name: 'scope' }) ?? 'me';
      const userId = args.user ? resolveUser(args.user, snap) : undefined;

      const data = await client.get(`/api/entries${qs({
        from: asDate(args.from, snap, { name: 'from' }),
        to: asDate(args.to, snap, { name: 'to' }),
        scope: userId ? 'me' : scope,
        userId,
      })}`);

      const total = data.entries.reduce((n, e) => n + e.minutes, 0);
      const billable = data.entries.reduce((n, e) => n + (e.billable ? e.minutes : 0), 0);
      return {
        range: data.range,
        count: data.entries.length,
        totals: {
          minutes: total,
          formatted: hhmm(total),
          billableMinutes: billable,
          billableFormatted: hhmm(billable),
          billablePct: total ? Math.round((billable / total) * 100) : 0,
        },
        entries: data.entries,
      };
    },
  },

  {
    name: 'worklog_report',
    description:
      'Aggregated report for a date range — totals, billable split, per-day, per-project and '
      + 'per-person breakdowns, task counts, and a 90-day heatmap. Use scope "team" for everyone.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'YYYY-MM-DD. Defaults to 6 days before `to`.' },
        to: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
        user: { type: 'string', description: 'Scope to one person by id, name or email.' },
        scope: { type: 'string', enum: ['me', 'team'], default: 'me' },
      },
      additionalProperties: false,
    },
    async run(client, args) {
      const snap = await getSnapshot(client);
      const userId = args.user ? resolveUser(args.user, snap) : undefined;
      const scope = asEnum(args.scope, ['me', 'team'], { name: 'scope' }) ?? 'me';

      const report = await client.get(`/api/report${qs({
        from: asDate(args.from, snap, { name: 'from' }),
        to: asDate(args.to, snap, { name: 'to' }),
        scope: userId ? 'me' : scope,
        userId,
      })}`);

      return {
        ...report,
        totals: {
          ...report.totals,
          formatted: hhmm(report.totals.minutes),
          billableFormatted: hhmm(report.totals.billableMinutes),
          billablePct: report.totals.minutes
            ? Math.round((report.totals.billableMinutes / report.totals.minutes) * 100)
            : 0,
        },
      };
    },
  },
];

export { TOOLS, ToolError };
