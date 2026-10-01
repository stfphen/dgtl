FROM node:22-alpine AS deps
WORKDIR /app
COPY platform/package.json platform/package-lock.json* ./
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY platform/ .
# The Stage 4 connector imports the ONE shared Worklog HTTP client from the
# monorepo (lib/stage4/worklogConnector.js -> ../../../apps/worklog/client/...,
# which resolves to /apps/worklog/client from /app). The build context is the
# repo root precisely so this file can ship at that exact path — never fork a
# copy into platform/ (see brain/50-Audit-Log/52-Decision-Log.md, 2026-08-14).
COPY apps/worklog/client /apps/worklog/client
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Full dependencies (not just the trimmed standalone set) so the Claude Agent
# SDK can spawn its bundled CLI at runtime for the CLAUDE_CODE_OAUTH_TOKEN
# (subscription) path. Overlays standalone's minimal node_modules with the
# complete install. See docs/CLAUDE_AI_SETUP.md.
COPY --from=deps /app/node_modules ./node_modules
COPY platform/package.json ./
COPY platform/lib ./lib
COPY platform/migrations ./migrations
COPY platform/scripts ./scripts
# Shared Worklog client at the same path the lib/ sources resolve to, so
# non-bundled entry points (scripts/, migrate one-offs) can import it too.
COPY apps/worklog/client /apps/worklog/client

# Run as the non-root `node` user. The Claude Agent SDK's CLI refuses to run in
# bypassPermissions mode as root, which the AI features require. HOME must point
# at a writable dir the CLI can use for its config. See docs/CLAUDE_AI_SETUP.md.
ENV HOME=/home/node
RUN mkdir -p /home/node/.claude && chown -R node:node /home/node
USER node

EXPOSE 3000
CMD ["node", "server.js"]
