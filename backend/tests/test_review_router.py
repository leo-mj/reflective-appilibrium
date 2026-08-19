"""Router-level guarantees for the process-review endpoint.

The prompt asks for five parts and a 500-word ceiling. Neither is something the
prompt can enforce, so what matters here is that a reply missing a part still
reaches the user, that an unusable reply is reported as the upstream model's
failure rather than ours, and that a long reply is reported rather than mangled.
"""

import json
import logging

import pytest
from fastapi.testclient import TestClient

from backend.dependencies import get_llm_service
from backend.main import app
from backend.services.llm import CompletionResult, LLMConfig, LLMService


class StubLLM(LLMService):
    """An LLMService that returns canned text without any network call."""

    def __init__(self, text):
        super().__init__(LLMConfig("k", "https://api.openai.com/v1", "stub-model"))
        self._text = text

    async def complete_with_usage(self, *args, **kwargs):
        return CompletionResult(text=self._text, input_tokens=1, output_tokens=1)


@pytest.fixture
def llm_client():
    """Return a factory that builds a TestClient wired to canned LLM output."""

    def build(text):
        app.dependency_overrides[get_llm_service] = lambda: StubLLM(text)
        return TestClient(app)

    yield build
    app.dependency_overrides.clear()


def payload(**overrides):
    return json.dumps(
        {
            "headline": "The position moved from rights to harm.",
            "arc": "arc text",
            "surprises": "surprises text",
            "missed": "missed text",
            "method": "method text",
            **overrides,
        }
    )


def state(**overrides):
    return {
        "topic": "trolley",
        "round": 4,
        "elements": [
            {
                "id": "J1",
                "type": "judgment",
                "status": "active",
                "confidence": 1.0,
                "text": "some element text",
                "addedRound": 1,
                "origin": "user",
            }
        ],
        "relations": [],
        "log": [],
        **overrides,
    }


def post(client, **overrides):
    return client.post("/api/review/analyze", json={"state": state(**overrides)})


# ── the happy path ────────────────────────────────────────────────────────────


def test_all_five_parts_reach_the_response(llm_client):
    res = post(llm_client(payload()))
    assert res.status_code == 200
    body = res.json()
    assert body["headline"] == "The position moved from rights to harm."
    assert body["arc"] == "arc text"
    assert body["surprises"] == "surprises text"
    assert body["missed"] == "missed text"
    assert body["method"] == "method text"
    assert body["model"] == "stub-model"


def test_earlier_reviews_are_accepted_on_the_way_in(llm_client):
    # They ride inside the state rather than in a field of their own, so a
    # rejected `reviews` key would make every review after the first a 422.
    res = post(
        llm_client(payload()),
        reviews=[
            {
                "id": "rev-1",
                "round": 2,
                "headline": "An earlier reading.",
                "arc": "a",
                "surprises": "s",
                "missed": "m",
                "method": "me",
                "model": "stub-model",
                "origin": "stub-model",
            }
        ],
    )
    assert res.status_code == 200


# ── when the model does not cooperate ─────────────────────────────────────────


def test_a_missing_part_comes_back_empty_rather_than_failing(llm_client):
    # Four good sections are worth more to the user than a 500 over the fifth.
    raw = json.loads(payload())
    del raw["method"]
    res = post(llm_client(json.dumps(raw)))
    assert res.status_code == 200
    assert res.json()["method"] == ""
    assert res.json()["arc"] == "arc text"


def test_unparseable_reply_is_reported_as_an_upstream_failure(llm_client):
    # 502, not 500: the request was fine, the model's answer was not — and the
    # detail is what tells the user to retry rather than to change their input.
    res = post(llm_client("Sure! Here is your review:"))
    assert res.status_code == 502
    assert "stub-model" in res.json()["detail"]


def test_a_json_array_reply_is_reported_too(llm_client):
    res = post(llm_client('["not", "an", "object"]'))
    assert res.status_code == 502


# ── the word ceiling is reported, not enforced ────────────────────────────────


def test_an_overlong_review_is_delivered_intact_and_warned_about(llm_client, caplog):
    # Truncating would cut prose mid-sentence and rejecting would hand the user an
    # error they cannot act on, so the cap is a target the log tracks.
    long_arc = " ".join(["word"] * 600)
    with caplog.at_level(logging.WARNING, logger="backend.routers.review"):
        res = post(llm_client(payload(arc=long_arc)))
    assert res.status_code == 200
    assert res.json()["arc"] == long_arc
    assert "over the 500-word target" in caplog.text


def test_a_review_within_budget_logs_no_warning(llm_client, caplog):
    with caplog.at_level(logging.WARNING, logger="backend.routers.review"):
        res = post(llm_client(payload()))
    assert res.status_code == 200
    assert "over the 500-word target" not in caplog.text


def test_our_loggers_survive_the_rethon_import():
    # `import rethon` configures logging with disable_existing_loggers at its
    # default, switching off every logger created before it — which was most of
    # ours, so their output vanished with nothing to show it had. main.py undoes
    # that; this pins it, because the symptom is silence.
    import backend.main  # noqa: F401  — the fix runs at import

    for name, logger in logging.Logger.manager.loggerDict.items():
        if name.startswith("backend") and isinstance(logger, logging.Logger):
            assert not logger.disabled, f"{name} is disabled"
