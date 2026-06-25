# VIT React + Rserve — single container (nginx static + Rserve WebSocket proxy)
#
# Build from this directory:
#   docker build -t vit-react .
#
# Run locally:
#   docker run --rm -p 8080:8080 vit-react
#   open http://localhost:8080

# --- Frontend build ---
FROM oven/bun:1 AS frontend

WORKDIR /app

COPY app/package.json app/bun.lock ./
RUN bun install --frozen-lockfile

COPY app/ .
ENV VIT_DOCKER_BUILD=1
RUN bun run build

# --- Runtime: R + nginx ---
FROM rocker/r-ver:4.4

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      nginx gettext-base \
      libcurl4-openssl-dev libssl-dev libxml2-dev && \
    rm -rf /var/lib/apt/lists/*

RUN R -e "install.packages('pak'); pak::pak(c('Rserve', 'tmelliott/RserveTS@develop', 'iNZightTools', 'cli'))"

COPY server /server
COPY --from=frontend /app/dist /var/www/vit

COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PORT=8080
# RSERVE_HOST derived at runtime from HOSTNAME or RAILWAY_PUBLIC_DOMAIN (see deploy/entrypoint.sh)
EXPOSE 8080

CMD ["/entrypoint.sh"]
