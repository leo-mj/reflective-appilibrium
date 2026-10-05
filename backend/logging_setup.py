"""The backend's logging, in the one place both kinds of process configure it.

Two processes need this, and they must not drift apart: the server, from
``main.py``, and every simulation worker, from ``process_pool``. A spawned worker
imports rethon but never ``main.py``, so without calling this itself it would
log nothing at all — silently.

Two formats, chosen by ``LOG_FORMAT``. ``text`` (the default) is for a person
reading a terminal. ``json`` is for a log collector: one JSON object per line,
carrying ``severity``, so a platform that reads structured lines — Cloud Run's
does — can filter by level, and a traceback arrives as one entry rather than
one per line. Both go through ``ContentFreeFormatter``'s rule on exceptions.
"""

import json
import logging
import re
import traceback
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Optional

from starlette.types import ASGIApp, Receive, Scope, Send

_FORMAT = "%(levelname)-8s %(name)s: %(message)s"


class ContentFreeFormatter(logging.Formatter):
    """A formatter whose tracebacks name each exception but never quote it.

    The server handles strangers' moral reasoning, and its log must not become a
    record of it. The log calls themselves are written to carry counts, ids and
    model names only — but a traceback ends in the exception's message, and
    messages quote their input: a pydantic ``ValidationError`` about a model's
    reply includes the offending text, an httpx error includes the URL, and a
    Crossref URL includes a reference's title. A rule for every future log call
    would be forgotten; this is the one place a message could get through.

    Frames, line numbers and exception types stay, and they are what a traceback
    is read for. Chained causes are kept too, the same way.
    """

    def formatException(self, ei) -> str:
        exc = ei[1]
        if exc is None:
            return super().formatException(ei)
        # Oldest first, the order Python prints a chain in.
        chain = []
        seen = set()
        link, joiner = exc, None
        while link is not None and id(link) not in seen:
            seen.add(id(link))
            chain.append((link, joiner))
            if link.__cause__ is not None:
                link, joiner = link.__cause__, _CAUSE
            elif link.__context__ is not None and not link.__suppress_context__:
                link, joiner = link.__context__, _CONTEXT
            else:
                link = None
        parts = []
        for link, joiner in reversed(chain):
            if link.__traceback__ is not None:
                parts.append("Traceback (most recent call last):\n")
                parts.extend(traceback.format_tb(link.__traceback__))
            parts.append(_type_name(link) + " (message withheld)\n")
            if joiner:
                parts.append(joiner)
        return "".join(parts).rstrip("\n")


_CAUSE = "\nThe above exception was the direct cause of the following exception:\n\n"
_CONTEXT = "\nDuring handling of the above exception, another exception occurred:\n\n"


def _type_name(exc: BaseException) -> str:
    cls = type(exc)
    if cls.__module__ in ("builtins", "__main__"):
        return cls.__qualname__
    return f"{cls.__module__}.{cls.__qualname__}"


