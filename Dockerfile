# The app on any host that runs containers (Railway, Render, a VPS) — see docs/CONTINUITY.md.
# Data: the embedded database in /data unless DATABASE_URL points to a Postgres.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN NEXT_TELEMETRY_DISABLED=1 npm run build
ENV NODE_ENV=production PORT=3000 PGLITE_DATA_DIR=/data NEXT_TELEMETRY_DISABLED=1
VOLUME /data
EXPOSE 3000
CMD ["npm", "start"]
