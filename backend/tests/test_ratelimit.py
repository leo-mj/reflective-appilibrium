"""The fixed-window limiter behind the per-client LLM cap.

Time is injected rather than slept through, so these stay fast and do not depend
on the machine's scheduling.
"""

import threading

import pytest

from backend.ratelimit import FixedWindowLimiter


def test_allows_up_to_the_limit():
    limiter = FixedWindowLimiter(limit=3, window_seconds=60)
    assert [limiter.allow("a", now=0) for _ in range(3)] == [True, True, True]


def test_refuses_past_the_limit():
    limiter = FixedWindowLimiter(limit=3, window_seconds=60)
    for _ in range(3):
        limiter.allow("a", now=0)
    assert limiter.allow("a", now=0) is False


def test_keys_are_counted_separately():
    """One noisy client must not lock everyone else out."""
    limiter = FixedWindowLimiter(limit=1, window_seconds=60)
    assert limiter.allow("a", now=0) is True
    assert limiter.allow("a", now=0) is False
    assert limiter.allow("b", now=0) is True


def test_window_resets_after_it_elapses():
    limiter = FixedWindowLimiter(limit=1, window_seconds=60)
    assert limiter.allow("a", now=0) is True
    assert limiter.allow("a", now=59) is False
    assert limiter.allow("a", now=60) is True


def test_a_limit_of_zero_disables_the_limiter():
    """0 is how a localhost install opts out entirely."""
    limiter = FixedWindowLimiter(limit=0, window_seconds=60)
    assert all(limiter.allow("a", now=0) for _ in range(1_000))


def test_a_negative_limit_also_disables_it():
    limiter = FixedWindowLimiter(limit=-1, window_seconds=60)
    assert limiter.allow("a", now=0) is True


def test_expired_keys_are_pruned():
    """Otherwise the limiter leaks one entry per client, forever."""
    limiter = FixedWindowLimiter(limit=5, window_seconds=60)
    for i in range(50):
        limiter.allow(f"client-{i}", now=0)
    assert len(limiter._hits) == 50
    limiter.allow("late", now=120)
    assert len(limiter._hits) == 1


def test_retry_after_counts_down_within_the_window():
    limiter = FixedWindowLimiter(limit=1, window_seconds=60)
    limiter.allow("a", now=0)
    assert limiter.retry_after("a", now=0) == 61
    assert limiter.retry_after("a", now=59) == 2


def test_retry_after_is_never_zero():
    """A Retry-After of 0 invites an immediate retry that will also fail."""
    limiter = FixedWindowLimiter(limit=1, window_seconds=60)
    limiter.allow("a", now=0)
    assert limiter.retry_after("a", now=60) >= 1


def test_reset_clears_counters():
    limiter = FixedWindowLimiter(limit=1, window_seconds=60)
    limiter.allow("a", now=0)
    limiter.reset()
    assert limiter.allow("a", now=0) is True


def test_concurrent_callers_do_not_lose_counts():
    """FastAPI runs sync dependencies in a threadpool, so this is reached
    from several threads at once; without the lock, counts are lost to
    read-modify-write races and the cap silently lets more through."""
    limiter = FixedWindowLimiter(limit=10_000, window_seconds=600)
    threads = [
        threading.Thread(target=lambda: [limiter.allow("a") for _ in range(200)])
        for _ in range(8)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    _, count = limiter._hits["a"]
    assert count == 8 * 200
