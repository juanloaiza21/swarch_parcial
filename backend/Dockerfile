# ---- Backend image: Express REST API + SQLite ----
FROM node:22-bookworm-slim AS base

WORKDIR /app

# better-sqlite3 ships prebuilt binaries for most platforms; build tools are a
# safe fallback in case a native compile is needed.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/marketplace.db

# SQLite file lives on a mountable volume so data survives container restarts.
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
