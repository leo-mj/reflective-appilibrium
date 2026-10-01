from unittest.mock import patch

import anthropic
import httpx
import openai
import pytest
from fastapi.testclient import TestClient

from backend.config import get_settings
from backend.dependencies import ALLOWED_BASE_URLS, allowed_base_urls
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


# ── A refused key reads as the provider's sentence, not its payload ───────────


def _response(url: str, status: int = 401) -> httpx.Response:
    return httpx.Response(status, request=httpx.Request("GET", url))


def _anthropic_refusal(message: str) -> anthropic.AuthenticationError:
    """As the Anthropic client raises it: the whole response body kept."""
    body = {
        "type": "error",
        "error": {"type": "authentication_error", "message": message},
    }
    return anthropic.AuthenticationError(
        f"Error code: 401 - {body}",
        response=_response("https://api.anthropic.com/v1/models"),
        body=body,
    )


def _openai_refusal(message: str) -> openai.AuthenticationError:
    """As the OpenAI client raises it: ``error`` already unwrapped from the body."""
    body = {
        "message": message,
        "type": "invalid_request_error",
        "code": "invalid_api_key",
    }
    return openai.AuthenticationError(
        f"Error code: 401 - {{'error': {body}}}",
        response=_response("https://api.openai.com/v1/models"),
        body=body,
    )


def _raises(exc):
    def list_models():
        raise exc

    return list_models


def test_an_anthropic_refusal_reads_as_its_message(client):
    with patch("backend.services.llm.AsyncAnthropic") as mock:
        mock.return_value.models.list = _raises(
            _anthropic_refusal("API key is invalid.")
        )
        res = client.get(
            "/api/llm/models",
            headers={"x-api-key": "bad", "x-base-url": "https://api.anthropic.com/v1"},
        )
    assert res.status_code == 400
    assert res.json()["detail"] == "401: API key is invalid."


def test_an_openai_refusal_reads_as_its_message(client, mock_llm_complete):
    mock_llm_complete.return_value.models.list = _raises(
        _openai_refusal("Incorrect API key provided.")
    )
    res = client.get(
        "/api/llm/models",
        headers={"x-api-key": "bad", "x-base-url": "https://api.openai.com/v1"},
    )
    assert res.json()["detail"] == "401: Incorrect API key provided."


def test_the_connection_test_reads_the_same_way(client, mock_llm_complete):
    create = mock_llm_complete.return_value.chat.completions.create
    create.side_effect = _openai_refusal("Incorrect API key provided.")
    res = client.post(
        "/api/llm/test",
        headers={"x-api-key": "bad", "x-base-url": "https://api.openai.com/v1"},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "401: Incorrect API key provided."


def test_a_key_quoted_in_the_message_is_still_redacted(client, mock_llm_complete):
    # Assembled, as in test_security_controls, so a scanner does not take it for a leak.
    key = "sk-proj-" + "AbCdEfGhIjKlMnOpQr"
    mock_llm_complete.return_value.models.list = _raises(
        _openai_refusal(f"Incorrect API key provided: {key}.")
    )
    res = client.get(
        "/api/llm/models",
        headers={"x-api-key": "bad", "x-base-url": "https://api.openai.com/v1"},
    )
    detail = res.json()["detail"]
    assert key not in detail
    assert detail.startswith("401: Incorrect API key provided: [redacted]")


def test_an_error_with_no_body_falls_back_to_its_text(client, mock_llm_complete):
    """A connection failure has no response to read; its own text is what there is."""
    mock_llm_complete.return_value.models.list = _raises(
        RuntimeError("Connection refused")
    )
    res = client.get(
        "/api/llm/models",
        headers={"x-api-key": "k", "x-base-url": "https://api.openai.com/v1"},
    )
    assert res.json()["detail"] == "Connection refused"


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


def _llm_routes() -> list[tuple[str, str]]:
    """Every route that can reach a provider, found rather than listed.

    Read off the OpenAPI schema: each route that depends on ``get_llm_service``
    declares its ``x-base-url`` header there. Not off ``app.routes``, whose shape
    is FastAPI's own business — from 0.13x an included router stays one opaque
    entry there, and a walk over it found nothing.
    """
    paths = app.openapi()["paths"]
    return sorted(
        (method.upper(), path)
        for path, operations in paths.items()
        for method, operation in operations.items()
        if any(
            p["in"] == "header" and p["name"] == "x-base-url"
            for p in operation.get("parameters", [])
        )
    )


# So that a new one is covered without anyone remembering to add it here.
LLM_ROUTES = _llm_routes()


def test_the_llm_routes_are_found():
    """Guards the guard: a search that found nothing would pass silently."""
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
