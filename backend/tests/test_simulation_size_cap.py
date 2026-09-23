"""The ceiling on one request's size, as opposed to how many are allowed.

A rate limit bounds the number of simulations a caller may start. It says nothing
about how long any one of them takes, and every computation in these routers
builds a BDD over the sentence pool — work exponential in the element count. Five
requests a minute is no protection at all if the first never returns.

So the hosted posture caps the pool, and these pin that the cap is enforced at
every entry point rather than only the obvious one. Two of them —
``/quick_score`` and ``/score_changes`` — wrap their bodies in a bare ``except``
that turns any failure into an empty response, so a guard placed carelessly
inside that block would be swallowed and the oversized BDD built anyway.
"""

import pytest
from fastapi.testclient import TestClient

from backend.config import get_settings
from backend.main import app
from backend.tests.conftest import make_settings

CAP = 5


@pytest.fixture
def client():
    app.dependency_overrides[get_settings] = lambda: make_settings(
        deployment="hosted", max_simulation_elements=CAP
    )
    yield TestClient(app)
    app.dependency_overrides.clear()


def elements(n: int) -> list[dict]:
    """``n`` elements, alternating so there is always a principle among them.

    Ids must match ``^[JPT]\\d+$`` — schema validation runs before the endpoint,
    so an id of the wrong shape produces a 422 of its own and every assertion
    below would pass without the cap existing at all.
    """
    return [
        {
            "id": f"J{i}" if i % 2 else f"P{i}",
            "type": "judgment" if i % 2 else "principle",
            "status": "active",
            "confidence": 0.7,
            "text": f"element {i}",
            "addedRound": 1,
        }
        for i in range(1, n + 1)
    ]


def relations() -> list[dict]:
    """One argument: P2 and J3 jointly entail J1."""
    return [
        {
            "from": premise,
            "to": "J1",
            "type": "jointly_entails",
            "explanation": "",
            "addedRound": 1,
            "argumentId": "a1",
        }
        for premise in ("P2", "J3")
    ]


def payload(n: int, **extra) -> dict:
    return {"elements": elements(n), "relations": relations(), **extra}


# Every endpoint that builds a structure, and what it needs in its body beyond
# the elements and relations.
#
# `round` is a string on /simulate and /step (a label carried through to the
# response) and an integer on /score_per_round (a loop count). Same name, and
# not the same field — which is why the cap on the integer one is the only one
# that matters for size.
ENDPOINTS = [
    ("/api/simulate_rethon/simulate", {"round": "1"}),
    ("/api/simulate_rethon/step", {"round": "1"}),
    ("/api/simulate_rethon/score_per_round", {"round": 2}),
    ("/api/simulate_rethon/quick_score", {}),
    ("/api/simulate_rethon/score_changes", {}),
]


@pytest.mark.parametrize("path, extra", ENDPOINTS)
def test_a_pool_over_the_cap_is_refused(client, path, extra):
    res = client.post(path, json=payload(CAP + 1, **extra))
    assert res.status_code == 422


@pytest.mark.parametrize("path, extra", ENDPOINTS)
def test_the_refusal_says_what_the_cap_is_and_how_to_lift_it(client, path, extra):
    detail = client.post(path, json=payload(CAP + 1, **extra)).json()["detail"]
    assert str(CAP) in detail
    assert "locally" in detail


@pytest.mark.parametrize("path, extra", ENDPOINTS)
def test_a_pool_at_the_cap_is_accepted(client, path, extra):
    """Exactly at the cap is inside it — the check is ``>``, not ``>=``."""
    res = client.post(path, json=payload(CAP, **extra))
    assert res.status_code != 422, res.text


# ── The two that swallow their own exceptions ─────────────────────────────────


@pytest.mark.parametrize(
    "path", ["/api/simulate_rethon/quick_score", "/api/simulate_rethon/score_changes"]
)
def test_the_scoring_endpoints_refuse_rather_than_returning_empty(client, path):
    """A blank score would say "nothing to score", not "this server declined".

    Both of these answer an oversized-but-valid request with nulls in several
    other situations — too few elements, no argument relations — and the frontend
    renders any of those as an empty badge. Returning nulls here too would make a
    refused request indistinguishable from a trivial one.
    """
    res = client.post(path, json=payload(CAP + 1))
    assert res.status_code == 422
    assert "at most" in res.json()["detail"]


# ── Local installs are not capped ─────────────────────────────────────────────


def test_a_local_install_accepts_a_pool_that_hosted_would_refuse():
    app.dependency_overrides[get_settings] = lambda: make_settings()
    try:
        res = TestClient(app).post(
            "/api/simulate_rethon/quick_score", json=payload(CAP + 20)
        )
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 200


def test_hosted_caps_the_pool_by_default():
    assert make_settings(deployment="hosted").simulation_max_elements == 20


def test_local_does_not():
    assert make_settings().simulation_max_elements == 0


def test_an_explicit_zero_lifts_the_cap_even_when_hosted():
    s = make_settings(deployment="hosted", max_simulation_elements=0)
    assert s.simulation_max_elements == 0


# ── The round count, which multiplies with the pool ───────────────────────────


def test_score_per_round_refuses_an_absurd_round_count(client):
    """One simulation per round, so this is the one payload where two numbers
    multiply — and it was bounded below but not above."""
    res = client.post(
        "/api/simulate_rethon/score_per_round", json=payload(CAP, round=10_000)
    )
    assert res.status_code == 422


def test_score_per_round_still_accepts_a_realistic_round_count(client):
    res = client.post(
        "/api/simulate_rethon/score_per_round", json=payload(CAP, round=12)
    )
    assert res.status_code == 200
