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

- ``simulation`` — full RE processes: ``/simulate``, ``/step`` and
  ``/score_per_round``. Seconds each, started by a person pressing a button.
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

Stopping a computation
----------------------

A ``ProcessPoolExecutor`` cannot stop one task: a running future ignores
``cancel()``, and a worker that dies — killed, or out of memory — breaks the
whole pool for good, failing everything else it held. So stopping means killing
the pool's workers and starting a new pool, and ``run_in_pool`` is arranged so
that costs nobody but the computation being stopped:

- **Requests queue here, not in the pool.** A per-pool gate admits only as many
  computations as there are workers, so a pool never holds a queued task that a
  kill would take down with it. (With more than one worker, whatever else is
  running at that moment is still lost, and its caller gets a 503.)
- **Stopped while running means killed.** A ``stop`` event set by a caller who
  has gone away, the timeout below, or the call being cancelled all kill the
  worker, so the computation stops rather than burning a core for nobody.
  Stopped while still queued, it simply leaves the queue. Stopping is signalled
  rather than done by cancelling, because a cancellation surfaces as an
  exception in this module's frames, and a debugger breaking on uncaught
  exceptions stops there on every Stop press.
- **The timeout counts computing, not queueing.** Otherwise the third request
  in line would time out having done nothing.

A pool that breaks on its own is replaced on the next request, and the request
that found it broken gets a 503.
"""

import asyncio
import logging
import multiprocessing
import weakref
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool
from functools import partial
from threading import Lock
from typing import Any, Callable, Dict, Literal, Optional, TypeVar

from fastapi import HTTPException

from .config import Settings, get_settings
from .logging_setup import configure_backend_logging

logger = logging.getLogger(__name__)

T = TypeVar("T")

PoolName = Literal["simulation", "scoring"]

_pools: Dict[str, ProcessPoolExecutor] = {}
_lock = Lock()

# One gate per pool per event loop. An asyncio.Semaphore belongs to the loop it
# is first used on, and the suite runs many loops in one process.
_gates: (
    "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, Dict[str, asyncio.Semaphore]]"
) = weakref.WeakKeyDictionary()


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


def _gate(name: PoolName) -> asyncio.Semaphore:
    gates = _gates.setdefault(asyncio.get_running_loop(), {})
    if name not in gates:
        gates[name] = asyncio.Semaphore(_workers(name, get_settings()))
    return gates[name]


def _kill(pool: ProcessPoolExecutor) -> None:
    # No public way to reach the workers before Python 3.14's kill_workers();
    # _processes is the executor's own pid -> Process map.
    for process in list((getattr(pool, "_processes", None) or {}).values()):
        process.kill()
    pool.shutdown(wait=False, cancel_futures=True)


def _discard(name: PoolName, pool: ProcessPoolExecutor, kill: bool) -> None:
    """Drop ``pool`` so the next request starts a fresh one.

    Only if it is still the current pool: two requests can find the same pool
    broken, and the second must not throw away the replacement the first caused.
    """
    with _lock:
        if _pools.get(name) is pool:
            del _pools[name]
    if kill:
        _kill(pool)
    else:
        pool.shutdown(wait=False, cancel_futures=True)


class ComputationStopped(Exception):
    """The computation was stopped through ``run_in_pool``'s ``stop`` event."""


async def _first(awaitable: Any, stop: Optional[asyncio.Event], timeout: float) -> bool:
    """Wait for ``awaitable``, ``stop`` or ``timeout``; True if the first came first.

    Built on ``asyncio.wait``, which returns rather than raises: nothing is
    cancelled in this module's frames on the way out, so a Stop press does not
    surface as an exception to a debugger breaking on uncaught ones. What is
    cancelled here — the leftover ``stop.wait()`` — is cancelled inside asyncio.
    """
    waiters = {awaitable}
    stopped = asyncio.ensure_future(stop.wait()) if stop is not None else None
    if stopped is not None:
        waiters.add(stopped)
    try:
        done, _ = await asyncio.wait(
            waiters, timeout=timeout or None, return_when=asyncio.FIRST_COMPLETED
        )
    finally:
        if stopped is not None and not stopped.done():
            stopped.cancel()
    return awaitable in done


async def run_in_pool(
    name: PoolName,
    fn: Callable[..., T],
    *args: Any,
    timeout: float = 0,
    stop: Optional[asyncio.Event] = None,
    **kwargs: Any,
) -> T:
    """Run ``fn(*args, **kwargs)`` in a worker of pool ``name`` and await it.

    ``fn`` must be a module-level function, and its arguments and return value
    must pickle. See the module docstring for what must never be raised inside,
    and for which pool a computation belongs in.

    ``timeout`` is seconds of computing, 0 for none. Past it the worker is killed
    and the caller gets a 504; a worker that dies gets it a 503. Setting ``stop``
    kills the worker too, if the computation has started, and raises
    ``ComputationStopped``. ``fn`` therefore cannot take keyword arguments named
    ``timeout`` or ``stop``.

    Cancelling the call still kills the worker, for the case nothing else covers
    — the server shutting down mid-request — but the router stops a computation
    through ``stop``, since a cancellation surfaces here as an exception.
    """
    gate = _gate(name)
    entry = asyncio.ensure_future(gate.acquire())

    def leave_queue() -> None:
        entry.cancel()
        # Admitted in the same instant it was stopped: give the place back.
        if entry.done() and not entry.cancelled():
            gate.release()

    try:
        admitted = await _first(entry, stop, 0)
    except asyncio.CancelledError:
        leave_queue()
        raise
    if not admitted:
        leave_queue()
        raise ComputationStopped()
    try:
        pool = get_pool(name)
        future = asyncio.get_running_loop().run_in_executor(
            pool, partial(fn, *args, **kwargs)
        )
        try:
            finished = await _first(future, stop, timeout)
        except asyncio.CancelledError:
            logger.info("A %s computation was cancelled and stopped.", name)
            future.cancel()
            _discard(name, pool, kill=True)
            raise
        if not finished:
            future.cancel()  # so the broken pool's error is never left unretrieved
            _discard(name, pool, kill=True)
            if stop is not None and stop.is_set():
                logger.info("A %s computation was stopped.", name)
                raise ComputationStopped()
            logger.warning(
                "A %s computation ran past %ss and was stopped.", name, timeout
            )
            raise HTTPException(
                status_code=504,
                detail=(
                    f"The computation took longer than this instance allows "
                    f"({timeout:g}s) and was stopped. Try fewer elements, or run "
                    f"the backend locally."
                ),
            )
        try:
            return future.result()
        except BrokenProcessPool:
            logger.error("A %s worker died; starting a new pool.", name)
            _discard(name, pool, kill=False)
            raise HTTPException(
                status_code=503,
                detail=(
                    "The computation's worker process stopped unexpectedly, "
                    "possibly out of memory. Please try again."
                ),
            )
    finally:
        gate.release()


def shutdown_pools() -> None:
    """Stop every worker that was started. Called from the app's lifespan.

    Killed rather than waited for: a computation has no state worth finishing,
    and waiting would hold a server restart for as long as the longest one runs.
    """
    with _lock:
        pools = list(_pools.values())
        _pools.clear()
    for pool in pools:
        _kill(pool)
