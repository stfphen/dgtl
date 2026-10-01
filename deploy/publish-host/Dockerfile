# DGTL publish host. Same infra family as deploy/decks and deploy/report-host
# (Docker + Traefik/Coolify).
FROM nginx:alpine

# Multi-host config: one root per publish destination, chosen by $host.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Baked-in apex placeholder, branded 404, robots.txt. Published content is NOT in the
# image — it is volume-mounted read-only from /opt/dgtl-publish/site (see compose).
COPY html/ /usr/share/nginx/html/

EXPOSE 80
