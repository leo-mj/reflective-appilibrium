"""The rethon worker pools.

What it has to guarantee, beyond the endpoint tests that already run through it:
that moving a computation into another process changes none of its results; that
the event loop is actually free while one runs, which a thread never managed;
that a worker's log lines still arrive; and that the app's shutdown stops it.
"""

import asyncio
import random
import time

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend import process_pool
from backend.config import get_settings
from backend.main import app
from backend.routers.rethon_schemas import (
    ScoreChangesRequest,
    ScorePerRoundRequest,
    SimulateRethonRequest,
)
from backend.services.rethon_scoring import (
    compute_quick_score,
    compute_score_changes,
    compute_score_per_round,
)
from backend.services.rethon_simulation import (
    simulate_one_step,
    simulate_to_fixed_point,
    validate_and_build,
)
from backend.tests.conftest import make_settings


def _payload() -> dict:
    """A small position that scores: P2 and J3 jointly entail J1, J4 rejected."""
    elements = [
        ("J1", "judgment", "active", 1),
        ("P2", "principle", "active", 1),
        ("J3", "judgment", "active", 1),
        ("J4", "judgment", "rejected", 2),
    ]
    return {
        "elements": [
            {
                "id": id_,
                "type": type_,
                "status": status,
                "confidence": 0.7,
                "text": f"element {id_}",
                "addedRound": added,
            }
            for id_, type_, status, added in elements
        ],
        "relations": [
            {
                "from": premise,
                "to": "J1",
                "type": "jointly_entails",
                "explanation": "",
                "addedRound": 1,
                "argumentId": "a1",
            }
            for premise in ("P2", "J3")
        ],
    }


# ── Same answers from the other side of a pipe ────────────────────────────────


def test_quick_score_is_identical_in_a_worker():
    req = ScoreChangesRequest.model_validate(_payload())
    args = (req.elements, req.relations, req.weights, 0)

    direct = compute_quick_score(*args)
    pooled = asyncio.run(
        process_pool.run_in_pool("scoring", compute_quick_score, *args)
    )

    assert direct.account is not None  # a null on both sides would prove nothing
    assert pooled == direct


def test_score_changes_are_identical_in_a_worker():
    req = ScoreChangesRequest.model_validate(_payload())
    args = (req.elements, req.relations, req.local, req.weights, 0)

    direct = compute_score_changes(*args)
    pooled = asyncio.run(
        process_pool.run_in_pool("scoring", compute_score_changes, *args)
    )

    assert any(d.delta_account is not None for d in direct.withdrawal_deltas)
    assert pooled == direct


def _deterministic_rounds() -> dict:
    """Two rounds whose full simulations have exactly one outcome each.

    Not ``_payload()``: a full rethon simulation breaks ties between equally good
    positions at random, and that position's second round has two outcomes (about
    4:1 over repeated runs in a single process). Comparing it across the pipe
    would fail one run in three for reasons that have nothing to do with the pool.
    Here round 1 has too few elements to score and round 2 has a unique fixed
    point — checked stable over 60 runs.
    """
    base = _payload()
    return {
        "elements": [
            dict(e, addedRound=2) if e["id"] == "J3" else e
            for e in base["elements"]
            if e["id"] != "J4"
        ],
        "relations": [dict(r, addedRound=2) for r in base["relations"]],
        "round": 2,
    }


def test_score_per_round_is_identical_in_a_worker():
    req = ScorePerRoundRequest.model_validate(_deterministic_rounds())
    args = (req.elements, req.relations, req.round, req.local, req.weights)

    direct = compute_score_per_round(*args)
    pooled = asyncio.run(
        process_pool.run_in_pool("simulation", compute_score_per_round, *args)
    )

    assert direct[0].scores is None and direct[1].scores is not None
    assert pooled == direct


def _seeded(fn, *args):
    """Run ``fn`` with Python's random generator seeded.

    rethon breaks ties between equally good positions with ``random.choice``, so
    the path a full simulation takes varies from run to run even where its scores
    do not — six different evolutions in forty runs, for a position this small.
    Seeded, a run is the same in this process and in a fresh worker (checked).
    """
    random.seed(0)
    return fn(*args)


def _simulation_args(evolution=None) -> tuple:
    req = SimulateRethonRequest.model_validate({"round": "1", **_payload()})
    built, lookup, n = validate_and_build(req.elements, req.relations, 3)
    return (built, lookup, n, req.elements, evolution, req.local, req.weights, 1)


@pytest.mark.parametrize("fn", [simulate_to_fixed_point, simulate_one_step])
def test_a_simulation_is_identical_in_a_worker(fn):
    args = _simulation_args()

    direct = _seeded(fn, *args)
    pooled = asyncio.run(process_pool.run_in_pool("simulation", _seeded, fn, *args))

    assert len(direct.translated_re_state.evolution) > 1
    assert pooled == direct


