# Connect an Agent to Hostinger (MCP Bridge)

Hostinger publishes an MCP server — `hostinger-api-mcp` — that exposes hosting, domains, DNS,
VPS, billing, and related account operations to a compatible agent. Verify the package publisher,
requested permissions, and current tool list before installing it.

## Prerequisites

- **Node.js v24+** — check with `node -v`. If missing or older:
  ```bash
  brew install node
  # or via nvm:
  nvm install v24 && nvm use v24
  ```

## Step 1 — Get your Hostinger API token

1. Log in to **hpanel.hostinger.com**
2. Go to **Account → API** (or search "API" in the hPanel search bar)
3. Click **Create token**, name it (e.g. `claude-mcp`), set an expiry
4. Copy the token immediately — it's shown only once

*Alternative: skip this step entirely and use OAuth — the server opens a browser sign-in on first use if no token is set.*

## Step 2 — Install the MCP server

```bash
npm install -g hostinger-api-mcp
```

Scoped variants are also installed if you want to limit what Claude can touch: `hostinger-dns-mcp` (8 tools), `hostinger-domains-mcp` (18), `hostinger-hosting-mcp` (30), `hostinger-vps-mcp` (62), `hostinger-billing-mcp` (7).

## Step 3 — Add it to your MCP client

For Claude Desktop, open the config file:

```bash
open ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Add (merge into existing `mcpServers` if present):

```json
{
  "mcpServers": {
    "hostinger-api": {
      "command": "hostinger-api-mcp",
      "env": {
        "HOSTINGER_API_TOKEN": "YOUR_API_TOKEN_HERE"
      }
    }
  }
}
```

Using OAuth instead of a token? Omit the `env` block — a browser sign-in window opens on the first tool call. Or pre-authorize with:

```bash
hostinger-api-mcp --login
```

For Codex or another MCP client, use that client's connector configuration instead of copying the
Claude Desktop path verbatim.

## Step 4 — Restart the client

Fully quit and reopen the client. The Hostinger tools should appear in its connectors/tools menu.

## Step 5 — Test it

Ask the agent something read-only, such as: *"List my Hostinger domains"* or *"Show my VPS
instances."* Do not begin with a deployment, DNS edit, or deletion.

## Notes

- **Keep the token out of git** — it's account-wide access. Treat it like a password.
- Update later with `npm update -g hostinger-api-mcp`.
- OAuth credentials are stored at `~/.config/hostinger-mcp/credentials.json`; revoke with `hostinger-api-mcp --logout`.
- Claude Code users: `claude mcp add hostinger-api -e HOSTINGER_API_TOKEN=YOUR_TOKEN -- hostinger-api-mcp`
