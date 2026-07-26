FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
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
COPY package.json ./
COPY lib ./lib
COPY migrations ./migrations
COPY scripts ./scripts

# Run as the non-root `node` user. The Claude Agent SDK's CLI refuses to run in
# bypassPermissions mode as root, which the AI features require. HOME must point
# at a writable dir the CLI can use for its config. See docs/CLAUDE_AI_SETUP.md.
ENV HOME=/home/node
RUN mkdir -p /home/node/.claude && chown -R node:node /home/node
USER node

EXPOSE 3000
CMD ["node", "server.js"]
