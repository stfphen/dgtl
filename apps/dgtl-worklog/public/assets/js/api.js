/* DGTL Worklog — API client. Thin wrapper over fetch with one error shape. */

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server — is it still running?');
  }

  // The session expired underneath us; get back to a clean login.
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    window.location.href = '/login.html';
    throw new ApiError(401, 'Signed out');
  }

  const payload = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, payload?.error || `Request failed (${res.status})`);
  return payload;
}

const qs = (params = {}) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const api = {
  login: (email, password) => call('POST', '/api/auth/login', { email, password }),
  logout: () => call('POST', '/api/auth/logout'),

  bootstrap: () => call('GET', '/api/bootstrap'),
  updateMe: (patch) => call('PATCH', '/api/me', patch),

  projects: () => call('GET', '/api/projects'),
  createProject: (data) => call('POST', '/api/projects', data),
  updateProject: (id, patch) => call('PATCH', `/api/projects/${id}`, patch),
  deleteProject: (id) => call('DELETE', `/api/projects/${id}`),

  tasks: (params) => call('GET', `/api/tasks${qs(params)}`),
  createTask: (data) => call('POST', '/api/tasks', data),
  updateTask: (id, patch) => call('PATCH', `/api/tasks/${id}`, patch),
  deleteTask: (id) => call('DELETE', `/api/tasks/${id}`),
  reorderTasks: (ids) => call('POST', '/api/tasks/reorder', { ids }),

  entries: (params) => call('GET', `/api/entries${qs(params)}`),
  createEntry: (data) => call('POST', '/api/entries', data),
  updateEntry: (id, patch) => call('PATCH', `/api/entries/${id}`, patch),
  deleteEntry: (id) => call('DELETE', `/api/entries/${id}`),

  timer: () => call('GET', '/api/timer'),
  startTimer: (data) => call('POST', '/api/timer/start', data),
  updateTimer: (patch) => call('PATCH', '/api/timer', patch),
  stopTimer: () => call('POST', '/api/timer/stop'),
  discardTimer: () => call('POST', '/api/timer/discard'),

  clockIn: (data) => call('POST', '/api/shift/in', data),
  clockOut: () => call('POST', '/api/shift/out'),
  updateShift: (id, patch) => call('PATCH', `/api/shift/${id}`, patch),
  deleteShift: (id) => call('DELETE', `/api/shift/${id}`),

  suggestions: () => call('GET', '/api/suggestions'),

  report: (params) => call('GET', `/api/report${qs(params)}`),

  users: () => call('GET', '/api/users'),
  createUser: (data) => call('POST', '/api/users', data),
  updateUser: (id, patch) => call('PATCH', `/api/users/${id}`, patch),

  exportUrl: '/api/export',
};
