# Multi-stage build for the tickets stack.
#   target "api" — Fastify API, runs migrations then serves (tsx, no compile step)
#   target "web" — nginx serving the built React app, proxying /api to the api service

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

FROM deps AS api
ENV NODE_ENV=production
EXPOSE 4600
CMD ["sh", "-c", "pnpm --filter @tickets/db db:migrate && pnpm --filter @tickets/api start"]

FROM deps AS web-build
RUN pnpm --filter @tickets/web build

FROM nginx:alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
