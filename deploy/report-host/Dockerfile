# DGTL report host. Same infra family as deploy/decks (Docker + Traefik/Coolify).
FROM nginx:alpine

# Two-host config: dgtl.report -> /data/reports, audit.dgtl.report -> /data/audits.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Baked-in apex placeholder, branded 404, robots.txt. Client content is NOT in the
# image — it's volume-mounted read-only from /opt/dgtl-report/site (see compose).
COPY html/ /usr/share/nginx/html/

EXPOSE 80
