"""Response headers every reply from this server carries.

A plain ASGI middleware rather than ``@app.middleware("http")``: Starlette's
``BaseHTTPMiddleware`` wraps the response body in its own stream, which is
known to interfere with streaming and background tasks, and headers need none
of what it offers.
"""

from starlette.types import ASGIApp, Message, Receive, Scope, Send

_ALWAYS = [
    # Serve a JSON body as JSON, never as whatever a browser sniffs it to be.
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"no-referrer"),
    # Nothing here is meant to be framed; a framed API page is a clickjacking
    # surface and nothing else.
    (b"content-security-policy", b"frame-ancestors 'none'"),
]

# API responses carry a user's moral reasoning back to them. No shared cache, and
# no browser disk cache on a shared machine, should keep a copy.
_API_ONLY = [(b"cache-control", b"no-store")]


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        extra = _ALWAYS + (_API_ONLY if scope["path"].startswith("/api/") else [])

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                present = {name.lower() for name, _ in message.get("headers", [])}
                message["headers"] = list(message.get("headers", [])) + [
                    (name, value) for name, value in extra if name not in present
                ]
            await send(message)

        await self.app(scope, receive, send_with_headers)
