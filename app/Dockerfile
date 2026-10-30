# Frontend image: the BYOK build, served by nginx — which also forwards /api to
# the backend container, so whoever hosts the pair routes one hostname to this
# container and nothing else. docker-compose.yml at the repo root wires the two.
#
#   docker build -t appilibrium-frontend app
#   docker run -p 8080:8080 -e BACKEND_UPSTREAM=<backend-host>:8000 appilibrium-frontend
#
# Served from a path rather than the root of its host, the page has to be built
# for that path — every asset URL carries it:
#
#   docker build --build-arg BASE_PATH=/some/path/ -t appilibrium-frontend app

# Base images are named with their registry: Podman and Buildah, unlike Docker,
# refuse a short name like nginxinc/… when no registries.conf says where to look.

# ── Build stage ───────────────────────────────────────────────────────────────

FROM docker.io/library/node:24-alpine AS build
WORKDIR /app

# Dependencies before sources, so a code change reuses the install layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The path the site is served from, with a slash at each end: / for the root
# of its host. The page and the backend on one host: requests go to
# <BASE_PATH>api on the page's own origin (src/backendUrl.js), and the
# Content-Security-Policy's connect-src is 'self' alone. Set here rather than
# left to app/.env.backend, whose VITE_BACKEND_URL is a placeholder.
ARG BASE_PATH=/
RUN case "$BASE_PATH" in /|/*/) ;; *) echo "BASE_PATH must start and end with /: $BASE_PATH" >&2; exit 1 ;; esac
ENV VITE_APP_ENV=backend \
    VITE_BACKEND_URL=$BASE_PATH \
    VITE_BASE_PATH=$BASE_PATH
RUN npm run build:backend

# ── Runtime stage ─────────────────────────────────────────────────────────────

# The unprivileged variant runs as a non-root user on ports above 1024 — what a
# cluster that forbids root containers requires, and the same posture as the
# backend image.
FROM docker.io/nginxinc/nginx-unprivileged:stable-alpine

# The server config is two templates: at start the image fills in the variables
# below from the environment (and only those — nginx's own $host and friends are
# left alone), writing the results to /etc/nginx/conf.d/default.conf and
# site.inc beside it.
COPY nginx/default.conf.template nginx/site.inc.template /etc/nginx/templates/
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Build arguments end with their stage; these two are needed again here.
ARG BASE_PATH=/
ARG PROXY_PROTOCOL_FROM=127.0.0.1

# Where the backend is. A name Docker's DNS knows in Compose; in a cluster give
# the fully qualified service name, since nginx's resolver applies no search
# domains.
ENV BACKEND_UPSTREAM=backend:8000 \
    # The proxy in front of this container, whose X-Forwarded-For is believed
    # on port 8080 (an address or CIDR). The default believes nobody, which is
    # right when nothing is in front; behind a host's proxy, set it to that
    # proxy's address or every visitor shares its rate-limit allowance.
    TRUSTED_PROXY=127.0.0.1 \
    # The same for a proxy speaking PROXY protocol, which connects to port 8081
    # instead. A build argument as well, so that an image built for one host
    # can carry its proxy's address.
    PROXY_PROTOCOL_FROM=$PROXY_PROTOCOL_FROM \
    # The path the page was built for, which nginx removes when a proxy passes
    # it on. Fixed by the build: changing it here would not move the page.
    BASE_PATH=$BASE_PATH \
    # Have the image read the container's DNS server into NGINX_LOCAL_RESOLVERS,
    # which the template's `resolver` uses. Resolving per request rather than
    # once at start is what survives a backend restart onto a new address.
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

# 8080 plain HTTP, 8081 PROXY protocol (nginx/default.conf.template).
EXPOSE 8080 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
