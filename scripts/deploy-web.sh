#!/usr/bin/env sh
# Rebuild the web image from current source and redeploy the container on 4610.
# Used during the redesign to publish progress to a stable URL while dev runs on 4620.
set -e
cd "$(dirname "$0")/.."
docker compose build web
docker compose up -d web
echo "deployed web -> http://localhost:4610"
