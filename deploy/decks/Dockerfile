# DGTL pitch-deck static host. Same infra family as the app (Docker + Traefik).
FROM nginx:alpine

# Custom server config: clean URLs, per-deck index, branded 404, asset caching.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Web root. A URL /pitch/{client}/ maps to site/pitch/{client}/index.html.
COPY site/ /usr/share/nginx/html/

EXPOSE 80
