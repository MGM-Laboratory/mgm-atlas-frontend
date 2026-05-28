# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=20.19.0

# ─── Base ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ─── Dependencies ──────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ─── Build ─────────────────────────────────────────────────────────────────
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/public
# Bake-time public env vars (override in CI as build-args if needed).
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_KEYCLOAK_ISSUER
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID
ARG NEXT_PUBLIC_KEYCLOAK_ACCOUNT_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_PMO_ENABLED
ARG NEXT_PUBLIC_YJS_WS_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_KEYCLOAK_ISSUER=$NEXT_PUBLIC_KEYCLOAK_ISSUER
ENV NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID
ENV NEXT_PUBLIC_KEYCLOAK_ACCOUNT_URL=$NEXT_PUBLIC_KEYCLOAK_ACCOUNT_URL
# When NEXT_PUBLIC_SOCKET_URL is unset at build time the runtime falls
# back to NEXT_PUBLIC_API_URL minus the /api/v1 suffix — see
# src/lib/realtime/socket.ts. So the build still works on existing CI
# pipelines without changes.
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
# PMO kill switch (Phase 0+). When unset at build time, usePmoEnabled()
# returns false and the whole PMO UI stays dark. The corresponding
# build-arg lives in the production / staging workflows and is fed by
# the matching GH Actions variable.
ENV NEXT_PUBLIC_PMO_ENABLED=$NEXT_PUBLIC_PMO_ENABLED
ENV NEXT_PUBLIC_YJS_WS_URL=$NEXT_PUBLIC_YJS_WS_URL
# Echo the public env values into the RUN command so BuildKit hashes them
# into the layer cache key. Without this, `cache-from type=gha` happily
# reuses a previous `pnpm build` output even after ARG/ENV values change
# — which is why the PMO_ENABLED rollout didn't take effect despite the
# workflow and Dockerfile both passing the flag correctly. The echo
# output is throwaway; the command *string* carrying the values is what
# busts the cache.
RUN echo "build inputs: app=$NEXT_PUBLIC_APP_URL api=$NEXT_PUBLIC_API_URL kc=$NEXT_PUBLIC_KEYCLOAK_ISSUER pmo=$NEXT_PUBLIC_PMO_ENABLED yjs=$NEXT_PUBLIC_YJS_WS_URL" \
 && pnpm build

# ─── Runtime ───────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime
RUN apk add --no-cache tini libc6-compat
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Copy the Next.js standalone output. The `.next/standalone` includes a tiny
# server.js plus only the dependencies actually needed at runtime.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health > /dev/null || exit 1
