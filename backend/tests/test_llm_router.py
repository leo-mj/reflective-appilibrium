from unittest.mock import patch

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from backend.config import get_settings
from backend.dependencies import ALLOWED_BASE_URLS, allowed_base_urls, get_llm_service
from backend.main import app
from backend.tests.conftest import make_settings


def test_test_endpoint_returns_ok(client, mock_llm_complete):
    res = client.post(
        "/api/llm/test",
        headers={
            "x-api-key": "user-key",
            "x-base-url": "https://api.openai.com/v1",
            "x-model": "gpt-4o-mini",
        },
    )
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "model": "gpt-4o-mini"}


def test_test_endpoint_uses_byok_model(client, mock_llm_complete):
    res = client.post(
        "/api/llm/test",
        headers={
            "x-api-key": "user-key",
            "x-base-url": "https://api.openai.com/v1",
            "x-model": "gpt-4o",
        },
    )
    assert res.json()["model"] == "gpt-4o"


def test_server_key_blocked_from_non_localhost(client, mock_llm_complete):
    # No x-api-key from a non-localhost origin: must be rejected.
    res = client.post(
        "/api/llm/test",
        headers={
            "x-base-url": "https://api.openai.com/v1",
        },
    )
    assert res.status_code == 403


def test_rejects_unknown_base_url(client, mock_llm_complete):
    res = client.post(
        "/api/llm/test",
        headers={
            "x-api-key": "user-key",
            "x-base-url": "https://evil.com/v1",
        },
    )
    assert res.status_code == 400


class _Listing:
    """What the SDKs' ``models.list()`` returns: iterated with ``async for``."""

    def __init__(self, models):
        self._models = models

    def __aiter__(self):
        async def gen():
            for m in self._models:
                yield m

        return gen()


def _model(id, created=None):
    return type("Model", (), {"id": id, "created": created})()


def test_models_lists_the_providers_newest_first(client, mock_llm_complete):
    mock_llm_complete.return_value.models.list = lambda: _Listing(
        [_model("old", 1), _model("newest", 3), _model("middle", 2)]
    )
    res = client.get(
        "/api/llm/models",
        headers={"x-api-key": "user-key", "x-base-url": "https://api.openai.com/v1"},
    )
    assert res.status_code == 200
    assert res.json() == {"models": ["newest", "middle", "old"]}


def test_models_keeps_anthropics_own_order(client):
    # Anthropic lists newest first itself, and carries created_at, not created.
    with patch("backend.services.llm.AsyncAnthropic") as mock:
        mock.return_value.models.list = lambda: _Listing(
            [_model("claude-newer"), _model("claude-older")]
        )
        res = client.get(
            "/api/llm/models",
            headers={
                "x-api-key": "user-key",
                "x-base-url": "https://api.anthropic.com/v1",
            },
        )
    assert res.json() == {"models": ["claude-newer", "claude-older"]}


def test_models_reports_a_refused_key(client, mock_llm_complete):
    def refuse():
        raise RuntimeError("Incorrect API key provided")

    mock_llm_complete.return_value.models.list = refuse
    res = client.get(
        "/api/llm/models",
        headers={"x-api-key": "bad", "x-base-url": "https://api.openai.com/v1"},
    )
    assert res.status_code == 400
    assert "Incorrect API key" in res.json()["detail"]


def test_models_goes_through_the_same_gates(client, mock_llm_complete):
    # An unlisted provider, and a server key from a non-localhost caller.
    assert (
        client.get(
            "/api/llm/models",
            headers={"x-api-key": "k", "x-base-url": "https://evil.com/v1"},
        ).status_code
        == 400
    )
    assert (
        client.get(
            "/api/llm/models", headers={"x-base-url": "https://api.openai.com/v1"}
        ).status_code
        == 403
    )


def test_complete_uses_byok_key(client, mock_llm_complete):
    res = client.post(
        "/api/llm/complete",
        json={
            "messages": [{"role": "user", "content": "hello"}],
        },
        headers={
            "x-api-key": "user-key",
            "x-base-url": "https://api.openai.com/v1",
            "x-model": "gpt-4o",
        },
    )
    assert res.status_code == 200
    call_kwargs = mock_llm_complete.call_args.kwargs
    assert call_kwargs["api_key"] == "user-key"


# ── The Ollama URL is the server's own loopback ───────────────────────────────

OLLAMA = "http://localhost:11434/v1"


def _uses_llm_service(dependant) -> bool:
    return any(
        d.call is get_llm_service or _uses_llm_service(d)
        for d in dependant.dependencies
    )


# Every route that can reach a provider, found rather than listed, so a new one
# is covered without anyone remembering to add it here.
LLM_ROUTES = sorted(
    (next(iter(r.methods)), r.path)
    for r in app.routes
    if isinstance(r, APIRoute) and _uses_llm_service(r.dependant)
)


def test_the_llm_routes_are_found():
    """Guards the guard: a walk that found nothing would pass silently."""
    assert ("GET", "/api/llm/models") in LLM_ROUTES
    assert ("POST", "/api/llm/test") in LLM_ROUTES
    assert len(LLM_ROUTES) >= 10


@pytest.mark.parametrize("method, path", LLM_ROUTES)
def test_a_hosted_server_refuses_the_ollama_url(method, path):
    """Hosted, localhost is the server, not the visitor.

    The body is empty on purpose: the allowlist has to answer before the payload
    is looked at, as the access-token gate does.
    """
    app.dependency_overrides[get_settings] = lambda: make_settings(deployment="hosted")
    headers = {"x-api-key": "ollama", "x-base-url": OLLAMA}
    res = TestClient(app).request(
        method, path, headers=headers, json=None if method == "GET" else {}
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "Unsupported provider URL"


def test_a_hosted_server_still_accepts_the_remote_providers(mock_llm_complete):
    app.dependency_overrides[get_settings] = lambda: make_settings(deployment="hosted")
    res = TestClient(app).post(
        "/api/llm/test",
        headers={"x-api-key": "k", "x-base-url": "https://api.openai.com/v1"},
    )
    assert res.status_code == 200


def test_a_local_server_accepts_the_ollama_url(mock_llm_complete):
    app.dependency_overrides[get_settings] = lambda: make_settings(deployment="local")
    res = TestClient(app).post(
        "/api/llm/test",
        headers={"x-api-key": "ollama", "x-base-url": OLLAMA, "x-model": "qwen3"},
    )
    assert res.status_code == 200
    assert mock_llm_complete.call_args.kwargs["base_url"] == OLLAMA


def test_hosted_drops_every_loopback_url_and_nothing_else():
    hosted = allowed_base_urls(make_settings(deployment="hosted"))
    assert OLLAMA not in hosted
    assert hosted == {u for u in ALLOWED_BASE_URLS if "localhost" not in u}
    assert allowed_base_urls(make_settings()) == ALLOWED_BASE_URLS
