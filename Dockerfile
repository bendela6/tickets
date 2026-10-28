# Multi-stage build for the tickets stack — one runtime image:
# nginx (front) + node API + pgweb (self-hosted DB browser), under supervisord.

# every workspace package's manifest at its own path, found rather than listed: a package missing from the
# install is left unlinked and the web build can't resolve it. This stage reruns on any change; its output,
# and so the install below, only on a manifest's.
FROM node:22-alpine AS manifests
WORKDIR /src
COPY . .
RUN find . -name package.json -not -path '*/node_modules/*' \
      -exec sh -c 'mkdir -p "/manifests/$(dirname "$1")" && cp "$1" "/manifests/$1"' _ {} \;

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
# manifests first so the install layer caches until dependencies change
# .npmrc carries the tslib public-hoist needed by radix-ui transitives at build time
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --from=manifests /manifests/ ./
# the root's prepare script (tilewise-hooks) writes git hooks with @tilewise/config's bin, which isn't here yet: only
# the manifests are, and there's no git to hook
RUN npm pkg delete scripts.prepare
RUN pnpm install --frozen-lockfile
COPY . .

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
