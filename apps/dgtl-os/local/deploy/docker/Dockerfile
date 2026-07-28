FROM node:20-alpine
WORKDIR /app
# build context is the dgtl-os-local folder (see docker-compose.yml)
COPY deploy/docker/package.json ./package.json
RUN npm install --omit=dev
COPY server.mjs dgtl-os-terminal.html ./
# knowledge/ is bind-mounted at runtime (see docker-compose.yml)
ENV HOST=0.0.0.0 PORT=8787 PROVIDER=ollama
EXPOSE 8787
CMD ["node", "server.mjs"]
