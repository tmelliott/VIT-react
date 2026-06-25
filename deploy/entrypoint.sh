#!/bin/bash
set -euo pipefail

PORT="${PORT:-8080}"
RSERVE_PATH="${RSERVE_PATH:-/rserve}"

# RSERVE_HOST: explicit WebSocket URL/path for the browser.
# If unset, derive from HOSTNAME or Railway's RAILWAY_PUBLIC_DOMAIN + RSERVE_PATH.
if [[ -z "${RSERVE_HOST:-}" ]]; then
  base="${HOSTNAME:-}"
  if [[ -z "$base" && -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]]; then
    base="https://${RAILWAY_PUBLIC_DOMAIN}"
  fi

  if [[ -n "$base" ]]; then
    base="${base%/}"
    if [[ "$base" != *://* ]]; then
      base="https://${base}"
    fi
    case "$base" in
      https://*) ws_base="wss://${base#https://}" ;;
      http://*) ws_base="ws://${base#http://}" ;;
      *) ws_base="$base" ;;
    esac
    RSERVE_HOST="${ws_base}${RSERVE_PATH}"
  else
    RSERVE_HOST="/rserve"
  fi
fi

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
