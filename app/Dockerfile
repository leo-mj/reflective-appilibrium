# Frontend image: the BYOK build, served by nginx — which also forwards /api to
# the backend container, so whoever hosts the pair routes one hostname to this
# container and nothing else. docker-compose.yml at the repo root wires the two.
#
#   docker build -t appilibrium-frontend app
#   docker run -p 8080:8080 -e BACKEND_UPSTREAM=<backend-host>:8000 appilibrium-frontend

# ── Build stage ───────────────────────────────────────────────────────────────

FROM node:24-alpine AS build
WORKDIR /app

# Dependencies before sources, so a code change reuses the install layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The page and the backend on one host: requests go to /api on the page's own
# origin (src/backendUrl.js), the site is served from the root, and the
# Content-Security-Policy's connect-src is 'self' alone. Set here rather than
# left to app/.env.backend, whose VITE_BACKEND_URL is a placeholder.
ENV VITE_APP_ENV=backend \
    VITE_BACKEND_URL=/ \
    VITE_BASE_PATH=/
RUN npm run build:backend

# ── Runtime stage ─────────────────────────────────────────────────────────────

# The unprivileged variant runs as a non-root user and listens on 8080 — what a
# cluster that forbids root containers requires, and the same posture as the
# backend image.
FROM nginxinc/nginx-unprivileged:stable-alpine

# The server config is a template: at start the image fills in the variables
# below from the environment (and only those — nginx's own $host and friends are
# left alone), writing the result to /etc/nginx/conf.d/default.conf.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Where the backend is. A name Docker's DNS knows in Compose; in a cluster give
# the fully qualified service name, since nginx's resolver applies no search
# domains.
ENV BACKEND_UPSTREAM=backend:8000 \
    # The proxy in front of this container, whose X-Forwarded-For is believed
    # (an address or CIDR). The default believes nobody, which is right when
    # nothing is in front; behind a host's proxy, set it to that proxy's address
    # or every visitor shares its rate-limit allowance.
    TRUSTED_PROXY=127.0.0.1 \
    # Have the image read the container's DNS server into NGINX_LOCAL_RESOLVERS,
    # which the template's `resolver` uses. Resolving per request rather than
    # once at start is what survives a backend restart onto a new address.
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
