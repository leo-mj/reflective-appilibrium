"""The backend's logging, in the one place both kinds of process configure it.

Two processes need this, and they must not drift apart: the server, from
``main.py``, and every simulation worker, from ``process_pool``. A spawned worker
imports rethon but never ``main.py``, so without calling this itself it would
log nothing at all — silently.
"""

import logging
import traceback

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


def configure_backend_logging() -> None:
    """Give the ``backend`` logger tree a handler, and undo rethon's damage to it.

    `import rethon` applies a logging configuration with
    `disable_existing_loggers` left at its default — which switches off every
    logger that already exists, i.e. every module imported before it. That
    silently dropped all output from the routers imported ahead of
    routers.simulate_rethon, the assist routers among them, including the error
    logs that say a model returned unparseable JSON.

    So this must run *after* rethon has been imported, and it re-enables our own
    tree rather than configuring logging globally. Safe to call more than once:
    the handler is added only the first time.
    """
    root = logging.getLogger("backend")
    if not any(getattr(h, "_backend_handler", False) for h in root.handlers):
        handler = logging.StreamHandler()
        handler.setFormatter(ContentFreeFormatter(_FORMAT))
        handler._backend_handler = True  # type: ignore[attr-defined]
        root.addHandler(handler)
    root.setLevel(logging.INFO)

    for name, logger in logging.Logger.manager.loggerDict.items():
        if name.startswith("backend") and isinstance(logger, logging.Logger):
            logger.disabled = False
