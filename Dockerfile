# Backend image. Host-agnostic: the platform's own config (fly.toml, render.yaml,
# an nginx snippet) is a separate, small step once a host is chosen.
#
#   docker build -t appilibrium-backend .
#   docker run -p 8000:8000 -e CORS_ORIGINS=https://<frontend-origin> appilibrium-backend

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # An image is never "uvicorn and the browser on the same machine", so it
    # starts in the safe posture. Override only for a deliberate local container.
    DEPLOYMENT=hosted \
    PORT=8000

RUN useradd --create-home --uid 10001 app
WORKDIR /srv

# Requirements first, so a code change does not reinstall every dependency.
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

COPY backend backend

# `import rethon` opens rethon.log in the working directory, so the directory
# must be writable by the user the server runs as, or the import fails.
RUN chown app:app /srv
USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/health', timeout=4)"

# --workers 1 is required, not a tuning choice: the rate limiter (ratelimit.py)
# and the discussion sessions (routers/conversations.py) live in process memory,
# so a second worker would double every allowance and lose conversations.
#
# --forwarded-allow-ips=* trusts x-forwarded-for from any peer. That is only safe
# because the platform's proxy is the sole way into the container; publish the
# port directly to the internet and any caller can pick its own rate-limit
# identity. Narrow it to the proxy's address wherever that is known.
#
# Shell form for $PORT, with exec so uvicorn receives the platform's SIGTERM.
CMD exec uvicorn backend.main:app --host 0.0.0.0 --port "$PORT" \
    --workers 1 --forwarded-allow-ips="*"
