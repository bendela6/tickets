# Multi-stage build for the tickets stack — one runtime image:
# nginx (front) + node API + pgweb (self-hosted DB browser), under supervisord.

FROM node:22-alpine AS deps
RUN corepack enable
# node-pty (the AI-session PTY runner) is a native addon. On alpine/musl it may
# have no prebuilt binary and fall back to compiling from source via node-gyp,
# which needs python3 + a C++ toolchain. Installing these lets `pnpm install`
# build it deterministically regardless of prebuild availability.
RUN apk add --no-cache python3 make g++
WORKDIR /app
# manifests first so the install layer caches until dependencies change
# .npmrc carries the tslib public-hoist needed by radix-ui transitives at build time
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mcp/package.json apps/mcp/
COPY apps/signals/package.json apps/signals/
COPY packages/db/package.json packages/db/
COPY packages/richtext/package.json packages/richtext/
COPY packages/web/form/package.json packages/web/form/
COPY packages/web/ui/package.json packages/web/ui/
COPY packages/signals/core/package.json packages/signals/core/
COPY packages/signals/browser/package.json packages/signals/browser/
COPY packages/signals/node/package.json packages/signals/node/
COPY packages/signals/react/package.json packages/signals/react/
RUN pnpm install --frozen-lockfile
COPY . .
# signals SDK packages — built once here so every downstream stage sees real
# dist/ output: web-build needs @bendela6/signals-react resolvable at bundle
# time (apps/web imports it), and the app stage's apps/signals runs from
# source via tsx but its /sdk.js route resolves @bendela6/signals-browser's
# built dist/sdk.js (createRequire) at runtime.
RUN pnpm --filter './packages/signals/*' build

FROM deps AS web-build
RUN pnpm --filter @tickets/web build

FROM deps AS app
RUN apk add --no-cache nginx supervisor
# self-hosted DB browser (static Go binary, baked in → works offline)
COPY --from=sosedoff/pgweb:latest /usr/bin/pgweb /usr/bin/pgweb
# built SPA bundle
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
# infra
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/tickets.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV NODE_ENV=production
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
