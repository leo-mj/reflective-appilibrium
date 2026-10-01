"""The whole-body ceiling (body_limit.py), which answers before anything parses.

The Pydantic caps bound each field, but only once the body has been read and
parsed on the one worker; the rate limits come later still. These pin that an
oversized body is refused before either, and that nothing a reader legitimately
sends comes near the ceiling.
"""

import asyncio

import pytest
from fastapi.testclient import TestClient

from backend.body_limit import BodySizeLimitMiddleware
from backend.config import get_settings
from backend.dependencies import get_llm_service
from backend.main import app
from backend.main import settings as boot_settings
from backend.services.llm import CompletionResult, LLMConfig, LLMService
from backend.tests.conftest import make_settings

SCORE_CHANGES = "/api/simulate_rethon/score_changes"
LIMIT = 10 * 1024 * 1024


def _hosted_client(**overrides) -> TestClient:
    settings = make_settings(deployment="hosted", **overrides)
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app)


# ── The setting ───────────────────────────────────────────────────────────────


def test_the_ceiling_follows_the_deployment():
    assert make_settings().request_body_limit == 0
    assert make_settings(deployment="hosted").request_body_limit == LIMIT
    assert (
        make_settings(deployment="hosted", max_request_body_bytes=0).request_body_limit
        == 0
    )
    assert make_settings(max_request_body_bytes=500).request_body_limit == 500


# ── Refused before it is read ─────────────────────────────────────────────────


def test_an_oversized_declared_body_is_refused_without_reading_it():
    """Called as ASGI directly, so "not read" is observed rather than inferred."""
    reads, reached = [], []

    async def receive():
        reads.append(1)
        return {"type": "http.request", "body": b"", "more_body": False}

    async def inner(scope, receive, send):
        reached.append(1)

    sent = []

    async def send(message):
        sent.append(message)

    scope = {
        "type": "http",
        "method": "POST",
        "path": SCORE_CHANGES,
        "headers": [(b"content-length", b"1001")],
    }
    asyncio.run(BodySizeLimitMiddleware(inner, lambda: 1000)(scope, receive, send))

    assert sent[0]["status"] == 413
    assert reads == [] and reached == []


def test_an_oversized_post_to_score_changes_gets_413():
    client = _hosted_client(max_request_body_bytes=1000)
    res = client.post(
        SCORE_CHANGES, content=b"x" * 1001, headers={"content-type": "application/json"}
    )
    assert res.status_code == 413
    assert "too large" in res.json()["detail"]


def test_an_oversized_body_with_no_length_is_stopped_while_it_streams():
    """Chunked, so there is no Content-Length to refuse up front."""
    client = _hosted_client(max_request_body_bytes=1000)
    chunks = (b"x" * 400 for _ in range(5))
    res = client.post(
        SCORE_CHANGES, content=chunks, headers={"content-type": "application/json"}
    )
    assert res.status_code == 413


def test_the_413_carries_cors_headers_so_the_browser_can_read_it():
    # CORS is configured once, at import, so the origin has to be one it was given.
    if not boot_settings.cors_origins_list:
        pytest.skip("started with no CORS origins")
    origin = boot_settings.cors_origins_list[0]
    client = _hosted_client(max_request_body_bytes=1000)
    res = client.post(
        SCORE_CHANGES,
        content=b"x" * 1001,
        headers={"origin": origin, "content-type": "application/json"},
    )
    assert res.status_code == 413
    assert res.headers["access-control-allow-origin"] == origin


def test_a_body_at_the_ceiling_is_let_through():
    """The limit is inclusive: 1000 bytes under a 1000-byte ceiling is parsed."""
    client = _hosted_client(max_request_body_bytes=1000)
    res = client.post(
        SCORE_CHANGES,
        content=b" " * 998 + b"{}",
        headers={"content-type": "application/json"},
    )
    assert res.status_code == 422  # reached validation, which is past the ceiling


def test_local_has_no_ceiling():
    app.dependency_overrides[get_settings] = lambda: make_settings()
    res = TestClient(app).post(
        SCORE_CHANGES,
        content=b" " * (LIMIT + 1) + b"{}",
        headers={"content-type": "application/json"},
    )
    assert res.status_code == 422


# ── What a reader legitimately sends passes the default ───────────────────────


class _StubLLM(LLMService):
    def __init__(self):
        super().__init__(LLMConfig("k", "https://api.openai.com/v1", "stub-model"))

    async def complete_with_usage(self, *args, **kwargs):
        return CompletionResult(text="a reply", input_tokens=1, output_tokens=1)

    async def complete(self, *args, **kwargs):
        return "a reply"


@pytest.fixture
def stub_llm():
    app.dependency_overrides[get_llm_service] = _StubLLM
    yield


def _large_state() -> dict:
    """A process ten times the merged samples in size, each item longer too.

    The sample merged with sample-process-climate-duties.md is 23 KB as JSON: 33
    elements and 43 relations at about 250 bytes each. This is 300 elements, 1,000
    relations and 100 log entries, every text several times the samples' length.
    """
    return {
        "topic": "t" * 500,
        "round": 100,
        "elements": [
            {
                "id": f"J{i}",
                "type": "judgment",
                "status": "active",
                "confidence": 0.5,
                "origin": "user",
                "text": "w" * 1_000,
                "addedRound": 1,
            }
            for i in range(1, 301)
        ],
        "relations": [
            {
                "from": f"J{i % 300 + 1}",
                "to": f"J{(i + 1) % 300 + 1}",
                "type": "supports",
                "explanation": "e" * 500,
                "addedRound": 1,
            }
            for i in range(1_000)
        ],
        "coherence": {"tensions": [], "orphans": [], "clusters": []},
        "log": [
            {
                "round": r,
                "findings": "f" * 1_000,
                "options": "o" * 1_000,
                "decision": "d" * 500,
                "changes": "c" * 500,
            }
            for r in range(1, 101)
        ],
    }


def test_a_large_process_in_a_full_discussion_passes(stub_llm):
    """The largest body the frontend sends: a whole state and a discussion at its caps."""
    messages = []
    for _ in range(19):
        messages += [
            {"role": "user", "content": "q" * 10_000},
            {"role": "assistant", "content": "a" * 50_000},
        ]
    messages.append({"role": "user", "content": "q" * 10_000})

    client = _hosted_client()
    res = client.post(
        "/api/conversations",
        json={
            "state": _large_state(),
            "suggestion": {"text": "s"},
            "messages": messages,
        },
    )
    assert res.status_code == 200, res.text


def test_the_largest_completion_its_own_caps_admit_passes(stub_llm):
    """/api/llm/complete at 100 messages of 100,000 characters: what 10 MiB is sized to."""
    client = _hosted_client()
    res = client.post(
        "/api/llm/complete",
        json={"messages": [{"role": "user", "content": "x" * 100_000}] * 100},
    )
    assert res.status_code == 200, res.text
