#!/bin/bash
set -euo pipefail

PORT="${PORT:-8080}"
RSERVE_HOST="${RSERVE_HOST:-/rserve}"

# Normalise http(s) URLs to ws(s) for the browser WebSocket client.
case "$RSERVE_HOST" in
  https://*) RSERVE_HOST="wss://${RSERVE_HOST#https://}" ;;
  http://*) RSERVE_HOST="ws://${RSERVE_HOST#http://}" ;;
esac

# Runtime config for the browser (see app/src/lib/rserveHost.ts)
escaped_host="${RSERVE_HOST//\\/\\\\}"
escaped_host="${escaped_host//\"/\\\"}"
printf 'window.__RSERVE_HOST__="%s";\n' "$escaped_host" > /var/www/vit/rserve-config.js

mkdir -p /etc/nginx/conf.d
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

cd /server
Rscript vit.rserve.R &
rserve_pid=$!

nginx -g 'daemon off;' &
nginx_pid=$!

wait -n "$rserve_pid" "$nginx_pid"
exit $?
