# Installing the Worklog connector on a second Mac

For a teammate who wants to drive Worklog from their own Claude desktop app. Takes about
five minutes. Each person signs in as **themselves**, so tasks they create and hours they
log are attributed to them and per-person reports stay meaningful.

## 1. Check Node

```bash
node -v
```

Needs **v22 or newer**. If it's missing or older, install from [nodejs.org](https://nodejs.org)
(the LTS installer is fine) and reopen Terminal.

## 2. Get the files

If the repo is available to you:

```bash
git clone https://github.com/stfphen/dgtl.git ~/dgtl
cd ~/dgtl/apps/worklog-mcp
```

Otherwise have the folder `apps/worklog-mcp/` sent over — AirDrop, zip, whatever — and put it
at `~/dgtl/apps/worklog-mcp`. It's four small files and no dependencies; there is nothing to
install or build.

**Do not copy anyone else's `.env`.** You make your own in the next step.

## 3. Create your `.env`

```bash
cd ~/dgtl/apps/worklog-mcp
cp .env.example .env
nano .env
```

Set it to **your own** Worklog login:

```
WORKLOG_BASE_URL=https://office.dgtl.at
WORKLOG_EMAIL=you@yourdomain.com
WORKLOG_PASSWORD=your-worklog-password
```

`Ctrl+O`, `Enter`, `Ctrl+X` to save. Then lock the file down — it holds a real password:

```bash
chmod 600 .env
```

`.env` is gitignored repo-wide, so it can't be committed by accident.

## 4. Test it

```bash
npm run selftest
```

You want to see your own name and role:

```
[worklog-mcp] OK — signed in as Your Name <you@…>, role "admin"
[worklog-mcp]    5 users, 8 projects, 55 open tasks
```

If it fails here, stop and fix it — nothing downstream will work. `HTTP 401` means the email or
password is wrong. A 429 means Worklog is throttling sign-ins; wait fifteen minutes.

## 5. Register it with Claude

This writes the config for you, using the absolute path to your Node install. That last part
matters: GUI apps don't inherit your shell's `PATH`, so a plain `"node"` fails silently if Node
came from nvm or Homebrew.

```bash
CFG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
[ -f "$CFG" ] && cp "$CFG" "$CFG.bak"
python3 - "$CFG" "$(which node)" "$HOME/dgtl/apps/worklog-mcp/server.js" <<'PY'
import json, os, sys
cfg, node, script = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(cfg)) if os.path.exists(cfg) else {}
d.setdefault("mcpServers", {})["dgtl-worklog"] = {"command": node, "args": [script]}
os.makedirs(os.path.dirname(cfg), exist_ok=True)
json.dump(d, open(cfg, "w"), indent=2)
print("registered with node:", node)
PY
```

## 6. Restart Claude

**⌘Q to quit fully** — closing the window isn't enough, the config is only read at launch.
Reopen, then ask:

> what's open in Worklog?

If you get the project list back, you're done.

## Troubleshooting

| Symptom | Cause |
|---|---|
| No Worklog tools after restart | Config didn't parse, or Claude wasn't fully quit. Run `python3 -m json.tool "$CFG"`. |
| Tools appear but every call errors | `.env` problem. Run `npm run selftest` to see the real error. |
| Worked, then stopped after a Node upgrade | The pinned node path is gone. Re-run step 5. |
| "Admins only" on some tools | Your Worklog account is a member. Creating projects and logging others' time are admin-only. |

## What it can do

Ten tools: read context, list and filter tasks, create tasks (singly or in bulk), update and
reassign them, list and create projects, log time, list entries, and pull reports.

Names work in place of ids — `project: "TPB · A"`, `assignee: "Anastasiia"`. An ambiguous name is
refused with the candidates rather than guessed.

**One thing to know:** creating a task without naming an assignee leaves it **unassigned**. That
is deliberate and differs from the web app, which would quietly assign it to you.
