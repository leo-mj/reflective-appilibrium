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
from backend.dependencies import ALLOWED_BASE_URLS, client_identity, get_llm_service
from backend.main import app
from backend.routers.shared import scrub_provider_error
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
    settings = make_settings(cors_origins=" https://a.io , https://b.io ")
    assert settings.cors_origins_list == ["https://a.io", "https://b.io"]


@pytest.mark.parametrize(
    "value",
    [
        "https://leo-mj.github.io/reflective-appilibrium",
        "https://example.com/",
        "http://localhost:5173,https://example.com/app",
        "https://example.com?x=1",
        "example.com",
        "ftp://example.com",
    ],
    ids=[
        "pages-path",
        "trailing-slash",
        "second-entry",
        "query",
        "no-scheme",
        "scheme",
    ],
)
def test_cors_origins_rejects_anything_that_is_not_a_bare_origin(value):
    """The browser's Origin header has no path, and Starlette matches verbatim —
    so a Pages URL with its repo path would never match, and fail every request."""
    with pytest.raises(ValidationError, match="not an origin"):
        make_settings(cors_origins=value)


@pytest.mark.parametrize("value", ["", "  ", ","])
def test_cors_origins_may_be_empty_for_a_same_origin_deployment(value):
    """One proxy serving the page and routing /api to the backend: no browser
    ever calls from another origin, so there is nothing to allow — and nothing
    should be, rather than a placeholder origin kept to get past startup."""
    assert make_settings(cors_origins=value).cors_origins_list == []


def test_a_same_origin_deployment_answers_no_cross_origin_caller():
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    api = FastAPI()
    api.add_middleware(
        CORSMiddleware,
        allow_origins=make_settings(cors_origins="").cors_origins_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @api.get("/api/health")
    def health():
        return {"status": "ok"}

    res = TestClient(api).get(
        "/api/health", headers={"Origin": "https://elsewhere.org"}
    )
    assert res.status_code == 200
    assert "access-control-allow-origin" not in res.headers


def test_cors_origins_accepts_a_port():
    assert make_settings(cors_origins="http://127.0.0.1:5173").cors_origins_list == [
        "http://127.0.0.1:5173"
    ]


# ── Docs and response headers ─────────────────────────────────────────────────


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_docs_are_served_locally_and_absent_when_hosted(path):
    """A public schema with a Try-it-out button spends a visitor's key for anyone."""
    try:
        app.dependency_overrides[get_settings] = lambda: make_settings()
        assert TestClient(app).get(path).status_code == 200
        app.dependency_overrides[get_settings] = lambda: make_settings(
            deployment="hosted"
        )
        assert TestClient(app).get(path).status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_every_response_carries_the_security_headers():
    try:
        app.dependency_overrides[get_settings] = lambda: make_settings()
        res = TestClient(app).get("/api/health")
    finally:
        app.dependency_overrides.clear()
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["referrer-policy"] == "no-referrer"
    assert res.headers["content-security-policy"] == "frame-ancestors 'none'"


def test_only_api_responses_are_marked_no_store():
    """API replies carry a user's reasoning; the docs page is no one's."""
    try:
        app.dependency_overrides[get_settings] = lambda: make_settings()
        client = TestClient(app)
        api, docs = client.get("/api/health"), client.get("/docs")
    finally:
        app.dependency_overrides.clear()
    assert api.headers["cache-control"] == "no-store"
    assert "no-store" not in docs.headers.get("cache-control", "")


def test_an_error_response_carries_the_headers_too():
    try:
        app.dependency_overrides[get_settings] = lambda: make_settings()
        res = TestClient(app).post("/api/simulate_rethon/simulate", json={})
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 422
    assert res.headers["cache-control"] == "no-store"


# ── Server-side keys are loopback-only ────────────────────────────────────────


@pytest.fixture
def settings_with_server_key():
    return make_settings(
        llm_api_keys={"https://api.openai.com/v1": "server-key"},
        default_model="gpt-4o-mini",
    )


def _request_from(client_host):
    """A stand-in for a Request with a chosen peer — TestClient cannot vary it."""

    class _Client:
        host = client_host

    class _Request:
        client = _Client() if client_host is not None else None

    return _Request()


def _call(settings, client_host, **headers):
    """Invoke the dependency directly, deriving identity as production does."""
    request = _request_from(client_host)
    identity = client_identity(
        request, settings, x_app_token=headers.get("x_app_token")
    )
    return get_llm_service(
        request,
        settings,
        identity,
        x_api_key=headers.get("x_api_key"),
        x_base_url=headers.get("x_base_url", "https://api.openai.com/v1"),
        x_model=headers.get("x_model"),
    )


@pytest.mark.parametrize("host", ["127.0.0.1", "::1", "localhost"])
def test_loopback_callers_may_use_the_server_key(settings_with_server_key, host):
    service = _call(settings_with_server_key, host)
    assert isinstance(service, LLMService)
    assert service.model == "gpt-4o-mini"


def test_an_absent_peer_is_not_treated_as_local(settings_with_server_key):
    """Fail closed when the peer cannot be determined.

    This used to default to 127.0.0.1, i.e. "assume local", which grants the
    server's key to a caller we could not identify.
    """
    with pytest.raises(Exception) as exc:
        _call(settings_with_server_key, None)
    assert exc.value.status_code == 403


def test_loopback_grant_can_be_switched_off_for_deployments(settings_with_server_key):
    """The setting a deployment behind a reverse proxy must set.

    There, the socket peer is the proxy and is usually itself on loopback, so
    the host check alone would hand the server's key to every remote caller.
    """
    deployed = make_settings(
        llm_api_keys={"https://api.openai.com/v1": "server-key"},
        allow_loopback_server_keys=False,
    )
    with pytest.raises(Exception) as exc:
        _call(deployed, "127.0.0.1")
    assert exc.value.status_code == 403

    # BYOK still works — the deployment is not broken, just closed.
    assert isinstance(_call(deployed, "127.0.0.1", x_api_key="user-key"), LLMService)


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


# ── The optional access token ─────────────────────────────────────────────────


def _client_with(settings) -> TestClient:
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app)


