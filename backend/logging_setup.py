"""The backend's logging, in the one place both kinds of process configure it.

Two processes need this, and they must not drift apart: the server, from
``main.py``, and every simulation worker, from ``process_pool``. A spawned worker
imports rethon but never ``main.py``, so without calling this itself it would
log nothing at all — silently.
"""

import logging

_FORMAT = "%(levelname)-8s %(name)s: %(message)s"


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
        handler.setFormatter(logging.Formatter(_FORMAT))
        handler._backend_handler = True  # type: ignore[attr-defined]
        root.addHandler(handler)
    root.setLevel(logging.INFO)

    for name, logger in logging.Logger.manager.loggerDict.items():
        if name.startswith("backend") and isinstance(logger, logging.Logger):
            logger.disabled = False