# ── The point of the exercise ─────────────────────────────────────────────────


def _hold_the_gil(n: int) -> int:
    """One long C-level call, which keeps the GIL for its whole duration.

    Deliberately not a Python busy-loop: the interpreter hands the GIL to other
    threads every 5ms between bytecodes, so a Python loop in a thread barely
    slows the event loop, and a test built on one passes with or without the
    pool. ``sum(range(n))`` never yields. Module-level, so it pickles.
    """
    return sum(range(n))


# Around a second on a development machine.
_ONE_SECOND_OF_WORK = 60_000_000


def test_the_event_loop_keeps_running_while_a_worker_computes():
    """The work happens in another interpreter entirely.

    rethon itself does not need this to keep the loop responsive — it is pure
    Python and yields the GIL often — but a computation that holds the GIL
    stalls the loop for its whole length when run in a thread (0.9s for this
    workload, measured), and in a worker it must not stall it at all. A test
    that could not tell a worker from a thread would pin nothing."""

    async def scenario() -> float:
        # Warm the pool first, so worker start-up is not what gets measured.
        await process_pool.run_in_pool("simulation", _hold_the_gil, 0)
        job = asyncio.ensure_future(
            process_pool.run_in_pool("simulation", _hold_the_gil, _ONE_SECOND_OF_WORK)
        )
        worst = 0.0
        while not job.done():
            before = time.monotonic()
            await asyncio.sleep(0.01)
            worst = max(worst, time.monotonic() - before)
        await job
        return worst

    assert asyncio.run(scenario()) < 0.25


def test_a_score_does_not_wait_behind_a_simulation():
    """Why there are two pools.

    With one, a long simulation held every /quick_score behind it, and the score
    badges — fired on every edit — sat blank for as long as it ran. Here the
    simulation pool is kept busy for about three seconds, and a real score
    lookup must come back well before that work finishes.
    """
    req = ScoreChangesRequest.model_validate(_payload())

    async def scenario() -> tuple[float, bool]:
        # Warm both, so start-up is not what gets measured.
        await asyncio.gather(
            process_pool.run_in_pool("simulation", _hold_the_gil, 0),
            process_pool.run_in_pool("scoring", _hold_the_gil, 0),
        )
        simulation = asyncio.ensure_future(
            process_pool.run_in_pool(
                "simulation", _hold_the_gil, 3 * _ONE_SECOND_OF_WORK
            )
        )
        await asyncio.sleep(0.1)  # let the simulation get under way
        started = time.monotonic()
        score = await process_pool.run_in_pool(
            "scoring", compute_quick_score, req.elements, req.relations, None, 0
        )
        waited = time.monotonic() - started
        still_simulating = not simulation.done()
        await simulation
        assert score.account is not None
        return waited, still_simulating

    waited, still_simulating = asyncio.run(scenario())
    assert still_simulating, "the simulation finished first, so this proved nothing"
    assert waited < 1.0


# ── Logging in a spawned worker ───────────────────────────────────────────────


def test_a_worker_logs(capfd):
    """A spawned worker runs none of main.py, and rethon's import disables every
    logger that exists before it — process_pool's own among them. The initializer
    is what undoes that; without it this line never appears."""
    pool = process_pool.create_pool(1)
    try:
        pool.submit(_hold_the_gil, 0).result(timeout=60)
    finally:
        pool.shutdown(wait=True)
    assert "Simulation worker ready." in capfd.readouterr().err


# ── Lifecycle ─────────────────────────────────────────────────────────────────


def test_the_pool_is_created_without_the_app_starting():
    """The suite builds TestClient(app) with no `with` block, so startup never
    runs; a pool created there would not exist for any of those tests."""
    app.dependency_overrides[get_settings] = lambda: make_settings()
    try:
        res = TestClient(app).post("/api/simulate_rethon/quick_score", json=_payload())
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 200
    assert res.json()["account"] is not None


def test_the_app_shutting_down_stops_the_workers():
    app.dependency_overrides[get_settings] = lambda: make_settings()
    try:
        with TestClient(app) as client:
            client.post("/api/simulate_rethon/quick_score", json=_payload())
            client.post(
                "/api/simulate_rethon/score_per_round", json=_deterministic_rounds()
            )
            assert set(process_pool._pools) == {"scoring", "simulation"}
    finally:
        app.dependency_overrides.clear()
    assert process_pool._pools == {}


