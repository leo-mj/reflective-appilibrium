"""Sessions router — /api/sessions.

The store itself is covered in test_storage.py; what is checked here is the HTTP
layer around it: that the four verbs are wired to the right store methods, that a
missing session is a 404 rather than a 500, and that a state survives the full
POST-then-GET round trip with its history intact.
"""

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_session_store
from backend.main import app
from backend.storage import MarkdownSessionStore


@pytest.fixture
def client(tmp_path):
    store = MarkdownSessionStore(tmp_path)
    app.dependency_overrides[get_session_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()


def a_state(**overrides) -> dict:
    return {
        "topic": "Autonomy and paternalism",
        "phase": 2,
        "round": 2,
        "elements": [
            {
                "id": "J1",
                "type": "judgment",
                "status": "active",
                "confidence": 0.67,
                "text": "Some verdict.",
                "addedRound": 1,
            }
        ],
        "relations": [],
        "coherence": {"tensions": [], "orphans": [], "clusters": []},
        "log": [],
        **overrides,
    }


def test_save_returns_201_and_metadata(client):
    res = client.post("/api/sessions", json=a_state())
    assert res.status_code == 201
    body = res.json()
    assert body["topic"] == "Autonomy and paternalism"
    assert body["round"] == 2
    assert body["session_id"].endswith("_autonomy-and-paternalism")


def test_save_then_load_round_trips_history(client):
    """The POST/GET pair is the path that used to lose the history record."""
    events = [
        {"round": 2, "type": "withdrawn", "reason": "Too broad."},
        {"round": 3, "type": "reinstated"},
    ]
    state = a_state(
        round=3,
        elements=[
            {
                "id": "J1",
                "type": "judgment",
                "status": "active",
                "confidence": 0.67,
                "text": "Some verdict.",
                "addedRound": 1,
                "history": events,
            }
        ],
    )
    session_id = client.post("/api/sessions", json=state).json()["session_id"]

    loaded = client.get(f"/api/sessions/{session_id}")
    assert loaded.status_code == 200
    assert loaded.json()["elements"][0]["history"] == events


def test_load_omits_unset_optional_fields(client):
    """The API response and the saved file must be the same shape.

    Otherwise a session loaded over HTTP and then exported by the frontend
    carries an explicit null for every field the user never set.
    """
    session_id = client.post("/api/sessions", json=a_state()).json()["session_id"]
    element = client.get(f"/api/sessions/{session_id}").json()["elements"][0]
    assert "previousText" not in element
    assert "history" not in element


def test_list_is_empty_before_anything_is_saved(client):
    assert client.get("/api/sessions").json() == []


def test_list_returns_saved_sessions(client):
    client.post("/api/sessions", json=a_state(topic="First"))
    client.post("/api/sessions", json=a_state(topic="Second"))
    topics = {m["topic"] for m in client.get("/api/sessions").json()}
    assert topics == {"First", "Second"}


def test_load_missing_is_404(client):
    res = client.get("/api/sessions/20260115_093000_nope")
    assert res.status_code == 404
    assert res.json()["detail"] == "Session not found"


def test_delete_removes_the_session(client):
    session_id = client.post("/api/sessions", json=a_state()).json()["session_id"]
    assert client.delete(f"/api/sessions/{session_id}").status_code == 204
    assert client.get(f"/api/sessions/{session_id}").status_code == 404


def test_delete_missing_is_404(client):
    assert client.delete("/api/sessions/20260115_093000_nope").status_code == 404


def test_save_rejects_a_malformed_state(client):
    # round is required and must be >= 1.
    assert client.post("/api/sessions", json={"topic": "t"}).status_code == 422
    assert client.post("/api/sessions", json=a_state(round=0)).status_code == 422


def test_save_rejects_an_unknown_element_field(client):
    """``extra="forbid"`` surfaces schema drift as a 422 instead of dropping it."""
    bad = a_state()
    bad["elements"][0]["somethingNew"] = 1
    assert client.post("/api/sessions", json=bad).status_code == 422
