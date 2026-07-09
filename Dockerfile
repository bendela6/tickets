# Multi-stage build for the tickets stack — one runtime image:
# nginx (front) + node API + pgweb (self-hosted DB browser), under supervisord.

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
# manifests first so the install layer caches until dependencies change
# .npmrc carries the tslib public-hoist needed by radix-ui transitives at build time
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mcp/package.json apps/mcp/
COPY packages/db/package.json packages/db/
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