def test_a_step_past_the_fixed_point_is_still_a_400():
    """Refused inside the worker, as the only place that knows the process has
    finished. An HTTPException raised there would fail to unpickle and reach the
    caller as a 500; SimulationFinished is what crosses instead."""
    app.dependency_overrides[get_settings] = lambda: make_settings()
    try:
        client = TestClient(app)
        payload = {"round": "1", **_payload()}
        finished = client.post("/api/simulate_rethon/simulate", json=payload)
        assert finished.status_code == 200
        state = finished.json()["translated_re_state"]
        assert state["finished"]

        res = client.post(
            "/api/simulate_rethon/step",
            json={**payload, "evolution": state["evolution"]},
        )
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 400
    assert res.json()["detail"] == "The RE process has already reached a fixed point."


def test_each_endpoint_uses_the_pool_for_its_kind(monkeypatch):
    """A score lookup sent to the simulation pool would queue behind simulations
    again — the thing the split exists to prevent — and pass every other test."""
    used = []
    timeouts = set()

    async def record(name, fn, *args, timeout=0, stop=None, **kwargs):
        used.append((fn.__name__, name))
        timeouts.add(timeout)
        return fn(*args, **kwargs)

    monkeypatch.setattr("backend.routers.simulate_rethon.run_in_pool", record)
    app.dependency_overrides[get_settings] = lambda: make_settings(
        simulation_timeout_seconds=7
    )
    try:
        client = TestClient(app)
        client.post("/api/simulate_rethon/quick_score", json=_payload())
        client.post("/api/simulate_rethon/score_changes", json=_payload())
        client.post(
            "/api/simulate_rethon/score_per_round", json=_deterministic_rounds()
        )
        client.post("/api/simulate_rethon/simulate", json={"round": "1", **_payload()})
        client.post("/api/simulate_rethon/step", json={"round": "1", **_payload()})
    finally:
        app.dependency_overrides.clear()
    assert used == [
        ("compute_quick_score", "scoring"),
        ("compute_score_changes", "scoring"),
        ("compute_score_per_round", "simulation"),
        ("simulate_to_fixed_point", "simulation"),
        ("simulate_one_step", "simulation"),
    ]
    assert timeouts == {7}, "an endpoint left without a timeout can run forever"


# ── Stopping a computation ────────────────────────────────────────────────────


def _worker_processes(name):
    return list(process_pool._pools[name]._processes.values())


def _assert_stopped(processes):
    """A killed worker is reaped by the executor's own thread, a moment later."""
    deadline = time.monotonic() + 5
    while any(p.is_alive() for p in processes) and time.monotonic() < deadline:
        time.sleep(0.05)
    assert not any(p.is_alive() for p in processes)


def test_a_computation_past_its_timeout_is_stopped_with_a_504():
    async def scenario():
        await process_pool.run_in_pool("simulation", _hold_the_gil, 0)  # warm
        workers = _worker_processes("simulation")
        started = time.monotonic()
        with pytest.raises(HTTPException) as refused:
            await process_pool.run_in_pool(
                "simulation", _hold_the_gil, 30 * _ONE_SECOND_OF_WORK, timeout=0.5
            )
        return refused.value, time.monotonic() - started, workers

    refused, took, workers = asyncio.run(scenario())
    assert refused.status_code == 504
    assert took < 3, "the caller waited for the computation after all"
    _assert_stopped(workers)


def test_a_worker_that_dies_gets_a_503_and_the_next_request_succeeds():
    async def scenario():
        await process_pool.run_in_pool("simulation", _hold_the_gil, 0)  # warm
        (worker,) = _worker_processes("simulation")
        job = asyncio.ensure_future(
            process_pool.run_in_pool(
                "simulation", _hold_the_gil, 30 * _ONE_SECOND_OF_WORK
            )
        )
        await asyncio.sleep(0.3)
        worker.kill()  # what the kernel's OOM killer would do
        with pytest.raises(HTTPException) as refused:
            await job
        after = await process_pool.run_in_pool("simulation", _hold_the_gil, 10)
        return refused.value, after

    refused, after = asyncio.run(scenario())
    assert refused.status_code == 503
    assert after == 45


def test_cancelling_a_running_computation_kills_its_worker():
    """What a caller going away will use: without the kill, a request nobody is
    waiting for any more would go on holding the only worker to its end."""

    async def scenario():
        await process_pool.run_in_pool("simulation", _hold_the_gil, 0)  # warm
        workers = _worker_processes("simulation")
        job = asyncio.ensure_future(
            process_pool.run_in_pool(
                "simulation", _hold_the_gil, 30 * _ONE_SECOND_OF_WORK
            )
        )
        await asyncio.sleep(0.3)
        job.cancel()
        with pytest.raises(asyncio.CancelledError):
            await job
        return workers

    _assert_stopped(asyncio.run(scenario()))


