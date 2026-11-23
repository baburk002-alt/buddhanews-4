#!/bin/sh
# Runs as PID 1 inside the container. Optionally applies pending SQL migrations
# (RUN_MIGRATIONS=1) and then replaces itself with the Node process so signals
# reach the server directly and shutdown stays graceful.
set -eu

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "Applying database migrations…"
  node dist/migrate.js
fi

exec "$@"
