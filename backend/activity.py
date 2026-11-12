"""How long this server has been up, and how long since anyone used it.

A hosted backend scales to zero: the platform stops an instance some time after
its last request, and that time is not documented as a fixed figure (Cloud Run
describes idle instances being kept for up to about 15 minutes, some for less).
The wake-up the frontend does on every visit costs tens of seconds, so how long
an instance actually survives idle is worth knowing — and the platform's own
logs show the start of an instance, not why or when it stopped.

So the app logs one line as it shuts down (``main.lifespan``): its uptime, the
requests it served, and how long since the last of them. On Cloud Run the
shutdown follows a SIGTERM, which uvicorn receives because the image ``exec``s
it. Counts and times only, like every other log line here: nothing about what a
request asked.
"""

import time
from typing import Optional

from starlette.types import ASGIApp, Receive, Scope, Send

_started = time.monotonic()
_requests = 0
_last_request: Optional[float] = None


class ActivityMiddleware:
    """Notes the time of every HTTP request. Pure ASGI, so it costs a counter."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            global _requests, _last_request
            _requests += 1
            _last_request = time.monotonic()
        await self.app(scope, receive, send)


def _duration(seconds: float) -> str:
    seconds = int(seconds)
    if seconds < 60:
        return f"{seconds} s"
    minutes, seconds = divmod(seconds, 60)
    if minutes < 60:
        return f"{minutes} min {seconds} s"
    hours, minutes = divmod(minutes, 60)
    return f"{hours} h {minutes} min"


def shutdown_summary() -> str:
    """The line to log as the server stops."""
    now = time.monotonic()
    up = _duration(now - _started)
    if _last_request is None:
        return f"Shutting down after {up} up; no requests served."
    plural = "" if _requests == 1 else "s"
    return (
        f"Shutting down after {up} up; {_requests} request{plural} served, "
        f"the last {_duration(now - _last_request)} ago."
    )
