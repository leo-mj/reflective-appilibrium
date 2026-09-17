"""The worker processes rethon computations run in.

Why processes rather than the threads these endpoints used to use. Not to keep
the event loop responsive — a thread already did that: rethon is pure Python, so
the interpreter hands the GIL back every few milliseconds, and a 16-second
simulation in a thread stalled the loop by at most 0.1s (measured). What only a
process gives is a computation that can be *stopped*: a thread cannot be killed,
so a request past its deadline would go on burning a core after its caller had
given up, and a computation that exhausts memory would take the server with it.
Wall-clock timeouts and recovery from a dead worker are built on this.

Two pools, one worker each by default, split by what waits on what:

- ``simulation`` — full RE processes: ``/score_per_round`` now, ``/simulate`` and
  ``/step`` next. Seconds each, started by a person pressing a button.
- ``scoring`` — ``/quick_score`` and ``/score_changes``. Analytic and fast, but
  fired by the frontend on every edit and once per suggestion card.

One pool would be a queue: a 16-second simulation would hold every score badge
blank behind it, where threads had let the two interleave. Separate pools keep
the badges answering while a simulation runs. One worker each, because the point
is isolation rather than parallelism, and each worker holds its own copy of
rethon in memory. ``SIMULATION_WORKERS`` and ``SCORING_WORKERS`` raise them.

Three further choices are load-bearing:

- **Spawn, explicitly.** macOS spawns by default and Linux forks. Forking a
  process that is running an asyncio loop and several threads copies whatever
  locks those threads held at that instant, which is how a worker deadlocks on
  its first log line. Pinning spawn makes development and production the same.
- **Created lazily, on first use.** Not in the app's lifespan: the test suite
  builds ``TestClient(app)`` without a ``with`` block, so startup never runs
  there, and a lifespan-created pool would be ``None`` through most of it.
  Shutdown does go through the lifespan, since that is harmless when it never
  fires — interpreter exit joins the workers anyway.
- **An initializer that imports rethon and repairs logging.** A spawned worker
  runs none of ``main.py``, so without it the worker would log nothing, and the
  ~600ms rethon import would land on whichever request happened to come first.

Anything submitted must pickle both ways. ``HTTPException`` does not — its
``__init__`` takes ``status_code``, which unpickling does not pass — so a worker
must never raise one: validation that can refuse a request runs in the parent,
before the work is submitted.
"""

import asyncio
import logging
import multiprocessing
from concurrent.futures import ProcessPoolExecutor
from functools import partial
from threading import Lock
from typing import Any, Callable, Dict, Literal, TypeVar

from .config import Settings, get_settings
from .logging_setup import configure_backend_logging

logger = logging.getLogger(__name__)

T = TypeVar("T")

PoolName = Literal["simulation", "scoring"]

_pools: Dict[str, ProcessPoolExecutor] = {}
_lock = Lock()


def _workers(name: PoolName, settings: Settings) -> int:
    return (
        settings.simulation_workers
        if name == "simulation"
        else settings.scoring_workers
    )


def _init_worker() -> None:
    """Runs once in each worker, before its first task."""
    # Imported for their side effects: the slow rethon/theodias import is paid
    # here rather than inside a request, and rethon's logging configuration has
    # been applied by the time the repair below runs.
    from .services import rethon_scoring, rethon_simulation  # noqa: F401

    configure_backend_logging()
    logger.info("Simulation worker ready.")


def create_pool(max_workers: int) -> ProcessPoolExecutor:
    """A fresh pool. Use ``get_pool`` in application code; this is for tests."""
    return ProcessPoolExecutor(
        max_workers=max_workers,
        mp_context=multiprocessing.get_context("spawn"),
        initializer=_init_worker,
    )


def get_pool(name: PoolName) -> ProcessPoolExecutor:
    """The process-wide pool of that name, created on first use."""
    with _lock:
        if name not in _pools:
            workers = _workers(name, get_settings())
            _pools[name] = create_pool(workers)
            logger.info("Started the %s pool with %d worker(s).", name, workers)
        return _pools[name]


async def run_in_pool(
    name: PoolName, fn: Callable[..., T], *args: Any, **kwargs: Any
) -> T:
    """Run ``fn(*args, **kwargs)`` in a worker of pool ``name`` and await it.

    ``fn`` must be a module-level function, and its arguments and return value
    must pickle. See the module docstring for what must never be raised inside,
    and for which pool a computation belongs in.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(get_pool(name), partial(fn, *args, **kwargs))


def shutdown_pools() -> None:
    """Stop every worker that was started. Called from the app's lifespan."""
    with _lock:
        for pool in _pools.values():
            pool.shutdown(wait=True, cancel_futures=True)
        _pools.clear()
