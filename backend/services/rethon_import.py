"""Import rethon, and repair what importing it does to our logging.

``import rethon`` applies a logging configuration with
``disable_existing_loggers`` left at its default, which switches off every
logger that exists at that moment — most of the ``backend`` tree — and nothing
says so: the symptom is silence (logging_setup.configure_backend_logging has the
whole story). The repair has to come *after* that first import, and only the
first import configures anything.

It used to happen in a fixed place: main.py, right after the router imports,
because the router imported rethon. It no longer does — the server process
keeps the rethon stack out (services/rethon_tasks) — so rethon is now first
imported wherever a computation first runs: in a worker, in a test, or in the
server process should anything there ever load it. Hence here, at the import
itself, and every module that uses rethon or theodias imports this first.
"""

import rethon  # noqa: F401 — imported for its side effect, repaired below
import theodias  # noqa: F401

from ..logging_setup import configure_backend_logging

configure_backend_logging()
