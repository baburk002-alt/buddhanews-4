# syntax=docker/dockerfile:1.7
#
# Multi-stage build. The runtime image contains only production dependencies,
# the compiled server, the built client and the SQL migrations — no source, no
# dev tooling, no package manager cache and no secrets.

ARG NODE_VERSION=22-bookworm-slim

# ---------------------------------------------------------------------------
# 1. Base with pnpm
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# 2. Full dependency install (build needs TypeScript, Vite, Tailwind, esbuild)
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# 3. Build the client and bundle the server
# ---------------------------------------------------------------------------
FROM deps AS build
COPY . .
ENV NODE_ENV=production
RUN pnpm build

# ---------------------------------------------------------------------------
# 4. Production-only dependencies
# ---------------------------------------------------------------------------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# ---------------------------------------------------------------------------
# 5. Runtime
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

# A fixed, unprivileged uid/gid keeps volume permissions predictable.
RUN groupadd --gid 10001 app \
 && useradd --uid 10001 --gid app --shell /usr/sbin/nologin --no-create-home app

COPY --from=prod-deps --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/dist ./dist
COPY --from=build --chown=root:root /app/drizzle ./drizzle
COPY --chown=root:root package.json ./
COPY --chown=root:root docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod 0555 /app/docker-entrypoint.sh \
 && mkdir -p /app/uploads \
 && chown -R app:app /app/uploads

USER 10001:10001

EXPOSE 3000

# The app exposes /api/health with a real database check. Node is already in the
# image, so the probe needs no extra package.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