def test_no_token_configured_means_no_gate():
    """The localhost default: nothing to authenticate, so nothing is demanded."""
    try:
        res = _client_with(make_settings()).get("/api/sessions")
        assert res.status_code != 401
    finally:
        app.dependency_overrides.clear()


def test_a_configured_token_is_required():
    try:
        client = _client_with(make_settings(app_access_tokens="s3cret"))
        assert client.get("/api/sessions").status_code == 401
        assert (
            client.get("/api/sessions", headers={"x-app-token": "wrong"}).status_code
            == 401
        )
        assert (
            client.get("/api/sessions", headers={"x-app-token": "s3cret"}).status_code
            == 200
        )
    finally:
        app.dependency_overrides.clear()


def test_health_stays_open_so_uptime_checks_need_no_credential():
    try:
        client = _client_with(make_settings(app_access_tokens="s3cret"))
        assert client.get("/api/health").status_code == 200
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "path",
    [
        "/api/sessions",
        "/api/llm/configured-providers",
    ],
)
def test_the_gate_covers_routers_generally(path):
    """Applied at include_router, so a new route is gated without being listed."""
    try:
        client = _client_with(make_settings(app_access_tokens="s3cret"))
        assert client.get(path).status_code == 401
    finally:
        app.dependency_overrides.clear()


# ── LLM rate limiting ─────────────────────────────────────────────────────────


def test_llm_requests_are_capped_per_client(mock_llm_complete):
    settings = make_settings(
        llm_api_keys={"https://api.openai.com/v1": "server-key"},
        llm_rate_limit_per_minute=3,
    )
    headers = {"x-api-key": "user-key", "x-base-url": "https://api.openai.com/v1"}
    try:
        client = _client_with(settings)
        codes = [
            client.post("/api/llm/test", headers=headers).status_code for _ in range(5)
        ]
    finally:
        app.dependency_overrides.clear()

    assert codes[:3] == [200, 200, 200]
    assert codes[3:] == [429, 429]


def test_a_rate_limited_response_says_when_to_retry(mock_llm_complete):
    settings = make_settings(
        llm_api_keys={"https://api.openai.com/v1": "server-key"},
        llm_rate_limit_per_minute=1,
    )
    headers = {"x-api-key": "user-key", "x-base-url": "https://api.openai.com/v1"}
    try:
        client = _client_with(settings)
        client.post("/api/llm/test", headers=headers)
        blocked = client.post("/api/llm/test", headers=headers)
    finally:
        app.dependency_overrides.clear()

    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) >= 1


def test_rate_limiting_is_off_by_configuration(mock_llm_complete):
    settings = make_settings(
        llm_api_keys={"https://api.openai.com/v1": "server-key"},
        llm_rate_limit_per_minute=0,
    )
    headers = {"x-api-key": "user-key", "x-base-url": "https://api.openai.com/v1"}
    try:
        client = _client_with(settings)
        codes = [
            client.post("/api/llm/test", headers=headers).status_code for _ in range(20)
        ]
    finally:
        app.dependency_overrides.clear()
    assert set(codes) == {200}


# ── Provider errors are scrubbed before they reach the caller ─────────────────


# Assembled from fragments rather than written out. These are exactly the shapes
# a provider quotes back in a 401, which is the point of the fixture — and also
# why a literal one here is indistinguishable from a real leak to a scanner. The
# gitleaks pre-commit hook refused the commit that first spelled them out, which
# was the hook working correctly.
_FAKE_OPENAI_KEY = "sk-proj-" + "AbCdEfGhIjKlMnOpQr"
_FAKE_STRIPE_KEY = "sk" + "_live_" + "1234567890abcdef"
_FAKE_GENERIC_KEY = "API-KEY-" + "abcdefghijklmnop"


@pytest.mark.parametrize(
    "raw, secret",
    [
        (
            f"Incorrect API key provided: {_FAKE_OPENAI_KEY}. Check your key.",
            _FAKE_OPENAI_KEY,
        ),
        (f"auth failed for {_FAKE_STRIPE_KEY}", _FAKE_STRIPE_KEY),
        (f"bad key: {_FAKE_GENERIC_KEY}", _FAKE_GENERIC_KEY),
    ],
    ids=["openai", "stripe-shaped", "generic"],
)
def test_scrub_removes_key_shaped_text(raw, secret):
    cleaned = scrub_provider_error(raw)
    assert "[redacted]" in cleaned
    assert secret not in cleaned


def test_scrub_keeps_the_useful_part_of_the_message():
    cleaned = scrub_provider_error("The model `gpt-9` does not exist.")
    assert cleaned == "The model `gpt-9` does not exist."


def test_scrub_caps_the_length():
    assert len(scrub_provider_error("x" * 5_000)) <= 400


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
