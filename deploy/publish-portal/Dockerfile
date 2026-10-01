# DGTL publish portal. Same infra family as deploy/decks and deploy/report-host
# (Docker + Traefik/Coolify). Zero npm dependencies — Node stdlib only.
FROM node:20-alpine
WORKDIR /app

# server.js is the whole app; brand.js holds the inlined DGTL marks; targets.json is
# the destination registry. Mount your own targets.json (or set TARGETS_FILE) to
# change destinations without rebuilding the image.
COPY server.js brand.js targets.json ./

ENV PORT=80
EXPOSE 80
CMD ["node", "server.js"]
