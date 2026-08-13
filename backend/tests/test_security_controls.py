"""Controls that are load-bearing for security but had no test.

Three of them:

- ``Settings.no_wildcard`` — refuses ``*`` in CORS_ORIGINS, so a deployment
  cannot accidentally open the API to every origin.
- ``get_llm_service``'s loopback rule — server-side API keys are usable only from
  localhost; a remote browser must bring its own.  The existing router suite
  covers the *denial*; the grant is what actually spends money, so it is checked
  here too.
- ``ALLOWED_BASE_URLS`` — the provider allowlist, which is the real security
  boundary.  The frontend's ``LLM_PROVIDERS`` list must agree with it, and until
  now the only thing holding the two together was a comment in each file.
"""

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.config import get_settings
from backend.dependencies import ALLOWED_BASE_URLS, get_llm_service
from backend.main import app
from backend.services.llm import LLMService
from backend.tests.conftest import make_settings

PROVIDERS_JS = (
    Path(__file__).resolve().parents[2]
    / "app"
    / "src"
    / "constants"
    / "llmProviders.js"
)


# ── CORS ──────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "value",
    ["*", "http://localhost:5173,*", " * ", "*,https://example.com"],
    ids=["bare", "trailing", "padded", "leading"],
)
def test_cors_origins_rejects_a_wildcard_anywhere_in_the_list(value):
    with pytest.raises(ValidationError, match="Wildcard"):
        make_settings(cors_origins=value)


def test_cors_origins_allows_an_explicit_list():
    settings = make_settings(cors_origins="http://localhost:5173,https://example.com")
    assert settings.cors_origins_list == [
        "http://localhost:5173",
        "https://example.com",
    ]


def test_cors_origins_list_strips_whitespace():
    assert make_settings(cors_origins=" a , b ").cors_origins_list == ["a", "b"]


# ── Server-side keys are loopback-only ────────────────────────────────────────


@pytest.fixture
def settings_with_server_key():
    return make_settings(
        llm_api_keys={"https://api.openai.com/v1": "server-key"},
        default_model="gpt-4o-mini",
    )


def _call(settings, client_host, **headers):
    """Invoke the dependency directly — TestClient cannot vary the peer address."""

    class _Client:
        host = client_host

    class _Request:
        client = _Client()

    return get_llm_service(
        _Request(),
        settings,
        x_api_key=headers.get("x_api_key"),
        x_base_url=headers.get("x_base_url", "https://api.openai.com/v1"),
        x_model=headers.get("x_model"),
    )


@pytest.mark.parametrize("host", ["127.0.0.1", "::1", "localhost"])
def test_loopback_callers_may_use_the_server_key(settings_with_server_key, host):
    service = _call(settings_with_server_key, host)
    assert isinstance(service, LLMService)
    assert service.model == "gpt-4o-mini"


@pytest.mark.parametrize("host", ["10.0.0.4", "203.0.113.7", "example.com"])
def test_remote_callers_may_not(settings_with_server_key, host):
    with pytest.raises(Exception) as exc:
        _call(settings_with_server_key, host)
    assert exc.value.status_code == 403


def test_remote_callers_may_still_bring_their_own_key(settings_with_server_key):
    service = _call(settings_with_server_key, "203.0.113.7", x_api_key="user-key")
    assert isinstance(service, LLMService)


def test_missing_base_url_is_rejected(settings_with_server_key):
    with pytest.raises(Exception) as exc:
        _call(settings_with_server_key, "127.0.0.1", x_base_url=None)
    assert exc.value.status_code == 400


@pytest.mark.parametrize(
    "base_url",
    [
        "https://evil.com/v1",
        "https://api.openai.com.evil.com/v1",
        "https://api.openai.com/v1/../../evil",
        "http://api.openai.com/v1",  # downgraded scheme
    ],
    ids=["unknown", "lookalike-suffix", "traversal", "http-downgrade"],
)
def test_unlisted_provider_urls_are_rejected(settings_with_server_key, base_url):
    with pytest.raises(Exception) as exc:
        _call(settings_with_server_key, "127.0.0.1", x_base_url=base_url)
    assert exc.value.status_code == 400


def test_no_configured_key_for_an_allowed_provider_is_a_400():
    settings = make_settings(llm_api_keys={}, default_model="gpt-4o-mini")
    with pytest.raises(Exception) as exc:
        _call(settings, "127.0.0.1")
    assert exc.value.status_code == 400


# ── The frontend/backend provider allowlist must agree ────────────────────────


def _base_urls_declared_in_frontend() -> set[str]:
    """Pull the base URLs out of the LLMProvider constructor calls in the JS.

    Parsing the source rather than duplicating the list is the point: a literal
    copy here would be one more thing to keep in sync, which is the failure this
    test exists to prevent.
    """
    source = PROVIDERS_JS.read_text(encoding="utf-8")
    # new LLMProvider("id", "Label", "<base url>", [...]
    pattern = r"new LLMProvider\(\s*\"[^\"]*\",\s*\"[^\"]*\",\s*\"([^\"]+)\""
    return set(re.findall(pattern, source))


def test_the_parser_actually_finds_providers():
    """Guards the guard: a regex that matches nothing would pass silently."""
    assert len(_base_urls_declared_in_frontend()) >= 4


def test_frontend_provider_list_matches_the_backend_allowlist():
    """The backend list is the security boundary; the frontend one is UX.

    They have to describe the same set, or a provider offered in the settings
    modal fails at request time with "Unsupported provider URL".
    """
    assert _base_urls_declared_in_frontend() == ALLOWED_BASE_URLS


# ── Keys are never served to the browser ──────────────────────────────────────


def test_configured_providers_lists_urls_but_never_keys():
    settings = make_settings(
        llm_api_keys={
            "https://api.openai.com/v1": "sk-secret",
            "https://api.anthropic.com/v1": "sk-ant-secret",
        }
    )
    app.dependency_overrides[get_settings] = lambda: settings
    try:
        body = TestClient(app).get("/api/llm/configured-providers").text
    finally:
        app.dependency_overrides.clear()

    assert "https://api.openai.com/v1" in body
    assert "secret" not in body
