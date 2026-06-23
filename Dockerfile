# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app/web

# Native dependencies for better-sqlite3/sharp and build-time tooling.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY web/package*.json ./
# Install scripts are disabled because an unused transitive sharp install can
# fail on libvips downloads in constrained environments. Rebuild only the
# native server dependency the app actually needs at runtime.
RUN npm ci --ignore-scripts \
  && npm rebuild better-sqlite3

COPY web/ ./
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts

FROM node:22-bookworm-slim AS runtime
WORKDIR /app/web
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5173 \
    MARKDOWN_NOTES_DATA_DIR=/data

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data \
  && chown -R node:node /data /app

COPY --from=build --chown=node:node /app/web/build ./build
COPY --from=build --chown=node:node /app/web/node_modules ./node_modules
COPY --from=build --chown=node:node /app/web/package.json ./package.json

USER node
EXPOSE 5173
VOLUME ["/data"]
CMD ["node", "build"]
