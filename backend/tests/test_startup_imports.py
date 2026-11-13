"""The server process must not load the rethon stack.

A hosted instance that has scaled to zero spends most of its start-up reading
files, and rethon with its dependencies (numba, llvmlite, numpy, pandas, …) was
most of what ``import backend.main`` read: 263 MB of native libraries. The
server process never computes with any of it — the workers do — so it imports
``services/rethon_tasks`` instead. A single new import of ``rethon_simulation``
or ``rethon_scoring`` anywhere the server loads would bring the whole cost back
and pass every other test, which is what this one is for.

Run in a fresh process: this one has imported rethon long since.
"""

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


def _probe(module: str) -> dict:
    out = subprocess.run(
        [sys.executable, "-m", "backend.tools.measure_startup", "--probe", module],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
        timeout=120,
    )
    return json.loads(out.stdout.strip().splitlines()[-1])


def test_the_server_process_does_not_load_the_rethon_stack():
    loaded = _probe("backend.main")["heavy_loaded"]
    assert loaded == [], (
        f"import backend.main loaded {', '.join(loaded)}. Import the worker "
        "entry points from services/rethon_tasks, not the computations."
    )


def test_the_probe_does_see_the_stack_when_it_is_loaded():
    """Otherwise the test above would pass by never noticing anything."""
    assert "rethon" in _probe("backend.services.rethon_simulation")["heavy_loaded"]


def test_our_loggers_survive_rethon_imported_after_the_server():
    """`import rethon` switches off every logger that already exists. It used to
    be imported with the router, before main.py repaired the damage; now the
    server never imports it, so it arrives later — in a worker, or here — and
    the repair has to travel with it (services/rethon_import.py). A fresh
    process, so the order is the one a server would see, not the suite's."""
    script = (
        "import logging, backend.main, backend.services.rethon_simulation\n"
        "print([n for n, l in logging.Logger.manager.loggerDict.items()"
        " if n.startswith('backend') and isinstance(l, logging.Logger)"
        " and l.disabled])\n"
    )
    out = subprocess.run(
        [sys.executable, "-c", script],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
        timeout=120,
    )
    assert out.stdout.strip().splitlines()[-1] == "[]"
