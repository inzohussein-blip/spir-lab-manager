# The app on any host that runs containers (Railway, Render, a VPS) — see docs/CONTINUITY.md.
# Data: the embedded database in /data unless DATABASE_URL points to a Postgres.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The public settings are written into the pages, and into the version id: the same values as the
# main site, or this copy counts as another version (deploy/standby-server passes them from its .env).
ARG NEXT_PUBLIC_BASE_URL=""
ARG NEXT_PUBLIC_STATION_SYNC=""
RUN NEXT_TELEMETRY_DISABLED=1 npm run build
ENV NODE_ENV=production PORT=3000 PGLITE_DATA_DIR=/data NEXT_TELEMETRY_DISABLED=1
VOLUME /data
EXPOSE 3000
# Next itself (not npm) gets the stop signal, so `docker stop` ends it cleanly.
CMD ["node", "node_modules/next/dist/bin/next", "start"]
