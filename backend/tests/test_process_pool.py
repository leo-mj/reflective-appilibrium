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

    async def record(name, fn, *args, **kwargs):
        used.append((fn.__name__, name))
        return fn(*args, **kwargs)

    monkeypatch.setattr("backend.routers.simulate_rethon.run_in_pool", record)
    app.dependency_overrides[get_settings] = lambda: make_settings()
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


@pytest.mark.parametrize("field", ["simulation_workers", "scoring_workers"])
def test_worker_counts_must_be_at_least_one(field):
    with pytest.raises(Exception):
        make_settings(**{field: 0})
