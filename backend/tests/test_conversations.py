"""Per-suggestion discussion sessions, and the ceilings on them.

The store is a module-level dict in one worker's memory. Expiry alone does not
bound it — a caller can open sessions faster than the TTL retires them, and each
holds a whole RE state in its system prompt — so both the number of sessions and
the length of each are capped. These are the tests for those caps.
"""

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_llm_service
from backend.main import app
from backend.routers import conversations
from backend.routers.conversations import MAX_MESSAGES, MAX_SESSIONS
from backend.services.llm import CompletionResult, LLMConfig, LLMService


class StubLLM(LLMService):
    """An LLMService that replies without any network call."""

    def __init__(self):
        super().__init__(LLMConfig("k", "https://api.openai.com/v1", "stub-model"))

    async def complete_with_usage(self, *args, **kwargs):
        return CompletionResult(text="a reply", input_tokens=1, output_tokens=1)

    async def complete(self, *args, **kwargs):
        return "a reply"


@pytest.fixture
def client():
    app.dependency_overrides[get_llm_service] = StubLLM
    conversations._sessions.clear()
    yield TestClient(app)
    app.dependency_overrides.clear()
    conversations._sessions.clear()


def a_state() -> dict:
    return {
        "topic": "t",
        "round": 1,
        "elements": [],
        "relations": [],
        "coherence": {"tensions": [], "orphans": [], "clusters": []},
        "log": [],
    }


def start(client) -> str:
    res = client.post(
        "/api/conversations",
        json={"state": a_state(), "suggestion": {"text": "s"}, "message": "hello"},
    )
    assert res.status_code == 200
    return res.json()["session_id"]


# ── Ordinary use ──────────────────────────────────────────────────────────────


def test_start_returns_a_session_and_a_reply(client):
    res = client.post(
        "/api/conversations",
        json={"state": a_state(), "suggestion": {"text": "s"}, "message": "hello"},
    )
    assert res.json()["reply"] == "a reply"
    assert res.json()["session_id"]


def test_follow_up_messages_continue_the_session(client):
    session_id = start(client)
    res = client.post(
        f"/api/conversations/{session_id}/messages", json={"message": "and then?"}
    )
    assert res.status_code == 200
    assert res.json()["session_id"] == session_id


def test_an_unknown_session_is_404(client):
    res = client.post(
        "/api/conversations/not-a-session/messages", json={"message": "hi"}
    )
    assert res.status_code == 404


# ── The caps ──────────────────────────────────────────────────────────────────


def test_the_store_never_exceeds_its_session_cap(client):
    for _ in range(MAX_SESSIONS + 10):
        start(client)
    assert len(conversations._sessions) <= MAX_SESSIONS


def test_the_oldest_session_is_the_one_evicted(client):
    first = start(client)
    for _ in range(MAX_SESSIONS):
        start(client)
    # The first session is gone, and using it says so rather than 500ing.
    res = client.post(f"/api/conversations/{first}/messages", json={"message": "hi"})
    assert res.status_code == 404


def test_a_conversation_stops_at_its_message_cap(client):
    session_id = start(client)
    codes = []
    # start() already recorded one exchange (user + assistant).
    for _ in range(MAX_MESSAGES):
        codes.append(
            client.post(
                f"/api/conversations/{session_id}/messages", json={"message": "more"}
            ).status_code
        )
    assert 409 in codes, "expected the conversation to be cut off"
    assert len(conversations._sessions[session_id].messages) <= MAX_MESSAGES


def test_the_cap_message_tells_the_user_what_to_do(client):
    session_id = start(client)
    detail = ""
    for _ in range(MAX_MESSAGES):
        res = client.post(
            f"/api/conversations/{session_id}/messages", json={"message": "more"}
        )
        if res.status_code == 409:
            detail = res.json()["detail"]
            break
    assert "Start a new one" in detail


def test_an_empty_message_is_rejected(client):
    session_id = start(client)
    res = client.post(f"/api/conversations/{session_id}/messages", json={"message": ""})
    assert res.status_code == 422


def test_an_oversized_message_is_rejected(client):
    session_id = start(client)
    res = client.post(
        f"/api/conversations/{session_id}/messages", json={"message": "x" * 10_001}
    )
    assert res.status_code == 422


# ── The provider headers these endpoints require ──────────────────────────────
#
# Every test above overrides `get_llm_service` outright, which is the right shape
# for testing the session caps — but it also skips the header validation that
# dependency performs, and the frontend client shipped without sending any
# headers at all for long enough that the Discuss panel 400'd in every
# deployment. These two exercise the real dependency (with only the provider SDK
# patched out) so the contract the browser has to satisfy is pinned here.


def _headers() -> dict:
    return {"x-api-key": "user-key", "x-base-url": "https://api.openai.com/v1"}


def _payload() -> dict:
    return {"state": a_state(), "suggestion": {"text": "s"}, "message": "hello"}


def test_starting_a_conversation_requires_a_base_url(mock_llm_complete):
    conversations._sessions.clear()
    res = TestClient(app).post("/api/conversations", json=_payload())
    assert res.status_code == 400
    assert "x-base-url" in res.json()["detail"]


def test_starting_a_conversation_succeeds_with_provider_headers(mock_llm_complete):
    conversations._sessions.clear()
    res = TestClient(app).post(
        "/api/conversations", json=_payload(), headers=_headers()
    )
    assert res.status_code == 200
    assert res.json()["session_id"]


def test_a_follow_up_message_requires_the_headers_too(mock_llm_complete):
    conversations._sessions.clear()
    http = TestClient(app)
    started = http.post("/api/conversations", json=_payload(), headers=_headers())
    session_id = started.json()["session_id"]

    # The session exists, so a 400 here can only come from the missing header.
    res = http.post(
        f"/api/conversations/{session_id}/messages", json={"message": "more"}
    )
    assert res.status_code == 400
    assert "x-base-url" in res.json()["detail"]
