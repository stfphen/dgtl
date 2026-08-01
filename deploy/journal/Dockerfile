# DGTL Influence Journal static host — nginx behind the VPS Traefik (Coolify's proxy).
# Same infra family as deploy/decks/, but the Journal serves at the DOMAIN ROOT.
#
# IMPORTANT: the build context is the REPO ROOT, not this folder — the content lives at
# journal/ and Docker cannot COPY from outside its context. docker-compose.yml sets:
#     build: { context: ../.., dockerfile: deploy/journal/Dockerfile }
# If you build by hand, do it from the repo root:
#     docker build -f deploy/journal/Dockerfile -t dgtl-journal .
FROM nginx:alpine

COPY deploy/journal/nginx.conf /etc/nginx/conf.d/default.conf

# Web root is the journal itself: dgtlinfluence.com/packs/casper/ -> journal/packs/casper/index.html
COPY journal/ /usr/share/nginx/html/

# Branded 404. Lives here rather than in journal/ because it is a deploy artifact —
# journal/ is also checked by tools/check-links.py and browsed locally as plain files.
COPY deploy/journal/404.html /usr/share/nginx/html/404.html

EXPOSE 80