def test_setting_stop_kills_a_running_computation():
    async def scenario():
        await process_pool.run_in_pool("simulation", _hold_the_gil, 0)  # warm
        workers = _worker_processes("simulation")
        stop = asyncio.Event()
        asyncio.get_running_loop().call_later(0.3, stop.set)
        started = time.monotonic()
        with pytest.raises(process_pool.ComputationStopped):
            await process_pool.run_in_pool(
                "simulation", _hold_the_gil, 30 * _ONE_SECOND_OF_WORK, stop=stop
            )
        return workers, time.monotonic() - started

    workers, took = asyncio.run(scenario())
    assert took < 3
    _assert_stopped(workers)


def test_stopping_a_queued_computation_leaves_the_running_one_alone():
    """And gives its place in line back: a leaked place would leave the pool's
    one worker idle and every later request waiting for it for ever."""

    async def scenario():
        await process_pool.run_in_pool("simulation", _hold_the_gil, 0)  # warm
        workers = _worker_processes("simulation")
        ahead = asyncio.ensure_future(
            process_pool.run_in_pool("simulation", _hold_the_gil, _ONE_SECOND_OF_WORK)
        )
        await asyncio.sleep(0.1)
        stop = asyncio.Event()
        asyncio.get_running_loop().call_later(0.2, stop.set)
        with pytest.raises(process_pool.ComputationStopped):
            await process_pool.run_in_pool("simulation", _hold_the_gil, 10, stop=stop)
        assert all(p.is_alive() for p in workers)
        ahead_result = await ahead
        after = await asyncio.wait_for(
            process_pool.run_in_pool("simulation", _hold_the_gil, 10), timeout=10
        )
        return ahead_result, after

    ahead_result, after = asyncio.run(scenario())
    assert ahead_result == sum(range(_ONE_SECOND_OF_WORK))
    assert after == 45


def test_stopping_one_computation_spares_the_ones_queued_behind_it():
    """Why requests queue in front of the pool rather than inside it: a queued
    task inside a pool that gets killed would fail along with the one stopped."""

    async def scenario():
        await process_pool.run_in_pool("simulation", _hold_the_gil, 0)  # warm
        runaway = asyncio.ensure_future(
            process_pool.run_in_pool(
                "simulation", _hold_the_gil, 30 * _ONE_SECOND_OF_WORK, timeout=0.5
            )
        )
        await asyncio.sleep(0.1)
        queued = asyncio.ensure_future(
            process_pool.run_in_pool("simulation", _hold_the_gil, 10)
        )
        outcomes = await asyncio.gather(runaway, queued, return_exceptions=True)
        return outcomes

    runaway, queued = asyncio.run(scenario())
    assert isinstance(runaway, HTTPException) and runaway.status_code == 504
    assert queued == 45


def test_the_timeout_counts_computing_not_waiting_in_line():
    async def scenario():
        await process_pool.run_in_pool("simulation", _hold_the_gil, 0)  # warm
        ahead = asyncio.ensure_future(
            process_pool.run_in_pool(
                "simulation", _hold_the_gil, 2 * _ONE_SECOND_OF_WORK
            )
        )
        await asyncio.sleep(0.1)
        started = time.monotonic()
        behind = await process_pool.run_in_pool(
            "simulation", _hold_the_gil, 10, timeout=0.5
        )
        waited = time.monotonic() - started
        await ahead
        return behind, waited

    behind, waited = asyncio.run(scenario())
    assert waited > 0.5, "nothing was ahead of it, so this proved nothing"
    assert behind == 45


def test_shutdown_does_not_wait_for_a_running_computation():
    async def scenario():
        await process_pool.run_in_pool("simulation", _hold_the_gil, 0)  # warm
        job = asyncio.ensure_future(
            process_pool.run_in_pool(
                "simulation", _hold_the_gil, 30 * _ONE_SECOND_OF_WORK
            )
        )
        await asyncio.sleep(0.3)
        started = time.monotonic()
        process_pool.shutdown_pools()
        took = time.monotonic() - started
        await asyncio.gather(job, return_exceptions=True)
        return took

    assert asyncio.run(scenario()) < 1


@pytest.mark.parametrize(
    "overrides, expected",
    [
        ({}, 0),
        ({"deployment": "hosted"}, 60),
        ({"deployment": "hosted", "simulation_timeout_seconds": 0}, 0),
        ({"simulation_timeout_seconds": 5}, 5),
    ],
)
def test_the_timeout_follows_the_deployment(overrides, expected):
    assert make_settings(**overrides).simulation_timeout == expected


@pytest.mark.parametrize("field", ["simulation_workers", "scoring_workers"])
def test_worker_counts_must_be_at_least_one(field):
    with pytest.raises(Exception):
        make_settings(**{field: 0})