class JsonFormatter(ContentFreeFormatter):
    """One JSON object per record, on one line.

    ``severity`` and ``message`` are the names Cloud Logging reads from a
    structured line, and they are plain enough that any collector which reads
    JSON can use them. ``request_id`` ties together the lines one request
    wrote (``RequestIdMiddleware``). A traceback goes in ``stack_trace``, with
    its messages withheld as in text — inside the one line, which is the point:
    printed as text, a collector files each of its lines as an entry of its own.
    """

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "time": datetime.fromtimestamp(record.created, timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "severity": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if request_id := current_request_id():
            entry["request_id"] = request_id
        if record.exc_info:
            entry["stack_trace"] = self.formatException(record.exc_info)
        elif record.stack_info:
            entry["stack_trace"] = record.stack_info
        return json.dumps(entry, ensure_ascii=False)


def make_formatter(log_format: str) -> logging.Formatter:
    return JsonFormatter() if log_format == "json" else ContentFreeFormatter(_FORMAT)


# ── Request ids ───────────────────────────────────────────────────────────────

_request_id: ContextVar[Optional[str]] = ContextVar("request_id", default=None)

# A W3C trace context: version, 32-hex trace id, 16-hex parent id, flags.
_TRACEPARENT = re.compile(r"^[0-9a-f]{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$")
# Google's older header: TRACE_ID/SPAN_ID;o=OPTIONS, the trace id 32 hex.
_CLOUD_TRACE = re.compile(r"^([0-9a-f]{32})(?:/|$)")


def current_request_id() -> Optional[str]:
    return _request_id.get()


def request_id_from(headers: dict[str, str]) -> str:
    """The id of the trace a proxy put this request in, or a fresh one.

    Taken from the trace the platform's proxy started when there is one, so the
    id in our lines is the trace id on the platform's own record of the request
    — on Cloud Run, the request log — and searching for one finds the other.
    Read from a header, so a caller can choose it; it is accepted only as hex
    of the right length, so a chosen id can mislabel lines but put nothing else
    into them.
    """
    for header, pattern in (
        ("traceparent", _TRACEPARENT),
        ("x-cloud-trace-context", _CLOUD_TRACE),
    ):
        match = pattern.match(headers.get(header, "").strip().lower())
        if match and match.group(1).strip("0"):
            return match.group(1)
    return uuid.uuid4().hex


class RequestIdMiddleware:
    """Gives every line a request writes the id of that request.

    The id is set and never reset. uvicorn runs each request in a task of its
    own, with a copy of the context, so the value cannot reach another request;
    and leaving it set is what lets uvicorn's own line about an exception that
    escaped the app — written after this middleware has returned — carry it.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            headers = {
                name.decode("latin-1"): value.decode("latin-1")
                for name, value in scope.get("headers", [])
            }
            _request_id.set(request_id_from(headers))
        await self.app(scope, receive, send)


# ── Configuration ─────────────────────────────────────────────────────────────

# One handler for the backend tree and uvicorn's loggers, so the two cannot be
# formatted differently.
_handler: Optional[logging.Handler] = None


def configure_backend_logging(log_format: Optional[str] = None) -> None:
    """Give our loggers a handler, and undo rethon's damage to them.

    `import rethon` applies a logging configuration with
    `disable_existing_loggers` left at its default — which switches off every
    logger that already exists, i.e. every module imported before it. That
    silently dropped all output from the routers imported ahead of
    routers.simulate_rethon, the assist routers among them, including the error
    logs that say a model returned unparseable JSON.

    uvicorn's loggers exist before the app is imported, so they were switched
    off too — among them the one that reports an exception escaping the app,
    which left a crash with a 500 and no traceback anywhere. ``uvicorn`` and
    ``uvicorn.error`` are switched back on here, through our handler: uvicorn's
    own would quote each exception's message, which is the server's one way
    for a stranger's text to reach the log. ``uvicorn.access`` stays off, as it
    has been: the platform's proxy keeps a record of every request already, and
    the score badges alone make a request per edit.

    So this must run *after* rethon has been imported, and it configures these
    loggers rather than logging globally. Safe to call more than once: the
    handler is created only the first time.

    ``log_format`` defaults to the ``LOG_FORMAT`` setting.
    """
    global _handler
    if _handler is None:
        if log_format is None:
            from .config import get_settings

            log_format = get_settings().log_format
        _handler = logging.StreamHandler()
        _handler.setFormatter(make_formatter(log_format))

    root = logging.getLogger("backend")
    if _handler not in root.handlers:
        root.addHandler(_handler)
    root.setLevel(logging.INFO)

    for name, logger in logging.Logger.manager.loggerDict.items():
        if name.startswith("backend") and isinstance(logger, logging.Logger):
            logger.disabled = False

    uvicorn = logging.getLogger("uvicorn")
    uvicorn.handlers = [_handler]
    uvicorn.propagate = False
    uvicorn.disabled = False
    logging.getLogger("uvicorn.error").disabled = False
    # Said here rather than left to rethon, which is how it came to be off.
    logging.getLogger("uvicorn.access").disabled = True
