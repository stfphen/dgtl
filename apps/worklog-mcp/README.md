# DGTL Worklog — MCP connector

Exposes the [DGTL Worklog](../worklog) API at `office.dgtl.at` as MCP tools, so projects,
tasks, assignments and hours can be driven from a Claude session instead of the web UI.

Zero runtime dependencies — the MCP stdio transport is newline-delimited JSON-RPC and Node 22
has everything else built in. There is nothing to `npm install`.

## Setup

```bash
cd apps/worklog-mcp
cp .env.example .env      # then fill in WORKLOG_PASSWORD
chmod 600 .env
npm run selftest
```

`selftest` signs in, prints the account's name and role, and tells you what the account is and
is not allowed to do. If it fails, nothing else will work — fix it before wiring the connector up.

Register it with Cowork / Claude Desktop:

```json
{
  "mcpServers": {
    "dgtl-worklog": {
      "command": "node",
      "args": ["/Users/stephenprokopich/dgtl/apps/worklog-mcp/server.js"]
    }
  }
}
```

## Tools

| Tool | Notes |
|---|---|
| `worklog_context` | Orientation: who we are, the timezone, every user/project/open task with ids. Call first. |
| `worklog_list_tasks` | Filter by project, assignee, status, overdue. |
| `worklog_create_task` | Title required. **Omitting assignee leaves the task unassigned.** |
| `worklog_create_tasks_bulk` | Up to 50, serialised. Reports per-item failures instead of aborting. |
| `worklog_update_task` | Reassign, restatus, reprioritise, set/clear due date, archive. |
| `worklog_list_projects` | Includes logged time and budget-used percentage. |
| `worklog_create_project` | **Admin only.** |
| `worklog_log_time` | Minutes or hours. Logging for another user is **admin only**. |
| `worklog_list_entries` | Date range, per person or team, with billable split. |
| `worklog_report` | Totals, per-day/project/person breakdowns, task counts, 90-day heatmap. |

IDs may be given as names — `project: "Growth Platform"`, `assignee: "marta@dgtl.at"`. Names
resolve against a 30-second snapshot of `/api/bootstrap`; an ambiguous name is refused with the
candidate list rather than guessed at.

## Permissions

Worklog's model is small and this connector inherits it exactly:

- **member** — create/edit/assign tasks, log its own time, read team reports.
- **admin** — additionally create projects, manage users, and log time for other people.

A 403 is reported back with an explanation rather than a bare status code.

## Design notes

Three things here are deliberate and worth not "fixing" later:

1. **Unassigned by default.** `POST /api/tasks` assigns to the caller when `assigneeId` is
   omitted. Correct for a human in the web app, wrong for a bot — it would quietly pile the
   team's backlog onto `claude@dgtl.at`. This client always sends an explicit value.
2. **Requests are serialised with a 120 ms floor.** Worklog runs under Passenger on Hostinger
   shared hosting, which caps concurrent connections. A 50-task bulk import must not stampede it.
3. **Login is attempted once per 401, never in a loop.** `throttleLogin()` allows 10 attempts per
   ip+email per 15 minutes and then returns 429. A retry loop would lock the bot out of its own
   account for a quarter of an hour.

## Testing against a local Worklog

The connector was verified against a real instance rather than a mock — run one from the sibling
checkout and point the connector at it:

```bash
cd ../worklog
printf 'HOST=127.0.0.1\nPORT=8123\nDB_PATH=data/test.sqlite\n' > .env
node scripts/seed.mjs --email admin@dgtlgroup.io --password 'localtest-admin-pw'
node server/server.mjs &

cd ../worklog-mcp
WORKLOG_BASE_URL=http://127.0.0.1:8123 \
WORKLOG_EMAIL=admin@dgtlgroup.io WORKLOG_PASSWORD='localtest-admin-pw' \
  node server.js --selftest
```

Do exploratory work there, not against production — `office.dgtl.at` holds hours people are
paid from.
