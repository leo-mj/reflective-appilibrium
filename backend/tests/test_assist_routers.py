"""Router-level guarantees for the assist endpoints.

These cover behaviour the prompt alone cannot ensure: what happens when the
model ignores an instruction, and what happens when filtering leaves too little
to work with.
"""

import json

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_llm_service
from backend.main import app
from backend.models.re_state import DEFAULT_CONFIDENCE
from backend.services.llm import CompletionResult, LLMConfig, LLMService


class StubLLM(LLMService):
    """An LLMService that returns a canned payload without any network call."""

    def __init__(self, payload):
        super().__init__(LLMConfig("k", "https://api.openai.com/v1", "stub-model"))
        self._payload = payload

    async def complete_with_usage(self, *args, **kwargs):
        return CompletionResult(
            text=json.dumps(self._payload), input_tokens=1, output_tokens=1
        )


@pytest.fixture
def llm_client():
    """Return a factory that builds a TestClient wired to a canned LLM payload."""

    def build(payload):
        app.dependency_overrides[get_llm_service] = lambda: StubLLM(payload)
        return TestClient(app)

    yield build
    app.dependency_overrides.clear()


def el(id_="J1", type_="judgment", status="active"):
    return {
        "id": id_,
        "type": type_,
        "status": status,
        "confidence": 1.0,
        "text": "some element text",
        "addedRound": 1,
        "origin": "",
    }


# ── confidence is not the model's to assign ───────────────────────────────────


def test_judgment_confidences_are_overridden(llm_client):
    # The model scores its options despite the prompt; those scores must not
    # reach the user as if they were the user's own.
    client = llm_client(
        {
            "suggestions": [
                {
                    "question": "Q?",
                    "judgments": [
                        {"text": "A", "confidence": 1.0},
                        {"text": "B", "confidence": 0.33},
                        {"text": "C"},
                    ],
                }
            ]
        }
    )
    res = client.post(
        "/api/judgments/elicit", json={"topic": "t", "elements": [el()], "log": []}
    )
    assert res.status_code == 200
    options = res.json()["suggestions"][0]["judgments"]
    assert [o["confidence"] for o in options] == [DEFAULT_CONFIDENCE] * 3


def test_principle_confidences_are_overridden(llm_client):
    client = llm_client(
        {
            "suggestions": [
                {"text": "P", "confidence": 1.0, "covers": ["J1"], "explanation": "e"},
                {"text": "P2", "covers": [], "explanation": "e2"},
            ]
        }
    )
    res = client.post(
        "/api/principles/suggest", json={"topic": "t", "elements": [el()]}
    )
    assert res.status_code == 200
    assert [s["confidence"] for s in res.json()["suggestions"]] == [
        DEFAULT_CONFIDENCE
    ] * 2
