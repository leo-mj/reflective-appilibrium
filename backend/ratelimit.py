"""
A small fixed-window rate limiter, used to cap LLM-backed requests per client.

Deliberately in-process and dependency-free. The alternative was slowapi, but
its default storage is in-process too, so it would buy no extra correctness here
while adding two packages to a backend that currently has six runtime
dependencies. The trade-off is the same one ``conversations._sessions`` already
makes: counters live in one worker's memory, so with more than one uvicorn
worker each enforces the limit separately and the effective ceiling multiplies.
Run a single worker, or move both to a shared store together.

Fixed window rather than a token bucket because the failure it guards against is
sustained volume, not burstiness: a client can send up to 2x the limit across a
window boundary, which is an acceptable overshoot for a cap whose purpose is to
stop a loop from draining an API key.
"""

from __future__ import annotations

import threading
import time
from typing import Optional


class FixedWindowLimiter:
    """Counts requests per key within a fixed window, discarding old windows.

    Safe to call from several threads: FastAPI runs synchronous dependencies in
    a threadpool, so this is reached concurrently even though the event loop
    itself is single-threaded.
    """

    def __init__(self, limit: int, window_seconds: float = 60.0) -> None:
        self._limit = limit
        self._window = window_seconds
        self._lock = threading.Lock()
        # key -> (window_started_at, count_in_window)
        self._hits: dict[str, tuple[float, int]] = {}

    @property
    def limit(self) -> int:
        return self._limit

    def allow(self, key: str, now: Optional[float] = None) -> bool:
        """Record a request for ``key`` and report whether it is within the cap.

        A limit of 0 or less disables the limiter entirely, which is how a
        localhost install opts out.
        """
        if self._limit <= 0:
            return True
        now = time.monotonic() if now is None else now

        with self._lock:
            self._prune(now)
            started, count = self._hits.get(key, (now, 0))
            if now - started >= self._window:
                started, count = now, 0
            count += 1
            self._hits[key] = (started, count)
            return count <= self._limit

    def retry_after(self, key: str, now: Optional[float] = None) -> int:
        """Whole seconds until ``key``'s current window expires, at least 1."""
        now = time.monotonic() if now is None else now
        with self._lock:
            started, _ = self._hits.get(key, (now, 0))
        return max(1, int(self._window - (now - started)) + 1)

    def _prune(self, now: float) -> None:
        """Drop expired windows.

        Without this the map grows one entry per distinct client forever, which
        would make the limiter its own slow memory leak — the failure mode it is
        supposed to prevent.
        """
        expired = [
            k for k, (started, _) in self._hits.items() if now - started >= self._window
        ]
        for k in expired:
            del self._hits[k]

    def reset(self) -> None:
        """Forget all counters. For tests."""
        with self._lock:
            self._hits.clear()
