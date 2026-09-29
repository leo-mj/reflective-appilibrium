"""Single-premise arguments reach rethon, as joint ones always did.

``entails`` and ``precludes`` were left out of every dialectical structure: only
the joint pair was grouped into arguments. A process argued one premise at a
time was simulated as though it had no arguments at all, and one with nothing
else was refused outright ("No argument relations found").
"""

import pytest
from fastapi.testclient import TestClient

from backend.config import get_settings
from backend.main import app
from backend.models.re_state import REElement, RERelation
from backend.services.rethon_caps import argued_element_ids
from backend.services.rethon_simulation import build_numerical_arguments
from backend.tests.conftest import make_settings


def el(id_, type_="judgment"):
    return REElement.model_validate(
        {
            "id": id_,
            "type": type_,
            "status": "active",
            "confidence": 0.7,
            "text": f"element {id_}",
            "addedRound": 1,
        }
    )


def rel(from_, to, type_, argument_id=None):
    return RERelation.model_validate(
        {
            "from": from_,
            "to": to,
            "type": type_,
            "explanation": "",
            "addedRound": 1,
            **({"argumentId": argument_id} if argument_id else {}),
        }
    )


ELEMENTS = [el("P1", "principle"), el("J2"), el("J3"), el("J4")]
INDEX = {"P1": 1, "J2": 2, "J3": 3, "J4": 4}


def arguments_of(relations):
    return sorted(build_numerical_arguments(ELEMENTS, relations).num_arguments)


def test_a_single_premise_entails_is_an_argument():
    assert arguments_of([rel("P1", "J2", "entails", "a1")]) == [[1, 2]]


def test_a_single_premise_precludes_negates_its_conclusion():
    assert arguments_of([rel("P1", "J2", "precludes", "a1")]) == [[1, -2]]


def test_one_without_an_argument_id_still_counts():
    """States written before every argument carried an id say plainly what a
    single-premise relation is; a joint one without an id cannot be grouped."""
    assert arguments_of(
        [
            rel("P1", "J2", "entails"),
            rel("J3", "J4", "jointly_entails"),  # no id: which premises go with it?
        ]
    ) == [[1, 2]]


def test_joint_arguments_are_grouped_as_before():
    assert arguments_of(
        [
            rel("P1", "J4", "jointly_entails", "a1"),
            rel("J2", "J4", "jointly_entails", "a1"),
            rel("J3", "P1", "precludes", "a2"),
        ]
    ) == [[1, 2, 4], [3, -1]]


def test_dialectical_relations_are_not_arguments():
    assert (
        arguments_of([rel("P1", "J2", "supports"), rel("J2", "J3", "conflicts")]) == []
    )


def test_the_cap_counts_what_rethon_is_given():
    assert argued_element_ids(
        [rel("P1", "J2", "entails", "a1"), rel("J3", "J4", "supports")]
    ) == {"P1", "J2"}


@pytest.fixture
def client():
    app.dependency_overrides[get_settings] = lambda: make_settings()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_a_process_argued_one_premise_at_a_time_is_simulated(client):
    """It used to be refused: no joint argument, so "no argument relations"."""
    body = {
        "elements": [e.model_dump(by_alias=True) for e in ELEMENTS],
        "relations": [
            r.model_dump(by_alias=True, exclude_none=True)
            for r in (
                rel("P1", "J2", "entails", "a1"),
                rel("P1", "J3", "precludes", "a2"),
            )
        ],
        "round": "1",
    }
    res = client.post("/api/simulate_rethon/simulate", json=body)
    assert res.status_code == 200, res.text[:300]
    assert len(res.json()["translated_arguments"]) == 2
