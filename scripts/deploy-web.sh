#!/usr/bin/env sh
# Rebuild the single app image from current source and redeploy the container on 4610.
# Used during the redesign to publish progress to a stable URL while dev runs on 4620.
#
# Also closes the source-map loop for browser errors: the web bundle is built
# with a release stamp, and the matching (hidden) source maps are uploaded to
# the Signals collector under that same release. Both halves are required —
# apps/signals/src/routes/ingest.routes.ts symbolicates only when a signal
# carries a release AND artifacts exist for that (app, release) pair.
set -e
cd "$(dirname "$0")/.."

# One release identifier for both the bundle and its maps. Overridable so a
# dirty tree can be deployed under a distinct name.
SIGNALS_RELEASE="${SIGNALS_RELEASE:-$(git rev-parse --short HEAD 2>/dev/null || echo dev)}"
export SIGNALS_RELEASE
echo "release: $SIGNALS_RELEASE"

docker compose up -d --build app

# --- upload source maps -----------------------------------------------------
# Best-effort: failing here means minified stack traces, not a failed deploy.
upload_sourcemaps() {
  echo "waiting for the signals collector…"
  curl -fsS --retry 30 --retry-delay 2 --retry-connrefused http://127.0.0.1:4640/health >/dev/null || {
    echo "collector never became healthy — skipping source-map upload" >&2
    return 1
  }

  # Resolve Tickets Web's ingest credentials. POST /apps with upsert returns the
  # EXISTING app (200) when the slug is taken, so this is safe to re-run; a
  # plain GET /apps deliberately never exposes ingestKey.
  app_json=$(curl -fsS -X POST http://127.0.0.1:4640/apps \
    -H 'content-type: application/json' \
    -d '{"name":"Tickets Web","upsert":true}') || {
    echo "could not resolve the Tickets Web app — skipping source-map upload" >&2
    return 1
  }

  ingest_key=$(printf '%s' "$app_json" | sed -n 's/.*"ingestKey":"\([^"]*\)".*/\1/p')
  app_id=$(printf '%s' "$app_json" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
  if [ -z "$ingest_key" ] || [ -z "$app_id" ]; then
    echo "no ingestKey/id in the /apps response — skipping source-map upload" >&2
    return 1
  fi

  # Address the collector by loopback: the upload runs inside the container,
  # which shares a network namespace with the collector, so whatever public
  # host the stored DSN carries is irrelevant (and may be unreachable here).
  dsn="sgl://${ingest_key}@127.0.0.1:4640/${app_id}"

  docker compose exec -T app \
    node /app/packages/signals/node/dist/cli.js sourcemaps upload /app/sourcemaps \
    --release "$SIGNALS_RELEASE" --dsn "$dsn"
}

if upload_sourcemaps; then
  echo "source maps uploaded for release $SIGNALS_RELEASE"
else
  echo "continuing without source maps — browser stack traces will stay minified" >&2
fi

echo "deployed app -> http://localhost:4610"
