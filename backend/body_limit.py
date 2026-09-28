"""A ceiling on the size of a whole request body.

The Pydantic models cap each field and each list, but only once the body has
been read and parsed — and the image runs one worker, so a few very large bodies
can hold it while they are. The rate limits come later still, in dependencies.
This refuses an oversized body before any of that.

Two ways a body arrives, and both are checked:

- **With ``Content-Length``**, which nearly every client sends: an oversized
  one is answered 413 at once, and not a byte of the body is read.
- **Without one** (chunked): the bytes are counted as the app reads them, and
  the read that crosses the ceiling raises a 413 instead of returning. FastAPI
  passes an ``HTTPException`` from a body read through unchanged, where any
  other exception would become its generic 400.

A plain ASGI middleware, for the reason ``security_headers`` gives. The limit
is a function, asked on every request, so that it follows the settings the
routes see rather than the ones in force when the module was imported.
"""

from typing import Callable, Optional

from fastapi import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send


def _too_large(limit: int) -> str:
    return f"Request body too large (limit {limit:,} bytes)."


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: Callable[[], int]) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        limit = self.max_bytes() if scope["type"] == "http" else 0
        if not limit:
            await self.app(scope, receive, send)
            return

        declared = _content_length(scope)
        if declared is not None and declared > limit:
            await _reply(send, 413, _too_large(limit))
            return

        received = 0

        async def counting_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise HTTPException(status_code=413, detail=_too_large(limit))
            return message

        await self.app(scope, counting_receive, send)


def _content_length(scope: Scope) -> Optional[int]:
    """The declared body size, or None when there is no usable header.

    A malformed value is left to the server and the app, as it would be without
    this middleware: the count in ``counting_receive`` still bounds what is read.
    """
    for name, value in scope.get("headers", []):
        if name == b"content-length":
            try:
                return int(value)
            except ValueError:
                return None
    return None


async def _reply(send: Send, status: int, detail: str) -> None:
    body = ('{"detail":"%s"}' % detail).encode()
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
                # The client is still sending a body nobody will read; closing
                # is what tells it to stop.
                (b"connection", b"close"),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})
