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
# Baked into the bundle so every signal the browser reports carries this
# release; the deploy script uploads the matching source maps under the SAME
# value, which is what lets the collector symbolicate minified frames.
ARG SIGNALS_RELEASE=""
ENV VITE_SIGNALS_RELEASE=$SIGNALS_RELEASE
RUN pnpm --filter @tickets/web build

FROM deps AS app
RUN apk add --no-cache nginx supervisor
# self-hosted DB browser (static Go binary, baked in → works offline)
COPY --from=sosedoff/pgweb:latest /usr/bin/pgweb /usr/bin/pgweb
# built SPA bundle
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
# Source maps are for the collector, not the public: stage them where the
# deploy script's upload step can read them, then strip them from the served
# root so nginx can never hand them out. ('hidden' sourcemaps already omit the
# sourceMappingURL comment, so nothing references them either way.)
RUN mkdir -p /app/sourcemaps \
  && find /usr/share/nginx/html -name '*.map' -exec mv {} /app/sourcemaps/ \; \
  && echo "staged $(ls -1 /app/sourcemaps | wc -l) source maps"
# infra
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/tickets.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV NODE_ENV=production
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
