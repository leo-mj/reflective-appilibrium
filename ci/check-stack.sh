#!/bin/sh
# Checks a running single-host stack (docker-compose.yml) over HTTP.
#
#   ci/check-stack.sh http://127.0.0.1:8080
#
# Shared by the GitHub and GitLab pipelines so the two cannot drift. Plain sh
# with busybox-compatible tools, since GitLab runs it in the Alpine docker image.
#
# Each thing the stack promises fails silently when it breaks — a wrong base
# path is a blank page, a missing fallback is a 404 on reload, a policy naming
# the wrong backend refuses every request — so each is asked for directly.
set -eu

base=${1:?usage: check-stack.sh <base-url>}
work=$(mktemp -d)

fail() {
  echo "check-stack: $*" >&2
  exit 1
}

# The backend imports rethon on start, which takes a while.
i=0
until curl -fsS "$base/api/health" -o "$work/health.json" 2>/dev/null; do
  i=$((i + 1))
  [ "$i" -lt 60 ] || fail "/api/health did not answer through nginx within two minutes"
  sleep 2
done

# /api reaches the backend, in the hosted posture.
cat "$work/health.json"; echo
grep -q '"deployment":"hosted"' "$work/health.json" || fail "backend is not in the hosted posture"

# The page, built for its own origin: connect-src names nothing else.
curl -fsS "$base/" -o "$work/index.html"
grep -o "connect-src [^;]*" "$work/index.html" | grep -qx "connect-src 'self'" \
  || fail "connect-src is not 'self' alone"

# A deep link or a reload falls back to the app instead of 404ing.
curl -fsS "$base/some/deep/link" | grep -q '<div id="root">' || fail "no SPA fallback"

# frame-ancestors, which the meta tag cannot carry, comes as a header.
curl -fsSI "$base/" | grep -qi "^content-security-policy: frame-ancestors 'none'" \
  || fail "no frame-ancestors header"

# Hashed assets are cached for good; the page itself never is.
asset=$(grep -o '/assets/[^"]*\.js' "$work/index.html" | head -n 1)
[ -n "$asset" ] || fail "no script asset referenced from index.html"
curl -fsSI "$base$asset" | grep -qi '^cache-control: public, max-age=31536000, immutable' \
  || fail "assets are not cached as immutable"
curl -fsSI "$base/" | grep -qi '^cache-control: no-cache' || fail "index.html is cacheable"

echo "check-stack: all checks passed"
